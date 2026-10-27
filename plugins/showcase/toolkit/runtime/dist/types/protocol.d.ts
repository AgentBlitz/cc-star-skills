/**
 * What the page and the host say to each other (PLAN §2.1, D16), as types only: the binding's
 * messages, the director's snapshot and commands, the voice manifest's shape. Free of DOM and
 * Node types, so the host and the CLI import it without either's globals.
 */
import type { FilmEvent } from "./film-events.ts";
import type { Anchor } from "./schema.ts";
import type { Position, RunState } from "./state.ts";
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
}
/** Bytes for an upload (`file`, the assets dir) or a voice clip (`voice`, the manifest's dir). */
 | {
    type: "asset";
    path: string;
    kind?: AssetKind;
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
}
/** Rehearse: a beat is done and ready; the host takes its still and checks it, then replies. */
 | {
    type: "checkpoint";
    checkpoint: Checkpoint;
}
/** Watch: the viewer asked to close (Esc, or the exit control, once the tour is over). */
 | {
    type: "exit";
};
export type AssetKind = "file" | "voice";
/** Where a rehearsal stops for its still: a beat, its actions done and its `ready` met. */
export interface Checkpoint {
    stepIndex: number;
    beatIndex: number;
    step: string;
    beat: string;
    /** The beat's sentences and card, for the spoken-number check. */
    narration: string[];
    card: {
        title: string;
        kicker?: string;
        lines: string[];
    } | null;
}
export interface AssetData {
    name: string;
    type: string;
    base64: string;
}
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
    /** Whether the voice is muted (Watch). */
    muted: boolean;
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
/** One synthesised sentence. A draft of Session 6's manifest: enough for lookup and timing. */
export interface VoiceClip {
    beat: string;
    text: string;
    hash: string;
    file: string;
    durationMs: number;
}
/** v2 (showcase 1.1) slices a take into the same clips, with more fields the runtime doesn't need. */
export interface VoiceManifest {
    v: 1 | 2;
    id: string;
    tour: string;
    clips: VoiceClip[];
}
/** One element of `inspect`'s outline (`inspect.ts`). */
export interface OutlineItem {
    role: string;
    name: string;
    /** Nesting depth among the outlined elements. */
    depth: number;
    visible: boolean;
    /** The frame's CSS selector, for an element in a same-origin frame. */
    frame: string | null;
    /** The suggested anchor, checked to resolve to this element; null when nothing unique was found. */
    anchor: Anchor | null;
    /** How the anchor was chosen. */
    by: "role" | "label" | "testId" | "text" | "css" | null;
    /** The level, for a heading. */
    level?: number;
}
export interface OutlineOptions {
    /** Include hidden elements (default: visible only). */
    hidden?: boolean;
    /** At most this many items (default 400). */
    limit?: number;
}
