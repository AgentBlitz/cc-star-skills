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
import { type RunClocks } from "./clock.ts";
import { type ActionPhase, type CameraFrame, type Executor, type InputMode } from "./executor.ts";
import { type AudioPort, type VoiceManifest } from "./narration.ts";
import { type OverlayPort } from "./overlay-port.ts";
import type { Action, Ready, Tour } from "./schema.ts";
import { type Position, type RunState, type StateStore } from "./state.ts";
import { type Timeline } from "./timeline.ts";
export declare const DEFAULT_DWELL_MS = 600;
/** Film mode: once the host rolls, a wait that isn't over in 15 s is an error, not a wait. */
export declare const FILM_WAIT_MS = 15000;
export type Mode = "watch" | "film";
export type Status = "idle" | "starting" | "entering" | "armed" | "playing" | "paused" | "blocked" | "ending" | "done";
export type EndReason = "finished" | "left" | "error";
export interface Blocked {
    what: "anchor" | "ready" | "error";
    message: string;
    action: string | null;
    anchor: string | null;
}
export interface Snapshot {
    runId: string;
    tourId: string;
    mode: Mode;
    status: Status;
    stepIndex: number;
    stepId: string;
    stepCount: number;
    beatIndex: number;
    beatId: string | null;
    beatCount: number;
    speed: number;
    paused: boolean;
    rolling: boolean;
    doc: number;
    blocked: Blocked | null;
    caption: {
        beat: string;
        index: number;
        text: string;
    } | null;
    ended: {
        reason: EndReason;
    } | null;
    journal: string[];
    at: Position;
    /** The report's notes so far (synthetic fallbacks). */
    notes: string[];
}
export type Command = {
    type: "pause";
} | {
    type: "resume";
} | {
    type: "next";
} | {
    type: "back";
} | {
    type: "jump";
    stepIndex: number;
} | {
    type: "retry";
} | {
    type: "skip";
} | {
    type: "end";
} | {
    type: "go";
} | {
    type: "mute";
    muted?: boolean;
};
export interface DirectorWaitOptions {
    signal?: AbortSignal;
    timeoutMs: number;
}
export interface DirectorDeps {
    tour: Tour;
    clocks: (speed: number) => RunClocks;
    executor: (env: {
        clocks: RunClocks;
        onPhase: (action: Action, phase: ActionPhase, input?: InputMode) => void;
        onCamera: (frame: CameraFrame) => void;
        onNote: (note: string) => void;
    }) => Executor;
    /** Waits for a predicate on the wall clock (`ready.ts`, bound to the document). */
    waitFor: (ready: Ready, options: DirectorWaitOptions & {
        clock: RunClocks["wall"];
    }) => Promise<void>;
    /** Goes to a step's path; resolves once the URL is the step's. A full load never resolves: the next document resumes. */
    navigate: (path: string, signal?: AbortSignal) => Promise<void>;
    store: StateStore;
    /** The film's timeline, built on the run's stamp. */
    timeline?: (stamp: () => {
        seq: number;
        doc: number;
    }) => Timeline;
    manifest?: VoiceManifest | null;
    audio?: AudioPort | null;
    overlay?: OverlayPort;
    publish?: (snapshot: Snapshot | null) => void;
    /** Wall-clock milliseconds (the captured `Date.now`). */
    now: () => number;
    viewport?: () => {
        w: number;
        h: number;
        dpr: number;
    };
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
}
export declare class Director {
    private readonly deps;
    private run;
    private flow;
    private settled;
    constructor(deps: DirectorDeps);
    get tour(): Tour;
    /** What the host and the overlay show. */
    get snapshot(): Snapshot | null;
    /** The writes this run has made. */
    get journal(): readonly string[];
    /** The film's events so far, in this document. */
    get events(): readonly import("./film-events.ts").FilmEvent[];
    /** Resolves once the flow in hand has settled. For tests. */
    idle(): Promise<void>;
    /** Starts a run from the first step, or from the step named (a deep link: earlier writes are fast-forwarded). */
    start(options: {
        mode: Mode;
        speed?: number;
        from?: string;
    }): void;
    /** Picks a run up after a page load: the same step, beat and position, the journal intact. */
    resume(state: RunState): void;
    private newRun;
    dispatch: (command: Command) => void;
    private go;
    /** Aborts the flow in hand, waits for it to settle, then runs this one. */
    private launch;
    /** Enters a step (unless resuming inside one) and plays from there. */
    private step;
    private enter;
    /** Clears what the last step left, goes to the step's screen and waits for it. */
    private arrive;
    private wait;
    /** Film: ready, and waiting for the host to roll. */
    private arm;
    /** Plays from a beat of a step to the tour's end. */
    private play;
    private playBeat;
    /**
     * A beat's actions, in order. What a write this run has already made needed before it (opening
     * the form, typing the reason) is left out, so re-showing a step opens nothing it won't finish.
     * Only the journal says so: a `done` that happens to hold before the write (an absence) doesn't.
     */
    private act;
    private journalOf;
    /** Goes to a step. Forwards, the writes on the way are made at once; backwards, nothing is written. */
    private jump;
    /** What is left of the current step, at once: up to its last write still to make. */
    private finishStep;
    /** The writes of steps `from` to `to − 1`, silently. */
    private prepare;
    /** A fast-forward a page load interrupted: picked up at the step it was on. */
    private prepareFrom;
    /** Where the step's last write not yet in the journal is, from a position on; null for none. */
    private lastOwed;
    private owes;
    /** Makes the step's remaining writes at once, with what they need before them. */
    private writes;
    private finish;
    private pause;
    private unpause;
    /** Holds a Watch tour while it is paused. */
    private unpaused;
    private block;
    private recover;
    /** Skipping a beat's readiness: on to the next beat. */
    private after;
    private film;
    private beatStart;
    private beatEnd;
    /** Film: where the camera frames (recorded in v1, used from v1.1). Outside a filmed beat, nothing. */
    private camera;
    private sentenceStart;
    private sentenceEnd;
    private stepAt;
    private must;
    private publish;
    private persist;
}
