/**
 * The narrative rules as code (PLAN §2.8): reading time, the length presets and kind factors,
 * the beat counts, spoken-number detection, and the static rules `check` gates on (T008–T014).
 * Browser-safe (C4), shared by the runtime and the CLI.
 */
import { type Beat, type Issue, type Range, sentenceText, type Tour, type TourKind, type TourMeta, beatsOf } from "./schema.ts";

// ——— Reading time ———

export const READING_WPM = 165;
export const READING_MIN_MS = 1600;

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * How long a sentence holds until it has a real clip (C5): 165 words a minute plus 350 ms,
 * never under 1.6 s. Rounded to the millisecond, as Compass's `readingMs` is.
 */
export function readingMs(text: string): number {
  return Math.max(READING_MIN_MS, Math.round((wordCount(text) * 60000) / READING_WPM + 350));
}

/**
 * A voiced sentence's clip duration, by beat and text, or undefined where there is none: what the
 * sentence really lasts (C5). `check` passes the voice manifest's, so the narration window is
 * judged on the voice once there is one, not on the reading estimate.
 */
export type VoicedMs = (beat: string, text: string) => number | undefined;

export function narrationMs(beat: Beat, voiced?: VoicedMs): number {
  return (beat.narration ?? []).reduce((ms, s) => ms + (voiced?.(beat.id, sentenceText(s)) ?? readingMs(sentenceText(s))), 0);
}

export function tourNarrationMs(tour: Tour, voiced?: VoicedMs): number {
  return tour.steps.reduce((ms, step) => ms + step.beats.reduce((b, beat) => b + narrationMs(beat, voiced), 0), 0);
}

export function tourWords(tour: Tour): number {
  return beatsOf(tour).reduce((n, { beat }) => n + (beat.narration ?? []).reduce((w, s) => w + wordCount(sentenceText(s)), 0), 0);
}

/**
 * A beat's planned length, for the storyboard: the longer of its narration and the pauses its
 * actions ask for, plus its dwell. The real length comes from the run (and the voice).
 */
export function beatPlanMs(beat: Beat): number {
  let paused = 0;
  for (const a of beat.actions ?? []) {
    if ((a.kind === "hold" || a.kind === "wait" || a.kind === "press" || a.kind === "card") && a.ms) paused += a.ms;
  }
  return Math.max(narrationMs(beat), paused) + (beat.dwellMs ?? 0);
}

// ——— Length presets (PLAN §2.8), anchored to the measured Compass pitch ———

export interface Preset {
  targetSec: number;
  film: Range;
  narration: Range;
  words: Range;
  beats: Range;
}

export const PRESETS: readonly Preset[] = [
  { targetSec: 60, film: { min: 55, max: 60 }, narration: { min: 48, max: 54 }, words: { min: 118, max: 133 }, beats: { min: 5, max: 6 } },
  { targetSec: 90, film: { min: 83, max: 90 }, narration: { min: 72, max: 81 }, words: { min: 177, max: 199 }, beats: { min: 6, max: 8 } },
  { targetSec: 120, film: { min: 110, max: 120 }, narration: { min: 96, max: 108 }, words: { min: 236, max: 266 }, beats: { min: 8, max: 10 } },
  { targetSec: 180, film: { min: 166, max: 180 }, narration: { min: 144, max: 162 }, words: { min: 354, max: 398 }, beats: { min: 11, max: 13 } },
  { targetSec: 300, film: { min: 276, max: 300 }, narration: { min: 240, max: 270 }, words: { min: 590, max: 664 }, beats: { min: 18, max: 22 } },
];

/** Narration time and words, by kind: how-to has more silent doing. */
export const KIND_FACTOR: Record<TourKind, number> = { pitch: 1, spotlight: 1, walkthrough: 0.94, howto: 0.85 };

/** Each kind's default length (Round 1 of the interview). */
export const KIND_DEFAULT_SEC: Record<TourKind, number> = { pitch: 120, walkthrough: 180, spotlight: 60, howto: 120 };

