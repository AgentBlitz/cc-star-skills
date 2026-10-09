/**
 * The host skeleton (PLAN §5 Session 4, step 4): enough to prove the runtime headless. It
 * launches Chromium through playwright-core, injects the config and the IIFE with
 * `addInitScript` (the IIFE itself keeps to the top frame), and exposes the `__showcaseHost`
 * binding: trusted input through `page.mouse` and `page.keyboard`, the host-held run state,
 * assets, the film's events (kept across loads) and log lines. `nav` events come from CDP.
 * Session 5 builds the full host (the app lifecycle, options, Watch, rehearse).
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, extname, join, normalize, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import type { Browser, BrowserContext, BrowserContextOptions, ElementHandle, LaunchOptions, Page } from "playwright-core";
import { findPlaywright } from "../lib/playwright.ts";
import type { HostMessage, InputRequest } from "../runtime/src/bridge.ts";
import type { Command, Snapshot } from "../runtime/src/director.ts";
import { FILM_VERSION, type FilmEvent, GO_KEY, HOST_BINDING } from "../runtime/src/film-events.ts";
import type { VoiceManifest } from "../runtime/src/narration.ts";
import type { Tour } from "../runtime/src/schema.ts";
import type { RunState } from "../runtime/src/state.ts";

type PW = typeof import("playwright-core");

export const RUNTIME_IIFE = resolve(import.meta.dirname, "..", "runtime", "dist", "showcase-runtime.iife.js");

export async function playwright(): Promise<PW> {
  const pw = findPlaywright();
  if (!pw) throw new Error("playwright-core not found: run `showcase doctor --install`");
  return (await import(pathToFileURL(join(pw.dir, "index.mjs")).href)) as PW;
}

export interface HostOptions {
  /** The page to open first. */
  url: string;
  tour: Tour;
  mode: "watch" | "film";
  speed?: number;
  from?: string;
  input?: "trusted" | "synthetic";
  pointer?: boolean;
  manifest?: VoiceManifest | null;
  autostart?: boolean;
  headless?: boolean;
  /** `browser.scale` (S-D1): a 1920×1080 capture at this DPR. */
  scale?: number;
  viewport?: { width: number; height: number };
  /** Where `asset` and `upload` paths resolve. */
  assetsDir?: string;
  /** A run state to seed (a test's reload scenario). */
  state?: RunState | null;
  /** Extra init scripts, registered after the runtime. */
  initScripts?: string[];
}

export interface Ready {
  doc: number;
  resumed: boolean;
  url: string;
}

export interface Host {
  pw: PW;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  /** The film's events across every document, in order. */
  events: FilmEvent[];
  /** The host-held run state. */
  state: RunState | null;
  logs: { level: "info" | "warn"; message: string }[];
  snapshots: Snapshot[];
  readies: Ready[];
  /** Input requests the runtime made, in order (what the tests check for trusted input). */
  inputs: InputRequest[];
  latest(): Snapshot | null;
  waitForEvent(type: FilmEvent["type"], options?: { timeoutMs?: number; after?: number }): Promise<FilmEvent>;
  waitForSnapshot(pred: (s: Snapshot) => boolean, options?: { timeoutMs?: number }): Promise<Snapshot>;
  waitForReady(options?: { timeoutMs?: number; count?: number }): Promise<Ready>;
  /** Starts the film: `__showcaseGo()`. */
  go(): Promise<void>;
  dispatch(command: Command): Promise<void>;
  close(): Promise<void>;
}

