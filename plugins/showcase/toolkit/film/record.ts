/**
 * `showcase film` (PLAN §2.5): one take of a tour from the real app, made into a constant-frame-
 * rate H.264 video lined up with the tour's timeline, then into the finished, verified film.
 *
 * **The take.** The production build (`app.build` runs first unless `--no-build`), on its own
 * port, after `snapshot` and `reset`, once `health` answers. Headless Chromium at the configured
 * scale (S-D1) with `--force-device-scale-factor`, `--force-color-profile=srgb`, the locale,
 * timezone and colour scheme, a fixed clock and `reducedMotion: 'no-preference'`; with
 * `browser.gpu: "required"` a software renderer is refused.
 *
 * **The sequence.**
 * 1. The runtime arms: fonts, then a still screen, then `film:armed`. The recorder then waits
 *    for 400 ms with no new screencast frames (that covers canvases too).
 * 2. The clock-sync probe: a flash at a known wall time, found in the frames.
 * 3. The screen goes still again; the pre-roll starts (time 0 of the video): the heartbeat goes
 *    on, and 750 ms later `__showcaseGo()`.
 * 4. A watchdog: the whole take may run `max(3 × plan, plan + 120 s)`, and 30 s without an event
 *    is a stall.
 * 5. `film:end`, then a 1.2 s tail; the capture stops and the app and browser go.
 * 6. The frames are measured (gaps, frame rate, the probe) and scheduled at 30 fps.
 * 7. Unless `--video-only`: the voice is mixed and normalised, the captions and chapters are
 *    written (`post.ts`), and the picture and the master are encoded side by side.
 * 8. Verify (`verify.ts`): the master is measured, the stills, contact sheet, `script.md` and
 *    report are written; `--strict` fails on any warning.
 *
 * Outputs in `showcase/out/<tour>/`: `<tour>.mp4` or `<tour>-draft.mp4`, `video.mp4` (the
 * picture), `<tour>.srt`, `script.md`, `stills/`, `contact-sheet.png`, `report.json`,
 * `report.md` and `timeline.json`; `progress.json` all along. A failed take leaves `error.png`
 * and `timeline.partial.json`.
 */
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { findFfmpeg } from "../lib/ffmpeg.ts";
import { freePort } from "../host/app.ts";
import { type Host, isSoftwareRenderer, launchHost, rendererOf } from "../host/launch.ts";
import { appUrl, browserSettings, openSession, type Project, voiceFor } from "../host/project.ts";
import { publishedTourProblem } from "../lib/vendor.ts";
import { deepLink } from "../runtime/src/in-app.ts";
import { type FilmEvent, filmOrderProblems } from "../runtime/src/film-events.ts";
import { beatPlanMs } from "../runtime/src/narrative.ts";
import { beatsOf, type Tour } from "../runtime/src/schema.ts";
import { type Capture, type CaptureMode, type CaptureStats, JPEG_QUALITY, startCapture } from "./capture.ts";
import { cfrCount, cfrSchedule, fpsWindows, frameGaps, percentile } from "./cfr.ts";
import { encodeVideo, HEIGHT, killTools, patchColours, probeVideo, type VideoProbe, WIDTH } from "./encode.ts";
import { srtProblems } from "./captions.ts";
import type { FrameRecord } from "./frames.ts";
import { preparePost, tourSentences, voiceInfo } from "./post.ts";
import { scriptMd } from "./script.ts";
import { type Spans, spans } from "./timeline.ts";
import { denyState, isFaststart, measureMaster, probeMaster, type Report, rel, stillTimes, type VerifyCheck, verifyChecks, writeReport, writeStills } from "./verify.ts";

export const FPS = 30;
export const PRE_ROLL_MS = 750;
export const TAIL_MS = 1_200;
export const STILL_MS = 400;
export const STALL_MS = 30_000;
export const MAX_MOTION_GAP_MS = 100;
/** The probe is good when its frame lands this long after the page's wall time, or less. */
export const PROBE_WINDOW_MS: readonly [number, number] = [0, 100];

