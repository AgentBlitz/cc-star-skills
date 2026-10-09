/**
 * `showcase auth` (PLAN §2.2, §2.3): a headed browser on the app for the user to sign in; when
 * they close the window (or press Enter in the terminal) the session is saved as Playwright
 * `storageState` to `showcase/.auth/state.json`: the directory 700, the file 600, ignored by git
 * and treated as a secret (the plugin's hook keeps tools away from it). Nothing is printed from it.
 */
import { chmodSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type Host, launchHost } from "./launch.ts";
import { appUrl, browserSettings, openSession, type Project } from "./project.ts";

export function authFile(showcaseDir: string): string {
  return join(showcaseDir, ".auth", "state.json");
}

/** Writes the state with owner-only permissions, atomically. */
export function writeSecret(file: string, body: string): void {
  const dir = dirname(file);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, body, { mode: 0o600 });
  chmodSync(tmp, 0o600);
  renameSync(tmp, file);
}

export interface AuthOptions {
  project: Project;
  /** The page to open (a path on the app, or a URL). */
  path?: string;
  url?: string;
  /** Resolves when the user is done (Enter in a terminal); the window closing also ends it. */
  done?: Promise<void>;
  say?: (line: string) => void;
}

export async function auth(o: AuthOptions): Promise<{ file: string; cookies: number; origins: number }> {
  const p = o.project;
  if (!p.showcaseDir) throw new Error("no showcase/ here: run `showcase init` first");
  const file = authFile(p.showcaseDir);
  const session = await openSession(p, { what: "auth", ...(o.url ? { url: o.url } : {}), reset: false, snapshot: true, ...(o.say ? { say: o.say } : {}) });
  let host: Host | null = null;
  session.onStop(async () => {
    await host?.close();
  });
  try {
    host = await launchHost({ url: appUrl(session.app.url, o.path), tour: null, mode: "watch", maximised: true, browser: browserSettings(p, { storageState: false }) });
    const h = host;
    o.say?.("sign in in the browser window, then close it (or press Enter here)");
    // The latest state, kept as the user goes: a closed window can't be asked any more.
    let state: string | null = null;
    const grab = async () => {
      try {
        state = JSON.stringify(await h.context.storageState());
      } catch {
        // Closing.
      }
    };
    const timer = setInterval(() => void grab(), 1000);
    await Promise.race([h.closed, o.done ?? new Promise<void>(() => {})]);
    clearInterval(timer);
    if (h.browser.isConnected()) await grab();
    if (!state) throw new Error("no sign-in was recorded");
    const parsed = JSON.parse(state) as { cookies?: unknown[]; origins?: unknown[] };
    writeSecret(file, state);
    return { file, cookies: parsed.cookies?.length ?? 0, origins: parsed.origins?.length ?? 0 };
  } finally {
    await host?.close();
    await session.close();
  }
}
