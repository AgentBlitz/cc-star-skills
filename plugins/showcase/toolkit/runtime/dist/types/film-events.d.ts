/**
 * The film contract (PLAN §2.1 "Film contract"): what the page tells the host while a tour plays
 * in film mode. Every event carries `v: 1, seq, doc, t, wall`: `seq` only ever goes up, `doc`
 * goes up by one on each page load, `t` and `wall` come from the captured real clocks. No
 * caption event: the SRT's cues are the sentences, split in post. Pure and Node-safe: the host
 * and the film tools import it too.
 */
export declare const FILM_VERSION = 1;
export interface Stamp {
    v: 1;
    seq: number;
    doc: number;
    /** `performance.timeOrigin + performance.now()`, captured. */
    t: number;
    /** `Date.now()`, captured: what the recorder lines up with its frame times. */
    wall: number;
}
export interface FilmRect {
    x: number;
    y: number;
    w: number;
    h: number;
}
export type FilmEventInput = {
    type: "film:armed";
    tour: string;
    fingerprint: string;
    manifestId: string | null;
    viewport: {
        w: number;
        h: number;
        dpr: number;
    };
    runtime: string;
} | {
    type: "film:start";
} | {
    type: "beat:start";
    beat: string;
    index: number;
    step: string;
    kind: "screen" | "card";
    title?: string;
} | {
    type: "sentence:start";
    beat: string;
    index: number;
    text: string;
    audio: {
        hash: string;
        durationMs: number;
    } | null;
} | {
    type: "sentence:end";
    beat: string;
    index: number;
} | {
    type: "action";
    beat: string;
    id: string;
    kind: string;
    phase: "start" | "done" | "skipped" | "timeout";
    input?: "trusted" | "synthetic";
} | {
    type: "camera";
    beat: string;
    rect: FilmRect | null;
    scale: number;
    easeMs: number;
} | {
    type: "beat:end";
    beat: string;
    index: number;
    narrationMs: number;
    waitedMs: number;
} | {
    type: "nav";
    url: string;
    kind: "load" | "spa";
} | {
    type: "film:end";
} | {
    type: "film:error";
    beat?: string;
    message: string;
    anchor?: string;
};
export type FilmEvent = FilmEventInput & Stamp;
export type FilmEventType = FilmEvent["type"];
/** The page-side names the host binds to (`bridge.ts`). */
export declare const HOST_BINDING = "__showcaseHost";
export declare const GO_KEY = "__showcaseGo";
export declare const API_KEY = "__showcase";
export declare const FILM_EVENT_NAME = "showcase:film";
export declare const FILM_LOG_KEY = "__showcaseFilmLog";
/**
 * The events the host stamps itself: `nav`, from Chrome's navigation messages. The host stamps
 * one with its own `Date.now()` when the message reaches it, and the page's events arrive by
 * another channel, so a page event made a moment before the host heard of the navigation can be
 * listed after it. The two clocks agree (the page's `t` and `Date.now()` are within 1 ms); the
 * host's stamp is late by the message's delivery, a few ms.
 */
export declare const HOST_EVENTS: ReadonlySet<FilmEventType>;
/** How far a host stamp and a page stamp may disagree (ms): under a frame at 60 fps. */
export declare const HOST_SKEW_MS = 15;
/**
 * Whether a run's events are in a valid order: armed once, started once, beats in index order
 * with their sentences inside them and never overlapping, `seq` strictly increasing, `t` never
 * going back within a document, one ending. Returns the problems found; none means valid.
 *
 * `t` is checked with no slack between two page stamps, or between two host stamps. Between a
 * host stamp and a page stamp (`HOST_EVENTS`), either may lead by up to `HOST_SKEW_MS`.
 */
export declare function filmOrderProblems(events: readonly FilmEvent[]): string[];
