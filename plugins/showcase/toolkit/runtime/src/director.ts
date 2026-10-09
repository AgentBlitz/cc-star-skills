/**
 * The director (PLAN §2.1 "Director"): the tour's state machine and its runner, ported from
 * Compass with Present mode, the notes window and the server left out (D4). It knows nothing of
 * the DOM: everything it touches comes in as a dependency, so a test runs a whole tour on a
 * fake clock.
 *
 * ```
 * idle → starting → entering(i) → Watch: playing ⇄ paused      blocked: Retry · Skip · End
 *                              → Film:  armed → playing         … → ending → done
 * ```
 *
 * - Each beat runs two tracks, narration and actions, with `after` gates. A beat lasts the
 *   longest of its narration, its actions and its readiness, plus its dwell. An action marked
 *   `navigates` runs after both tracks, so no sentence is cut or repeated by the page load.
 * - **Next** finishes the current step at once (its writes still run, silently), then moves on.
 *   **Back** re-shows the previous step and writes nothing: the journal knows what was written.
 *   A **deep link** fast-forwards the writes of the steps it skips (C6).
 * - **Run state** is saved at every move, so a full page load resumes where it was, in the
 *   same document number sequence, without repeating writes or sentences.
 * - One flow runs at a time. A command that changes course aborts the flow and waits for it to
 *   settle before the next begins, so two never act on the screen together.
 */
import { Aborted, isAborted, type RunClocks, throwIfAborted, whenAborted } from "./clock.ts";
import { ActionError, type ActionPhase, type CameraFrame, type Executor, type InputMode, isCosmetic, type Journal } from "./executor.ts";
import type { FilmEventInput } from "./film-events.ts";
import { type AudioPort, type Cue, cuesMs, narrationFingerprint, narrationLines, schedule, speak, type VoiceManifest } from "./narration.ts";
import { NO_OVERLAY, type OverlayPort } from "./overlay-port.ts";
import type { Blocked, Command, EndReason, Mode, Snapshot, Status } from "./protocol.ts";
import { READY_TIMEOUT_MS } from "./ready.ts";
import type { Action, Beat, Ready, Step, Tour } from "./schema.ts";
import { journalKey, type Position, type RunState, STATE_VERSION, type StateStore } from "./state.ts";

export type { Blocked, Command, EndReason, Mode, Snapshot, Status } from "./protocol.ts";
import { NO_TIMELINE, type Timeline } from "./timeline.ts";

export const DEFAULT_DWELL_MS = 600;
/** Film mode: once the host rolls, a wait that isn't over in 15 s is an error, not a wait. */
export const FILM_WAIT_MS = 15_000;

export interface DirectorWaitOptions {
  signal?: AbortSignal;
  timeoutMs: number;
}

export interface DirectorDeps {
  tour: Tour;
  clocks: (speed: number) => RunClocks;
  executor: (env: { clocks: RunClocks; onPhase: (action: Action, phase: ActionPhase, input?: InputMode) => void; onCamera: (frame: CameraFrame) => void; onNote: (note: string) => void }) => Executor;
  /** Waits for a predicate on the wall clock (`ready.ts`, bound to the document). */
  waitFor: (ready: Ready, options: DirectorWaitOptions & { clock: RunClocks["wall"] }) => Promise<void>;
  /** Goes to a step's path; resolves once the URL is the step's. A full load never resolves: the next document resumes. */
  navigate: (path: string, signal?: AbortSignal) => Promise<void>;
  store: StateStore;
  /** The film's timeline, built on the run's stamp. */
  timeline?: (stamp: () => { seq: number; doc: number }) => Timeline;
  manifest?: VoiceManifest | null;
  audio?: AudioPort | null;
  overlay?: OverlayPort;
  publish?: (snapshot: Snapshot | null) => void;
  /** Wall-clock milliseconds (the captured `Date.now`). */
  now: () => number;
  viewport?: () => { w: number; h: number; dpr: number };
  /** Film: the page is ready to be filmed (fonts loaded, the screen painted and still). */
  filmReady?: (signal: AbortSignal) => Promise<void>;
  /** Film: resolves when the host calls `__showcaseGo()`. */
  waitGo?: () => Promise<void>;
  /** The next animation frame. Absent: at once (tests). */
  frame?: () => Promise<void>;
  runtimeVersion?: string;
  /** This document's number: the state's `doc` after a load. */
  doc?: number;
  newRunId?: () => string;
  /** Rehearse: called once a beat's tracks are done and its `ready` is met, before its dwell. The beat waits for it. */
  checkpoint?: (where: { stepIndex: number; beatIndex: number; step: Step; beat: Beat }) => Promise<void>;
}

