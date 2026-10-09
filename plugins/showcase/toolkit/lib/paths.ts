/**
 * Where showcase keeps things (PLAN §2.3, D11): the user config dir (the key file), the
 * cache (playwright-core), the plugin root and the current repo. `${CLAUDE_PLUGIN_ROOT}`
 * isn't exported to Bash, so the plugin root comes from this file's own location.
 */
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export type Env = Record<string, string | undefined>;

function home(env: Env): string {
  return env.HOME || homedir();
}

/** `${SHOWCASE_CONFIG_DIR:-${XDG_CONFIG_HOME:-~/.config}/showcase}` */
export function configDir(env: Env = process.env): string {
  if (env.SHOWCASE_CONFIG_DIR) return resolve(env.SHOWCASE_CONFIG_DIR);
  return join(env.XDG_CONFIG_HOME || join(home(env), ".config"), "showcase");
}

/** The user key file. Only `env.ts` reads it. */
export function userKeyFile(env: Env = process.env): string {
  return join(configDir(env), ".env");
}

/** `${SHOWCASE_CACHE_DIR:-${XDG_CACHE_HOME:-~/.cache}/showcase}` */
export function cacheDir(env: Env = process.env): string {
  if (env.SHOWCASE_CACHE_DIR) return resolve(env.SHOWCASE_CACHE_DIR);
  return join(env.XDG_CACHE_HOME || join(home(env), ".cache"), "showcase");
}

/** `plugins/showcase/`, wherever it is installed. */
export const pluginRoot: string = resolve(dirname(import.meta.filename), "..", "..");

/** The git top level containing `cwd`, or `null` outside a repo. */
export function repoRoot(cwd: string = process.cwd()): string | null {
  try {
    return (
      execFileSync("git", ["rev-parse", "--show-toplevel"], {
        cwd,
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString()
        .trim() || null
    );
  } catch {
    return null;
  }
}
