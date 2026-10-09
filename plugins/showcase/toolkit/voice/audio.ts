/**
 * The processing chain every synthesised sentence goes through (PLAN §2.4): trim, measure
 * (ebur128), gain to −16 LUFS, `alimiter`, soxr at 24 kHz mono, a 30 ms lead and an 80 ms tail,
 * then MP3 at 64k, with a check that the encode didn't drift the duration.
 */
import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { toolEnv } from "../lib/child-env.ts";
import { findFfmpeg, missing, probeCapabilities } from "../lib/ffmpeg.ts";
import type { Env } from "../lib/paths.ts";
import type { PostConfig } from "./keys.ts";
import type { AudioFormat } from "./types.ts";

const execFileAsync = promisify(execFile);

export interface FfmpegPaths {
  ffmpeg: string;
  ffprobe: string;
}

/** ffmpeg and ffprobe with every capability the chain needs, or an error saying what's missing. */
export function requireFfmpeg(env: Env = process.env): FfmpegPaths {
  const found = findFfmpeg(env);
  if (!found.ffmpeg || !found.ffprobe) throw new Error("ffmpeg/ffprobe were not found (set FFMPEG_PATH/FFPROBE_PATH, or `brew install ffmpeg`)");
  const lacking = missing(probeCapabilities(found.ffmpeg));
  if (lacking.length > 0) throw new Error(`this ffmpeg build is missing: ${lacking.join(", ")}`);
  return { ffmpeg: found.ffmpeg, ffprobe: found.ffprobe };
}

async function runFfmpeg(ffmpeg: string, args: string[]): Promise<void> {
  try {
    await execFileAsync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], { env: toolEnv(), maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    throw new Error(`ffmpeg failed: ${String((e as { stderr?: string }).stderr ?? (e as Error).message).trim().slice(-400)}`);
  }
}

const INTEGRATED_LOUDNESS = /Integrated loudness:\s*\n\s*I:\s*(-?\d+(?:\.\d+)?|-inf)\s*LUFS/;

/** ebur128's summary lands on stderr, so this reads that stream. */
export async function measureLufs(paths: FfmpegPaths, input: string): Promise<number> {
  let stderr: string;
  try {
    ({ stderr } = await execFileAsync(paths.ffmpeg, ["-hide_banner", "-nostats", "-i", input, "-af", "ebur128=peak=none", "-f", "null", "-"], {
      env: toolEnv(),
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }));
  } catch (e) {
    throw new Error(`ffmpeg ebur128 measurement failed: ${String((e as { stderr?: string }).stderr ?? "").slice(-400)}`);
  }
  const match = INTEGRATED_LOUDNESS.exec(stderr);
  if (!match) throw new Error("ebur128 did not report an integrated loudness");
  const lufs = Number(match[1]);
  if (!Number.isFinite(lufs)) throw new Error("the clip is silent: nothing to normalise");
  return lufs;
}

export interface ProcessedClip {
  /** The processed, lossless clip in the work dir. */
  wavPath: string;
  durationMs: number;
  measuredLufs: number;
}

/** Trims silence, gains to `post.lufs`, limits, resamples and pads. `workDir` is the caller's scratch dir. */
export async function processClip(
  paths: FfmpegPaths,
  input: { bytes: Buffer; format: AudioFormat },
  post: PostConfig,
  workDir: string,
): Promise<ProcessedClip> {
  const rawPath = join(workDir, `raw.${input.format}`);
  await writeFile(rawPath, input.bytes);
  // pcm has no container: signed 16-bit little-endian samples at 24 kHz mono, so ffmpeg is told the layout.
  const rawInputArgs = input.format === "pcm" ? ["-f", "s16le", "-ar", "24000", "-ac", "1"] : [];

  const trimmedPath = join(workDir, "trimmed.wav");
  const trim = `silenceremove=start_periods=1:start_threshold=${post.trimDb}dB:start_silence=0.05:detection=peak`;
  await runFfmpeg(paths.ffmpeg, [...rawInputArgs, "-i", rawPath, "-af", ["aformat=channel_layouts=mono", trim, "areverse", trim, "areverse"].join(","), trimmedPath]);

  const measuredLufs = await measureLufs(paths, trimmedPath);
  const gainDb = post.lufs - measuredLufs;
  const limitLinear = 10 ** (post.limitDb / 20);

  const finalPath = join(workDir, "final.wav");
  const postFilter = [
    `volume=${gainDb.toFixed(3)}dB`,
    `alimiter=limit=${limitLinear.toFixed(6)}:level=false`,
    `aresample=${post.sampleRate}:resampler=soxr`,
    `adelay=${post.leadMs}|${post.leadMs}`,
    `apad=pad_dur=${(post.tailMs / 1000).toFixed(3)}`,
  ].join(",");
  await runFfmpeg(paths.ffmpeg, ["-i", trimmedPath, "-af", postFilter, "-ar", String(post.sampleRate), "-ac", "1", finalPath]);

  return { wavPath: finalPath, durationMs: await probeDurationMs(paths, finalPath), measuredLufs };
}

async function probe(paths: FfmpegPaths, file: string, entries: string): Promise<string> {
  const { stdout } = await execFileAsync(paths.ffprobe, ["-v", "error", "-select_streams", "a:0", "-show_entries", `stream=${entries}`, "-of", "default=noprint_wrappers=1:nokey=0", file], {
    env: toolEnv(),
    encoding: "utf8",
  });
  return stdout;
}

/** The stream's sample-accurate duration (ffprobe demuxes PCM WAV and MP3 exactly), not a rounded container field. */
export async function probeDurationMs(paths: FfmpegPaths, file: string): Promise<number> {
  const seconds = Number(/duration=(\d+(?:\.\d+)?)/.exec(await probe(paths, file, "duration"))?.[1]);
  if (!seconds) throw new Error(`ffprobe could not read ${file}'s duration`);
  return Math.round(seconds * 1000);
}

export async function probeChannelsAndRate(paths: FfmpegPaths, file: string): Promise<{ channels: number; sampleRate: number }> {
  const out = await probe(paths, file, "channels,sample_rate");
  return { channels: Number(/channels=(\d+)/.exec(out)?.[1]), sampleRate: Number(/sample_rate=(\d+)/.exec(out)?.[1]) };
}

/** Encodes the processed WAV to the public MP3, and checks the encode didn't drift the duration. */
export async function encodeMp3(paths: FfmpegPaths, wavPath: string, outMp3Path: string, post: PostConfig): Promise<void> {
  await runFfmpeg(paths.ffmpeg, ["-i", wavPath, "-c:a", "libmp3lame", "-b:a", `${post.kbps}k`, "-ar", String(post.sampleRate), "-ac", "1", outMp3Path]);
  const [wavMs, mp3Ms] = [await probeDurationMs(paths, wavPath), await probeDurationMs(paths, outMp3Path)];
  if (Math.abs(wavMs - mp3Ms) > 50) throw new Error(`${outMp3Path}: the MP3's duration (${mp3Ms} ms) drifted from the WAV's (${wavMs} ms)`);
}
