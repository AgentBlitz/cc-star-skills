/**
 * `showcase film` end to end, through `bin/showcase`, on the fixture project.
 *
 * - **Session 7's gate (`--video-only`):** the fixture tour filmed with `--detach`, followed
 *   through `progress.json`, gives a 1920×1080, CFR 30 fps, H.264 High, yuv420p, BT.709-tagged
 *   video whose largest motion gap is at most 100 ms, whose sync probe lands within 0–100 ms and
 *   whose duration equals the timeline's to within a frame; afterwards no app, Chromium or ffmpeg
 *   process is left. A short tour filmed with `--capture worker` proves the fallback.
 * - **Session 8's gate:** voiced with the fake voice, and again with macOS `say`, then
 *   rehearsed, `film --strict` is green on the fixture tour and on the beep-and-flash tour: the
 *   draft film, the SRT equal to the sentences, −16 ± 1 LUFS with true peak ≤ −1 dBTP, and on
 *   the beep beat the caption within 50 ms of the sound (the page's flash is reported too).
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { parseSrt } from "../film/captions.ts";
import type { FilmResult, TimelineFile } from "../film/record.ts";
import { tourSentences } from "../film/post.ts";
import { bandSeries, denyState } from "../film/verify.ts";
import { findFfmpeg } from "../lib/ffmpeg.ts";
import { playHash } from "../lib/tours.ts";
import type { Tour } from "../runtime/src/schema.ts";
import { cli, scratch } from "./helpers.ts";

const FIXTURES = resolve(import.meta.dirname, "..", "fixtures");
const PROJECT = join(FIXTURES, "showcase");
const TOUR = join(PROJECT, "tours", "fixture-tour.json");
const OUT = resolve(import.meta.dirname, ".out", "film");

const env = (marker: string) => ({ HOME: process.env.HOME ?? "", SHOWCASE_RUN_MARKER: marker });

function pgrep(pattern: string): string {
  try {
    return execFileSync("pgrep", ["-f", pattern], { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function alive(pid: number | null | undefined, group = false): boolean {
  if (!pid) return false;
  try {
    process.kill(group ? -pid : pid, 0);
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

function assertGate(t: TimelineFile): void {
  const failed = t.checks.filter((c) => !c.ok);
  assert.deepEqual(failed, [], JSON.stringify(failed));
  const v = t.videoProbe;
  assert.ok(v);
  assert.deepEqual([v.width, v.height, v.codec, v.profile, v.pixFmt, v.rFrameRate, v.avgFrameRate], [1920, 1080, "h264", "High", "yuv420p", "30/1", "30/1"]);
  assert.deepEqual([v.colorSpace, v.colorTransfer, v.colorPrimaries, v.colorRange], ["bt709", "bt709", "bt709", "tv"]);
  assert.ok(t.capture.maxMotionGapMs <= 100, `largest motion gap ${t.capture.maxMotionGapMs} ms`);
  assert.ok(t.probe.offsetMs !== null && t.probe.offsetMs >= 0 && t.probe.offsetMs <= 100, `sync probe ${t.probe.offsetMs} ms`);
  assert.ok(Math.abs(v.durationSec * 1000 - t.durationMs) <= 1000 / 30, `video ${v.durationSec} s, timeline ${t.durationMs} ms`);
  assert.equal(t.capture.frameSize, "1920x1080");
  assert.deepEqual(t.orderProblems, []);
}

/**
 * A copy of the fixture project (its own lock, so the rehearse tests running alongside never
 * meet it), with the app started by absolute path; `edit` may cut the tour down.
 */
function scratchProject(edit: (tour: { steps: { beats: unknown[] }[] }) => void = () => {}, draft?: "fake" | "say"): { root: string; tour: string; lock: string } {
  const root = scratch("showcase-film-");
  const dir = join(root, "showcase");
  cpSync(PROJECT, dir, { recursive: true, filter: (src) => !/[/\\](out|\.cache|\.auth)([/\\]|$)/.test(src) });
  const config = JSON.parse(readFileSync(join(dir, "config.json"), "utf8")) as { app: { start: string }; voice: { draft?: { provider: string } } };
  config.app.start = `node --disable-warning=ExperimentalWarning ${JSON.stringify(join(FIXTURES, "serve.ts"))} --port {port}`;
  if (draft) config.voice.draft = { provider: draft };
  writeFileSync(join(dir, "config.json"), JSON.stringify(config, null, 2));
  const tour = JSON.parse(readFileSync(TOUR, "utf8")) as { steps: { beats: unknown[] }[] };
  edit(tour);
  const file = join(dir, "tours", "fixture-tour.json");
  writeFileSync(file, JSON.stringify(tour, null, 2));
  return { root, tour: file, lock: join(dir, ".cache", "host.lock") };
}

