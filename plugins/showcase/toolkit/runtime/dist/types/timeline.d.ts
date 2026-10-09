/**
 * The film's timeline (PLAN §2.1 "Film contract"): in film mode the engine reports what it does,
 * as `film-events.ts` events and nothing else. Each event is stamped (`v, seq, doc, t, wall`)
 * and goes three ways: to the host through the bridge, as a `CustomEvent` on the window, and
 * into the log at `window.__showcaseFilmLog`. `html[data-showcase-film]` says the run's state.
 */
import { type FilmEvent, type FilmEventInput } from "./film-events.ts";
export interface Timeline {
    emit(event: FilmEventInput): FilmEvent;
    readonly events: readonly FilmEvent[];
}
export interface TimelineOptions {
    /** The next sequence number and this document's number. The state holds both. */
    stamp: () => {
        seq: number;
        doc: number;
    };
    /** The captured clocks. */
    t: () => number;
    wall: () => number;
    /** Where the event goes: the host. */
    send?: (event: FilmEvent) => void;
    window?: Window | null;
}
export declare function createTimeline(options: TimelineOptions): Timeline;
/** A timeline that keeps nothing: every run that isn't being filmed. */
export declare const NO_TIMELINE: Timeline;
