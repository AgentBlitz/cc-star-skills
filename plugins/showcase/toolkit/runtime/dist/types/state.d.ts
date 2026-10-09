/**
 * Run state (PLAN §2.1 "Run state", D7): where the run is, which writes it has made, and the
 * film's sequence numbers. Injected, the host holds it, so it survives full page loads and
 * cross-origin hops; in-app it is a sessionStorage journal. Node-safe: the host imports it.
 */
export declare const STATE_VERSION = 1;
/** A state older than this is an abandoned run. */
export declare const STATE_MAX_AGE_MS: number;
/**
 * Where a beat is: not yet started, playing its two tracks, past its navigating action (the
 * page may be loading), waiting for its `ready`, or dwelling.
 */
export type Stage = "begin" | "tracks" | "nav" | "ready" | "dwell";
export interface Position {
    /** The action in hand, and the sentence next to be spoken, in the beat in hand. */
    action: number;
    sentence: number;
    /** The sentence being spoken when the state was saved, so a load mid-sentence ends it. */
    speaking: number | null;
    stage: Stage;
}
export interface RunState {
    v: 1;
    runId: string;
    tourId: string;
    mode: "watch" | "film";
    speed: number;
    stepIndex: number;
    beatIndex: number;
    at: Position;
    /** The step's screen has been entered and was ready. */
    entered: boolean;
    /** The step a fast-forward is preparing, while it does. */
    target: number | null;
    /** The writes made, by `journalKey`. */
    journal: string[];
    /** The film's last sequence number, and this document's number. */
    seq: number;
    doc: number;
    /** Film: the host has rolled; beats counted across the tour. */
    rolling: boolean;
    filmBeats: number;
    paused: boolean;
    /** The pointer's last position, so the overlay re-arms where it was after a load. */
    pointer: {
        x: number;
        y: number;
    } | null;
    startedAt: number;
}
/** A write's key in the journal. */
export declare function journalKey(step: string, beat: string, action: string): string;
export declare function isRunState(x: unknown): x is RunState;
export interface StateStore {
    load(): Promise<RunState | null>;
    save(state: RunState): void;
    clear(): void;
}
/** The part of `Storage` the tour uses. */
export interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}
export declare const STORAGE_KEY = "showcase:run";
/** A store in memory, for tests and for the host. */
export declare function memoryStore(initial?: RunState | null): StateStore & {
    current: RunState | null;
};
/** The in-app store: the tab's sessionStorage. A refused or full store leaves the run unsaved. */
export declare function storageStore(storage: StorageLike | null, now?: () => number, key?: string): StateStore;
/** What the host-backed store talks to: the bridge's state messages. */
export interface StateTransport {
    load(): Promise<unknown>;
    save(state: RunState): void;
    clear(): void;
}
/** The injected store: the host holds the state. */
export declare function hostStore(transport: StateTransport): StateStore;
