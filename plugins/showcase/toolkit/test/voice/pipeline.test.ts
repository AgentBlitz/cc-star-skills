/**
 * The voice pipeline end to end on the fixture tour, through real ffmpeg: the fake provider
 * (draft clips measure mono, 24 kHz, −16 ± 1 LUFS), staleness (a new sentence, a changed post
 * setting), the raw cache, the three-at-a-time pool, the paid-work guards and the canary key.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";
import { loadConfig } from "../../lib/config.ts";
import { loadTour, resolveTour } from "../../lib/tours.ts";
import type { Tour } from "../../runtime/src/schema.ts";
import { decodeMono, levels, onsetMs } from "../../film/mix.ts";
import { measureLufs, probeChannelsAndRate, processClip, requireFfmpeg } from "../../voice/audio.ts";
import { POST } from "../../voice/keys.ts";
import { manifestFile, readManifest } from "../../voice/manifest.ts";
import { type Mode, pacing, plan, run, type RunOptions, VoiceRefusal } from "../../voice/pipeline.ts";
import { loadSetup, type VoiceSetup } from "../../voice/setup.ts";
import { synthFake } from "../../voice/tts/fake.ts";
import { findSay } from "../../voice/tts/say.ts";
import { CANARY, scratch } from "../helpers.ts";

const FIXTURE = resolve(import.meta.dirname, "..", "..", "fixtures", "showcase");
const ffmpeg = requireFfmpeg();
const base = loadTour(resolveTour(join(FIXTURE, "tours", "fixture-tour.json"))).tour as Tour;
const SENTENCES = base.steps.flatMap((s) => s.beats).flatMap((b) => b.narration ?? []).length;

const draftOnly: VoiceSetup = { narrator: null, approved: false, draft: { provider: "fake", voice: "tone", rate: 0 }, draftWarning: null, apiKey: undefined, keyName: "OPENROUTER_API_KEY", keys: {}, keySource: null, keyProblem: null };
const narrator: VoiceSetup = { ...draftOnly, narrator: { provider: "openrouter", model: "vendor/model-a", voice: "v" }, apiKey: CANARY, keys: { openrouter: CANARY }, keySource: "environment" };

function dirs() {
  const root = scratch("showcase-voice-");
  return { voiceDir: join(root, "voice"), cacheDir: join(root, "cache") };
}

function opts(d: ReturnType<typeof dirs>, over: Partial<RunOptions> = {}): RunOptions {
  return { tour: base, lexicon: {}, setup: draftOnly, mode: "auto" as Mode, voiceDir: d.voiceDir, cacheDir: d.cacheDir, ffmpeg, ...over };
}

function editedTour(text: string): Tour {
  const t = structuredClone(base);
  (t.steps[0] as { beats: { narration: string[] }[] }).beats[0]!.narration[0] = text;
  return t;
}

/** A fetch that voices the request's text with the fake tone, `delayMs` late, tracking how many are in flight. */
function narratorFetch(delayMs = 0) {
  const state = { calls: 0, inFlight: 0, peak: 0, bodies: [] as string[] };
  const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
    state.calls++;
    state.inFlight++;
    state.peak = Math.max(state.peak, state.inFlight);
    const body = JSON.parse(String(init?.body)) as { input: string };
    state.bodies.push(String(init?.body));
    try {
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      const tone = await synthFake(ffmpeg.ffmpeg, body.input);
      return new Response(tone.bytes, { status: 200 });
    } finally {
      state.inFlight--;
    }
  }) as typeof fetch;
  return { fetchImpl, state };
}

function everyFileText(dir: string): string {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => readFileSync(join(e.parentPath, e.name)).toString("latin1"))
    .join("\n");
}

