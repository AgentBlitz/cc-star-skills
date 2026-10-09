/**
 * `showcase storyboard <tour> [--stills] [--html]` (PLAN §2.2): writes `showcase/storyboard/<id>.md`
 * from the tour, deterministically. `--stills` rehearses the tour for a still per beat, and
 * `--html` writes `out/<id>/storyboard.html` with those stills: what the storyboard round shows.
 * The markdown never depends on the stills, so it stays the same bytes for the same tour.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { loadValidTour, outDir, projectOf } from "../host/project.ts";
import { REHEARSE_SPEED, rehearse, type RehearseReport, reportLines } from "../host/rehearse.ts";
import { loadTour, renderStoryboard, renderStoryboardHtml, resolveTour, storyboardFile } from "../lib/tours.ts";
import { APP_OPTIONS, APP_USAGE, speedOf } from "./rehearse.ts";
import { type Command, UsageError } from "./types.ts";

export const storyboard: Command = {
  name: "storyboard",
  summary: "Generate showcase/storyboard/<tour>.md from a tour; --stills, --html for the review page",
  usage: [
    "Usage: showcase storyboard <tour> [--out <file>] [--stills] [--html] [--json]",
    "  Writes showcase/storyboard/<id>.md (or --out), deterministically. `check` fails while it's stale.",
    "  --stills       rehearse the tour first, for a still per beat (see `showcase rehearse`)",
    "  --html         write showcase/out/<id>/storyboard.html with the latest stills",
    "  --out-dir <d>  where the stills and the page go (default showcase/out/<id>/)",
    "  --speed <×>    the rehearsal's speed (default 10)",
    ...APP_USAGE,
  ].join("\n"),
  options: { out: { type: "string" }, "out-dir": { type: "string" }, stills: { type: "boolean" }, html: { type: "boolean" }, speed: { type: "string" }, ...APP_OPTIONS },
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
    const result: Record<string, unknown> = { tour: loaded.tour.id, file: out, changed };
    const lines = [`${changed ? "wrote" : "unchanged"} ${out}`];
    let code = 0;
    if (values.stills || values.html) {
      const { tf, tour } = loadValidTour(positionals[0] as string);
      const project = projectOf(tf);
      const dir = outDir(project, tour.id, typeof values["out-dir"] === "string" ? values["out-dir"] : undefined);
      let report: RehearseReport | null = null;
      if (values.stills) {
        report = await rehearse({
          project,
          tour,
          out: dir,
          speed: speedOf(values.speed, REHEARSE_SPEED),
          ...(typeof values.base === "string" ? { url: values.base } : {}),
          ...(values.build ? { build: true } : {}),
          ...(values["no-reset"] ? { reset: false } : {}),
          say: (line) => log.info(line),
        });
        result.rehearse = { ok: report.ok, beats: report.beats.length, problems: report.problems };
        lines.push(...reportLines(report));
        if (!report.ok) code = 1;
      } else {
        const file = join(dir, "rehearse.json");
        report = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as RehearseReport) : null;
      }
      if (values.html) {
        const page = join(dir, "storyboard.html");
        const stills = Object.fromEntries((report?.beats ?? []).filter((b) => existsSync(join(dir, b.still))).map((b) => [b.beat, relative(dir, join(dir, b.still))]));
        const note = report ? `Stills from the rehearsal of ${report.at}${report.ok ? "" : " (it had problems: see rehearse.json)"}.` : "No rehearsal yet.";
        writeFileSync(page, renderStoryboardHtml(tour, stills, note));
        result.html = page;
        lines.push(`wrote ${page} (${Object.keys(stills).length} stills)`);
      }
    }
    log.result(result, () => lines);
    return code;
  },
};
