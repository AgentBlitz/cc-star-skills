/**
 * The host (PLAN §2.1, §2.2 "The host also", D7, D16): it launches Chromium through
 * playwright-core, injects the config and the runtime's IIFE with `addInitScript` (the IIFE keeps
 * to the top frame, and goes in before any clock script), and exposes the `__showcaseHost`
 * binding: trusted input through `page.mouse` and `page.keyboard`, the host-held run state,
 * assets (upload fixtures and voice clips), the film's events (kept across loads), log lines,
 * rehearse checkpoints and the viewer's exit. `nav` events come from CDP.
 *
 * The browser options it applies: new headless or headed (maximised, `viewport: null`, for
 * Watch); the scale with `--force-device-scale-factor` (S-D1); locale, timezone and colour
 * scheme; a fixed clock (`setFixedTime`, registered after the runtime); `bypassCSP` and
 * `serviceWorkers: 'block'`; `block` through `Network.setBlockedURLs` and `hide` through an
 * injected style; file choosers answered from fixtures; dialogs (`beforeunload` included)
 * accepted; popups kept in the same tab; clipboard permissions; Playwright's defaults for page
 * loads (S-D4). There is no `context.route` anywhere (D16).
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, extname, join, normalize, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import type { Browser, BrowserContext, BrowserContextOptions, ElementHandle, LaunchOptions, Page } from "playwright-core";
import { findPlaywright } from "../lib/playwright.ts";
import { FILM_VERSION, type FilmEvent, GO_KEY, HOST_BINDING } from "../runtime/src/film-events.ts";
import type { AssetKind, Checkpoint, Command, HostMessage, InputRequest, Snapshot, VoiceManifest } from "../runtime/src/protocol.ts";
import type { Tour } from "../runtime/src/schema.ts";
import type { RunState } from "../runtime/src/state.ts";

type PW = typeof import("playwright-core");

export const RUNTIME_IIFE = resolve(import.meta.dirname, "..", "runtime", "dist", "showcase-runtime.iife.js");

export async function playwright(): Promise<PW> {
  const pw = findPlaywright();
  if (!pw) throw new Error("playwright-core not found: run `showcase doctor --install`");
  return (await import(pathToFileURL(join(pw.dir, "index.mjs")).href)) as PW;
}

/** The `browser` settings the host applies (`showcase/config.json`, PLAN §2.2). */
export interface BrowserSettings {
  scale?: number;
  viewport?: { width: number; height: number };
  colorScheme?: "light" | "dark" | "no-preference";
  locale?: string;
  timezone?: string;
  /** An ISO time for `setFixedTime`. */
  clock?: { fixed: string };
  /** A recorded sign-in (Playwright `storageState`), resolved to a path. */
  storageState?: string;
  gpu?: "required" | "preferred";
  /** URL patterns to block (`Network.setBlockedURLs`: `*` wildcards). */
  block?: string[];
  /** CSS selectors hidden with an injected style. */
  hide?: string[];
}

export interface HostOptions {
  /** The page to open first. */
  url: string;
  /** The tour to run; null for a page with the runtime's API only (`inspect`, `auth`). */
  tour: Tour | null;
  mode: "watch" | "film";
  speed?: number;
  from?: string;
  input?: "trusted" | "synthetic";
  pointer?: boolean;
  manifest?: VoiceManifest | null;
  autostart?: boolean;
  /** A rehearsal: Watch mode without controls, a checkpoint per beat. */
  rehearse?: boolean;
  muted?: boolean;
  headless?: boolean;
  /** Watch: a headed window, maximised, `viewport: null` (the screen's own size and DPR). */
  maximised?: boolean;
  /** `browser.scale` (S-D1): a 1920×1080 capture at this DPR. */
  scale?: number;
  viewport?: { width: number; height: number };
  browser?: BrowserSettings;
  /** Where `upload` paths resolve. */
  assetsDir?: string;
  /** Where voice clips resolve (the manifest's dir). */
  voiceDir?: string;
  /** A run state to seed (a test's reload scenario). */
  state?: RunState | null;
  /** Extra init scripts, registered after the runtime. */
  initScripts?: string[];
  /** Rehearse: what the host does at each beat's checkpoint (the page waits for it). */
  onCheckpoint?: (checkpoint: Checkpoint, host: Host) => Promise<void>;
  /** Watch: the viewer asked to close. */
  onExit?: () => void;
  /** A marker on Chromium's command line, so a test can find the process. */
  marker?: string;
  /** More Chromium switches (the film's colour profile and DevTools port). */
  args?: string[];
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
  /** Resolves when the browser goes away (the viewer closed it, or `close`). */
  closed: Promise<void>;
}

