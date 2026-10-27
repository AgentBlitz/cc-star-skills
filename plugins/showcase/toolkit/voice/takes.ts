/**
 * Takes (showcase 1.1): `voice.takes` decides how much the voice reads in one go.
 *
 * - `tour`: as many whole steps as the provider's input limit allows, in one continuous take
 *   (usually the whole tour). What `showcase init` writes.
 * - `step`: one take per step.
 * - `sentence`: one call per sentence, as 1.0 did, and the default when the config says nothing.
 *
 * A take breaks only between steps. Its script is the sentences in order, after the lexicon,
 * one beat to a paragraph, with a blank line between beats, so the voice pauses where the film
 * changes beat.
 */
import type { Tour } from "../runtime/src/schema.ts";
import type { Sentence } from "./pipeline.ts";

export const TAKE_MODES = ["tour", "step", "sentence"] as const;
export type TakeMode = (typeof TAKE_MODES)[number];

/**
 * The most characters one call may carry, per provider and model. OpenAI's speech models take
 * 4,096 (through Requesty or OpenRouter). ElevenLabs' v3 takes 3,000. A model not listed here
 * gets 4,096, which every listed model accepts. The draft voices have no limit.
 */
export const INPUT_LIMITS: Record<string, number> = {
  "openai/gpt-4o-mini-tts": 4096,
  "openai/tts-1": 4096,
  "openai/tts-1-hd": 4096,
  "elevenlabs/eleven-v3": 3000,
};
export const DEFAULT_INPUT_LIMIT = 4096;

/** The input limit for a narrator model (dated snapshots share their model's), or none for a draft voice. */
export function inputLimit(model: string | null): number {
  if (model === null) return Number.POSITIVE_INFINITY;
  const known = Object.keys(INPUT_LIMITS).find((m) => model === m || model.startsWith(`${m}-`));
  return known ? (INPUT_LIMITS[known] as number) : DEFAULT_INPUT_LIMIT;
}

export interface TakeGroup {
  /** `t1`, `t2`, … in tour order. */
  id: string;
  steps: string[];
  sentences: Sentence[];
  /** What the voice reads. */
  script: string;
}

/** Pure: the script for these sentences, a paragraph per beat. */
export function takeScript(sentences: readonly Sentence[]): string {
  const beats: string[][] = [];
  let beat: string | null = null;
  for (const s of sentences) {
    if (s.beat !== beat) beats.push([]);
    beat = s.beat;
    beats[beats.length - 1]?.push(s.spoken.trim());
  }
  return beats.map((b) => b.join(" ")).join("\n\n");
}

/** A step whose narration alone is over the limit: the step must be split, or narrated more briefly. */
export class TakeTooLong extends Error {
  constructor(step: string, chars: number, limit: number) {
    super(`step ${step}'s narration is ${chars} characters, over the voice's ${limit}-character limit for one take: split the step`);
    this.name = "TakeTooLong";
  }
}

/** Pure: the tour's sentences grouped into takes (not for `sentence` mode). Steps with no narration join no take. */
export function groupTakes(tour: Tour, sentences: readonly Sentence[], mode: Exclude<TakeMode, "sentence">, limit: number): TakeGroup[] {
  const stepOf = new Map(tour.steps.flatMap((step) => step.beats.map((b) => [b.id, step.id] as const)));
  const bySteps: { step: string; sentences: Sentence[] }[] = [];
  for (const s of sentences) {
    const step = stepOf.get(s.beat) as string;
    const last = bySteps[bySteps.length - 1];
    if (last && last.step === step) last.sentences.push(s);
    else bySteps.push({ step, sentences: [s] });
  }
  const groups: { steps: string[]; sentences: Sentence[] }[] = [];
  for (const part of bySteps) {
    const alone = takeScript(part.sentences).length;
    if (alone > limit) throw new TakeTooLong(part.step, alone, limit);
    const last = groups[groups.length - 1];
    if (mode === "tour" && last && takeScript([...last.sentences, ...part.sentences]).length <= limit) {
      last.steps.push(part.step);
      last.sentences.push(...part.sentences);
    } else groups.push({ steps: [part.step], sentences: [...part.sentences] });
  }
  return groups.map((g, i) => ({ id: `t${i + 1}`, steps: g.steps, sentences: g.sentences, script: takeScript(g.sentences) }));
}

// ——— The fake take ———

/** The fake take's pauses: at a comma, between sentences, and between beats. */
export const FAKE_PAUSES = { comma: 120, sentence: 450, beat: 800 } as const;
const FAKE_RATE = 24_000;
const FAKE_CHARS_PER_SECOND = 16;

export interface FakeTake {
  wav: Buffer;
  /** Where each sentence's tone starts and ends, in ms: the truth the alignment tests check against. */
  sentences: { startMs: number; endMs: number }[];
}

/**
 * Pure: a take of 220 Hz tone, a run per sentence (characters ÷ 16 seconds, as the fake provider
 * does for one sentence), broken by silences at commas, between sentences and between beats. No
 * ffmpeg and no network: a 24 kHz, 16-bit mono WAV, built in memory.
 */
export function fakeTake(sentences: readonly Sentence[], pauses: { comma: number; sentence: number; beat: number } = FAKE_PAUSES): FakeTake {
  const parts: { tone: boolean; ms: number }[] = [];
  const spans: FakeTake["sentences"] = [];
  let t = 0;
  sentences.forEach((s, i) => {
    if (i > 0) {
      const gap = s.beat !== sentences[i - 1]?.beat ? pauses.beat : pauses.sentence;
      parts.push({ tone: false, ms: gap });
      t += gap;
    }
    const start = t;
    const pieces = s.spoken.split(",").filter((p) => p.trim().length > 0);
    pieces.forEach((p, k) => {
      if (k > 0) {
        parts.push({ tone: false, ms: pauses.comma });
        t += pauses.comma;
      }
      const ms = Math.max(300, Math.round((p.trim().length / FAKE_CHARS_PER_SECOND) * 1000));
      parts.push({ tone: true, ms });
      t += ms;
    });
    spans.push({ startMs: start, endMs: t });
  });
  const samples = parts.reduce((n, p) => n + Math.round((p.ms * FAKE_RATE) / 1000), 0);
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + samples * 2, 4);
  wav.write("WAVE", 8);
  wav.write("fmt ", 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(FAKE_RATE, 24);
  wav.writeUInt32LE(FAKE_RATE * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples * 2, 40);
  let k = 0;
  for (const p of parts) {
    const n = Math.round((p.ms * FAKE_RATE) / 1000);
    for (let i = 0; i < n; i++, k++) wav.writeInt16LE(p.tone ? Math.round(0.3 * 32767 * Math.sin((2 * Math.PI * 220 * i) / FAKE_RATE)) : 0, 44 + k * 2);
  }
  return { wav, sentences: spans };
}
