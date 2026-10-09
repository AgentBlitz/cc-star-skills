/**
 * The pipeline's two hashes (PLAN §2.4):
 *  - `synthKey` names a request to a voice: the same sentence, provider, model, voice, instructions,
 *    speed or rate and take always hash the same, so a re-run reuses the raw clip in the cache
 *    instead of paying for it again.
 *  - `fileKey` names the finished clip: the synth key plus the post-processing settings. Changing
 *    the loudness target or the codec changes every file name without invalidating the raw cache,
 *    and a clip whose file name differs from the expected one is stale (this is fix 2).
 */
import { createHash } from "node:crypto";

/** The processing chain's settings. `chain` is bumped when the ffmpeg chain itself changes. */
export interface PostConfig {
  chain: number;
  lufs: number;
  limitDb: number;
  trimDb: number;
  leadMs: number;
  tailMs: number;
  codec: string;
  sampleRate: number;
  kbps: number;
}

export const POST: PostConfig = { chain: 3, lufs: -16, limitDb: -1.5, trimDb: -50, leadMs: 30, tailMs: 80, codec: "mp3", sampleRate: 24000, kbps: 64 };

export interface SynthKeyInput {
  spoken: string;
  provider: string;
  model: string;
  voice: string;
  instructions?: string | undefined;
  speed?: number | undefined;
  rate?: number | undefined;
  take: number;
}

function sha256(canonical: string): string {
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function synthKey(input: SynthKeyInput): string {
  return sha256(
    JSON.stringify({
      spoken: input.spoken,
      provider: input.provider,
      model: input.model,
      voice: input.voice,
      instructions: input.instructions ?? null,
      speed: input.speed ?? null,
      rate: input.rate ?? null,
      take: input.take,
    }),
  );
}

export function fileKey(synth: string, post: PostConfig): string {
  return sha256(JSON.stringify({ synth, post }));
}

/** The clip's file name: the first 16 hex characters of the file key, plus its extension. */
export function fileName(key: string, ext = "mp3"): string {
  return `${key.slice(0, 16)}.${ext}`;
}