const TYPES: Record<string, string> = {
  ".txt": "text/plain",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".csv": "text/csv",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".pdf": "application/pdf",
};

function assetPath(dir: string, path: string): string {
  const file = normalize(join(dir, path));
  if (!file.startsWith(dir + sep) && file !== dir) throw new Error(`asset outside its dir: ${path}`);
  if (!existsSync(file)) throw new Error(`no such asset: ${path}`);
  return file;
}

/** A click that navigates can destroy the context it came from: that is not a failure. */
export function isGoneError(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e);
  return /Execution context was destroyed|Target page, context or browser has been closed|Target closed|frame was detached|Frame was detached|navigating and changing the execution context|Cannot find context with specified id/i.test(m);
}

/** Keeps `window.open` and `target=_blank` in the same tab: a tour can't follow a new window. */
const SAME_TAB = `(() => {
  if (window.top !== window) return;
  const assign = (url) => { try { location.assign(new URL(String(url), location.href).href); } catch {} };
  const open = window.open;
  window.open = function (url) { if (url) { assign(url); return window; } return open.apply(window, arguments); };
  document.addEventListener("click", (e) => {
    const a = e.target instanceof Element ? e.target.closest("a[target], area[target], form[target]") : null;
    if (a && a.getAttribute("target") && !/^_(self|top|parent)$/i.test(a.getAttribute("target"))) a.setAttribute("target", "_self");
  }, true);
  document.addEventListener("submit", (e) => {
    const f = e.target;
    if (f instanceof HTMLFormElement && f.target && !/^_(self|top|parent)$/i.test(f.target)) f.target = "_self";
  }, true);
})();`;

/** `browser.hide` as a document-level adopted stylesheet: safe under CSP. */
function hideScript(selectors: string[]): string {
  const css = `${selectors.join(",\n")} { display: none !important; }`;
  return `(() => {
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(${JSON.stringify(css)});
    const add = () => { if (!document.adoptedStyleSheets.includes(sheet)) document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]; };
    add();
    document.addEventListener("DOMContentLoaded", add, { once: true });
  } catch {}
})();`;
}

