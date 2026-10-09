/**
 * Spike 1 — capture (PLAN §5 Session 2, S-D1). CDP `Page.startScreencast` over a scripted motion
 * sequence (a smooth scroll down and back, ten pointer trips, with the spinner and canvas always
 * running) at scale 1, 1.5 and 2 (viewport 1920×1080 ÷ scale, DPR = scale), JPEG q80 and q90.
 * Frames are acknowledged at once and written through a bounded queue, as the recorder will.
 *
 * Measures, over the motion window: p5 and median fps (1 s windows, 250 ms steps), the largest
 * frame gap, the event-loop p99 (`monitorEventLoopDelay`), MB/s, frame size, and the page's own
 * rAF rate.
 *
 * The DPR must be real: with only `deviceScaleFactor` emulated, the screencast sends frames at
 * the CSS viewport size (960×540 at scale 2; kept in `results/spike1-capture-emulated-dpr.json`).
 * Launching with `--force-device-scale-factor=<scale>` as well gives 1920×1080 device pixels.
 *
 *   node toolkit/spikes/spike1-capture.ts [--reps 2] [--scales 1,1.5,2] [--qualities 80,90] [--settle 300] [--emulated-dpr]
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { parseArgs } from "node:util";
import { serveFixture } from "../fixtures/serve.ts";
import { jpegSize, launch, outDir, percentile, round, withOverlay, writeResult } from "./lib.ts";

const { values } = parseArgs({
  options: {
    reps: { type: "string", default: "2" },
    scales: { type: "string", default: "1,1.5,2" },
    qualities: { type: "string", default: "80,90" },
    settle: { type: "string", default: "300" },
    "emulated-dpr": { type: "boolean", default: false },
  },
});
const SCALES = values.scales.split(",").map(Number);
const QUALITIES = values.qualities.split(",").map(Number);
const REPS = Number(values.reps);
// A tour settles after each scroll (the executor waits for a stable rect). `--settle 0` runs the
// scrolls back to back, which shows a one-off ~267 ms capture stall once the burst ends.
const SETTLE = Number(values.settle);
const QUEUE_MAX = 120;

interface Frame {
  ts: number; // compositor timestamp, epoch seconds
  bytes: number;
}

const server = await serveFixture();
const out = outDir("s1");
const runs: Record<string, unknown>[] = [];
let renderer = "";

for (const scale of SCALES) {
  for (const quality of QUALITIES) {
    for (let rep = 1; rep <= REPS; rep++) {
      const { browser } = await launch({ args: values["emulated-dpr"] ? [] : [`--force-device-scale-factor=${scale}`] });
      const context = await browser.newContext({
        viewport: { width: Math.round(1920 / scale), height: Math.round(1080 / scale) },
        deviceScaleFactor: scale,
        colorScheme: "dark",
        reducedMotion: "no-preference",
      });
      await withOverlay(context, { mode: "popover", stop: "host", raise: true });
      const page = await context.newPage();
      await page.goto(`${server.url}/index.html`);
      await page.getByRole("button", { name: "Accept cookies" }).click();
      if (!renderer) {
        renderer = await page.evaluate(() => {
          const gl = document.createElement("canvas").getContext("webgl");
          const ext = gl?.getExtension("WEBGL_debug_renderer_info");
          return gl && ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "no webgl";
        });
      }
      await page.waitForTimeout(500);

      const dir = join(out, `s${scale}-q${quality}-r${rep}`);
      mkdirSync(dir, { recursive: true });
      const frames: Frame[] = [];
      let size: { w: number; h: number } | null = null;
      let pending = 0;
      let maxPending = 0;
      let delayedAcks = 0;
      const waiters: (() => void)[] = [];
      const cdp = await context.newCDPSession(page);
      cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
        const buf = Buffer.from(data, "base64");
        const i = frames.length;
        frames.push({ ts: metadata.timestamp ?? Date.now() / 1000, bytes: buf.length });
        size ??= jpegSize(buf);
        pending++;
        maxPending = Math.max(maxPending, pending);
        // Bounded queue: when full, hold the acknowledgement so Chrome drops frames instead.
        if (pending > QUEUE_MAX) {
          delayedAcks++;
          await new Promise<void>((r) => waiters.push(r));
        }
        cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
        writeFile(join(dir, `${String(i).padStart(6, "0")}.jpg`), buf)
          .catch(() => {})
          .finally(() => {
            pending--;
            waiters.shift()?.();
          });
      });

      const eld = monitorEventLoopDelay({ resolution: 10 });
      await cdp.send("Page.startScreencast", { format: "jpeg", quality, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
      await page.waitForTimeout(600);
      eld.enable();
      const t0 = Date.now() / 1000;
      const motion = await page.evaluate(async (settle) => {
        let rafs = 0;
        let on = true;
        const tick = () => {
          rafs++;
          if (on) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        const start = performance.now();
        const scrolled = (top: number) =>
          new Promise<void>((r) => {
            const done = () => r();
            window.addEventListener("scrollend", done, { once: true });
            window.scrollTo({ top, behavior: "smooth" });
            setTimeout(done, 2500);
          }).then(() => new Promise<void>((r) => setTimeout(r, settle)));
        const marks: Record<string, number> = { start: Date.now() / 1000 };
        await scrolled(1400);
        marks.down = Date.now() / 1000;
        await scrolled(0);
        marks.up = Date.now() / 1000;
        const w = innerWidth;
        const h = innerHeight;
        const pts = [
          [0.15, 0.2], [0.85, 0.25], [0.5, 0.8], [0.1, 0.7], [0.9, 0.85],
          [0.3, 0.15], [0.7, 0.6], [0.2, 0.45], [0.8, 0.4], [0.5, 0.5],
        ] as const;
        const s = (window as unknown as { __showcaseSpike: { pointTo(x: number, y: number, ms: number): Promise<void> } }).__showcaseSpike;
        for (const [x, y] of pts) await s.pointTo(x * w, y * h, 600);
        on = false;
        const ms = performance.now() - start;
        marks.pointer = Date.now() / 1000;
        return { rafs, ms, rafFps: (rafs / ms) * 1000, marks };
      }, SETTLE);
      const t1 = Date.now() / 1000;
      eld.disable();
      await cdp.send("Page.stopScreencast");
      await page.waitForTimeout(300);
      while (pending > 0) await new Promise((r) => setTimeout(r, 20));
      await browser.close();

      const win = frames.filter((f) => f.ts >= t0 && f.ts <= t1);
      const gaps = win.slice(1).map((f, i) => (f.ts - (win[i]?.ts ?? f.ts)) * 1000);
      const fpsWindows: number[] = [];
      for (let a = t0; a + 1 <= t1; a += 0.25) fpsWindows.push(win.filter((f) => f.ts >= a && f.ts < a + 1).length);
      const bytes = win.reduce((n, f) => n + f.bytes, 0);
      const run = {
        scale,
        quality,
        rep,
        viewport: `${Math.round(1920 / scale)}x${Math.round(1080 / scale)}@${scale}`,
        frameSize: size ? `${(size as { w: number }).w}x${(size as { h: number }).h}` : null,
        seconds: round(t1 - t0, 2),
        frames: win.length,
        fpsP5: percentile(fpsWindows, 5),
        fpsMedian: percentile(fpsWindows, 50),
        maxGapMs: round(Math.max(...gaps), 1),
        gapsOver100ms: gaps.filter((g) => g > 100).length,
        eventLoopP99Ms: round(eld.percentile(99) / 1e6, 1),
        mbPerSec: round(bytes / 1e6 / (t1 - t0), 2),
        kbPerFrame: round(bytes / 1e3 / Math.max(1, win.length), 0),
        pageRafFps: round(motion.rafFps, 1),
        worstGaps: win
          .slice(1)
          .map((f, i) => ({ atSec: round((win[i]?.ts ?? 0) - t0, 2), ms: round((f.ts - (win[i]?.ts ?? f.ts)) * 1000, 0) }))
          .sort((a, b) => b.ms - a.ms)
          .slice(0, 3),
        phases: Object.fromEntries(Object.entries(motion.marks).map(([k, v]) => [k, round(v - t0, 2)])),
        maxQueue: maxPending,
        delayedAcks,
      };
      runs.push(run);
      console.log(JSON.stringify(run));
      // Keep two sample frames per run; drop the rest (C9: nothing large).
      const keep = new Set([0, Math.floor(frames.length / 2)].map((i) => `${String(i).padStart(6, "0")}.jpg`));
      for (let i = 0; i < frames.length; i++) {
        const name = `${String(i).padStart(6, "0")}.jpg`;
        if (!keep.has(name)) rmSync(join(dir, name), { force: true });
      }
    }
  }
}
await server.close();

// The worst rep per configuration decides.
const summary = [];
for (const scale of SCALES) {
  for (const quality of QUALITIES) {
    const rs = runs.filter((r) => r.scale === scale && r.quality === quality) as Record<string, number>[];
    const worst = (k: string, f: (...n: number[]) => number) => f(...rs.map((r) => r[k] ?? NaN));
    summary.push({
      scale,
      quality,
      fpsP5: worst("fpsP5", Math.min),
      fpsMedian: worst("fpsMedian", Math.min),
      maxGapMs: worst("maxGapMs", Math.max),
      eventLoopP99Ms: worst("eventLoopP99Ms", Math.max),
      mbPerSec: worst("mbPerSec", Math.max),
      kbPerFrame: worst("kbPerFrame", Math.max),
      pageRafFps: worst("pageRafFps", Math.min),
    });
  }
}
const result = { when: new Date().toISOString(), settleMs: SETTLE, dpr: values["emulated-dpr"] ? "emulated" : "forced",  chromium: "new headless (channel chromium), build 1243", renderer, runs, summary };
writeResult(`spike1-capture${SETTLE > 0 ? "" : "-burst"}${values["emulated-dpr"] ? "-emulated-dpr" : ""}`, result);
writeFileSync(join(out, "summary.json"), JSON.stringify(summary, null, 2));
console.table(summary);
