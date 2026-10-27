/**
 * The showcase runtime (PLAN §2.1, D7, D16): one framework-agnostic engine that runs injected
 * (Watch, rehearse and film, through the host) or vendored in-app (Session 10). This module is
 * the ESM entry for vendoring and the API the IIFE (`inject.ts`) boots from. The external boot
 * reads the config the host injects as `window.__showcaseConfig`, captures the real timers and
 * installs the top-layer watch and the control guard before any app code, and starts or resumes
 * the run once the document is ready.
 *
 * The in-app boot (`startInApp`, Session 10) is what the vendored adapters call: it reads the
 * deep link (or the run saved in the tab), loads the tour and its voice manifest from the app's
 * static paths, and runs the tour with synthetic input, sessionStorage run state and the app's
 * own router (`navigate`), `reset`, `beforeStart` and `invoke` actions.
 */
import { type AnchorContext, describeAnchor } from "./anchors.ts";
import { type AudioStats, type BridgeAudio, createBridgeAudio } from "./audio.ts";
import { type Acting, type Bridge, createBridge, waitForGo } from "./bridge.ts";
import { captureNatives, isTopFrame, type Natives, nextFrame } from "./capture.ts";
import { createClocks, whenAborted } from "./clock.ts";
import { type Command, Director, type Mode, type Snapshot } from "./director.ts";
import { createExecutor, type InputMode } from "./executor.ts";
import { createFilmAids, type FilmAids, ROLLING_KEY } from "./film-aids.ts";
import { API_KEY, type FilmEvent } from "./film-events.ts";
import { type OutlineItem, type OutlineOptions, outline, visibleText } from "./inspect.ts";
import type { VoiceManifest } from "./narration.ts";
import type { CardBrand } from "./overlay/brand.ts";
import { type ControlCommand, createOverlay, type Overlay, type OverlayUi } from "./overlay/index.ts";
import { installTopLayer, type TopLayer } from "./overlay/top-layer.ts";
import { DEFAULT_BASE, readDeepLink, routeTo, servedPaths, withoutShowcaseParams } from "./in-app.ts";
import { contextOf, waitFor } from "./ready.ts";
import { sentenceText, type Tour } from "./schema.ts";
import { hostStore, type RunState, STORAGE_KEY, type StateStore, storageStore } from "./state.ts";
import { createTimeline } from "./timeline.ts";

export * from "./anchors.ts";
export * from "./audio.ts";
export * from "./bridge.ts";
export * from "./capture.ts";
export * from "./clock.ts";
export * from "./director.ts";
export * from "./dom-events.ts";
export * from "./executor.ts";
export * from "./film-aids.ts";
export * from "./film-events.ts";
export * from "./in-app.ts";
export * from "./inspect.ts";
export * from "./narration.ts";
export * from "./narrative.ts";
export * from "./overlay/index.ts";
export * from "./overlay/place.ts";
export * from "./overlay/top-layer.ts";
export * from "./overlay-port.ts";
export * from "./ready.ts";
export * from "./schema.ts";
export * from "./state.ts";
export * from "./timeline.ts";

declare const __SHOWCASE_VERSION__: string | undefined;
export const RUNTIME_VERSION: string = typeof __SHOWCASE_VERSION__ === "string" ? __SHOWCASE_VERSION__ : "dev";

/** How long the page must be still before a film is armed. */
export const STILL_MS = 400;

/** What the host injects before the runtime (`window.__showcaseConfig`). */
export interface BootConfig {
  tour: Tour;
  mode: Mode;
  speed?: number;
  /** A deep link: the step to start at; earlier writes are fast-forwarded. */
  from?: string;
  /** `rehearse --synthetic` forces synthetic input. Default: trusted when a host is bound. */
  input?: InputMode;
  /** Draw the pointer (a film with `pointer: false` doesn't). */
  pointer?: boolean;
  manifest?: VoiceManifest | null;
  /** `film.cards` as a brand, inlined by the host; absent: showcase's own look. */
  cards?: CardBrand | null;
  /** Start as soon as the document is ready (default). Otherwise the host calls `__showcase.start()`. */
  autostart?: boolean;
  /** A rehearsal (Watch mode, headless): no controls, captions held for each beat's still, a checkpoint per beat. */
  rehearse?: boolean;
  /** Start with the voice muted (`watch --muted`). */
  muted?: boolean;
}

