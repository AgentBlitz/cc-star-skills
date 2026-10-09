/**
 * The host commands end to end, through `bin/showcase`, on the fixture project
 * (`toolkit/fixtures/showcase/`, whose app is the fixture server, started with `{port}`): rehearse
 * clean three times at ×10, a planted deny-list string and an unspoken number named by beat, a
 * missing anchor's failure kit, `inspect`'s anchors, the storyboard page, and a headed
 * `watch --detach` that exits cleanly. After each, no app or Chromium process is left.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { type FixtureServer, serveFixture } from "../fixtures/serve.ts";
import { cli, scratch } from "./helpers.ts";

const FIXTURES = resolve(import.meta.dirname, "..", "fixtures");
const PROJECT = join(FIXTURES, "showcase");
const TOUR = join(PROJECT, "tours", "fixture-tour.json");
const OUT = resolve(import.meta.dirname, ".out", "host");
const LOCK = join(PROJECT, ".cache", "host.lock");

/** The real HOME, so Playwright finds its browsers; a marker, so the test can find Chromium. */
const env = (marker: string) => ({ HOME: process.env.HOME ?? "", SHOWCASE_RUN_MARKER: marker });

function chromiumLeft(marker: string): string {
  try {
    return execFileSync("pgrep", ["-f", `showcase-run=${marker}`], { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function groupAlive(pid: number | null): boolean {
  if (!pid) return false;
  try {
    process.kill(-pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function eventually(pred: () => boolean, ms = 10_000): Promise<boolean> {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (pred()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return pred();
}

interface Report {
  ok: boolean;
  beats: { beat: string; still: string }[];
  beatCount: number;
  problems: { kind: string; beat: string | null; message: string }[];
  deny: { clean: boolean; checked: number };
  app: { pid: number | null };
  failure: { screenshot: string; dom: string; candidates: { anchor: unknown }[] } | null;
  out: string;
}

let server: FixtureServer;
before(async () => {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  server = await serveFixture();
});
after(() => {
  server.server.closeAllConnections();
  return server.close();
});

test("rehearse is clean three times in a row at ×10, with a still per beat, and leaves no app or Chromium behind", async () => {
  for (let i = 1; i <= 3; i++) {
    const marker = `rehearse-${process.pid}-${i}`;
    const out = join(OUT, `rehearse-${i}`);
    const r = await cli(["rehearse", TOUR, "--speed", "10", "--out", out, "--json"], { env: env(marker), cwd: FIXTURES });
    assert.equal(r.code, 0, `run ${i}: ${r.stdout}\n${r.stderr}`);
    const report = JSON.parse(r.stdout) as Report;
    assert.equal(report.ok, true);
    assert.deepEqual(report.problems, []);
    assert.equal(report.beats.length, 8);
    assert.equal(report.beatCount, 8);
    assert.deepEqual(report.deny, { checked: 8, clean: true });
    assert.deepEqual(readdirSync(join(out, "rehearse")).sort(), report.beats.map((b) => b.still.replace(/^rehearse\//, "")).sort());
    assert.ok(report.app.pid, "showcase started the app");
    assert.ok(await eventually(() => !groupAlive(report.app.pid)), `run ${i}: the app's process group is gone`);
    assert.ok(await eventually(() => chromiumLeft(marker) === ""), `run ${i}: no Chromium left: ${chromiumLeft(marker)}`);
    assert.equal(existsSync(LOCK), false, `run ${i}: the lock was released`);
  }
});

test("storyboard --stills --html rehearses and writes a review page with every beat's still", async () => {
  const dir = join(OUT, "storyboard");
  const md = join(dir, "fixture-tour.md");
  const r = await cli(["storyboard", TOUR, "--out", md, "--stills", "--html", "--out-dir", dir, "--json"], { env: env(`sb-${process.pid}`), cwd: FIXTURES });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const result = JSON.parse(r.stdout) as { html: string; rehearse: { ok: boolean; beats: number } };
  assert.deepEqual(result.rehearse.ok, true);
  const html = readFileSync(result.html, "utf8");
  const srcs = [...html.matchAll(/<img src="([^"]+)"/g)].map((m) => m[1] as string);
  assert.equal(srcs.length, 8);
  for (const s of srcs) assert.ok(existsSync(join(dir, s)), s);
  assert.equal(readFileSync(md, "utf8"), readFileSync(join(PROJECT, "storyboard", "fixture-tour.md"), "utf8"), "the markdown doesn't depend on the stills");
});

/** A copy of the fixture project in a scratch dir, with the app started by absolute path. */
function scratchProject(edit: (config: Record<string, any>, tour: Record<string, any>) => void): { dir: string; tour: string } {
  const root = scratch("showcase-project-");
  const dir = join(root, "showcase");
  cpSync(PROJECT, dir, { recursive: true, filter: (src) => !/[/\\](out|\.cache|\.auth)([/\\]|$)/.test(src) });
  const config = JSON.parse(readFileSync(join(dir, "config.json"), "utf8")) as Record<string, any>;
  const tour = JSON.parse(readFileSync(join(dir, "tours", "fixture-tour.json"), "utf8")) as Record<string, any>;
  config.app.start = `node --disable-warning=ExperimentalWarning ${JSON.stringify(join(FIXTURES, "serve.ts"))} --port {port}`;
  edit(config, tour);
  writeFileSync(join(dir, "config.json"), JSON.stringify(config, null, 2));
  writeFileSync(join(dir, "tours", "fixture-tour.json"), JSON.stringify(tour, null, 2));
  return { dir: root, tour: join(dir, "tours", "fixture-tour.json") };
}

const beat = (tour: Record<string, any>, id: string) => tour.steps.flatMap((s: { beats: unknown[] }) => s.beats).find((b: { id: string }) => b.id === id);

test("a planted deny-list string and a number the screen doesn't show fail the rehearsal, each naming its beat", async () => {
  const p = scratchProject((config, tour) => {
    config.privacy.deny.push("SAM@example.com");
    beat(tour, "revenue").narration = ["Revenue is tracking seven per cent ahead of plan this quarter."];
  });
  const marker = `deny-${process.pid}`;
  const r = await cli(["rehearse", p.tour, "--out", join(OUT, "deny"), "--json"], { env: env(marker), cwd: p.dir });
  assert.equal(r.code, 1, r.stdout + r.stderr);
  const report = JSON.parse(r.stdout) as Report;
  assert.equal(report.ok, false);
  assert.equal(report.beats.length, 8, "the run still reached every beat");
  const deny = report.problems.filter((x) => x.kind === "deny");
  assert.deepEqual(deny.map((x) => x.beat), ["invite"]);
  assert.match(deny[0]?.message ?? "", /SAM@example\.com/);
  assert.deepEqual(report.deny.clean, false);
  const numbers = report.problems.filter((x) => x.kind === "number");
  assert.deepEqual(numbers.map((x) => [x.beat, x.message]), [["revenue", 'the narration says "seven per cent", which isn\'t on screen']]);
  assert.ok(await eventually(() => chromiumLeft(marker) === "" && !groupAlive(report.app.pid)));
  const human = await cli(["rehearse", p.tour, "--out", join(OUT, "deny-2")], { env: env(`${marker}-h`), cwd: p.dir });
  assert.match(human.stdout, /✗ deny \[invite\]/);
  assert.match(human.stdout, /✗ number \[revenue\]/);
});

test("a missing anchor stops the rehearsal with a screenshot, a DOM excerpt and candidate anchors", async () => {
  const p = scratchProject((_config, tour) => {
    const b = beat(tour, "cookies");
    b.actions[0].target = { role: "button", name: "Accept all cookies" };
    b.actions[0].timeoutMs = 1000;
  });
  const out = join(OUT, "missing");
  const r = await cli(["rehearse", p.tour, "--out", out, "--json"], { env: env(`missing-${process.pid}`), cwd: p.dir });
  assert.equal(r.code, 1, r.stdout + r.stderr);
  const report = JSON.parse(r.stdout) as Report;
  const blocked = report.problems.find((x) => x.kind === "blocked");
  assert.equal(blocked?.beat, "cookies");
  assert.match(blocked?.message ?? "", /Accept all cookies/);
  assert.ok(report.failure);
  assert.ok(existsSync(join(out, report.failure.screenshot)));
  assert.match(readFileSync(join(out, report.failure.dom), "utf8"), /Accept cookies/);
  assert.deepEqual(report.failure.candidates[0]?.anchor, { role: "button", name: "Accept cookies" });
});

test("inspect outlines a page by role and name and suggests anchors that resolve back", async () => {
  const r = await cli(["inspect", `${server.url}/index.html`, "--json"], { env: env(`inspect-${process.pid}`) });
  assert.equal(r.code, 0, r.stderr);
  const report = JSON.parse(r.stdout) as { title: string; items: { role: string; name: string; anchor: unknown; by: string }[] };
  assert.equal(report.title, "Dashboard · Ledgerly");
  const find = (role: string, name: string) => report.items.find((i) => i.role === role && i.name === name);
  assert.deepEqual(find("button", "Invite people")?.anchor, { role: "button", name: "Invite people" });
  assert.deepEqual(find("textbox", "Workspace name")?.anchor, { role: "textbox", name: "Workspace name" });
  assert.deepEqual(find("heading", "Good morning")?.anchor, { role: "heading", name: "Good morning" });
  // "Open Q3 revenue" and "Q3 revenue" share words: the suggestion is still unique.
  assert.equal(find("button", "Open Q3 revenue")?.by, "role");
  const iframe = report.items.find((i) => i.name.startsWith("Approve claim"));
  assert.ok(iframe && (iframe.anchor as { frame?: string }).frame, "elements in a same-origin frame name their frame");
  const roleNamed = report.items.filter((i) => i.by === "role").length;
  assert.ok(roleNamed / report.items.length > 0.8, `most anchors are role and name (${roleNamed}/${report.items.length})`);
  // A path opens on the app (here, one already running).
  const path = await cli(["inspect", "/list.html", "--base", server.url], { env: env(`inspect2-${process.pid}`) });
  assert.equal(path.code, 0, path.stderr);
  assert.match(path.stdout, /link "Pipeline" +\{"role":"link","name":"Pipeline"\}/);
});

test(
  "a headed watch --detach plays the tour and exits cleanly when stopped, leaving nothing behind",
  { skip: process.env.SHOWCASE_NO_HEADED ? "SHOWCASE_NO_HEADED is set" : false },
  async () => {
    const marker = `watch-${process.pid}`;
    const out = join(OUT, "watch");
    const r = await cli(["watch", TOUR, "--detach", "--speed", "10", "--out", out, "--json"], { env: env(marker), cwd: FIXTURES });
    assert.equal(r.code, 0, r.stdout + r.stderr);
    const { pid, progress } = JSON.parse(r.stdout) as { pid: number; progress: string };
    const read = () => (existsSync(progress) ? (JSON.parse(readFileSync(progress, "utf8")) as { status: string; ended: string | null; app: { pid: number | null } | null; error: string | null }) : null);
    const finished = await eventually(() => read()?.ended === "finished" || read()?.status === "failed", 60_000);
    const p = read();
    assert.ok(finished && p?.ended === "finished", `the tour played to its end card: ${JSON.stringify(p)}\n${readFileSync(join(out, "watch.log"), "utf8")}`);
    assert.ok(chromiumLeft(marker) !== "", "a headed Chromium is showing the end card");
    process.kill(pid, "SIGTERM");
    assert.ok(await eventually(() => {
      try {
        process.kill(pid, 0);
        return false;
      } catch {
        return true;
      }
    }), "the watch process exited");
    assert.ok(await eventually(() => chromiumLeft(marker) === ""), "no Chromium left");
    assert.ok(await eventually(() => !groupAlive(p?.app?.pid ?? null)), "the app's process group is gone");
    assert.equal(existsSync(LOCK), false, "the lock was released");
  },
);
