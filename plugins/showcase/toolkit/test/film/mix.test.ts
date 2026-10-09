/** The film's sound (Session 8): the mixdown, the WAV, loudnorm and ebur128 parsing, silences and onsets. */
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { findFfmpeg } from "../../lib/ffmpeg.ts";
import { decodeMono, levels, longestInnerSilence, measureLoudness, mixdown, normalise, onsetMs, parseEbur128, parseLoudnorm, RATE, wavFloat } from "../../film/mix.ts";

const tone = (ms: number, amp = 0.5) => Float32Array.from({ length: Math.round((ms * RATE) / 1000) }, (_, i) => amp * Math.sin((2 * Math.PI * 440 * i) / RATE));

test("the mixdown places each clip at its start and sums overlaps; the buffer is exactly the video's length", () => {
  const one = new Float32Array([0.25, 0.25, 0.25]);
  const out = mixdown([{ samples: one, atMs: 0 }, { samples: one, atMs: 1000 / RATE }, { samples: one, atMs: 999.98 }], 1000);
  assert.equal(out.length, RATE);
  assert.deepEqual([...out.slice(0, 4)], [0.25, 0.5, 0.5, 0.25]);
  assert.equal(out[RATE - 1], 0.25, "a clip past the end is cut, not an error");
});

test("the float WAV round-trips through ffmpeg sample for sample", async () => {
  const { ffmpeg } = findFfmpeg();
  assert.ok(ffmpeg);
  const dir = mkdtempSync(join(tmpdir(), "showcase-mix-"));
  const s = tone(200);
  const wav = join(dir, "t.wav");
  writeFileSync(wav, wavFloat(s));
  assert.equal(wavFloat(s).toString("latin1", 0, 4), "RIFF");
  const back = await decodeMono(ffmpeg, wav);
  assert.equal(back.length, s.length);
  assert.ok(Math.abs((back[100] as number) - (s[100] as number)) < 1e-6);
});

test("two-pass loudnorm lands a quiet mix at −16 LUFS, 48 kHz stereo, with headroom", async () => {
  const { ffmpeg } = findFfmpeg();
  assert.ok(ffmpeg);
  const dir = mkdtempSync(join(tmpdir(), "showcase-mix-"));
  const quiet = mixdown([{ samples: tone(1500, 0.05), atMs: 200 }, { samples: tone(1500, 0.05), atMs: 2500 }], 4500);
  writeFileSync(join(dir, "mix.wav"), wavFloat(quiet));
  const m = await normalise(ffmpeg, join(dir, "mix.wav"), join(dir, "audio.wav"));
  assert.ok(m && Number(m.input_i) < -25);
  const l = await measureLoudness(ffmpeg, join(dir, "audio.wav"));
  assert.ok(l.integratedLufs !== null && Math.abs(l.integratedLufs + 16) <= 1, `${l.integratedLufs} LUFS`);
  assert.ok(l.truePeakDb !== null && l.truePeakDb <= -1, `${l.truePeakDb} dBTP`);
});

test("parsing loudnorm's measurement and ebur128's summary", () => {
  const m = parseLoudnorm('[Parsed_loudnorm_0 @ 0x1]\n{\n\t"input_i" : "-17.49",\n\t"input_tp" : "-11.61",\n\t"input_lra" : "4.40",\n\t"input_thresh" : "-27.49",\n\t"target_offset" : "-0.04"\n}\n');
  assert.equal(m.input_i, "-17.49");
  assert.throws(() => parseLoudnorm("nothing"), /no measurement/);
  const summary = "[Parsed_ebur128_0 @ 0x1] Summary:\n\n  Integrated loudness:\n    I:         -21.8 LUFS\n    Threshold: -31.8 LUFS\n\n  Loudness range:\n    LRA:        20.0 LU\n\n  True peak:\n    Peak:      -18.1 dBFS\n";
  assert.deepEqual(parseEbur128(summary), { integratedLufs: -21.8, truePeakDb: -18.1, lra: 20 });
  assert.deepEqual(parseEbur128("no summary"), { integratedLufs: null, truePeakDb: null, lra: null });
});

test("silences count only between the first sound and the last; onsets are found from a time on", () => {
  const s = mixdown([{ samples: tone(500), atMs: 1000 }, { samples: tone(500), atMs: 4500 }], 8000);
  const lv = levels(s);
  const gap = longestInnerSilence(lv);
  assert.equal(gap.ms, 3000);
  assert.equal(gap.atMs, 1500);
  assert.equal(onsetMs(lv, 950, 1400), 1000);
  assert.equal(onsetMs(lv, 1600, 4000), null);
  assert.deepEqual(longestInnerSilence(levels(new Float32Array(RATE))), { ms: 0, atMs: null });
});
