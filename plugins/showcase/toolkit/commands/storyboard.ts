/** `showcase storyboard <tour>`: writes `showcase/storyboard/<id>.md` from the tour (PLAN §2.2). */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadTour, renderStoryboard, resolveTour, storyboardFile } from "../lib/tours.ts";
import { type Command, UsageError } from "./types.ts";

export const storyboard: Command = {
  name: "storyboard",
  summary: "Generate showcase/storyboard/<tour>.md from a tour",
  usage: [
    "Usage: showcase storyboard <tour> [--out <file>] [--json]",
    "  Writes showcase/storyboard/<id>.md (or --out), deterministically. `check` fails while it's stale.",
  ].join("\n"),
  options: { out: { type: "string" } },
  allowPositionals: true,
  async run({ positionals, values, log }) {
    if (positionals.length !== 1) throw new UsageError("name one tour");
    const loaded = loadTour(resolveTour(positionals[0] as string));
    if (!loaded.tour) {
      log.warn(`showcase storyboard: the tour doesn't match the schema; run \`showcase check ${positionals[0]}\``);
      return 1;
    }
    const out = typeof values.out === "string" ? resolve(values.out) : loaded.showcaseDir ? storyboardFile(loaded.showcaseDir, loaded.tour.id) : null;
    if (!out) throw new UsageError("the tour isn't under showcase/tours/; give --out <file>");
    const text = renderStoryboard(loaded.tour);
    const changed = !existsSync(out) || readFileSync(out, "utf8") !== text;
    if (changed) {
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, text);
    }
    log.result({ tour: loaded.tour.id, file: out, changed }, () => `${changed ? "wrote" : "unchanged"} ${out}`);
    return 0;
  },
};
