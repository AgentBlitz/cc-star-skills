/**
 * Narration drives the timing (PLAN C5). A sentence lasts as long as its clip (`durationMs` in
 * the voice manifest), or as long as it takes to read when it has no clip (`readingMs`).
 * Sentences sleep on the pace clock, so a ×10 rehearsal speaks ×10 faster, and muting changes
 * the volume, never the timing.
 */
import { type Clock, throwIfAborted } from "./clock.ts";
import { readingMs } from "./narrative.ts";
import { type Beat, sentenceText } from "./schema.ts";

/** One synthesised sentence. A draft of Session 6's manifest: enough for lookup and timing. */
export interface VoiceClip {
  beat: string;
  text: string;
  hash: string;
  file: string;
  durationMs: number;
}

export interface VoiceManifest {
  v: 1;
  id: string;
  tour: string;
  clips: VoiceClip[];
}

/** The clip for a sentence: by tour, beat and exact text. */
export function findVoice(manifest: VoiceManifest | null | undefined, tour: string, beat: string, text: string): VoiceClip | null {
  if (!manifest || manifest.tour !== tour) return null;
  return manifest.clips.find((c) => c.beat === beat && c.text === text) ?? null;
}

export interface Cue {
  beat: string;
  /** The sentence's place in its beat. */
  index: number;
  text: string;
  /** How long the sentence holds, at ×1. */
  durationMs: number;
  audio: { hash: string; file: string; durationMs: number } | null;
  /** The action that must complete before the sentence starts. */
  after: string | null;
}

/** The beat's sentences as cues, in order. */
export function schedule(beat: Beat, options: { tour: string; manifest?: VoiceManifest | null }): Cue[] {
  return (beat.narration ?? []).map((sentence, index) => {
    const text = sentenceText(sentence);
    const voice = findVoice(options.manifest, options.tour, beat.id, text);
    return {
      beat: beat.id,
      index,
      text,
      durationMs: voice?.durationMs ?? readingMs(text),
      audio: voice ? { hash: voice.hash, file: voice.file, durationMs: voice.durationMs } : null,
      after: typeof sentence === "string" ? null : sentence.after,
    };
  });
}

/** The narration's length at ×1, gates aside. */
export function cuesMs(cues: readonly Cue[]): number {
  return cues.reduce((sum, c) => sum + c.durationMs, 0);
}

/** What plays the clips. Session 5 implements it; the engine only needs this much. */
export interface AudioPort {
  readonly muted: boolean;
  setMuted(muted: boolean): void;
  /** Starts the cue's clip; resolves when it is playing, or at once when there is none. */
  play(cue: Cue, signal?: AbortSignal): Promise<void>;
  preload(cue: Cue): void;
  pause(): void;
  resume(): void;
  stop(): void;
}

export interface SpeakOptions {
  /** The pace clock. */
  clock: Clock;
  signal?: AbortSignal;
  /** Resolves once the named action has completed (at once if it already has). */
  gate: (actionId: string) => Promise<void>;
  audio?: AudioPort | null;
  onStart?: (cue: Cue) => void;
  onEnd?: (cue: Cue) => void;
}

/**
 * Speaks the cues one after another. Each waits for its gate, starts (its clip with it), holds
 * for its duration and ends. Resolves to the time spoken, at ×1. Rejects on abort, with the
 * sentence in progress ended first so that every start has its end.
 */
export async function speak(cues: readonly Cue[], options: SpeakOptions): Promise<number> {
  let spoken = 0;
  for (const cue of cues) {
    throwIfAborted(options.signal);
    if (cue.after) await options.gate(cue.after);
    throwIfAborted(options.signal);
    if (options.audio && cue.audio) await options.audio.play(cue, options.signal);
    options.onStart?.(cue);
    try {
      await options.clock.sleep(cue.durationMs, options.signal);
      spoken += cue.durationMs;
    } finally {
      options.onEnd?.(cue);
    }
  }
  return spoken;
}

/** Every sentence of a tour, in order, as `[tour, beat, text]`: what the voice and the film key on. */
export function narrationLines(tour: { id: string; steps: { beats: Beat[] }[] }): [tour: string, beat: string, text: string][] {
  return tour.steps.flatMap((step) => step.beats.flatMap((beat) => (beat.narration ?? []).map((s): [string, string, string] => [tour.id, beat.id, sentenceText(s)])));
}

/** A short, stable hash of a tour's narration (FNV-1a): `film:armed` carries it, so a film is tied to the words it was made with. */
export function narrationFingerprint(lines: readonly [string, string, string][]): string {
  let h = 0x811c9dc5;
  const text = lines.map((l) => l.join("\u001f")).join("\n");
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
