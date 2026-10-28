/**
 * One-take voicing (showcase 1.1): grouping steps into takes, fitting sentence boundaries to a
 * take's pauses (on synthetic takes made with `fake` and `say`, whose true pauses are known:
 * every cut within 30 ms), the slices joined reproducing the take, manifest v2 beside v1, and
 * the transcription check against a local mock of Requesty: a pass, a skipped sentence (voiced
 * again whole) and a repeated one (failing with its table). Nothing reaches the real router.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { join, resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { captionCues, speechOnsets } from "../../film/post.ts";
import { decodeMono, levels, RATE, wavFloat } from "../../film/mix.ts";
import { syncRows } from "../../film/verify.ts";
import { loadTour, resolveTour } from "../../lib/tours.ts";
import type { Tour } from "../../runtime/src/schema.ts";
import { detectPauses, fitBoundaries, mid, type Pause, parseSilences, SOFT_PAUSE_DB, slicesFor } from "../../voice/align.ts";
import { probeDurationMs, processClip, requireFfmpeg } from "../../voice/audio.ts";
import { POST } from "../../voice/keys.ts";
import { clipOnsetMs, manifestFile, parseManifest, readManifest } from "../../voice/manifest.ts";
import { plan, run, type RunOptions, type Sentence, sentencesOf, TakeCheckFailed } from "../../voice/pipeline.ts";
import type { VoiceSetup } from "../../voice/setup.ts";
import { fakeTake, groupTakes, inputLimit, takeScript, TakeTooLong } from "../../voice/takes.ts";
import { checkTake, confirmBoundaries, normaliseWords, type Word } from "../../voice/transcribe.ts";
import { findSay } from "../../voice/tts/say.ts";
import { CANARY, scratch } from "../helpers.ts";

const FIXTURE = resolve(import.meta.dirname, "..", "..", "fixtures", "showcase");
const ffmpeg = requireFfmpeg();
const tour = loadTour(resolveTour(join(FIXTURE, "tours", "fixture-tour.json"))).tour as Tour;
const SENTENCES = sentencesOf(tour, {});
const TOLERANCE_MS = 30;

const draft: VoiceSetup = { narrator: null, approved: false, draft: { provider: "fake", voice: "tone", rate: 0 }, draftWarning: null, apiKey: undefined, keyName: "OPENROUTER_API_KEY", keys: {}, keySource: null, keyProblem: null };
const requestyNarrator: VoiceSetup = {
  ...draft,
  narrator: { provider: "requesty", model: "openai/gpt-4o-mini-tts", voice: "fable", instructions: "Warm." },
  apiKey: CANARY,
  keyName: "REQUESTY_API_KEY",
  keys: { requesty: CANARY },
  keySource: "environment",
};

function dirs() {
  const root = scratch("showcase-takes-");
  return { voiceDir: join(root, "voice"), cacheDir: join(root, "cache") };
}

function opts(d: ReturnType<typeof dirs>, over: Partial<RunOptions> = {}): RunOptions {
  return { tour, lexicon: {}, setup: draft, mode: "auto", voiceDir: d.voiceDir, cacheDir: d.cacheDir, ffmpeg, takes: "tour", ...over };
}

/** Decodes any audio file to mono 16-bit samples at 24 kHz. */
function pcm(file: string): Int16Array {
  const buf = execFileSync(ffmpeg.ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", file, "-ac", "1", "-ar", "24000", "-f", "s16le", "pipe:1"], { maxBuffer: 256 * 1024 * 1024 });
  return new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2);
}

