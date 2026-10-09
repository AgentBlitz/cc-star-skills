/**
 * `npm run build:runtime` (D16): esbuild bundles `src/inject.ts` into the IIFE the host injects
 * and `src/index.ts` into the ESM file vendored in-app, `tsc` emits the declarations, and the
 * source stamp is written beside them. `dist/` is committed; a test fails when it is stale.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";
import { computeStamp, DIST_DIR, RUNTIME_DIR, SRC_DIR, STAMP_FILE } from "./stamp.ts";

const version = (JSON.parse(readFileSync(join(RUNTIME_DIR, "..", "..", ".claude-plugin", "plugin.json"), "utf8")) as { version: string }).version;

mkdirSync(DIST_DIR, { recursive: true });
const common = {
  bundle: true,
  platform: "browser" as const,
  target: ["es2022"],
  charset: "utf8" as const,
  legalComments: "none" as const,
  define: { __SHOWCASE_VERSION__: JSON.stringify(version) },
  logLevel: "warning" as const,
};
await build({ ...common, entryPoints: [join(SRC_DIR, "inject.ts")], format: "iife", outfile: join(DIST_DIR, "showcase-runtime.iife.js") });
await build({ ...common, entryPoints: [join(SRC_DIR, "index.ts")], format: "esm", outfile: join(DIST_DIR, "showcase-runtime.mjs") });

rmSync(join(DIST_DIR, "types"), { recursive: true, force: true });
execFileSync(process.execPath, [join(RUNTIME_DIR, "..", "..", "node_modules", "typescript", "bin", "tsc"), "-p", join(RUNTIME_DIR, "tsconfig.dts.json")], { stdio: "inherit" });
writeFileSync(join(DIST_DIR, "showcase-runtime.d.ts"), '/** The showcase runtime\'s types: what `showcase-runtime.mjs` exports. */\nexport * from "./types/index.js";\n');
writeFileSync(STAMP_FILE, `${computeStamp()}\n`);
process.stdout.write(`built runtime ${version} → ${DIST_DIR}\n`);
