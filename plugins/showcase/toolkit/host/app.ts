/**
 * The app's lifecycle (PLAN §2.2 "The host also", §2.5 "Take"): build, restore the snapshot,
 * start on a port of showcase's own, wait for health, reset, and stop the whole process group on
 * the way out. A per-repo lock keeps two runs from sharing (or resetting) one app.
 *
 * Commands run with `sh -c` in the repo (the directory holding `showcase/`), with the app's
 * normal environment minus showcase's keys (`appEnv`, PLAN §2.3) plus `app.env`. `{port}` and
 * `{url}` are replaced in `start`, `url`, `health`, `env`, `reset` and `snapshot`.
 */
import { type ChildProcess, spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { appEnv } from "../lib/child-env.ts";
import type { Config } from "../lib/config.ts";

export const HEALTH_TIMEOUT_MS = 120_000;
const KILL_GRACE_MS = 5_000;

/** A free TCP port on the loopback interface. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.unref();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const addr = s.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      s.close(() => resolve(port));
    });
  });
}

// ——— The lock ———

export interface Lock {
  file: string;
  release(): void;
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

export class LockError extends Error {
  readonly pid: number;
  constructor(file: string, pid: number) {
    super(`another showcase run (pid ${pid}) is using this repo's app; wait for it, or stop it (lock: ${file})`);
    this.name = "LockError";
    this.pid = pid;
  }
}

/** Takes `<showcaseDir>/.cache/host.lock`. A lock whose process has gone is taken over. */
export function acquireLock(showcaseDir: string, what: string): Lock {
  const file = join(showcaseDir, ".cache", "host.lock");
  mkdirSync(dirname(file), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(file, "wx", 0o600);
      writeSync(fd, JSON.stringify({ pid: process.pid, what, at: new Date().toISOString() }));
      closeSync(fd);
      let released = false;
      return {
        file,
        release() {
          if (released) return;
          released = true;
          try {
            const held = JSON.parse(readFileSync(file, "utf8")) as { pid?: number };
            if (held.pid === process.pid) rmSync(file, { force: true });
          } catch {
            // Already gone.
          }
        },
      };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      let pid = 0;
      try {
        pid = Number((JSON.parse(readFileSync(file, "utf8")) as { pid?: number }).pid) || 0;
      } catch {
        pid = 0;
      }
      if (pid && pid !== process.pid && alive(pid)) throw new LockError(file, pid);
      rmSync(file, { force: true });
    }
  }
  throw new Error(`couldn't take the lock ${file}`);
}

// ——— Hooks and commands ———

type Hook = NonNullable<Config["app"]["reset"]>;

export function fill(template: string, vars: { port?: number | null; url?: string | null }): string {
  let out = template;
  if (vars.port != null) out = out.replaceAll("{port}", String(vars.port));
  if (vars.url != null) out = out.replaceAll("{url}", vars.url);
  return out;
}

export interface RunOptions {
  cwd: string;
  env: Record<string, string>;
  /** Where the command's output goes (a log file's fd), else inherited stderr. */
  out?: number | "ignore";
  timeoutMs?: number;
}

/** Runs a shell command to completion; rejects on a non-zero exit. */
export function runCommand(command: string, what: string, o: RunOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const out = o.out ?? "ignore";
    const child = spawn("sh", ["-c", command], { cwd: o.cwd, env: o.env, stdio: ["ignore", out, out], detached: true });
    const timer = o.timeoutMs
      ? setTimeout(() => {
          killGroup(child.pid);
          reject(new Error(`${what} timed out after ${o.timeoutMs} ms: ${command}`));
        }, o.timeoutMs)
      : null;
    child.once("error", (e) => {
      if (timer) clearTimeout(timer);
      reject(e);
    });
    child.once("exit", (code, signal) => {
      if (timer) clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`${what} failed (${signal ?? `exit ${code}`}): ${command}`));
    });
  });
}

async function runHook(hook: Hook, what: string, vars: { port: number | null; url: string }, o: RunOptions): Promise<void> {
  if (typeof hook === "string") {
    await runCommand(fill(hook, vars), what, { ...o, timeoutMs: o.timeoutMs ?? 300_000 });
    return;
  }
  const url = new URL(fill(hook.url, vars), vars.url).href;
  const res = await fetch(url, { method: hook.method ?? "POST", signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`${what} failed: ${hook.method ?? "POST"} ${url} answered ${res.status}`);
  await res.arrayBuffer().catch(() => null);
}

/** Sends the signal to the whole process group, ignoring one that has gone. */
export function killGroup(pid: number | undefined, signal: NodeJS.Signals = "SIGTERM"): void {
  if (!pid) return;
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      // Gone.
    }
  }
}

