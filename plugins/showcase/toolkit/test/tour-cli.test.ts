import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";
import { renderStoryboard } from "../lib/tours.ts";
import type { Tour } from "../runtime/src/schema.ts";
import { cli, scratch } from "./helpers.ts";

const ROOT = resolve(import.meta.dirname, "..", "..");
const GOLDEN = join(ROOT, "toolkit/test/golden/compass-pitch.json");

/** A scratch git repo with the golden at showcase/tours/compass-pitch.json. */
function repoWithGolden(): string {
  const dir = scratch("showcase-repo-");
  execFileSync("git", ["init", "-q"], { cwd: dir });
  mkdirSync(join(dir, "showcase", "tours"), { recursive: true });
  cpSync(GOLDEN, join(dir, "showcase", "tours", "compass-pitch.json"));
  return dir;
}

/** The same object with every key order reversed. */
function reversed(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(reversed);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reversed(x)]));
  return v;
}

describe("showcase check", () => {
  it("passes each template cleanly (0, no issues)", async () => {
    for (const kind of ["pitch", "walkthrough", "spotlight", "howto"]) {
      const r = await cli(["check", join(ROOT, `skills/showcase/templates/tour.${kind}.json`), "--json"]);
      assert.equal(r.code, 0, r.stdout + r.stderr);
      const out = JSON.parse(r.stdout) as { ok: boolean; issues: unknown[] };
      assert.equal(out.ok, true);
      assert.deepEqual(out.issues, []);
    }
  });

  it("fails (1) with the rule id, in text and JSON", async () => {
    const f = join(ROOT, "toolkit/fixtures/tours/invalid/T006-unknown-anchor.json");
    const text = await cli(["check", f]);
    assert.equal(text.code, 1);
    assert.match(text.stdout, /T006 error/);
    const json = JSON.parse((await cli(["check", f, "--json"])).stdout) as { issues: { rule: string }[] };
    assert.deepEqual(json.issues.map((i) => i.rule), ["T006"]);
  });

  it("finds a tour by id in the repo, and reports a file that isn't JSON as T001", async () => {
    const repo = repoWithGolden();
    const r = await cli(["check", "compass-pitch", "--json"], { cwd: join(repo, "showcase") });
    assert.equal(r.code, 0, r.stderr);
    assert.equal((JSON.parse(r.stdout) as { storyboard: string }).storyboard, "missing");
    writeFileSync(join(repo, "showcase", "tours", "broken.json"), "{ nope");
    const bad = await cli(["check", "broken", "--json"], { cwd: repo });
    assert.equal(bad.code, 1);
    assert.equal((JSON.parse(bad.stdout) as { issues: { rule: string }[] }).issues[0]?.rule, "T001");
  });

  it("times voiced sentences by their clips: the window is judged on the voice once there is one", async () => {
    const repo = repoWithGolden();
    writeFileSync(join(repo, "showcase", "config.json"), JSON.stringify({ showcase: 1, app: { url: "http://127.0.0.1" } }));
    const tour = JSON.parse(readFileSync(GOLDEN, "utf8")) as Tour;
    const sentences = tour.steps.flatMap((st) => st.beats.flatMap((b) => (b.narration ?? []).map((n) => ({ beat: b.id, text: typeof n === "string" ? n : n.text }))));
    const run = async () => JSON.parse((await cli(["check", "compass-pitch", "--json"], { cwd: repo })).stdout) as { ok: boolean; stats: { narrationSec: number; voiced: number; sentences: number }; issues: { rule: string }[] };
    // No voice yet: the reading estimate, inside the window.
    const before = await run();
    assert.deepEqual([before.ok, before.stats.voiced], [true, 0]);
    // A voice that reads fast: 90 s in all, under the 2:00 pitch's 96 s floor.
    mkdirSync(join(repo, "showcase", "voice"), { recursive: true });
    const clips = sentences.map((s, i) => ({ ...s, hash: `h${i}`, file: `h${i}.mp3`, durationMs: 90_000 / sentences.length }));
    writeFileSync(join(repo, "showcase", "voice", "compass-pitch.manifest.json"), JSON.stringify({ v: 1, id: "m", tour: "compass-pitch", clips }));
    const voiced = await run();
    assert.equal(voiced.ok, false);
    assert.deepEqual(voiced.issues.map((i) => i.rule), ["T008"]);
    assert.deepEqual([voiced.stats.narrationSec, voiced.stats.voiced, voiced.stats.sentences], [90, sentences.length, sentences.length]);
    // A sentence whose text changed has no clip: it falls back to its estimate.
    clips[0]!.text = "Something it no longer says.";
    writeFileSync(join(repo, "showcase", "voice", "compass-pitch.manifest.json"), JSON.stringify({ v: 1, id: "m", tour: "compass-pitch", clips }));
    assert.equal((await run()).stats.voiced, sentences.length - 1);
  });

  it("exits 2 without a tour", async () => {
    assert.equal((await cli(["check"])).code, 2);
  });
});

