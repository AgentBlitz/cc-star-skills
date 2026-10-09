/**
 * The host binding (PLAN §2.1, D16): `__showcaseHost(msg)` is what the host exposes with
 * `exposeBinding`, and the runtime's only way out. Through it go trusted input (the host's mouse
 * and keyboard), the run state, assets such as voice clips and upload fixtures, the film's
 * events and log lines. The host starts a film by calling `__showcaseGo()`.
 */
import type { FileData } from "./dom-events.ts";
import { type FilmEvent } from "./film-events.ts";
import type { RunState } from "./state.ts";
export type MouseButton = "left" | "right" | "middle";
/** What the runtime asks the host's input devices for. Coordinates are top-viewport CSS pixels. */
export type InputRequest = {
    kind: "move";
    x: number;
    y: number;
    steps?: number;
} | {
    kind: "click";
    x: number;
    y: number;
    button?: MouseButton;
    count?: number;
} | {
    kind: "down";
    x: number;
    y: number;
    button?: MouseButton;
} | {
    kind: "up";
    x: number;
    y: number;
    button?: MouseButton;
} | {
    kind: "wheel";
    x: number;
    y: number;
    dx: number;
    dy: number;
}
/** A key press in Playwright's spelling: `Enter`, `Control+K`, `a`. */
 | {
    kind: "key";
    key: string;
}
/** Characters typed one by one, at the host's end. */
 | {
    kind: "type";
    text: string;
    delayMs?: number;
}
/** A trusted click on a file input, with the host answering the chooser from `files`. */
 | {
    kind: "upload";
    x: number;
    y: number;
    files: string[];
};
export type HostMessage = {
    type: "input";
    input: InputRequest;
} | {
    type: "state";
    op: "load";
} | {
    type: "state";
    op: "save";
    state: RunState;
} | {
    type: "state";
    op: "clear";
} | {
    type: "asset";
    path: string;
} | {
    type: "event";
    event: FilmEvent;
} | {
    type: "log";
    level: "info" | "warn";
    message: string;
}
/** The runtime has booted in this document (and whether it found a run to resume). */
 | {
    type: "ready";
    doc: number;
    resumed: boolean;
    url: string;
}
/** The director's state changed: what the host's progress and tests read. */
 | {
    type: "snapshot";
    snapshot: unknown;
};
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
    ready(info: {
        doc: number;
        resumed: boolean;
        url: string;
    }): void;
    snapshot(snapshot: unknown): void;
}
export declare function createBridge(win?: Window): Bridge;
/** Registers `__showcaseGo()`: resolves the film's start when the host calls it. */
export declare function waitForGo(win?: Window): {
    armed: Promise<void>;
    disarm: () => void;
};
/** The acting window (PLAN §2.1): the tour's own input, told from the viewer's by place and time. */
export interface Acting {
    kind: InputRequest["kind"];
    point: {
        x: number;
        y: number;
    } | null;
    /** `performance.now()` (captured) after which the window is closed. */
    deadline: number;
}
