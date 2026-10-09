/**
 * Readiness (PLAN §2.1): the tour never sleeps and hopes. It waits for what the screen says:
 * an element visible, present, enabled or gone; an attribute, a text, a count, the URL. The wait
 * is checked now, on every DOM change (a MutationObserver) and every 100 ms on the wall clock.
 * Anchors time out at 10 s, readiness at 30 s.
 */
import { type AnchorContext } from "./anchors.ts";
import { type Clock } from "./clock.ts";
import type { Ready } from "./schema.ts";
export declare const ANCHOR_TIMEOUT_MS = 10000;
export declare const READY_TIMEOUT_MS = 30000;
export declare const POLL_MS = 100;
export interface ReadyContext extends AnchorContext {
    /** The URL to read: the top window's. */
    location: () => {
        pathname: string;
        search: string;
    };
}
export declare function contextOf(anchors: AnchorContext): ReadyContext;
/** Whether the predicate holds now. */
export declare function evaluate(ready: Ready, ctx: ReadyContext): boolean;
/** What a predicate is about, for errors and reports. */
export declare function describeReady(ready: Ready, ctx?: Pick<AnchorContext, "anchors">): string;
/** The first anchor a predicate names: where an action's result shows, and what a timeout names. */
export declare function anchorOf(ready: Ready): Ready extends {
    anchor: infer A;
} ? A : never;
/** The wait ran out. `what` says which: an anchor that never appeared, or a state never reached. */
export declare class ReadyTimeout extends Error {
    readonly what: "anchor" | "ready";
    readonly detail: string;
    readonly timeoutMs: number;
    /** The anchor the wait was about, described, when there was one. */
    readonly anchor: string | null;
    constructor(what: "anchor" | "ready", detail: string, timeoutMs: number, anchor?: string | null);
}
export interface WaitOptions {
    /** Times the wait: the ×1 wall clock, so a fast tour doesn't shorten what the app is allowed. */
    clock: Clock;
    ctx: ReadyContext;
    signal?: AbortSignal;
    timeoutMs?: number;
    what?: "anchor" | "ready";
}
/**
 * Resolves once the predicate holds. Rejects with `ReadyTimeout` when the time runs out, and
 * with `Aborted` on abort.
 */
export declare function waitFor(ready: Ready, options: WaitOptions): Promise<void>;
