/**
 * The host binding (PLAN §2.1, D16): `__showcaseHost(msg)` is what the host exposes with
 * `exposeBinding`, and the runtime's only way out. Through it go trusted input (the host's mouse
 * and keyboard), the run state, assets such as voice clips and upload fixtures, the film's
 * events and log lines. The host starts a film by calling `__showcaseGo()`.
 */
import type { FileData } from "./dom-events.ts";
import { GO_KEY, HOST_BINDING, type FilmEvent } from "./film-events.ts";
import type { AssetData, AssetKind, Checkpoint, HostMessage, InputRequest } from "./protocol.ts";
import type { RunState } from "./state.ts";

export type { AssetData, AssetKind, Checkpoint, HostMessage, InputRequest, MouseButton } from "./protocol.ts";

export type HostFn = (msg: HostMessage) => Promise<unknown>;


export interface Bridge {
  /** Whether a host is bound. Without one, input is synthetic and state lives in sessionStorage. */
  readonly present: boolean;
  input(req: InputRequest): Promise<void>;
  loadState(): Promise<unknown>;
  saveState(state: RunState): void;
  clearState(): void;
  asset(path: string, kind?: AssetKind): Promise<FileData>;
  event(event: FilmEvent): void;
  log(level: "info" | "warn", message: string): void;
  ready(info: { doc: number; resumed: boolean; url: string }): void;
  snapshot(snapshot: unknown): void;
  checkpoint(checkpoint: Checkpoint): Promise<void>;
  exit(): void;
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
    async asset(path, kind) {
      const a = (await send({ type: "asset", path, ...(kind ? { kind } : {}) })) as AssetData;
      return { name: a.name, type: a.type, bytes: decode(a.base64) };
    },
    event: (event) => fire({ type: "event", event }),
    log: (level, message) => fire({ type: "log", level, message }),
    ready: (info) => fire({ type: "ready", ...info }),
    snapshot: (snapshot) => fire({ type: "snapshot", snapshot }),
    async checkpoint(checkpoint) {
      await send({ type: "checkpoint", checkpoint });
    },
    exit: () => fire({ type: "exit" }),
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