const TYPES: Record<string, string> = { ".txt": "text/plain", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json", ".csv": "text/csv", ".mp3": "audio/mpeg", ".pdf": "application/pdf" };

function assetPath(dir: string, path: string): string {
  const file = normalize(join(dir, path));
  if (!file.startsWith(dir + sep) && file !== dir) throw new Error(`asset outside the assets dir: ${path}`);
  if (!existsSync(file)) throw new Error(`no such asset: ${path}`);
  return file;
}

export async function launchHost(options: HostOptions): Promise<Host> {
  if (!existsSync(RUNTIME_IIFE)) throw new Error(`no runtime bundle at ${RUNTIME_IIFE}: run npm run build:runtime`);
  const pw = await playwright();
  const scale = options.scale ?? 1.5;
  const viewport = options.viewport ?? { width: Math.round(1920 / scale), height: Math.round(1080 / scale) };
  const launch: LaunchOptions = { channel: "chromium", headless: options.headless ?? true, args: [`--force-device-scale-factor=${scale}`] };
  const browser = await pw.chromium.launch(launch);
  const ctxOptions: BrowserContextOptions = { viewport, deviceScaleFactor: scale, serviceWorkers: "block", bypassCSP: true };
  const context = await browser.newContext(ctxOptions);
  const assetsDir = resolve(options.assetsDir ?? process.cwd());

  const host: Host = {
    pw,
    browser,
    context,
    page: null as unknown as Page,
    events: [],
    state: options.state ?? null,
    logs: [],
    snapshots: [],
    readies: [],
    inputs: [],
    latest: () => host.snapshots.at(-1) ?? null,
    waitForEvent: (type, o = {}) => until(() => host.events.find((e, i) => e.type === type && i >= (o.after ?? 0)) ?? null, o.timeoutMs ?? 20_000, `event ${type}`),
    waitForSnapshot: (pred, o = {}) => until(() => host.snapshots.findLast(pred) ?? null, o.timeoutMs ?? 20_000, "snapshot"),
    waitForReady: (o = {}) => until(() => (host.readies.length >= (o.count ?? 1) ? host.readies.at(-1) ?? null : null), o.timeoutMs ?? 20_000, "ready"),
    go: async () => {
      await host.page.evaluate(`${GO_KEY}()`);
    },
    dispatch: async (command) => {
      await host.page.evaluate(`__showcase.dispatch(${JSON.stringify(command)})`);
    },
    close: async () => {
      await browser.close();
    },
  };

  let lastSeq = 0;
  const seen = (seq: number) => {
    if (seq > lastSeq) lastSeq = seq;
  };

  const handleInput = async (page: Page, frameEval: (js: string) => Promise<ElementHandle | null>, req: InputRequest): Promise<void> => {
    host.inputs.push(req);
    const button = "button" in req ? req.button : undefined;
    switch (req.kind) {
      case "move":
        await page.mouse.move(req.x, req.y, { steps: req.steps ?? 1 });
        return;
      case "click":
        await page.mouse.move(req.x, req.y, { steps: 2 });
        await page.mouse.click(req.x, req.y, { ...(button ? { button } : {}), clickCount: req.count ?? 1 });
        return;
      case "down":
        await page.mouse.move(req.x, req.y);
        await page.mouse.down(button ? { button } : {});
        return;
      case "up":
        await page.mouse.up(button ? { button } : {});
        return;
      case "wheel":
        await page.mouse.move(req.x, req.y);
        await page.mouse.wheel(req.dx, req.dy);
        return;
      case "key":
        await page.keyboard.press(req.key);
        return;
      case "type":
        await page.keyboard.type(req.text, req.delayMs ? { delay: req.delayMs } : {});
        return;
      case "upload": {
        const handle = await frameEval("window.__showcaseUploadTarget");
        const el = handle?.asElement();
        if (!el) throw new Error("no upload target");
        await el.setInputFiles(req.files.map((f) => assetPath(assetsDir, f)));
        await handle?.dispose();
        return;
      }
    }
  };

  await context.exposeBinding(HOST_BINDING, async (source, msg: HostMessage) => {
    switch (msg.type) {
      case "input":
        await handleInput(source.page, (js) => source.frame.evaluateHandle(js) as Promise<ElementHandle | null>, msg.input);
        return null;
      case "state":
        if (msg.op === "load") return host.state;
        if (msg.op === "save") {
          host.state = { ...msg.state, seq: Math.max(msg.state.seq, lastSeq) };
          seen(host.state.seq);
        } else host.state = null;
        return null;
      case "asset": {
        const file = assetPath(assetsDir, msg.path);
        return { name: basename(file), type: TYPES[extname(file)] ?? "application/octet-stream", base64: readFileSync(file).toString("base64") };
      }
      case "event":
        seen(msg.event.seq);
        host.events.push(msg.event);
        return null;
      case "log":
        host.logs.push({ level: msg.level, message: msg.message });
        return null;
      case "ready":
        host.readies.push({ doc: msg.doc, resumed: msg.resumed, url: msg.url });
        return null;
      case "snapshot":
        if (msg.snapshot) host.snapshots.push(msg.snapshot as Snapshot);
        return null;
    }
  });

  const config = { tour: options.tour, mode: options.mode, speed: options.speed ?? 1, ...(options.from ? { from: options.from } : {}), ...(options.input ? { input: options.input } : {}), ...(options.pointer !== undefined ? { pointer: options.pointer } : {}), manifest: options.manifest ?? null, ...(options.autostart !== undefined ? { autostart: options.autostart } : {}) };
  await context.addInitScript({ content: `window.__showcaseConfig = ${JSON.stringify(config)};` });
  await context.addInitScript({ content: readFileSync(RUNTIME_IIFE, "utf8") });
  for (const s of options.initScripts ?? []) await context.addInitScript({ content: s });

  const page = await context.newPage();
  host.page = page;
  // `nav` events (PLAN §2.1): host-emitted on each main-frame navigation, with the host's own seq.
  const cdp = await context.newCDPSession(page);
  await cdp.send("Page.enable");
  const mainId = (await cdp.send("Page.getFrameTree")).frameTree.frame.id;
  const nav = (url: string, kind: "load" | "spa") => {
    const s = host.state;
    if (!s || s.mode !== "film" || !s.rolling) return;
    const event: FilmEvent = { type: "nav", url, kind, v: FILM_VERSION, seq: ++lastSeq, doc: s.doc, t: Date.now(), wall: Date.now() };
    host.state = { ...s, seq: lastSeq };
    host.events.push(event);
  };
  cdp.on("Page.frameNavigated", ({ frame }) => {
    if (!frame.parentId && !frame.url.startsWith("about:")) nav(frame.url, "load");
  });
  cdp.on("Page.navigatedWithinDocument", ({ frameId, url }) => {
    if (frameId === mainId) nav(url, "spa");
  });
  await page.goto(options.url);
  return host;
}

function until<T>(get: () => T | null, timeoutMs: number, what: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const v = get();
      if (v !== null) {
        resolve(v);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`timed out after ${timeoutMs} ms waiting for ${what}`));
        return;
      }
      setTimeout(tick, 25);
    };
    tick();
  });
}
