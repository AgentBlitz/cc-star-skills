/**
 * `timeline.json` (PLAN §2.5 "Outputs"): the take's events on the video's clock. Time 0 is the
 * start of the pre-roll, the first frame of the video; every event keeps its stamp and gains
 * `ms`, its time in the video (`wall − t0`). Beats and sentences are paired into spans, which is
 * what Session 8's mixdown, captions, chapters and stills read. Pure.
 */
import type { FilmEvent } from "../runtime/src/film-events.ts";

export type TimedEvent = FilmEvent & { ms: number };

export interface BeatSpan {
  beat: string;
  index: number;
  step: string;
  kind: "screen" | "card";
  title?: string;
  startMs: number;
  endMs: number;
  narrationMs: number;
  waitedMs: number;
}

export interface SentenceSpan {
  beat: string;
  index: number;
  text: string;
  audio: { hash: string; durationMs: number } | null;
  startMs: number;
  endMs: number;
}

export interface NavMark {
  url: string;
  kind: "load" | "spa";
  ms: number;
}

export interface Spans {
  events: TimedEvent[];
  beats: BeatSpan[];
  sentences: SentenceSpan[];
  navs: NavMark[];
  /** `film:start`, in video time. */
  startMs: number | null;
  /** `film:end`, in video time. */
  endMs: number | null;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function spans(events: readonly FilmEvent[], t0: number): Spans {
  const timed = events.map((e) => ({ ...e, ms: r1(e.wall - t0) }) as TimedEvent);
  const beats: BeatSpan[] = [];
  const sentences: SentenceSpan[] = [];
  const navs: NavMark[] = [];
  let beat: BeatSpan | null = null;
  let sentence: SentenceSpan | null = null;
  let startMs: number | null = null;
  let endMs: number | null = null;
  for (const e of timed) {
    switch (e.type) {
      case "film:start":
        startMs = e.ms;
        break;
      case "film:end":
        endMs = e.ms;
        break;
      case "beat:start":
        beat = { beat: e.beat, index: e.index, step: e.step, kind: e.kind, ...(e.title ? { title: e.title } : {}), startMs: e.ms, endMs: e.ms, narrationMs: 0, waitedMs: 0 };
        break;
      case "beat:end":
        if (beat && beat.beat === e.beat) {
          beat.endMs = e.ms;
          beat.narrationMs = e.narrationMs;
          beat.waitedMs = e.waitedMs;
          beats.push(beat);
          beat = null;
        }
        break;
      case "sentence:start":
        sentence = { beat: e.beat, index: e.index, text: e.text, audio: e.audio, startMs: e.ms, endMs: e.ms };
        break;
      case "sentence:end":
        if (sentence && sentence.beat === e.beat && sentence.index === e.index) {
          sentence.endMs = e.ms;
          sentences.push(sentence);
          sentence = null;
        }
        break;
      case "nav":
        navs.push({ url: e.url, kind: e.kind, ms: e.ms });
        break;
      default:
        break;
    }
  }
  return { events: timed, beats, sentences, navs, startMs, endMs };
}
