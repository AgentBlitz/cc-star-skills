import assert from "node:assert/strict";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { CANARY, cli, scratch, scratchRepo, userConfig } from "./helpers.ts";

const KEY = "OPENROUTER_API_KEY";

describe("keys status", () => {
  it("reports sources without values", async () => {
    const cfg = userConfig(`${KEY}=${CANARY}\nSHOWCASE_TTS_VOICE=alloy-voice\n`);
    const r = await cli(["keys", "status"], { env: { SHOWCASE_CONFIG_DIR: cfg } });
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /OPENROUTER_API_KEY\s+set\s+\(user file\)/);
    assert.ok(!(r.stdout + r.stderr).includes(CANARY));
    assert.ok(!(r.stdout + r.stderr).includes("alloy-voice"));

    const j = await cli(["keys", "status", "--json"], { env: { SHOWCASE_CONFIG_DIR: cfg, [KEY]: CANARY } });
    const out = JSON.parse(j.stdout) as { keys: { name: string; set: boolean; source: string | null }[] };
    assert.deepEqual(out.keys.find((k) => k.name === KEY), { name: KEY, set: true, source: "environment" });
    assert.ok(!j.stdout.includes(CANARY));
  });

  it("reports a repo .env.local source, and a skipped unignored one", async () => {
    const cfg = scratch();
    const ignored = await cli(["keys", "status", "--json"], { env: { SHOWCASE_CONFIG_DIR: cfg }, cwd: scratchRepo(`${KEY}=${CANARY}\n`, true) });
    assert.match(ignored.stdout, /"source": "repo \.env\.local"/);
    const unignored = await cli(["keys", "status"], { env: { SHOWCASE_CONFIG_DIR: cfg }, cwd: scratchRepo(`${KEY}=${CANARY}\n`, false) });
    assert.match(unignored.stdout, /OPENROUTER_API_KEY\s+unset/);
    assert.match(unignored.stdout, /not-ignored/);
    for (const r of [ignored, unignored]) assert.ok(!(r.stdout + r.stderr).includes(CANARY));
  });

  it("exits 1 with the fix for a loose user file", async () => {
    const cfg = userConfig(`${KEY}=${CANARY}\n`);
    const { chmodSync } = await import("node:fs");
    chmodSync(join(cfg, ".env"), 0o644);
    const r = await cli(["keys", "status"], { env: { SHOWCASE_CONFIG_DIR: cfg } });
    assert.equal(r.code, 1);
    assert.match(r.stdout, /chmod 600/);
    assert.ok(!(r.stdout + r.stderr).includes(CANARY));
  });
});

describe("keys init", () => {
  it("creates 700/600 from the template and never overwrites", async () => {
    const cfg = join(scratch(), "nested", "showcase");
    const r = await cli(["keys", "init"], { env: { SHOWCASE_CONFIG_DIR: cfg } });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(statSync(cfg).mode & 0o777, 0o700);
    assert.equal(statSync(join(cfg, ".env")).mode & 0o777, 0o600);
    assert.match(readFileSync(join(cfg, ".env"), "utf8"), /^OPENROUTER_API_KEY=$/m);
    writeFileSync(join(cfg, ".env"), "# mine\n");
    const again = await cli(["keys", "init"], { env: { SHOWCASE_CONFIG_DIR: cfg } });
    assert.match(again.stdout, /already exists/);
    assert.equal(readFileSync(join(cfg, ".env"), "utf8"), "# mine\n");
  });
});

describe("keys import", () => {
  it("copies only the key line, without printing it, and refuses to overwrite without --force", async () => {
    const cfg = join(scratch(), "showcase");
    const src = join(scratch(), ".env.local");
    writeFileSync(src, `OTHER=1\n${KEY}=${CANARY}\nDATABASE_URL=postgres://secret\n`);
    const r = await cli(["keys", "import", src], { env: { SHOWCASE_CONFIG_DIR: cfg } });
    assert.equal(r.code, 0, r.stderr);
    assert.ok(!(r.stdout + r.stderr).includes(CANARY));
    const body = readFileSync(join(cfg, ".env"), "utf8");
    assert.match(body, new RegExp(`^${KEY}=${CANARY}$`, "m"));
    assert.ok(!body.includes("DATABASE_URL") && !body.includes("OTHER=1"));
    assert.equal(statSync(join(cfg, ".env")).mode & 0o777, 0o600);

    const again = await cli(["keys", "import", src], { env: { SHOWCASE_CONFIG_DIR: cfg } });
    assert.equal(again.code, 1);
    assert.match(again.stderr, /--force/);
    assert.ok(!(again.stdout + again.stderr).includes(CANARY));

    writeFileSync(src, `${KEY}=${CANARY}-new\n`);
    const forced = await cli(["keys", "import", src, "--force"], { env: { SHOWCASE_CONFIG_DIR: cfg } });
    assert.equal(forced.code, 0, forced.stderr);
    assert.ok(!(forced.stdout + forced.stderr).includes(CANARY));
    assert.equal(readFileSync(join(cfg, ".env"), "utf8").match(new RegExp(`^${KEY}=`, "gm"))?.length, 1);
  });

  it("fails on a file without the key, and needs a file argument", async () => {
    const src = join(scratch(), ".env.local");
    writeFileSync(src, "OTHER=1\n");
    assert.equal((await cli(["keys", "import", src], { env: { SHOWCASE_CONFIG_DIR: scratch() } })).code, 1);
    assert.equal((await cli(["keys", "import"], { env: { SHOWCASE_CONFIG_DIR: scratch() } })).code, 2);
  });
});

describe("keys set", () => {
  it("refuses without a TTY", async () => {
    const r = await cli(["keys", "set"], { env: { SHOWCASE_CONFIG_DIR: scratch() }, input: `${CANARY}\n` });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /own terminal/);
  });
});
