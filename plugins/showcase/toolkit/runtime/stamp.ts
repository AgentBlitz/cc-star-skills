/**
 * The runtime's source stamp (C4, D16): a hash of everything the bundle is built from, written
 * to `dist/STAMP` by the build and checked by a test, so a stale `dist/` can't be committed.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

export const RUNTIME_DIR = resolve(import.meta.dirname);
export const SRC_DIR = join(RUNTIME_DIR, "src");
export const DIST_DIR = join(RUNTIME_DIR, "dist");
export const STAMP_FILE = join(DIST_DIR, "STAMP");

/** The schema the runtime bundles, outside `src/`. */
const EXTRA = [join(RUNTIME_DIR, "..", "schema", "tour.schema.json"), join(RUNTIME_DIR, "build.ts")];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir).sort()) {
    const file = join(dir, name);
    if (statSync(file).isDirectory()) walk(file, out);
    else if (name.endsWith(".ts") || name.endsWith(".json")) out.push(file);
  }
  return out;
}

/** The files the stamp covers, relative to the runtime dir, sorted. */
export function stampedFiles(): string[] {
  return [...walk(SRC_DIR), ...EXTRA].map((f) => relative(RUNTIME_DIR, f)).sort();
}

export function computeStamp(): string {
  const h = createHash("sha256");
  for (const rel of stampedFiles()) {
    h.update(`${rel}\n`);
    h.update(readFileSync(join(RUNTIME_DIR, rel)));
    h.update("\n");
  }
  return h.digest("hex");
}

export function readStamp(): string | null {
  return existsSync(STAMP_FILE) ? readFileSync(STAMP_FILE, "utf8").trim() : null;
}
