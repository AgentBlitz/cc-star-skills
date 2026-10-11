/** The runtime bundle (C4, D16): fresh, self-contained, and loadable without a DOM. */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { computeStamp, DIST_DIR, readStamp, SRC_DIR, stampedFiles } from "../../runtime/stamp.ts";

const pluginVersion = (JSON.parse(readFileSync(join(SRC_DIR, "..", "..", "..", ".claude-plugin", "plugin.json"), "utf8")) as { version: string }).version;

test("dist/ holds the IIFE, the ESM, the types and the stamp", () => {
  for (const f of ["showcase-runtime.iife.js", "showcase-capture.iife.js", "showcase-runtime.mjs", "showcase-runtime.d.ts", "STAMP", join("types", "index.d.ts")]) {
    assert.ok(existsSync(join(DIST_DIR, f)), f);
  }
});

test("the bundle stamp is fresh: dist/ was built from this src/", () => {
  assert.equal(readStamp(), computeStamp(), "dist/STAMP is stale: run `npm run build:runtime`");
  assert.ok(stampedFiles().includes("src/director.ts"));
  assert.ok(stampedFiles().includes("../schema/tour.schema.json"));
});

test("the runtime imports nothing from Node or any framework", () => {
  const files = readdirSync(SRC_DIR).filter((f) => f.endsWith(".ts"));
  assert.ok(files.length > 10);
  for (const f of files) {
    const src = readFileSync(join(SRC_DIR, f), "utf8");
    for (const m of src.matchAll(/^(?:import|export)[^'"]*?from\s+["']([^"']+)["']/gm)) {
      const spec = m[1] ?? "";
      assert.ok(spec.startsWith("./") || spec === "../../schema/tour.schema.json", `${f} imports '${spec}'`);
    }
    assert.doesNotMatch(src, /from\s+["']node:/, f);
    assert.doesNotMatch(src, /\brequire\(/, f);
    assert.doesNotMatch(src, /\bprocess\.env\b/, f);
  }
  const iife = readFileSync(join(DIST_DIR, "showcase-runtime.iife.js"), "utf8");
  assert.doesNotMatch(iife, /\brequire\(["']/);
  assert.doesNotMatch(iife, /from\s*["']node:/);
  assert.doesNotMatch(iife, /\breact\b/i);
});

test("the ESM loads in Node without a DOM, and carries the plugin's version", async () => {
  const mod = (await import(pathToFileURL(join(DIST_DIR, "showcase-runtime.mjs")).href)) as Record<string, unknown>;
  assert.equal(typeof mod.Director, "function");
  assert.equal(typeof mod.filmOrderProblems, "function");
  assert.equal(typeof mod.boot, "function");
  assert.equal(mod.RUNTIME_VERSION, pluginVersion);
  const iife = readFileSync(join(DIST_DIR, "showcase-runtime.iife.js"), "utf8");
  assert.ok(iife.includes(JSON.stringify(pluginVersion)));
});
