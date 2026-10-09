/**
 * Readiness (PLAN §2.1): the tour never sleeps and hopes. It waits for what the screen says:
 * an element visible, present, enabled or gone; an attribute, a text, a count, the URL. The wait
 * is checked now, on every DOM change (a MutationObserver) and every 100 ms on the wall clock.
 * Anchors time out at 10 s, readiness at 30 s.
 */
import { type AnchorContext, describeAnchor, isVisible, resolve, resolveAll, squash } from "./anchors.ts";
import { Aborted, type Clock } from "./clock.ts";
import type { Ready, TextMatch } from "./schema.ts";

export const ANCHOR_TIMEOUT_MS = 10_000;
export const READY_TIMEOUT_MS = 30_000;
export const POLL_MS = 100;

export interface ReadyContext extends AnchorContext {
  /** The URL to read: the top window's. */
  location: () => { pathname: string; search: string };
}

export function contextOf(anchors: AnchorContext): ReadyContext {
  return {
    ...anchors,
    location: () => {
      const view = anchors.document.defaultView;
      return view ? view.location : { pathname: "", search: "" };
    },
  };
}

function isDisabled(el: Element): boolean {
  if ((el as HTMLButtonElement).disabled === true) return true;
  if (el.getAttribute("aria-disabled") === "true") return true;
  return el.closest("fieldset[disabled]") !== null;
}

function test(match: TextMatch, value: string): boolean {
  return new RegExp(match.pattern, match.flags ?? "").test(value);
}

/** Whether the predicate holds now. */
export function evaluate(ready: Ready, ctx: ReadyContext): boolean {
  switch (ready.kind) {
    case "exists":
      return resolve(ready.anchor, ctx) !== null;
    case "visible": {
      const el = resolve(ready.anchor, ctx);
      return el !== null && isVisible(el);
    }
    case "absent":
      return resolveAll(ready.anchor, ctx).every((el) => !isVisible(el));
    case "enabled": {
      const el = resolve(ready.anchor, ctx);
      return el !== null && !isDisabled(el);
    }
    case "attr": {
      const el = resolve(ready.anchor, ctx);
      if (!el) return false;
      const raw = ready.prop ? (el as unknown as Record<string, unknown>)[ready.name] : el.getAttribute(ready.name);
      if (raw === null || raw === undefined) return false;
      const value = String(raw);
      if (ready.equals !== undefined && value !== ready.equals) return false;
      if (ready.contains !== undefined && !value.includes(ready.contains)) return false;
      if (ready.matches !== undefined && !test(ready.matches, value)) return false;
      if (ready.nonEmpty !== undefined && (value.trim() !== "") !== ready.nonEmpty) return false;
      return true;
    }
    case "text": {
      const el = resolve(ready.anchor, ctx);
      if (!el) return false;
      const value = squash(el.textContent);
      if (ready.equals !== undefined && value !== squash(ready.equals)) return false;
      if (ready.contains !== undefined && !value.toLowerCase().includes(squash(ready.contains).toLowerCase())) return false;
      if (ready.matches !== undefined && !test(ready.matches, value)) return false;
      return true;
    }
    case "count": {
      const n = resolveAll(ready.anchor, ctx).filter(isVisible).length;
      return n >= (ready.min ?? 0) && n <= (ready.max ?? Number.POSITIVE_INFINITY);
    }
    case "url": {
      const { pathname, search } = ctx.location();
      if (ready.path !== undefined && pathname !== ready.path) return false;
      const params = new URLSearchParams(search);
      return Object.entries(ready.params ?? {}).every(([k, v]) => params.get(k) === v);
    }
    case "all":
      return ready.of.every((r) => evaluate(r, ctx));
    case "any":
      return ready.of.some((r) => evaluate(r, ctx));
  }
}

/** What a predicate is about, for errors and reports. */
export function describeReady(ready: Ready, ctx?: Pick<AnchorContext, "anchors">): string {
  const named = ctx?.anchors ?? {};
  switch (ready.kind) {
    case "exists":
      return `${describeAnchor(ready.anchor, named)} exists`;
    case "visible":
      return `${describeAnchor(ready.anchor, named)} is visible`;
    case "absent":
      return `${describeAnchor(ready.anchor, named)} is gone`;
    case "enabled":
      return `${describeAnchor(ready.anchor, named)} is enabled`;
    case "attr":
      return `${describeAnchor(ready.anchor, named)} has ${ready.name}`;
    case "text":
      return `${describeAnchor(ready.anchor, named)} says ${ready.equals ?? ready.contains ?? ready.matches?.pattern ?? ""}`;
    case "count":
      return `${describeAnchor(ready.anchor, named)} × ${ready.min ?? 0}–${ready.max ?? "∞"}`;
    case "url":
      return `the URL is ${ready.path ?? ""}${ready.params ? `?${new URLSearchParams(ready.params)}` : ""}`;
    case "all":
      return ready.of.map((r) => describeReady(r, ctx)).join(" and ");
    case "any":
      return ready.of.map((r) => describeReady(r, ctx)).join(" or ");
  }
}