/** Films this long or longer name a `firstToCut` beat. */
export const FIRST_TO_CUT_FROM_SEC = 120;
/** The last card holds at least this long. */
export const CARD_HOLD_MIN_MS = 2000;

/**
 * The preset for a target. Between presets: narration 80–90 % of the film, words ≈ 1.97–2.22
 * a second, and the beat range interpolated (every preset sits on those lines).
 */
export function presetFor(targetSec: number): Preset {
  const exact = PRESETS.find((p) => p.targetSec === targetSec);
  if (exact) return exact;
  const t = targetSec;
  const lo = [...PRESETS].reverse().find((p) => p.targetSec < t);
  const hi = PRESETS.find((p) => p.targetSec > t);
  let beats: Range;
  if (lo && hi) {
    const f = (t - lo.targetSec) / (hi.targetSec - lo.targetSec);
    beats = { min: Math.round(lo.beats.min + f * (hi.beats.min - lo.beats.min)), max: Math.round(lo.beats.max + f * (hi.beats.max - lo.beats.max)) };
  } else {
    const edge = (lo ?? hi) as Preset;
    const f = t / edge.targetSec;
    beats = { min: Math.max(1, Math.round(edge.beats.min * f)), max: Math.max(1, Math.round(edge.beats.max * f)) };
  }
  return {
    targetSec: t,
    film: { min: Math.round(t * 0.92), max: t },
    narration: { min: t * 0.8, max: t * 0.9 },
    words: { min: Math.round((t * 118) / 60), max: Math.round((t * 133) / 60) },
    beats,
  };
}

export interface Budget {
  targetSec: number;
  /** Seconds of readingMs (or voiced) narration. */
  narration: Range;
  words: Range;
  beats: Range;
  /** Where the narration window came from. */
  source: "preset" | "derived" | "override";
}

const scale = (r: Range, f: number): Range => ({ min: r.min * f, max: r.max * f });

/** The tour's budget: its meta's overrides, else the preset scaled by the kind factor. */
export function budgetFor(meta: TourMeta): Budget {
  const p = presetFor(meta.length.targetSec);
  const f = KIND_FACTOR[meta.kind];
  const exact = PRESETS.some((x) => x.targetSec === meta.length.targetSec);
  return {
    targetSec: meta.length.targetSec,
    narration: meta.length.narration ?? scale(p.narration, f),
    words: { min: Math.round(p.words.min * f), max: Math.round(p.words.max * f) },
    beats: meta.length.beats ?? p.beats,
    source: meta.length.narration ? "override" : exact ? "preset" : "derived",
  };
}

// ——— Spoken numbers ———

const NUMBER_WORDS =
  "zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|a|half|a half";
const DIGITS = /[£$€]?\d[\d,.:]*(?:\s?(?:%|percent|per cent|k|m|bn|x|×))?/giu;
const MAGNITUDE = new RegExp(`\\b(?:(?:${NUMBER_WORDS})[\\s-]+)*(?:hundred|thousand|million|billion|trillion|percent|per cent)\\b`, "giu");

/**
 * The numbers a sentence says: anything with a digit (`42`, `£1.2m`, `W39`, `3:00`), and spelt-out
 * quantities with a magnitude or a percent (`two million`, `forty per cent`). Plain counts
 * ("four questions", "one click") are words, not figures, and aren't flagged.
 */
export function spokenNumbers(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(DIGITS)) found.push(m[0].replace(/[.,:]+$/, ""));
  for (const m of text.matchAll(MAGNITUDE)) found.push(m[0]);
  return found;
}

// ——— The static rules ———

