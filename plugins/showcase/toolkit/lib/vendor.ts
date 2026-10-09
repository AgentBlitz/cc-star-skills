/**
 * `showcase runtime vendor` (PLAN §2.6): ships the runtime inside the app.
 *
 * - **Copies** the built ESM runtime and its declarations into `<to>/runtime/`, stamped with the
 *   plugin's version and the source stamp. They're never edited by hand: vendoring again
 *   replaces them.
 * - **Writes the adapter:** Next, a client component `ShowcaseTour.tsx` on `next/navigation`
 *   (plus `showcase-adapter.ts`, the app's own part, written once and never overwritten); React,
 *   a `ShowcaseTour.tsx` that takes a `navigate` prop; HTML, a `<script type="module">` snippet.
 * - **Publishes the tours** to `<public>/showcase/tours/`, and points `voice.dir` at
 *   `<public>/showcase/voice/` (copying any clips already voiced), so the app serves both at
 *   `/showcase/…`.
 *
 * It's idempotent: a file whose content is already right is left alone, so a second run
 * changes nothing.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { configProblems } from "./config.ts";
import { pluginRoot } from "./paths.ts";
import { loadTour } from "./tours.ts";

export const FRAMEWORKS = ["next", "react", "html"] as const;
export type Framework = (typeof FRAMEWORKS)[number];

const RUNTIME = join(pluginRoot, "toolkit", "runtime");
const DIST = join(RUNTIME, "dist");
const ADAPTERS = join(RUNTIME, "adapters");
/** The URL path the app serves the tours, voice and assets under. */
export const SERVED_BASE = "/showcase";

export type Did = "created" | "updated" | "unchanged" | "kept" | "removed";
export interface Change {
  path: string;
  did: Did;
}

export interface VendorOptions {
  /** The repo root (where `showcase/` is). */
  root: string;
  framework: Framework;
  /** Where the runtime and adapter go (default: `src/showcase`, else `components/showcase`; HTML: `<public>/showcase`). */
  to?: string;
  /** The app's static root (default `public`; for HTML, `public` if it exists, else the root). */
  publicDir?: string;
}

export interface VendorResult {
  version: string;
  stamp: string;
  framework: Framework;
  to: string;
  publicDir: string;
  voiceDir: string;
  tours: string[];
  changes: Change[];
  /** HTML: the snippet for each page's `<head>`. */
  snippet: string | null;
}

export function pluginVersion(): string {
  return (JSON.parse(readFileSync(join(pluginRoot, ".claude-plugin", "plugin.json"), "utf8")) as { version: string }).version;
}

function posix(p: string): string {
  return p.split(sep).join("/");
}

/** Writes `content` unless the file already holds it. */
function put(changes: Change[], root: string, file: string, content: string | Buffer): void {
  const had = existsSync(file);
  if (had) {
    const now = readFileSync(file);
    if (Buffer.isBuffer(content) ? now.equals(content) : now.toString("utf8") === content) {
      changes.push({ path: posix(relative(root, file)), did: "unchanged" });
      return;
    }
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  changes.push({ path: posix(relative(root, file)), did: had ? "updated" : "created" });
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (m, k: string) => vars[k] ?? m);
}

/** Copies a directory's files over, removing what the source no longer has. */
function sync(changes: Change[], root: string, from: string, to: string): void {
  const want = new Set<string>();
  for (const name of readdirSync(from).sort()) {
    const src = join(from, name);
    if (statSync(src).isDirectory()) {
      sync(changes, root, src, join(to, name));
      want.add(name);
      continue;
    }
    want.add(name);
    put(changes, root, join(to, name), readFileSync(src));
  }
  if (!existsSync(to)) return;
  for (const name of readdirSync(to).sort()) {
    if (want.has(name)) continue;
    rmSync(join(to, name), { recursive: true, force: true });
    changes.push({ path: posix(relative(root, join(to, name))), did: "removed" });
  }
}

/** Points `voice.dir` at the published voice folder, keeping the file's own layout otherwise. */
function setVoiceDir(changes: Change[], root: string, showcaseDir: string, voiceRel: string): string | null {
  const file = join(showcaseDir, "config.json");
  if (!existsSync(file)) throw new Error(`no ${posix(relative(root, file))}: run \`showcase init\` first`);
  const raw = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown> & { voice?: { dir?: string } };
  const before = raw.voice?.dir ?? "showcase/voice";
  if (before === voiceRel) {
    changes.push({ path: posix(relative(root, file)), did: "unchanged" });
    return null;
  }
  raw.voice = { ...raw.voice, dir: voiceRel };
  const problems = configProblems(raw);
  if (problems.length) throw new Error(`${file}: ${problems.join("; ")}`);
  writeFileSync(file, `${JSON.stringify(raw, null, 2)}\n`);
  changes.push({ path: posix(relative(root, file)), did: "updated" });
  return before;
}

