/** The film's sidecars and verify step (Session 8): chapters, script.md, draft or final, sync rows and the checks. */
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { withDefaults } from "../../lib/config.ts";
import type { Project } from "../../host/project.ts";
import { captionCues, clipLeadMs, voiceInfo } from "../../film/post.ts";
import { chaptersMeta, scriptMd, timecode } from "../../film/script.ts";
import type { BeatSpan, SentenceSpan, Spans } from "../../film/timeline.ts";
import { durationTolerance, frameDiffs, isFaststart, stillName, stillTimes, syncRows, type VerifyInput, verifyChecks } from "../../film/verify.ts";
import { levels, mixdown, RATE } from "../../film/mix.ts";

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
