/** `showcase check <tour>`: the static gate (PLAN §2.2). No network; rule ids T001–T015. */
import { budgetFor, narrativeIssues, RULES, tourNarrationMs, tourWords } from "../runtime/src/narrative.ts";
import { beatsOf, type Issue } from "../runtime/src/schema.ts";
import { loadTour, resolveTour, storyboardFile, storyboardState } from "../lib/tours.ts";
import { type Command, UsageError } from "./types.ts";

export const check: Command = {
  name: "check",
  summary: "Check a tour: schema, budgets, captions, rules, storyboard (static)",
  usage: [
    "Usage: showcase check <tour> [--json]",
    "  <tour> is a path to a tour file, or an id under showcase/tours/.",
    "  Errors exit 1; warnings are printed and exit 0. Rules:",
    ...Object.entries(RULES).map(([id, text]) => `    ${id}  ${text}`),
  ].join("\n"),
  allowPositionals: true,
  async run({ positionals, log }) {
    if (positionals.length !== 1) throw new UsageError("name one tour");
    const loaded = loadTour(resolveTour(positionals[0] as string));
    const { tour } = loaded;
    const issues: Issue[] = [...loaded.issues];
    let storyboard = "n/a";
    let stats = null;
    if (tour) {
      issues.push(...narrativeIssues(tour));
      storyboard = storyboardState(loaded, tour);
      if (storyboard === "stale" && loaded.showcaseDir)
        issues.push({ rule: "T015", level: "error", path: "/", message: `${storyboardFile(loaded.showcaseDir, tour.id)} is stale: run \`showcase storyboard ${tour.id}\`` });
      stats = { narrationSec: Math.round(tourNarrationMs(tour)) / 1000, words: tourWords(tour), beats: beatsOf(tour).length, budget: budgetFor(tour.meta) };
    }
    const errors = issues.filter((i) => i.level === "error").length;
    const warnings = issues.length - errors;
    const id = tour?.id ?? positionals[0];
    log.result({ tour: id, file: loaded.file, ok: errors === 0, errors, warnings, storyboard, stats, issues }, () => {
      const head = stats
        ? `${id}: ${errors ? `${errors} error${errors === 1 ? "" : "s"}` : "ok"}${warnings ? `, ${warnings} warning${warnings === 1 ? "" : "s"}` : ""} · narration ${stats.narrationSec.toFixed(1)} s (${Number(stats.budget.narration.min.toFixed(1))}–${Number(stats.budget.narration.max.toFixed(1))}) · ${stats.words} words · ${stats.beats} beats · storyboard ${storyboard}`
        : `${id}: ${errors} error${errors === 1 ? "" : "s"}`;
      return [head, ...issues.map((i) => `  ${i.rule} ${i.level === "error" ? "error  " : "warning"} ${i.path}  ${i.message}`)];
    });
    return errors ? 1 : 0;
  },
};
