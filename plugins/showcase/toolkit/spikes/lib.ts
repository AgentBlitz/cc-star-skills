/**
 * Shared spike harness (PLAN §5 Session 2). Evidence-quality, not shipped behaviour: it loads
 * playwright-core through `lib/playwright.ts`, launches new-headless Chromium, injects the
 * prototype overlay, and writes results to `spikes/results/` (small JSON, committed) and
 * screenshots and frames to `test/.out/spikes/` (ignored).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Browser, BrowserContext, LaunchOptions } from "playwright-core";
import { findFfmpeg } from "../lib/ffmpeg.ts";
import { findPlaywright } from "../lib/playwright.ts";

export const SPIKES_DIR = import.meta.dirname;
export const RESULTS_DIR = join(SPIKES_DIR, "results");
export const OUT_DIR = resolve(SPIKES_DIR, "..", "test", ".out", "spikes");

type PW = typeof import("playwright-core");

export async function playwright(): Promise<PW> {
  const pw = findPlaywright();
  if (!pw) throw new Error("playwright-core not found: run `showcase doctor --install`");
  return (await import(pathToFileURL(join(pw.dir, "index.mjs")).href)) as PW;
}

export interface LaunchSpec {
  /** Re-enable PaintHolding, which Playwright turns off in `--disable-features`. */
  paintHolding?: boolean;
  args?: string[];
}

let defaultDisableFeatures: string | null = null;

/** The exact `--disable-features=` switch Playwright passes, read from chrome://version. */
async function playwrightDisableFeatures(pw: PW): Promise<string> {
  if (defaultDisableFeatures) return defaultDisableFeatures;
  const browser = await pw.chromium.launch({ channel: "chromium", headless: true });
  const line = await commandLine(browser);
  await browser.close();
  const sw = line.split(/\s+/).find((s) => s.startsWith("--disable-features="));
  if (!sw) throw new Error("no --disable-features switch in Chromium's command line");
  defaultDisableFeatures = sw;
  return sw;
}

export async function commandLine(browser: Browser): Promise<string> {
  const page = await browser.newPage();
  await page.goto("chrome://version");
  const text = (await page.locator("#command_line").textContent()) ?? "";
  await page.close();
  return text;
}

/** New headless Chromium (`channel: "chromium"`), as the recorder will use (§2.5). */
export async function launch(spec: LaunchSpec = {}): Promise<{ pw: PW; browser: Browser }> {
  const pw = await playwright();
  const opts: LaunchOptions = { channel: "chromium", headless: true, args: [...(spec.args ?? [])] };
  if (spec.paintHolding) {
    const sw = await playwrightDisableFeatures(pw);
    const kept = sw.slice("--disable-features=".length).split(",").filter((f) => f !== "PaintHolding");
    opts.ignoreDefaultArgs = [sw];
    opts.args = [...(opts.args ?? []), `--disable-features=${kept.join(",")}`];
  }
  return { pw, browser: await pw.chromium.launch(opts) };
}

export type OverlayOpts = {
  mode: "popover" | "portal";
  stop: "host" | "window" | "none";
  raise: boolean;
  controls?: "inline" | "portal" | "portal+popover";
};

export function overlayScript(opts: OverlayOpts): string {
  return readFileSync(join(SPIKES_DIR, "overlay-proto.js"), "utf8").replace("const opts = __OPTS__;", `const opts = ${JSON.stringify(opts)};`);
}

export async function withOverlay(context: BrowserContext, opts: OverlayOpts): Promise<void> {
  await context.addInitScript({ content: overlayScript(opts) });
}

export function outDir(name: string, clean = true): string {
  const dir = join(OUT_DIR, name);
  if (clean) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeResult(name: string, data: unknown): string {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const file = join(RESULTS_DIR, `${name}.json`);
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  return file;
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[i] ?? NaN;
}

export const round = (n: number, d = 1): number => Math.round(n * 10 ** d) / 10 ** d;

/** Width and height from a JPEG's SOF marker. */
export function jpegSize(buf: Buffer): { w: number; h: number } | null {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1] ?? 0;
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}

/** Mean luma (0–255) of each image matched by an ffmpeg input pattern, via `signalstats`. */
export function meanLuma(pattern: string): number[] {
  const { ffmpeg } = findFfmpeg();
  if (!ffmpeg) throw new Error("ffmpeg not found");
  const out = execFileSync(
    ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-i", pattern, "-vf", "signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-", "-f", "null", "-"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return [...out.matchAll(/lavfi\.signalstats\.YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
}

/** The RGB of one pixel of a PNG, via ffmpeg. */
export function pixel(png: string, x: number, y: number): [number, number, number] {
  const { ffmpeg } = findFfmpeg();
  if (!ffmpeg) throw new Error("ffmpeg not found");
  const buf = execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", png, "-vf", `crop=1:1:${Math.round(x)}:${Math.round(y)}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
  return [buf[0] ?? 0, buf[1] ?? 0, buf[2] ?? 0];
}