type Phase = "start" | "prepare" | "enter" | "beat" | "ready" | "finish";

interface Run {
  state: RunState;
  journal: Set<string>;
  clocks: RunClocks;
  executor: Executor;
  timeline: Timeline;
  base: Status;
  phase: Phase;
  resumed: Set<() => void>;
  blocked: Blocked | null;
  caption: Snapshot["caption"];
  ended: Snapshot["ended"];
  notes: string[];
  /** Film: the beat open in the film, and whether a camera framing is open in it. */
  beatId: string | null;
  framing: boolean;
  /** The screen is the step's: it has been entered, and was ready. */
  again: Flow | null;
}

type Flow = (signal: AbortSignal) => Promise<void>;

const fresh = (): Position => ({ action: 0, sentence: 0, speaking: null, stage: "begin" });

export class Director {
  private readonly deps: DirectorDeps;
  private run: Run | null = null;
  private flow: AbortController | null = null;
  private settled: Promise<void> = Promise.resolve();

  constructor(deps: DirectorDeps) {
    this.deps = deps;
  }

  get tour(): Tour {
    return this.deps.tour;
  }

  /** What the host and the overlay show. */
  get snapshot(): Snapshot | null {
    const r = this.run;
    if (!r) return null;
    const s = r.state;
    const step = this.deps.tour.steps[s.stepIndex] ?? this.deps.tour.steps[0];
    const beat = step?.beats[s.beatIndex] ?? null;
    const holding = s.paused && (r.base === "playing" || r.base === "entering");
    return {
      runId: s.runId,
      tourId: s.tourId,
      mode: s.mode,
      status: holding ? "paused" : r.base,
      stepIndex: s.stepIndex,
      stepId: step?.id ?? "",
      stepCount: this.deps.tour.steps.length,
      beatIndex: s.beatIndex,
      beatId: beat?.id ?? null,
      beatCount: step?.beats.length ?? 0,
      speed: s.speed,
      paused: s.paused,
      rolling: s.rolling,
      doc: s.doc,
      blocked: r.blocked,
      caption: r.caption,
      ended: r.ended,
      journal: [...r.journal],
      at: { ...s.at },
      notes: [...r.notes],
      muted: this.deps.audio?.muted ?? false,
    };
  }

  /** The writes this run has made. */
  get journal(): readonly string[] {
    return this.run ? [...this.run.journal] : [];
  }

  /** The film's events so far, in this document. */
  get events(): readonly import("./film-events.ts").FilmEvent[] {
    return this.run?.timeline.events ?? [];
  }

  /** Resolves once the flow in hand has settled. For tests. */
  idle(): Promise<void> {
    return this.settled;
  }

  // ——— Starting and resuming ———