describe("voice pipeline, draft voice through real ffmpeg", () => {
  it("makes mono 24 kHz clips at −16 ± 1 LUFS and a sorted, timestamp-free manifest", async () => {
    const d = dirs();
    const lexicon = { Ledgerly: "Ledger Lee" };
    const report = await run(opts(d, { lexicon, mode: "draft" }));
    assert.equal(report.synthesised, SENTENCES);
    assert.equal(report.counts.draft, SENTENCES);

    const m = readManifest(manifestFile(d.voiceDir, base.id));
    assert.ok(m);
    assert.equal(m.clips.length, SENTENCES);
    for (const c of m.clips) {
      const file = join(d.voiceDir, c.file);
      const { channels, sampleRate } = await probeChannelsAndRate(ffmpeg, file);
      assert.deepEqual([channels, sampleRate], [1, 24000], c.file);
      const lufs = await measureLufs(ffmpeg, file);
      assert.ok(Math.abs(lufs - -16) <= 1, `${c.file} measures ${lufs} LUFS`);
      // The fake tone lasts chars ÷ 16 s (at least 0.5 s), plus the 30 ms lead and 80 ms tail.
      const spoken = c.spoken ?? c.text;
      assert.ok(Math.abs(c.durationMs - (Math.max(0.5, spoken.length / 16) * 1000 + 110)) < 120, `${c.file}: ${c.durationMs} ms for ${spoken.length} chars`);
      assert.equal(c.hash, c.file.replace(/\.mp3$/, ""));
    }
    // `spoken` is stored only where the lexicon changed the text; the caption text stays as written.
    const opening = m.clips.find((c) => c.beat === "open");
    assert.equal(opening?.spoken, "Here is Ledger Lee, the finance dashboard your team already uses.");
    assert.match(opening?.text ?? "", /Ledgerly/);
    assert.deepEqual(m.clips.filter((c) => c.spoken !== undefined).map((c) => c.beat), ["open", "close"], "the two sentences that say Ledgerly");
    assert.equal(m.narrationMs, m.clips.reduce((n, c) => n + c.durationMs, 0));

    const text = readFileSync(manifestFile(d.voiceDir, base.id), "utf8");
    const keys = (o: unknown): string[] => (o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => [k, ...keys(v)]) : []);
    const top = Object.keys(JSON.parse(text));
    assert.deepEqual(top, [...top].sort());
    assert.equal(/\d{4}-\d{2}-\d{2}T/.test(text), false, "no timestamps");
    assert.ok(keys(JSON.parse(text)).includes("synth"));
  });

  it("a second run changes nothing, and stays quiet about it", async () => {
    const d = dirs();
    await run(opts(d, { mode: "draft" }));
    const before = readFileSync(manifestFile(d.voiceDir, base.id), "utf8");
    const again = await run(opts(d, { mode: "draft" }));
    assert.equal(again.synthesised + again.fromCache, 0);
    assert.equal(readFileSync(manifestFile(d.voiceDir, base.id), "utf8"), before);
  });

  it("editing a sentence flips --check to missing", async () => {
    const d = dirs();
    await run(opts(d, { mode: "draft" }));
    const clean = await run(opts(d, { mode: "draft", check: true }));
    assert.equal(clean.ok, true);
    assert.equal(clean.counts.draft, SENTENCES);

    const edited = await run(opts(d, { mode: "draft", check: true, tour: editedTour("Here is Ledgerly, rewritten.") }));
    assert.equal(edited.ok, false);
    assert.equal(edited.counts.missing, 1);
    assert.equal(edited.items.find((i) => i.status === "missing")?.beat, "open");
    assert.equal(edited.synthesised, 0, "--check never synthesises");
  });

  it("changing a post-processing setting makes every clip stale and re-processes from the raw cache", async () => {
    const d = dirs();
    await run(opts(d, { mode: "draft" }));
    const quieter = { ...POST, lufs: -20 };
    const stale = await run(opts(d, { mode: "draft", check: true, post: quieter }));
    assert.equal(stale.counts.stale, SENTENCES, "same words and voice, different post settings");

    const redone = await run(opts(d, { mode: "draft", post: quieter }));
    assert.equal(redone.fromCache, SENTENCES, "no new synthesis: the raw audio is cached");
    assert.equal(redone.synthesised, 0);
    const m = readManifest(manifestFile(d.voiceDir, base.id));
    assert.equal((m?.post as { lufs: number }).lufs, -20);
    const first = m?.clips[0];
    assert.ok(first);
    assert.ok(Math.abs((await measureLufs(ffmpeg, join(d.voiceDir, first.file))) - -20) <= 1);

    // The old clips are orphans now; --prune removes exactly those.
    const dry = await run(opts(d, { mode: "draft", post: quieter, prune: true, dryRun: true }));
    assert.equal(dry.pruned.length, 0);
    const pruned = await run(opts(d, { mode: "draft", post: quieter, prune: true }));
    assert.equal(pruned.pruned.length, SENTENCES);
    assert.equal(readdirSync(d.voiceDir).filter((f) => f.endsWith(".mp3")).length, SENTENCES);
  });

  it("--redo voices one sentence again as a new take", async () => {
    const d = dirs();
    await run(opts(d, { mode: "draft" }));
    const before = readManifest(manifestFile(d.voiceDir, base.id))?.clips ?? [];
    const report = await run(opts(d, { mode: "draft", redo: { beat: "invite", n: 1 } }));
    assert.equal(report.synthesised, 1);
    const after = readManifest(manifestFile(d.voiceDir, base.id))?.clips ?? [];
    const changed = after.filter((c, i) => c.file !== before[i]?.file);
    assert.deepEqual(changed.map((c) => [c.beat, c.n, c.take]), [["invite", 1, 1]]);
    await assert.rejects(run(opts(d, { mode: "draft", redo: { beat: "invite", n: 9 } })), VoiceRefusal);
  });

  it("falls back to the fake off macOS, with a warning", () => {
    const config = loadConfig(FIXTURE);
    assert.equal(findSay("linux"), null);
    const setup = loadSetup(config, { say: null, env: {}, cwd: scratch() });
    assert.equal(setup.draft.provider, "fake");
    assert.match(setup.draftWarning ?? "", /`say` isn't available/);
    const p = plan({ tour: base, lexicon: {}, setup, mode: "auto", voiceDir: "/nonexistent", cacheDir: "/nonexistent" });
    assert.equal(p.warnings.length, 1);
  });
});

