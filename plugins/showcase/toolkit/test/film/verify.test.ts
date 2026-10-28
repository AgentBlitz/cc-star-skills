/** The film's sidecars and verify step (Session 8): chapters, script.md, draft or final, sync rows and the checks. */
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { withDefaults } from "../../lib/config.ts";
import type { Project } from "../../host/project.ts";
import { captionCues, clipLeadMs, speechOnsets, voiceInfo } from "../../film/post.ts";
import { chaptersMeta, scriptMd, timecode } from "../../film/script.ts";
import type { BeatSpan, SentenceSpan, Spans } from "../../film/timeline.ts";
import { durationTolerance, frameDiffs, isFaststart, stillName, stillTimes, syncRows, type VerifyInput, verifyChecks } from "../../film/verify.ts";
import { levels, mixdown, RATE, speechStartMs } from "../../film/mix.ts";

const beats: BeatSpan[] = [
  { beat: "open", index: 0, step: "a", kind: "card", title: "Hello", startMs: 750, endMs: 4000, narrationMs: 3000, waitedMs: 0 },
  { beat: "show", index: 1, step: "a", kind: "screen", startMs: 4000, endMs: 9000, narrationMs: 4000, waitedMs: 0 },
];
const sentences: SentenceSpan[] = [
  { beat: "open", index: 0, text: "Hello there.", audio: { hash: "h1", durationMs: 2000 }, startMs: 800, endMs: 2800 },
  { beat: "show", index: 0, text: "Look at this.", audio: { hash: "h2", durationMs: 2000 }, startMs: 4500, endMs: 6500 },
  { beat: "show", index: 1, text: "And this.", audio: null, startMs: 6500, endMs: 8100 },
];
const spans = (s: SentenceSpan[] = sentences): Spans => ({ events: [], beats, sentences: s, navs: [], startMs: 750, endMs: 9000 });

test("chapters tile the film, one per beat, in milliseconds", () => {
  const meta = chaptersMeta(beats, 10_200, "A = film; yes");
  assert.match(meta, /^;FFMETADATA1\ntitle=A \\= film\\; yes\n/);
  assert.match(meta, /\[CHAPTER\]\nTIMEBASE=1\/1000\nSTART=750\nEND=4000\ntitle=01 Hello · open/);
  assert.match(meta, /START=4000\nEND=10200\ntitle=02 show/);
});