/** The first anchor a predicate names: where an action's result shows, and what a timeout names. */
export function anchorOf(ready: Ready): Ready extends { anchor: infer A } ? A : never {
  switch (ready.kind) {
    case "url":
      return null as never;
    case "all":
    case "any":
      for (const r of ready.of) {
        const a = anchorOf(r);
        if (a) return a;
      }
      return null as never;
    default:
      return ready.anchor as never;
  }
}

/** The wait ran out. `what` says which: an anchor that never appeared, or a state never reached. */
export class ReadyTimeout extends Error {
  readonly what: "anchor" | "ready";
  readonly detail: string;
  readonly timeoutMs: number;
  /** The anchor the wait was about, described, when there was one. */
  readonly anchor: string | null;

  constructor(what: "anchor" | "ready", detail: string, timeoutMs: number, anchor: string | null = null) {
    super(what === "anchor" ? `Couldn't find ${detail} within ${Math.round(timeoutMs / 1000)} s` : `Still waiting after ${Math.round(timeoutMs / 1000)} s: ${detail}`);
    this.name = "ReadyTimeout";
    this.what = what;
    this.detail = detail;
    this.timeoutMs = timeoutMs;
    this.anchor = anchor;
  }
}

export interface WaitOptions {
  /** Times the wait: the ×1 wall clock, so a fast tour doesn't shorten what the app is allowed. */
  clock: Clock;
  ctx: ReadyContext;
  signal?: AbortSignal;
  timeoutMs?: number;
  what?: "anchor" | "ready";
}

/** Every document a predicate may be watching: the top one and its same-origin frames. */
function documentsOf(top: Document): Document[] {
  const docs = [top];
  for (const frame of top.querySelectorAll("iframe")) {
    try {
      if (frame.contentDocument) docs.push(frame.contentDocument);
    } catch {
      // Another origin.
    }
  }
  return docs;
}

/**
 * Resolves once the predicate holds. Rejects with `ReadyTimeout` when the time runs out, and
 * with `Aborted` on abort.
 */
export async function waitFor(ready: Ready, options: WaitOptions): Promise<void> {
  const { ctx } = options;
  const doc = ctx.document;
  const timeoutMs = options.timeoutMs ?? READY_TIMEOUT_MS;
  if (options.signal?.aborted) throw new Aborted();
  if (evaluate(ready, ctx)) return;

  const stop = new AbortController();
  const onAbort = () => stop.abort();
  options.signal?.addEventListener("abort", onAbort, { once: true });
  let changed: (() => void) | null = null;
  const View = doc.defaultView;
  const observer = View && typeof View.MutationObserver === "function" ? new View.MutationObserver(() => changed?.()) : null;
  if (observer) {
    for (const d of documentsOf(doc)) observer.observe(d, { subtree: true, childList: true, attributes: true, characterData: true });
  }

  const started = options.clock.now();
  try {
    for (;;) {
      const left = timeoutMs - (options.clock.now() - started);
      if (left <= 0) {
        const anchor = anchorOf(ready);
        const described = anchor ? describeAnchor(anchor, ctx.anchors) : null;
        const looking = options.what === "anchor" && (ready.kind === "exists" || ready.kind === "visible");
        throw new ReadyTimeout(options.what ?? "ready", looking && described ? described : describeReady(ready, ctx), timeoutMs, described);
      }
      const tick = new AbortController();
      const onStop = () => tick.abort();
      stop.signal.addEventListener("abort", onStop, { once: true });
      await new Promise<void>((resolve) => {
        changed = () => {
          tick.abort();
          resolve();
        };
        options.clock.sleep(Math.min(POLL_MS, left) * options.clock.speed, tick.signal).then(resolve, resolve);
      });
      changed = null;
      stop.signal.removeEventListener("abort", onStop);
      if (options.signal?.aborted) throw new Aborted();
      if (evaluate(ready, ctx)) return;
    }
  } finally {
    observer?.disconnect();
    options.signal?.removeEventListener("abort", onAbort);
    stop.abort();
  }
}