describe("showcase storyboard", () => {
  it("is deterministic: same tour, same bytes, whatever the key order", async () => {
    const tour = JSON.parse(readFileSync(GOLDEN, "utf8")) as Tour;
    assert.equal(renderStoryboard(reversed(tour) as Tour), renderStoryboard(tour));
    const repo = repoWithGolden();
    const first = await cli(["storyboard", "compass-pitch", "--json"], { cwd: repo });
    assert.equal(first.code, 0, first.stderr);
    assert.equal((JSON.parse(first.stdout) as { changed: boolean }).changed, true);
    const file = join(repo, "showcase", "storyboard", "compass-pitch.md");
    const bytes = readFileSync(file, "utf8");
    const again = await cli(["storyboard", "compass-pitch", "--json"], { cwd: repo });
    assert.equal((JSON.parse(again.stdout) as { changed: boolean }).changed, false);
    assert.equal(readFileSync(file, "utf8"), bytes);
    assert.equal(bytes, renderStoryboard(tour));
    assert.match(bytes, /<!-- showcase:storyboard v1 sha256:[0-9a-f]{64} -->/);
    assert.match(bytes, /\| 4 \| [^|]+ \| asks [^|]+ \| `asks` ✂ \|/);
    assert.match(bytes, /- Narration: 100\.8 s against 96–108 s ✓/);
  });

  it("goes stale when the tour changes, and check fails with T015 until it's regenerated", async () => {
    const repo = repoWithGolden();
    await cli(["storyboard", "compass-pitch"], { cwd: repo });
    const fresh = await cli(["check", "compass-pitch", "--json"], { cwd: repo });
    assert.equal((JSON.parse(fresh.stdout) as { storyboard: string }).storyboard, "fresh");

    const f = join(repo, "showcase", "tours", "compass-pitch.json");
    const tour = JSON.parse(readFileSync(f, "utf8")) as Tour;
    writeFileSync(f, JSON.stringify(tour)); // whitespace only: still fresh
    assert.equal((await cli(["check", "compass-pitch"], { cwd: repo })).code, 0);

    tour.title = "The two-minute pitch";
    writeFileSync(f, JSON.stringify(tour, null, 2));
    const stale = await cli(["check", "compass-pitch", "--json"], { cwd: repo });
    assert.equal(stale.code, 1);
    assert.deepEqual((JSON.parse(stale.stdout) as { issues: { rule: string }[] }).issues.map((i) => i.rule), ["T015"]);
    await cli(["storyboard", "compass-pitch"], { cwd: repo });
    assert.equal((await cli(["check", "compass-pitch"], { cwd: repo })).code, 0);
  });

  it("needs --out for a tour outside showcase/tours/ (2)", async () => {
    assert.equal((await cli(["storyboard", GOLDEN])).code, 2);
    const out = join(scratch(), "sb.md");
    assert.equal((await cli(["storyboard", GOLDEN, "--out", out])).code, 0);
    assert.match(readFileSync(out, "utf8"), /^<!-- Generated by `showcase storyboard`/);
  });
});

describe("showcase init", () => {
  it("scaffolds showcase/ and the ignore lines, then changes nothing on a second run", async () => {
    const repo = scratch("showcase-repo-");
    execFileSync("git", ["init", "-q"], { cwd: repo });
    writeFileSync(join(repo, ".gitignore"), "node_modules/");
    mkdirSync(join(repo, "src"));

    const first = await cli(["init", "--json"], { cwd: join(repo, "src") });
    assert.equal(first.code, 0, first.stderr);
    assert.equal((JSON.parse(first.stdout) as { changed: boolean }).changed, true);
    const snapshot = () =>
      Object.fromEntries(
        ["showcase/config.json", "showcase/.schema/tour.schema.json", "showcase/.schema/config.schema.json", ".gitignore"].map((p) => [p, readFileSync(join(repo, p), "utf8")]),
      );
    const before = snapshot();
    assert.deepEqual(readdirSync(join(repo, "showcase", "tours")), []);
    assert.equal(before[".gitignore"], "node_modules/\n\n# showcase: renders, caches and sign-ins\nshowcase/out/\nshowcase/.cache/\nshowcase/.auth/\n");
    assert.equal(before["showcase/.schema/tour.schema.json"], readFileSync(join(ROOT, "toolkit/schema/tour.schema.json"), "utf8"));
    const ignored = execFileSync("git", ["check-ignore", "showcase/out/x.mp4", "showcase/.auth/s.json"], { cwd: repo, encoding: "utf8" });
    assert.equal(ignored.trim().split("\n").length, 2);

    const second = await cli(["init", "--json"], { cwd: repo });
    assert.equal(second.code, 0);
    const out = JSON.parse(second.stdout) as { changed: boolean; changes: { did: string }[] };
    assert.equal(out.changed, false);
    assert.ok(out.changes.every((c) => c.did === "unchanged"));
    assert.deepEqual(snapshot(), before);
  });

  it("keeps an edited config, and puts a copied template tour on a clean check", async () => {
    const repo = scratch("showcase-repo-");
    execFileSync("git", ["init", "-q"], { cwd: repo });
    await cli(["init"], { cwd: repo });
    const cfg = join(repo, "showcase", "config.json");
    writeFileSync(cfg, '{ "showcase": 1, "app": { "url": "http://127.0.0.1:3000" } }\n');
    await cli(["init"], { cwd: repo });
    assert.match(readFileSync(cfg, "utf8"), /3000/);
    cpSync(join(ROOT, "skills/showcase/templates/tour.spotlight.json"), join(repo, "showcase", "tours", "spotlight.json"));
    const r = await cli(["check", "spotlight"], { cwd: repo });
    assert.equal(r.code, 0, r.stdout);
  });
});

describe("showcase docs", () => {
  it("prints tour-format, narrative and interview", async () => {
    const list = JSON.parse((await cli(["docs", "--json"])).stdout) as { topics: string[] };
    for (const t of ["interview", "narrative", "tour-format"]) assert.ok(list.topics.includes(t), t);
    const r = await cli(["docs", "tour-format"]);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /^# The tour format/);
    for (let n = 1; n <= 15; n++) assert.match(r.stdout, new RegExp(`T${String(n).padStart(3, "0")}`));
  });
});