export type AdapterFn = (args?: Record<string, unknown>) => unknown | Promise<unknown>;

/** What a vendored tour gets from the app (PLAN §2.1 "Adapters"). Every part is optional. */
export interface Adapter {
  /** Goes to a URL through the app's router (Next's `router.push`). Absent: a full page load. */
  navigate?: (url: string) => void | Promise<void>;
  /** Puts the app's data back before a tour starts from a link (not on a reload's resume). */
  reset?: () => void | Promise<void>;
  /** Before every start or resume, for example a deterministic AI for this browser. */
  beforeStart?: (info: { tour: Tour; mode: Mode; step: string | null; resumed: boolean }) => void | Promise<void>;
  /** The tour's `invoke` actions, by name (the same registry as `showcase.actions.register`). */
  actions?: Record<string, AdapterFn>;
  /** Where the app serves `tours/`, `voice/` and `assets/` (default `/showcase`). */
  base?: string;
  speed?: number;
  /** Called when the viewer closes the tour. */
  onExit?: () => void;
}

/** How a vendored director reaches the app instead of a host (internal to `startInApp`). */
interface InAppEnv {
  navigate: ((url: string, signal?: AbortSignal) => Promise<void>) | null;
  clipUrl: (file: string) => string;
  assetUrl: (path: string) => string;
  exit: () => void;
}

/** `window.__showcase`: the runtime's API in the page, for the host, the overlay and tests. */
export interface ShowcaseApi {
  version: string;
  director: Director | null;
  config: BootConfig | null;
  /** The acting window while the host acts, else null. */
  acting: Acting | null;
  /** Resolves once the boot has run (whether or not a run started). */
  booted: Promise<void>;
  dispatch(command: Command): void;
  snapshot(): Snapshot | null;
  events(): readonly FilmEvent[];
  /** Starts a run with the config given (or the injected one) when `autostart` was off. */
  start(config?: BootConfig, env?: InAppEnv): Promise<void>;
  /** The adapter registry (`showcase.actions.register`): what `invoke` actions call. */
  actions: { register(name: string, fn: AdapterFn): void; has(name: string): boolean };
  /** The overlay in this document, once a run has booted. */
  overlay: Overlay | null;
  /** What the voice has played (Watch). */
  audio: (AudioStats & { muted: boolean }) | null;
  /** The page outlined by role and name, with suggested anchors (`showcase inspect`). */
  inspect(options?: OutlineOptions): OutlineItem[];
  /** The text a viewer can see now (`rehearse`'s spoken-number and deny-list checks). */
  visibleText(): string;
  /** The recorder's aids: the clock-sync probe, the heartbeat, the page's frame rate. */
  film: FilmAids;
}

type Realm = Window & typeof globalThis;

