/** The film's captions (Session 8): ASS and SRT from the same timings, and the SRT check. */
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { assTime, buildAss, buildSrt, CAPTION_FONT_FILE, parseSrt, srtProblems, srtTime } from "../../film/captions.ts";
import { runTool } from "../../film/encode.ts";
import { FONTS_DIR } from "../../film/post.ts";
import { bandSeries } from "../../film/verify.ts";
import { findFfmpeg } from "../../lib/ffmpeg.ts";

const { ffmpeg } = findFfmpeg();
const skip = !ffmpeg ? "ffmpeg is needed" : false;

const cues = [
  { startMs: 779, endMs: 3828, text: "This page checks the voice against the picture." },
  { startMs: 4613, endMs: 5725, text: "Flash, and beep." },
];

test("the clocks: ASS in centiseconds, SRT in milliseconds", () => {
  assert.equal(assTime(0), "0:00:00.00");
  assert.equal(assTime(61_234), "0:01:01.23");
  assert.equal(assTime(3_725_005), "1:02:05.01");
  assert.equal(srtTime(779), "00:00:00,779");
  assert.equal(srtTime(3_725_005), "01:02:05,005");
});

test("a caption's ASS start is rounded down, so it shows on the frame its start names", () => {
  // Frame 26 at 30 fps is 866.7 ms: 0.87 s would wait for frame 27.
  assert.match(buildAss([{ startMs: 866.7, endMs: 1500, text: "On time." }], { durationMs: 2000 }), /Dialogue: 0,0:00:00\.86,0:00:01\.50,Caption/);
});

test("burned in, a caption first shows on the frame its start names", { skip }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "showcase-ass-"));
  mkdirSync(join(dir, "fonts"));
  copyFileSync(join(FONTS_DIR, CAPTION_FONT_FILE), join(dir, "fonts", CAPTION_FONT_FILE));
  const fps = 30;
  // Frames 15, 26 and 41: on a whole centisecond, and two that rounding would push a frame late.
  const frames = [15, 26, 41];
  const cues = frames.map((k, i) => ({ startMs: Math.round((k * 1000 * 10) / fps) / 10, endMs: Math.round((k * 1000) / fps) + 200, text: `Cue ${i + 1}.` }));
  writeFileSync(join(dir, "c.ass"), buildAss(cues, { durationMs: 2000 }));
  await runTool(ffmpeg as string, ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", `color=c=black:s=1920x1080:r=${fps}:d=2`, "-vf", "ass=filename=c.ass:fontsdir=fonts", "-c:v", "libx264", "-qp", "0", "-pix_fmt", "yuv420p", "out.mp4"], { cwd: dir });
  const band = await bandSeries(ffmpeg as string, join(dir, "out.mp4"));
  // Over black, a short caption lifts the band's mean by about 1.
  const lit = band.map((f) => f.reduce((a, b) => a + b, 0) / f.length > 0.5);
  const firsts = lit.flatMap((on, k) => (on && !lit[k - 1] ? [k] : []));
  assert.deepEqual(firsts, frames);
});

test("the SRT: one cue per sentence, wrapped greedily at 42 characters, read back the same", () => {
  const srt = buildSrt(cues);
  assert.equal(srt, "1\n00:00:00,779 --> 00:00:03,828\nThis page checks the voice against the\npicture.\n\n2\n00:00:04,613 --> 00:00:05,725\nFlash, and beep.\n");
  assert.deepEqual(parseSrt(srt), cues);
  assert.deepEqual(srtProblems(srt, cues.map((c) => c.text), 7533), []);
});

test("the SRT check finds a missing cue, other text, an overlap and a cue past the end", () => {
  const srt = buildSrt(cues);
  assert.match(srtProblems(srt, [...cues.map((c) => c.text), "One more."], 7533).join(), /2 cues for 3 sentences/);
  assert.match(srtProblems(srt, ["Something else.", cues[1]?.text ?? ""], 7533).join(), /cue 1 reads/);
  assert.match(srtProblems(buildSrt([cues[0]!, { ...cues[1]!, startMs: 3000 }]), cues.map((c) => c.text), 7533).join(), /overlaps/);
  assert.match(srtProblems(srt, cues.map((c) => c.text), 5000).join(), /ends after the video/);
});

test("the ASS: the bundled font, pre-wrapped lines, a DRAFT watermark only on a draft, no override blocks from text", () => {
  const ass = buildAss(cues, { durationMs: 7533 });
  assert.match(ass, /PlayResX: 1920\nPlayResY: 1080/);
  assert.match(ass, /WrapStyle: 2/);
  assert.match(ass, /Style: Caption,Atkinson Hyperlegible,46,/);
  assert.match(ass, /Dialogue: 0,0:00:00\.77,0:00:03\.83,Caption,,0,0,0,,This page checks the voice against the\\Npicture\.\n/);
  assert.doesNotMatch(ass, /DRAFT/);
  assert.match(buildAss(cues, { durationMs: 7533, draft: true }), /Dialogue: 1,0:00:00\.00,0:00:07\.53,Draft,,0,0,0,,DRAFT/);
  assert.match(buildAss([{ startMs: 0, endMs: 1000, text: "Braces {\\b1} stay text." }], { durationMs: 1000 }), /Braces \(⧵b1\) stay text\./);
});
