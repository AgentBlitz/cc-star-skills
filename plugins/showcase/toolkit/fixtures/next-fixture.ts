/**
 * The Next fixture (`fixtures/next/`, PLAN §5 Session 10), made ready on demand: its sources are
 * copied into a work dir in the cache, a git repo of its own, and its pinned dependencies are
 * installed there once per `package.json`. Nothing it installs or builds is ever in this repo.
 *
 *   node toolkit/fixtures/next-fixture.ts     prints the work dir, ready to vendor and build
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { cacheDir } from "../lib/paths.ts";

export const NEXT_FIXTURE = resolve(import.meta.dirname, "next");
/** What a work dir keeps between preparations: the install, and the repo. */
const KEEP = new Set(["node_modules", "package-lock.json", ".git"]);

/** `<cache>/fixtures/next-<hash of package.json>`. */
export function nextWorkDir(env: Record<string, string | undefined> = process.env): string {
  const hash = createHash("sha256").update(readFileSync(join(NEXT_FIXTURE, "package.json"))).digest("hex").slice(0, 12);
  return join(cacheDir(env), "fixtures", `next-${hash}`);
}

/** A fresh copy of the fixture's sources (no `.next`, nothing vendored) over a kept install. */
export function prepareNext(o: { say?: (line: string) => void } = {}): string {
  const say = o.say ?? (() => {});
  const dir = nextWorkDir();
  mkdirSync(dir, { recursive: true });
  for (const name of readdirSync(dir)) if (!KEEP.has(name)) rmSync(join(dir, name), { recursive: true, force: true });
  cpSync(NEXT_FIXTURE, dir, { recursive: true, filter: (src) => !/[/\\](node_modules|\.next|out|\.cache)([/\\]|$)/.test(src) });
  if (!existsSync(join(dir, "node_modules", "next", "package.json"))) {
    say(`installing the Next fixture's dependencies into ${dir}`);
    execFileSync("npm", ["install", "--no-audit", "--no-fund", "--ignore-scripts", "--loglevel=error"], { cwd: dir, stdio: ["ignore", "ignore", "inherit"], timeout: 300_000 });
  }
  if (!existsSync(join(dir, ".git"))) execFileSync("git", ["init", "-q"], { cwd: dir });
  return dir;
}

if (import.meta.main) process.stdout.write(`${prepareNext({ say: (l) => process.stderr.write(`${l}\n`) })}\n`);
