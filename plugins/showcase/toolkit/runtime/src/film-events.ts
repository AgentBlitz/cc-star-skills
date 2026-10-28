/**
 * The film contract (PLAN §2.1 "Film contract"): what the page tells the host while a tour plays
 * in film mode. Every event carries `v: 1, seq, doc, t, wall`: `seq` only ever goes up, `doc`
 * goes up by one on each page load, `t` and `wall` come from the captured real clocks. No
 * caption event: the SRT's cues are the sentences, split in post. Pure and Node-safe: the host
 * and the film tools import it too.
 */

export const FILM_VERSION = 1;

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

export type FilmEventInput =
  | { type: "film:armed"; tour: string; fingerprint: string; manifestId: string | null; viewport: { w: number; h: number; dpr: number }; runtime: string }
  | { type: "film:start" }
  | { type: "beat:start"; beat: string; index: number; step: string; kind: "screen" | "card"; title?: string }
  | { type: "sentence:start"; beat: string; index: number; text: string; audio: { hash: string; durationMs: number } | null }
  | { type: "sentence:end"; beat: string; index: number }
  | { type: "action"; beat: string; id: string; kind: string; phase: "start" | "done" | "skipped" | "timeout"; input?: "trusted" | "synthetic" }
  | { type: "camera"; beat: string; rect: FilmRect | null; scale: number; easeMs: number }
  | { type: "beat:end"; beat: string; index: number; narrationMs: number; waitedMs: number }
  | { type: "nav"; url: string; kind: "load" | "spa" }
  | { type: "film:end" }
  | { type: "film:error"; beat?: string; message: string; anchor?: string };

export type FilmEvent = FilmEventInput & Stamp;
export type FilmEventType = FilmEvent["type"];

/** The page-side names the host binds to (`bridge.ts`). */
export const HOST_BINDING = "__showcaseHost";
export const GO_KEY = "__showcaseGo";
export const API_KEY = "__showcase";
export const FILM_EVENT_NAME = "showcase:film";
export const FILM_LOG_KEY = "__showcaseFilmLog";

/**
 * The events the host stamps itself: `nav`, from Chrome's navigation messages. The host stamps
 * one with its own `Date.now()` when the message reaches it, and the page's events arrive by
 * another channel, so a page event made a moment before the host heard of the navigation can be
 * listed after it. The two clocks agree (the page's `t` and `Date.now()` are within 1 ms); the
 * host's stamp is late by the message's delivery, a few ms.
 */
export const HOST_EVENTS: ReadonlySet<FilmEventType> = new Set(["nav"]);

/** How far a host stamp and a page stamp may disagree (ms): under a frame at 60 fps. */
export const HOST_SKEW_MS = 15;

/**
 * Whether a run's events are in a valid order: armed once, started once, beats in index order
 * with their sentences inside them and never overlapping, `seq` strictly increasing, `t` never
 * going back within a document, one ending. Returns the problems found; none means valid.
 *
 * `t` is checked with no slack between two page stamps, or between two host stamps. Between a
 * host stamp and a page stamp (`HOST_EVENTS`), either may lead by up to `HOST_SKEW_MS`.
 */
export function filmOrderProblems(events: readonly FilmEvent[]): string[] {
  const problems: string[] = [];
  let armed = false;
  let started = false;
  let ended = false;
  let open: { beat: string; index: number } | null = null;
  let lastBeat = -1;
  let speaking: number | null = null;
  let seq = Number.NEGATIVE_INFINITY;
  let doc = Number.NEGATIVE_INFINITY;
  // The latest page stamp and the latest host stamp in this document.
  let pageT = Number.NEGATIVE_INFINITY;
  let hostT = Number.NEGATIVE_INFINITY;

  for (const [i, e] of events.entries()) {
    const at = `#${i} ${e.type}`;
    if (e.v !== FILM_VERSION) problems.push(`${at}: version ${String(e.v)}`);
    if (!(e.seq > seq)) problems.push(`${at}: seq ${e.seq} after ${seq}`);
    seq = e.seq;
    if (e.doc < doc) problems.push(`${at}: doc ${e.doc} after ${doc}`);
    if (e.doc !== doc) {
      pageT = Number.NEGATIVE_INFINITY;
      hostT = Number.NEGATIVE_INFINITY;
    }
    doc = e.doc;
    const host = HOST_EVENTS.has(e.type);
    const same = (host ? hostT : pageT) - e.t;
    const other = (host ? pageT : hostT) - e.t;
    const ms = (n: number) => Math.round(n * 10) / 10;
    if (same > 0) problems.push(`${at}: time went back ${ms(same)} ms`);
    else if (other > HOST_SKEW_MS) problems.push(`${at}: time went back ${ms(other)} ms across host and page stamps (at most ${HOST_SKEW_MS})`);
    if (host) hostT = Math.max(hostT, e.t);
    else pageT = Math.max(pageT, e.t);
    if (ended) problems.push(`${at}: after the film ended`);
    switch (e.type) {
      case "film:armed":
        if (armed) problems.push(`${at}: armed twice`);
        armed = true;
        break;
      case "film:start":
        if (!armed) problems.push(`${at}: started before it was armed`);
        if (started) problems.push(`${at}: started twice`);
        started = true;
        break;
      case "beat:start":
        if (!started) problems.push(`${at}: a beat before film:start`);
        if (open) problems.push(`${at}: beat ${open.beat} is still open`);
        if (e.index <= lastBeat) problems.push(`${at}: beat index ${e.index} out of order`);
        open = { beat: e.beat, index: e.index };
        lastBeat = e.index;
        break;
      case "beat:end":
        if (open?.beat !== e.beat) problems.push(`${at}: beat ${e.beat} was not open`);
        if (speaking !== null) problems.push(`${at}: a sentence is still being spoken`);
        open = null;
        break;
      case "sentence:start":
        if (open?.beat !== e.beat) problems.push(`${at}: outside its beat`);
        if (speaking !== null) problems.push(`${at}: sentences overlap`);
        speaking = e.index;
        break;
      case "sentence:end":
        if (speaking !== e.index) problems.push(`${at}: sentence ${e.index} was not started`);
        speaking = null;
        break;
      case "action":
      case "camera":
        if (open?.beat !== e.beat) problems.push(`${at}: outside its beat`);
        break;
      case "nav":
        break;
      case "film:end":
        if (open) problems.push(`${at}: beat ${open.beat} is still open`);
        if (!started) problems.push(`${at}: ended before it started`);
        ended = true;
        break;
      case "film:error":
        ended = true;
        break;
    }
  }
  return problems;
}
