/**
 * The film's sound (PLAN §2.5 "Audio").
 *
 * 1. **The mixdown, in Node:** each clip is decoded once (cached by its file name, which is its
 *    file key) to 32-bit float at 48 kHz, placed at its sentence's start on the video's clock
 *    (`sentence:start − t0`), summed, and written as a float WAV exactly as long as the video.
 * 2. **Two-pass loudnorm:** −16 LUFS, true peak −1.5, LRA 11; the first pass measures, the
 *    second applies (linear when it can), then `aresample=48000`, because loudnorm runs at
 *    192 kHz inside. The result is 48 kHz stereo.
 * 3. **Measuring:** the master's integrated loudness and true peak (ebur128), and its samples,
 *    decoded back from the MP4, for the silence and sync checks.
 */
import { writeFileSync } from "node:fs";
import { runTool } from "./encode.ts";

export const RATE = 48_000;
export const LOUDNORM = { I: -16, TP: -1.5, LRA: 11 } as const;

export interface Placement {
  /** The clip's file. */
  file: string;
  /** Where it starts, in ms on the video's clock. */
  atMs: number;
}

/** Decodes any audio file to mono 32-bit float samples at 48 kHz. */
export async function decodeMono(ffmpeg: string, file: string, o: { stream?: string } = {}): Promise<Float32Array> {
  const buf = await runTool(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", file, ...(o.stream ? ["-map", o.stream] : []), "-vn", "-ac", "1", "-ar", String(RATE), "-f", "f32le", "pipe:1"]);
  const out = new Float32Array(buf.length / 4);
  for (let i = 0; i < out.length; i++) out[i] = buf.readFloatLE(i * 4);
  return out;
}

/** Pure: sums each clip into a buffer `durationMs` long; anything past the end is cut. */
export function mixdown(clips: readonly { samples: Float32Array; atMs: number }[], durationMs: number): Float32Array {
  const out = new Float32Array(Math.round((durationMs * RATE) / 1000));
  for (const c of clips) {
    const at = Math.round((c.atMs * RATE) / 1000);
    for (let i = 0; i < c.samples.length; i++) {
      const k = at + i;
      if (k < 0) continue;
      if (k >= out.length) break;
      out[k] = (out[k] as number) + (c.samples[i] as number);
    }
  }
  return out;
}

/** Pure: a mono 32-bit float WAV (format 3). */
export function wavFloat(samples: Float32Array, rate = RATE): Buffer {
  const data = samples.length * 4;
  const b = Buffer.alloc(44 + data);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + data, 4);
  b.write("WAVE", 8);
  b.write("fmt ", 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(3, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 4, 28);
  b.writeUInt16LE(4, 32);
  b.writeUInt16LE(32, 34);
  b.write("data", 36);
  b.writeUInt32LE(data, 40);
  for (let i = 0; i < samples.length; i++) b.writeFloatLE(samples[i] as number, 44 + i * 4);
  return b;
}

/** Decodes each distinct clip once, places them and writes the mix. */
export async function writeMix(ffmpeg: string, placements: readonly Placement[], durationMs: number, out: string): Promise<{ clips: number; decoded: number }> {
  const cache = new Map<string, Float32Array>();
  const clips: { samples: Float32Array; atMs: number }[] = [];
  for (const p of placements) {
    let samples = cache.get(p.file);
    if (!samples) {
      samples = await decodeMono(ffmpeg, p.file);
      cache.set(p.file, samples);
    }
    clips.push({ samples, atMs: p.atMs });
  }
  writeFileSync(out, wavFloat(mixdown(clips, durationMs)));
  return { clips: clips.length, decoded: cache.size };
}

export interface LoudnormMeasure {
  input_i: string;
  input_tp: string;
  input_lra: string;
  input_thresh: string;
  target_offset: string;
}

/** Pure: the JSON block loudnorm prints at the end of its first pass. */
export function parseLoudnorm(stderr: string): LoudnormMeasure {
  const start = stderr.lastIndexOf("{");
  const end = stderr.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("loudnorm printed no measurement");
  const j = JSON.parse(stderr.slice(start, end + 1)) as Record<string, string>;
  for (const k of ["input_i", "input_tp", "input_lra", "input_thresh", "target_offset"]) if (typeof j[k] !== "string") throw new Error(`loudnorm's measurement lacks ${k}`);
  return j as unknown as LoudnormMeasure;
}

const target = `I=${LOUDNORM.I}:TP=${LOUDNORM.TP}:LRA=${LOUDNORM.LRA}`;

/** Two-pass loudnorm, then back to 48 kHz, as a stereo float WAV. Returns the first pass's measure. */
export async function normalise(ffmpeg: string, input: string, out: string): Promise<LoudnormMeasure | null> {
  const first = await runTool(ffmpeg, ["-hide_banner", "-nostats", "-i", input, "-af", `loudnorm=${target}:print_format=json`, "-f", "null", "-"], { stderrToo: true });
  const m = parseLoudnorm(first.toString());
  // A silent mix measures -inf: there's nothing to normalise, so it's resampled as it is.
  const silent = !Number.isFinite(Number(m.input_i));
  const af = silent
    ? `aresample=${RATE}`
    : `loudnorm=${target}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=${RATE}`;
  await runTool(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-i", input, "-af", af, "-ar", String(RATE), "-ac", "2", "-c:a", "pcm_f32le", out]);
  return silent ? null : m;
}

export interface Loudness {
  integratedLufs: number | null;
  truePeakDb: number | null;
  lra: number | null;
}

/** Pure: ebur128's summary (with `peak=true`). */
export function parseEbur128(stderr: string): Loudness {
  const at = stderr.lastIndexOf("Summary:");
  if (at < 0) return { integratedLufs: null, truePeakDb: null, lra: null };
  const summary = stderr.slice(at);
  const num = (re: RegExp) => {
    const m = re.exec(summary);
    if (!m || m[1] === "-inf") return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  };
  return {
    integratedLufs: num(/Integrated loudness:\s*\n\s*I:\s*(-?[\d.]+|-inf)\s*LUFS/),
    truePeakDb: num(/True peak:\s*\n\s*Peak:\s*(-?[\d.]+|-inf)\s*dBFS/),
    lra: num(/LRA:\s*(-?[\d.]+)\s*LU\b/),
  };
}

/** The integrated loudness, true peak and loudness range of a file's audio. */
export async function measureLoudness(ffmpeg: string, file: string): Promise<Loudness> {
  const err = await runTool(ffmpeg, ["-hide_banner", "-nostats", "-i", file, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"], { stderrToo: true });
  return parseEbur128(err.toString());
}

/** Pure: RMS in 10 ms windows, in dBFS (−Infinity for digital silence). */
export function levels(samples: Float32Array, windowMs = 10): Float64Array {
  const n = Math.round((RATE * windowMs) / 1000);
  const out = new Float64Array(Math.ceil(samples.length / n));
  for (let w = 0; w < out.length; w++) {
    let sum = 0;
    const end = Math.min(samples.length, (w + 1) * n);
    for (let i = w * n; i < end; i++) sum += (samples[i] as number) ** 2;
    out[w] = 10 * Math.log10(sum / Math.max(1, end - w * n));
  }
  return out;
}

/** The silence threshold for the gap and onset checks. */
export const SILENCE_DB = -45;

/**
 * Pure: the longest silence between the first sound and the last (the lead-in before the first
 * sentence and the hold after the last aren't gaps), from 10 ms levels.
 */
export function longestInnerSilence(lv: Float64Array, windowMs = 10): { ms: number; atMs: number | null } {
  let first = -1;
  let last = -1;
  for (let i = 0; i < lv.length; i++)
    if ((lv[i] as number) > SILENCE_DB) {
      if (first < 0) first = i;
      last = i;
    }
  let best = { ms: 0, atMs: null as number | null };
  let run = 0;
  for (let i = first + 1; first >= 0 && i <= last; i++) {
    if ((lv[i] as number) <= SILENCE_DB) run++;
    else {
      if (run * windowMs > best.ms) best = { ms: run * windowMs, atMs: (i - run) * windowMs };
      run = 0;
    }
  }
  return best;
}

/**
 * Where speech starts in the master, for the av-sync check. The master is normalised to −16 LUFS,
 * where speech runs at −8 to −30 dB and the breath and room tone before a sentence at −37 to
 * −50 dB, around `SILENCE_DB` (Session 7's take). Above −35 dB is speech, as `voice/align.ts`'s
 * `SOFT_PAUSE_DB` reads a take.
 */
export const SPEECH_DB = -35;

/** Pure: the first 10 ms window at or after `fromMs` (and before `toMs`) louder than `thresholdDb` (default: not silent), in ms. */
export function onsetMs(lv: Float64Array, fromMs: number, toMs: number, windowMs = 10, thresholdDb = SILENCE_DB): number | null {
  for (let i = Math.max(0, Math.floor(fromMs / windowMs)); i < lv.length && i * windowMs < toMs; i++) if ((lv[i] as number) > thresholdDb) return i * windowMs;
  return null;
}