export interface FilmOptions {
  project: Project;
  tour: Tour;
  out: string;
  /** Run `app.build` first (default: yes, when there is one). */
  build?: boolean;
  reset?: boolean;
  /** An app already running. */
  url?: string;
  capture?: CaptureMode;
  keepFrames?: boolean;
  /** Where progress goes (default `<out>/progress.json`). */
  progress?: string;
  assetsDir?: string;
  marker?: string;
  say?: (line: string) => void;
  /** The picture only (`--video-only`): no sound, captions, sidecars or verify. */
  videoOnly?: boolean;
  /** Any warning fails the film (`--strict`). */
  strict?: boolean;
  /** The tour's file, to tell whether the last rehearse is older than it. */
  tourFile?: string;
  /**
   * `--in-app`: film the app's own vendored tour, opened at `?showcase=<id>&showcaseMode=film`,
   * with nothing injected. The same contract (binding, events, `__showcaseGo`) carries the take.
   */
  inApp?: boolean;
}

export interface Check {
  id: string;
  ok: boolean;
  detail: string;
}

export interface CaptureReport extends CaptureStats {
  quality: number;
  renderer: string;
  frameSize: string | null;
  /** Captured frames over the take (pre-roll to tail). */
  takeFrames: number;
  fpsMedian: number;
  fpsP5: number;
  maxGapMs: number;
  maxGapAtMs: number | null;
  /** The largest gap that isn't a page load's held frame. */
  maxMotionGapMs: number;
  maxMotionGapAtMs: number | null;
  /** Page loads' held frames longer than one video frame: exempt from the motion-gap check (S-D4). */
  navGaps: { atMs: number; ms: number }[];
  /** The page's own frame rate (its heartbeat's animation frames). */
  pageFps: number | null;
  /** Where the page itself stalled (an animation frame over 50 ms late), in video time. */
  pageStalls: { atMs: number; ms: number }[];
  mbPerSec: number;
}

export interface TimelineFile extends Spans {
  v: 1;
  tour: string;
  at: string;
  url: string;
  app: { pid: number | null; port: number | null };
  fps: number;
  /** The pre-roll's start: the video's time 0 (epoch ms). */
  t0: number;
  durationMs: number;
  frames: number;
  preRollMs: number;
  tailMs: number;
  video: string;
  keyframesMs: number[];
  probe: { wall: number; frameTs: number | null; offsetMs: number | null };
  capture: CaptureReport;
  videoProbe: VideoProbe | null;
  armed: Extract<FilmEvent, { type: "film:armed" }> | null;
  orderProblems: string[];
  checks: Check[];
  notes: string[];
}