test("script.md: a header, then each beat's timecode and its sentences", () => {
  assert.equal(timecode(61_250), "1:01.3");
  const md = scriptMd({ tour: "t", title: "The film", durationMs: 10_200, voice: "the draft voice (say, Daniel)", draft: true, video: "t-draft.mp4", at: "2026-10-09" }, beats, sentences);
  assert.match(md, /^# The film\n/);
  assert.match(md, /- \*\*Voice:\*\* the draft voice \(say, Daniel\) — \*\*draft\*\* \(watermarked\)/);
  assert.match(md, /## 01 · open — Hello\n\n0:00\.8–0:04\.0 · card · 3\.3 s, 2\.0 s spoken, 1\.3 s held/);
  assert.match(md, /\| 0:06\.5 \| And this\. _\(no clip: reading time\)_ \| 1\.6 \|/);
});

const project = (narrator?: { model: string; voice: string; approved?: string | false }): Project => ({
  showcaseDir: null,
  root: "/",
  config: withDefaults({ showcase: 1, app: { url: "http://127.0.0.1" }, ...(narrator ? { voice: { narrator, draft: { provider: "say" }, lexicon: {}, dir: "v" } } : {}) } as never),
});
const manifest = (role: "narrator" | "draft") => ({
  v: 1 as const,
  id: "m",
  tour: "t",
  clips: [
    { beat: "open", text: "Hello there.", hash: "h1", file: "a.mp3", durationMs: 2000, voice: role, n: 0, take: 0, synth: "s" },
    { beat: "show", text: "Look at this.", hash: "h2", file: "b.mp3", durationMs: 2000, voice: role, n: 0, take: 0, synth: "s" },
  ],
  voices: { draft: { provider: "say", voice: "Daniel" } },
});

test("draft or final: final only when the approved narrator speaks every sentence", () => {
  const voiced = sentences.slice(0, 2);
  const approved = { model: "m", voice: "george", approved: "2026-10-09" };
  assert.deepEqual(voiceInfo(project(approved), manifest("narrator"), spans(voiced)), { draft: false, label: "the narrator (m, george)", reasons: [] });
  assert.deepEqual(voiceInfo(project({ ...approved, approved: false }), manifest("narrator"), spans(voiced)).reasons, ["the narrator isn't approved yet (voice.narrator.approved)"]);
  const d = voiceInfo(project(), manifest("draft"), spans());
  assert.equal(d.draft, true);
  assert.equal(d.label, "the draft voice (say, Daniel)");
  assert.deepEqual(d.reasons, ["1 sentence(s) have no clip", "the draft voice speaks", "no narrator is chosen (voice.narrator)"]);
  assert.equal(voiceInfo(project(), null, spans(sentences.map((s) => ({ ...s, audio: null })))).label, "no voice (reading time)");
});

test("sync rows: a caption after a blank, found by the band difference, against the first sound", () => {
  const fps = 30;
  const diffs = Array.from({ length: 300 }, (_, k) => ((k >= 24 && k < 84) || (k >= 135 && k < 243) ? 20 : 0.5));
  const lv = levels(mixdown([{ samples: new Float32Array(RATE * 2).fill(0.2), atMs: 830 }, { samples: new Float32Array(RATE * 2).fill(0.2), atMs: 4530 }], 10_000));
  const rows = syncRows(sentences, diffs, lv, fps);
  assert.equal(rows.length, 2, "the third sentence follows the second with no blank");
  assert.deepEqual(rows[0], { beat: "open", index: 0, startMs: 800, captionMs: 800, audioMs: 830, deltaMs: 30 });
  assert.deepEqual(rows[1], { beat: "show", index: 0, startMs: 4500, captionMs: 4500, audioMs: 4530, deltaMs: 30 });
  const a = [Float64Array.from([10, 10]), Float64Array.from([0, 0])];
  assert.deepEqual(frameDiffs(a, [Float64Array.from([12, 8]), Float64Array.from([0, 4])]), [2, 2]);
});

// Session 7's master (28 October): after loudness normalisation, the 50–150 ms before a
// sentence's speech is breath and room tone at −37 to −50 dB, and the speech starts at −8 to
// −30 dB. A −45 dB onset found the breath, so a caption on the speech read 57–93 ms late.
const breathy = (speechMs: number, o: { breathFrom?: number; soundFrom?: number } = {}) => {
  const lv = new Float64Array(400).fill(-90);
  for (let w = (o.breathFrom ?? speechMs - 150) / 10; w < speechMs / 10; w++) lv[w] = w % 2 ? -40 : -44;
  for (let w = (o.soundFrom ?? speechMs) / 10; w < 300; w++) lv[w] = -20;
  return lv;
};
const one = (startMs: number, onset: number) => ({ s: [{ beat: "b", index: 0, text: "s", audio: { hash: "h", durationMs: 2000 }, startMs, endMs: startMs + 2000 }], onsets: [onset] });

test("sync rows: breath before the speech isn't its sound; the caption on the speech's nearest frame is in sync", () => {
  const fps = 30;
  // The speech starts at 1030 ms; the caption shows on frame 31 (1033.3 ms), the nearest.
  const diffs = Array.from({ length: 120 }, (_, k) => (k >= 31 ? 20 : 0.5));
  const { s, onsets } = one(830, 200);
  const [row] = syncRows(s, diffs, breathy(1030), fps, onsets);
  assert.equal(row?.audioMs, 1030, JSON.stringify(row));
  assert.equal(row?.captionMs, 1033.3);
  assert.ok(Math.abs(row?.deltaMs as number) <= 1000 / fps / 2, JSON.stringify(row));
});

test("sync rows: a sound that starts early is measured early, not where the search starts", () => {
  const fps = 30;
  const diffs = Array.from({ length: 120 }, (_, k) => (k >= 31 ? 20 : 0.5));
  const { s, onsets } = one(830, 200);
  // The voice starts 80 ms before the caption's onset says: more than the limit, and reported.
  const [row] = syncRows(s, diffs, breathy(1030, { breathFrom: 850, soundFrom: 950 }), fps, onsets);
  assert.equal(row?.audioMs, 950, JSON.stringify(row));
  assert.ok((row?.deltaMs as number) < -50, JSON.stringify(row));
});

// Session 7b's first strict film (28 October): some clips open with 100–320 ms of breath, or a
// lip click, between the end of the pause (the clip's recorded onset) and the first word. The
// breath runs at −36 to −45 dB with single windows up to −34, a click reaches −32 for a window
// or two, and the word rises past −25 dB at once.
const opensSoftly = () => {
  const lv = new Float64Array(1000).fill(-90);
  for (let w = 81; w < 110; w++) lv[w] = w % 3 ? -40 : -36; // breath from 810 ms
  lv[90] = -32; // a lip click at 900 ms
  lv[104] = -34; // a loud breath at 1040 ms, more than 50 ms before the word
  lv[105] = -38;
  for (let w = 110; w < 280; w++) lv[w] = -18; // "When…" from 1100 ms
  for (let w = 451; w < 650; w++) lv[w] = -18; // the second sentence from 4510 ms
  return lv;
};

test("speech starts where the voice does: past a breath or a click, on a soft start that rises at once", () => {
  const lv = opensSoftly();
  assert.equal(speechStartMs(lv, 800, 2800), 1100);
  // A start at −30 dB that is voiced within 50 ms (a soft consonant) counts from its first window.
  const soft = opensSoftly();
  soft[108] = -30;
  soft[109] = -29;
  assert.equal(speechStartMs(soft, 800, 2800), 1080);
  assert.equal(speechStartMs(lv, 3000, 4000), null);
});

test("a caption starts on its speech, not on the breath or click its clip opens with", () => {
  const fps = 30;
  const m = { ...manifest("draft"), post: { leadMs: 10 } };
  // From the clip's onset (810 ms) the voice starts at 1100 ms: frame 33. The second at 4510 ms: frame 135 (4500 ms).
  assert.deepEqual(captionCues(spans(), m, fps, opensSoftly()).map((c) => c.startMs), [1100, 4500, 6500]);
  assert.deepEqual(speechOnsets(spans(), m, opensSoftly()), [300, 10, 0]);
  // With no speech found (a silent mix), the clip's own onset stands.
  assert.deepEqual(speechOnsets(spans(), m, new Float64Array(1000).fill(-90)), [10, 10, 0]);
  // And the sync row measures the same speech: in sync, not 290 ms late.
  const diffs = Array.from({ length: 300 }, (_, k) => ((k >= 33 && k < 84) || k >= 135 ? 20 : 0.5));
  const [row] = syncRows(sentences, diffs, opensSoftly(), fps, speechOnsets(spans(), m, opensSoftly()));
  assert.deepEqual([row?.captionMs, row?.audioMs, row?.deltaMs], [1100, 1100, 0]);
});

test("sync rows: a caption is looked for after the one before it ends, not on it", () => {
  const fps = 30;
  // Two sentences back to back; the second's speech starts 60 ms in (2860 ms, nearest frame 86).
  const s: SentenceSpan[] = [
    { beat: "a", index: 0, text: "One.", audio: { hash: "h1", durationMs: 2000 }, startMs: 800, endMs: 2800 },
    { beat: "a", index: 1, text: "Two.", audio: { hash: "h2", durationMs: 2000 }, startMs: 2800, endMs: 4800 },
  ];
  const diffs = Array.from({ length: 150 }, (_, k) => ((k >= 24 && k < 84) || k >= 86 ? 20 : 0.5));
  const lv = new Float64Array(500).fill(-90);
  for (let w = 80; w < 270; w++) lv[w] = -18;
  for (let w = 286; w < 470; w++) lv[w] = -18;
  const rows = syncRows(s, diffs, lv, fps, [0, 60]);
  assert.deepEqual(rows[1], { beat: "a", index: 1, startMs: 2800, captionMs: 2866.7, audioMs: 2860, deltaMs: -6.7 });
});

test("caption cues start on the frame nearest their speech, never before the cue they follow", () => {
  const fps = 30;
  const m = { ...manifest("draft"), post: { leadMs: 5 } };
  // 805 ms is nearest frame 24 (800 ms); 4505 ms nearest frame 135 (4500 ms).
  assert.deepEqual(captionCues(spans(), m, fps).map((c) => [c.startMs, c.endMs]), [[800, 2800], [4500, 6500], [6500, 8100]]);
  // 821 ms rounds up to frame 25 (833.3 ms).
  const later = { ...m, post: { leadMs: 21 } };
  assert.deepEqual(captionCues(spans(), later, fps)[0]?.startMs, 833.3);
  // Back to back: 2815 ms is nearest frame 84 (2800 ms), before the last cue ends at 2810.
  const close = [{ ...(sentences[0] as SentenceSpan), endMs: 2810 }, { ...(sentences[1] as SentenceSpan), startMs: 2810 }];
  assert.equal(captionCues(spans(close), m, fps)[1]?.startMs, 2810);
});

test("stills: just before each beat's last sentence ends, else its end", () => {
  assert.deepEqual(stillTimes(beats, sentences), [2650, 7950]);
  assert.deepEqual(stillTimes(beats, []), [3850, 8850]);
  assert.equal(stillName(0, "close-invite"), "01-close-invite.png");
});

test("faststart: moov before mdat", () => {
  const dir = mkdtempSync(join(tmpdir(), "showcase-mp4-"));
  const box = (type: string, n = 16) => {
    const b = Buffer.alloc(n);
    b.writeUInt32BE(n, 0);
    b.write(type, 4, "latin1");
    return b;
  };
  writeFileSync(join(dir, "a.mp4"), Buffer.concat([box("ftyp"), box("moov"), box("mdat")]));
  writeFileSync(join(dir, "b.mp4"), Buffer.concat([box("ftyp"), box("mdat"), box("moov")]));
  assert.equal(isFaststart(join(dir, "a.mp4")), true);
  assert.equal(isFaststart(join(dir, "b.mp4")), false);
});

const input = (o: Partial<VerifyInput> = {}): VerifyInput => ({
  durationMs: 40_000,
  targetSec: 40,
  measured: { loudness: { integratedLufs: -16.1, truePeakDb: -4, lra: 5 }, silence: { ms: 1200, atMs: 10_000 }, sync: [{ beat: "a", index: 0, startMs: 800, captionMs: 800, audioMs: 830, deltaMs: 30 }] },
  srtProblems: [],
  sentenceCount: 3,
  missingClips: [],
  silentSentences: 0,
  master: { audioCodec: "aac", sampleRate: 48_000, channels: 2, chapters: 2, durationSec: 40 },
  faststart: true,
  beats: 2,
  deny: { file: "r", present: true, clean: true, stale: false, at: "2026-10-09" },
  ...o,
});
const level = (v: VerifyInput, id: string) => verifyChecks(v).find((c) => c.id === id)?.level;

test("the checks: every §2.5 item, warnings and failures where they belong", () => {
  assert.deepEqual(verifyChecks(input()).filter((c) => c.level !== "ok"), []);
  assert.equal(durationTolerance(40), 5);
  assert.equal(durationTolerance(120), 12);
  assert.equal(level(input({ durationMs: 46_000 }), "duration-target"), "warn");
  assert.equal(level(input({ measured: { ...input().measured, loudness: { integratedLufs: -18, truePeakDb: -0.5, lra: 5 } } }), "loudness"), "warn");
  assert.equal(level(input({ measured: { ...input().measured, loudness: { integratedLufs: -16, truePeakDb: -0.5, lra: 5 } } }), "true-peak"), "warn");
  assert.equal(level(input({ measured: { ...input().measured, silence: { ms: 2600, atMs: 1 } } }), "silence"), "warn");
  assert.equal(level(input({ measured: { ...input().measured, sync: [{ beat: "a", index: 0, startMs: 0, captionMs: 0, audioMs: 60, deltaMs: 60 }] } }), "av-sync"), "warn");
  assert.equal(level(input({ measured: { ...input().measured, sync: [] } }), "av-sync"), "warn");
  assert.equal(level(input({ srtProblems: ["2 cues for 3 sentences"] }), "srt"), "fail");
  assert.equal(level(input({ silentSentences: 1 }), "voiced"), "warn");
  assert.equal(level(input({ master: { ...input().master, channels: 1 } }), "audio"), "fail");
  assert.equal(level(input({ faststart: false }), "faststart"), "fail");
  assert.equal(level(input({ beats: 3 }), "chapters"), "fail");
  assert.equal(level(input({ deny: { file: "r", present: false, clean: null, stale: false, at: null } }), "deny-list"), "warn");
  assert.equal(level(input({ deny: { file: "r", present: true, clean: false, stale: false, at: "x" } }), "deny-list"), "fail");
  assert.equal(level(input({ deny: { file: "r", present: true, clean: true, stale: true, at: "x" } }), "deny-list"), "warn");
});

test("a voiced caption starts after its clip's lead; an unvoiced one at its sentence", () => {
  const m = { ...manifest("draft"), post: { leadMs: 30 } };
  assert.equal(clipLeadMs(m), 30);
  assert.equal(clipLeadMs(manifest("draft")), 0, "a hand-made manifest has no post settings");
  assert.deepEqual(captionCues(spans(), m).map((c) => [c.startMs, c.endMs]), [[830, 2800], [4530, 6500], [6500, 8100]]);
});