export async function launchHost(options: HostOptions): Promise<Host> {
  if (!existsSync(RUNTIME_IIFE)) throw new Error(`no runtime bundle at ${RUNTIME_IIFE}: run npm run build:runtime`);
  const pw = await playwright();
  const b = options.browser ?? {};
  const scale = options.scale ?? b.scale ?? 1.5;
  const viewport = options.viewport ?? b.viewport ?? { width: Math.round(1920 / scale), height: Math.round(1080 / scale) };
  const maximised = options.maximised === true;
  const args = ["--autoplay-policy=no-user-gesture-required"];
  if (maximised) args.push("--start-maximized");
  else args.push(`--force-device-scale-factor=${scale}`);
  // A marker on Chromium's command line, so a test can tell its processes have gone (`SHOWCASE_RUN_MARKER` is a test aid).
  const marker = options.marker ?? process.env.SHOWCASE_RUN_MARKER;
  if (marker) args.push(`--showcase-run=${marker}`);
  args.push(...(options.args ?? []));
  const launch: LaunchOptions = { channel: "chromium", headless: maximised ? false : (options.headless ?? true), args };
  const browser = await pw.chromium.launch(launch);
  const ctxOptions: BrowserContextOptions = {
    serviceWorkers: "block",
    bypassCSP: true,
    ...(maximised ? { viewport: null } : { viewport, deviceScaleFactor: scale }),
    ...(b.locale ? { locale: b.locale } : {}),
    ...(b.timezone ? { timezoneId: b.timezone } : {}),
    ...(b.colorScheme ? { colorScheme: b.colorScheme } : {}),
    ...(b.storageState ? { storageState: b.storageState } : {}),
    // The film and rehearsals show the app's motion; Watch honours the viewer's setting.
    ...(options.mode === "film" || options.rehearse ? { reducedMotion: "no-preference" as const } : {}),
  };
  let context: BrowserContext;
  try {
    context = await browser.newContext(ctxOptions);
  } catch (e) {
    await browser.close().catch(() => {});
    throw e;
  }
  const assetsDir = resolve(options.assetsDir ?? process.cwd());
  const voiceDir = options.voiceDir ? resolve(options.voiceDir) : null;
  let closing = false;
  let closedResolve = () => {};
  const closed = new Promise<void>((r) => {
    closedResolve = r;
  });
  browser.on("disconnected", () => closedResolve());

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
    waitForReady: (o = {}) => until(() => (host.readies.length >= (o.count ?? 1) ? (host.readies.at(-1) ?? null) : null), o.timeoutMs ?? 20_000, "ready"),
    go: async () => {
      await host.page.evaluate(`${GO_KEY}()`);
    },
    dispatch: async (command) => {
      await host.page.evaluate(`__showcase.dispatch(${JSON.stringify(command)})`);
    },
    close: async () => {
      closing = true;
      await browser.close().catch(() => {});
    },
    closed,
  };

  try {
    let lastSeq = 0;
    const seen = (seq: number) => {
      if (seq > lastSeq) lastSeq = seq;
    };
    // Files for the next chooser a tour's `upload` opens; a chooser nobody asked for is cancelled.
    let pendingFiles: string[] | null = null;

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
          const files = req.files.map((f) => assetPath(assetsDir, f));
          const handle = await frameEval("window.__showcaseUploadTarget");
          const el = handle?.asElement();
          const isInput = el ? await el.evaluate((n) => (n as { tagName?: string; type?: string }).tagName === "INPUT" && (n as { type?: string }).type === "file") : false;
          if (el && isInput) {
            await el.setInputFiles(files);
          } else {
            // A button that opens the chooser: click it for real and answer from the fixtures.
            pendingFiles = files;
            const chooser = page.waitForEvent("filechooser", { timeout: 10_000 });
            await page.mouse.click(req.x, req.y);
            await chooser;
          }
          await handle?.dispose();
          return;
        }
      }
    };

    await context.exposeBinding(HOST_BINDING, async (source, msg: HostMessage) => {
      switch (msg.type) {
        case "input":
          try {
            await handleInput(source.page, (js) => source.frame.evaluateHandle(js) as Promise<ElementHandle | null>, msg.input);
          } catch (e) {
            if (!isGoneError(e)) throw e;
          }
          return null;
        case "state":
          if (msg.op === "load") return host.state;
          if (msg.op === "save") {
            host.state = { ...msg.state, seq: Math.max(msg.state.seq, lastSeq) };
            seen(host.state.seq);
          } else host.state = null;
          return null;
        case "asset": {
          const kind: AssetKind = msg.kind ?? "file";
          const dir = kind === "voice" ? voiceDir : assetsDir;
          if (!dir) throw new Error("no voice dir: the tour has no voice manifest");
          const file = assetPath(dir, msg.path);
          return { name: basename(file), type: TYPES[extname(file).toLowerCase()] ?? "application/octet-stream", base64: readFileSync(file).toString("base64") };
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
        case "checkpoint":
          if (options.onCheckpoint) await options.onCheckpoint(msg.checkpoint, host);
          return null;
        case "exit":
          options.onExit?.();
          return null;
      }
    });

    const config = {
      tour: options.tour,
      mode: options.mode,
      speed: options.speed ?? 1,
      ...(options.from ? { from: options.from } : {}),
      ...(options.input ? { input: options.input } : {}),
      ...(options.pointer !== undefined ? { pointer: options.pointer } : {}),
      manifest: options.manifest ?? null,
      ...(options.autostart !== undefined ? { autostart: options.autostart } : {}),
      ...(options.rehearse ? { rehearse: true } : {}),
      ...(options.muted !== undefined ? { muted: options.muted } : {}),
    };
    // Order matters (D16): the config, then the runtime (it captures the real clocks), then the
    // page aids, then the fixed clock, so the clock script never runs before the runtime.
    if (options.tour) await context.addInitScript({ content: `window.__showcaseConfig = ${JSON.stringify(config)};` });
    await context.addInitScript({ content: readFileSync(RUNTIME_IIFE, "utf8") });
    await context.addInitScript({ content: SAME_TAB });
    if (b.hide?.length) await context.addInitScript({ content: hideScript(b.hide) });
    if (b.clock?.fixed) await context.clock.setFixedTime(new Date(b.clock.fixed));
    for (const s of options.initScripts ?? []) await context.addInitScript({ content: s });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});

    const page = await context.newPage();
    host.page = page;
    page.on("dialog", (d) => {
      host.logs.push({ level: "info", message: `accepted a ${d.type()} dialog` });
      d.accept().catch(() => {});
    });
    page.on("filechooser", (fc) => {
      const files = pendingFiles;
      pendingFiles = null;
      if (!files) host.logs.push({ level: "warn", message: "cancelled a file chooser no upload action asked for" });
      fc.setFiles(files ?? []).catch(() => {});
    });
    // A popup the init script couldn't stop (a form post, a script with a saved `open`): follow it in the tab.
    context.on("page", (popup) => {
      if (popup === page) return;
      void (async () => {
        try {
          await popup.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => {});
          const url = popup.url();
          await popup.close().catch(() => {});
          if (url && !url.startsWith("about:")) await page.goto(url).catch(() => {});
          host.logs.push({ level: "info", message: `kept a popup in the tab: ${url}` });
        } catch {
          // The context is closing.
        }
      })();
    });
    page.on("close", () => {
      // The viewer closed the window (Watch): the browser has nothing left to show.
      if (!closing) void browser.close().catch(() => {});
    });

    const cdp = await context.newCDPSession(page);
    await cdp.send("Page.enable");
    if (b.block?.length) {
      await cdp.send("Network.enable");
      await cdp.send("Network.setBlockedURLs", { urls: b.block });
    }
    if (b.gpu === "required") await requireGpu(page);
    // `nav` events (PLAN §2.1): host-emitted on each main-frame navigation, with the host's own seq.
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
  } catch (e) {
    await host.close();
    throw e;
  }
  return host;
}

/** The WebGL renderer string ("none" without WebGL): what the film records and `gpu` checks. */
export async function rendererOf(page: Page): Promise<string> {
  return (await page.evaluate(`(() => {
    const gl = document.createElement("canvas").getContext("webgl");
    if (!gl) return "none";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  })()`)) as string;
}

export function isSoftwareRenderer(renderer: string): boolean {
  return renderer === "none" || /swiftshader|llvmpipe|software/i.test(renderer);
}

/** `browser.gpu: "required"` refuses a software renderer (Playwright always enables SwiftShader). */
async function requireGpu(page: Page): Promise<void> {
  const renderer = await rendererOf(page);
  if (isSoftwareRenderer(renderer)) {
    throw new Error(`browser.gpu is "required" but the renderer is ${renderer}`);
  }
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