export function vendor(o: VendorOptions): VendorResult {
  const root = resolve(o.root);
  const showcaseDir = join(root, "showcase");
  const mjs = join(DIST, "showcase-runtime.mjs");
  if (!existsSync(mjs)) throw new Error(`no runtime bundle at ${mjs}: run npm run build:runtime`);
  const version = pluginVersion();
  const stamp = readFileSync(join(DIST, "STAMP"), "utf8").trim();
  const changes: Change[] = [];

  const publicDir = o.publicDir !== undefined ? resolve(root, o.publicDir) : o.framework === "html" && !existsSync(join(root, "public")) ? root : join(root, "public");
  const to = o.to !== undefined ? resolve(root, o.to) : o.framework === "html" ? join(publicDir, "showcase") : existsSync(join(root, "src")) ? join(root, "src", "showcase") : join(root, "components", "showcase");
  for (const [flag, dir] of [["--to", to], ["--public", publicDir]] as const) {
    if (dir !== root && !dir.startsWith(root + sep)) throw new Error(`${flag} must be inside the repo: ${dir}`);
  }

  // 1. The runtime, stamped.
  const header = `/* showcase runtime ${version} (source ${stamp.slice(0, 12)}): vendored by \`showcase runtime vendor\`. Don't edit; vendor again. */\n`;
  const runtimeDir = join(to, "runtime");
  put(changes, root, join(runtimeDir, "showcase-runtime.mjs"), header + readFileSync(mjs, "utf8"));
  // `.d.mts`: TypeScript reads a `.mjs` file's types from it (a `.d.ts` beside an `.mjs` is ignored).
  put(changes, root, join(runtimeDir, "showcase-runtime.d.mts"), `${header}export * from "./types/index.js";\n`);
  sync(changes, root, join(DIST, "types"), join(runtimeDir, "types"));

  // 2. The adapter.
  let snippet: string | null = null;
  const vars = { version, base: SERVED_BASE };
  if (o.framework === "next") {
    put(changes, root, join(to, "ShowcaseTour.tsx"), fill(readFileSync(join(ADAPTERS, "next", "ShowcaseTour.tsx"), "utf8"), vars));
    const own = join(to, "showcase-adapter.ts");
    if (existsSync(own)) changes.push({ path: posix(relative(root, own)), did: "kept" });
    else put(changes, root, own, readFileSync(join(ADAPTERS, "next", "showcase-adapter.ts"), "utf8"));
  } else if (o.framework === "react") {
    put(changes, root, join(to, "ShowcaseTour.tsx"), fill(readFileSync(join(ADAPTERS, "react", "ShowcaseTour.tsx"), "utf8"), vars));
  } else {
    const rel = posix(relative(publicDir, join(runtimeDir, "showcase-runtime.mjs")));
    if (rel.startsWith("..")) throw new Error(`for HTML, --to must be inside the static root (${publicDir}) so the page can load the runtime`);
    snippet = fill(readFileSync(join(ADAPTERS, "html", "snippet.html"), "utf8"), { ...vars, runtimeUrl: `/${rel}` });
    put(changes, root, join(runtimeDir, "snippet.html"), snippet);
  }

  // 3. The tours, published where the runtime fetches them.
  const tours: string[] = [];
  const toursDir = join(showcaseDir, "tours");
  const served = join(publicDir, "showcase");
  if (existsSync(toursDir)) {
    for (const name of readdirSync(toursDir).sort()) {
      if (!name.endsWith(".json")) continue;
      const file = join(toursDir, name);
      const loaded = loadTour({ file, showcaseDir });
      if (!loaded.tour) throw new Error(`${posix(relative(root, file))} doesn't match the schema: run \`showcase check ${name}\``);
      tours.push(loaded.tour.id);
      put(changes, root, join(served, "tours", `${loaded.tour.id}.json`), readFileSync(file));
    }
  }

  // 4. The voice folder, served beside them.
  const voiceDir = join(served, "voice");
  const voiceRel = posix(relative(root, voiceDir));
  const before = setVoiceDir(changes, root, showcaseDir, voiceRel);
  if (before !== null) {
    const old = resolve(root, before);
    if (existsSync(old) && !existsSync(voiceDir)) {
      for (const name of readdirSync(old).sort()) {
        const src = join(old, name);
        if (!statSync(src).isFile()) continue;
        mkdirSync(voiceDir, { recursive: true });
        copyFileSync(src, join(voiceDir, name));
        changes.push({ path: posix(relative(root, join(voiceDir, name))), did: "created" });
      }
    }
  }
  return { version, stamp, framework: o.framework, to, publicDir, voiceDir, tours, changes, snippet };
}

/** The tour as the app serves it is the tour in `showcase/tours/` (what `film --in-app` checks). */
export function publishedTourProblem(root: string, voiceDir: string, tourFile: string, id: string): string | null {
  const published = join(dirname(resolve(root, voiceDir)), "tours", `${id}.json`);
  if (!existsSync(published)) return `the app doesn't serve the tour ${id} (no ${posix(relative(root, published))}): run \`showcase runtime vendor\``;
  if (!readFileSync(published).equals(readFileSync(tourFile))) return `the app serves an older copy of ${id} (${posix(relative(root, published))}): run \`showcase runtime vendor\` again`;
  return null;
}