describe("voice pipeline, narrator over a mocked OpenRouter", () => {
  it("runs three requests at a time", async () => {
    const d = dirs();
    const { fetchImpl, state } = narratorFetch(60);
    const report = await run(opts(d, { setup: narrator, mode: "final", yes: true, fetchImpl, sleep: async () => {} }));
    assert.equal(state.calls, SENTENCES);
    assert.equal(state.peak, 3, "three in flight, never more");
    assert.equal(report.counts.fresh, SENTENCES);
    assert.ok(report.charsSent > 0);
    assert.equal(readManifest(manifestFile(d.voiceDir, base.id))?.clips.every((c) => c.voice === "narrator"), true);
    // The canary key is sent as the bearer token only: it is in no file, no report, no log line.
    const lines: string[] = [];
    await run(opts(d, { setup: narrator, mode: "final", yes: true, fetchImpl, say: (l) => lines.push(l) }));
    const everything = JSON.stringify(report) + lines.join("\n") + everyFileText(d.voiceDir) + everyFileText(d.cacheDir);
    assert.equal(everything.includes(CANARY), false);
    assert.equal(state.bodies.some((b) => b.includes(CANARY)), false);
  });

  it("refuses paid work without --yes and over --max-chars, and a dry run spends nothing", async () => {
    const d = dirs();
    const { fetchImpl, state } = narratorFetch();
    await assert.rejects(run(opts(d, { setup: narrator, mode: "final", fetchImpl })), (e: Error) => e instanceof VoiceRefusal && /--yes/.test(e.message));
    await assert.rejects(run(opts(d, { setup: narrator, mode: "final", yes: true, maxChars: 50, fetchImpl })), (e: Error) => e instanceof VoiceRefusal && /--max-chars 50/.test(e.message));
    const dry = await run(opts(d, { setup: narrator, mode: "final", dryRun: true, fetchImpl }));
    assert.equal(dry.manifest, null);
    assert.equal(existsSync(d.voiceDir), false, "a dry run writes nothing");
    assert.equal(state.calls, 0);
    // The draft voice is free: no --yes needed.
    await run(opts(d, { setup: narrator, mode: "draft", fetchImpl }));
    assert.equal(state.calls, 0);
  });

  it("--final needs a narrator and a key, and says which is missing", async () => {
    const d = dirs();
    await assert.rejects(run(opts(d, { setup: draftOnly, mode: "final" })), /no narrator/);
    await assert.rejects(run(opts(d, { setup: { ...narrator, apiKey: undefined }, mode: "final" })), /OPENROUTER_API_KEY is unset/);
  });

  it("without the key, an auto run keeps fresh narrator clips and voices only what is missing as draft", async () => {
    const d = dirs();
    const { fetchImpl } = narratorFetch();
    await run(opts(d, { setup: narrator, mode: "final", yes: true, fetchImpl }));
    const keyless = { ...narrator, apiKey: undefined };
    const check = await run(opts(d, { setup: keyless, check: true }));
    assert.equal(check.ok, true, "--check needs no key");
    assert.equal(check.counts.fresh, SENTENCES);
    // A new sentence is voiced as a draft, and the narrator's clips are untouched.
    const report = await run(opts(d, { setup: keyless, tour: editedTour("A different opening line for the film.") }));
    assert.equal(report.synthesised, 1);
    assert.ok(report.warnings.some((w) => /OPENROUTER_API_KEY is unset/.test(w)));
    const clips = readManifest(manifestFile(d.voiceDir, base.id))?.clips ?? [];
    assert.deepEqual(clips.map((c) => c.voice).sort(), [...Array(SENTENCES - 1).fill("narrator"), "draft"].sort());
    // `--final --check` fails while a draft clip remains.
    const finalCheck = await run(opts(d, { setup: keyless, tour: editedTour("A different opening line for the film."), check: true, mode: "final" }));
    assert.equal(finalCheck.ok, false);
  });

  it("stops at a rejected key without spending the rest of the queue, and writes no manifest", async () => {
    const d = dirs();
    const calls: string[] = [];
    const fetchImpl = (async () => {
      calls.push("call");
      await new Promise((r) => setTimeout(r, 20));
      return new Response(`{"error":"${CANARY}"}`, { status: 401 });
    }) as typeof fetch;
    await assert.rejects(run(opts(d, { setup: narrator, mode: "final", yes: true, fetchImpl })), (e: Error) => /rejected the key/.test(e.message) && !e.message.includes(CANARY));
    assert.ok(calls.length <= 3, `${calls.length} calls: only the in-flight three`);
    assert.equal(existsSync(manifestFile(d.voiceDir, base.id)), false);
  });
});

