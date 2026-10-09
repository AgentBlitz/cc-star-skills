/**
 * A target repo's showcase project as the host commands see it: the `showcase/` dir, its config,
 * where output goes, the voice manifest, and a session that brings the app up, holds the repo's
 * lock and takes everything down again, whatever happens (a failure, Ctrl-C, a SIGTERM).
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { type Config, loadConfig, withDefaults } from "../lib/config.ts";
import { repoRoot } from "../lib/paths.ts";
import { loadTour, resolveTour, type TourFile } from "../lib/tours.ts";
import { manifestFile } from "../voice/manifest.ts";
import type { VoiceManifest } from "../runtime/src/protocol.ts";
import type { Tour } from "../runtime/src/schema.ts";
import { acquireLock, type App, type Lock, startApp } from "./app.ts";
import type { BrowserSettings } from "./launch.ts";

export interface Project {
  /** The `showcase/` dir, or null for a tour outside one. */
  showcaseDir: string | null;
  /** Where app commands run: the directory holding `showcase/`. */
  root: string;
  config: Config;
}

/** The project a tour belongs to. A tour outside `showcase/tours/` gets the defaults and needs `--url`. */
export function projectOf(tf: TourFile, cwd: string = process.cwd()): Project {
  if (tf.showcaseDir) return { showcaseDir: tf.showcaseDir, root: dirname(tf.showcaseDir), config: loadConfig(tf.showcaseDir) };
  const root = repoRoot(cwd) ?? cwd;
  const dir = join(root, "showcase");
  if (existsSync(join(dir, "config.json"))) return { showcaseDir: dir, root, config: loadConfig(dir) };
  return { showcaseDir: null, root, config: withDefaults({ showcase: 1, app: { url: "http://127.0.0.1" } }) };
}

/** The project for a command with no tour (`inspect`, `auth`): the repo's `showcase/`, if any. */
export function projectHere(cwd: string = process.cwd()): Project {
  const root = repoRoot(cwd) ?? cwd;
  const dir = join(root, "showcase");
  if (existsSync(join(dir, "config.json"))) return { showcaseDir: dir, root, config: loadConfig(dir) };
  return { showcaseDir: null, root, config: withDefaults({ showcase: 1, app: { url: "http://127.0.0.1" } }) };
}

export function loadValidTour(arg: string): { tf: TourFile; tour: Tour } {
  const loaded = loadTour(resolveTour(arg));
  if (!loaded.tour) {
    const first = loaded.issues.find((i) => i.level === "error");
    throw new Error(`the tour doesn't match the schema${first ? ` (${first.rule} ${first.path}: ${first.message})` : ""}; run \`showcase check ${arg}\``);
  }
  return { tf: loaded, tour: loaded.tour };
}

/** `showcase/out/<id>/`, or `--out`. */
export function outDir(p: Project, id: string, out?: string): string {
  const dir = out ? resolve(out) : p.showcaseDir ? join(p.showcaseDir, "out", id) : resolve("showcase-out", id);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** The browser settings, with `storageState` resolved against the `showcase/` dir. */
export function browserSettings(p: Project, o: { storageState?: boolean } = {}): BrowserSettings {
  const b = p.config.browser;
  const state = b.storageState && o.storageState !== false ? (isAbsolute(b.storageState) ? b.storageState : resolve(p.showcaseDir ?? p.root, b.storageState)) : undefined;
  if (state && !existsSync(state)) throw new Error(`browser.storageState names ${b.storageState}, which doesn't exist: run \`showcase auth\``);
  return {
    scale: b.scale,
    ...(b.viewport ? { viewport: b.viewport } : {}),
    colorScheme: b.colorScheme,
    locale: b.locale,
    timezone: b.timezone,
    ...(b.clock ? { clock: b.clock } : {}),
    ...(state ? { storageState: state } : {}),
    gpu: b.gpu,
    block: b.block,
    hide: b.hide,
  };
}

/**
 * The voice manifest for a tour, and the dir its clips resolve in: `--manifest`, else
 * `<voice.dir>/<tour>.manifest.json` (`showcase voice` writes it), else a hand-made
 * `<voice.dir>/manifest.json` when it is this tour's. A missing one is fine (the tour reads at
 * `readingMs`).
 */
export function voiceFor(p: Project, tour: Tour, manifestArg?: string): { manifest: VoiceManifest | null; dir: string | null } {
  const dir = resolve(p.root, p.config.voice.dir);
  const file = manifestArg ? resolve(manifestArg) : [manifestFile(dir, tour.id), join(dir, "manifest.json")].find((f) => existsSync(f));
  if (!file || !existsSync(file)) {
    if (manifestArg) throw new Error(`no manifest at ${file}`);
    return { manifest: null, dir: null };
  }
  const m = JSON.parse(readFileSync(file, "utf8")) as VoiceManifest;
  if (!m || m.v !== 1 || !Array.isArray(m.clips)) throw new Error(`${file} isn't a voice manifest`);
  if (m.tour !== tour.id) return { manifest: null, dir: null };
  return { manifest: m, dir: dirname(file) };
}

export interface Session {
  app: App;
  lock: Lock | null;
  /** Takes everything down; safe to call twice. */
  close(): Promise<void>;
  /** Runs when the process is asked to stop (Ctrl-C, SIGTERM, SIGHUP), before it exits. */
  onStop(fn: () => Promise<void> | void): void;
}

export interface SessionOptions {
  what: string;
  build?: boolean;
  reset?: boolean;
  /** An app already running (skip the lifecycle and the lock). */
  url?: string;
  logFile?: string;
  say?: (line: string) => void;
}

/** Holds the lock and brings the app up. Signals take everything down, then exit. */
export async function openSession(p: Project, o: SessionOptions): Promise<Session> {
  const managed = !o.url && !!p.config.app.start;
  const lock = managed && p.showcaseDir ? acquireLock(p.showcaseDir, o.what) : null;
  const stops: (() => Promise<void> | void)[] = [];
  let app: App | null = null;
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    for (const fn of stops.reverse()) {
      try {
        await fn();
      } catch {
        // Keep going: the app and the lock must still go.
      }
    }
    await app?.stop();
    lock?.release();
  };
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGHUP"];
  const onSignal = (sig: NodeJS.Signals) => {
    void close().finally(() => process.exit(sig === "SIGINT" ? 130 : 143));
  };
  for (const s of signals) process.once(s, onSignal);
  process.once("exit", () => lock?.release());
  try {
    app = await startApp(p.config.app, {
      root: p.root,
      ...(o.build ? { build: true } : {}),
      ...(o.reset === false ? { reset: false } : {}),
      ...(o.url ? { url: o.url } : {}),
      ...(o.logFile ? { logFile: o.logFile } : {}),
      ...(o.say ? { say: o.say } : {}),
    });
  } catch (e) {
    await close();
    for (const s of signals) process.off(s, onSignal);
    throw e;
  }
  const a = app;
  return {
    app: a,
    lock,
    close: async () => {
      await close();
      for (const s of signals) process.off(s, onSignal);
    },
    onStop: (fn) => {
      stops.push(fn);
    },
  };
}

/** A tour path or URL joined to the app's base URL. */
export function appUrl(base: string, path: string | undefined): string {
  if (!path) return `${base}/`;
  if (/^https?:\/\//.test(path)) return path;
  return new URL(path, `${base}/`).href;
}