async function noneLeft(t: TimelineFile, marker: string, out: string, lock: string): Promise<void> {
  assert.ok(t.app.pid, "showcase started the app");
  assert.ok(await eventually(() => !alive(t.app.pid, true)), "the app's process group is gone");
  assert.ok(await eventually(() => pgrep(`showcase-run=${marker}`) === ""), `no Chromium left: ${pgrep(`showcase-run=${marker}`)}`);
  assert.equal(pgrep(`ffmpeg.*${out}`), "", "no ffmpeg left");
  assert.equal(existsSync(lock), false, "the lock was released");
}

test("film --strict doesn't go with --video-only", async () => {
  const r = await cli(["film", TOUR, "--video-only", "--strict"], { env: env(`film-usage-${process.pid}`), cwd: FIXTURES });
  assert.equal(r.code, 2);
  assert.match(r.stderr, /--strict/);
});

test("film --video-only --detach on the fixture tour: the gate's video, timeline and progress, nothing left behind", async () => {
  const p = scratchProject();
  const out = join(OUT, "fixture");
  rmSync(out, { recursive: true, force: true });
  const marker = `film-${process.pid}`;
  const r = await cli(["film", p.tour, "--video-only", "--detach", "--out", out, "--json"], { env: env(marker), cwd: p.root });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const started = JSON.parse(r.stdout) as { pid: number; progress: string; log: string };
  assert.equal(started.progress, join(out, "progress.json"));
  const phases = new Set<string>();
  const done = await eventually(() => {
    try {
      const p = JSON.parse(readFileSync(started.progress, "utf8")) as { phase: string };
      phases.add(p.phase);
      return p.phase === "done" || p.phase === "failed";
    } catch {
      return false;
    }
  }, 300_000);
  assert.ok(done, `the film finished (phases: ${[...phases].join(", ")}; log: ${existsSync(started.log) ? readFileSync(started.log, "utf8").slice(-2000) : "none"})`);
  const progress = JSON.parse(readFileSync(started.progress, "utf8")) as { phase: string; video?: string; error?: string };
  assert.equal(progress.phase, "done", progress.error);
  assert.ok(phases.has("rolling") || phases.has("encoding"), [...phases].join(", "));
  assert.ok(await eventually(() => !alive(started.pid), 15_000), "the detached film exited");

  const t = JSON.parse(readFileSync(join(out, "timeline.json"), "utf8")) as TimelineFile;
  assertGate(t);
  assert.equal(t.tour, "fixture-tour");
  assert.equal(t.beats.length, 8);
  assert.equal(t.sentences.length, 10);
  assert.equal(t.navs.filter((n) => n.kind === "load").length, 2, "two page loads mid-take, both exempt");
  assert.equal(t.keyframesMs.length, 8);
  assert.ok(existsSync(join(out, "video.mp4")));
  assert.equal(existsSync(join(out, ".capture")), false, "the frames were cleaned up");
  await noneLeft(t, marker, out, p.lock);
});

test("film --capture worker: the screencast on a raw CDP socket in a worker thread", async () => {
  // The first step's first two beats: a card, then a click.
  const p = scratchProject((tour) => {
    tour.steps = [{ ...(tour.steps[0] as { beats: unknown[] }), beats: (tour.steps[0]?.beats ?? []).slice(0, 2) }];
  });
  const out = join(OUT, "worker");
  const marker = `film-worker-${process.pid}`;
  const r = await cli(["film", p.tour, "--video-only", "--capture", "worker", "--out", out, "--json"], { env: env(marker), cwd: p.root });
  assert.equal(r.code, 0, r.stdout.slice(-3000) + r.stderr);
  const result = JSON.parse(r.stdout) as { ok: boolean; timeline: TimelineFile };
  assert.equal(result.ok, true);
  assert.equal(result.timeline.capture.mode, "worker");
  assert.ok(result.timeline.capture.frames > 0);
  assertGate(result.timeline);
  await noneLeft(result.timeline, marker, out, p.lock);
});

/** When the page turns green: the first frame whose top-left corner drops well below its first frame's luma. */
async function flashMs(video: string): Promise<number | null> {
  const { ffmpeg } = findFfmpeg();
  assert.ok(ffmpeg);
  const lum = (await bandSeries(ffmpeg, video, { x: 16, y: 16, w: 160, h: 20 })).map((f) => f.reduce((a, b) => a + b, 0) / f.length);
  const k = lum.findIndex((v) => v < (lum[0] as number) - 40);
  return k < 0 ? null : Math.round((k * 1000) / 30 * 10) / 10;
}

type Report = NonNullable<FilmResult["report"]>;

