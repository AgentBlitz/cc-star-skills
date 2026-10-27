/**
 * One take, cut back into sentences (showcase 1.1). The take is processed as a whole (one
 * loudness pass), its pauses are found with `silencedetect`, and the sentence boundaries are
 * fitted to them:
 *
 * - **The fit** is dynamic programming over the pauses, in order. Each sentence is expected to
 *   last in proportion to its characters, at the take's own rate; a boundary costs the squared
 *   relative miss of the sentences either side of it, and a short pause costs more than a long
 *   one, so of two candidates near the expected place the longer pause wins (commas pause too).
 * - **The cut** is at the middle of each chosen pause. Slice `i` runs from cut `i` to cut `i+1`
 *   (the take's start and end at the edges), so the slices joined are the take, sample for
 *   sample, and each slice's **onset** is where its speech starts inside it.
 *
 * Pure apart from {@link detectPauses} and {@link writeSlices}, which run ffmpeg.
 */
import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { toolEnv } from "../lib/child-env.ts";
import { encodeMp3, type FfmpegPaths, probeDurationMs } from "./audio.ts";
import type { PostConfig } from "./keys.ts";

const execFileAsync = promisify(execFile);

/** `silencedetect`'s threshold, against a take normalised to −16 LUFS, and the shortest pause it reports. */
export const PAUSE_DB = -45;
export const MIN_PAUSE_MS = 60;
/** Bumped when the fit or the cut changes, so every slice is cut again (from the cached raw take). */
export const ALIGN_VERSION = 1;
/** How much a pause's shortness counts against it, against the length fit. */
const PAUSE_WEIGHT = 0.35;
/** Added to a sentence's expected length before the miss is squared, so very short lines aren't judged too harshly. */
const LENGTH_SLACK_MS = 400;

export interface Pause {
  startMs: number;
  endMs: number;
}

export const mid = (p: Pause): number => (p.startMs + p.endMs) / 2;
const dur = (p: Pause): number => p.endMs - p.startMs;

/** Pure: `silencedetect`'s report, as pauses in ms. A silence still open at the end closes at `durationMs`. */
export function parseSilences(stderr: string, durationMs: number): Pause[] {
  const out: Pause[] = [];
  let open: number | null = null;
  for (const m of stderr.matchAll(/silence_(start|end): (-?\d+(?:\.\d+)?)/g)) {
    const ms = Number(m[2]) * 1000;
    if (m[1] === "start") open = Math.max(0, ms);
    else if (open !== null) {
      out.push({ startMs: open, endMs: ms });
      open = null;
    }
  }
  if (open !== null) out.push({ startMs: open, endMs: durationMs });
  return out;
}

/** The pauses in a processed take. */
export async function detectPauses(paths: FfmpegPaths, wav: string, durationMs: number): Promise<Pause[]> {
  let stderr: string;
  try {
    ({ stderr } = await execFileAsync(paths.ffmpeg, ["-hide_banner", "-nostats", "-i", wav, "-af", `silencedetect=noise=${PAUSE_DB}dB:d=${(MIN_PAUSE_MS / 1000).toFixed(3)}`, "-f", "null", "-"], {
      env: toolEnv(),
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }));
  } catch (e) {
    throw new Error(`ffmpeg silencedetect failed: ${String((e as { stderr?: string }).stderr ?? "").slice(-400)}`);
  }
  return parseSilences(stderr, durationMs);
}

export interface FitInput {
  /** Every pause in the take, in order. */
  pauses: readonly Pause[];
  /** Each sentence's expected share of the take (its spoken characters). */
  weights: readonly number[];
  /** Where speech starts and ends in the take. */
  speechStartMs: number;
  speechEndMs: number;
}

/**
 * Pure: the pause that ends each sentence but the last (`weights.length − 1` of them, in order),
 * or null when the take has too few pauses between its first sound and its last.
 */
