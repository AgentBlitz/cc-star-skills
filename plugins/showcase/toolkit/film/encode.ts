/**
 * The video (PLAN §2.5 "Video"): the constant-frame-rate sequence as hard links, encoded once.
 *
 * - **Colour:** the screencast's JPEGs are BT.601 full range (JFIF). They are converted
 *   explicitly to BT.709 limited range, and the output is tagged BT.709 (primaries, transfer,
 *   matrix) and `tv` range, so players don't guess.
 * - **x264:** CRF 17, preset slow, High profile, yuv420p, a keyframe at each beat's start,
 *   faststart.
 *
 * ffmpeg and ffprobe get the tool environment (PLAN §2.3); every child is tracked, so a stop
 * signal takes them down too.
 */
import { type ChildProcess, spawn } from "node:child_process";
import { copyFileSync, linkSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { toolEnv } from "../lib/child-env.ts";

export const WIDTH = 1920;
export const HEIGHT = 1080;

const children = new Set<ChildProcess>();

/** Kills any ffmpeg or ffprobe still running (a stop signal, a failed take). */
export function killTools(): void {
  for (const c of children) c.kill("SIGKILL");
  children.clear();
}

export function runTool(bin: string, args: string[], o: { stdin?: string } = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { env: toolEnv(), stdio: ["pipe", "pipe", "pipe"] });
    children.add(child);
    const out: Buffer[] = [];
    let err = "";
    child.stdout.on("data", (d: Buffer) => out.push(d));
    child.stderr.on("data", (d: Buffer) => {
      err = (err + d.toString()).slice(-4000);
    });
    child.on("error", (e) => {
      children.delete(child);
      reject(e);
    });
    child.on("close", (code, signal) => {
      children.delete(child);
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(`${bin.split("/").at(-1)} failed (${signal ?? `exit ${code}`}): ${err.trim().split("\n").slice(-3).join(" | ")}`));
    });
    child.stdin.end(o.stdin ?? "");
  });
}

/** The filter: scale to 1920×1080 if needed, BT.601 full → BT.709 limited, 4:2:0, frames tagged BT.709. */
export const COLOUR_FILTER = `scale=${WIDTH}:${HEIGHT}:flags=lanczos:in_color_matrix=bt601:in_range=full:out_color_matrix=bt709:out_range=limited,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv`;

export interface EncodeOptions {
  ffmpeg: string;
  /** The captured frame shown at each output frame, in order. */
  frames: readonly string[];
  /** A scratch dir for the hard links. */
  workDir: string;
  fps: number;
  /** Keyframes, in seconds from the start (beat starts). */
  keyframes: readonly number[];
  out: string;
}

export function encodeArgs(o: { input: string; fps: number; keyframes: readonly number[]; out: string }): string[] {
  const kf = [...new Set([0, ...o.keyframes.map((s) => Math.max(0, Math.round(s * 1000) / 1000))])].sort((a, b) => a - b);
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-framerate",
    String(o.fps),
    "-i",
    o.input,
    "-vf",
    COLOUR_FILTER,
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "17",
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-color_primaries",
    "bt709",
    "-color_trc",
    "bt709",
    "-colorspace",
    "bt709",
    "-color_range",
    "tv",
    "-force_key_frames",
    kf.join(","),
    "-r",
    String(o.fps),
    "-movflags",
    "+faststart",
    "-an",
    o.out,
  ];
}

/** Links the schedule into `<workDir>/cfr/NNNNNN.jpg` and encodes it. */
export async function encodeVideo(o: EncodeOptions): Promise<void> {
  const cfr = join(o.workDir, "cfr");
  rmSync(cfr, { recursive: true, force: true });
  mkdirSync(cfr, { recursive: true });
  o.frames.forEach((src, k) => {
    const dst = join(cfr, `${String(k).padStart(6, "0")}.jpg`);
    try {
      linkSync(src, dst);
    } catch {
      copyFileSync(src, dst);
    }
  });
  try {
    await runTool(o.ffmpeg, encodeArgs({ input: join(cfr, "%06d.jpg"), fps: o.fps, keyframes: o.keyframes, out: o.out }));
  } finally {
    rmSync(cfr, { recursive: true, force: true });
  }
}

export interface VideoProbe {
  width: number;
  height: number;
  codec: string;
  profile: string;
  pixFmt: string;
  rFrameRate: string;
  avgFrameRate: string;
  colorSpace: string | null;
  colorTransfer: string | null;
  colorPrimaries: string | null;
  colorRange: string | null;
  frames: number;
  durationSec: number;
  /** Keyframe times, in seconds. */
  keyframes: number[];
}

export async function probeVideo(ffprobe: string, file: string): Promise<VideoProbe> {
  const json = JSON.parse(
    (
      await runTool(ffprobe, ["-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries", "stream=width,height,codec_name,profile,pix_fmt,r_frame_rate,avg_frame_rate,color_space,color_transfer,color_primaries,color_range,nb_read_frames,duration:format=duration", "-of", "json", file])
    ).toString(),
  ) as { streams: Record<string, string | number>[]; format: { duration?: string } };
  const s = json.streams[0] ?? {};
  const kf = (await runTool(ffprobe, ["-v", "error", "-select_streams", "v:0", "-skip_frame", "nokey", "-show_entries", "frame=pts_time", "-of", "csv=p=0", file])).toString();
  const str = (k: string) => (s[k] === undefined || s[k] === "unknown" ? null : String(s[k]));
  return {
    width: Number(s.width),
    height: Number(s.height),
    codec: String(s.codec_name),
    profile: String(s.profile),
    pixFmt: String(s.pix_fmt),
    rFrameRate: String(s.r_frame_rate),
    avgFrameRate: String(s.avg_frame_rate),
    colorSpace: str("color_space"),
    colorTransfer: str("color_transfer"),
    colorPrimaries: str("color_primaries"),
    colorRange: str("color_range"),
    frames: Number(s.nb_read_frames),
    durationSec: Number(s.duration ?? json.format.duration),
    keyframes: kf
      .split("\n")
      .map((l) => Number.parseFloat(l))
      .filter((n) => Number.isFinite(n)),
  };
}

/** The mean colour of a 32×32 patch near each image's top-left corner (the probe's check). */
export async function patchColours(ffmpeg: string, files: readonly string[], workDir: string): Promise<[number, number, number][]> {
  if (files.length === 0) return [];
  const list = join(workDir, "probe-frames.txt");
  writeFileSync(list, files.map((f) => `file '${f.replace(/'/g, "'\\''")}'\nduration 0.04\n`).join(""));
  const raw = await runTool(ffmpeg, ["-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-vf", "crop=32:32:16:16,scale=1:1:flags=area,format=rgb24", "-fps_mode", "passthrough", "-f", "rawvideo", "pipe:1"]);
  rmSync(list, { force: true });
  const out: [number, number, number][] = [];
  for (let i = 0; i + 2 < raw.length; i += 3) out.push([raw[i] as number, raw[i + 1] as number, raw[i + 2] as number]);
  return out;
}