/** Voices and rehearses both tours with `provider`, then films each with --strict. */
async function finishedFilms(provider: "fake" | "say"): Promise<void> {
  const p = scratchProject(undefined, provider);
  const marker = `film-${provider}-${process.pid}`;
  for (const id of ["fixture-tour", "sync-tour"]) {
    const v = await cli(["voice", id, "--draft"], { env: env(marker), cwd: p.root });
    assert.equal(v.code, 0, v.stdout + v.stderr);
    const h = await cli(["rehearse", id], { env: env(marker), cwd: p.root });
    assert.equal(h.code, 0, h.stdout.slice(-2000) + h.stderr);
  }
  for (const id of ["fixture-tour", "sync-tour"]) {
    const out = join(p.root, "showcase", "out", id);
    const r = await cli(["film", id, "--strict", "--json"], { env: env(marker), cwd: p.root });
    const result = JSON.parse(r.stdout || "{}") as FilmResult & { out: string };
    const report = result.report as Report;
    assert.ok(report, r.stdout.slice(-3000) + r.stderr);
    assert.deepEqual(report.checks.filter((c) => c.level !== "ok"), [], `${provider} ${id}`);
    assert.equal(r.code, 0);
    assert.equal(result.ok, true);
    assert.equal(report.strict, true);
    assert.ok(result.timeline);
    assertGate(result.timeline);

    // The draft: the fixture has no approved narrator, so only the watermarked film exists.
    assert.equal(report.draft, true);
    assert.equal(report.outputs.film, `${id}-draft.mp4`);
    assert.equal(existsSync(join(out, `${id}.mp4`)), false);
    for (const f of [`${id}-draft.mp4`, "video.mp4", `${id}.srt`, "script.md", "report.json", "report.md", "contact-sheet.png", "timeline.json"]) assert.ok(existsSync(join(out, f)), f);
    assert.equal(report.stills.length, result.timeline.beats.length);
    for (const s of report.stills) assert.ok(existsSync(join(out, s.file)), s.file);
    assert.equal(existsSync(join(out, ".post")), false, "the post dir was cleaned up");

    // The SRT equals the sentences.
    const tour = JSON.parse(readFileSync(join(p.root, "showcase", "tours", `${id}.json`), "utf8")) as Tour;
    assert.deepEqual(parseSrt(readFileSync(join(out, `${id}.srt`), "utf8")).map((c) => c.text), tourSentences(tour));

    // −16 ± 1 LUFS, true peak ≤ −1 dBTP.
    const { integratedLufs: lufs, truePeakDb: tp } = report.loudness;
    assert.ok(lufs !== null && Math.abs(lufs + 16) <= 1, `${provider} ${id}: ${lufs} LUFS`);
    assert.ok(tp !== null && tp <= -1, `${provider} ${id}: ${tp} dBTP`);

    if (id === "sync-tour") {
      // The beep-and-flash beat: the caption within 50 ms of the sound; the flash reported.
      const beep = report.sync.find((s) => s.beat === "beep");
      assert.ok(beep && beep.deltaMs !== null && beep.audioMs !== null, JSON.stringify(report.sync));
      assert.ok(Math.abs(beep.deltaMs) <= 50, `${provider}: caption ${beep.captionMs} ms, sound ${beep.audioMs} ms`);
      const flash = await flashMs(join(out, "video.mp4"));
      assert.ok(flash !== null, "the flash is in the picture");
      console.log(`# ${provider} beep: sentence ${beep.startMs} ms, caption ${beep.captionMs} ms, sound ${beep.audioMs} ms, flash ${flash} ms (picture − sound ${Math.round((flash - beep.audioMs) * 10) / 10} ms)`);
      assert.ok(Math.abs(flash - beep.audioMs) <= 100, `${provider}: flash ${flash} ms, sound ${beep.audioMs} ms`);
    }
    await noneLeft(result.timeline, marker, out, p.lock);
  }
}

test("film --strict with the fake voice: the fixture tour and the beep-and-flash tour, finished and verified", async () => {
  await finishedFilms("fake");
});

test("film --strict with macOS say: the same films with a real draft voice", { skip: existsSync("/usr/bin/say") ? false : "no `say` here" }, async () => {
  await finishedFilms("say");
});

test("a rehearse stays current through an approval, not through a change to what plays", () => {
  const out = scratch("showcase-deny-");
  const tourFile = join(out, "t.json");
  const tour = JSON.parse(readFileSync(TOUR, "utf8")) as Tour;
  writeFileSync(tourFile, JSON.stringify(tour));
  const report = (extra: object) =>
    writeFileSync(join(out, "rehearse.json"), JSON.stringify({ at: new Date(Date.now() - 60_000).toISOString(), deny: { clean: true, checked: 3 }, ...extra }));
  report({ tourHash: playHash(tour) });
  // Recording an approval rewrites the file (newer than the rehearse) but changes nothing that plays.
  const approved: Tour = { ...tour, meta: { ...tour.meta, approved: { storyboard: "2026-10-09" } } };
  writeFileSync(tourFile, JSON.stringify(approved));
  assert.deepEqual([denyState(out, tourFile, approved).stale, denyState(out, tourFile, approved).clean], [false, true]);
  // A changed sentence is stale.
  const edited = structuredClone(approved);
  edited.steps[0]!.title = "Something else";
  assert.equal(denyState(out, tourFile, edited).stale, true);
  // A report from before the hash: the file's time decides, as it did.
  report({});
  assert.equal(denyState(out, tourFile, approved).stale, true);
  utimesSync(tourFile, new Date(Date.now() - 120_000), new Date(Date.now() - 120_000));
  assert.equal(denyState(out, tourFile, approved).stale, false);
});
