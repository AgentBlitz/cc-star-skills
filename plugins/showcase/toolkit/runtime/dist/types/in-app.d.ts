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
export declare const TOUR_PARAM = "showcase";
export declare const STEP_PARAM = "showcaseStep";
export declare const MODE_PARAM = "showcaseMode";
export declare const SHOWCASE_PARAMS: readonly ["showcase", "showcaseStep", "showcaseMode"];
/** Where the app serves the tours, the voice and upload files: `<base>/tours/<id>.json` and so on. */
export declare const DEFAULT_BASE = "/showcase";
export interface DeepLink {
    tour: string;
    step: string | null;
    mode: "watch" | "film";
}
/** The deep link in a query string, or null. A tour id is letters, digits and dashes. */
export declare function readDeepLink(search: string): DeepLink | null;
/** A deep link's URL: the path, plus the showcase parameters. */
export declare function deepLink(path: string, link: {
    tour: string;
    step?: string | null;
    mode?: "watch" | "film";
}): string;
/** The query string without the showcase parameters (with its `?`, or empty). */
export declare function withoutShowcaseParams(search: string): string;
/**
 * Whether this page should load the runtime at all: a deep link, or a run in progress in the
 * tab. The adapters inline the same test, so the runtime's own bundle stays unloaded otherwise.
 */
export declare function wantsShowcase(win: {
    location: {
        search: string;
    };
    sessionStorage: {
        getItem(key: string): string | null;
    };
}): boolean;
export interface ServedPaths {
    tour: string;
    manifests: string[];
    asset: (path: string) => string;
    clip: (file: string) => string;
}
/** Where a vendored tour's files are served from `base`. */
export declare function servedPaths(base: string, tourId: string): ServedPaths;
/** How often a router push that hasn't landed is pushed again (an app's own soft refresh can undo it). */
export declare const REPUSH_MS = 2000;
/** How long a router hop may take before the step fails. */
export declare const ROUTE_TIMEOUT_MS = 10000;
export interface RouteDeps {
    push: (url: string) => void | Promise<void>;
    at: () => boolean;
    now: () => number;
    sleep: (ms: number) => Promise<void>;
    signal?: AbortSignal;
}
/** Pushes through the app's router until the URL is the one asked for (as Compass's runtime does). */
export declare function routeTo(url: string, deps: RouteDeps): Promise<void>;
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
/** Every action in the tour that synthetic input can't do, or may not. */
export declare function syntheticGaps(tour: Tour): SyntheticGap[];