describe("pacing", () => {
  it("warns outside 120–185 wpm and outside the preset's window", () => {
    const p = plan({ tour: base, lexicon: {}, setup: draftOnly, mode: "draft", voiceDir: "/nonexistent", cacheDir: "/nonexistent" });
    const first = p.items[0];
    assert.ok(first);
    const durations = new Map(p.items.map((i) => [i, 1000] as const)); // every sentence in one second: far too fast
    const table = pacing({ ...base, meta: { ...base.meta, length: { targetSec: 60, narration: { min: 48, max: 54 } } } }, p.items, durations);
    assert.ok(table.rows.filter((r) => r.words >= 4).every((r) => r.note?.startsWith("fast")));
    assert.ok(table.warnings.some((w) => /outside the 48–54 s window/.test(w)));
    assert.equal(table.rows.every((r) => !r.estimated), true);
  });
});

describe("the processing chain", () => {
  it("trims through a click before the first word, so the clip starts with the speech", async () => {
    const paths = requireFfmpeg();
    const work = scratch("showcase-trim-");
    // A faint 3 ms click (peak -47 dBFS: over a -50 dB peak trim, under it as a 20 ms RMS), 240 ms
    // of quiet, then the "word": the shape of a Gemini clip's start.
    const rate = 24000;
    const pcm = new Int16Array(Math.round(rate * 0.8));
    for (let i = Math.round(rate * 0.02); i < Math.round(rate * 0.023); i++) pcm[i] = 150;
    for (let i = Math.round(rate * 0.265); i < pcm.length; i++) pcm[i] = Math.round(8000 * Math.sin((2 * Math.PI * 220 * i) / rate));
    const out = await processClip(paths, { bytes: Buffer.from(pcm.buffer), format: "pcm" }, POST, work);
    const lv = levels(await decodeMono(paths.ffmpeg, out.wavPath));
    const onset = onsetMs(lv, 0, 1000);
    assert.ok(onset !== null && onset <= POST.leadMs + 60, `speech starts at ${onset} ms (lead ${POST.leadMs} ms)`);
  });
});
