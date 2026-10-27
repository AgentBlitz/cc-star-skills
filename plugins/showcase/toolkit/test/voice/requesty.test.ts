/**
 * The Requesty provider against a local mock server (showcase 1.1): the request it sends, wav and
 * pcm and the format fallback (remembered per model), a retried 429, and 401, 402 and 403 stopping
 * the queue with their bodies never read. Nothing here reaches the real router.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { join, resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { loadTour, resolveTour } from "../../lib/tours.ts";
import type { Tour } from "../../runtime/src/schema.ts";
import { requireFfmpeg } from "../../voice/audio.ts";
import { synthKey } from "../../voice/keys.ts";
import { manifestFile, readManifest } from "../../voice/manifest.ts";
import { run } from "../../voice/pipeline.ts";
import type { VoiceSetup } from "../../voice/setup.ts";
import { synthFake } from "../../voice/tts/fake.ts";
import { stopsQueue } from "../../voice/tts/narrator.ts";
import { createFormatMemory } from "../../voice/tts/openrouter.ts";
import { FORMAT_CHAIN, memoryKey, RequestyKeyRejected, RequestyNoCredits, requestyBase, ROUTER_BASE, synthRequesty } from "../../voice/tts/requesty.ts";
import { CANARY, scratch } from "../helpers.ts";

const MODEL = "openai/gpt-4o-mini-tts";
const REQ = { text: "Every ask from every inbox lands on one list.", provider: "requesty", model: MODEL, voice: "fable", instructions: "Warm and unhurried." };
const WAV = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVE"), Buffer.alloc(8)]);
const MP3 = Buffer.concat([Buffer.from("ID3"), Buffer.alloc(16)]);
const PCM = Buffer.alloc(4800);

interface Seen {
  method: string;
  path: string;
  auth: string | null;
  body: Record<string, unknown>;
}

type Handler = (seen: Seen, res: ServerResponse) => void;

let handler: Handler = (_s, res) => void res.writeHead(500).end();
const seen: Seen[] = [];
const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  let raw = "";
  req.on("data", (d) => (raw += d));
  req.on("end", () => {
    const s: Seen = { method: req.method ?? "", path: req.url ?? "", auth: req.headers.authorization ?? null, body: raw ? (JSON.parse(raw) as Record<string, unknown>) : {} };
    seen.push(s);
    handler(s, res);
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

/** Answers each request from `script` in order (the last answer repeats). */
function script(...answers: Handler[]): void {
  seen.length = 0;
  handler = (s, res) => (answers[Math.min(seen.length - 1, answers.length - 1)] as Handler)(s, res);
}
const audio = (bytes: Buffer, status = 200): Handler => (_s, res) => void res.writeHead(status, { "content-type": "audio/wav" }).end(bytes);
const json = (status: number, body: unknown, headers: Record<string, string> = {}): Handler => (_s, res) => void res.writeHead(status, { "content-type": "application/json", ...headers }).end(JSON.stringify(body));
const formatRefused: Handler = json(400, { error: { origin: "provider", message: "Unsupported response_format" } });
/** Headers, then a body that never ends: a client that reads it hangs, so a quick failure proves it was never read. */
const neverEnding = (status: number): Handler => (_s, res) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.write(`{"error":{"origin":"router","message":"echo ${CANARY} secret-body`);
};
const sleeps = () => {
  const waited: number[] = [];
  return { waited, sleep: async (ms: number) => void waited.push(ms) };
};