export interface FilmResult {
  ok: boolean;
  timeline: TimelineFile | null;
  /** The picture, when one was made. */
  video: string | null;
  /** The finished film (`<tour>.mp4` or `<tour>-draft.mp4`), when one was made. */
  master: string | null;
  report: Report | null;
  error: string | null;
  notes: string[];
  ms: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

/** Production-build guidance: dev servers draw overlays and hot-reload into the film. */
export function buildNotes(app: Project["config"]["app"]): string[] {
  const notes: string[] = [];
  const start = app.start ?? "";
  if (/\b(next|nuxt|astro|remix)\s+dev\b|\bvite(?!\s+preview)(\s|$)|\bnpm run dev\b|\b(pnpm|yarn|bun)( run)? dev\b|webpack(-dev-server| serve)/.test(start)) {
    notes.push(`app.start looks like a dev server (${start}): film the production build, because dev overlays and hot reloads show up in the video`);
  }
  if (app.start && !app.build) notes.push("there's no app.build: the film runs app.start as it is");
  return notes;
}

interface Progress {
  phase: string;
  beat?: string | null;
  beatIndex?: number;
  frames?: number;
  error?: string;
  video?: string;
  timeline?: string;
}

function progressWriter(file: string, base: { tour: string; beatCount: number }) {
  const started = Date.now();
  return (p: Progress) => {
    const body = { v: 1, ...base, pid: process.pid, at: new Date().toISOString(), elapsedMs: Date.now() - started, ...p };
    const tmp = `${file}.tmp`;
    try {
      writeFileSync(tmp, `${JSON.stringify(body, null, 2)}\n`);
      renameSync(tmp, file);
    } catch {
      // Progress is a courtesy; the take goes on.
    }
  };
}

function isProbeColour([r, g, b]: [number, number, number]): boolean {
  return r > 200 && g < 70 && b > 200;
}

export async function film(o: FilmOptions): Promise<FilmResult> {
  const started = Date.now();
  const say = o.say ?? (() => {});
  const { tour, project: p } = o;
  const notes: string[] = [...buildNotes(p.config.app)];
  for (const n of notes) say(`note: ${n}`);
  const all = beatsOf(tour);
  const progress = progressWriter(o.progress ?? join(o.out, "progress.json"), { tour: tour.id, beatCount: all.length });
  progress({ phase: "starting" });
  if (o.inApp && o.tourFile) {
    const stale = publishedTourProblem(p.root, p.config.voice.dir, o.tourFile, tour.id);
    if (stale) throw new Error(stale);
  }
  const { ffmpeg, ffprobe } = findFfmpeg();
  if (!ffmpeg || !ffprobe) throw new Error("ffmpeg and ffprobe are needed: `brew install ffmpeg` (run `showcase doctor`)");
  const mode = o.capture ?? "auto";
  const cap = join(o.out, ".capture");
  rmSync(cap, { recursive: true, force: true });
  mkdirSync(cap, { recursive: true });
  const outputs = ["video.mp4", "timeline.json", "timeline.partial.json", "error.png", `${tour.id}.mp4`, `${tour.id}-draft.mp4`, `${tour.id}.srt`, "script.md", "report.json", "report.md", "contact-sheet.png", "stills", ".post"];
  for (const f of outputs) rmSync(join(o.out, f), { recursive: true, force: true });

  const session = await openSession(p, {
    what: `film ${tour.id}`,
    build: o.build !== false && !!p.config.app.build,
    ...(o.reset === false ? { reset: false } : {}),
    ...(o.url ? { url: o.url } : {}),
    logFile: join(o.out, "app.log"),
    say,
  });
  let host: Host | null = null;
  let capture: Capture | null = null;
  let captureStats: CaptureStats | null = null;
  const stopCapture = async () => {
    if (capture && !captureStats) captureStats = await capture.stop();
    return captureStats;
  };
  session.onStop(async () => {
    killTools();
    await stopCapture().catch(() => null);
    await host?.close();
  });

  const failWith = async (message: string, events: readonly FilmEvent[], t0: number | null) => {
    progress({ phase: "failed", error: message });
    try {
      if (host) await host.page.screenshot({ path: join(o.out, "error.png") });
    } catch {
      // The page is gone.
    }
    writeFileSync(join(o.out, "timeline.partial.json"), `${JSON.stringify({ v: 1, tour: tour.id, error: message, t0, ...spans(events, t0 ?? 0), notes }, null, 2)}\n`);
    return { ok: false, timeline: null, video: null, master: null, report: null, error: message, notes, ms: Date.now() - started } satisfies FilmResult;
  };

  try {
    const voice = voiceFor(p, tour);
    if (!voice.manifest) notes.push("no voice manifest: sentences last their reading time (run `showcase voice` first for the narrator's timing)");
    const debugPort = mode === "main" ? null : await freePort();
    const first = o.inApp ? appUrl(session.app.url, deepLink(tour.steps[0]?.path ?? "/", { tour: tour.id, mode: "film" })) : appUrl(session.app.url, tour.steps[0]?.path);
    say(`filming ${tour.id}: ${first}`);
    progress({ phase: "launching" });
    host = await launchHost({
      url: first,
      tour,
      mode: "film",
      pointer: p.config.film.pointer,
      manifest: voice.manifest,
      ...(voice.dir ? { voiceDir: voice.dir } : {}),
      headless: true,
      browser: browserSettings(p),
      assetsDir: o.assetsDir ?? p.showcaseDir ?? p.root,
      args: ["--force-color-profile=srgb", ...(debugPort ? [`--remote-debugging-port=${debugPort}`] : [])],
      ...(o.marker ? { marker: o.marker } : {}),
      ...(o.inApp ? { inject: false } : {}),
    });
    const h = host;
    const renderer = await rendererOf(h.page).catch(() => "unknown");
    if (isSoftwareRenderer(renderer)) notes.push(`the renderer is ${renderer}: WebGL and canvas motion may be slow (set browser.gpu to "required" to refuse it)`);
    capture = await startCapture({ page: h.page, context: h.context, dir: cap, mode, debugPort, say });
    const c = capture;

    // 1. Armed, then still.
    progress({ phase: "arming" });
    const armedOrError = await h.waitForEvent("film:armed", { timeoutMs: 90_000 }).catch(() => null);
    const early = h.events.find((e) => e.type === "film:error");
    if (early || !armedOrError || armedOrError.type !== "film:armed") {
      const never = o.inApp ? "the page never armed (no film:armed in 90 s): is the runtime vendored and <ShowcaseTour /> (or the snippet) on the page?" : "the page never armed (no film:armed in 90 s)";
      return await failWith(early?.type === "film:error" ? `film:error before the take: ${early.message}` : never, h.events, null);
    }
    const armed = armedOrError;
    if (armed.tour !== tour.id) return await failWith(`armed for tour ${armed.tour}, not ${tour.id}`, h.events, null);
    const { w, h: vh, dpr } = armed.viewport;
    if (Math.round(w * dpr) !== WIDTH || Math.round(vh * dpr) !== HEIGHT) notes.push(`the page is ${w}×${vh} at DPR ${dpr}, not ${WIDTH}×${HEIGHT} device pixels: frames are scaled`);
    if (!(await c.quiet(STILL_MS, 5_000))) notes.push("the screen never went still for 400 ms before the take (something animates all the time)");

    // 2. The clock-sync probe.
    progress({ phase: "probing" });
    const probe = (await h.page.evaluate("__showcase.film.probe(200)")) as { wall: number };
    await c.quiet(STILL_MS, 3_000);

    // 3. The pre-roll: the video's time 0.
    await h.context.addInitScript({ content: "window.__showcaseRolling = true;" });
    await h.page.evaluate("(window.__showcaseRolling = true, __showcase.film.heartbeat(true))");
    c.monitor();
    const t0 = Date.now();
    progress({ phase: "rolling", beatIndex: 0 });
    say(`rolling (pre-roll ${PRE_ROLL_MS} ms)`);
    await sleep(PRE_ROLL_MS);
    await h.go();

    // 4. The watchdog.
    const planned = all.reduce((ms, { beat }) => ms + beatPlanMs(beat), 0);
    const limit = Math.max(3 * planned, planned + 120_000);
    const pageRates = new Map<number, { frames: number; ms: number; stalls: { wall: number; ms: number }[] }>();
    let seen = h.events.length;
    let lastEventAt = Date.now();
    let lastSample = 0;
    let end: FilmEvent | null = null;
    let failure: string | null = null;
    while (!end && !failure) {
      await sleep(100);
      const now = Date.now();
      if (h.events.length !== seen) {
        for (const e of h.events.slice(seen)) {
          if (e.type === "beat:start") {
            say(`  ${String(e.index + 1).padStart(2)} ${e.beat}`);
            progress({ phase: "rolling", beat: e.beat, beatIndex: e.index, frames: c.frames().length });
          }
        }
        seen = h.events.length;
        lastEventAt = now;
      }
      end = h.events.find((e) => e.type === "film:end" || e.type === "film:error") ?? null;
      if (end) break;
      if (!h.browser.isConnected()) failure = "the browser went away mid-take";
      else if (now - lastEventAt > STALL_MS) failure = `the watchdog: no event for ${STALL_MS / 1000} s (last: ${h.events.at(-1)?.type ?? "none"})`;
      else if (now - t0 > limit) failure = `the watchdog: the take ran past ${Math.round(limit / 1000)} s`;
      if (now - lastSample >= 1_000) {
        lastSample = now;
        try {
          const r = (await h.page.evaluate("({ origin: performance.timeOrigin, ...__showcase.film.frameRate() })")) as { origin: number; frames: number; ms: number; stalls: { wall: number; ms: number }[] };
          if (r.frames > 0) pageRates.set(r.origin, { frames: r.frames, ms: r.ms, stalls: r.stalls });
        } catch {
          // Mid-load: the next sample will do.
        }
      }
    }
    if (failure || !end || end.type === "film:error") {
      const message = failure ?? (end?.type === "film:error" ? `film:error${end.beat ? ` in beat ${end.beat}` : ""}: ${end.message}` : "the take ended without film:end");
      await stopCapture();
      return await failWith(message, h.events, t0);
    }

    // 5. The tail.
    const t1 = end.wall + TAIL_MS;
    progress({ phase: "tail" });
    await sleep(t1 - Date.now() + 150);
    const stats = (await stopCapture()) as CaptureStats;
    const events = [...h.events];
    await h.close();
    host = null;
    await session.close();

    // 6. Measure, schedule, encode.
    progress({ phase: "encoding", frames: stats.frames });
    const frames: FrameRecord[] = c.frames();
    writeFileSync(join(cap, "frames.json"), `${JSON.stringify(frames)}\n`);
    const ts = frames.map((f) => f.ts);
    const take = frames.filter((f) => f.ts >= t0 && f.ts <= t1);
    const navLoads = events.filter((e) => e.type === "nav" && e.kind === "load").map((e) => e.wall);
    const gaps = frameGaps(ts, t0, t1, navLoads);
    const motion = gaps.find((g) => !g.nav) ?? null;
    const fps = fpsWindows(ts, t0, t1);
    const sizes = new Map<string, number>();
    for (const f of take) sizes.set(`${f.w}x${f.h}`, (sizes.get(`${f.w}x${f.h}`) ?? 0) + 1);
    const frameSize = [...sizes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const rates = [...pageRates.values()];
    const rateMs = rates.reduce((n, r) => n + r.ms, 0);
    const bytes = take.reduce((n, f) => n + f.bytes, 0);

    // The probe: the first frame with the flash in it.
    const near = frames.filter((f) => f.ts >= probe.wall - 300 && f.ts <= probe.wall + 1_000);
    const colours = await patchColours(ffmpeg, near.map((f) => join(cap, f.file)), cap);
    const hit = near.find((_, i) => colours[i] && isProbeColour(colours[i]));
    const probeOffset = hit ? r1(hit.ts - probe.wall) : null;

    const schedule = cfrSchedule(ts, FPS, t0, t1);
    const video = join(o.out, "video.mp4");
    const spanned = spans(events, t0);
    const keyframesMs = spanned.beats.map((b) => b.startMs).filter((ms) => ms > 0);
    const durationMs = t1 - t0;
    const videoMs = (schedule.length * 1000) / FPS;

    // 7. The sound, captions and chapters (not with --video-only).
    const vi = o.videoOnly ? null : voiceInfo(p, voice.manifest, spanned);
    const master = vi ? join(o.out, `${tour.id}${vi.draft ? "-draft" : ""}.mp4`) : null;
    const post =
      vi && master
        ? await (async () => {
            progress({ phase: "mixing", frames: stats.frames });
            say(`mixing ${spanned.sentences.filter((x) => x.audio).length} clip(s); captions and chapters`);
            return preparePost({ ffmpeg, out: o.out, tour, spans: spanned, durationMs: videoMs, manifest: voice.manifest, voiceDir: voice.dir, draft: vi.draft });
          })()
        : null;
    progress({ phase: "encoding", frames: stats.frames });
    say(`encoding ${schedule.length} frames at ${FPS} fps${master ? ` (the picture and ${relative(o.out, master)})` : ""}`);
    await encodeVideo({
      ffmpeg,
      frames: schedule.map((i) => join(cap, (frames[i] as FrameRecord).file)),
      workDir: cap,
      fps: FPS,
      keyframes: keyframesMs.map((ms) => ms / 1000),
      out: video,
      ...(post && master ? { master: { ...post.master, out: master } } : {}),
    });
    const vp = await probeVideo(ffprobe, video);

    const frameMs = 1000 / FPS;
    const captureReport: CaptureReport = {
      ...stats,
      quality: JPEG_QUALITY,
      renderer,
      frameSize,
      takeFrames: take.length,
      fpsMedian: percentile(fps, 50),
      fpsP5: percentile(fps, 5),
      maxGapMs: r1(gaps[0]?.ms ?? 0),
      maxGapAtMs: gaps[0] ? r1(gaps[0].from - t0) : null,
      maxMotionGapMs: r1(motion?.ms ?? 0),
      maxMotionGapAtMs: motion ? r1(motion.from - t0) : null,
      navGaps: gaps.filter((g) => g.nav && g.ms > frameMs).map((g) => ({ atMs: r1(g.from - t0), ms: r1(g.ms) })),
      pageFps: rateMs > 0 ? r1((rates.reduce((n, r) => n + r.frames, 0) / rateMs) * 1000) : null,
      pageStalls: rates.flatMap((r) => r.stalls).map((s) => ({ atMs: r1(s.wall - s.ms - t0), ms: s.ms })),
      mbPerSec: r1(bytes / 1e6 / (durationMs / 1000)),
    };
    const orderProblems = filmOrderProblems(events);
    const checks: Check[] = [
      { id: "size", ok: vp.width === WIDTH && vp.height === HEIGHT, detail: `${vp.width}×${vp.height}` },
      { id: "cfr", ok: vp.rFrameRate === `${FPS}/1` && vp.avgFrameRate === `${FPS}/1`, detail: `r ${vp.rFrameRate}, avg ${vp.avgFrameRate}` },
      { id: "codec", ok: vp.codec === "h264" && vp.profile === "High" && vp.pixFmt === "yuv420p", detail: `${vp.codec} ${vp.profile} ${vp.pixFmt}` },
      {
        id: "colour",
        ok: vp.colorSpace === "bt709" && vp.colorTransfer === "bt709" && vp.colorPrimaries === "bt709" && vp.colorRange === "tv",
        detail: `matrix ${vp.colorSpace}, transfer ${vp.colorTransfer}, primaries ${vp.colorPrimaries}, range ${vp.colorRange}`,
      },
      { id: "frames", ok: vp.frames === cfrCount(t0, t1, FPS), detail: `${vp.frames} frames (scheduled ${cfrCount(t0, t1, FPS)})` },
      { id: "duration", ok: Math.abs(vp.durationSec * 1000 - durationMs) <= frameMs, detail: `video ${(vp.durationSec * 1000).toFixed(1)} ms, timeline ${durationMs} ms` },
      { id: "motion-gap", ok: captureReport.maxMotionGapMs <= MAX_MOTION_GAP_MS, detail: `largest ${captureReport.maxMotionGapMs} ms${captureReport.maxMotionGapAtMs !== null ? ` at ${captureReport.maxMotionGapAtMs} ms` : ""}; ${captureReport.navGaps.length} page-load hold(s) exempt` },
      { id: "sync-probe", ok: probeOffset !== null && probeOffset >= PROBE_WINDOW_MS[0] && probeOffset <= PROBE_WINDOW_MS[1], detail: probeOffset === null ? "the flash wasn't found in the frames" : `${probeOffset} ms` },
      { id: "order", ok: orderProblems.length === 0, detail: orderProblems.length ? orderProblems.slice(0, 3).join("; ") : "valid" },
      { id: "keyframes", ok: keyframesMs.every((ms) => vp.keyframes.some((k) => Math.abs(k * 1000 - ms) <= frameMs)), detail: `${keyframesMs.length} beat starts, ${vp.keyframes.length} keyframes` },
    ];
    const timeline: TimelineFile = {
      v: 1,
      tour: tour.id,
      at: new Date(started).toISOString(),
      url: session.app.url,
      app: { pid: session.app.pid, port: session.app.port },
      fps: FPS,
      t0,
      durationMs,
      frames: schedule.length,
      preRollMs: PRE_ROLL_MS,
      tailMs: TAIL_MS,
      video: relative(o.out, video),
      keyframesMs,
      ...spanned,
      probe: { wall: probe.wall, frameTs: hit?.ts ?? null, offsetMs: probeOffset },
      capture: captureReport,
      videoProbe: vp,
      armed,
      orderProblems,
      checks,
      notes,
    };
    writeFileSync(join(o.out, "timeline.json"), `${JSON.stringify(timeline, null, 2)}\n`);
    if (!o.keepFrames) rmSync(cap, { recursive: true, force: true });

    // 8. Verify, stills, the script and the report.
    let report: Report | null = null;
    if (vi && master && post) {
      progress({ phase: "verifying" });
      say("verifying: loudness, silences, captions against sound; stills and the contact sheet");
      const [mp, measured] = await Promise.all([probeMaster(ffprobe, master), measureMaster(ffmpeg, { master, picture: video, sentences: spanned.sentences, fps: FPS })]);
      const times = stillTimes(spanned.beats, spanned.sentences);
      const { stills, contactSheet } = await writeStills(ffmpeg, master, o.out, spanned.beats, times);
      writeFileSync(join(o.out, "script.md"), scriptMd({ tour: tour.id, title: tour.title, durationMs: videoMs, voice: vi.label, draft: vi.draft, video: relative(o.out, master), at: new Date(started).toISOString() }, spanned.beats, spanned.sentences));
      const sentences = tourSentences(tour);
      const picture: VerifyCheck[] = checks.map((x) => ({ id: x.id, level: x.ok ? "ok" : "fail", detail: x.detail }));
      const all = [
        ...picture,
        ...verifyChecks({
          durationMs: videoMs,
          targetSec: tour.meta.length.targetSec,
          measured,
          srtProblems: srtProblems(post.srt, sentences, videoMs),
          sentenceCount: sentences.length,
          missingClips: post.missingClips,
          silentSentences: spanned.sentences.filter((x) => !x.audio).length,
          master: mp,
          faststart: isFaststart(master),
          beats: spanned.beats.length,
          deny: denyState(o.out, o.tourFile ?? null, o.tour),
        }),
      ];
      const failed = all.filter((x) => x.level === "fail" || (o.strict && x.level === "warn"));
      report = {
        v: 1,
        tour: tour.id,
        title: tour.title,
        at: new Date(started).toISOString(),
        ok: failed.length === 0,
        strict: !!o.strict,
        draft: vi.draft,
        draftReasons: vi.reasons,
        voice: vi.label,
        durationMs: videoMs,
        outputs: {
          film: rel(o.out, master),
          picture: rel(o.out, video),
          srt: `${tour.id}.srt`,
          script: "script.md",
          timeline: "timeline.json",
          contactSheet: rel(o.out, contactSheet),
          stills: stills.map((x) => relative(o.out, x)),
        },
        checks: all,
        loudness: { ...measured.loudness, loudnorm: post.loudnorm },
        silence: measured.silence,
        sync: measured.sync,
        stills: spanned.beats.map((b, i) => ({ beat: b.beat, atMs: times[i] as number, file: relative(o.out, stills[i] as string), narration: spanned.sentences.filter((x) => x.beat === b.beat).map((x) => x.text) })),
        deny: denyState(o.out, o.tourFile ?? null, o.tour),
        notes,
      };
      writeReport(o.out, report);
      rmSync(post.master.cwd, { recursive: true, force: true });
    }
    const failedIds = report ? report.checks.filter((x) => x.level === "fail" || (o.strict && x.level === "warn")).map((x) => x.id) : checks.filter((x) => !x.ok).map((x) => x.id);
    const ok = failedIds.length === 0;
    progress({ phase: ok ? "done" : "failed", video: relative(o.out, master ?? video), timeline: "timeline.json", ...(ok ? {} : { error: failedIds.join(", ") }) });
    return { ok, timeline, video, master, report, error: ok ? null : `checks failed: ${failedIds.join(", ")}`, notes, ms: Date.now() - started };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    killTools();
    await stopCapture().catch(() => null);
    return await failWith(message, host?.events ?? [], null);
  } finally {
    killTools();
    await stopCapture().catch(() => null);
    await host?.close();
    await session.close();
    if (!o.keepFrames && existsSync(cap) && readdirSync(cap).length === 0) rmSync(cap, { recursive: true, force: true });
  }
}

/** The result as terse lines (C7). */
export function filmLines(r: FilmResult): string[] {
  const t = r.timeline;
  if (!t) return [`FAILED: ${r.error ?? "unknown"}`, ...r.notes.map((n) => `  · ${n}`)];
  const c = t.capture;
  const mark = { ok: "✓", warn: "⚠", fail: "✗" } as const;
  return [
    `${r.ok ? "ok" : "FAILED"}: ${t.tour}, ${(t.durationMs / 1000).toFixed(2)} s, ${t.frames} frames at ${t.fps} fps, ${t.beats.length} beats (${(r.ms / 1000).toFixed(1)} s)`,
    ...(r.report ? [`  film: ${r.report.outputs.film}${r.report.draft ? ` (draft: ${r.report.draftReasons.join("; ")})` : ""} · ${r.report.voice}`] : []),
    `  capture: ${c.mode}, ${c.frameSize ?? "?"}, median ${c.fpsMedian} fps (p5 ${c.fpsP5}), page ${c.pageFps ?? "?"} fps, largest motion gap ${c.maxMotionGapMs} ms, event loop p99 ${c.eventLoopP99Ms ?? "?"} ms`,
    `  sync probe: ${t.probe.offsetMs ?? "not found"} ms · renderer: ${c.renderer}`,
    ...(r.report ? r.report.checks.map((x) => `  ${mark[x.level]} ${x.id}: ${x.detail}`) : t.checks.map((x) => `  ${x.ok ? "✓" : "✗"} ${x.id}: ${x.detail}`)),
    ...(r.report ? ["  then read contact-sheet.png and each still in stills/ against its narration (report.md lists them)"] : []),
    ...r.notes.map((n) => `  · ${n}`),
  ];
}
