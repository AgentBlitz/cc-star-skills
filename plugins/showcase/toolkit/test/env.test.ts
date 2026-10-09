import assert from "node:assert/strict";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { checkModes, loadFiles, PermissionError, resolveAll, resolveKey } from "../lib/env.ts";
import { CANARY, scratch, scratchRepo, userConfig } from "./helpers.ts";

const KEY = "OPENROUTER_API_KEY";

describe("env resolution", () => {
  it("prefers the process environment, then an ignored .env.local, then the user file", () => {
    const cfg = userConfig(`${KEY}=user-${CANARY}\nSHOWCASE_TTS_VOICE=user-voice\n`);
    const repo = scratchRepo(`${KEY}=repo-${CANARY}\nSHOWCASE_TTS_MODEL=repo-model\n`, true);

    const fromEnv = resolveKey(KEY, { env: { SHOWCASE_CONFIG_DIR: cfg, [KEY]: `env-${CANARY}` }, cwd: repo });
    assert.equal(fromEnv.source, "environment");
    assert.equal(fromEnv.value, `env-${CANARY}`);

    const { values } = resolveAll({ env: { SHOWCASE_CONFIG_DIR: cfg }, cwd: repo });
    const by = Object.fromEntries(values.map((v) => [v.name, v]));
    assert.equal(by[KEY]?.source, "repo .env.local");
    assert.equal(by[KEY]?.value, `repo-${CANARY}`);
    assert.equal(by.SHOWCASE_TTS_MODEL?.source, "repo .env.local");
    assert.equal(by.SHOWCASE_TTS_VOICE?.source, "user file");
    assert.equal(by.SHOWCASE_TTS_SPEED?.source, null);
  });

  it("skips a .env.local that git doesn't ignore", () => {
    const cfg = userConfig(`${KEY}=user-${CANARY}\n`);
    const repo = scratchRepo(`${KEY}=repo-${CANARY}\n`, false);
    const { values, files } = resolveAll({ env: { SHOWCASE_CONFIG_DIR: cfg }, cwd: repo });
    assert.equal(files.repo?.state, "not-ignored");
    assert.equal(values.find((v) => v.name === KEY)?.source, "user file");
  });

  it("takes only the known names from a file", () => {
    const cfg = userConfig(`${KEY}=${CANARY}\nOTHER_SECRET=nope\n`);
    const { userValues } = loadFiles({ env: { SHOWCASE_CONFIG_DIR: cfg }, cwd: scratch() });
    assert.deepEqual(Object.keys(userValues), [KEY]);
  });

  it("follows XDG_CONFIG_HOME when SHOWCASE_CONFIG_DIR is unset", () => {
    const xdg = scratch();
    mkdirSync(join(xdg, "showcase"), { mode: 0o700 });
    writeFileSync(join(xdg, "showcase", ".env"), `${KEY}=${CANARY}\n`, { mode: 0o600 });
    assert.equal(resolveKey(KEY, { env: { XDG_CONFIG_HOME: xdg }, cwd: scratch() }).source, "user file");
  });

  it("never touches process.env", () => {
    const before = { ...process.env };
    const cfg = userConfig(`${KEY}=${CANARY}\nSHOWCASE_TTS_MODEL=m\n`);
    resolveAll({ env: { SHOWCASE_CONFIG_DIR: cfg }, cwd: scratchRepo(`SHOWCASE_TTS_VOICE=v\n`, true) });
    assert.deepEqual({ ...process.env }, before);
    assert.equal(process.env[KEY], before[KEY]);
  });
});

describe("mode refusal", () => {
  it("refuses a file looser than 600, with the fix", () => {
    const cfg = userConfig(`${KEY}=${CANARY}\n`);
    chmodSync(join(cfg, ".env"), 0o644);
    assert.throws(() => checkModes(join(cfg, ".env")), (e: unknown) => e instanceof PermissionError && /chmod 600/.test(e.fix));
    const { values, files } = resolveAll({ env: { SHOWCASE_CONFIG_DIR: cfg }, cwd: scratch() });
    assert.equal(files.user.state, "loose");
    assert.equal(values.find((v) => v.name === KEY)?.value, undefined);
    assert.throws(() => resolveKey(KEY, { env: { SHOWCASE_CONFIG_DIR: cfg }, cwd: scratch() }), PermissionError);
  });

  it("refuses a directory looser than 700, with the fix", () => {
    const cfg = userConfig(`${KEY}=${CANARY}\n`);
    chmodSync(cfg, 0o755);
    assert.throws(() => checkModes(join(cfg, ".env")), (e: unknown) => e instanceof PermissionError && /chmod 700/.test(e.fix));
  });
});
