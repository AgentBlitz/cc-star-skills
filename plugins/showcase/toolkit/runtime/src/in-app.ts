/**
 * The in-app path's pure parts (PLAN §2.6): the deep link (`?showcase=<id>&showcaseStep=<step>
 * &showcaseMode=watch|film`), where a vendored tour finds its files, the router hop that waits
 * for the URL, and which actions synthetic input can't do (`rehearse --synthetic`).
 *
 * The parameters are namespaced so they never clash with an app's own `tour` parameter (PLAN §3
 * Reconciliations). A tour started from a link takes them off the URL at once, so a reload
 * resumes the run from the tab's sessionStorage instead of starting it again.
 */
import type { Action, Tour } from "./schema.ts";
import { STORAGE_KEY } from "./state.ts";

export const TOUR_PARAM = "showcase";
export const STEP_PARAM = "showcaseStep";
export const MODE_PARAM = "showcaseMode";
export const SHOWCASE_PARAMS = [TOUR_PARAM, STEP_PARAM, MODE_PARAM] as const;

/** Where the app serves the tours, the voice and upload files: `<base>/tours/<id>.json` and so on. */
export const DEFAULT_BASE = "/showcase";

export interface DeepLink {
  tour: string;
  step: string | null;
  mode: "watch" | "film";
}

/** The deep link in a query string, or null. A tour id is letters, digits and dashes. */
export function readDeepLink(search: string): DeepLink | null {
  const params = new URLSearchParams(search);
  const tour = params.get(TOUR_PARAM);
  if (!tour || !/^[a-z0-9][a-z0-9-]*$/i.test(tour)) return null;
  const step = params.get(STEP_PARAM);
  return { tour, step: step || null, mode: params.get(MODE_PARAM) === "film" ? "film" : "watch" };
}

/** A deep link's URL: the path, plus the showcase parameters. */
export function deepLink(path: string, link: { tour: string; step?: string | null; mode?: "watch" | "film" }): string {
  const [pathname, query = ""] = path.split("?", 2) as [string, string?];
  const params = new URLSearchParams(query);
  params.set(TOUR_PARAM, link.tour);
  if (link.step) params.set(STEP_PARAM, link.step);
  if (link.mode === "film") params.set(MODE_PARAM, "film");
  return `${pathname}?${params.toString()}`;
}

/** The query string without the showcase parameters (with its `?`, or empty). */
export function withoutShowcaseParams(search: string): string {
  const params = new URLSearchParams(search);
  for (const p of SHOWCASE_PARAMS) params.delete(p);
  const q = params.toString();
  return q ? `?${q}` : "";
}

/**
 * Whether this page should load the runtime at all: a deep link, or a run in progress in the
 * tab. The adapters inline the same test, so the runtime's own bundle stays unloaded otherwise.
 */
export function wantsShowcase(win: { location: { search: string }; sessionStorage: { getItem(key: string): string | null } }): boolean {
  if (readDeepLink(win.location.search)) return true;
  try {
    return win.sessionStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export interface ServedPaths {
  tour: string;
  manifests: string[];
  asset: (path: string) => string;
  clip: (file: string) => string;
}

/** Where a vendored tour's files are served from `base`. */
export function servedPaths(base: string, tourId: string): ServedPaths {
  const b = base.replace(/\/+$/, "");
  return {
    tour: `${b}/tours/${encodeURIComponent(tourId)}.json`,
    // `showcase voice` writes `<tour>.manifest.json`; a hand-made `manifest.json` names its tour.
    manifests: [`${b}/voice/${encodeURIComponent(tourId)}.manifest.json`, `${b}/voice/manifest.json`],
    asset: (path) => `${b}/assets/${path.split("/").map(encodeURIComponent).join("/")}`,
    clip: (file) => `${b}/voice/${file.split("/").map(encodeURIComponent).join("/")}`,
  };
}

/** How often a router push that hasn't landed is pushed again (an app's own soft refresh can undo it). */
export const REPUSH_MS = 2_000;
/** How long a router hop may take before the step fails. */
export const ROUTE_TIMEOUT_MS = 10_000;

export interface RouteDeps {
  push: (url: string) => void | Promise<void>;
  at: () => boolean;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  signal?: AbortSignal;
}

/** Pushes through the app's router until the URL is the one asked for (as Compass's runtime does). */
export async function routeTo(url: string, deps: RouteDeps): Promise<void> {
  const started = deps.now();
  let pushed = started;
  await deps.push(url);
  while (!deps.at()) {
    if (deps.signal?.aborted) return;
    const now = deps.now();
    if (now - started > ROUTE_TIMEOUT_MS) throw new Error(`the app's router never reached ${url} (${ROUTE_TIMEOUT_MS / 1000} s)`);
    if (now - pushed > REPUSH_MS) {
      pushed = now;
      await deps.push(url);
    }
    await deps.sleep(50);
  }
}

/** An action synthetic input can't do, or may not do (`rehearse --synthetic`). */
export interface SyntheticGap {
  step: string;
  beat: string;
  action: string;
  kind: Action["kind"];
  /** `cannot`: it won't work in-app. `check`: it works only if the app handles it in script. */
  level: "cannot" | "check";
  why: string;
}

const TAB = /^(shift\+)?tab$/i;

function gapOf(a: Action): Pick<SyntheticGap, "level" | "why"> | null {
  if (a.input === "trusted") return { level: "cannot", why: "it asks for trusted input, which only the injected host can give" };
  switch (a.kind) {
    case "hover":
      return { level: "check", why: "CSS :hover and native tooltips don't answer synthetic events: only the app's own pointer listeners see it" };
    case "key":
      if (TAB.test(a.key)) return { level: "cannot", why: "a synthetic Tab doesn't move focus: focus the next field with a `focus` action" };
      return { level: "check", why: "a synthetic key has no default action: only the app's own key handlers see it (Enter in a form field still submits)" };
    case "upload":
      return { level: "check", why: "the files must be served at <base>/assets/, and the target must be the <input type=file> itself" };
    case "drag":
      return { level: "check", why: "synthetic pointer and HTML drag events work with listeners, not with the browser's own text or link dragging" };
    case "scroll":
      return a.by ? { level: "check", why: "a synthetic scroll moves the scroller directly: an app that listens for wheel events won't see one" } : null;
    default:
      return null;
  }
}

/** Every action in the tour that synthetic input can't do, or may not. */
export function syntheticGaps(tour: Tour): SyntheticGap[] {
  const gaps: SyntheticGap[] = [];
  for (const step of tour.steps) {
    for (const beat of step.beats) {
      for (const a of beat.actions ?? []) {
        const g = gapOf(a);
        if (g) gaps.push({ step: step.id, beat: beat.id, action: a.id, kind: a.kind, ...g });
      }
    }
  }
  return gaps;
}
