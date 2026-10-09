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
export class Aborted extends Error {
  constructor() {
    super("Aborted");
    this.name = "Aborted";
  }
}

/** Our own `Aborted`, or the `AbortError` a signal or a fetch rejects with. */
export function isAborted(e: unknown): boolean {
  if (e instanceof Aborted) return true;
  return typeof e === "object" && e !== null && (e as { name?: unknown }).name === "AbortError";
}

/** Rejects with `Aborted` when the signal aborts; never resolves. */
export function whenAborted(signal: AbortSignal): Promise<never> {
  return new Promise<never>((_, reject) => {
    if (signal.aborted) reject(new Aborted());
    else signal.addEventListener("abort", () => reject(new Aborted()), { once: true });
  });
}

export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new Aborted();
}

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

abstract class BaseClock implements Clock {
  readonly speed: number;
  protected readonly timers = new Set<Timer>();
  protected isPaused = false;

  constructor(speed = 1) {
    if (!(speed > 0)) throw new Error(`A clock's speed is positive: ${speed}`);
    this.speed = speed;
  }

  get paused(): boolean {
    return this.isPaused;
  }

  abstract now(): number;
  protected abstract arm(timer: Timer): void;
  protected abstract disarm(timer: Timer): void;

  sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Aborted());
        return;
      }
      const timer: Timer = { left: Math.max(0, ms) / this.speed, resolve, reject };
      if (signal) {
        timer.signal = signal;
        timer.onAbort = () => {
          this.disarm(timer);
          this.timers.delete(timer);
          reject(new Aborted());
        };
        signal.addEventListener("abort", timer.onAbort, { once: true });
      }
      this.timers.add(timer);
      if (!this.isPaused) this.arm(timer);
    });
  }

  protected fire(timer: Timer): void {
    this.timers.delete(timer);
    if (timer.onAbort) timer.signal?.removeEventListener("abort", timer.onAbort);
    timer.resolve();
  }

  pause(): void {
    if (this.isPaused) return;
    this.isPaused = true;
    for (const t of this.timers) this.disarm(t);
  }

  resume(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    for (const t of this.timers) this.arm(t);
  }
}

function nodeTimers(): Timers {
  const g = globalThis as unknown as {
    performance?: { now(): number };
    setTimeout: (fn: () => void, ms: number) => unknown;
    clearTimeout: (id: unknown) => void;
  };
  return {
    now: () => (g.performance ? g.performance.now() : Date.now()),
    setTimeout: (fn, ms) => g.setTimeout(fn, ms) as number,
    clearTimeout: (id) => g.clearTimeout(id),
  };
}

/** Real time, on the timers given (the captured ones), with timers that survive a pause. */
export class RealClock extends BaseClock {
  private readonly timers_: Timers;
  private ran = 0;
  private since: number | null;

  constructor(speed = 1, timers: Timers = nodeTimers()) {
    super(speed);
    this.timers_ = timers;
    this.since = timers.now();
  }

  now(): number {
    return this.ran + (this.since === null ? 0 : this.timers_.now() - this.since);
  }

  protected arm(timer: Timer): void {
    timer.armedAt = this.timers_.now();
    timer.handle = this.timers_.setTimeout(() => this.fire(timer), timer.left);
  }

  protected disarm(timer: Timer): void {
    if (timer.handle === undefined) return;
    this.timers_.clearTimeout(timer.handle);
    timer.handle = undefined;
    timer.left = Math.max(0, timer.left - (this.timers_.now() - (timer.armedAt ?? 0)));
  }

  pause(): void {
    if (this.isPaused) return;
    this.ran = this.now();
    this.since = null;
    super.pause();
  }

  resume(): void {
    if (!this.isPaused) return;
    this.since = this.timers_.now();
    super.resume();
  }
}

/** Lets every promise chain that is ready to run, run. */
export function settle(): Promise<void> {
  const g = globalThis as unknown as { setImmediate?: (fn: () => void) => void; setTimeout: (fn: () => void, ms: number) => void };
  return new Promise((resolve) => {
    if (typeof g.setImmediate === "function") g.setImmediate(resolve);
    else g.setTimeout(resolve, 0);
  });
}

/** A clock a test moves by hand. Its timers fire in order as `advance` passes them. */
export class FakeClock extends BaseClock {
  private time = 0;

  now(): number {
    return this.time;
  }

  /** How many sleeps are waiting. */
  get pending(): number {
    return this.timers.size;
  }

  protected arm(): void {}
  protected disarm(): void {}

  /**
   * Moves real time on by `ms`, firing each timer as its moment comes and letting what it woke
   * run before the next. A paused clock stands still: its timers keep what they had left.
   */
  async advance(ms: number): Promise<void> {
    await settle();
    let left = ms;
    while (!this.isPaused) {
      let next: Timer | null = null;
      for (const t of this.timers) if (!next || t.left < next.left) next = t;
      if (!next || next.left > left) break;
      const step = next.left;
      left -= step;
      this.time += step;
      for (const t of this.timers) t.left -= step;
      this.fire(next);
      await settle();
    }
    if (!this.isPaused) {
      this.time += left;
      for (const t of this.timers) t.left -= left;
    }
    await settle();
  }

  /** Advances until `done()` holds, in steps; throws if it never does within `limitMs`. */
  async advanceUntil(done: () => boolean, limitMs = 600_000, stepMs = 50): Promise<void> {
    await settle();
    let spent = 0;
    while (!done()) {
      if (spent >= limitMs) throw new Error(`Still waiting after ${limitMs} ms of fake time`);
      await this.advance(stepMs);
      spent += stepMs;
    }
  }
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
export function createClocks(speed: number, timers?: Timers): RunClocks {
  return { pace: new RealClock(speed, timers), wall: new RealClock(1, timers), ticker: new RealClock(1, timers) };
}