function wav16(samples: Int16Array): Buffer {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + samples.length * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(24000, 24);
  b.writeUInt32LE(48000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(samples.length * 2, 40);
  Buffer.from(samples.buffer, samples.byteOffset, samples.length * 2).copy(b, 44);
  return b;
}

/** Fits a take and returns each cut's distance from the true boundary, in ms. */
async function cutErrors(wav: string, truth: readonly number[], sentences: readonly Sentence[]): Promise<number[]> {
  const durationMs = await probeDurationMs(ffmpeg, wav);
  const pauses = await detectPauses(ffmpeg, wav, durationMs);
  const lead = pauses[0] && pauses[0].startMs === 0 ? pauses[0].endMs : 0;
  const last = pauses[pauses.length - 1];
  const tail = last && Math.abs(last.endMs - durationMs) < 1 ? last.startMs : durationMs;
  const fit = fitBoundaries({ pauses, weights: sentences.map((s) => s.spoken.length), speechStartMs: lead, speechEndMs: tail });
  assert.ok(fit, "the take has enough pauses");
  return fit.map((p, k) => Math.abs(mid(p) - (truth[k] as number)));
}

/** Whisper's stamps, in the tests that make them back to back, lag the speech by this much. */
const LAG_MS = 300;
/** Each sentence read `factor(i)` times as long as its characters say: the first five slow, the rest fast. */
const factor = (i: number) => (i < 5 ? 1.8 : 0.55);
const stretch = (s: Sentence, f: number): Sentence => ({
  ...s,
  spoken: s.spoken
    .split(",")
    .map((p) => (f >= 1 ? p + "x".repeat(Math.round(p.trim().length * (f - 1))) : p.slice(0, Math.max(2, Math.round(p.length * f)))))
    .join(","),
});
/** A fake take of these sentences whose lengths drift from their characters, so the fit drifts by seconds. */
const drifting = (sentences: readonly Sentence[]) => fakeTake(sentences.map((s, i) => stretch(s, factor(i))));

/** Word stamps that tile the take back to back, each word's end the next one's start, `LAG_MS` after the speech. */
function contiguous(texts: readonly string[], spans: readonly { startMs: number; endMs: number }[], offsetMs = 0): Word[] {
  return texts.flatMap((text, k) => {
    const from = (spans[k]?.startMs as number) + offsetMs + LAG_MS;
    const to = (k + 1 < spans.length ? (spans[k + 1]?.startMs as number) : (spans[k]?.endMs as number)) + offsetMs + LAG_MS;
    const w = text.split(/\s+/);
    return w.map((word, i) => ({ word, startMs: Math.round(from + ((to - from) * i) / w.length), endMs: Math.round(from + ((to - from) * (i + 1)) / w.length) }));
  });
}

describe("takes: grouping and the script", () => {
  it("reads the whole tour as one take, a paragraph per beat", () => {
    const [only, ...rest] = groupTakes(tour, SENTENCES, "tour", inputLimit("openai/gpt-4o-mini-tts"));
    assert.equal(rest.length, 0);
    assert.deepEqual(only?.steps, ["dashboard", "reports", "detail"]);
    assert.equal(only?.sentences.length, 10);
    assert.match(only?.script ?? "", /^Here is Ledgerly.*uses\.\n\nFirst, accept/s);
    assert.match(only?.script ?? "", /takes one click\. Choose what they can do/, "two sentences of one beat share a paragraph");
  });

  it("breaks only between steps: a take per step, or as many steps as the limit allows", () => {
    assert.deepEqual(groupTakes(tour, SENTENCES, "step", Infinity).map((g) => g.steps), [["dashboard"], ["reports"], ["detail"]]);
    const dashboard = takeScript(SENTENCES.filter((s) => ["open", "cookies", "revenue", "invite", "close-invite"].includes(s.beat))).length;
    const groups = groupTakes(tour, SENTENCES, "tour", dashboard + 5);
    assert.deepEqual(groups.map((g) => [g.id, g.steps]), [["t1", ["dashboard"]], ["t2", ["reports", "detail"]]]);
    assert.throws(() => groupTakes(tour, SENTENCES, "tour", 100), TakeTooLong);
  });

  it("knows each provider's input limit; the draft voices have none", () => {
    assert.equal(inputLimit("openai/gpt-4o-mini-tts"), 4096);
    assert.equal(inputLimit("openai/gpt-4o-mini-tts-2025-12-15"), 4096);
    assert.equal(inputLimit("elevenlabs/eleven-v3"), 3000);
    assert.equal(inputLimit("vendor/unknown"), 4096);
    assert.equal(inputLimit(null), Number.POSITIVE_INFINITY);
  });
});

describe("takes: the fit", () => {
  it("prefers the longer pause near the expected boundary, and needs one pause per boundary", () => {
    // Two sentences of equal weight in 0–4000 ms: a short pause at 1950 and a long one at 2100.
    const pauses: Pause[] = [
      { startMs: 600, endMs: 700 },
      { startMs: 1920, endMs: 1980 },
      { startMs: 1950, endMs: 2250 },
    ];
    assert.deepEqual(fitBoundaries({ pauses: [pauses[0] as Pause, pauses[2] as Pause], weights: [10, 10], speechStartMs: 0, speechEndMs: 4000 }), [pauses[2]]);
    assert.deepEqual(fitBoundaries({ pauses: [pauses[0] as Pause, pauses[1] as Pause], weights: [10, 10], speechStartMs: 0, speechEndMs: 4000 }), [pauses[1]]);
    assert.equal(fitBoundaries({ pauses: [], weights: [1, 1], speechStartMs: 0, speechEndMs: 4000 }), null);
    assert.deepEqual(fitBoundaries({ pauses, weights: [5], speechStartMs: 0, speechEndMs: 4000 }), []);
  });

  it("reads silencedetect's report, closing a silence still open at the end", () => {
    const text = "[silencedetect] silence_start: 1.2\n[silencedetect] silence_end: 1.5 | silence_duration: 0.3\n[silencedetect] silence_start: 3.9";
    assert.deepEqual(parseSilences(text, 4200), [
      { startMs: 1200, endMs: 1500 },
      { startMs: 3900, endMs: 4200 },
    ]);
  });

  it("cuts a fake take within 30 ms of every true boundary", async () => {
    const take = fakeTake(SENTENCES);
    const file = join(scratch(), "fake.wav");
    writeFileSync(file, take.wav);
    const truth = take.sentences.slice(1).map((s, k) => ((take.sentences[k] as { endMs: number }).endMs + s.startMs) / 2);
    const errors = await cutErrors(file, truth, SENTENCES);
    assert.equal(errors.length, 9);
    assert.ok(Math.max(...errors) <= TOLERANCE_MS, `cut errors ${errors.map((e) => e.toFixed(1)).join(", ")} ms`);
  });

  it("cuts a take of real speech (macOS `say`) within 30 ms of every true boundary", { skip: !findSay() && "no `say` on this machine" }, async () => {
    // Each sentence voiced alone and trimmed, then joined with known silences: 320 ms between
    // sentences and 650 ms between beats. The commas inside sentences pause too.
    const dir = scratch();
    const parts: Int16Array[] = [];
    for (const [i, s] of SENTENCES.entries()) {
      const raw = join(dir, `s${i}.wav`);
      execFileSync("/usr/bin/say", ["-v", "Daniel", "-r", "175", "--file-format=WAVE", "--data-format=LEI16@24000", "-o", raw, s.spoken]);
      const trimmed = join(dir, `t${i}.wav`);
      const trim = "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0:detection=rms:window=0.02";
      execFileSync(ffmpeg.ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-i", raw, "-af", [trim, "areverse", trim, "areverse"].join(","), trimmed]);
      parts.push(pcm(trimmed));
    }
    const gap = (ms: number) => new Int16Array(Math.round((ms * 24000) / 1000));
    const pieces: Int16Array[] = [];
    const truth: number[] = [];
    let at = 0;
    parts.forEach((p, i) => {
      if (i > 0) {
        const g = SENTENCES[i]?.beat !== SENTENCES[i - 1]?.beat ? gap(650) : gap(320);
        truth.push(((at + g.length / 2) * 1000) / 24000);
        pieces.push(g);
        at += g.length;
      }
      pieces.push(p);
      at += p.length;
    });
    const all = new Int16Array(at);
    let k = 0;
    for (const p of pieces) (all.set(p, k), (k += p.length));
    const file = join(dir, "say-take.wav");
    writeFileSync(file, wav16(all));
    const errors = await cutErrors(file, truth, SENTENCES);
    assert.ok(Math.max(...errors) <= TOLERANCE_MS, `cut errors ${errors.map((e) => e.toFixed(1)).join(", ")} ms`);
  });

  it("slices run cut to cut, so they tile the take; each onset is where its speech starts", () => {
    const b: Pause[] = [
      { startMs: 1000, endMs: 1400 },
      { startMs: 2600, endMs: 2800 },
    ];
    const s = slicesFor(b, { durationMs: 4000, speechStartMs: 30, sampleRate: 24000 });
    assert.deepEqual(s, [
      { fromMs: 0, toMs: 1200, onsetMs: 30 },
      { fromMs: 1200, toMs: 2700, onsetMs: 200 },
      { fromMs: 2700, toMs: 4000, onsetMs: 100 },
    ]);
  });
});

describe("takes: through the pipeline", () => {
  it("voices the tour as one take and writes manifest v2; the slices joined reproduce the take", async () => {
    const d = dirs();
    const report = await run(opts(d, { mode: "draft" }));
    assert.equal(report.synthesised, 1, "one call for the whole tour");
    assert.deepEqual(report.takes?.map((t) => [t.id, t.status, t.sentences]), [["t1", "voiced", 10]]);
    const m = readManifest(manifestFile(d.voiceDir, tour.id));
    assert.ok(m);
    assert.equal(m.v, 2);
    assert.equal(m.takes?.length, 1);
    assert.equal(m.takes?.[0]?.check, "unchecked");
    assert.equal(m.clips.length, 10);
    assert.ok(m.clips.every((c) => c.slice?.take === "t1" && c.synth === m.takes?.[0]?.synth && c.durationMs === Math.round((c.slice.toMs - c.slice.fromMs) as number)));

    // The processed take, rebuilt from the cached raw take, against the slices decoded and joined.
    const work = scratch();
    const raw = { bytes: readFileSync(join(d.cacheDir, `${m.takes?.[0]?.synth}.wav`)), format: "wav" as const };
    const take = await processClip(ffmpeg, raw, POST, work);
    const decoded = await Promise.all(m.clips.map((c) => decodeMono(ffmpeg.ffmpeg, join(d.voiceDir, c.file))));
    const joinedLength = decoded.reduce((n, x) => n + x.length, 0);
    const joined = new Float32Array(joinedLength);
    let at = 0;
    decoded.forEach((x, i) => {
      const from = m.clips[i]?.slice?.fromMs as number;
      assert.ok(Math.abs((at * 1000) / RATE - from) <= 50, `slice ${i} starts at ${((at * 1000) / RATE).toFixed(1)} ms in the join, ${from} ms in the take`);
      joined.set(x, at);
      at += x.length;
    });
    assert.ok(Math.abs((joinedLength * 1000) / RATE - take.durationMs) <= 50, `joined ${((joinedLength * 1000) / RATE).toFixed(1)} ms, take ${take.durationMs} ms`);
    const joinedFile = join(work, "joined.wav");
    writeFileSync(joinedFile, wavFloat(joined));
    const [a, b] = [await detectPauses(ffmpeg, take.wavPath, take.durationMs), await detectPauses(ffmpeg, joinedFile, (joinedLength * 1000) / RATE)];
    assert.equal(b.length, a.length, "the join pauses where the take does");
    a.forEach((p, i) => assert.ok(Math.abs(mid(p) - mid(b[i] as Pause)) <= 20, `pause ${i}: ${mid(p)} vs ${mid(b[i] as Pause)}`));
  });

  it("is current on a re-run; a changed sentence makes its whole take stale; --redo names a take; --dry-run reports takes", async () => {
    const d = dirs();
    await run(opts(d, { mode: "draft" }));
    const again = await run(opts(d, { mode: "draft" }));
    assert.equal(again.synthesised + again.fromCache, 0);
    assert.equal(again.counts.draft, 10);

    const edited = structuredClone(tour);
    (edited.steps[2] as { beats: { narration: string[] }[] }).beats[0]!.narration[0] = "The owner and the trend sit right there.";
    const p = plan({ ...opts(d), tour: edited, mode: "draft" });
    assert.deepEqual([p.items.filter((i) => i.status === "stale").length, p.items.filter((i) => i.status === "missing").length], [9, 1], "every sentence of the take, not one");
    assert.equal(p.takes?.filter((t) => t.job).length, 1);

    const redo = plan({ ...opts(d), mode: "draft", redo: { target: "reports" } });
    assert.equal(redo.takes?.[0]?.take, 1);
    assert.equal(redo.items.filter((i) => i.status === "stale").length, 10);
    assert.equal(plan({ ...opts(d), mode: "draft", redo: { target: "t1" } }).takes?.[0]?.take, 1);
    assert.throws(() => plan({ ...opts(d), mode: "draft", redo: { target: "t9" } }), /no take holds it/);

    const dry = await run(opts(dirs(), { mode: "draft", dryRun: true }));
    assert.deepEqual(dry.takes?.map((t) => [t.status, t.chars]), [["pending", takeScript(SENTENCES).length]]);
  });

  it("keeps v1: sentence mode still writes it, and it still loads", async () => {
    const d = dirs();
    await run(opts(d, { mode: "draft", takes: "sentence" }));
    const v1 = readManifest(manifestFile(d.voiceDir, tour.id));
    assert.equal(v1?.v, 1);
    assert.equal(v1?.takes, undefined);
    assert.equal(clipOnsetMs(v1?.clips[0] as NonNullable<typeof v1>["clips"][number], v1 as NonNullable<typeof v1>), POST.leadMs);
    const raw = JSON.parse(readFileSync(manifestFile(d.voiceDir, tour.id), "utf8")) as Record<string, unknown>;
    assert.equal(parseManifest({ ...raw, v: 3 }), null, "an unknown version isn't read");
    // Switching to takes makes every sentence stale (a new kind of clip), then writes v2.
    assert.equal(plan({ ...opts(d), mode: "draft" }).items.filter((i) => i.status === "stale").length, 10);
    await run(opts(d, { mode: "draft" }));
    assert.equal(readManifest(manifestFile(d.voiceDir, tour.id))?.v, 2);
  });

  it("starts each caption, and looks for its sound, at the slice's onset", async () => {
    const d = dirs();
    await run(opts(d, { mode: "draft" }));
    const m = JSON.parse(readFileSync(manifestFile(d.voiceDir, tour.id), "utf8"));
    const clips = (m.clips as { beat: string; n: number; hash: string; durationMs: number; slice: { onsetMs: number } }[]).slice(0, 2);
    let t = 1000;
    const sentences = clips.map((c, i) => {
      const s = { beat: c.beat, index: c.n, text: `s${i}`, audio: { hash: c.hash, durationMs: c.durationMs }, startMs: t, endMs: t + c.durationMs };
      t += c.durationMs;
      return s;
    });
    const spans = { beats: [], sentences } as unknown as Parameters<typeof captionCues>[0];
    assert.deepEqual(speechOnsets(spans, m), clips.map((c) => c.slice.onsetMs));
    assert.deepEqual(captionCues(spans, m).map((c) => c.startMs), sentences.map((s, i) => s.startMs + (clips[i]?.slice.onsetMs as number)));
    // The second slice starts with half a pause: a caption shown at its onset counts as after a blank.
    const fps = 30;
    const lv = new Float64Array(Math.ceil(t / 10) + 50).fill(-90);
    const diffs = new Array<number>(Math.ceil((t / 1000) * fps) + 10).fill(0);
    sentences.forEach((s, i) => {
      const at = s.startMs + (clips[i]?.slice.onsetMs as number);
      for (let w = Math.round(at / 10); w < Math.round(s.endMs / 10) - 5; w++) lv[w] = -20;
      for (let f = Math.ceil(at / (1000 / fps)); f < (s.endMs / 1000) * fps; f++) diffs[f] = 10;
    });
    const rows = syncRows(sentences, diffs, lv, fps, speechOnsets(spans, m));
    assert.equal(rows.length, 2);
    assert.ok(rows.every((r) => r.deltaMs !== null && Math.abs(r.deltaMs) <= 40), JSON.stringify(rows));
  });
});

describe("takes: the transcription check", () => {
  it("normalises punctuation and figures before comparing", () => {
    assert.deepEqual(normaliseWords("Revenue is tracking four per cent ahead."), ["revenue", "is", "tracking", "four", "per", "cent", "ahead"]);
    assert.deepEqual(normaliseWords("Revenue's tracking 4% ahead, of £1,250.5!"), ["revenues", "tracking", "four", "per", "cent", "ahead", "of", "one", "thousand", "two", "hundred", "fifty", "point", "five", "pounds"]);
    assert.deepEqual(normaliseWords("percent"), ["per", "cent"]);
    assert.deepEqual(normaliseWords("a hundred and five on the 21st"), normaliseWords("105 on the twenty-first"));
  });

  const words = (texts: readonly string[], gapMs = 300): Word[] => {
    let t = 0;
    return texts.flatMap((s) => {
      const out = s.split(/\s+/).map((w) => ({ word: w, startMs: (t += 50), endMs: (t += 250) }));
      t += gapMs;
      return out;
    });
  };
  const lines = ["Here is Ledgerly, the finance dashboard.", "Revenue is tracking four per cent ahead.", "Close the dialog when you're done."];

  it("passes a take read as written, allowing one misheard name", () => {
    const heard = words(["Here is Ledger Lee, the finance dashboard.", "Revenue is tracking 4% ahead.", "Close the dialog when you're done."]);
    const c = checkTake(lines, heard);
    assert.equal(c.ok, true, JSON.stringify(c.sentences));
  });

  it("finds a skipped, a repeated and a garbled sentence", () => {
    const skipped = checkTake(lines, words([lines[0] as string, lines[2] as string]));
    assert.deepEqual(skipped.sentences.map((s) => s.verdict), ["ok", "skipped", "ok"]);
    const repeated = checkTake(lines, words([lines[0] as string, lines[1] as string, lines[1] as string, lines[2] as string]));
    assert.deepEqual(repeated.sentences.map((s) => s.verdict), ["ok", "repeated", "ok"]);
    const garbled = checkTake(lines, words([lines[0] as string, "Revenue is lacking more per cent behind.", lines[2] as string]));
    assert.deepEqual(garbled.sentences.map((s) => s.verdict), ["ok", "garbled", "ok"]);
  });

  it("moves a cut the heard words disagree with to the pause between them", () => {
    const heard = words(lines, 400);
    const c = checkTake(lines, heard);
    const between = (k: number) => ({ startMs: (c.sentences[k]?.lastMs as number) + 20, endMs: (c.sentences[k + 1]?.firstMs as number) - 20 });
    const wrong: Pause = { startMs: 500, endMs: 560 };
    const out = confirmBoundaries([wrong, between(1)], [wrong, between(0), between(1)], c);
    assert.deepEqual(out.boundaries, [between(0), between(1)]);
    assert.deepEqual(out.unconfirmed, []);
  });

  it("reads a hyphenated compound and its closed form as one word, but not a number", () => {
    const line = ["Open the sign-up link, then sign in."];
    for (const said of ["Open the signup link, then sign in.", "Open the sign-up link, then sign in.", "Open the sign up link, then sign in."]) {
      const c = checkTake(line, words([said]));
      assert.deepEqual([c.ok, c.sentences[0]?.matched, c.sentences[0]?.words], [true, 7, 7], said);
    }
    assert.deepEqual(normaliseWords("the sign-up and up-to-date"), ["the", "signup", "and", "uptodate"]);
    assert.deepEqual(normaliseWords("twenty-first forty-two"), ["twenty", "first", "forty", "two"]);
  });
});

/**
 * showcase 1.1.1: the cut follows the heard words. A real narrator's take doesn't last in
 * proportion to its characters, so the fit can drift by seconds; Whisper's word stamps can run
 * back to back and lag the speech. Each cut snaps to the pause nearest the gap the heard words
 * leave between two sentences, so neither matters.
 */
describe("takes: cuts that follow the heard words", () => {
  it("snaps every cut to its pause when the fit drifts and the stamps run back to back", async () => {
    const take = drifting(SENTENCES);
    const file = join(scratch(), "drift.wav");
    writeFileSync(file, take.wav);
    const truth = take.sentences.slice(1).map((s, k) => ((take.sentences[k] as { endMs: number }).endMs + s.startMs) / 2);
    const durationMs = await probeDurationMs(ffmpeg, file);
    const pauses = await detectPauses(ffmpeg, file, durationMs);
    const fit = fitBoundaries({ pauses, weights: SENTENCES.map((s) => s.spoken.length), speechStartMs: 0, speechEndMs: durationMs });
    assert.ok(fit);
    const drift = Math.max(...fit.map((p, k) => Math.abs(mid(p) - (truth[k] as number))));
    assert.ok(drift > 1000, `the fit drifts (${drift.toFixed(0)} ms at worst)`);

    const heard = contiguous(SENTENCES.map((s) => s.spoken), take.sentences);
    assert.ok(heard.every((w, i) => i === 0 || w.startMs === heard[i - 1]?.endMs), "the stamps run back to back");
    const check = checkTake(SENTENCES.map((s) => s.spoken), heard);
    assert.equal(check.ok, true);
    const soft = await detectPauses(ffmpeg, file, durationMs, SOFT_PAUSE_DB);
    const out = confirmBoundaries(fit, pauses, check, soft);
    assert.deepEqual(out.unconfirmed, []);
    const errors = out.boundaries.map((p, k) => Math.abs(mid(p) - (truth[k] as number)));
    assert.ok(Math.max(...errors) <= TOLERANCE_MS, `cut errors ${errors.map((e) => e.toFixed(1)).join(", ")} ms`);
  });

  it("finds a pause a breath fills in the quieter pass, and starts the next sentence after the breath", async () => {
    // Two tones 500 ms apart, with a faint noise at −41 dB (under −35, over −45) in the gap:
    // filling it, or after 200 ms of silence.
    const ms = (n: number) => Math.round((n * 24000) / 1000);
    const breathFrom = (fromMs: number) => {
      const all = new Int16Array(ms(2500));
      for (let i = 0; i < ms(1000); i++) all[i] = Math.round(0.3 * 32767 * Math.sin((2 * Math.PI * 220 * i) / 24000));
      for (let i = ms(fromMs); i < ms(1500); i++) all[i] = Math.round(0.0089 * 32767 * Math.sin((2 * Math.PI * 300 * i) / 24000));
      for (let i = ms(1500); i < ms(2500); i++) all[i] = Math.round(0.3 * 32767 * Math.sin((2 * Math.PI * 220 * i) / 24000));
      const file = join(scratch(), `breath-${fromMs}.wav`);
      writeFileSync(file, wav16(all));
      return file;
    };
    const check = checkTake(["One two three.", "Four five six."], [
      { word: "One", startMs: 0, endMs: 300 },
      { word: "two", startMs: 300, endMs: 600 },
      { word: "three", startMs: 600, endMs: 1100 },
      { word: "Four", startMs: 1600, endMs: 1900 },
      { word: "five", startMs: 1900, endMs: 2200 },
      { word: "six", startMs: 2200, endMs: 2500 },
    ]);
    const near = (a: number, b: number) => Math.abs(a - b) <= TOLERANCE_MS;

    const filled = breathFrom(1000);
    assert.deepEqual(await detectPauses(ffmpeg, filled, 2500), [], "the strict pass hears the breath");
    const soft = await detectPauses(ffmpeg, filled, 2500, SOFT_PAUSE_DB);
    assert.equal(soft.length, 1);
    const out = confirmBoundaries([{ startMs: 400, endMs: 460 }], [], check, soft);
    assert.deepEqual(out.unconfirmed, []);
    assert.ok(near(mid(out.boundaries[0] as Pause), 1250), `cut at ${mid(out.boundaries[0] as Pause)} ms`);

    const after = breathFrom(1200);
    const strict = await detectPauses(ffmpeg, after, 2500);
    assert.ok(strict.length === 1 && near((strict[0] as Pause).endMs, 1200), JSON.stringify(strict));
    const widened = confirmBoundaries([{ startMs: 400, endMs: 460 }], strict, check, await detectPauses(ffmpeg, after, 2500, SOFT_PAUSE_DB));
    assert.ok(near((widened.boundaries[0] as Pause).endMs, 1500), `the next sentence starts at ${(widened.boundaries[0] as Pause).endMs} ms`);
  });

  it("keeps a fitted cut no pause confirms, and reports it; the cuts stay in order", () => {
    const lines3 = ["One two three.", "Four five six.", "Seven eight nine."];
    const heard: Word[] = lines3.flatMap((s, k) => s.split(" ").map((word, i) => ({ word, startMs: k * 3000 + i * 600, endMs: k * 3000 + (i + 1) * 600 })));
    const check = checkTake(lines3, heard);
    // The gaps the heard words leave: 1800–3000 and 4800–6000. A pause sits only in the second.
    const fitted: Pause[] = [
      { startMs: 7000, endMs: 7100 },
      { startMs: 7400, endMs: 7500 },
    ];
    const second: Pause = { startMs: 5200, endMs: 5600 };
    const out = confirmBoundaries(fitted, [second], check);
    assert.deepEqual(out.unconfirmed, [0]);
    assert.equal(out.boundaries[1], second);
    // The fitted cut for the first would fall after the second's pause, so it moves to its heard gap.
    assert.ok(mid(out.boundaries[0] as Pause) > 1800 && mid(out.boundaries[0] as Pause) < 3000, JSON.stringify(out.boundaries));
    // A fitted cut already in order stands.
    const inOrder = confirmBoundaries([{ startMs: 2000, endMs: 2100 }, fitted[1] as Pause], [second], check);
    assert.deepEqual(inOrder.boundaries, [{ startMs: 2000, endMs: 2100 }, second]);
    assert.deepEqual(inOrder.unconfirmed, [0]);
    // No pause is used twice, and every slice has length.
    const slices = slicesFor(out.boundaries, { durationMs: 9000, speechStartMs: 30, sampleRate: 24000 });
    assert.ok(slices.every((s) => s.toMs > s.fromMs), JSON.stringify(slices));
  });

  it("a pause belongs to the heard gap nearest it, so a short sentence keeps its own", () => {
    // Sentence 1 lasts under a second: the pause that ends it lies within 1 s of the gap before it too.
    const lines3 = ["One two three four.", "Five.", "Six seven eight nine."];
    const heard: Word[] = [
      ...["One", "two", "three", "four"].map((word, i) => ({ word, startMs: i * 400, endMs: (i + 1) * 400 })),
      { word: "Five", startMs: 2000, endMs: 2500 },
      ...["Six", "seven", "eight", "nine"].map((word, i) => ({ word, startMs: 3300 + i * 400, endMs: 3300 + (i + 1) * 400 })),
    ];
    const check = checkTake(lines3, heard);
    const first: Pause = { startMs: 1650, endMs: 1900 };
    const second: Pause = { startMs: 2550, endMs: 3250 };
    const out = confirmBoundaries([{ startMs: 100, endMs: 200 }, { startMs: 4000, endMs: 4100 }], [first, second], check);
    assert.deepEqual(out.boundaries, [first, second]);
    assert.deepEqual(out.unconfirmed, []);
  });
});

/**
 * A local Requesty: speech answers with a fake take of the script; transcription answers with the
 * sentences `heard(call, count)` names, in that order, each word timed inside its sentence's tone.
 */
describe("takes: voiced through a mock Requesty", () => {
  const seen: { path: string; auth: string | null; body: string }[] = [];
  let heard: (call: number, count: number) => number[] = (_c, n) => [...Array(n).keys()];
  let transcriptions = 0;
  let lastScript: string[][] = [];
  /** How the mock voices a script, and whether its word stamps run back to back. */
  let voice: (sentences: readonly Sentence[]) => ReturnType<typeof fakeTake> = (s) => fakeTake(s);
  let backToBack = false;
  const scriptOf = (input: string) => input.split("\n\n").map((p) => p.split(/(?<=[.!?])\s+/).filter(Boolean));
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on("data", (d: Buffer) => chunks.push(d));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("latin1");
      seen.push({ path: req.url ?? "", auth: req.headers.authorization ?? null, body });
      if (req.url === "/models/transcription") return void res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ data: [{ id: "openai/gpt-4o-transcribe" }, { id: "openai/whisper-1" }] }));
      if (req.url === "/audio/speech") {
        lastScript = scriptOf((JSON.parse(body) as { input: string }).input);
        const sentences = lastScript.flatMap((beat, b) => beat.map((text, n): Sentence => ({ beat: `b${b}`, n, text, spoken: text })));
        return void res.writeHead(200, { "content-type": "audio/wav" }).end(voice(sentences).wav);
      }
      if (req.url === "/audio/transcriptions") {
        const texts = lastScript.flat();
        const spans = voice(lastScript.flatMap((beat, b) => beat.map((text, n): Sentence => ({ beat: `b${b}`, n, text, spoken: text })))).sentences;
        if (backToBack) {
          transcriptions++;
          const said = contiguous(texts, spans, POST.leadMs).map((w) => ({ word: w.word, start: w.startMs / 1000, end: w.endMs / 1000 }));
          return void res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ text: texts.join(" "), words: said }));
        }
        const said = heard(transcriptions++, texts.length).flatMap((k) => {
          const w = (texts[k] as string).split(/\s+/);
          const span = spans[k] as { startMs: number; endMs: number };
          const step = (span.endMs - span.startMs) / w.length;
          // The processed take opens with the 30 ms lead.
          return w.map((word, i) => ({ word, start: (POST.leadMs + span.startMs + i * step) / 1000, end: (POST.leadMs + span.startMs + (i + 1) * step) / 1000 }));
        });
        return void res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ text: said.map((w) => w.word).join(" "), words: said }));
      }
      res.writeHead(404).end();
    });
  });
  before(async () => {
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    process.env.SHOWCASE_REQUESTY_BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(() => {
    delete process.env.SHOWCASE_REQUESTY_BASE;
    server.closeAllConnections();
    server.close();
  });
  const reset = (fn: typeof heard, o: { voice?: typeof voice; backToBack?: boolean } = {}) => {
    seen.length = 0;
    transcriptions = 0;
    heard = fn;
    voice = o.voice ?? ((s) => fakeTake(s));
    backToBack = o.backToBack ?? false;
  };
  const speechCalls = () => seen.filter((s) => s.path === "/audio/speech").length;

  it("passes a take read as written: one call, one transcription, the check recorded", async () => {
    reset((_c, n) => [...Array(n).keys()]);
    const d = dirs();
    const report = await run(opts(d, { setup: requestyNarrator, mode: "final", yes: true, retryDelaysMs: [] }));
    assert.equal(speechCalls(), 1);
    assert.deepEqual(report.warnings.filter((w) => w.startsWith("take")), [], "every cut is confirmed by the heard words");
    const t = seen.find((s) => s.path === "/audio/transcriptions");
    assert.ok(t);
    assert.equal(t.auth, `Bearer ${CANARY}`);
    for (const field of ['name="model"\r\n\r\nopenai/whisper-1', 'name="response_format"\r\n\r\nverbose_json', 'name="timestamp_granularities[]"\r\n\r\nword']) assert.ok(t.body.includes(field), field);
    assert.equal(report.takes?.[0]?.check, "passed");
    const m = readManifest(manifestFile(d.voiceDir, tour.id));
    assert.deepEqual([m?.takes?.[0]?.check, m?.takes?.[0]?.model, m?.takes?.[0]?.take], ["passed", "openai/whisper-1", 0]);
    assert.ok(m?.clips.every((c) => c.voice === "narrator"));
    // The transcript is cached with the raw take: the next run pays for nothing.
    const again = await run(opts(d, { setup: requestyNarrator, mode: "final", yes: true }));
    assert.equal(again.synthesised + again.fromCache, 0);
    assert.equal(speechCalls(), 1);
    assert.ok(existsSync(d.cacheDir));
  });

  it("voices a take that skipped a sentence again, whole, as a new take", async () => {
    reset((call, n) => [...Array(n).keys()].filter((i) => call > 0 || i !== 3));
    const d = dirs();
    const report = await run(opts(d, { setup: requestyNarrator, mode: "final", yes: true, retryDelaysMs: [] }));
    assert.equal(speechCalls(), 2);
    assert.equal(report.charsSent, 2 * takeScript(SENTENCES).length, "the retake counts against --max-chars");
    assert.deepEqual([report.takes?.[0]?.attempts, report.takes?.[0]?.take, report.takes?.[0]?.check], [2, 1, "passed"]);
    assert.equal(readManifest(manifestFile(d.voiceDir, tour.id))?.takes?.[0]?.take, 1);
    assert.equal(plan(opts(d, { setup: requestyNarrator, mode: "final" })).items.every((i) => i.status === "fresh"), true);
  });

  it("fails a take that repeats a sentence every time, after two retakes, with a per-sentence table", async () => {
    reset((_c, n) => [0, 1, 2, 3, 4, 4, ...[...Array(n).keys()].slice(5)]);
    const d = dirs();
    await assert.rejects(
      run(opts(d, { setup: requestyNarrator, mode: "final", yes: true, retryDelaysMs: [] })),
      (e: Error) => e instanceof TakeCheckFailed && /after 3 takes/.test(e.message) && /invite\/1\s+repeated/.test(e.message) && /open\/0\s+ok/.test(e.message),
    );
    assert.equal(speechCalls(), 3);
    assert.equal(existsSync(manifestFile(d.voiceDir, tour.id)), false, "nothing is written for a take that failed");
  });

  it("cuts a drifting take where its sentences are heard, from stamps that run back to back", async () => {
    reset((_c, n) => [...Array(n).keys()], { voice: drifting, backToBack: true });
    const d = dirs();
    const report = await run(opts(d, { setup: requestyNarrator, mode: "final", yes: true, retryDelaysMs: [] }));
    assert.deepEqual(report.warnings.filter((w) => w.startsWith("take")), [], "every cut is confirmed by the heard words");
    const m = readManifest(manifestFile(d.voiceDir, tour.id));
    assert.equal(m?.takes?.[0]?.check, "passed");
    assert.equal(m?.takes?.[0]?.unconfirmed, undefined);
    // Where each sentence's tone starts in the processed take (after the 30 ms lead), against its slice's onset.
    const truth = drifting(SENTENCES).sentences.map((s) => s.startMs + POST.leadMs);
    const errors = (m?.clips ?? []).map((c, i) => Math.abs((c.slice?.fromMs as number) + (c.slice?.onsetMs as number) - (truth[i] as number)));
    assert.equal(errors.length, SENTENCES.length);
    assert.ok(Math.max(...errors) <= TOLERANCE_MS, `onset errors ${errors.join(", ")} ms`);
  });

  it("stops retaking at --max-chars", async () => {
    reset((_c, n) => [...Array(n).keys()].slice(1));
    const d = dirs();
    const chars = takeScript(SENTENCES).length;
    await assert.rejects(run(opts(d, { setup: requestyNarrator, mode: "final", yes: true, maxChars: chars + 10, retryDelaysMs: [] })), /would pass --max-chars/);
    assert.equal(speechCalls(), 1);
  });
});
