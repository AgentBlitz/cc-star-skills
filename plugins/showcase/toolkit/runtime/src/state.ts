/**
 * Run state (PLAN §2.1 "Run state", D7): where the run is, which writes it has made, and the
 * film's sequence numbers. Injected, the host holds it, so it survives full page loads and
 * cross-origin hops; in-app it is a sessionStorage journal. Node-safe: the host imports it.
 */

export const STATE_VERSION = 1;
/** A state older than this is an abandoned run. */
export const STATE_MAX_AGE_MS = 2 * 60 * 60 * 1000;

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
  pointer: { x: number; y: number } | null;
  startedAt: number;
}

/** A write's key in the journal. */
export function journalKey(step: string, beat: string, action: string): string {
  return `${step}/${beat}/${action}`;
}

export function isRunState(x: unknown): x is RunState {
  if (typeof x !== "object" || x === null) return false;
  const s = x as Record<string, unknown>;
  return (
    s.v === STATE_VERSION &&
    typeof s.runId === "string" &&
    typeof s.tourId === "string" &&
    (s.mode === "watch" || s.mode === "film") &&
    typeof s.speed === "number" &&
    typeof s.stepIndex === "number" &&
    typeof s.beatIndex === "number" &&
    typeof s.at === "object" &&
    s.at !== null &&
    Array.isArray(s.journal) &&
    typeof s.seq === "number" &&
    typeof s.doc === "number"
  );
}

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

export const STORAGE_KEY = "showcase:run";

/** A store in memory, for tests and for the host. */
export function memoryStore(initial: RunState | null = null): StateStore & { current: RunState | null } {
  const store = {
    current: initial,
    load: async () => store.current,
    save(state: RunState) {
      store.current = state;
    },
    clear() {
      store.current = null;
    },
  };
  return store;
}

/** The in-app store: the tab's sessionStorage. A refused or full store leaves the run unsaved. */
export function storageStore(storage: StorageLike | null, now: () => number = Date.now, key = STORAGE_KEY): StateStore {
  return {
    async load() {
      if (!storage) return null;
      try {
        const raw = storage.getItem(key);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (!isRunState(parsed) || now() - parsed.startedAt > STATE_MAX_AGE_MS) {
          storage.removeItem(key);
          return null;
        }
        return parsed;
      } catch {
        return null;
      }
    },
    save(state) {
      try {
        storage?.setItem(key, JSON.stringify(state));
      } catch {
        // A full or refused store.
      }
    },
    clear() {
      try {
        storage?.removeItem(key);
      } catch {
        // As above.
      }
    },
  };
}

/** What the host-backed store talks to: the bridge's state messages. */
export interface StateTransport {
  load(): Promise<unknown>;
  save(state: RunState): void;
  clear(): void;
}

/** The injected store: the host holds the state. */
export function hostStore(transport: StateTransport): StateStore {
  return {
    async load() {
      try {
        const got = await transport.load();
        return isRunState(got) ? got : null;
      } catch {
        return null;
      }
    },
    save: (state) => transport.save(state),
    clear: () => transport.clear(),
  };
}
