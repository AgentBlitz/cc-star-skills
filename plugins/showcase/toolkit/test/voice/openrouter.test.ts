/**
 * The OpenRouter provider against a mocked `fetch` (PLAN §2.4): the format chain is remembered per
 * model, 429 honours `Retry-After`, a thrown fetch is retried, 401 and 402 are never retried and
 * never echoed, and a canary key never reaches an error message.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createFormatMemory, FORMAT_CHAIN, OpenRouterKeyRejected, OpenRouterNoCredits, retryAfterMs, synthOpenRouter } from "../../voice/tts/openrouter.ts";
import { CANARY } from "../helpers.ts";

const REQ = { text: "Hello there.", provider: "openrouter", model: "vendor/model-a", voice: "v" };
const WAV = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVE"), Buffer.alloc(8)]);

interface Call {
  format: string;
  model: string;
  auth: string | null;
}

/** A fetch that answers from `script` in order and records each call. */
function mockFetch(script: ((call: Call) => Response | Error)[]): { fetchImpl: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { response_format: string; model: string };
    const call: Call = { format: body.response_format, model: body.model, auth: new Headers(init?.headers).get("authorization") };
    calls.push(call);
    const next = script[Math.min(calls.length - 1, script.length - 1)];
    if (!next) throw new Error("no script");
    const out = next(call);
    if (out instanceof Error) throw out;
    return out;
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const ok = () => new Response(WAV, { status: 200 });
const formatError = () => new Response(JSON.stringify({ error: { message: "Unsupported response_format" } }), { status: 400 });
const sleeps = () => {
  const waited: number[] = [];
  return { waited, sleep: async (ms: number) => void waited.push(ms) };
};

describe("OpenRouter provider", () => {
  it("remembers the working format per model, so only the first sentence probes the chain", async () => {
    const formats = createFormatMemory();
    // A model that only takes pcm: wav and mp3 are refused, pcm works.
    const script = [formatError, formatError, () => new Response(Buffer.alloc(64), { status: 200 })];
    const first = mockFetch(script);
    const r1 = await synthOpenRouter({ ...REQ, model: "google/pcm-only" }, { apiKey: CANARY, fetchImpl: first.fetchImpl, formats, sleep: sleeps().sleep });
    assert.equal(r1.format, "pcm");
    assert.deepEqual(first.calls.map((c) => c.format), ["wav", "mp3", "pcm"]);
    assert.equal(formats.get("google/pcm-only"), "pcm");

    const second = mockFetch([() => new Response(Buffer.alloc(64), { status: 200 })]);
    await synthOpenRouter({ ...REQ, model: "google/pcm-only", text: "Another sentence." }, { apiKey: CANARY, fetchImpl: second.fetchImpl, formats, sleep: sleeps().sleep });
    assert.deepEqual(second.calls.map((c) => c.format), ["pcm"], "the second sentence goes straight to pcm");

    // Another model is not affected: it starts at the top of the chain.
    const other = mockFetch([ok]);
    await synthOpenRouter({ ...REQ, model: "vendor/other" }, { apiKey: CANARY, fetchImpl: other.fetchImpl, formats, sleep: sleeps().sleep });
    assert.deepEqual(other.calls.map((c) => c.format), ["wav"]);
    assert.deepEqual(FORMAT_CHAIN, ["wav", "mp3", "pcm"]);
  });

  it("a 400 that isn't about the format is an error, not a format change", async () => {
    const { fetchImpl, calls } = mockFetch([() => new Response("bad voice", { status: 400 })]);
    await assert.rejects(synthOpenRouter(REQ, { apiKey: CANARY, fetchImpl, formats: createFormatMemory(), sleep: sleeps().sleep }), /OpenRouter 400: bad voice/);
    assert.equal(calls.length, 1);
  });

  it("honours Retry-After on a 429, then falls back to 1, 3 and 9 seconds", async () => {
    const a = mockFetch([() => new Response("slow down", { status: 429, headers: { "retry-after": "7" } }), ok]);
    const s1 = sleeps();
    await synthOpenRouter(REQ, { apiKey: CANARY, fetchImpl: a.fetchImpl, formats: createFormatMemory(), sleep: s1.sleep });
    assert.deepEqual(s1.waited, [7000]);

    const b = mockFetch([() => new Response("", { status: 503 })]);
    const s2 = sleeps();
    await assert.rejects(synthOpenRouter(REQ, { apiKey: CANARY, fetchImpl: b.fetchImpl, formats: createFormatMemory(), sleep: s2.sleep }), /503 after 3 retries/);
    assert.deepEqual(s2.waited, [1000, 3000, 9000]);
    assert.equal(b.calls.length, 4);
  });

  it("reads Retry-After as seconds or as a date, and caps it", () => {
    assert.equal(retryAfterMs("2"), 2000);
    assert.equal(retryAfterMs(new Date(10_000).toUTCString(), 4_000), 6000);
    assert.equal(retryAfterMs("100000"), 120_000);
    assert.equal(retryAfterMs("soon"), null);
    assert.equal(retryAfterMs(null), null);
  });

  it("retries a thrown fetch (network error, timeout), then gives up with a redacted message", async () => {
    const flaky = mockFetch([() => new TypeError("fetch failed"), () => new DOMException("The operation timed out", "TimeoutError"), ok]);
    const s1 = sleeps();
    const r = await synthOpenRouter(REQ, { apiKey: CANARY, fetchImpl: flaky.fetchImpl, formats: createFormatMemory(), sleep: s1.sleep });
    assert.equal(r.format, "wav");
    assert.deepEqual(s1.waited, [1000, 3000]);

    const down = mockFetch([() => new TypeError(`connect ECONNREFUSED while sending Bearer ${CANARY}`)]);
    const s2 = sleeps();
    await assert.rejects(
      synthOpenRouter(REQ, { apiKey: CANARY, fetchImpl: down.fetchImpl, formats: createFormatMemory(), sleep: s2.sleep }),
      (e: Error) => /after 3 retries/.test(e.message) && !e.message.includes(CANARY),
    );
    assert.deepEqual(s2.waited, [1000, 3000, 9000]);
  });

  it("never retries 401, 403 or 402, and never echoes their bodies", async () => {
    for (const [status, type] of [[401, OpenRouterKeyRejected], [403, OpenRouterKeyRejected], [402, OpenRouterNoCredits]] as const) {
      const { fetchImpl, calls } = mockFetch([() => new Response(`{"error":"echo ${CANARY} secret-body"}`, { status })]);
      const s = sleeps();
      await assert.rejects(
        synthOpenRouter(REQ, { apiKey: CANARY, fetchImpl, formats: createFormatMemory(), sleep: s.sleep }),
        (e: Error) => e instanceof type && !e.message.includes(CANARY) && !e.message.includes("secret-body"),
      );
      assert.equal(calls.length, 1, `${status} is tried once`);
      assert.deepEqual(s.waited, []);
    }
  });

  it("redacts the key from an error body that echoes it", async () => {
    const { fetchImpl } = mockFetch([() => new Response(`upstream said: key ${CANARY} invalid`, { status: 422 })]);
    await assert.rejects(
      synthOpenRouter(REQ, { apiKey: CANARY, fetchImpl, formats: createFormatMemory(), sleep: sleeps().sleep }),
      (e: Error) => /OpenRouter 422/.test(e.message) && !e.message.includes(CANARY),
    );
  });

  it("sends the key only as the bearer token, and the speed and instructions when set", async () => {
    let seen: { headers: Headers; body: Record<string, unknown> } | null = null;
    const fetchImpl = (async (_u: unknown, init?: RequestInit) => {
      seen = { headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) as Record<string, unknown> };
      return ok();
    }) as typeof fetch;
    await synthOpenRouter({ ...REQ, model: "openai/gpt-x", speed: 1.1, instructions: "calm" }, { apiKey: CANARY, fetchImpl, formats: createFormatMemory() });
    const s = seen as unknown as { headers: Headers; body: Record<string, unknown> };
    assert.equal(s.headers.get("authorization"), `Bearer ${CANARY}`);
    assert.equal(JSON.stringify(s.body).includes(CANARY), false);
    assert.equal(s.body.speed, 1.1);
    assert.deepEqual(s.body.provider, { options: { openai: { instructions: "calm" } } });
  });
});