describe("Requesty provider", () => {
  it("posts the speech request to the router, the key only as the bearer token, instructions at the top level", async () => {
    script(audio(WAV));
    const r = await synthRequesty({ ...REQ, speed: 1 }, { apiKey: CANARY, formats: createFormatMemory() });
    assert.equal(r.format, "wav");
    const s = seen[0] as Seen;
    assert.equal(s.method, "POST");
    assert.equal(s.path, "/audio/speech");
    assert.equal(s.auth, `Bearer ${CANARY}`);
    assert.deepEqual(s.body, { model: MODEL, voice: "fable", input: REQ.text, response_format: "wav", instructions: "Warm and unhurried." });
    assert.equal(JSON.stringify(s.body).includes(CANARY), false);
  });

  it("falls back from wav to pcm (24 kHz, 16-bit mono, no container), and remembers it for the model", async () => {
    assert.deepEqual(FORMAT_CHAIN, ["wav", "pcm", "mp3"]);
    const formats = createFormatMemory();
    script(formatRefused, audio(PCM));
    const r = await synthRequesty(REQ, { apiKey: CANARY, formats, sleep: sleeps().sleep });
    assert.equal(r.format, "pcm");
    assert.equal(r.bytes.length, PCM.length);
    assert.deepEqual(seen.map((s) => s.body.response_format), ["wav", "pcm"]);
    assert.equal(formats.get(memoryKey(MODEL)), "pcm");
    assert.equal(formats.get(MODEL), undefined, "kept apart from an OpenRouter model of the same id");

    script(audio(PCM));
    await synthRequesty({ ...REQ, text: "Another sentence." }, { apiKey: CANARY, formats });
    assert.deepEqual(seen.map((s) => s.body.response_format), ["pcm"], "the second request goes straight to pcm");
  });

  it("walks the whole chain to mp3, and a 400 that isn't about the format is an error", async () => {
    script(formatRefused, formatRefused, audio(MP3));
    const r = await synthRequesty(REQ, { apiKey: CANARY, formats: createFormatMemory() });
    assert.equal(r.format, "mp3");
    assert.deepEqual(seen.map((s) => s.body.response_format), ["wav", "pcm", "mp3"]);

    script(json(400, { error: { origin: "router", message: `input too long for ${CANARY}` } }));
    await assert.rejects(synthRequesty(REQ, { apiKey: CANARY, formats: createFormatMemory() }), (e: Error) => /Requesty 400: input too long/.test(e.message) && !e.message.includes(CANARY));
    assert.equal(seen.length, 1);
  });

  it("retries a 429, honouring Retry-After, and 5xx at 1, 3 and 9 seconds", async () => {
    script(json(429, { error: { origin: "router", message: "slow down" } }, { "retry-after": "2" }), audio(WAV));
    const s = sleeps();
    const r = await synthRequesty(REQ, { apiKey: CANARY, formats: createFormatMemory(), sleep: s.sleep });
    assert.equal(r.format, "wav");
    assert.equal(seen.length, 2);
    assert.deepEqual(s.waited, [2000]);

    script(json(502, { error: { origin: "provider", message: "upstream" } }));
    const s2 = sleeps();
    await assert.rejects(synthRequesty(REQ, { apiKey: CANARY, formats: createFormatMemory(), sleep: s2.sleep }), /Requesty 502 after 3 retries/);
    assert.equal(seen.length, 4);
    assert.deepEqual(s2.waited, [1000, 3000, 9000]);
  });

  it("never retries 401, 403 or 402, and never reads their bodies", async () => {
    for (const [status, type] of [[401, RequestyKeyRejected], [403, RequestyKeyRejected], [402, RequestyNoCredits]] as const) {
      script(neverEnding(status));
      const s = sleeps();
      await assert.rejects(
        synthRequesty(REQ, { apiKey: CANARY, formats: createFormatMemory(), sleep: s.sleep, timeoutMs: 5_000 }),
        (e: Error) => e instanceof type && stopsQueue(e) && !e.message.includes(CANARY) && !e.message.includes("secret-body"),
      );
      assert.equal(seen.length, 1, `${status} is tried once`);
      assert.deepEqual(s.waited, []);
    }
    server.closeAllConnections();
  });

  it("only a loopback base overrides the router", () => {
    const before = process.env.SHOWCASE_REQUESTY_BASE;
    process.env.SHOWCASE_REQUESTY_BASE = "https://evil.example/v1";
    try {
      assert.deepEqual(requestyBase(), { router: ROUTER_BASE, manage: "https://api-v2.requesty.ai/v1" });
      assert.equal(ROUTER_BASE, "https://router.requesty.ai/v1");
    } finally {
      process.env.SHOWCASE_REQUESTY_BASE = before;
    }
  });

  it("the synth key covers the provider and the instructions", () => {
    const k = (over: Partial<Parameters<typeof synthKey>[0]>) => synthKey({ spoken: REQ.text, provider: "requesty", model: MODEL, voice: "fable", instructions: "Warm.", take: 0, ...over });
    assert.notEqual(k({}), k({ provider: "openrouter" }));
    assert.notEqual(k({}), k({ instructions: "Brisk." }));
    assert.equal(k({}), k({}));
  });
});