async function filmReady(n: Natives, signal: AbortSignal, doc: Document): Promise<void> {
  await doc.fonts?.ready;
  await nextFrame(n);
  await nextFrame(n);
  await new Promise<void>((resolve) => {
    const timer = n.setTimeout(resolve, STILL_MS);
    signal.addEventListener(
      "abort",
      () => {
        n.clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

function samePath(win: Window, path: string): boolean {
  const here = `${win.location.pathname}${win.location.search}`;
  return here === path || win.location.pathname === path;
}

/** Builds the director for a document and starts or resumes the run. */
function uiOf(config: BootConfig): OverlayUi {
  return config.mode === "film" ? "film" : config.rehearse ? "rehearse" : "watch";
}

/** A control or a viewer's key, as a director command. */
function command(api: ShowcaseApi, bridge: Bridge, c: ControlCommand): void {
  const snap = api.snapshot();
  if (!snap) return;
  switch (c) {
    case "toggle":
      api.dispatch({ type: snap.paused ? "resume" : "pause" });
      return;
    case "back":
      api.dispatch({ type: "back" });
      return;
    case "next":
      api.dispatch({ type: "next" });
      return;
    case "mute":
      api.dispatch({ type: "mute" });
      return;
    case "retry":
      api.dispatch({ type: "retry" });
      return;
    case "skip":
      api.dispatch({ type: "skip" });
      return;
    case "exit":
      if (snap.status === "done") bridge.exit();
      else api.dispatch({ type: "end" });
      return;
  }
}

/** In-app, Esc and the close control end the tour at once and take the overlay down. */
function inAppCommand(api: ShowcaseApi, env: InAppEnv, bridge: Bridge, c: ControlCommand): void {
  if (c !== "exit") {
    command(api, bridge, c);
    return;
  }
  if (api.snapshot()?.status !== "done") api.dispatch({ type: "end" });
  env.exit();
}

/** The in-app env of each vendored run, so the viewer's keys act as its controls do. */
const inAppEnvs = new WeakMap<ShowcaseApi, InAppEnv>();

function control(api: ShowcaseApi, bridge: Bridge, c: ControlCommand): void {
  const env = inAppEnvs.get(api);
  if (env) inAppCommand(api, env, bridge, c);
  else command(api, bridge, c);
}

async function bootDirector(win: Realm, api: ShowcaseApi, config: BootConfig, n: Natives, adapters: Map<string, AdapterFn>, top: TopLayer, env: InAppEnv | null = null): Promise<void> {
  const doc = win.document;
  const bridge = createBridge(win);
  if (env) inAppEnvs.set(api, env);
  let storage: Storage | null = null;
  try {
    storage = win.sessionStorage;
  } catch {
    storage = null;
  }
  const store: StateStore = bridge.present ? hostStore({ load: () => bridge.loadState(), save: (s) => bridge.saveState(s), clear: () => bridge.clearState() }) : storageStore(storage, n.dateNow);
  const prior = await store.load();
  const resumed = prior !== null && prior.tourId === config.tour.id;
  const docNumber = resumed && prior ? prior.doc + 1 : 1;
  const ctx: AnchorContext = { document: doc, anchors: config.tour.anchors ?? {} };
  let speed = config.speed ?? 1;
  const ui = uiOf(config);
  const overlay = createOverlay({
    document: doc,
    topLayer: top,
    natives: n,
    speed: () => speed,
    ui,
    pointer: config.pointer !== false,
    lingerCaptions: ui === "rehearse",
    ...(ui === "rehearse" ? { reducedMotion: true } : {}),
    title: config.tour.title,
    ...(config.cards ? { cards: config.cards } : {}),
    onCommand: (c) => control(api, bridge, c),
  });
  api.overlay = overlay;
  if (resumed && prior?.pointer) overlay.movePointer(prior.pointer.x, prior.pointer.y);
  let audio: BridgeAudio | null = null;
  if (ui === "watch") {
    audio = createBridgeAudio({
      bridge,
      document: doc,
      manifest: config.manifest ?? null,
      ...(config.muted !== undefined ? { muted: config.muted } : {}),
      storage,
      setTimeout: n.setTimeout,
      clearTimeout: n.clearTimeout,
      ...(env ? { clipUrl: env.clipUrl } : {}),
    });
    const a = audio;
    api.audio = {
      get played() {
        return a.stats.played;
      },
      get failed() {
        return a.stats.failed;
      },
      get muted() {
        return a.muted;
      },
    };
  }
  const publish = (snapshot: Snapshot | null) => {
    bridge.snapshot(snapshot);
    if (!snapshot) return;
    overlay.view({
      status: snapshot.status,
      stepIndex: snapshot.stepIndex,
      stepCount: snapshot.stepCount,
      paused: snapshot.paused,
      muted: snapshot.muted,
      blocked: snapshot.blocked ? snapshot.blocked.message : null,
      ended: snapshot.ended?.reason ?? null,
    });
  };
  const timers = { now: n.perfNow, setTimeout: n.setTimeout, clearTimeout: n.clearTimeout };

  const director = new Director({
    tour: config.tour,
    clocks: (s) => {
      speed = s;
      return createClocks(s, timers);
    },
    executor: ({ clocks, onPhase, onCamera, onNote }) =>
      createExecutor({
        pace: clocks.pace,
        wall: clocks.wall,
        ctx,
        natives: n,
        bridge,
        ...(config.input ? { input: config.input } : {}),
        ...(env?.navigate ? { navigate: env.navigate } : {}),
        ...(env ? { readFile: (path: string) => fetchFile(win, env.assetUrl(path)) } : {}),
        overlay,
        invoke: async (name, args) => {
          const fn = adapters.get(name);
          if (!fn) throw new Error(`no adapter registered for invoke '${name}'`);
          return fn(args);
        },
        onPhase,
        onCamera,
        onNote: (note) => {
          onNote(note);
          bridge.log("info", note);
        },
        acting: (a) => {
          api.acting = a;
        },
        frame: () => nextFrame(n),
      }),
    waitFor: (ready, options) => waitFor(ready, { clock: options.clock, ctx: contextOf(ctx), timeoutMs: options.timeoutMs, ...(options.signal ? { signal: options.signal } : {}) }),
    navigate: (path, signal) => {
      if (samePath(win, path)) return Promise.resolve();
      if (env?.navigate) return env.navigate(path, signal);
      win.location.assign(path);
      // The document is going away: the next one resumes the run.
      return signal ? whenAborted(signal) : new Promise<void>(() => {});
    },
    store,
    timeline: (stamp) => createTimeline({ stamp, t: () => n.timeOrigin + n.perfNow(), wall: n.dateNow, window: win, ...(bridge.present ? { send: (e) => bridge.event(e) } : {}) }),
    manifest: config.manifest ?? null,
    audio,
    overlay,
    publish,
    ...(ui === "rehearse" && bridge.present
      ? {
          checkpoint: async ({ stepIndex, beatIndex, step, beat }) => {
            await nextFrame(n);
            await nextFrame(n);
            const card = beat.card ? { title: beat.card.title, ...(beat.card.kicker ? { kicker: beat.card.kicker } : {}), lines: beat.card.lines ?? [] } : null;
            await bridge.checkpoint({ stepIndex, beatIndex, step: step.id, beat: beat.id, narration: (beat.narration ?? []).map(sentenceText), card });
            overlay.clearCaption();
          },
        }
      : {}),
    now: n.dateNow,
    viewport: () => ({ w: win.innerWidth, h: win.innerHeight, dpr: win.devicePixelRatio || 1 }),
    filmReady: (signal) => filmReady(n, signal, doc),
    waitGo: () => waitForGo(win).armed,
    frame: () => nextFrame(n),
    runtimeVersion: RUNTIME_VERSION,
    doc: docNumber,
  });
  api.director = director;
  api.config = config;
  bridge.ready({ doc: docNumber, resumed, url: win.location.href });
  if (resumed && prior) director.resume(prior);
  else if (config.autostart !== false) director.start({ mode: config.mode, speed: config.speed ?? 1, ...(config.from ? { from: config.from } : {}) });
}

/** The pointer or key event is the viewer's, not the tour's: outside the acting window. */
function isViewerInput(api: ShowcaseApi, n: Natives, e: Event): boolean {
  if (!e.isTrusted) return false;
  const a = api.acting;
  if (!a) return true;
  return n.perfNow() > a.deadline;
}

/**
 * Boots the runtime in this document: captures the natives, publishes `window.__showcase`,
 * and starts or resumes the run once the DOM is ready. Top frame only; once per document.
 */
export function boot(win: Realm = window as Realm): ShowcaseApi | null {
  if (!isTopFrame(win)) return null;
  const w = win as unknown as Record<string, unknown>;
  if (w[API_KEY]) return w[API_KEY] as ShowcaseApi;
  const n = captureNatives(win);
  // Before any app code: the top-layer watch and the control guard (S-D2, S-D3).
  const top = installTopLayer(win);
  const adapters = new Map<string, AdapterFn>();
  let bootedResolve = () => {};
  const api: ShowcaseApi = {
    version: RUNTIME_VERSION,
    director: null,
    config: null,
    acting: null,
    booted: new Promise<void>((resolve) => {
      bootedResolve = resolve;
    }),
    dispatch: (command) => api.director?.dispatch(command),
    snapshot: () => api.director?.snapshot ?? null,
    events: () => api.director?.events ?? [],
    start: async (config, env) => {
      const c = config ?? (w.__showcaseConfig as BootConfig | undefined);
      if (!c) throw new Error("no showcase config");
      if (api.director) {
        api.director.start({ mode: c.mode, speed: c.speed ?? 1, ...(c.from ? { from: c.from } : {}) });
        return;
      }
      await bootDirector(win, api, { ...c, autostart: true }, n, adapters, top, env ?? null);
    },
    actions: {
      register: (name, fn) => {
        adapters.set(name, fn);
      },
      has: (name) => adapters.has(name),
    },
    overlay: null,
    audio: null,
    inspect: (options) => outline(win.document, options),
    visibleText: () => visibleText(win.document),
    film: createFilmAids(win, n),
  };
  Object.defineProperty(win, API_KEY, { value: api, configurable: true, enumerable: false, writable: false });
  // A page load mid-film: the heartbeat goes on again before anything else is drawn. The host's
  // init scripts (`__showcaseConfig`, `__showcaseRolling`) run after this one, so look again once
  // they have: a still screen after a page load otherwise sends no frames at all.
  const rearm = () => {
    const early = w.__showcaseConfig as BootConfig | undefined;
    if (w[ROLLING_KEY] === true && early?.mode === "film") api.film.heartbeat(true);
  };
  rearm();
  n.setTimeout(rearm, 0);

  const watching = () => {
    const snap = api.snapshot();
    return snap && snap.mode === "watch" && api.config && uiOf(api.config) === "watch" ? snap : null;
  };
  // A viewer's click pauses a Watch tour (PLAN §2.1 "acting window"). Registered before any app
  // code, after the guard, so a click on the controls never gets here.
  win.addEventListener(
    "pointerdown",
    (e) => {
      const snap = watching();
      if (!snap || snap.status !== "playing") return;
      if (isViewerInput(api, n, e)) api.dispatch({ type: "pause" });
    },
    true,
  );
  // The viewer's keys in Watch (PLAN §2.2): Space pauses, ← and → step, M mutes, Esc exits.
  const KEYS: Record<string, ControlCommand> = { " ": "toggle", Spacebar: "toggle", ArrowLeft: "back", ArrowRight: "next", m: "mute", M: "mute", Escape: "exit" };
  win.addEventListener(
    "keydown",
    (e) => {
      const c = KEYS[e.key];
      if (!c || e.altKey || e.ctrlKey || e.metaKey || !watching() || !isViewerInput(api, n, e)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!e.repeat) control(api, createBridge(win), c);
    },
    true,
  );

  const ready = () => {
    const config = w.__showcaseConfig as BootConfig | undefined;
    const done = () => bootedResolve();
    // The context's first document is about:blank: nothing to run there.
    if (!config || !/^(https?|file):$/.test(win.location.protocol)) {
      done();
      return;
    }
    bootDirector(win, api, config, n, adapters, top).then(done, (e) => {
      createBridge(win).log("warn", `boot failed: ${e instanceof Error ? e.message : String(e)}`);
      done();
    });
  };
  if (win.document.readyState === "loading") win.document.addEventListener("DOMContentLoaded", ready, { once: true });
  else ready();
  return api;
}

export { describeAnchor as describe };

async function fetchFile(win: Realm, url: string): Promise<import("./dom-events.ts").FileData> {
  const res = await win.fetch(url);
  if (!res.ok) throw new Error(`couldn't fetch ${url}: ${res.status}`);
  const name = decodeURIComponent(url.split("/").pop() ?? "file");
  return { name, type: res.headers.get("content-type") ?? "application/octet-stream", bytes: new Uint8Array(await res.arrayBuffer()) };
}

async function fetchJson(win: Realm, url: string): Promise<unknown> {
  const res = await win.fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

/** The run the tab is part-way through, if any: the host's (a film) or the tab's own. */
async function priorRun(win: Realm, bridge: Bridge, now: () => number): Promise<RunState | null> {
  if (bridge.present) return hostStore({ load: () => bridge.loadState(), save: () => {}, clear: () => {} }).load();
  let storage: Storage | null = null;
  try {
    storage = win.sessionStorage;
  } catch {
    storage = null;
  }
  return storageStore(storage, now).load();
}

/**
 * The in-app boot (PLAN §2.6): what the vendored adapters call once the page wants a tour
 * (`wantsShowcase`). A deep link starts the tour afresh, from `showcaseStep` if it names one, and
 * takes its parameters off the URL, so a reload finds no link and resumes the run saved in the
 * tab without writing twice. With neither a link nor a saved run it does nothing and returns null.
 *
 * Input is synthetic only. The voice starts muted (the viewer turns it on with the control,
 * inside the click, as browsers require). Run state is the tab's sessionStorage, or the host's
 * when `film --in-app` records the page.
 */
export function startInApp(adapter: Adapter = {}, win: Realm = window as Realm): Promise<ShowcaseApi | null> {
  // Once per document: React's strict mode, or two adapters, may call it twice at once.
  let started = inAppStarts.get(win);
  if (!started) {
    started = startOnce(adapter, win);
    inAppStarts.set(win, started);
    started.catch(() => inAppStarts.delete(win));
  }
  return started;
}

const inAppStarts = new WeakMap<Realm, Promise<ShowcaseApi | null>>();

async function startOnce(adapter: Adapter, win: Realm): Promise<ShowcaseApi | null> {
  if (!isTopFrame(win)) return null;
  const bridge = createBridge(win);
  const link = readDeepLink(win.location.search);
  let tourId: string;
  let mode: Mode;
  let step: string | null = null;
  let resumed = false;
  if (link) {
    tourId = link.tour;
    mode = link.mode;
    step = link.step;
    try {
      win.history.replaceState(win.history.state, "", `${win.location.pathname}${withoutShowcaseParams(win.location.search)}${win.location.hash}`);
    } catch {
      // A sandboxed document: the link stays, and a reload starts again.
    }
    if (!bridge.present) {
      try {
        win.sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // A refused store: the run just isn't saved.
      }
    }
  } else {
    const prior = await priorRun(win, bridge, () => Date.now());
    if (!prior) return null;
    tourId = prior.tourId;
    mode = prior.mode;
    resumed = true;
  }

  const api = boot(win);
  if (!api) return null;
  await api.booted;
  if (api.director) return api;
  const paths = servedPaths(adapter.base ?? DEFAULT_BASE, tourId);
  const tour = (await fetchJson(win, paths.tour)) as Tour;
  if (!tour || tour.showcase !== 1 || tour.id !== tourId) throw new Error(`${paths.tour} isn't the tour ${tourId}: run \`showcase runtime vendor\``);
  let manifest: VoiceManifest | null = null;
  for (const url of paths.manifests) {
    const m = (await fetchJson(win, url).catch(() => null)) as VoiceManifest | null;
    if (m && m.v === 1 && m.tour === tourId && Array.isArray(m.clips)) {
      manifest = m;
      break;
    }
  }
  for (const [name, fn] of Object.entries(adapter.actions ?? {})) api.actions.register(name, fn);
  if (!resumed) await adapter.reset?.();
  // A page load mid-film (`film --in-app`): the heartbeat goes on again at once.
  if (mode === "film" && (win as unknown as Record<string, unknown>)[ROLLING_KEY] === true) api.film.heartbeat(true);
  await adapter.beforeStart?.({ tour, mode, step, resumed });

  const push = adapter.navigate;
  const env: InAppEnv = {
    navigate: push
      ? (url, signal) =>
          routeTo(url, {
            push,
            at: () => samePath(win, url),
            now: () => win.performance.now(),
            sleep: (ms) => new Promise((r) => win.setTimeout(r, ms)),
            ...(signal ? { signal } : {}),
          })
      : null,
    clipUrl: paths.clip,
    assetUrl: paths.asset,
    exit: () => {
      api.overlay?.destroy();
      api.overlay = null;
      try {
        win.sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // As above.
      }
      adapter.onExit?.();
    },
  };
  await api.start(
    {
      tour,
      mode,
      speed: adapter.speed ?? 1,
      ...(step ? { from: step } : {}),
      input: "synthetic",
      manifest,
      muted: true,
    },
    env,
  );
  return api;
}
