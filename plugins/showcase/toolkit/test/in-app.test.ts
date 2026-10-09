/**
 * The in-app path's Node side (PLAN §5 Session 10): the deep link, the router hop, what synthetic
 * input can't do, and `showcase runtime vendor` (stamped, idempotent, the tours published and
 * `voice.dir` moved, and the vendored types compiling under the strictest flags).
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { test } from "node:test";
import { publishedTourProblem } from "../lib/vendor.ts";
import { deepLink, readDeepLink, routeTo, servedPaths, syntheticGaps, wantsShowcase, withoutShowcaseParams } from "../runtime/src/in-app.ts";
import type { Tour } from "../runtime/src/schema.ts";
import { cli, scratch } from "./helpers.ts";

const FIXTURES = resolve(import.meta.dirname, "..", "fixtures");
const TSC = resolve(import.meta.dirname, "..", "..", "node_modules", "typescript", "bin", "tsc");

test("the deep link: namespaced parameters, read, written and taken off the URL", () => {
  assert.deepEqual(readDeepLink("?showcase=find-a-decision&showcaseStep=search&showcaseMode=film"), { tour: "find-a-decision", step: "search", mode: "film" });
  assert.deepEqual(readDeepLink("?tour=x&showcase=a"), { tour: "a", step: null, mode: "watch" });
  assert.equal(readDeepLink("?tour=a"), null);
  assert.equal(readDeepLink("?showcase=../etc"), null);
  assert.equal(deepLink("/search?q=1", { tour: "t", step: "s", mode: "film" }), "/search?q=1&showcase=t&showcaseStep=s&showcaseMode=film");
  assert.equal(deepLink("/", { tour: "t" }), "/?showcase=t");
  assert.equal(withoutShowcaseParams("?q=1&showcase=t&showcaseMode=film"), "?q=1");
  assert.equal(withoutShowcaseParams("?showcase=t"), "");
  const storage = (v: string | null) => ({ getItem: () => v });
  assert.equal(wantsShowcase({ location: { search: "" }, sessionStorage: storage(null) }), false);
  assert.equal(wantsShowcase({ location: { search: "" }, sessionStorage: storage("{}") }), true);
  assert.equal(wantsShowcase({ location: { search: "?showcase=t" }, sessionStorage: storage(null) }), true);
  const p = servedPaths("/showcase/", "t");
  assert.equal(p.tour, "/showcase/tours/t.json");
  assert.deepEqual(p.manifests, ["/showcase/voice/t.manifest.json", "/showcase/voice/manifest.json"]);
  assert.equal(p.clip("a b.mp3"), "/showcase/voice/a%20b.mp3");
  assert.equal(p.asset("dir/x.txt"), "/showcase/assets/dir/x.txt");
});

test("the router hop pushes again until the URL is the one asked for, and gives up after its timeout", async () => {
  let now = 0;
  let pushes = 0;
  let at = false;
  await routeTo("/b", {
    push: () => {
      pushes += 1;
      // An app's own soft refresh undoes the first push; the second lands.
      if (pushes === 2) at = true;
    },
    at: () => at,
    now: () => now,
    sleep: async (ms) => {
      now += ms;
    },
  });
  assert.equal(pushes, 2);
  now = 0;
  await assert.rejects(routeTo("/c", { push: () => {}, at: () => false, now: () => now, sleep: async (ms) => void (now += ms) }), /never reached \/c/);
});

test("synthetic gaps: trusted-only actions and Tab can't run in-app; hover, keys, uploads and drags are to check", () => {
  const tour = {
    showcase: 1,
    id: "gaps",
    title: "gaps",
    meta: { kind: "walkthrough", audience: "team", afterwards: "try", language: "en-GB", length: { targetSec: 30 } },
    steps: [
      {
        id: "s",
        beats: [
          {
            id: "b",
            narration: ["One."],
            actions: [
              { id: "c", kind: "click", target: { css: "button" } },
              { id: "t", kind: "click", target: { css: "button" }, input: "trusted" },
              { id: "h", kind: "hover", target: { css: "button" } },
              { id: "tab", kind: "key", key: "Tab" },
              { id: "esc", kind: "key", key: "Escape" },
              { id: "up", kind: "upload", target: { css: "input" }, files: ["a.txt"] },
              { id: "sc", kind: "scroll", by: { y: 200 } },
              { id: "sc2", kind: "scroll", to: "bottom" },
            ],
          },
        ],
      },
    ],
  } as unknown as Tour;
  const gaps = syntheticGaps(tour);
  assert.deepEqual(
    gaps.map((g) => `${g.action}:${g.level}`),
    ["t:cannot", "h:check", "tab:cannot", "esc:check", "up:check", "sc:check"],
  );
});

/** Every file under `dir`, with a hash of its bytes. */
function tree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    for (const name of readdirSync(d).sort()) {
      if (name === ".git") continue;
      const f = join(d, name);
      if (statSync(f).isDirectory()) walk(f);
      else out[relative(dir, f)] = createHash("sha256").update(readFileSync(f)).digest("hex");
    }
  };
  walk(dir);
  return out;
}