/** Rule ids and what they mean; `check` prints the ids and `tour-format.md` lists them. */
export const RULES: Record<string, string> = {
  T001: "Schema: the tour doesn't match tour.schema.json",
  T002: "Duplicate id: steps and beats unique in the tour, actions unique in their beat",
  T003: "A sentence's `after` must name an action of the same beat",
  T004: "An `effect: write` action needs `done`",
  T005: "A `navigates` action must be last in its beat, and no sentence may wait for it",
  T006: "An `@anchor` must be defined in the tour's `anchors`",
  T007: "Caption too long: one sentence must fit 2 lines of 42 characters",
  T008: "Narration outside the window for the length and kind",
  T009: "Beat count outside the preset's range",
  T010: "A spoken number under `spokenNumbers: \"none\"`",
  T011: "Films of 2:00 or more name a `firstToCut` beat that exists",
  T012: "The last card must hold for at least 2 s (`dwellMs` ≥ 2000)",
  T013: "A pitch has no callouts: the narration says what a spotlight shows",
  T014: "An empty beat: no narration, actions or card",
  T015: "The storyboard is stale: run `showcase storyboard <tour>`",
};

const secs = (ms: number) => (ms / 1000).toFixed(1);
const fmtRange = (r: Range) => {
  const [a, b] = [Number(r.min.toFixed(1)), Number(r.max.toFixed(1))];
  return a === b ? `${a}` : `${a}–${b}`;
};

/** T008–T014, for a tour that passed the schema. T008 times voiced sentences by their clips. */
export function narrativeIssues(tour: Tour, voiced?: VoicedMs): Issue[] {
  const issues: Issue[] = [];
  const add = (rule: string, level: Issue["level"], path: string, message: string) => issues.push({ rule, level, path, message });
  const budget = budgetFor(tour.meta);
  const beats = beatsOf(tour);

  const ms = tourNarrationMs(tour, voiced);
  const sec = ms / 1000;
  if (sec < budget.narration.min - 1e-9 || sec > budget.narration.max + 1e-9)
    add("T008", "error", "/steps", `narration is ${secs(ms)} s; the window for ${tour.meta.kind} at ${budget.targetSec} s is ${fmtRange(budget.narration)} s (${sec < budget.narration.min ? "add" : "cut"} about ${Math.ceil(Math.abs(sec - (sec < budget.narration.min ? budget.narration.min : budget.narration.max)) * 2.46)} words)`);

  if (beats.length < budget.beats.min || beats.length > budget.beats.max)
    add("T009", "warning", "/steps", `${beats.length} beats; ${budget.targetSec} s suggests ${fmtRange(budget.beats)}`);

  if (tour.meta.rules?.spokenNumbers === "none")
    for (const { beat, path } of beats)
      (beat.narration ?? []).forEach((s, i) => {
        const n = spokenNumbers(sentenceText(s));
        if (n.length) add("T010", "error", `${path}/narration/${i}`, `says ${n.map((x) => `'${x}'`).join(", ")}, but spokenNumbers is "none"`);
      });

  const cut = tour.meta.rules?.firstToCut;
  if (cut !== undefined && !beats.some(({ beat }) => beat.id === cut)) add("T011", "error", "/meta/rules/firstToCut", `'${cut}' isn't a beat of this tour`);
  else if (cut === undefined && budget.targetSec >= FIRST_TO_CUT_FROM_SEC)
    add("T011", "error", "/meta/rules", `a ${budget.targetSec} s film names a firstToCut beat (the one to drop if it runs long)`);

  const last = beats.at(-1);
  if (last?.beat.card && (last.beat.dwellMs ?? 0) < CARD_HOLD_MIN_MS)
    add("T012", "error", `${last.path}/dwellMs`, `the closing card holds ${last.beat.dwellMs ?? 0} ms; it needs at least ${CARD_HOLD_MIN_MS}`);

  for (const { beat, path } of beats) {
    if (tour.meta.kind === "pitch")
      (beat.actions ?? []).forEach((a, i) => {
        if (a.kind === "spotlight" && a.callout) add("T013", "warning", `${path}/actions/${i}/callout`, `'${a.id}' has a callout; a pitch lets its narration speak`);
      });
    if (!beat.card && !(beat.narration ?? []).length && !(beat.actions ?? []).length) add("T014", "warning", path, `beat '${beat.id}' is empty`);
  }
  return issues;
}
