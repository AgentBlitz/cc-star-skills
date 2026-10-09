import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchCatalogue, offered } from "../../voice/catalogue.ts";

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