/** A scratch git repo holding a copy of the fixture's `showcase/` project. */
function scratchRepo(extra: (root: string) => void = () => {}): string {
  const root = realpathSync(scratch("showcase-vendor-"));
  execFileSync("git", ["init", "-q"], { cwd: root });
  cpSync(join(FIXTURES, "showcase"), join(root, "showcase"), { recursive: true });
  extra(root);
  return root;
}

const env = () => ({ HOME: process.env.HOME ?? "" });

test("runtime vendor for Next: stamped runtime and types, the adapter, tours published, voice.dir moved with its clips; twice gives no diff", async () => {
  const root = scratchRepo((r) => mkdirSync(join(r, "src")));
  const first = await cli(["runtime", "vendor", "--framework", "next", "--json"], { cwd: root, env: env() });
  assert.equal(first.code, 0, first.stderr);
  const r = JSON.parse(first.stdout) as { changed: boolean; to: string; tours: string[]; version: string; voiceDir: string };
  assert.equal(r.changed, true);
  assert.equal(r.to, join(root, "src", "showcase"));
  assert.deepEqual(r.tours, ["fixture-tour", "sync-tour"]);
  const mjs = readFileSync(join(root, "src", "showcase", "runtime", "showcase-runtime.mjs"), "utf8");
  assert.match(mjs.split("\n")[0] ?? "", new RegExp(`^/\\* showcase runtime ${r.version.replace(/\./g, "\\.")} \\(source [0-9a-f]{12}\\)`));
  assert.ok(existsSync(join(root, "src", "showcase", "runtime", "showcase-runtime.d.mts")));
  assert.ok(existsSync(join(root, "src", "showcase", "runtime", "types", "in-app.d.ts")));
  const tsx = readFileSync(join(root, "src", "showcase", "ShowcaseTour.tsx"), "utf8");
  assert.match(tsx, /^"use client";/);
  assert.match(tsx, /from "next\/navigation"/);
  assert.match(tsx, /import\("\.\/runtime\/showcase-runtime\.mjs"\)/);
  assert.doesNotMatch(tsx, /\{\{/);
  assert.ok(existsSync(join(root, "src", "showcase", "showcase-adapter.ts")));
  assert.deepEqual(readFileSync(join(root, "public", "showcase", "tours", "fixture-tour.json")), readFileSync(join(root, "showcase", "tours", "fixture-tour.json")));
  const config = JSON.parse(readFileSync(join(root, "showcase", "config.json"), "utf8")) as { voice: { dir: string } };
  assert.equal(config.voice.dir, "public/showcase/voice");
  assert.ok(existsSync(join(root, "public", "showcase", "voice", "manifest.json")), "the clips already voiced move with voice.dir");
  assert.equal(publishedTourProblem(root, config.voice.dir, join(root, "showcase", "tours", "fixture-tour.json"), "fixture-tour"), null);

  // The app's own adapter file is kept; everything else is rewritten only if it changed.
  writeFileSync(join(root, "src", "showcase", "showcase-adapter.ts"), "export const adapter = {};\n");
  const before = tree(root);
  const second = await cli(["runtime", "vendor", "--framework", "next", "--json"], { cwd: root, env: env() });
  assert.equal(second.code, 0, second.stderr);
  assert.equal((JSON.parse(second.stdout) as { changed: boolean }).changed, false);
  assert.deepEqual(tree(root), before, "vendoring twice gives no diff");

  // An edited tour is stale in the app until it's vendored again.
  const tourFile = join(root, "showcase", "tours", "fixture-tour.json");
  writeFileSync(tourFile, readFileSync(tourFile, "utf8").replace("Ledgerly", "Ledgerly "));
  assert.match(publishedTourProblem(root, config.voice.dir, tourFile, "fixture-tour") ?? "", /older copy/);
});

test("runtime vendor for React and HTML: the navigate prop, and the module snippet with the runtime's URL", async () => {
  const root = scratchRepo((r) => mkdirSync(join(r, "site")));
  const react = await cli(["runtime", "vendor", "--framework", "react", "--to", "web/tour", "--json"], { cwd: root, env: env() });
  assert.equal(react.code, 0, react.stderr);
  const tsx = readFileSync(join(root, "web", "tour", "ShowcaseTour.tsx"), "utf8");
  assert.match(tsx, /navigate\?: \(url: string\) => void \| Promise<void>/);
  assert.doesNotMatch(tsx, /next\//);

  const html = await cli(["runtime", "vendor", "--framework", "html", "--public", "site", "--json"], { cwd: root, env: env() });
  assert.equal(html.code, 0, html.stderr);
  const r = JSON.parse(html.stdout) as { snippet: string; to: string };
  assert.equal(r.to, join(root, "site", "showcase"));
  assert.match(r.snippet, /<script type="module">/);
  assert.match(r.snippet, /import\("\/showcase\/runtime\/showcase-runtime\.mjs"\)/);
  assert.ok(existsSync(join(root, "site", "showcase", "runtime", "snippet.html")));
  const before = tree(root);
  const again = await cli(["runtime", "vendor", "--framework", "html", "--public", "site"], { cwd: root, env: env() });
  assert.equal(again.code, 0, again.stderr);
  assert.match(again.stdout, /nothing changed/);
  assert.deepEqual(tree(root), before);

  const bad = await cli(["runtime", "vendor", "--framework", "vue"], { cwd: root, env: env() });
  assert.equal(bad.code, 2);
});

test("the vendored runtime's types compile under strict, exactOptionalPropertyTypes and noUncheckedIndexedAccess, with skipLibCheck off", async () => {
  const root = scratchRepo();
  const v = await cli(["runtime", "vendor", "--framework", "html", "--to", "public/showcase"], { cwd: root, env: env() });
  assert.equal(v.code, 0, v.stderr);
  writeFileSync(
    join(root, "public", "showcase", "use.ts"),
    [
      'import { startInApp, type Adapter, syntheticGaps, readDeepLink } from "./runtime/showcase-runtime.mjs";',
      "const adapter: Adapter = { base: \"/showcase\", navigate: (url: string) => { history.pushState(null, \"\", url); }, actions: { ping: () => 1 } };",
      "void startInApp(adapter).then((api) => api?.snapshot()?.status);",
      "export const link = readDeepLink(location.search)?.tour;",
      "export { syntheticGaps };",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "esnext",
        moduleResolution: "bundler",
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        types: [],
        strict: true,
        exactOptionalPropertyTypes: true,
        noUncheckedIndexedAccess: true,
        skipLibCheck: false,
        noEmit: true,
      },
      include: ["public/showcase/**/*.ts", "public/showcase/**/*.mts"],
    }),
  );
  try {
    execFileSync(process.execPath, [TSC, "-p", root], { encoding: "utf8", stdio: "pipe" });
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string };
    assert.fail(`tsc failed:\n${err.stdout ?? ""}${err.stderr ?? ""}`);
  }
});
