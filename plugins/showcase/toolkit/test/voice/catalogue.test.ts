import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchCatalogue, fetchRequestyCatalogue, OPENAI_TTS_VOICES, offered } from "../../voice/catalogue.ts";

const body = {
  data: [
    { id: "z/model", name: "Z", supported_voices: ["a", "b"] },
    { id: "a/model", supported_voices: [] },
    { id: 7 },
  ],
};

describe("catalogue", () => {
  it("parses the public listing, sorted, tolerating missing voices and bad rows", async () => {
    const fetchImpl = (async () => new Response(JSON.stringify(body), { status: 200 })) as typeof fetch;
    const c = await fetchCatalogue(fetchImpl);
    assert.deepEqual(c.map((m) => m.id), ["a/model", "z/model"]);
    assert.deepEqual(c[1]?.voices, ["a", "b"]);
    assert.equal(c[0]?.name, "a/model");
    assert.deepEqual(offered(c, "z/model", "a"), { model: true, voice: true });
    assert.deepEqual(offered(c, "z/model", "x"), { model: true, voice: false });
    assert.deepEqual(offered(c, "a/model", "anything"), { model: true, voice: true }, "no voices listed: any voice");
    assert.deepEqual(offered(c, "nope", "a"), { model: false, voice: false });
  });

  it("sends no Authorization header (no key is needed)", async () => {
    let init: RequestInit | undefined;
    const fetchImpl = (async (_u: unknown, i?: RequestInit) => {
      init = i;
      return new Response(JSON.stringify(body), { status: 200 });
    }) as typeof fetch;
    await fetchCatalogue(fetchImpl);
    assert.equal(new Headers(init?.headers).has("authorization"), false);
  });

  it("fails clearly on an error status", async () => {
    await assert.rejects(fetchCatalogue((async () => new Response("", { status: 503 })) as typeof fetch), /returned 503/);
  });
});

describe("Requesty's catalogue", () => {
  const listing = { object: "list", data: [{ api: "speech", id: "openai/tts-1" }, { api: "speech", id: "openai/gpt-4o-mini-tts" }, { api: "speech", id: "openai/gpt-4o-mini-tts-2025-12-15" }, { id: null }] };

  it("lists the speech models, with OpenAI's thirteen voices for gpt-4o-mini-tts, and sends no key", async () => {
    let seen: { url: string; init: RequestInit | undefined } | null = null;
    const fetchImpl = (async (u: unknown, init?: RequestInit) => {
      seen = { url: String(u), init };
      return new Response(JSON.stringify(listing), { status: 200 });
    }) as typeof fetch;
    const c = await fetchRequestyCatalogue(fetchImpl);
    const s = seen as unknown as { url: string; init: RequestInit | undefined };
    assert.equal(s.url, "https://router.requesty.ai/v1/models/speech");
    assert.equal(new Headers(s.init?.headers).has("authorization"), false);
    assert.deepEqual(c.map((m) => m.id), ["openai/gpt-4o-mini-tts", "openai/gpt-4o-mini-tts-2025-12-15", "openai/tts-1"]);
    assert.equal(OPENAI_TTS_VOICES.length, 13);
    assert.deepEqual(c[0]?.voices, [...OPENAI_TTS_VOICES]);
    assert.ok(c[0]?.voices.includes("fable") && c[0]?.voices.includes("marin") && c[0]?.voices.includes("cedar"));
    assert.deepEqual(offered(c, "openai/gpt-4o-mini-tts", "fable"), { model: true, voice: true });
    assert.deepEqual(offered(c, "openai/gpt-4o-mini-tts", "george"), { model: true, voice: false });
  });

  it("fails clearly on an error status", async () => {
    await assert.rejects(fetchRequestyCatalogue((async () => new Response("", { status: 500 })) as typeof fetch), /Requesty's catalogue returned 500/);
  });
});
