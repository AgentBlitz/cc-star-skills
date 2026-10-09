/**
 * `showcase brief [--check]` (PLAN §2.2, §2.7 P5): writes `showcase/BRIEF.md` for
 * `/planning:roadmap`. The first run copies `templates/BRIEF.md`; every run refreshes the tours
 * and app blocks from the repo's files and keeps everything else as written.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { applyBlocks, briefState, templateFile } from "../lib/brief.ts";
import { repoRoot } from "../lib/paths.ts";
import type { Command } from "./types.ts";

export const brief: Command = {
  name: "brief",
  summary: "Write showcase/BRIEF.md from the current state, for /planning:roadmap",
  usage: [
    "Usage: showcase brief [--check] [--json]",
    "  Writes showcase/BRIEF.md: the template on first run, then the tours and app blocks refreshed",
    "  from the tours, storyboards, voice, renders and config. Your own sections are kept.",
    "  --check   change nothing; exit 1 if the brief is missing or its blocks are out of date",
  ].join("\n"),
  options: { check: { type: "boolean" } },
  async run({ values, log }) {
    const root = repoRoot() ?? process.cwd();
    const showcaseDir = join(root, "showcase");
    if (!existsSync(showcaseDir)) {
      log.warn("showcase brief: there's no showcase/ here yet: run `showcase init` first");
      return 1;
    }
    const file = join(showcaseDir, "BRIEF.md");
    const had = existsSync(file);
    const before = had ? readFileSync(file, "utf8") : readFileSync(templateFile(), "utf8");
    const state = briefState(root);
    const { text, missing } = applyBlocks(before, state.blocks);
    const changed = !had || text !== before;
    const result = {
      file,
      changed,
      created: !had,
      tours: state.tours.map((t) => ({ id: t.id, ok: t.ok })),
      configProblems: state.configProblems,
      missingBlocks: missing,
    };
    const notes = [
      ...(missing.length ? [`kept as written: no ${missing.map((m) => `'${m}'`).join(" or ")} markers in the brief`] : []),
      ...(state.configProblems.length ? ["showcase/config.json has problems: see the brief's app section"] : []),
    ];
    if (values.check) {
      log.result({ ...result, check: true }, () => [changed ? `${file} is ${had ? "out of date" : "missing"}: run \`showcase brief\`` : `${file} is current`, ...notes]);
      return changed ? 1 : 0;
    }
    if (changed) writeFileSync(file, text);
    log.result(result, () => [`${!had ? "created" : changed ? "updated" : "unchanged"} ${file} (${state.tours.length} tour${state.tours.length === 1 ? "" : "s"})`, ...notes]);
    return 0;
  },
};
