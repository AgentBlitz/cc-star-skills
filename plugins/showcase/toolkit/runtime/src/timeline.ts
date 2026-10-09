/**
 * The film's timeline (PLAN §2.1 "Film contract"): in film mode the engine reports what it does,
 * as `film-events.ts` events and nothing else. Each event is stamped (`v, seq, doc, t, wall`)
 * and goes three ways: to the host through the bridge, as a `CustomEvent` on the window, and
 * into the log at `window.__showcaseFilmLog`. `html[data-showcase-film]` says the run's state.
 */
import { FILM_EVENT_NAME, FILM_LOG_KEY, FILM_VERSION, type FilmEvent, type FilmEventInput } from "./film-events.ts";

const FILM_STATES: Partial<Record<FilmEvent["type"], string>> = {
  "film:armed": "armed",
  "film:start": "running",
  "film:end": "ended",
  "film:error": "error",
};

export interface Timeline {
  emit(event: FilmEventInput): FilmEvent;
  readonly events: readonly FilmEvent[];
}

export interface TimelineOptions {
  /** The next sequence number and this document's number. The state holds both. */
  stamp: () => { seq: number; doc: number };
  /** The captured clocks. */
  t: () => number;
  wall: () => number;
  /** Where the event goes: the host. */
  send?: (event: FilmEvent) => void;
  window?: Window | null;
}

export function createTimeline(options: TimelineOptions): Timeline {
  const view = options.window === undefined ? (typeof window === "undefined" ? null : window) : options.window;
  const events: FilmEvent[] = [];
  if (view) (view as unknown as Record<string, FilmEvent[]>)[FILM_LOG_KEY] = events;

  return {
    events,
    emit(input) {
      const { seq, doc } = options.stamp();
      const event = { ...input, v: FILM_VERSION, seq, doc, t: options.t(), wall: options.wall() } as FilmEvent;
      events.push(event);
      const state = FILM_STATES[event.type];
      if (view && state) view.document.documentElement.dataset.showcaseFilm = state;
      try {
        options.send?.(event);
      } catch {
        // The host's problem, not the tour's.
      }
      if (view) view.dispatchEvent(new CustomEvent(FILM_EVENT_NAME, { detail: event }));
      return event;
    },
  };
}

/** A timeline that keeps nothing: every run that isn't being filmed. */
export const NO_TIMELINE: Timeline = {
  events: [],
  emit: (input) => ({ ...input, v: FILM_VERSION, seq: 0, doc: 0, t: 0, wall: 0 }) as FilmEvent,
};
