/**
 * The host binding (PLAN §2.1, D16): `__showcaseHost(msg)` is what the host exposes with
 * `exposeBinding`, and the runtime's only way out. Through it go trusted input (the host's mouse
 * and keyboard), the run state, assets such as voice clips and upload fixtures, the film's
 * events and log lines. The host starts a film by calling `__showcaseGo()`.
 */
import type { FileData } from "./dom-events.ts";
import { GO_KEY, HOST_BINDING, type FilmEvent } from "./film-events.ts";
import type { RunState } from "./state.ts";

export type MouseButton = "left" | "right" | "middle";

/** What the runtime asks the host's input devices for. Coordinates are top-viewport CSS pixels. */
export type InputRequest =
  | { kind: "move"; x: number; y: number; steps?: number }
  | { kind: "click"; x: number; y: number; button?: MouseButton; count?: number }
  | { kind: "down"; x: number; y: number; button?: MouseButton }
  | { kind: "up"; x: number; y: number; button?: MouseButton }
  | { kind: "wheel"; x: number; y: number; dx: number; dy: number }
  /** A key press in Playwright's spelling: `Enter`, `Control+K`, `a`. */
  | { kind: "key"; key: string }
  /** Characters typed one by one, at the host's end. */
  | { kind: "type"; text: string; delayMs?: number }
  /** A trusted click on a file input, with the host answering the chooser from `files`. */
  | { kind: "upload"; x: number; y: number; files: string[] };

export type HostMessage =
  | { type: "input"; input: InputRequest }
  | { type: "state"; op: "load" }
  | { type: "state"; op: "save"; state: RunState }
  | { type: "state"; op: "clear" }
  | { type: "asset"; path: string }
  | { type: "event"; event: FilmEvent }
  | { type: "log"; level: "info" | "warn"; message: string }
  /** The runtime has booted in this document (and whether it found a run to resume). */
  | { type: "ready"; doc: number; resumed: boolean; url: string }
  /** The director's state changed: what the host's progress and tests read. */
  | { type: "snapshot"; snapshot: unknown };

export type HostFn = (msg: HostMessage) => Promise<unknown>;

export interface AssetData {
  name: string;
  type: string;
  base64: string;
}

export interface Bridge {
  /** Whether a host is bound. Without one, input is synthetic and state lives in sessionStorage. */
  readonly present: boolean;
  input(req: InputRequest): Promise<void>;
  loadState(): Promise<unknown>;
  saveState(state: RunState): void;
  clearState(): void;
  asset(path: string): Promise<FileData>;
  event(event: FilmEvent): void;
  log(level: "info" | "warn", message: string): void;
  ready(info: { doc: number; resumed: boolean; url: string }): void;
  snapshot(snapshot: unknown): void;
}

function decode(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function createBridge(win: Window = window): Bridge {
  const host = (win as unknown as Record<string, unknown>)[HOST_BINDING];
  const fn: HostFn | null = typeof host === "function" ? (host as HostFn) : null;
  const send = (msg: HostMessage): Promise<unknown> => {
    if (!fn) return Promise.reject(new Error("no host is bound"));
    return fn(msg);
  };
  const fire = (msg: HostMessage) => {
    if (!fn) return;
    try {
      void fn(msg).catch(() => {});
    } catch {
      // The context may be going away.
    }
  };
  return {
    present: fn !== null,
    async input(input) {
      await send({ type: "input", input });
    },
    loadState: () => send({ type: "state", op: "load" }),
    saveState: (state) => fire({ type: "state", op: "save", state }),
    clearState: () => fire({ type: "state", op: "clear" }),
    async asset(path) {
      const a = (await send({ type: "asset", path })) as AssetData;
      return { name: a.name, type: a.type, bytes: decode(a.base64) };
    },
    event: (event) => fire({ type: "event", event }),
    log: (level, message) => fire({ type: "log", level, message }),
    ready: (info) => fire({ type: "ready", ...info }),
    snapshot: (snapshot) => fire({ type: "snapshot", snapshot }),
  };
}

/** Registers `__showcaseGo()`: resolves the film's start when the host calls it. */
export function waitForGo(win: Window = window): { armed: Promise<void>; disarm: () => void } {
  let go = () => {};
  const armed = new Promise<void>((resolve) => {
    go = resolve;
  });
  const w = win as unknown as Record<string, unknown>;
  w[GO_KEY] = () => {
    go();
    return true;
  };
  return {
    armed,
    disarm: () => {
      if (w[GO_KEY]) w[GO_KEY] = () => false;
    },
  };
}

/** The acting window (PLAN §2.1): the tour's own input, told from the viewer's by place and time. */
export interface Acting {
  kind: InputRequest["kind"];
  point: { x: number; y: number } | null;
  /** `performance.now()` (captured) after which the window is closed. */
  deadline: number;
}