  /** Starts a run from the first step, or from the step named (a deep link: earlier writes are fast-forwarded). */
  start(options: { mode: Mode; speed?: number; from?: string }): void {
    if (this.run && this.run.base !== "done") return;
    const tour = this.deps.tour;
    const stepIndex = options.from ? Math.max(0, tour.steps.findIndex((s) => s.id === options.from)) : 0;
    const state: RunState = {
      v: STATE_VERSION,
      runId: this.deps.newRunId?.() ?? `${this.deps.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      tourId: tour.id,
      mode: options.mode,
      speed: options.speed ?? 1,
      stepIndex,
      beatIndex: 0,
      at: fresh(),
      entered: false,
      target: null,
      journal: [],
      seq: 0,
      doc: this.deps.doc ?? 1,
      rolling: false,
      filmBeats: 0,
      paused: false,
      pointer: null,
      startedAt: this.deps.now(),
    };
    this.run = this.newRun(state);
    this.launch(async (signal) => {
      const r = this.must();
      r.base = "starting";
      r.phase = "start";
      r.again = null;
      this.publish();
      if (stepIndex > 0) await this.prepare(signal, 0, stepIndex);
      await this.step(signal, stepIndex, 0);
    });
  }

  /** Picks a run up after a page load: the same step, beat and position, the journal intact. */
  resume(state: RunState): void {
    if (this.run && this.run.base !== "done") return;
    const tour = this.deps.tour;
    if (state.tourId !== tour.id) return;
    const s: RunState = { ...state, doc: this.deps.doc ?? state.doc + 1, at: { ...state.at } };
    s.stepIndex = Math.min(s.stepIndex, tour.steps.length - 1);
    this.run = this.newRun(s);
    if (s.paused) this.run.clocks.pace.pause();
    this.launch(async (signal) => {
      const r = this.must();
      r.base = "starting";
      r.phase = "start";
      this.publish();
      if (s.target !== null && s.stepIndex < s.target) {
        await this.prepareFrom(signal, s.target);
        return;
      }
      await this.step(signal, s.stepIndex, s.beatIndex, s.at, true);
    });
  }

  private newRun(state: RunState): Run {
    const clocks = this.deps.clocks(state.speed);
    const stamp = () => {
      const r = this.run;
      if (!r) return { seq: 0, doc: state.doc };
      r.state.seq += 1;
      return { seq: r.state.seq, doc: r.state.doc };
    };
    const run: Run = {
      state,
      journal: new Set(state.journal),
      clocks,
      executor: this.deps.executor({
        clocks,
        onPhase: (action, phase, input) => this.film({ type: "action", id: action.id, kind: action.kind, phase, ...(input ? { input } : {}) }),
        onCamera: (frame) => this.camera(frame),
        onNote: (note) => {
          this.run?.notes.push(note);
        },
      }),
      timeline: state.mode === "film" && this.deps.timeline ? this.deps.timeline(stamp) : NO_TIMELINE,
      base: "idle",
      phase: "start",
      resumed: new Set(),
      blocked: null,
      caption: null,
      ended: null,
      notes: [],
      beatId: null,
      framing: false,
      again: null,
    };
    return run;
  }

  // ——— Commands ———

  dispatch = (command: Command): void => {
    const r = this.run;
    if (!r) return;
    const over = r.base === "done" || r.base === "ending";
    switch (command.type) {
      case "pause":
        if (r.state.mode === "watch" && !over) this.pause();
        return;
      case "resume":
        if (r.state.mode === "watch" && !over) this.unpause();
        return;
      case "go":
        this.go?.();
        return;
      case "mute":
        this.deps.audio?.setMuted(command.muted ?? !this.deps.audio.muted);
        this.publish();
        return;
      case "end":
        if (!over) this.launch((s) => this.finish(s, "left"));
        return;
      default:
        break;
    }
    if (over || r.base === "starting") return;
    switch (command.type) {
      case "next":
        this.launch((s) => this.jump(s, r.state.stepIndex + 1));
        return;
      case "back":
        this.launch((s) => this.jump(s, Math.max(0, r.state.stepIndex - 1)));
        return;
      case "jump":
        if (command.stepIndex >= 0 && command.stepIndex < this.deps.tour.steps.length) this.launch((s) => this.jump(s, command.stepIndex));
        return;
      case "retry":
        if (r.base === "blocked") this.recover("retry");
        return;
      case "skip":
        if (r.base === "blocked") this.recover("skip");
        return;
    }
  };

  private go: (() => void) | null = null;

  // ——— Flows ———

  /** Aborts the flow in hand, waits for it to settle, then runs this one. */
  private launch(flow: Flow): void {
    this.flow?.abort();
    const mine = new AbortController();
    this.flow = mine;
    const before = this.settled;
    this.settled = (async () => {
      await before;
      if (mine.signal.aborted) return;
      this.deps.audio?.stop();
      try {
        await flow(mine.signal);
      } catch (e) {
        if (isAborted(e) || mine.signal.aborted) return;
        this.block(e);
      }
    })();
  }

  /** Enters a step (unless resuming inside one) and plays from there. */
  private async step(signal: AbortSignal, index: number, beat = 0, from?: Position, resumed = false): Promise<void> {
    const r = this.must();
    if (!from || !r.state.entered) await this.enter(signal, index, beat, from);
    if (r.state.mode === "film" && !r.state.rolling) await this.arm(signal);
    await this.play(signal, index, beat, from, resumed);
  }

  private async enter(signal: AbortSignal, index: number, beat: number, from?: Position): Promise<void> {
    const r = this.must();
    const step = this.stepAt(index);
    r.state.stepIndex = index;
    r.state.beatIndex = beat;
    r.state.at = from ? { ...from } : fresh();
    r.base = "entering";
    r.phase = "enter";
    r.blocked = null;
    r.caption = null;
    this.persist();
    this.publish();
    await this.arrive(signal, step);
  }

  /** Clears what the last step left, goes to the step's screen and waits for it. */
  private async arrive(signal: AbortSignal, step: Step): Promise<void> {
    const r = this.must();
    r.state.entered = false;
    this.persist();
    r.executor.clear();
    if (step.path) await this.deps.navigate(step.path, signal);
    throwIfAborted(signal);
    if (step.ready) await this.wait(step.ready, signal);
    r.state.entered = true;
    this.persist();
  }

  private wait(ready: Ready, signal: AbortSignal): Promise<void> {
    const r = this.must();
    return this.deps.waitFor(ready, { clock: r.clocks.wall, signal, timeoutMs: r.state.mode === "film" && r.state.rolling ? FILM_WAIT_MS : READY_TIMEOUT_MS });
  }

  /** Film: ready, and waiting for the host to roll. */
  private async arm(signal: AbortSignal): Promise<void> {
    const r = this.must();
    r.base = "armed";
    this.publish();
    await this.deps.filmReady?.(signal);
    throwIfAborted(signal);
    let rolling: Promise<void>;
    if (this.deps.waitGo) rolling = this.deps.waitGo();
    else {
      rolling = new Promise<void>((resolve) => {
        this.go = resolve;
      });
    }
    const tour = this.deps.tour;
    this.film({
      type: "film:armed",
      tour: tour.id,
      fingerprint: narrationFingerprint(narrationLines(tour)),
      manifestId: this.deps.manifest?.id ?? null,
      viewport: this.deps.viewport?.() ?? { w: 0, h: 0, dpr: 1 },
      runtime: this.deps.runtimeVersion ?? "0",
    });
    await Promise.race([rolling, whenAborted(signal)]);
    this.go = null;
    // The frame the go lands in, then the first that moves: the film starts there.
    await this.deps.frame?.();
    await this.deps.frame?.();
    throwIfAborted(signal);
    r.state.rolling = true;
    this.persist();
    this.film({ type: "film:start" });
  }

  /** Plays from a beat of a step to the tour's end. */
  private async play(signal: AbortSignal, index: number, beat: number, from?: Position, resumed = false): Promise<void> {
    const r = this.must();
    const tour = this.deps.tour;
    let resume = from;
    let first = resumed;
    for (let s = index; s < tour.steps.length; s++) {
      if (s !== index) await this.enter(signal, s, 0);
      const step = this.stepAt(s);
      for (let b = s === index ? beat : 0; b < step.beats.length; b++) {
        const bt = step.beats[b] as Beat;
        r.state.beatIndex = b;
        r.state.at = resume ? { ...resume } : fresh();
        r.base = "playing";
        r.phase = "beat";
        this.persist();
        this.publish();
        await this.unpaused(signal);
        await this.playBeat(signal, step, bt, first);
        resume = undefined;
        first = false;
      }
      r.state.beatIndex = step.beats.length;
    }
    await this.finish(signal, "finished");
  }

  private async playBeat(signal: AbortSignal, step: Step, beat: Beat, resumed: boolean): Promise<void> {
    const r = this.must();
    const { pace, wall } = r.clocks;
    const at = r.state.at;
    const began = wall.now();
    const actions = beat.actions ?? [];
    const nav = actions.length > 0 && actions[actions.length - 1]?.navigates ? actions.length - 1 : -1;
    const cues = schedule(beat, { tour: this.deps.tour.id, ...(this.deps.manifest !== undefined ? { manifest: this.deps.manifest } : {}) });
    const overlay = this.deps.overlay ?? NO_OVERLAY;
    // Only a run resumed past its navigating action dispatched it in the document before: a
    // resume that entered the step afresh (the step's own page load) still has it to do.
    const navDispatched = resumed && at.stage === "nav";

    if (at.stage === "begin") {
      if (beat.card) overlay.card({ title: beat.card.title, lines: beat.card.lines ?? [] });
      this.beatStart(step, beat);
      at.stage = "tracks";
      this.persist();
    } else {
      r.beatId = beat.id;
      if (beat.card) overlay.card({ title: beat.card.title, lines: beat.card.lines ?? [] });
    }
    // A sentence cut by a page load counts as spoken: it isn't repeated.
    if (at.speaking !== null) {
      this.film({ type: "sentence:end", beat: beat.id, index: at.speaking });
      at.sentence = at.speaking + 1;
      at.speaking = null;
      this.persist();
    }
    const firstSentence = at.sentence;

    if (at.stage === "tracks") {
      // The two tracks stop together: one that fails takes the other with it.
      const both = new AbortController();
      const stop = () => both.abort();
      signal.addEventListener("abort", stop, { once: true });
      const gates = new Map<string, { promise: Promise<void>; open: () => void }>();
      const gate = (id: string) => {
        let g = gates.get(id);
        if (!g) {
          let open = () => {};
          const promise = new Promise<void>((resolve) => {
            open = resolve;
          });
          g = { promise, open };
          gates.set(id, g);
        }
        return g;
      };
      for (const a of actions.slice(0, at.action)) gate(a.id).open();
      if (nav >= 0 && at.action > nav) gate((actions[nav] as Action).id).open();

      const narration = (async () => {
        for (const cue of cues.slice(at.sentence)) {
          await this.unpaused(both.signal);
          const next = cues[cue.index + 1];
          if (next && r.state.mode !== "film") this.deps.audio?.preload(next);
          await speak([cue], {
            clock: pace,
            signal: both.signal,
            audio: r.state.mode === "film" ? null : (this.deps.audio ?? null),
            gate: (id) => Promise.race([gate(id).promise, whenAborted(both.signal)]),
            onStart: (c) => this.sentenceStart(c),
            onEnd: (c) => this.sentenceEnd(c),
          });
          at.sentence = cue.index + 1;
          this.persist();
        }
      })();
      const upTo = nav >= 0 ? nav - 1 : actions.length - 1;
      const acting = this.act(both.signal, step, beat, at.action, false, (a) => gate(a.id).open(), upTo);
      try {
        const results = await Promise.allSettled([
          narration.catch((e) => {
            both.abort();
            throw e;
          }),
          acting.catch((e) => {
            both.abort();
            throw e;
          }),
        ]);
        throwIfAborted(signal);
        const failed = results.filter((x) => x.status === "rejected").map((x) => (x as PromiseRejectedResult).reason);
        const cause = failed.find((e) => !isAborted(e)) ?? failed[0];
        if (cause !== undefined) throw cause;
      } finally {
        signal.removeEventListener("abort", stop);
      }
      at.stage = nav >= 0 ? "nav" : "ready";
      at.action = nav >= 0 ? nav : actions.length;
      this.persist();
      // A beat that leaves the page is checked before it does: its still is of its own screen.
      if (nav >= 0) await this.checkpoint(signal, step, beat);
    }

    if (at.stage === "nav" && nav >= 0) {
      const action = actions[nav] as Action;
      at.action = nav;
      if (navDispatched) {
        // Dispatched in the document before the load: wait for what it was to do, don't do it again.
        const key = journalKey(step.id, beat.id, action.id);
        if (action.done && !r.journal.has(key)) await this.wait(action.done, signal);
        if (action.effect === "write") this.journalOf(r).add(key);
        this.film({ type: "action", id: action.id, kind: action.kind, phase: "done" });
      } else {
        this.persist();
        await this.act(signal, step, beat, nav, false, undefined, nav);
      }
      at.stage = "ready";
      at.action = actions.length;
      this.persist();
    }

    if (at.stage === "ready") {
      r.phase = "ready";
      if (beat.ready) await this.wait(beat.ready, signal);
      at.stage = "dwell";
      this.persist();
      if (nav < 0) await this.checkpoint(signal, step, beat);
    }
    const waitedMs = Math.max(0, wall.now() - began);
    await pace.sleep(beat.dwellMs ?? DEFAULT_DWELL_MS, signal);
    this.beatEnd(beat, cuesMs(cues.slice(firstSentence)), waitedMs);
    if (beat.card) overlay.card(null);
  }

  /**
   * A beat's actions, in order. What a write this run has already made needed before it (opening
   * the form, typing the reason) is left out, so re-showing a step opens nothing it won't finish.
   * Only the journal says so: a `done` that happens to hold before the write (an absence) doesn't.
   */
  private async act(signal: AbortSignal, step: Step, beat: Beat, from: number, instant: boolean, done: (action: Action) => void = () => {}, upTo?: number): Promise<void> {
    const r = this.must();
    const actions = beat.actions ?? [];
    const last = upTo ?? actions.length - 1;
    const journal = this.journalOf(r);
    const key = (a: Action) => journalKey(step.id, beat.id, a.id);
    let settledTo = -1;
    actions.forEach((a, i) => {
      if (a.effect === "write" && i >= from && journal.has(key(a))) settledTo = i;
    });
    for (let i = from; i <= last && i < actions.length; i++) {
      const action = actions[i] as Action;
      r.state.at.action = i;
      if (!instant) {
        await this.unpaused(signal);
        this.persist();
      }
      throwIfAborted(signal);
      const prepares = i < settledTo && (action.effect ?? "read") === "read" && !isCosmetic(action);
      if (!prepares) {
        await r.executor.runAction(action, {
          instant,
          signal,
          journal,
          key: key(action),
          ...(r.state.mode === "film" && r.state.rolling ? { maxWaitMs: FILM_WAIT_MS } : {}),
        });
      }
      done(action);
    }
    r.state.at.action = Math.min(last + 1, actions.length);
  }

  private journalOf(r: Run): Journal {
    return {
      has: (k) => r.journal.has(k),
      add: (k) => {
        if (r.journal.has(k)) return;
        r.journal.add(k);
        r.state.journal = [...r.journal];
        this.persist();
      },
    };
  }

  // ——— Next, Back, fast-forward ———

  /** Goes to a step. Forwards, the writes on the way are made at once; backwards, nothing is written. */
  private async jump(signal: AbortSignal, target: number): Promise<void> {
    const r = this.must();
    const last = this.deps.tour.steps.length - 1;
    if (target > r.state.stepIndex) {
      r.blocked = null;
      await this.finishStep(signal);
      if (target > last) {
        await this.finish(signal, "finished");
        return;
      }
      if (target > r.state.stepIndex + 1) await this.prepare(signal, r.state.stepIndex + 1, target);
    }
    await this.step(signal, Math.min(target, last));
  }

  /** What is left of the current step, at once: up to its last write still to make. */
  private async finishStep(signal: AbortSignal): Promise<void> {
    const r = this.must();
    const step = this.stepAt(r.state.stepIndex);
    if (!r.state.entered && this.owes(r, step, r.state.beatIndex, r.state.at.action)) {
      r.phase = "enter";
      await this.arrive(signal, step);
    }
    r.phase = "beat";
    await this.writes(signal, step, r.state.beatIndex, r.state.at.action);
    r.state.beatIndex = step.beats.length;
    r.state.at = fresh();
  }

  /** The writes of steps `from` to `to − 1`, silently. */
  private async prepare(signal: AbortSignal, from: number, to: number): Promise<void> {
    const r = this.must();
    r.base = "entering";
    r.phase = "prepare";
    r.state.target = to;
    r.caption = null;
    this.persist();
    this.publish();
    for (let s = from; s < to; s++) {
      const step = this.stepAt(s);
      if (!this.owes(r, step, 0, 0)) continue;
      r.state.stepIndex = s;
      r.state.beatIndex = 0;
      r.state.at = fresh();
      this.persist();
      await this.arrive(signal, step);
      await this.writes(signal, step, 0, 0);
    }
    r.state.target = null;
    this.persist();
  }

  /** A fast-forward a page load interrupted: picked up at the step it was on. */
  private async prepareFrom(signal: AbortSignal, target: number): Promise<void> {
    const r = this.must();
    const s = r.state.stepIndex;
    const step = this.stepAt(s);
    r.base = "entering";
    r.phase = "prepare";
    this.publish();
    if (!r.state.entered) await this.arrive(signal, step);
    await this.writes(signal, step, r.state.beatIndex, r.state.at.action);
    if (s + 1 < target) await this.prepare(signal, s + 1, target);
    r.state.target = null;
    this.persist();
    await this.step(signal, target);
  }

  /** Where the step's last write not yet in the journal is, from a position on; null for none. */
  private lastOwed(r: Run, step: Step, beat: number, action: number): { beat: number; action: number } | null {
    let last: { beat: number; action: number } | null = null;
    for (let b = beat; b < step.beats.length; b++) {
      const actions = step.beats[b]?.actions ?? [];
      for (let a = b === beat ? action : 0; a < actions.length; a++) {
        const x = actions[a] as Action;
        if (x.effect !== "write") continue;
        if (!r.journal.has(journalKey(step.id, (step.beats[b] as Beat).id, x.id))) last = { beat: b, action: a };
      }
    }
    return last;
  }

  private owes(r: Run, step: Step, beat: number, action: number): boolean {
    return this.lastOwed(r, step, beat, action) !== null;
  }

  /** Makes the step's remaining writes at once, with what they need before them. */
  private async writes(signal: AbortSignal, step: Step, beat: number, action: number): Promise<void> {
    const r = this.must();
    const last = this.lastOwed(r, step, beat, action);
    if (!last) return;
    for (let b = beat; b <= last.beat; b++) {
      const at = step.beats[b] as Beat;
      r.state.beatIndex = b;
      const from = b === beat ? action : 0;
      const upTo = b === last.beat ? last.action : (at.actions?.length ?? 0) - 1;
      this.persist();
      await this.act(signal, step, at, from, true, undefined, upTo);
      // A beat passed whole still waits for its state: the next beat's actions build on it.
      if (b < last.beat && at.ready) await this.wait(at.ready, signal);
    }
  }

  // ——— The end, pause, blocked ———

  private async finish(signal: AbortSignal, reason: EndReason): Promise<void> {
    const r = this.must();
    r.base = "ending";
    r.phase = "finish";
    r.blocked = null;
    r.caption = null;
    r.state.paused = false;
    r.clocks.pace.resume();
    this.publish();
    if (r.state.mode === "film" && r.state.rolling && reason !== "error") this.film({ type: "film:end" });
    r.executor.clear();
    this.deps.audio?.stop();
    (this.deps.overlay ?? NO_OVERLAY).caption(null);
    this.deps.store.clear();
    if (signal.aborted) return;
    r.base = "done";
    r.ended = { reason };
    this.publish();
  }

  private pause(): void {
    const r = this.must();
    if (r.state.paused) return;
    r.state.paused = true;
    r.clocks.pace.pause();
    this.deps.audio?.pause();
    this.persist();
    this.publish();
  }

  private unpause(): void {
    const r = this.must();
    if (!r.state.paused) return;
    r.state.paused = false;
    r.clocks.pace.resume();
    this.deps.audio?.resume();
    for (const wake of [...r.resumed]) wake();
    r.resumed.clear();
    this.persist();
    this.publish();
  }

  /** Holds a Watch tour while it is paused. */
  private unpaused(signal: AbortSignal): Promise<void> {
    const r = this.must();
    if (!r.state.paused) return Promise.resolve();
    this.publish();
    return new Promise<void>((resolve, reject) => {
      const wake = () => {
        signal.removeEventListener("abort", stop);
        resolve();
      };
      const stop = () => {
        r.resumed.delete(wake);
        reject(new Aborted());
      };
      if (signal.aborted) {
        reject(new Aborted());
        return;
      }
      r.resumed.add(wake);
      signal.addEventListener("abort", stop, { once: true });
    });
  }

  private block(e: unknown): void {
    const r = this.run;
    if (!r) return;
    const message = e instanceof Error ? e.message : String(e);
    const what: Blocked["what"] = e instanceof ActionError ? (e.anchor ? "anchor" : "error") : /Still waiting|Couldn't find/.test(message) ? "ready" : "error";
    const step = this.deps.tour.steps[r.state.stepIndex];
    const inBeat = r.phase === "beat" || r.phase === "prepare";
    const action = e instanceof ActionError ? (e.action.label ?? e.action.id) : inBeat ? (step?.beats[r.state.beatIndex]?.actions?.[r.state.at.action]?.label ?? null) : null;
    const anchor = e instanceof ActionError ? e.anchor : null;
    r.blocked = { what, message, action, anchor };
    r.base = "blocked";
    r.caption = null;
    if (r.state.mode === "film") {
      const beat = r.beatId ?? step?.beats[r.state.beatIndex]?.id;
      this.film({ type: "film:error", ...(beat ? { beat } : {}), message, ...(anchor ? { anchor } : {}) });
      r.beatId = null;
      r.base = "done";
      r.ended = { reason: "error" };
      this.deps.store.clear();
    }
    this.publish();
  }

  private recover(how: "retry" | "skip"): void {
    const r = this.must();
    const step = this.stepAt(r.state.stepIndex);
    const beat = step.beats[r.state.beatIndex];
    const at = { ...r.state.at };
    const skip = how === "skip";
    r.blocked = null;
    switch (r.phase) {
      case "start":
        this.launch((s) => this.step(s, r.state.stepIndex, r.state.beatIndex));
        return;
      case "prepare":
        this.launch(async (s) => {
          if (skip) {
            r.state.stepIndex += 1;
            r.state.beatIndex = 0;
            r.state.at = fresh();
            r.state.entered = false;
          }
          await this.prepareFrom(s, r.state.target ?? r.state.stepIndex);
        });
        return;
      case "enter":
        this.launch((s) => (skip ? this.step(s, r.state.stepIndex, r.state.beatIndex, fresh()) : this.step(s, r.state.stepIndex, r.state.beatIndex)));
        return;
      case "beat":
        this.launch((s) => this.step(s, r.state.stepIndex, r.state.beatIndex, { ...at, action: skip ? at.action + 1 : at.action }));
        return;
      case "ready":
        this.launch((s) => (skip ? this.after(s) : this.step(s, r.state.stepIndex, r.state.beatIndex, { ...at, stage: "ready", action: beat?.actions?.length ?? 0, sentence: beat?.narration?.length ?? 0 })));
        return;
      case "finish":
        this.launch((s) => this.finish(s, "left"));
        return;
    }
  }

  /** Skipping a beat's readiness: on to the next beat. */
  private async after(signal: AbortSignal): Promise<void> {
    const r = this.must();
    const step = this.stepAt(r.state.stepIndex);
    if (r.state.beatIndex + 1 < step.beats.length) await this.play(signal, r.state.stepIndex, r.state.beatIndex + 1, fresh());
    else if (r.state.stepIndex + 1 < this.deps.tour.steps.length) await this.step(signal, r.state.stepIndex + 1);
    else await this.finish(signal, "finished");
  }

  // ——— The film's events, captions, the state ———

  private film(event: FilmEventInput | Omit<Extract<FilmEventInput, { type: "action" }>, "beat">): void {
    const r = this.run;
    if (!r || r.state.mode !== "film") return;
    if (event.type === "action") {
      if (!r.beatId || !r.state.rolling) return;
      r.timeline.emit({ ...event, beat: r.beatId });
    } else r.timeline.emit(event as FilmEventInput);
    this.persist();
  }

  /** Rehearse: the beat's still and checks, before it dwells (or before it leaves the page). */
  private async checkpoint(signal: AbortSignal, step: Step, beat: Beat): Promise<void> {
    const r = this.must();
    if (!this.deps.checkpoint) return;
    await this.deps.checkpoint({ stepIndex: r.state.stepIndex, beatIndex: r.state.beatIndex, step, beat });
    throwIfAborted(signal);
  }

  private beatStart(step: Step, beat: Beat): void {
    const r = this.must();
    r.beatId = beat.id;
    this.film({
      type: "beat:start",
      beat: beat.id,
      index: r.state.filmBeats,
      step: step.id,
      kind: beat.card ? "card" : "screen",
      ...(beat.card?.title ?? step.title ? { title: beat.card?.title ?? (step.title as string) } : {}),
    });
  }

  private beatEnd(beat: Beat, narration: number, waitedMs: number): void {
    const r = this.must();
    this.camera(null);
    this.film({ type: "beat:end", beat: beat.id, index: r.state.filmBeats, narrationMs: narration, waitedMs });
    r.state.filmBeats += 1;
    r.beatId = null;
    this.persist();
  }

  /** Film: where the camera frames (recorded in v1, used from v1.1). Outside a filmed beat, nothing. */
  private camera(frame: CameraFrame | null): void {
    const r = this.run;
    if (!r || r.state.mode !== "film" || !r.state.rolling || !r.beatId) return;
    if (!frame || !frame.rect) {
      if (!r.framing) return;
      r.framing = false;
      r.timeline.emit({ type: "camera", beat: r.beatId, rect: null, scale: 1, easeMs: frame?.easeMs ?? 0 });
      return;
    }
    r.framing = true;
    r.timeline.emit({ type: "camera", beat: r.beatId, rect: frame.rect, scale: frame.scale, easeMs: frame.easeMs });
  }

  private sentenceStart(cue: Cue): void {
    const r = this.must();
    r.caption = { beat: cue.beat, index: cue.index, text: cue.text };
    r.state.at.speaking = cue.index;
    this.persist();
    (this.deps.overlay ?? NO_OVERLAY).caption(cue.text);
    this.film({ type: "sentence:start", beat: cue.beat, index: cue.index, text: cue.text, audio: cue.audio ? { hash: cue.audio.hash, durationMs: cue.audio.durationMs } : null });
    this.publish();
  }

  private sentenceEnd(cue: Cue): void {
    const r = this.run;
    if (!r) return;
    r.state.at.speaking = null;
    this.film({ type: "sentence:end", beat: cue.beat, index: cue.index });
    (this.deps.overlay ?? NO_OVERLAY).caption(null);
    if (r.caption?.beat === cue.beat && r.caption.index === cue.index) r.caption = null;
    this.persist();
    this.publish();
  }

  private stepAt(index: number): Step {
    const step = this.deps.tour.steps[index];
    if (!step) throw new Error(`no step ${index}`);
    return step;
  }

  private must(): Run {
    if (!this.run) throw new Error("No tour is running");
    return this.run;
  }

  private publish(): void {
    this.deps.publish?.(this.snapshot);
  }

  private persist(): void {
    const r = this.run;
    if (!r || r.base === "done" || r.base === "ending") return;
    const overlay = this.deps.overlay ?? NO_OVERLAY;
    r.state.pointer = overlay.pointer();
    r.state.journal = [...r.journal];
    this.deps.store.save({ ...r.state, at: { ...r.state.at } });
  }
}
