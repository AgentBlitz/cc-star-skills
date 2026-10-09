/**
 * `showcase voice` and `voices` through `bin/showcase`: `--check` needs no key, no network and no
 * ffmpeg; a draft run writes the manifest where Watch looks for it; a canary key set in the
 * environment appears nowhere in the output.
 */
import assert from "node:assert/strict";
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";
import { voiceFor } from "../host/project.ts";
import { loadConfig } from "../lib/config.ts";
import { loadTour, resolveTour } from "../lib/tours.ts";
import type { Tour } from "../runtime/src/schema.ts";
import { CANARY, cli, scratch } from "./helpers.ts";

const FIXTURE = resolve(import.meta.dirname, "..", "fixtures", "showcase");

/** A scratch copy of the fixture project whose draft voice is the fake tone. */
function project(): { root: string; tour: string } {
  const root = scratch("showcase-voice-cli-");
  cpSync(FIXTURE, join(root, "showcase"), { recursive: true });
  const cfg = join(root, "showcase", "config.json");
  const config = JSON.parse(readFileSync(cfg, "utf8"));
  config.voice = { ...config.voice, draft: { provider: "fake" } };
  writeFileSync(cfg, JSON.stringify(config, null, 2));
  return { root, tour: join(root, "showcase", "tours", "fixture-tour.json") };
}

describe("showcase voice", () => {
  it("--check needs no ffmpeg or network, reports missing and exits 1; a draft run makes it current", async () => {
    const { root, tour } = project();
    // ffmpeg is pointed at nothing: --check must not need it.
    const env = { HOME: scratch("showcase-home-"), OPENROUTER_API_KEY: CANARY, PATH: process.env.PATH ?? "", FFMPEG_PATH: "/nonexistent/ffmpeg" };
    const missing = await cli(["voice", tour, "--check", "--json"], { cwd: root, env });
    assert.equal(missing.code, 1);
    const m = JSON.parse(missing.stdout);
    assert.deepEqual([m.counts.missing, m.counts.fresh, m.ok], [10, 0, false]);

    const made = await cli(["voice", tour, "--draft"], { cwd: root, env: { HOME: env.HOME, OPENROUTER_API_KEY: CANARY, PATH: env.PATH } });
    assert.equal(made.code, 0, made.stderr);
    assert.match(made.stdout, /voiced 10/);
    assert.ok(existsSync(join(root, "showcase", "voice", "fixture-tour.manifest.json")));

    const current = await cli(["voice", tour, "--check"], { cwd: root, env });
    assert.equal(current.code, 0);
    assert.match(current.stdout, /every sentence is current/);
    for (const out of [missing.stdout, missing.stderr, made.stdout, made.stderr, current.stdout, current.stderr]) assert.equal(out.includes(CANARY), false);
  });

  it("writes the manifest where Watch looks for it", async () => {
    const { root, tour } = project();
    const made = await cli(["voice", tour, "--draft"], { cwd: root, env: { HOME: scratch("showcase-home-"), PATH: process.env.PATH ?? "" } });
    assert.equal(made.code, 0, made.stderr);
    const t = loadTour(resolveTour(tour)).tour as Tour;
    const found = voiceFor({ showcaseDir: join(root, "showcase"), root, config: loadConfig(join(root, "showcase")) }, t);
    assert.equal(found.manifest?.clips.length, 10);
    assert.equal(found.dir, join(root, "showcase", "voice"));
  });

  it("refuses paid work without --yes, and a bad usage exits 2", async () => {
    const { root, tour } = project();
    const cfg = join(root, "showcase", "config.json");
    const config = JSON.parse(readFileSync(cfg, "utf8"));
    config.voice.narrator = { model: "vendor/model-a", voice: "v" };
    writeFileSync(cfg, JSON.stringify(config, null, 2));
    const env = { HOME: scratch("showcase-home-"), OPENROUTER_API_KEY: CANARY, PATH: process.env.PATH ?? "" };
    const refused = await cli(["voice", tour], { cwd: root, env });
    assert.equal(refused.code, 1);
    assert.match(refused.stderr, /pass --yes/);
    assert.equal((refused.stdout + refused.stderr).includes(CANARY), false);
    assert.equal(existsSync(join(root, "showcase", "voice", "fixture-tour.manifest.json")), false);

    assert.equal((await cli(["voice", tour, "--draft", "--final"], { cwd: root, env })).code, 2);
    assert.equal((await cli(["voice", tour, "--redo", "nonsense"], { cwd: root, env })).code, 2);
    assert.equal((await cli(["voice"], { cwd: root, env })).code, 2);
    assert.equal((await cli(["voices"], { cwd: root, env })).code, 2);
  });
});
