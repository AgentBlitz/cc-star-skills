/**
 * Finding playwright-core 1.63.0 (PLAN D10, C2). Installed plugins carry no `node_modules`, so
 * it resolves `SHOWCASE_PLAYWRIGHT_CORE`, then the plugin's own `node_modules` (dev), then the
 * cache, where `install()` puts it. Chromium comes from Playwright's browser cache.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { toolEnv } from "./child-env.ts";
import { type Env, cacheDir, pluginRoot } from "./paths.ts";

export const PW_VERSION = "1.63.0";

export type PwSource = "SHOWCASE_PLAYWRIGHT_CORE" | "plugin node_modules" | "cache";

export interface PwFound {
  dir: string;
  source: PwSource;
  version: string | null;
}

export function pwCacheDir(env: Env = process.env): string {
  return join(cacheDir(env), `pw-${PW_VERSION}`);
}

function versionOf(dir: string): string | null {
  try {
    return (JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { version?: string }).version ?? null;
  } catch {
    return null;
  }
}

export function findPlaywright(env: Env = process.env): PwFound | null {
  const candidates: [string | undefined, PwSource][] = [
    [env.SHOWCASE_PLAYWRIGHT_CORE, "SHOWCASE_PLAYWRIGHT_CORE"],
    [join(pluginRoot, "node_modules", "playwright-core"), "plugin node_modules"],
    [join(pwCacheDir(env), "node_modules", "playwright-core"), "cache"],
  ];
  for (const [dir, source] of candidates) {
    if (dir && existsSync(join(dir, "package.json"))) return { dir, source, version: versionOf(dir) };
  }
  return null;
}

/** The Chromium build this playwright-core expects, from its `browsers.json`. */
export function chromiumRevision(pw: PwFound): string | null {
  try {
    const b = JSON.parse(readFileSync(join(pw.dir, "browsers.json"), "utf8")) as {
      browsers: { name: string; revision: string }[];
    };
    return b.browsers.find((x) => x.name === "chromium")?.revision ?? null;
  } catch {
    return null;
  }
}

/** The Chromium executable path Playwright would launch, and whether it exists. */
export async function chromium(pw: PwFound): Promise<{ path: string | null; exists: boolean; revision: string | null }> {
  const revision = chromiumRevision(pw);
  try {
    const mod = (await import(pathToFileURL(join(pw.dir, "index.mjs")).href)) as {
      chromium: { executablePath(): string };
    };
    const path = mod.chromium.executablePath();
    return { path, exists: existsSync(path), revision };
  } catch {
    return { path: null, exists: false, revision };
  }
}

/** `npm install --prefix <cache>/pw-1.63.0 --ignore-scripts playwright-core@1.63.0` */
export function install(env: Env = process.env): PwFound {
  const prefix = pwCacheDir(env);
  mkdirSync(prefix, { recursive: true });
  execFileSync("npm", ["install", "--prefix", prefix, "--ignore-scripts", "--no-audit", "--no-fund", `playwright-core@${PW_VERSION}`], {
    env: toolEnv({ npm_config_cache: env.npm_config_cache }),
    stdio: ["ignore", "inherit", "inherit"],
  });
  const dir = join(prefix, "node_modules", "playwright-core");
  return { dir, source: "cache", version: versionOf(dir) };
}

/** `node <pw>/cli.js install chromium`. Callers only run this with `--yes`. */
export function installChromium(pw: PwFound): void {
  execFileSync(process.execPath, [join(pw.dir, "cli.js"), "install", "chromium"], {
    env: toolEnv({ PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH }),
    stdio: ["ignore", "inherit", "inherit"],
  });
}
