import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";
import { applyBlocks, BLOCKS } from "../lib/brief.ts";
import { CANARY, cli, scratch } from "./helpers.ts";

const ROOT = resolve(import.meta.dirname, "..", "..");
const GOLDEN = join(ROOT, "toolkit/test/golden/compass-pitch.json");

/** A scratch git repo after `showcase init`, with the golden tour and its storyboard. */
async function project(env: Record<string, string>): Promise<string> {
  const dir = scratch("showcase-brief-");
  execFileSync("git", ["init", "-q"], { cwd: dir });
  assert.equal((await cli(["init"], { cwd: dir, env })).code, 0);
  cpSync(GOLDEN, join(dir, "showcase", "tours", "compass-pitch.json"));
  assert.equal((await cli(["storyboard", "compass-pitch"], { cwd: dir, env })).code, 0);
  return dir;
}

describe("showcase brief", () => {
  it("refuses (1) where there's no showcase/ yet", async () => {
    const dir = scratch("showcase-brief-");
    execFileSync("git", ["init", "-q"], { cwd: dir });
    const r = await cli(["brief"], { cwd: dir });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /showcase init/);
  });

  it("writes the template with both blocks filled, then changes nothing; never names the key", async () => {
    const env = { OPENROUTER_API_KEY: CANARY, SHOWCASE_CONFIG_DIR: scratch() };
    const dir = await project(env);
    const first = await cli(["brief", "--json"], { cwd: dir, env });
    assert.equal(first.code, 0, first.stderr);
    const out = JSON.parse(first.stdout) as { created: boolean; changed: boolean; tours: { id: string; ok: boolean }[]; missingBlocks: string[] };
    assert.equal(out.created, true);
    assert.deepEqual(out.tours, [{ id: "compass-pitch", ok: true }]);
    assert.deepEqual(out.missingBlocks, []);

    const text = readFileSync(join(dir, "showcase", "BRIEF.md"), "utf8");
    assert.match(text, /^# Showcase brief$/m);
    assert.match(text, /### `compass-pitch`: The 2-minute pitch/);
    assert.match(text, /\| Budget \| 2:00 · narration 96–108 s · 236–266 words · 8–10 beats \(preset\) \|/);
    assert.match(text, /\| Now \| narration 100\.8 s by reading time · 248 words · 9 beats \|/);
    assert.match(text, /\| Storyboard \| fresh /);
    assert.match(text, /\| Voice \| 29 sentences: 29 missing \|/);
    assert.match(text, /\| Build \| `npm run build` \|/);
    assert.match(text, /✗ clock fixed/);
    for (const r of [first.stdout, first.stderr, text]) assert.ok(!r.includes(CANARY));

    const again = await cli(["brief", "--json"], { cwd: dir, env });
    assert.equal((JSON.parse(again.stdout) as { changed: boolean }).changed, false);
    assert.equal(readFileSync(join(dir, "showcase", "BRIEF.md"), "utf8"), text);
    assert.equal((await cli(["brief", "--check"], { cwd: dir, env })).code, 0);
  });

  it("keeps what the skill wrote and refreshes the blocks when the state moves", async () => {
    const env = { SHOWCASE_CONFIG_DIR: scratch() };
    const dir = await project(env);
    await cli(["brief"], { cwd: dir, env });
    const file = join(dir, "showcase", "BRIEF.md");
    writeFileSync(file, readFileSync(file, "utf8").replace("| 1 | What kind of video? | |", "| 1 | What kind of video? | Pitch |"));

    const config = join(dir, "showcase", "config.json");
    const c = JSON.parse(readFileSync(config, "utf8")) as { browser: Record<string, unknown> };
    c.browser.clock = { fixed: "2026-10-05T09:00:00+01:00" };
    writeFileSync(config, JSON.stringify(c, null, 2));
    const stale = await cli(["brief", "--check"], { cwd: dir, env });
    assert.equal(stale.code, 1);
    assert.match(stale.stdout, /out of date/);

    assert.equal((await cli(["brief"], { cwd: dir, env })).code, 0);
    const text = readFileSync(file, "utf8");
    assert.match(text, /\| 1 \| What kind of video\? \| Pitch \|/);
    assert.match(text, /\| Clock \| fixed at 2026-10-05T09:00:00\+01:00 \|/);
    assert.match(text, /✓ clock fixed/);
  });

  it("reports a block whose markers were removed and leaves the text alone", () => {
    const blocks = Object.fromEntries(BLOCKS.map((b) => [b, `new ${b}`])) as Record<(typeof BLOCKS)[number], string>;
    const text = "a\n<!-- showcase:begin tours -->\nold\n<!-- showcase:end tours -->\nb\n";
    const r = applyBlocks(text, blocks);
    assert.deepEqual(r.missing, ["app"]);
    assert.equal(r.text, "a\n<!-- showcase:begin tours -->\nnew tours\n<!-- showcase:end tours -->\nb\n");
  });
});
