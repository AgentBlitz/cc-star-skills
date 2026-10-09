/**
 * `showcase rehearse` (PLAN §2.2): Claude's authoring loop. A fast headless run of the tour with
 * no capture, in Watch mode without controls. At each beat, once its actions are done and its
 * `ready` is met, the page stops at a checkpoint and the host:
 *
 * - takes the beat's still (pointer, spotlight, callout, the beat's last caption, any card);
 * - checks that every number the beat says is in its visible text (`spokenNumbers:
 *   "on-screen-only"`, the default);
 * - scans the visible text for the deny-list (`privacy.deny`).
 *
 * Every anchor is resolved as the tour plays, so one that doesn't resolve stops the run. On a
 * failure it saves a screenshot, a DOM excerpt and candidate anchors from the page's outline.
 * The report goes to `out/<id>/rehearse.json`; the film's verify reads its deny-list result.
 *
 * `--synthetic` plays with synthetic input only, as an in-app tour does, and lists the actions
 * synthetic input can't do (a problem) or may not do (a note to check): `syntheticGaps`.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { denyHits, type DenyHit, missingNumbers } from "../lib/screen-checks.ts";
import type { Checkpoint, Snapshot } from "../runtime/src/protocol.ts";
import { beatPlanMs } from "../runtime/src/narrative.ts";
import { type SyntheticGap, syntheticGaps } from "../runtime/src/in-app.ts";
import { beatsOf, type Tour } from "../runtime/src/schema.ts";
import { type Host, launchHost } from "./launch.ts";
import { appUrl, browserSettings, openSession, type Project } from "./project.ts";

export const REHEARSE_SPEED = 10;

export interface BeatReport {
  index: number;
  step: string;
  beat: string;
  /** The still, relative to the out dir. */
  still: string;
  /** Numbers the beat says that its screen doesn't show. */
  missingNumbers: string[];
  deny: DenyHit[];
}

export interface Problem {
  kind: "deny" | "number" | "blocked" | "error" | "timeout" | "synthetic";
  beat: string | null;
  message: string;
}

export interface Candidate {
  anchor: unknown;
  role: string;
  name: string;
  score: number;
}

export interface Failure {
  step: string | null;
  beat: string | null;
  message: string;
  anchor: string | null;
  screenshot: string;
  dom: string;
  outline: string;
  candidates: Candidate[];
}

export interface RehearseReport {
  v: 1;
  ok: boolean;
  tour: string;
  speed: number;
  input: "trusted" | "synthetic";
  at: string;
  ms: number;
  url: string;
  app: { pid: number | null; port: number | null };
  beats: BeatReport[];
  /** Beats the tour has; a clean run reaches all of them. */
  beatCount: number;
  problems: Problem[];
  /** Synthetic fallbacks and other notes the run made. */
  notes: string[];
  deny: { checked: number; clean: boolean };
  failure: Failure | null;
  /** `--synthetic`: what synthetic input can't do (`cannot`, also a problem) or may not (`check`). */
  synthetic?: SyntheticGap[];
}

export interface RehearseOptions {
  project: Project;
  tour: Tour;
  out: string;
  speed?: number;
  synthetic?: boolean;
  url?: string;
  build?: boolean;
  reset?: boolean;
  /** Where `upload` fixtures resolve (default: the `showcase/` dir). */
  assetsDir?: string;
  marker?: string;
  say?: (line: string) => void;
}

interface OutlineRow {
  role: string;
  name: string;
  depth: number;
  anchor: unknown;
}

const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1));

