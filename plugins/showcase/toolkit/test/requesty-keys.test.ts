/**
 * `REQUESTY_API_KEY` (showcase 1.1) wherever `OPENROUTER_API_KEY` goes: read from the same three
 * sources by `env.ts` alone, stripped from the app's and the tools' environments, masked by
 * `redact()`, listed by `keys status`, checked for free by `keys test` against a loopback stand-in,
 * and set by `keys set` only in a terminal. A canary value proves it is never printed.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { describe, it } from "node:test";
import { appEnv, toolEnv } from "../lib/child-env.ts";
import { resolveAll, resolveKey } from "../lib/env.ts";
import { redact } from "../lib/redact.ts";
import { cli, scratch, scratchRepo, userConfig } from "./helpers.ts";

const KEY = "REQUESTY_API_KEY";
const RQ_CANARY = "rqsty-CANARY-0123456789abcdef";

async function stand(handler: (req: IncomingMessage, res: ServerResponse) => void): Promise<{ base: string; close: () => void }> {
  const server = createServer(handler);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, close: () => server.close() };
}

describe("REQUESTY_API_KEY in env.ts", () => {
  it("comes from the process environment, then an ignored .env.local, then the user file", () => {
    const cfg = userConfig(`${KEY}=user-${RQ_CANARY}\n`);
    const repo = scratchRepo(`${KEY}=repo-${RQ_CANARY}\n`, true);
    assert.deepEqual(resolveKey(KEY, { env: { SHOWCASE_CONFIG_DIR: cfg, [KEY]: `env-${RQ_CANARY}` }, cwd: repo }), { name: KEY, value: `env-${RQ_CANARY}`, source: "environment" });
    assert.equal(resolveKey(KEY, { env: { SHOWCASE_CONFIG_DIR: cfg }, cwd: repo }).source, "repo .env.local");
    assert.equal(resolveKey(KEY, { env: { SHOWCASE_CONFIG_DIR: cfg }, cwd: scratch() }).source, "user file");
    const unignored = scratchRepo(`${KEY}=repo-${RQ_CANARY}\n`, false);
    assert.equal(resolveKey(KEY, { env: { SHOWCASE_CONFIG_DIR: cfg }, cwd: unignored }).source, "user file", "an unignored .env.local is skipped");
    assert.equal(resolveAll({ env: { SHOWCASE_CONFIG_DIR: scratch() }, cwd: scratch() }).values.find((v) => v.name === KEY)?.source, null);
  });

  it("is stripped from the app server's environment and never reaches a tool's", () => {
    const base = { PATH: "/bin", HOME: "/h", [KEY]: RQ_CANARY, OPENROUTER_API_KEY: "or-key-value", APP_SETTING: "kept" };
    const app = appEnv(base);
    assert.equal(KEY in app, false);
    assert.equal(app.APP_SETTING, "kept");
    assert.equal(KEY in toolEnv({}, base), false);
  });

  it("is masked by redact() when it is only in the process environment", () => {
    const before = process.env[KEY];
    process.env[KEY] = RQ_CANARY;
    try {
      assert.equal(redact(`upstream said ${RQ_CANARY}`).includes(RQ_CANARY), false);
    } finally {
      if (before === undefined) delete process.env[KEY];
      else process.env[KEY] = before;
    }
  });

  it("has its line in the key-file template, empty", () => {
    const template = readFileSync(join(import.meta.dirname, "..", "..", "skills", "showcase", "templates", "env.template"), "utf8");
    assert.match(template, /^REQUESTY_API_KEY=$/m);
  });
});

describe("keys with REQUESTY_API_KEY", () => {
  it("status lists it, set or unset, never its value", async () => {
    const unset = await cli(["keys", "status"], { env: { SHOWCASE_CONFIG_DIR: scratch() } });
    assert.equal(unset.code, 0, unset.stderr);
    assert.match(unset.stdout, /REQUESTY_API_KEY\s+unset/);
    const set = await cli(["keys", "status", "--json"], { env: { SHOWCASE_CONFIG_DIR: userConfig(`${KEY}=${RQ_CANARY}\n`) } });
    const out = JSON.parse(set.stdout) as { keys: { name: string; set: boolean; source: string | null }[] };
    assert.deepEqual(out.keys.find((k) => k.name === KEY), { name: KEY, set: true, source: "user file" });
    assert.ok(!(set.stdout + set.stderr).includes(RQ_CANARY));
  });

  it("test asks Requesty's free self endpoint and prints only the safe fields", async () => {
    const seen: { path: string; auth: string }[] = [];
    const srv = await stand((req, res) => {
      seen.push({ path: req.url ?? "", auth: String(req.headers.authorization ?? "") });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "key-uuid-x", name: "film-key-name", logging: false, monthly_spend: 0.12, monthly_limit: 5, permissions: { manage: "read", completions: "write" }, created_at: "2026-10-01T13:47:23Z" }));
    });
    try {
      const r = await cli(["keys", "test", KEY, "--json"], { env: { SHOWCASE_REQUESTY_BASE: srv.base, SHOWCASE_CONFIG_DIR: userConfig(`${KEY}=${RQ_CANARY}\n`) } });
      assert.equal(r.code, 0, r.stderr);
      assert.deepEqual(seen, [{ path: "/manage/apikey/self", auth: `Bearer ${RQ_CANARY}` }]);
      const out = JSON.parse(r.stdout) as { name: string; source: string; key: Record<string, unknown> };
      assert.equal(out.name, KEY);
      assert.equal(out.source, "user file");
      assert.deepEqual(out.key, { monthly_spend: 0.12, monthly_limit: 5, logging: false, completions: "write" });
      assert.ok(!/key-uuid-x|film-key-name|CANARY/.test(r.stdout + r.stderr));
    } finally {
      srv.close();
    }
  });

  it("test without a name checks every set key, and a rejected key echoed back never reaches the output", async () => {
    const srv = await stand((req, res) => {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { origin: "api-v2", message: `bad key ${String(req.headers.authorization)}` } }));
    });
    try {
      const r = await cli(["keys", "test"], { env: { [KEY]: RQ_CANARY, SHOWCASE_REQUESTY_BASE: srv.base, SHOWCASE_CONFIG_DIR: scratch() } });
      assert.equal(r.code, 1);
      assert.match(r.stderr, /Requesty rejected REQUESTY_API_KEY \(environment\): HTTP 401/);
      assert.ok(!(r.stdout + r.stderr).includes(RQ_CANARY), r.stdout + r.stderr);
    } finally {
      srv.close();
    }
  });

  it("test fails clearly when the named key is unset, and refuses an unknown name", async () => {
    const unset = await cli(["keys", "test", KEY], { env: { SHOWCASE_CONFIG_DIR: scratch() } });
    assert.equal(unset.code, 1);
    assert.match(unset.stderr, /REQUESTY_API_KEY is not set/);
    const unknown = await cli(["keys", "test", "OPENAI_API_KEY"], { env: { SHOWCASE_CONFIG_DIR: scratch() } });
    assert.notEqual(unknown.code, 0);
    assert.match(unknown.stderr, /OPENROUTER_API_KEY or REQUESTY_API_KEY/);
  });

  it("set accepts the name and still refuses without a terminal", async () => {
    const r = await cli(["keys", "set", KEY], { env: { SHOWCASE_CONFIG_DIR: scratch() }, input: `${RQ_CANARY}\n` });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /own terminal/);
    assert.ok(!(r.stdout + r.stderr).includes(RQ_CANARY));
    const bad = await cli(["keys", "set", "NOT_A_KEY"], { env: { SHOWCASE_CONFIG_DIR: scratch() } });
    assert.notEqual(bad.code, 0);
    assert.match(bad.stderr, /isn't a key showcase sets/);
  });

  it("import copies only the named key's line", async () => {
    const cfg = join(scratch(), "showcase");
    const src = join(scratch(), ".env.local");
    const { writeFileSync } = await import("node:fs");
    writeFileSync(src, `OPENROUTER_API_KEY=or-should-stay-behind\n${KEY}=${RQ_CANARY}\n`);
    const r = await cli(["keys", "import", src, KEY], { env: { SHOWCASE_CONFIG_DIR: cfg } });
    assert.equal(r.code, 0, r.stderr);
    assert.ok(!(r.stdout + r.stderr).includes(RQ_CANARY));
    const status = await cli(["keys", "status", "--json"], { env: { SHOWCASE_CONFIG_DIR: cfg } });
    const keys = (JSON.parse(status.stdout) as { keys: { name: string; set: boolean }[] }).keys;
    assert.equal(keys.find((k) => k.name === KEY)?.set, true);
    assert.equal(keys.find((k) => k.name === "OPENROUTER_API_KEY")?.set, false);
  });
});
