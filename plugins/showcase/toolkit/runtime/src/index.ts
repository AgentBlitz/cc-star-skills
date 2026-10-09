/**
 * The showcase runtime (PLAN §2.1, D7, D16): one framework-agnostic engine that runs injected
 * (Watch and film, through the host) or vendored in-app (Session 10). This module is the ESM
 * entry for vendoring and the API the IIFE (`inject.ts`) boots from. The external boot reads
 * the config the host injects as `window.__showcaseConfig`, captures the real timers before
 * any app code, and starts or resumes the run once the document is ready.
 */
import { type AnchorContext, describeAnchor } from "./anchors.ts";
import { type Acting, createBridge, waitForGo } from "./bridge.ts";
import { captureNatives, isTopFrame, type Natives, nextFrame } from "./capture.ts";
import { createClocks, whenAborted } from "./clock.ts";
import { type Command, Director, type Mode, type Snapshot } from "./director.ts";
import { createExecutor, type InputMode } from "./executor.ts";
import { API_KEY, type FilmEvent } from "./film-events.ts";
import type { VoiceManifest } from "./narration.ts";
import { createOverlayStub } from "./overlay-stub.ts";
import { contextOf, waitFor } from "./ready.ts";
import type { Tour } from "./schema.ts";
import { hostStore, type RunState, type StateStore, storageStore } from "./state.ts";
import { createTimeline } from "./timeline.ts";

export * from "./anchors.ts";
export * from "./bridge.ts";
export * from "./capture.ts";
export * from "./clock.ts";
export * from "./director.ts";
export * from "./dom-events.ts";
export * from "./executor.ts";
export * from "./film-events.ts";
export * from "./narration.ts";
export * from "./narrative.ts";
export * from "./overlay-port.ts";
export * from "./overlay-stub.ts";
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
  /** Start as soon as the document is ready (default). Otherwise the host calls `__showcase.start()`. */
  autostart?: boolean;
}

export type AdapterFn = (args?: Record<string, unknown>) => unknown | Promise<unknown>;

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
  start(config?: BootConfig): Promise<void>;
  /** The adapter registry (`showcase.actions.register`): what `invoke` actions call. */
  actions: { register(name: string, fn: AdapterFn): void; has(name: string): boolean };
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
async function bootDirector(win: Realm, api: ShowcaseApi, config: BootConfig, n: Natives, adapters: Map<string, AdapterFn>): Promise<void> {
  const doc = win.document;
  const bridge = createBridge(win);
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
  const overlay = createOverlayStub({ document: doc, speed: () => speed, visible: config.pointer !== false });
  if (resumed && prior?.pointer) overlay.movePointer(prior.pointer.x, prior.pointer.y);
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
      win.location.assign(path);
      // The document is going away: the next one resumes the run.
      return signal ? whenAborted(signal) : new Promise<void>(() => {});
    },
    store,
    timeline: (stamp) => createTimeline({ stamp, t: () => n.timeOrigin + n.perfNow(), wall: n.dateNow, window: win, ...(bridge.present ? { send: (e) => bridge.event(e) } : {}) }),
    manifest: config.manifest ?? null,
    overlay,
    publish: (snapshot) => bridge.snapshot(snapshot),
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
    start: async (config) => {
      const c = config ?? (w.__showcaseConfig as BootConfig | undefined);
      if (!c) throw new Error("no showcase config");
      if (api.director) {
        api.director.start({ mode: c.mode, speed: c.speed ?? 1, ...(c.from ? { from: c.from } : {}) });
        return;
      }
      await bootDirector(win, api, { ...c, autostart: true }, n, adapters);
    },
    actions: {
      register: (name, fn) => {
        adapters.set(name, fn);
      },
      has: (name) => adapters.has(name),
    },
  };
  Object.defineProperty(win, API_KEY, { value: api, configurable: true, enumerable: false, writable: false });

  // A viewer's click pauses a Watch tour (PLAN §2.1 "acting window"). Registered before any app code.
  win.addEventListener(
    "pointerdown",
    (e) => {
      const snap = api.snapshot();
      if (!snap || snap.mode !== "watch" || snap.status !== "playing") return;
      if (isViewerInput(api, n, e)) api.dispatch({ type: "pause" });
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
    bootDirector(win, api, config, n, adapters).then(done, (e) => {
      createBridge(win).log("warn", `boot failed: ${e instanceof Error ? e.message : String(e)}`);
      done();
    });
  };
  if (win.document.readyState === "loading") win.document.addEventListener("DOMContentLoaded", ready, { once: true });
  else ready();
  return api;
}

export { describeAnchor as describe };