/** Outline rows ranked against the anchor that couldn't be found. */
export function candidatesFor(description: string | null, rows: readonly OutlineRow[], limit = 6): Candidate[] {
  if (!description) return [];
  const want = words(description);
  const role = /^([a-z]+) "/.exec(description)?.[1] ?? null;
  return rows
    .filter((r) => r.anchor)
    .map((r) => {
      const have = words(`${r.role} ${r.name}`);
      let score = 0;
      for (const w of want) if (have.has(w)) score += 1;
      if (role && r.role === role) score += 1.5;
      return { anchor: r.anchor, role: r.role, name: r.name, score };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function outlineText(rows: readonly OutlineRow[]): string {
  return rows.map((r) => `${"  ".repeat(r.depth)}${r.role}${r.name ? ` "${r.name}"` : ""}${r.anchor ? `  → ${JSON.stringify(r.anchor)}` : ""}`).join("\n");
}

export async function rehearse(o: RehearseOptions): Promise<RehearseReport> {
  const started = Date.now();
  const tour = o.tour;
  const speed = o.speed ?? REHEARSE_SPEED;
  const say = o.say ?? (() => {});
  const p = o.project;
  const stills = join(o.out, "rehearse");
  rmSync(stills, { recursive: true, force: true });
  mkdirSync(stills, { recursive: true });
  const all = beatsOf(tour);
  const rule = tour.meta.rules?.spokenNumbers ?? "on-screen-only";
  const report: RehearseReport = {
    v: 1,
    ok: false,
    tour: tour.id,
    speed,
    input: o.synthetic ? "synthetic" : "trusted",
    at: new Date(started).toISOString(),
    ms: 0,
    url: "",
    app: { pid: null, port: null },
    beats: [],
    beatCount: all.length,
    problems: [],
    notes: [],
    deny: { checked: 0, clean: true },
    failure: null,
    ...(o.synthetic ? { synthetic: syntheticGaps(tour) } : {}),
  };
  for (const g of report.synthetic ?? []) {
    if (g.level === "cannot") report.problems.push({ kind: "synthetic", beat: g.beat, message: `${g.action} (${g.kind}) can't run in-app: ${g.why}` });
  }

  const session = await openSession(p, {
    what: `rehearse ${tour.id}`,
    ...(o.url ? { url: o.url } : {}),
    ...(o.build ? { build: true } : {}),
    ...(o.reset === false ? { reset: false } : {}),
    logFile: join(o.out, "app.log"),
    say,
  });
  let host: Host | null = null;
  session.onStop(async () => {
    await host?.close();
  });
  try {
    report.url = session.app.url;
    report.app = { pid: session.app.pid, port: session.app.port };
    const first = appUrl(session.app.url, tour.steps[0]?.path);
    let shot = 0;
    const onCheckpoint = async (c: Checkpoint, h: Host) => {
      shot += 1;
      const name = `${String(shot).padStart(2, "0")}-${c.beat}.png`;
      const text = String(await h.page.evaluate("__showcase.visibleText()"));
      const screen = [text, c.card?.title ?? "", ...(c.card?.lines ?? [])].join("\n");
      const deny = denyHits(screen, p.config.privacy.deny);
      const missing = rule === "on-screen-only" ? missingNumbers(c.narration, screen) : [];
      await h.page.screenshot({ path: join(stills, name) });
      report.deny.checked += 1;
      report.beats.push({ index: shot - 1, step: c.step, beat: c.beat, still: relative(o.out, join(stills, name)), missingNumbers: missing, deny });
      for (const d of deny) report.problems.push({ kind: "deny", beat: c.beat, message: `the deny-list entry ${d.rule} is on screen ("${d.match}")` });
      for (const n of missing) report.problems.push({ kind: "number", beat: c.beat, message: `the narration says "${n}", which isn't on screen` });
      say(`  ${String(shot).padStart(2)} ${c.beat}${deny.length || missing.length ? "  ✗" : ""}`);
    };
    say(`rehearsing ${tour.id} at ×${speed}: ${first}`);
    host = await launchHost({
      url: first,
      tour,
      mode: "watch",
      rehearse: true,
      speed,
      ...(o.synthetic ? { input: "synthetic" as const } : {}),
      headless: true,
      browser: browserSettings(p),
      assetsDir: o.assetsDir ?? p.showcaseDir ?? p.root,
      onCheckpoint,
      ...(o.marker ? { marker: o.marker } : {}),
    });
    const h = host;
    const planned = all.reduce((ms, { beat }) => ms + beatPlanMs(beat), 0);
    const limit = planned / speed + 60_000 + tour.steps.length * 15_000;
    const end = await new Promise<Snapshot | "timeout" | "closed">((resolve) => {
      const t0 = Date.now();
      const tick = () => {
        const s = h.latest();
        if (s && (s.status === "done" || s.status === "blocked")) return resolve(s);
        if (!h.browser.isConnected()) return resolve("closed");
        if (Date.now() - t0 > limit) return resolve("timeout");
        setTimeout(tick, 50);
      };
      tick();
    });
    const last = h.latest();
    report.notes = [...(last?.notes ?? []), ...h.logs.filter((l) => l.level === "warn").map((l) => l.message)];
    if (end === "timeout" || end === "closed") {
      report.problems.push({ kind: end === "timeout" ? "timeout" : "error", beat: last?.beatId ?? null, message: end === "timeout" ? `the run didn't finish within ${Math.round(limit / 1000)} s` : "the browser went away" });
      if (end === "timeout") report.failure = await captureFailure(h, o.out, last, `the run didn't finish within ${Math.round(limit / 1000)} s`, null);
    } else if (end.status === "blocked" || end.ended?.reason === "error") {
      const b = end.blocked;
      const message = b?.message ?? "the run stopped";
      report.problems.push({ kind: "blocked", beat: end.beatId, message });
      report.failure = await captureFailure(h, o.out, end, message, b?.anchor ?? null);
      await h.dispatch({ type: "end" }).catch(() => {});
    } else if (end.ended?.reason !== "finished") {
      report.problems.push({ kind: "error", beat: end.beatId, message: `the run ended early (${end.ended?.reason ?? "unknown"})` });
    } else if (report.beats.length !== all.length) {
      report.problems.push({ kind: "error", beat: null, message: `${report.beats.length} of ${all.length} beats reached their checkpoint` });
    }
    report.deny.clean = !report.problems.some((x) => x.kind === "deny");
    report.ok = report.problems.length === 0;
  } catch (e) {
    report.problems.push({ kind: "error", beat: host?.latest()?.beatId ?? null, message: e instanceof Error ? e.message : String(e) });
    report.ok = false;
    report.deny.clean = !report.problems.some((x) => x.kind === "deny");
  } finally {
    await host?.close();
    await session.close();
    report.ms = Date.now() - started;
    writeFileSync(join(o.out, "rehearse.json"), `${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
}

async function captureFailure(h: Host, out: string, snap: Snapshot | null, message: string, anchor: string | null): Promise<Failure> {
  const screenshot = join(out, "failure.png");
  const dom = join(out, "failure-dom.html");
  const outline = join(out, "failure-outline.txt");
  let rows: OutlineRow[] = [];
  try {
    await h.page.screenshot({ path: screenshot });
    // The excerpt: the body without scripts and styles, cut at 200 kB.
    const html = String(
      await h.page.evaluate(`(() => {
        const c = document.body ? document.body.cloneNode(true) : document.documentElement.cloneNode(true);
        for (const n of c.querySelectorAll("script, style, noscript, svg, showcase-controls")) n.remove();
        return c.outerHTML.slice(0, 200000);
      })()`),
    );
    writeFileSync(dom, html);
    rows = (await h.page.evaluate("__showcase.inspect({ limit: 300 })")) as OutlineRow[];
    writeFileSync(outline, `${outlineText(rows)}\n`);
  } catch {
    // The page is gone: what was saved is what there is.
  }
  return {
    step: snap?.stepId ?? null,
    beat: snap?.beatId ?? null,
    message,
    anchor,
    screenshot: relative(out, screenshot),
    dom: relative(out, dom),
    outline: relative(out, outline),
    candidates: candidatesFor(anchor, rows),
  };
}

/** The report as terse lines (C7). */
export function reportLines(r: RehearseReport): string[] {
  const lines = [`${r.ok ? "ok" : "FAILED"}: ${r.tour} at ×${r.speed}, ${r.beats.length}/${r.beatCount} beats, ${(r.ms / 1000).toFixed(1)} s (${r.input})`];
  for (const p of r.problems) lines.push(`  ✗ ${p.kind}${p.beat ? ` [${p.beat}]` : ""}: ${p.message}`);
  for (const n of r.notes) lines.push(`  · ${n}`);
  const checks = (r.synthetic ?? []).filter((g) => g.level === "check");
  if (r.synthetic) lines.push(checks.length ? "  synthetic input (in-app): check these by hand" : "  synthetic input (in-app): every action can run");
  for (const g of checks) lines.push(`    ? [${g.beat}] ${g.action} (${g.kind}): ${g.why}`);
  if (r.failure) {
    lines.push(`  screenshot: ${r.failure.screenshot} · DOM: ${r.failure.dom} · outline: ${r.failure.outline}`);
    if (r.failure.candidates.length) {
      lines.push("  candidate anchors:");
      for (const c of r.failure.candidates) lines.push(`    ${JSON.stringify(c.anchor)}`);
    }
  }
  return lines;
}
