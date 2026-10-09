/**
 * The tour's clocks (PLAN §2.1 "Director", C5), ported from Compass. Everything the engine waits
 * for on purpose (a sentence, a dwell, the pause between typed characters) sleeps on a clock, so
 * a pause freezes it, `rehearse` runs it at ×10, and a unit test drives it by hand.
 *
 * A clock has a speed: `sleep(1000)` on a ×10 clock lasts 100 ms. The director keeps three, all
 * on the captured timers so the app can't move them: `pace` (the tour's speed, pausable), `wall`
 * (×1, never paused: how long the app may take) and `ticker` (×1, for polls).
 */
export interface Clock {
    readonly speed: number;
    readonly paused: boolean;
    /** Milliseconds this clock has run, pauses left out. */
    now(): number;
    /** Resolves after `ms` of this clock's time (`ms / speed` of real time). Rejects on abort. */
    sleep(ms: number, signal?: AbortSignal): Promise<void>;
    pause(): void;
    resume(): void;
}
/** What an aborted wait rejects with. */
export declare class Aborted extends Error {
    constructor();
}
/** Our own `Aborted`, or the `AbortError` a signal or a fetch rejects with. */
export declare function isAborted(e: unknown): boolean;
/** Rejects with `Aborted` when the signal aborts; never resolves. */
export declare function whenAborted(signal: AbortSignal): Promise<never>;
export declare function throwIfAborted(signal: AbortSignal | undefined): void;
/** The timer primitives a real clock runs on: the captured ones in a page, Node's in a test. */
export interface Timers {
    now: () => number;
    setTimeout: (fn: () => void, ms: number) => number;
    clearTimeout: (id: number) => void;
}
interface Timer {
    /** Real milliseconds still to run. */
    left: number;
    resolve: () => void;
    reject: (e: unknown) => void;
    signal?: AbortSignal;
    onAbort?: () => void;
    handle?: number | undefined;
    armedAt?: number;
}
declare abstract class BaseClock implements Clock {
    readonly speed: number;
    protected readonly timers: Set<Timer>;
    protected isPaused: boolean;
    constructor(speed?: number);
    get paused(): boolean;
    abstract now(): number;
    protected abstract arm(timer: Timer): void;
    protected abstract disarm(timer: Timer): void;
    sleep(ms: number, signal?: AbortSignal): Promise<void>;
    protected fire(timer: Timer): void;
    pause(): void;
    resume(): void;
}
/** Real time, on the timers given (the captured ones), with timers that survive a pause. */
export declare class RealClock extends BaseClock {
    private readonly timers_;
    private ran;
    private since;
    constructor(speed?: number, timers?: Timers);
    now(): number;
    protected arm(timer: Timer): void;
    protected disarm(timer: Timer): void;
    pause(): void;
    resume(): void;
}
/** Lets every promise chain that is ready to run, run. */
export declare function settle(): Promise<void>;
/** A clock a test moves by hand. Its timers fire in order as `advance` passes them. */
export declare class FakeClock extends BaseClock {
    private time;
    now(): number;
    /** How many sleeps are waiting. */
    get pending(): number;
    protected arm(): void;
    protected disarm(): void;
    /**
     * Moves real time on by `ms`, firing each timer as its moment comes and letting what it woke
     * run before the next. A paused clock stands still: its timers keep what they had left.
     */
    advance(ms: number): Promise<void>;
    /** Advances until `done()` holds, in steps; throws if it never does within `limitMs`. */
    advanceUntil(done: () => boolean, limitMs?: number, stepMs?: number): Promise<void>;
}
export interface RunClocks {
    /** The tour's own timing, at the run's speed. It pauses. */
    pace: Clock;
    /** How long the app may take. ×1, and it never pauses: the app doesn't. */
    wall: Clock;
    /** Polls and heartbeats. ×1, never paused. */
    ticker: Clock;
}
/** The three clocks of a run, on the timers given. */
export declare function createClocks(speed: number, timers?: Timers): RunClocks;
export {};
