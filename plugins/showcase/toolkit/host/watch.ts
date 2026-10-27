/**
 * `showcase watch` (PLAN §2.2, D3, D4): the live demo. The app comes up as for a rehearsal, then
 * a headed Chromium opens maximised (`viewport: null`, the screen's own size and DPR) with
 * `--autoplay-policy=no-user-gesture-required`, so the voice plays from the start. The tour plays
 * in Watch mode: Space pauses, ← and → step, M mutes, Esc exits, and a viewer's click pauses.
 *
 * It runs until the viewer exits (Esc, the exit control, or closing the window) or the process
 * is stopped; a finished tour holds its end card until then. Progress goes to a JSON file, so a
 * `--detach`ed run can be followed.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Snapshot } from "../runtime/src/protocol.ts";
import type { Tour } from "../runtime/src/schema.ts";
import { type Host, launchHost } from "./launch.ts";
import { appUrl, browserSettings, cardsFor, openSession, type Project, voiceFor } from "./project.ts";

export interface WatchProgress {
  pid: number;
  tour: string;
  status: string;
  step: string | null;
  stepIndex: number;
  stepCount: number;
  beat: string | null;
  ended: string | null;
  url: string | null;
  /** The app's process group, when showcase started it. */
  app: { pid: number | null; url: string } | null;
  error: string | null;
  at: string;
}

export interface WatchOptions {
  project: Project;
  tour: Tour;
  out: string;
  speed?: number;
  muted?: boolean;
  from?: string;
  url?: string;
  build?: boolean;
  reset?: boolean;
  manifest?: string;
  /** Where progress is written (default `<out>/watch.json`). */
  progress?: string;
  marker?: string;
  say?: (line: string) => void;
}

export type WatchEnd = "exited" | "closed" | "left";

export async function watch(o: WatchOptions): Promise<{ end: WatchEnd; last: Snapshot | null }> {
  const say = o.say ?? (() => {});
  const progressFile = o.progress ?? join(o.out, "watch.json");
  const p = o.project;
  const tour = o.tour;
  let host: Host | null = null;
  let appInfo: WatchProgress["app"] = null;
  let lastWritten = "";
  const write = (patch: Partial<WatchProgress>) => {
    const s = host?.latest() ?? null;
    const doc: WatchProgress = {
      pid: process.pid,
      tour: tour.id,
      status: s?.status ?? "starting",
      step: s?.stepId ?? null,
      stepIndex: s?.stepIndex ?? 0,
      stepCount: tour.steps.length,
      beat: s?.beatId ?? null,
      ended: s?.ended?.reason ?? null,
      url: null,
      app: appInfo,
      error: null,
      at: new Date().toISOString(),
      ...patch,
    };
    const key = JSON.stringify({ ...doc, at: "" });
    if (key === lastWritten) return;
    lastWritten = key;
    writeFileSync(progressFile, `${JSON.stringify(doc, null, 2)}\n`);
  };
  write({ status: "starting" });
  let session;
  try {
    session = await openSession(p, {
      what: `watch ${tour.id}`,
      ...(o.url ? { url: o.url } : {}),
      ...(o.build ? { build: true } : {}),
      ...(o.reset === false ? { reset: false } : {}),
      logFile: join(o.out, "app.log"),
      say,
    });
  } catch (e) {
    write({ status: "failed", error: e instanceof Error ? e.message : String(e) });
    throw e;
  }
  appInfo = { pid: session.app.pid, url: session.app.url };
  session.onStop(async () => {
    write({ status: "stopped" });
    await host?.close();
  });
  let timer: NodeJS.Timeout | null = null;
  try {
    const voice = voiceFor(p, tour, o.manifest);
    const startStep = o.from ? tour.steps.find((s) => s.id === o.from) : tour.steps[0];
    if (o.from && !startStep) throw new Error(`the tour has no step '${o.from}'`);
    const first = appUrl(session.app.url, tour.steps[0]?.path);
    let exited = false;
    host = await launchHost({
      url: first,
      tour,
      mode: "watch",
      speed: o.speed ?? 1,
      ...(o.from ? { from: o.from } : {}),
      ...(o.muted ? { muted: true } : {}),
      maximised: true,
      browser: browserSettings(p),
      assetsDir: p.showcaseDir ?? p.root,
      manifest: voice.manifest,
      cards: cardsFor(p),
      ...(voice.dir ? { voiceDir: voice.dir } : {}),
      onExit: () => {
        exited = true;
      },
      ...(o.marker ? { marker: o.marker } : {}),
    });
    const h = host;
    say(`watching ${tour.id}${voice.manifest ? "" : " (no voice manifest: reading time)"}: Space pauses, ← → step, M mutes, Esc exits`);
    let lastStep = -1;
    const end = await new Promise<WatchEnd>((resolve) => {
      timer = setInterval(() => {
        const s = h.latest();
        write({ url: h.page.isClosed() ? null : h.page.url() });
        if (s && s.stepIndex !== lastStep && s.status !== "done") {
          lastStep = s.stepIndex;
          say(`  step ${s.stepIndex + 1}/${s.stepCount}: ${s.stepId}`);
        }
        if (exited) resolve("exited");
        else if (!h.browser.isConnected()) resolve("closed");
        else if (s?.ended?.reason === "left") resolve("left");
      }, 100);
    });
    const last = h.latest();
    write({ status: "closed", ended: last?.ended?.reason ?? end });
    return { end, last };
  } catch (e) {
    write({ status: "failed", error: e instanceof Error ? e.message : String(e) });
    throw e;
  } finally {
    if (timer) clearInterval(timer);
    await host?.close();
    await session.close();
  }
}
