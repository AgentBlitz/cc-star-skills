/**
 * `showcase init`: scaffolds `showcase/` in the repo (PLAN §2.10). Idempotent: a second run
 * changes nothing. It never overwrites config.json; the schema copies are kept current.
 */
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pluginRoot, repoRoot } from "../lib/paths.ts";
import type { Command } from "./types.ts";

export const IGNORE_LINES = ["showcase/out/", "showcase/.cache/", "showcase/.auth/"];
const SCHEMAS = ["tour.schema.json", "config.schema.json"];

type Change = { path: string; did: "created" | "updated" | "unchanged" };

export const init: Command = {
  name: "init",
  summary: "Scaffold showcase/ in this repo (config, schemas, tours, ignore lines)",
  usage: [
    "Usage: showcase init [--json]",
    "  Writes showcase/config.json (if missing), showcase/.schema/, showcase/tours/ and the",
    "  .gitignore lines for showcase/out/, .cache/ and .auth/ at the repo root. Idempotent.",
  ].join("\n"),
  async run({ log }) {
    const root = repoRoot() ?? process.cwd();
    const dir = join(root, "showcase");
    const changes: Change[] = [];
    const rel = (p: string) => p.slice(root.length + 1);

    for (const sub of ["", "tours", ".schema"]) {
      const p = join(dir, sub);
      if (!existsSync(p)) {
        mkdirSync(p, { recursive: true });
        if (sub) changes.push({ path: `${rel(p)}/`, did: "created" });
      }
    }

    const config = join(dir, "config.json");
    if (existsSync(config)) changes.push({ path: rel(config), did: "unchanged" });
    else {
      copyFileSync(join(pluginRoot, "skills", "showcase", "templates", "config.json"), config);
      changes.push({ path: rel(config), did: "created" });
    }

    for (const name of SCHEMAS) {
      const src = readFileSync(join(pluginRoot, "toolkit", "schema", name), "utf8");
      const dst = join(dir, ".schema", name);
      const had = existsSync(dst);
      if (had && readFileSync(dst, "utf8") === src) changes.push({ path: rel(dst), did: "unchanged" });
      else {
        writeFileSync(dst, src);
        changes.push({ path: rel(dst), did: had ? "updated" : "created" });
      }
    }

    const ignore = join(root, ".gitignore");
    const existing = existsSync(ignore) ? readFileSync(ignore, "utf8") : "";
    const have = new Set(existing.split(/\r?\n/).map((l) => l.trim()));
    const missing = IGNORE_LINES.filter((l) => !have.has(l) && !have.has(`/${l}`));
    if (missing.length) {
      const sep = existing && !existing.endsWith("\n") ? "\n" : "";
      appendFileSync(ignore, `${sep}${existing ? "\n" : ""}# showcase: renders, caches and sign-ins\n${missing.join("\n")}\n`);
      changes.push({ path: ".gitignore", did: existing ? "updated" : "created" });
    } else changes.push({ path: ".gitignore", did: "unchanged" });

    const changed = changes.filter((c) => c.did !== "unchanged");
    log.result({ root, changed: changed.length > 0, changes }, () =>
      changed.length ? changed.map((c) => `${c.did.padEnd(7)} ${c.path}`) : `showcase/ is already set up in ${root}`,
    );
    return 0;
  },
};
