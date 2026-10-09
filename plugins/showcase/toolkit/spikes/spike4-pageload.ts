/**
 * Spike 4 — page-load continuity (PLAN §5 Session 2, S-D4). A tour by link clicks across full
 * page loads (index → list → detail → spa), then one History-API route, captured with the CDP
 * screencast. The server adds 120 ms to every document and stylesheet, as a real app would.
 *
 * Counts white-flash frames (mean luma from ffmpeg `signalstats`; the fixture is dark) with
 * Playwright's default arguments, which disable PaintHolding, and with PaintHolding re-enabled.
 * Also proves the init script re-arms on each load while a host-held sequence number carries
 * on: events go through an exposed binding, and the host stamps `seq` and `doc`.
 *
 *   node toolkit/spikes/spike4-pageload.ts [--scale 1.5] [--latency 120,400]
 */
import { readdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { serveFixture } from "../fixtures/serve.ts";
import { commandLine, launch, meanLuma, outDir, round, withOverlay, writeResult } from "./lib.ts";

const { values } = parseArgs({
  options: { scale: { type: "string", default: "1.5" }, latency: { type: "string", default: "120,400" } },
});
const scale = Number(values.scale);

// The page side of the film channel (harness only): re-runs on every document.
const ARM = `
  if (window.top === window) {
    const emit = (kind, extra) => window.__showcaseFilm({ kind, url: location.pathname, ...extra });
    emit("armed", { timeOrigin: performance.timeOrigin });
    document.addEventListener("DOMContentLoaded", () => emit("ready"));
    setInterval(() => emit("tick"), 250);
  }
`;

interface Ev {
  kind: string;
  url: string;
  seq: number;
  doc: number;
  wall: number;
}

async function run(paintHolding: boolean, latencyMs: number) {
  const server = await serveFixture({ latencyMs });
  const { browser } = await launch({ paintHolding, args: [`--force-device-scale-factor=${scale}`] });
  const paintHoldingDisabled = (await commandLine(browser)).split(/\s+/).some((s) => s.startsWith("--disable-features=") && s.includes("PaintHolding"));
  const context = await browser.newContext({
    viewport: { width: Math.round(1920 / scale), height: Math.round(1080 / scale) },
    deviceScaleFactor: scale,
  });
  // The host holds the run state: seq always goes up, doc goes up by one on each load.
  const events: Ev[] = [];
  let seq = 0;
  let doc = 0;
  await context.exposeBinding("__showcaseFilm", (_src, ev: { kind: string; url: string }) => {
    if (ev.kind === "armed") doc++;
    events.push({ kind: ev.kind, url: ev.url, seq: ++seq, doc, wall: Date.now() / 1000 });
    return seq;
  });
  await withOverlay(context, { mode: "popover", stop: "window", raise: true });
  await context.addInitScript({ content: ARM });
  const page = await context.newPage();
  await page.goto(`${server.url}/index.html`);
  await page.getByRole("button", { name: "Accept cookies" }).click();
  await page.waitForTimeout(800);

  const dir = outDir(`s4-${paintHolding ? "paintholding" : "default"}-${latencyMs}ms`);
  const frames: { ts: number; file: string }[] = [];
  const writes: Promise<void>[] = [];
  const navs: { kind: "load" | "spa"; url: string; wall: number; seq: number }[] = [];
  const cdp = await context.newCDPSession(page);
  await cdp.send("Page.enable");
  const mainId = (await cdp.send("Page.getFrameTree")).frameTree.frame.id;
  cdp.on("Page.frameNavigated", ({ frame }) => {
    if (!frame.parentId) navs.push({ kind: "load", url: new URL(frame.url).pathname, wall: Date.now() / 1000, seq: ++seq });
  });
  cdp.on("Page.navigatedWithinDocument", ({ frameId, url }) => {
    if (frameId === mainId) navs.push({ kind: "spa", url: new URL(url).pathname, wall: Date.now() / 1000, seq: ++seq });
  });
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    const file = join(dir, `${String(frames.length).padStart(6, "0")}.jpg`);
    frames.push({ ts: metadata.timestamp ?? Date.now() / 1000, file });
    writes.push(writeFile(file, Buffer.from(data, "base64")));
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  await page.waitForTimeout(500);
  const t0 = Date.now() / 1000;
  const clicks: { link: string; wall: number }[] = [];
  const step = async (name: string) => {
    clicks.push({ link: name, wall: Date.now() / 1000 });
    await page.getByRole("link", { name, exact: true }).first().click();
    await page.waitForLoadState("load");
    await page.waitForTimeout(1200);
  };
  await step("Reports"); // → list.html
  await step("Pipeline"); // → detail.html
  await step("Open the workspace →"); // → /spa (full load)
  await step("Settings"); // → /spa/settings (History API)
  await cdp.send("Page.stopScreencast");
  await Promise.all(writes);
  await browser.close();
  await server.close();

  // White flashes: frames much brighter than the dark app.
  const luma = meanLuma(join(dir, "%06d.jpg"));
  const inTour = frames.map((f, i) => ({ ...f, y: luma[i] ?? 0 })).filter((f) => f.ts >= t0);
  const white = inTour.filter((f) => f.y > 128);
  const bright = inTour.filter((f) => f.y > 60);
  const gaps = inTour.slice(1).map((f, i) => ({ atSec: round((inTour[i]?.ts ?? 0) - t0, 2), ms: round((f.ts - (inTour[i]?.ts ?? f.ts)) * 1000, 0) }));
  // The first document is about:blank; the tour's loads come after it.
  const loadEvents = events.filter((e) => e.kind === "armed" && e.url !== "blank");
  const all = [...events.map((e) => e.seq), ...navs.map((n) => n.seq)].sort((a, b) => a - b);
  const docsInOrder = loadEvents.map((e) => e.doc);
  return {
    paintHolding,
    latencyMs,
    paintHoldingDisabledInCommandLine: paintHoldingDisabled,
    frames: inTour.length,
    whiteFrames: white.length,
    whiteMs: round(white.length > 0 ? white.length * (1000 / 60) : 0, 0),
    brightFrames: bright.length,
    maxLuma: round(Math.max(...inTour.map((f) => f.y)), 1),
    baseLuma: round(inTour.map((f) => f.y).sort((a, b) => a - b)[Math.floor(inTour.length / 2)] ?? 0, 1),
    worstGaps: gaps.sort((a, b) => b.ms - a.ms).slice(0, 4),
    clicks: clicks.map((c) => ({ link: c.link, atSec: round(c.wall - t0, 2) })),
    navs: navs.map((n) => ({ kind: n.kind, url: n.url, atSec: round(n.wall - t0, 2) })),
    armed: loadEvents.map((e) => ({ url: e.url, doc: e.doc, seq: e.seq })),
    reArmedOnEachLoad:
      loadEvents.map((e) => e.url).join(" ") === "/index.html /list.html /detail.html /spa" &&
      docsInOrder.every((d, i) => i === 0 || d === (docsInOrder[i - 1] ?? 0) + 1),
    spaDidNotReArm: !loadEvents.some((e) => e.url === "/spa/settings"),
    seqStrictlyIncreasing: all.every((s, i) => i === 0 || s > (all[i - 1] ?? 0)) && new Set(all).size === all.length,
    events: events.length,
    framesOnDisk: readdirSync(dir).length,
  };
}

const runs = [];
for (const latency of values.latency.split(",").map(Number)) runs.push(await run(false, latency), await run(true, latency));
for (const r of runs) {
  const { navs, armed, clicks, ...rest } = r;
  console.log(JSON.stringify(rest));
  console.log("  armed:", JSON.stringify(armed), "\n  navs:", JSON.stringify(navs));
}
writeResult("spike4-pageload", { when: new Date().toISOString(), scale, runs });
