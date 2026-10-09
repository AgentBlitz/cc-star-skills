/**
 * The executor performs one action on the real screen (PLAN §2.1 "Executor"). Compass's rules:
 *
 * 1. Prefer the visible control to a hotkey (`key` is the keyboard, the last resort).
 * 2. Scroll the target to the centre, wait up to 10 s for it, and re-read its rectangle when
 *    the pointer arrives.
 * 3. Every write has a `done` predicate, and an action whose `done` already holds is skipped.
 * 4. Blur after typing, so the page's keys work again.
 *
 * Input goes two ways. Injected, it is **trusted CDP input** through the bridge, behind a
 * Playwright-style check: the target is visible, its rectangle is stable across two frames, and
 * `elementsFromPoint` (ignoring the overlay) finds it on top, at the centre or an inset point.
 * If something still covers it, the action falls back to **synthetic input** (`dom-events.ts`)
 * and says so. An "acting" window `{kind, point, deadline}` tells the tour's input from the
 * viewer's while the host acts. In-app, every action is synthetic.
 */
import { type AnchorContext, deref, type Rect } from "./anchors.ts";
import type { Acting, Bridge } from "./bridge.ts";
import type { Natives } from "./capture.ts";
import { type Clock } from "./clock.ts";
import { type FileData } from "./dom-events.ts";
import { type OverlayPort } from "./overlay-port.ts";
import type { Action } from "./schema.ts";
/** The writes a run has made, by `journalKey`. */
export interface Journal {
    has(key: string): boolean;
    add(key: string): void;
}
export type ActionPhase = "start" | "done" | "skipped" | "timeout";
export type InputMode = "trusted" | "synthetic";
export interface CameraFrame {
    rect: Rect | null;
    scale: number;
    easeMs: number;
}
export interface ExecutorDeps {
    /** The tour's pace: typing, holds and `wait ms` sleep on it. */
    pace: Clock;
    /** A ×1 clock: how long the app may take. */
    wall: Clock;
    ctx: AnchorContext;
    natives?: Natives | null;
    /** The host, for trusted input. Absent (in-app): synthetic. */
    bridge?: Bridge | null;
    /** The run's default input (`rehearse --synthetic` forces synthetic). */
    input?: InputMode;
    overlay?: OverlayPort;
    /** The adapter registry (`showcase.actions.register`, in-app). */
    invoke?: (name: string, args?: Record<string, unknown>) => Promise<unknown>;
    /** A `goto`: the app's router in-app, else a full load. */
    navigate?: (url: string, signal?: AbortSignal) => Promise<void>;
    /** Bytes for a synthetic upload. Default: the bridge's assets, else `fetch`. */
    readFile?: (path: string) => Promise<FileData>;
    onPhase?: (action: Action, phase: ActionPhase, input?: InputMode) => void;
    onCamera?: (frame: CameraFrame) => void;
    /** Something the report should know: a synthetic fallback and why. */
    onNote?: (note: string) => void;
    /** The acting window, published for the viewer-input listener. */
    acting?: (acting: Acting | null) => void;
    /** The next animation frame (the captured rAF). Absent: at once (tests). */
    frame?: () => Promise<void>;
}
export interface RunOptions {
    /** No pointer, no pauses, nothing that is only for show: a fast-forward. */
    instant?: boolean;
    signal?: AbortSignal;
    journal?: Journal;
    /** The action's `journalKey`. */
    key?: string;
    /** A ceiling on every wait (film mode: 15 s). */
    maxWaitMs?: number;
}
export type Outcome = "done" | "skipped";
export interface Executor {
    runAction(action: Action, options?: RunOptions): Promise<Outcome>;
    /** Whether the action has already taken effect (journalled, or its `done` holds). */
    isDone(action: Action, options?: Pick<RunOptions, "journal" | "key">): boolean;
    /** Clears the spotlight and the card, and lifts the pointer off what it hovers. */
    clear(): void;
}
/** The pause between typed characters, on the pace clock. */
export declare const TYPE_MS = 40;
/** A long press, when the action doesn't say. */
export declare const PRESS_MS = 600;
/** How long the page settles after a scroll before the next move (S-D1), on the pace clock. */
export declare const SCROLL_SETTLE_MS = 300;
/** The camera's ease, recorded for v1.1. */
export declare const CAMERA_EASE_MS = 600;
/** Actions that only show something: a fast-forward leaves them out. */
export declare function isCosmetic(action: Action): boolean;
export declare class ActionError extends Error {
    readonly action: Action;
    readonly anchor: string | null;
    constructor(action: Action, message: string, anchor?: string | null);
}
export declare function createExecutor(deps: ExecutorDeps): Executor;
export { deref };
