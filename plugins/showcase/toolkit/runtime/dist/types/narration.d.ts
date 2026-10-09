/**
 * Narration drives the timing (PLAN C5). A sentence lasts as long as its clip (`durationMs` in
 * the voice manifest), or as long as it takes to read when it has no clip (`readingMs`).
 * Sentences sleep on the pace clock, so a ×10 rehearsal speaks ×10 faster, and muting changes
 * the volume, never the timing.
 */
import { type Clock } from "./clock.ts";
import type { VoiceClip, VoiceManifest } from "./protocol.ts";
import { type Beat } from "./schema.ts";
export type { VoiceClip, VoiceManifest } from "./protocol.ts";
/** The clip for a sentence: by tour, beat and exact text. */
export declare function findVoice(manifest: VoiceManifest | null | undefined, tour: string, beat: string, text: string): VoiceClip | null;
export interface Cue {
    beat: string;
    /** The sentence's place in its beat. */
    index: number;
    text: string;
    /** How long the sentence holds, at ×1. */
    durationMs: number;
    audio: {
        hash: string;
        file: string;
        durationMs: number;
    } | null;
    /** The action that must complete before the sentence starts. */
    after: string | null;
}
/** The beat's sentences as cues, in order. */
export declare function schedule(beat: Beat, options: {
    tour: string;
    manifest?: VoiceManifest | null;
}): Cue[];
/** The narration's length at ×1, gates aside. */
export declare function cuesMs(cues: readonly Cue[]): number;
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
export declare function speak(cues: readonly Cue[], options: SpeakOptions): Promise<number>;
/** Every sentence of a tour, in order, as `[tour, beat, text]`: what the voice and the film key on. */
export declare function narrationLines(tour: {
    id: string;
    steps: {
        beats: Beat[];
    }[];
}): [tour: string, beat: string, text: string][];
/** A short, stable hash of a tour's narration (FNV-1a): `film:armed` carries it, so a film is tied to the words it was made with. */
export declare function narrationFingerprint(lines: readonly [string, string, string][]): string;
