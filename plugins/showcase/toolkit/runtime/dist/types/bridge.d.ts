/**
 * The host binding (PLAN §2.1, D16): `__showcaseHost(msg)` is what the host exposes with
 * `exposeBinding`, and the runtime's only way out. Through it go trusted input (the host's mouse
 * and keyboard), the run state, assets such as voice clips and upload fixtures, the film's
 * events and log lines. The host starts a film by calling `__showcaseGo()`.
 */
import type { FileData } from "./dom-events.ts";
import { type FilmEvent } from "./film-events.ts";
import type { AssetKind, Checkpoint, HostMessage, InputRequest } from "./protocol.ts";
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
    ready(info: {
        doc: number;
        resumed: boolean;
        url: string;
    }): void;
    snapshot(snapshot: unknown): void;
    checkpoint(checkpoint: Checkpoint): Promise<void>;
    exit(): void;
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
