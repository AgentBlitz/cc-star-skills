import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { appEnv, toolEnv } from "../lib/child-env.ts";
import { cli, scratch } from "./helpers.ts";

describe("CLI routing and exit codes", () => {
  it("prints help with --help (0) and with no command (2)", async () => {
    const help = await cli(["--help"]);
    assert.equal(help.code, 0);
    assert.match(help.stdout, /Commands:[\s\S]*doctor[\s\S]*keys[\s\S]*shim[\s\S]*docs/);
    const bare = await cli([]);
    assert.equal(bare.code, 2);
    assert.match(bare.stderr, /Usage: showcase/);
  });

  it("exits 2 for an unknown command, option or subcommand", async () => {
    assert.equal((await cli(["nope"])).code, 2);
    assert.equal((await cli(["docs", "--bogus"])).code, 2);
    assert.equal((await cli(["keys", "frobnicate"])).code, 2);
    assert.equal((await cli(["keys", "status", "extra"])).code, 2);
  });

  it("prints per-command --help and exits 0", async () => {
    for (const c of ["doctor", "keys", "shim", "docs"]) {
      const r = await cli([c, "--help"]);
      assert.equal(r.code, 0);
      assert.match(r.stdout, new RegExp(`Usage: showcase ${c}`));
    }
  });

  it("emits JSON with --json", async () => {
    const r = await cli(["docs", "--json"]);
    assert.equal(r.code, 0);
    assert.ok(Array.isArray((JSON.parse(r.stdout) as { topics: unknown }).topics));
  });

  it("docs fails (1) for an unknown topic", async () => {
    assert.equal((await cli(["docs", "no-such-topic"])).code, 1);
  });

  it("shim writes an executable launcher and warns when its dir isn't on PATH", async () => {
    const dir = join(scratch(), "bin");
    mkdirSync(dir);
    const r = await cli(["shim", "--to", dir]);
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /not on PATH/);
    const path = join(dir, "showcase");
    assert.equal(statSync(path).mode & 0o111, 0o111);
    assert.match(readFileSync(path, "utf8"), /plugins\/cache\/\*\/showcase\/\*\/bin\/showcase/);
    const viaShim = spawnSync(path, ["docs", "--json"], { env: { PATH: process.env.PATH ?? "", HOME: scratch() }, encoding: "utf8" });
    assert.equal(viaShim.status, 0, viaShim.stderr);
    assert.ok(Array.isArray((JSON.parse(viaShim.stdout) as { topics: unknown }).topics));
  });
});

describe("child environments", () => {
  const base = { PATH: "/bin", HOME: "/h", LANG: "en_GB.UTF-8", TMPDIR: "/t", OPENROUTER_API_KEY: "secret-value", SHOWCASE_TTS_VOICE: "v", DATABASE_URL: "db" };
  it("gives the app server everything but showcase's names", () => {
    const env = appEnv(base);
    assert.equal(env.DATABASE_URL, "db");
    assert.equal(env.OPENROUTER_API_KEY, undefined);
    assert.equal(env.SHOWCASE_TTS_VOICE, undefined);
  });
  it("gives tools only the allowlist plus explicit additions", () => {
    assert.deepEqual(toolEnv({ EXTRA: "1" }, base), { PATH: "/bin", HOME: "/h", LANG: "en_GB.UTF-8", TMPDIR: "/t", EXTRA: "1" });
  });
});
