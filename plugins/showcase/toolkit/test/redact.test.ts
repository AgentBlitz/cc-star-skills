import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, it } from "node:test";
import { describeError, redact, registerSecret } from "../lib/redact.ts";
import { CANARY, cli, scratch, userConfig } from "./helpers.ts";

describe("redact", () => {
  it("masks registered values, Bearer, authorization and key params", () => {
    registerSecret(CANARY);
    const out = redact(`x ${CANARY} Bearer abc.def authorization: hunter2 url?key=k1&api_key=k2&token=k3`);
    assert.ok(!out.includes(CANARY));
    assert.ok(!/abc\.def|hunter2|k1|k2|k3/.test(out), out);
  });

  it("ignores values shorter than 6 characters", () => {
    assert.equal(redact("abc", ["abc"]), "abc");
  });

  it("describes a thrown error without the secret", () => {
    registerSecret(CANARY);
    const e = Object.assign(new Error(`upstream said ${CANARY}`), { statusCode: 401 });
    const d = describeError(e);
    assert.match(d, /^Error 401: /);
    assert.ok(!d.includes(CANARY));
  });
});

/** A loopback stand-in for OpenRouter that echoes the key back in different ways. */
async function echoServer(mode: "error-body" | "bad-json"): Promise<{ base: string; close: () => void }> {
  const server = createServer((req, res) => {
    const auth = String(req.headers.authorization ?? "");
    if (mode === "error-body") {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: `bad key ${auth.replace("Bearer ", "")} (${auth})` } }));
    } else {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(`{"data": ${auth.replace("Bearer ", "")}`);
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  return { base: `http://127.0.0.1:${port}`, close: () => server.close() };
}

describe("the canary never reaches stdout or stderr", () => {
  for (const mode of ["error-body", "bad-json"] as const) {
    it(`keys test, server ${mode}`, async () => {
      const srv = await echoServer(mode);
      try {
        const r = await cli(["keys", "test"], {
          env: { OPENROUTER_API_KEY: CANARY, SHOWCASE_OPENROUTER_BASE: srv.base, SHOWCASE_CONFIG_DIR: scratch() },
        });
        assert.equal(r.code, 1);
        assert.ok(!(r.stdout + r.stderr).includes(CANARY), r.stdout + r.stderr);
        assert.ok(!(r.stdout + r.stderr).includes("CANARY"), r.stdout + r.stderr);
        assert.ok(r.stderr.length > 0);
      } finally {
        srv.close();
      }
    });
  }

  it("keys test prints only the safe fields on success", async () => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ data: { label: "sk-or-v1-CANARY...def", creator_user_id: "user_x", usage: 1.5, limit: null, is_free_tier: false } }));
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address() as AddressInfo;
    try {
      const r = await cli(["keys", "test", "--json"], {
        env: { SHOWCASE_OPENROUTER_BASE: `http://127.0.0.1:${port}`, SHOWCASE_CONFIG_DIR: userConfig(`OPENROUTER_API_KEY=${CANARY}\n`) },
      });
      assert.equal(r.code, 0, r.stderr);
      const out = JSON.parse(r.stdout) as { source: string; key: Record<string, unknown> };
      assert.equal(out.source, "user file");
      assert.deepEqual(out.key, { is_free_tier: false, limit: null, usage: 1.5 });
      assert.ok(!r.stdout.includes("CANARY") && !r.stdout.includes("user_x"));
    } finally {
      server.close();
    }
  });

  it("ignores a non-loopback endpoint override", async () => {
    const { keyEndpoint } = await import("../commands/keys.ts");
    const before = process.env.SHOWCASE_OPENROUTER_BASE;
    process.env.SHOWCASE_OPENROUTER_BASE = "https://evil.example/api";
    try {
      assert.equal(keyEndpoint(), "https://openrouter.ai/api/v1/key");
    } finally {
      if (before === undefined) delete process.env.SHOWCASE_OPENROUTER_BASE;
      else process.env.SHOWCASE_OPENROUTER_BASE = before;
    }
  });
});