describe("Requesty in the pipeline", () => {
  const ffmpeg = requireFfmpeg();
  const FIXTURE = resolve(import.meta.dirname, "..", "..", "fixtures", "showcase");
  const tour = loadTour(resolveTour(join(FIXTURE, "tours", "fixture-tour.json"))).tour as Tour;
  const setup: VoiceSetup = {
    narrator: { provider: "requesty", model: MODEL, voice: "fable", instructions: "Warm and unhurried." },
    approved: false,
    draft: { provider: "fake", voice: "tone", rate: 0 },
    draftWarning: null,
    apiKey: CANARY,
    keyName: "REQUESTY_API_KEY",
    keys: { requesty: CANARY },
    keySource: "environment",
    keyProblem: null,
  };
  const dirs = () => {
    const root = scratch("showcase-requesty-");
    return { voiceDir: join(root, "voice"), cacheDir: join(root, "cache") };
  };

  it("voices the narrator through Requesty and names it in the manifest", async () => {
    script(async (s, res) => res.writeHead(200).end((await synthFake(ffmpeg.ffmpeg, String(s.body.input))).bytes));
    const d = dirs();
    const report = await run({ tour, lexicon: {}, setup, mode: "final", yes: true, voiceDir: d.voiceDir, cacheDir: d.cacheDir, ffmpeg, sleep: async () => {} });
    assert.ok(report.synthesised > 0);
    assert.ok(seen.every((s) => s.path === "/audio/speech" && s.body.voice === "fable" && s.body.instructions === "Warm and unhurried."));
    assert.equal(report.counts.fresh, seen.length);
    const voices = readManifest(manifestFile(d.voiceDir, tour.id))?.voices as { narrator?: Record<string, unknown> } | undefined;
    assert.deepEqual(voices?.narrator, { provider: "requesty", model: MODEL, voice: "fable", instructions: "Warm and unhurried." });
  });

  it("refuses without REQUESTY_API_KEY, naming it", async () => {
    const d = dirs();
    await assert.rejects(run({ tour, lexicon: {}, setup: { ...setup, apiKey: undefined, keys: {} }, mode: "final", yes: true, voiceDir: d.voiceDir, cacheDir: d.cacheDir, ffmpeg }), /REQUESTY_API_KEY is unset/);
    await assert.rejects(run({ tour, lexicon: {}, setup, mode: "final", voiceDir: d.voiceDir, cacheDir: d.cacheDir, ffmpeg }), /paid Requesty call/);
  });

  for (const status of [401, 402, 403]) {
    it(`a ${status} stops the queue unread: only the requests already in flight, and no manifest`, async () => {
      script((s, res) => setTimeout(() => neverEnding(status)(s, res), 20));
      const d = dirs();
      await assert.rejects(
        run({ tour, lexicon: {}, setup, mode: "final", yes: true, voiceDir: d.voiceDir, cacheDir: d.cacheDir, ffmpeg, sleep: async () => {} }),
        (e: Error) => (status === 402 ? /Requesty says the account has no credits/ : /Requesty rejected the key/).test(e.message) && !e.message.includes(CANARY) && !e.message.includes("secret-body"),
      );
      assert.ok(seen.length <= 3, `${seen.length} calls: only the in-flight three`);
      assert.equal(existsSync(manifestFile(d.voiceDir, tour.id)), false);
      server.closeAllConnections();
    });
  }
});
