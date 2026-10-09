/**
 * The narrative rules as code (PLAN §2.8): reading time, the length presets and kind factors,
 * the beat counts, spoken-number detection, and the static rules `check` gates on (T008–T014).
 * Browser-safe (C4), shared by the runtime and the CLI.
 */
import { type Beat, type Issue, type Range, type Tour, type TourKind, type TourMeta } from "./schema.ts";
export declare const READING_WPM = 165;
export declare const READING_MIN_MS = 1600;
export declare function wordCount(text: string): number;
/**
 * How long a sentence holds until it has a real clip (C5): 165 words a minute plus 350 ms,
 * never under 1.6 s. Rounded to the millisecond, as Compass's `readingMs` is.
 */
export declare function readingMs(text: string): number;
export declare function narrationMs(beat: Beat): number;
export declare function tourNarrationMs(tour: Tour): number;
export declare function tourWords(tour: Tour): number;
/**
 * A beat's planned length, for the storyboard: the longer of its narration and the pauses its
 * actions ask for, plus its dwell. The real length comes from the run (and the voice).
 */
export declare function beatPlanMs(beat: Beat): number;
export interface Preset {
    targetSec: number;
    film: Range;
    narration: Range;
    words: Range;
    beats: Range;
}
export declare const PRESETS: readonly Preset[];
/** Narration time and words, by kind: how-to has more silent doing. */
export declare const KIND_FACTOR: Record<TourKind, number>;
/** Each kind's default length (Round 1 of the interview). */
export declare const KIND_DEFAULT_SEC: Record<TourKind, number>;
/** Films this long or longer name a `firstToCut` beat. */
export declare const FIRST_TO_CUT_FROM_SEC = 120;
/** The last card holds at least this long. */
export declare const CARD_HOLD_MIN_MS = 2000;
/**
 * The preset for a target. Between presets: narration 80–90 % of the film, words ≈ 1.97–2.22
 * a second, and the beat range interpolated (every preset sits on those lines).
 */
export declare function presetFor(targetSec: number): Preset;
export interface Budget {
    targetSec: number;
    /** Seconds of readingMs (or voiced) narration. */
    narration: Range;
    words: Range;
    beats: Range;
    /** Where the narration window came from. */
    source: "preset" | "derived" | "override";
}
/** The tour's budget: its meta's overrides, else the preset scaled by the kind factor. */
export declare function budgetFor(meta: TourMeta): Budget;
/**
 * The numbers a sentence says: anything with a digit (`42`, `£1.2m`, `W39`, `3:00`), and spelt-out
 * quantities with a magnitude or a percent (`two million`, `forty per cent`). Plain counts
 * ("four questions", "one click") are words, not figures, and aren't flagged.
 */
export declare function spokenNumbers(text: string): string[];
/** Rule ids and what they mean; `check` prints the ids and `tour-format.md` lists them. */
export declare const RULES: Record<string, string>;
/** T008–T014, for a tour that passed the schema. */
export declare function narrativeIssues(tour: Tour): Issue[];
