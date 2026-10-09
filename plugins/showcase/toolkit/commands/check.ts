/** `showcase check <tour>`: the static gate (PLAN §2.2). No network; rule ids T001–T015. */
import { budgetFor, narrativeIssues, RULES, tourNarrationMs, tourWords } from "../runtime/src/narrative.ts";
import { beatsOf, type Issue, sentenceText } from "../runtime/src/schema.ts";
import { loadTour, resolveTour, storyboardFile, storyboardState } from "../lib/tours.ts";
import { projectOf, voiceFor } from "../host/project.ts";
import type { VoicedMs } from "../runtime/src/narrative.ts";
import type { VoiceManifest } from "../runtime/src/protocol.ts";
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
      // Voiced sentences last their clips (C5): the window is judged on the voice once there is one.
      // A tour with no config yet (a scratch file, a template) simply has no voice.
      let manifest: VoiceManifest | null = null;
      try {
        manifest = voiceFor(projectOf(loaded), tour).manifest;
      } catch {
        // No config, or a manifest that isn't one: the reading estimate stands.
      }
      const clips = new Map((manifest?.clips ?? []).map((c) => [`${c.beat}\n${c.text}`, c.durationMs]));
      const voiced: VoicedMs = (beat, text) => clips.get(`${beat}\n${text}`);
      const sentences = beatsOf(tour).flatMap(({ beat }) => (beat.narration ?? []).map((s) => voiced(beat.id, sentenceText(s))));
      const voicedCount = sentences.filter((d) => d !== undefined).length;
      issues.push(...narrativeIssues(tour, voiced));
      storyboard = storyboardState(loaded, tour);
      if (storyboard === "stale" && loaded.showcaseDir)
        issues.push({ rule: "T015", level: "error", path: "/", message: `${storyboardFile(loaded.showcaseDir, tour.id)} is stale: run \`showcase storyboard ${tour.id}\`` });
      stats = { narrationSec: Math.round(tourNarrationMs(tour, voiced)) / 1000, voiced: voicedCount, sentences: sentences.length, words: tourWords(tour), beats: beatsOf(tour).length, budget: budgetFor(tour.meta) };
    }
    const errors = issues.filter((i) => i.level === "error").length;
    const warnings = issues.length - errors;
    const id = tour?.id ?? positionals[0];
    log.result({ tour: id, file: loaded.file, ok: errors === 0, errors, warnings, storyboard, stats, issues }, () => {
      const head = stats
        ? `${id}: ${errors ? `${errors} error${errors === 1 ? "" : "s"}` : "ok"}${warnings ? `, ${warnings} warning${warnings === 1 ? "" : "s"}` : ""} · narration ${stats.narrationSec.toFixed(1)} s${stats.voiced ? ` (${stats.voiced === stats.sentences ? "voiced" : `${stats.voiced}/${stats.sentences} voiced`})` : ""} (${Number(stats.budget.narration.min.toFixed(1))}–${Number(stats.budget.narration.max.toFixed(1))}) · ${stats.words} words · ${stats.beats} beats · storyboard ${storyboard}`
        : `${id}: ${errors} error${errors === 1 ? "" : "s"}`;
      return [head, ...issues.map((i) => `  ${i.rule} ${i.level === "error" ? "error  " : "warning"} ${i.path}  ${i.message}`)];
    });
    return errors ? 1 : 0;
  },
};