export function groupAlive(pid: number): boolean {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** Waits for every process in the group to exit; false if some are still there after `ms`. */
export async function groupGone(pid: number, ms: number): Promise<boolean> {
  const t0 = Date.now();
  while (groupAlive(pid)) {
    if (Date.now() - t0 > ms) return false;
    await new Promise((r) => setTimeout(r, 50));
  }
  return true;
}

// ——— The app ———

export interface App {
  /** The base URL the tour runs against. */
  url: string;
  port: number | null;
  /** The server's process group, when showcase started it. */
  pid: number | null;
  stop(): Promise<void>;
}

export interface StartOptions {
  /** The repo: where commands run. */
  root: string;
  /** Run `app.build` first. */
  build?: boolean;
  /** Restore the snapshot and reset (default true). */
  reset?: boolean;
  /** An app already running: skip the lifecycle. */
  url?: string;
  /** Where the server's output goes. */
  logFile?: string;
  healthTimeoutMs?: number;
  /** Progress lines. */
  say?: (line: string) => void;
}

async function waitHealthy(url: string, child: ChildProcess | null, timeoutMs: number): Promise<void> {
  const started = Date.now();
  let last = "no answer";
  while (Date.now() - started < timeoutMs) {
    if (child && child.exitCode !== null) throw new Error(`the app exited (code ${child.exitCode}) before ${url} answered`);
    try {
      const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(5_000) });
      await res.arrayBuffer().catch(() => null);
      if (res.status < 400) return;
      last = `HTTP ${res.status}`;
    } catch (e) {
      last = (e as Error).message;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`the app wasn't healthy after ${Math.round(timeoutMs / 1000)} s: ${url} (${last})`);
}

/**
 * Brings the app up (PLAN §2.5 "Take"): build → snapshot → start on its own port → health →
 * reset. With no `start` command, or an explicit URL, it only checks health: the app is the
 * user's (a deployed site, or a server they run).
 */
export async function startApp(app: Config["app"], o: StartOptions): Promise<App> {
  const say = o.say ?? (() => {});
  const timeoutMs = o.healthTimeoutMs ?? HEALTH_TIMEOUT_MS;
  const out = o.logFile ? openSync(o.logFile, "a", 0o600) : "ignore";
  const closeOut = () => {
    if (typeof out === "number") {
      try {
        closeSync(out);
      } catch {
        // Closed.
      }
    }
  };
  const external = o.url ?? (!app.start ? app.url : null);
  if (external) {
    if (external.includes("{port}")) throw new Error(`app.url has {port} but there's no app.start to run it on: ${external}`);
    const url = external.replace(/\/$/, "");
    const health = new URL(app.health ?? "/", `${url}/`).href;
    await waitHealthy(health, null, Math.min(timeoutMs, 30_000));
    closeOut();
    return { url, port: null, pid: null, stop: async () => {} };
  }
  const port = app.url.includes("{port}") || (app.start ?? "").includes("{port}") ? await freePort() : null;
  const url = fill(app.url, { port }).replace(/\/$/, "");
  const vars = { port, url };
  const env = appEnv(process.env, {
    ...Object.fromEntries(Object.entries(app.env ?? {}).map(([k, v]) => [k, fill(v, vars)])),
    ...(port ? { PORT: String(port) } : {}),
  });
  const run: RunOptions = { cwd: o.root, env, out };
  if (o.build && app.build) {
    say(`building: ${app.build}`);
    await runCommand(fill(app.build, vars), "app.build", { ...run, timeoutMs: 15 * 60_000 });
  }
  const reset = o.reset !== false;
  if (reset && app.snapshot) {
    say("restoring the snapshot");
    await runHook(app.snapshot, "app.snapshot", vars, run);
  }
  const start = fill(app.start as string, vars);
  say(`starting: ${start}`);
  const child = spawn("sh", ["-c", start], { cwd: o.root, env, stdio: ["ignore", out, out], detached: true });
  const pid = child.pid ?? null;
  let stopped = false;
  const exited = new Promise<void>((r) => {
    if (child.exitCode !== null || child.signalCode !== null) r();
    child.once("exit", () => r());
    setTimeout(r, KILL_GRACE_MS).unref();
  });
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    killGroup(pid ?? undefined, "SIGTERM");
    // The whole group, not just the shell: a server's own children go too.
    await exited;
    if (pid && !(await groupGone(pid, KILL_GRACE_MS))) {
      killGroup(pid, "SIGKILL");
      await groupGone(pid, 2_000);
    }
    if (pid) groups.delete(pid);
    closeOut();
  };
  stopOnExit(pid);
  try {
    await waitHealthy(new URL(app.health ?? "/", `${url}/`).href, child, timeoutMs);
    if (reset && app.reset) {
      say("resetting");
      await runHook(app.reset, "app.reset", vars, run);
    }
  } catch (e) {
    await stop();
    throw e;
  }
  return { url, port, pid, stop };
}

const groups = new Set<number>();
let hooked = false;
/** A crash or an exit still takes the app's process group down. */
function stopOnExit(pid: number | null): void {
  if (!pid) return;
  groups.add(pid);
  if (hooked) return;
  hooked = true;
  process.on("exit", () => {
    for (const g of groups) killGroup(g, "SIGKILL");
  });
}
