/**
 * The film's encode (`film/encode.ts`) with real ffmpeg: the output is 1920×1080, CFR 30, H.264
 * High, yuv420p, tagged BT.709 limited, with keyframes where asked; and the colour conversion is
 * right, not just labelled: a saturated colour, written as the screencast writes it (a JFIF JPEG,
 * BT.601 full range), comes back as the same colour when the video is read as BT.709 limited,
 * and visibly not when it is read as BT.601.
 */
import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { encodeArgs, encodeVideo, patchColours, probeVideo, runTool } from "../../film/encode.ts";
import { findFfmpeg } from "../../lib/ffmpeg.ts";

const OUT = resolve(import.meta.dirname, "..", ".out", "encode");
const { ffmpeg, ffprobe } = findFfmpeg();
const skip = !ffmpeg || !ffprobe ? "ffmpeg and ffprobe are needed" : false;

/** A screencast-like frame: a solid RGB colour as a BT.601 full-range JPEG. */
async function jpeg(file: string, rgb: string, size = "1920x1080"): Promise<void> {
  await runTool(ffmpeg as string, ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", `color=c=0x${rgb}:s=${size}:d=0.04`, "-frames:v", "1", "-vf", "scale=out_color_matrix=bt601:out_range=full,format=yuvj420p", "-q:v", "1", file]);
}

/** The colour at the centre of a video frame, decoded with the given matrix and range. */
async function centre(file: string, matrix: "bt709" | "bt601", range: "limited" | "full", at = 0.5): Promise<number[]> {
  const raw = await runTool(ffmpeg as string, ["-hide_banner", "-loglevel", "error", "-ss", String(at), "-i", file, "-frames:v", "1", "-vf", `crop=64:64,scale=1:1:flags=area:in_color_matrix=${matrix}:in_range=${range},format=rgb24`, "-f", "rawvideo", "pipe:1"]);
  return [...raw.subarray(0, 3)];
}

const hex = (s: string) => [0, 2, 4].map((i) => Number.parseInt(s.slice(i, i + 2), 16));
const far = (a: number[], b: number[]) => Math.max(...a.map((v, i) => Math.abs(v - (b[i] ?? 0))));

test("the encode arguments: CRF 17, slow, High, yuv420p, BT.709 tags, keyframes, faststart", () => {
  const a = encodeArgs({ input: "in/%06d.jpg", fps: 30, keyframes: [2.5, 0, 1.23456], out: "o.mp4" }).join(" ");
  for (const s of ["-framerate 30", "-c:v libx264", "-preset slow", "-crf 17", "-profile:v high", "-pix_fmt yuv420p", "-color_primaries bt709", "-color_trc bt709", "-colorspace bt709", "-color_range tv", "-force_key_frames 0,1.235,2.5", "-movflags +faststart", "-an"]) {
    assert.ok(a.includes(s), s);
  }
  assert.match(a, /in_color_matrix=bt601:in_range=full:out_color_matrix=bt709:out_range=limited/);
});

test("a CFR H.264 video, tagged BT.709, whose colours survive the conversion", { skip }, async () => {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const colours = ["c83214", "1464c8", "f0f0f0"];
  const files: string[] = [];
  for (const c of colours) {
    const f = join(OUT, `${c}.jpg`);
    await jpeg(f, c);
    files.push(f);
  }
  // A frame per colour for a second each: 90 frames, keyframes at each change.
  const frames = colours.flatMap((_, i) => Array.from({ length: 30 }, () => files[i] as string));
  const out = join(OUT, "v.mp4");
  await encodeVideo({ ffmpeg: ffmpeg as string, frames, workDir: OUT, fps: 30, keyframes: [1, 2], out });
  const p = await probeVideo(ffprobe as string, out);
  assert.deepEqual(
    [p.width, p.height, p.codec, p.profile, p.pixFmt, p.rFrameRate, p.avgFrameRate, p.frames],
    [1920, 1080, "h264", "High", "yuv420p", "30/1", "30/1", 90],
  );
  assert.deepEqual([p.colorSpace, p.colorTransfer, p.colorPrimaries, p.colorRange], ["bt709", "bt709", "bt709", "tv"]);
  assert.ok(Math.abs(p.durationSec - 3) < 1 / 30, `duration ${p.durationSec}`);
  assert.deepEqual(p.keyframes, [0, 1, 2]);
  for (const [i, c] of colours.entries()) {
    const got = await centre(out, "bt709", "limited", i + 0.5);
    assert.ok(far(got, hex(c)) <= 4, `#${c} came back as ${got}`);
  }
  // Read with the wrong matrix, the red is visibly off: the conversion really happened.
  assert.ok(far(await centre(out, "bt601", "limited", 0.5), hex("c83214")) >= 8);
});

test("the probe's patch colours, one per file, in order", { skip }, async () => {
  mkdirSync(OUT, { recursive: true });
  const a = join(OUT, "probe-a.jpg");
  const b = join(OUT, "probe-b.jpg");
  await jpeg(a, "ff00ff", "320x180");
  await jpeg(b, "202020", "320x180");
  const got = await patchColours(ffmpeg as string, [b, a, a, b], OUT);
  assert.equal(got.length, 4);
  const magenta = got.map(([r, g, bl]) => r > 200 && g < 70 && bl > 200);
  assert.deepEqual(magenta, [false, true, true, false]);
});