export function fitBoundaries(o: FitInput): Pause[] | null {
  const n = o.weights.length;
  if (n <= 1) return [];
  const inner = o.pauses.filter((p) => p.startMs > o.speechStartMs && p.endMs < o.speechEndMs && dur(p) >= MIN_PAUSE_MS);
  const m = inner.length;
  if (m < n - 1) return null;
  const total = o.weights.reduce((s, w) => s + Math.max(1, w), 0);
  const rate = (o.speechEndMs - o.speechStartMs) / total;
  const expected = o.weights.map((w) => Math.max(1, w) * rate);
  const longest = Math.max(...inner.map(dur));
  const pauseCost = (j: number) => PAUSE_WEIGHT * (1 - dur(inner[j] as Pause) / longest);
  const at = (j: number) => mid(inner[j] as Pause);
  const lengthCost = (sentence: number, from: number, to: number) => {
    const e = expected[sentence] as number;
    return ((to - from - e) / (e + LENGTH_SLACK_MS)) ** 2;
  };

  // cost[k][j]: the best fit of sentences 0..k with sentence k ending at pause j.
  const cost: Float64Array[] = [];
  const back: Int32Array[] = [];
  for (let k = 0; k < n - 1; k++) {
    const row = new Float64Array(m).fill(Number.POSITIVE_INFINITY);
    const from = new Int32Array(m).fill(-1);
    // Sentence k ends at pause j only if k pauses come before it and n−2−k after it.
    for (let j = k; j <= m - (n - 1 - k); j++) {
      if (k === 0) {
        row[j] = lengthCost(0, o.speechStartMs, at(j)) + pauseCost(j);
        continue;
      }
      const prev = cost[k - 1] as Float64Array;
      for (let i = k - 1; i < j; i++) {
        const c = (prev[i] as number) + lengthCost(k, at(i), at(j)) + pauseCost(j);
        if (c < (row[j] as number)) {
          row[j] = c;
          from[j] = i;
        }
      }
    }
    cost.push(row);
    back.push(from);
  }
  const lastRow = cost[n - 2] as Float64Array;
  let best = -1;
  let bestCost = Number.POSITIVE_INFINITY;
  for (let j = n - 2; j < m; j++) {
    const c = (lastRow[j] as number) + lengthCost(n - 1, at(j), o.speechEndMs);
    if (c < bestCost) {
      bestCost = c;
      best = j;
    }
  }
  if (best < 0) return null;
  const chosen: number[] = [best];
  for (let k = n - 2; k > 0; k--) chosen.unshift((back[k] as Int32Array)[chosen[0] as number] as number);
  return chosen.map((j) => inner[j] as Pause);
}

export interface Slice {
  /** Where the slice starts and ends in the take. */
  fromMs: number;
  toMs: number;
  /** Where its speech starts, from the slice's start. */
  onsetMs: number;
}

/** Pure: the slices for these boundaries. Cuts fall on whole samples at `sampleRate`. */
export function slicesFor(boundaries: readonly Pause[], o: { durationMs: number; speechStartMs: number; sampleRate: number }): Slice[] {
  const snap = (ms: number) => (Math.round((ms * o.sampleRate) / 1000) * 1000) / o.sampleRate;
  const cuts = [0, ...boundaries.map((p) => snap(mid(p))), o.durationMs];
  const starts = [o.speechStartMs, ...boundaries.map((p) => p.endMs)];
  return starts.map((speech, i) => {
    const fromMs = cuts[i] as number;
    return { fromMs, toMs: cuts[i + 1] as number, onsetMs: Math.max(0, Math.round(speech - fromMs)) };
  });
}

/** Cuts the processed take into MP3 slices at `files` (one per slice, in `dir`); returns each slice's encoded duration. */
export async function writeSlices(paths: FfmpegPaths, wav: string, slices: readonly Slice[], files: readonly string[], workDir: string, post: PostConfig): Promise<number[]> {
  const out: number[] = [];
  for (const [i, s] of slices.entries()) {
    const a = Math.round((s.fromMs * post.sampleRate) / 1000);
    const b = Math.round((s.toMs * post.sampleRate) / 1000);
    const piece = join(workDir, `slice-${i}.wav`);
    try {
      await execFileAsync(paths.ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-i", wav, "-af", `atrim=start_sample=${a}:end_sample=${b},asetpts=N/SR/TB`, "-ar", String(post.sampleRate), "-ac", "1", piece], {
        env: toolEnv(),
        maxBuffer: 64 * 1024 * 1024,
      });
    } catch (e) {
      throw new Error(`ffmpeg failed to cut slice ${i}: ${String((e as { stderr?: string }).stderr ?? "").slice(-400)}`);
    }
    await encodeMp3(paths, piece, files[i] as string, post);
    out.push(await probeDurationMs(paths, files[i] as string));
  }
  return out;
}
