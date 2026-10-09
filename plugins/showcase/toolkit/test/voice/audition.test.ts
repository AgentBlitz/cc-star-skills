/**
 * `voice --audition` (PLAN §2.4): the page lists three lines per voice on the British shortlist
 * plus the draft voice, stays inside its character budget, and spends nothing without the key.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";
import { loadTour, resolveTour } from "../../lib/tours.ts";
import type { Tour } from "../../runtime/src/schema.ts";
import { requireFfmpeg } from "../../voice/audio.ts";
import { audition, AUDITION_MAX_CHARS, pickSamples, SHORTLIST } from "../../voice/audition.ts";
import type { SpeechModel } from "../../voice/catalogue.ts";
import { sentencesOf } from "../../voice/pipeline.ts";
import type { VoiceSetup } from "../../voice/setup.ts";
import { synthFake } from "../../voice/tts/fake.ts";
import { CANARY, scratch } from "../helpers.ts";

const FIXTURE = resolve(import.meta.dirname, "..", "..", "fixtures", "showcase");
const ffmpeg = requireFfmpeg();
const tour = loadTour(resolveTour(join(FIXTURE, "tours", "fixture-tour.json"))).tour as Tour;
const sentences = sentencesOf(tour, {});
const keyless: VoiceSetup = { narrator: null, approved: false, draft: { provider: "fake", voice: "tone", rate: 0 }, draftWarning: null, apiKey: undefined, keySource: null, keyProblem: null };
const keyed: VoiceSetup = { ...keyless, apiKey: CANARY, keySource: "environment" };

describe("the shortlist", () => {
  it("is the British shortlist of PLAN §2.4: four ElevenLabs, two MAI, three Gemini", () => {
    assert.equal(SHORTLIST.length, 9);
    assert.deepEqual(SHORTLIST.filter((c) => c.model.startsWith("elevenlabs/")).map((c) => c.voice), ["george", "daniel", "alice", "lily"]);
    assert.deepEqual(SHORTLIST.filter((c) => c.model.startsWith("microsoft/")).map((c) => c.voice.split(":")[0]), ["en-GB-Harry", "en-GB-Emily"]);
    assert.deepEqual(SHORTLIST.filter((c) => c.model.startsWith("google/")).map((c) => c.voice), ["Charon", "Orus", "Kore"]);
    assert.equal(new Set(SHORTLIST.map((c) => c.id)).size, SHORTLIST.length);
  });
});

describe("pickSamples", () => {
  it("takes the opening, the line with the most figures and the closing", () => {
    const s = pickSamples(sentences, 0, AUDITION_MAX_CHARS);
    assert.deepEqual(s.map((x) => x.key), ["opening", "figures", "closing"]);
    assert.equal(s[0]?.text, sentences[0]?.spoken);
    assert.equal(s[2]?.text, sentences.at(-1)?.spoken);
  });

  it("falls back to the shortest lines that fit the budget, and refuses when none does", () => {
    const nine = pickSamples(sentences, 9, AUDITION_MAX_CHARS);
    assert.ok(nine.reduce((n, x) => n + x.text.length, 0) * 9 <= AUDITION_MAX_CHARS);
    assert.ok(nine.length >= 1);
    assert.throws(() => pickSamples(sentences, 9, 100), /raise --max-chars/);
  });
});

describe("audition", () => {
  const offeredCatalogue: SpeechModel[] = [
    { id: "elevenlabs/eleven-v3", name: "v3", voices: ["george", "daniel", "alice", "lily"] },
    { id: "microsoft/mai-voice-2.1", name: "mai", voices: ["en-GB-Harry:MAI-Voice-2.1"] },
    { id: "google/gemini-3.8-flash-tts", name: "gemini", voices: ["Charon", "Orus", "Kore"] },
  ];

  it("without a key, writes the page with only the draft voice voiced", async () => {
    const root = scratch("showcase-audition-");
    const r = await audition({ sentences, title: "Ledgerly", outDir: join(root, "voices"), cacheDir: join(root, "cache"), setup: keyless, ffmpeg, yes: false, maxChars: AUDITION_MAX_CHARS });
    assert.equal(r.paid, false);
    assert.equal(r.charsSent, 0);
    const html = readFileSync(r.file, "utf8");
    assert.match(html, /No OPENROUTER_API_KEY/);
    for (const c of SHORTLIST) assert.ok(html.includes(c.id), c.id);
    const draft = r.voices.find((v) => v.id === "draft");
    assert.ok(draft?.clips.every((c) => c && existsSync(join(root, "voices", c))));
    assert.ok(r.voices.filter((v) => v.id !== "draft").every((v) => v.skipped === "no OPENROUTER_API_KEY"));
  });

  it("with a key, refuses without --yes, then stays inside the character budget", async () => {
    const root = scratch("showcase-audition-");
    const requests: { model: string; voice: string; input: string }[] = [];
    const fetchImpl = (async (_u: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { model: string; voice: string; input: string };
      requests.push(body);
      return new Response((await synthFake(ffmpeg.ffmpeg, body.input)).bytes, { status: 200 });
    }) as typeof fetch;
    const o = { sentences, title: "Ledgerly", outDir: join(root, "voices"), cacheDir: join(root, "cache"), setup: keyed, ffmpeg, maxChars: AUDITION_MAX_CHARS, fetchImpl, sleep: async () => {} };
    await assert.rejects(audition({ ...o, yes: false }), /pass --yes/);
    assert.equal(requests.length, 0);

    const r = await audition({ ...o, yes: true });
    assert.ok(r.charsSent > 0 && r.charsSent <= AUDITION_MAX_CHARS, `${r.charsSent} characters`);
    assert.equal(requests.reduce((n, q) => n + q.input.length, 0), r.charsSent);
    assert.equal(new Set(requests.map((q) => `${q.model}/${q.voice}`)).size, SHORTLIST.length);
    assert.equal(requests.some((q) => JSON.stringify(q).includes(CANARY)), false);
    assert.ok(existsSync(r.file));
    assert.equal(readFileSync(r.file, "utf8").includes(CANARY), false);

    // A second page costs nothing: the raw audio is cached.
    const before = requests.length;
    const again = await audition({ ...o, yes: true });
    assert.equal(requests.length, before);
    assert.equal(again.charsSent, 0);
  });

  it("skips shortlisted voices the catalogue doesn't offer, unspent", async () => {
    const root = scratch("showcase-audition-");
    const requests: string[] = [];
    const fetchImpl = (async (_u: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { voice: string; input: string };
      requests.push(body.voice);
      return new Response((await synthFake(ffmpeg.ffmpeg, body.input)).bytes, { status: 200 });
    }) as typeof fetch;
    const r = await audition({ sentences, title: "Ledgerly", outDir: join(root, "voices"), cacheDir: join(root, "cache"), setup: keyed, ffmpeg, catalogue: offeredCatalogue, yes: true, maxChars: AUDITION_MAX_CHARS, fetchImpl, sleep: async () => {} });
    assert.ok(!requests.some((v) => v.startsWith("en-GB-Emily")), "Emily isn't in this catalogue");
    assert.match(r.voices.find((v) => v.id === "mai-emily")?.skipped ?? "", /not in the catalogue/);
  });
});
