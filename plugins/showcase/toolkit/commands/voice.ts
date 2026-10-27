/** `showcase voice <tour>`: every sentence gets narration audio (PLAN §2.4); `--audition` picks the narrator. */
import { join, resolve } from "node:path";
import { loadValidTour, projectOf, type Project } from "../host/project.ts";
import { cacheDir } from "../lib/paths.ts";
import { requireFfmpeg } from "../voice/audio.ts";
import { audition, AUDITION_MAX_CHARS } from "../voice/audition.ts";
import { fetchCatalogue, fetchRequestyCatalogue, type SpeechModel } from "../voice/catalogue.ts";
import { DEFAULT_MAX_CHARS, type Mode, type Redo, type Report, run, sentencesOf, TakeCheckFailed, VoiceRefusal } from "../voice/pipeline.ts";
import { loadSetup } from "../voice/setup.ts";
import { type Command, UsageError } from "./types.ts";

/** Where raw synthesised audio is kept (ignored by git): re-processing and re-runs reuse it. */
export function ttsCacheDir(p: Project): string {
  return p.showcaseDir ? join(p.showcaseDir, ".cache", "tts") : join(cacheDir(), "tts");
}

function maxCharsOf(v: string | boolean | undefined, fallback: number | undefined): number | undefined {
  if (v === undefined) return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new UsageError(`--max-chars must be a positive whole number, not ${String(v)}`);
  return n;
}

function redoOf(v: string | boolean | undefined, takes: boolean): Redo | undefined {
  if (v === undefined) return undefined;
  const m = /^([^/]+)\/(\d+)$/.exec(String(v));
  if (m) return { beat: m[1] as string, n: Number(m[2]) };
  if (!takes || typeof v !== "string" || v.length === 0) throw new UsageError(`--redo wants beat/n (for example open/0)${takes ? ", a step id or a take (t1)" : ""}, not ${String(v)}`);
  return { target: v };
}

export function reportLines(r: Report): string[] {
  const c = r.counts;
  const parts = [`${c.fresh} fresh`, c.draft ? `${c.draft} draft` : "", c.stale ? `${c.stale} stale` : "", c.missing ? `${c.missing} missing` : ""].filter(Boolean);
  const lines = [`${r.tour}: ${r.items.length} sentence${r.items.length === 1 ? "" : "s"} · ${parts.join(" · ")}`];
  for (const i of r.items) if (i.status === "stale" || i.status === "missing") lines.push(`  ${i.status.padEnd(7)} ${i.beat}/${i.n}  "${i.text}"`);
  if (r.takes) {
    lines.push("", "take  sentences  chars  status   check      steps");
    for (const t of r.takes)
      lines.push(
        `${t.id.padEnd(5)}${String(t.sentences).padStart(10)}${String(t.chars).padStart(7)}  ${t.status.padEnd(8)} ${(t.check ?? "—").padEnd(10)} ${t.steps.join(", ")}${t.attempts > 1 ? `  (${t.attempts} takes)` : ""}`,
      );
  }
  if (r.pacing.rows.length > 0) {
    lines.push("", "beat            #  words   sec   wpm  note");
    for (const p of r.pacing.rows)
      lines.push(`${p.beat}`.padEnd(15) + String(p.n).padStart(3) + String(p.words).padStart(7) + `${p.seconds.toFixed(1)}${p.estimated ? "~" : " "}`.padStart(6) + String(Math.round(p.wpm)).padStart(6) + (p.note ? `  ⚠ ${p.note}` : ""));
    lines.push("", `narration ${r.pacing.narrationSec.toFixed(1)} s${r.pacing.rows.some((p) => p.estimated) ? " (~ = reading-time estimate, no clip yet)" : ""}; window ${Number(r.pacing.window.min.toFixed(1))}–${Number(r.pacing.window.max.toFixed(1))} s`);
  }
  for (const w of r.warnings) lines.push(`warning: ${w}`);
  if (r.check) lines.push(r.ok ? "every sentence is current" : `not current: run \`showcase voice ${r.tour}\``);
  else if (r.dryRun && r.takes) {
    const todo = r.takes.filter((t) => t.status === "pending");
    lines.push(`dry run: would voice ${todo.length} take${todo.length === 1 ? "" : "s"} (${todo.reduce((n, t) => n + t.sentences, 0)} sentences, ${todo.reduce((n, t) => n + t.chars, 0)} characters) of ${r.takes.length}`);
  } else if (r.dryRun) lines.push(`dry run: would voice ${r.counts.stale + r.counts.missing} sentence(s)`);
  else lines.push(`voiced ${r.synthesised + r.fromCache} (${r.fromCache} from the raw cache) · ${r.charsSent} characters sent${r.manifest ? ` · ${r.manifest}` : ""}${r.pruned.length ? ` · pruned ${r.pruned.length}` : ""}`);
  return lines;
}

export const voice: Command = {
  name: "voice",
  summary: "Voice a tour's narration (clips + manifest in voice.dir); --audition picks the narrator",
  usage: [
    "Usage: showcase voice <tour> [--draft | --final] [--check] [--yes] [--max-chars <n>] [--redo <beat/n|step|take>] [--prune] [--dry-run] [--audition] [--json]",
    "  Writes <voice.dir>/<id>.manifest.json and one MP3 per sentence. Re-runs redo only what is stale.",
    "  voice.takes \"tour\" reads the narration in one take, cuts it at its pauses and checks it against a",
    "  transcription (with REQUESTY_API_KEY); a take that misreads a sentence is voiced again whole.",
    "  --draft          the offline voice (macOS `say`, else a tone): free, for timing",
    "  --final          the narrator only (needs voice.narrator and its provider's key); fails on any draft clip",
    "  --check          report missing, stale, draft and fresh; no network, no key, no ffmpeg",
    `  --yes            allow the paid narrator calls (refused without it); --max-chars caps them (default ${DEFAULT_MAX_CHARS})`,
    "  --redo <beat/n>  voice that sentence again with a new take (n counts from 0); under voice.takes",
    "                   tour or step, the whole take holding it, or name a step id or a take (t1)",
    "  --prune          delete clips no manifest in the voice dir points to",
    "  --dry-run        say what would be voiced; change nothing",
    `  --audition       write showcase/out/voices/index.html: three lines per voice on the shortlist (or voice.audition), plus the draft (default budget ${AUDITION_MAX_CHARS} characters)`,
    "The pacing table warns outside 120–185 wpm and outside the preset's narration window: rewrite the text, never speed the voice up.",
  ].join("\n"),
  options: {
    draft: { type: "boolean" },
    final: { type: "boolean" },
    check: { type: "boolean" },
    yes: { type: "boolean" },
    "max-chars": { type: "string" },
    redo: { type: "string" },
    prune: { type: "boolean" },
    "dry-run": { type: "boolean" },
    audition: { type: "boolean" },
  },
  allowPositionals: true,
  async run({ positionals, values, log }) {
    if (positionals.length !== 1) throw new UsageError("name one tour");
    if (values.draft && values.final) throw new UsageError("--draft and --final exclude each other");
    if (values.audition && (values.check || values.prune || values.redo !== undefined || values.final || values.draft)) throw new UsageError("--audition stands alone (with --yes, --max-chars, --dry-run)");
    const { tf, tour } = loadValidTour(positionals[0] as string);
    const project = projectOf(tf);
    const config = project.config;
    const setup = loadSetup(config);
    const mode: Mode = values.draft ? "draft" : values.final ? "final" : "auto";
    const voiceDir = resolve(project.root, config.voice.dir);
    const cache = ttsCacheDir(project);
    try {
      if (values.audition) {
        const outDir = project.showcaseDir ? join(project.showcaseDir, "out", "voices") : resolve("showcase-out", "voices");
        const none = (): SpeechModel[] | undefined => undefined;
        const [openrouter, requesty] = await Promise.all([fetchCatalogue().catch(none), fetchRequestyCatalogue().catch(none)]);
        if (!openrouter || !requesty) log.warn(`${!openrouter ? "OpenRouter's" : "Requesty's"}${!openrouter && !requesty ? " and Requesty's catalogues" : " catalogue"} couldn't be fetched: every candidate there will be tried`);
        const catalogue = { ...(openrouter ? { openrouter } : {}), ...(requesty ? { requesty } : {}) };
        const candidates = config.voice.audition;
        const keyed = Object.keys(setup.keys).length > 0;
        const maxChars = maxCharsOf(values["max-chars"], AUDITION_MAX_CHARS) as number;
        if (values["dry-run"]) {
          log.result({ audition: true, dryRun: true, key: keyed }, () => `dry run: would write ${join(outDir, "index.html")}${keyed ? ` using ${Object.keys(setup.keys).join(" and ")} (up to ${maxChars} characters)` : " with the draft voice only (no key)"}`);
          return 0;
        }
        const result = await audition({ sentences: sentencesOf(tour, config.voice.lexicon), title: tour.title, outDir, cacheDir: cache, setup, ffmpeg: requireFfmpeg(), catalogue, ...(candidates ? { candidates } : {}), oneTake: (config.voice.takes ?? "sentence") !== "sentence", yes: Boolean(values.yes), maxChars, say: (l) => log.info(l) });
        log.result({ ...result }, () => [
          `wrote ${result.file}`,
          `${result.voices.filter((v) => v.clips.some(Boolean)).length}/${result.voices.length} voices voiced · ${result.samples.length} lines · ${result.charsSent} characters sent`,
          ...result.voices.filter((v) => v.skipped).map((v) => `  skipped ${v.id}: ${v.skipped}`),
          ...(keyed ? [] : ["no OPENROUTER_API_KEY or REQUESTY_API_KEY: only the draft voice has clips (see `showcase keys status`)"]),
        ]);
        return 0;
      }
      const maxChars = maxCharsOf(values["max-chars"], config.voice.maxChars);
      const report = await run({
        tour,
        lexicon: config.voice.lexicon,
        setup,
        mode,
        voiceDir,
        cacheDir: cache,
        check: Boolean(values.check),
        dryRun: Boolean(values["dry-run"]),
        prune: Boolean(values.prune),
        yes: Boolean(values.yes),
        ...(maxChars !== undefined ? { maxChars } : {}),
        redo: redoOf(values.redo, (config.voice.takes ?? "sentence") !== "sentence"),
        takes: config.voice.takes ?? "sentence",
        say: (l) => log.info(l),
      });
      log.result(report, () => reportLines(report));
      return report.check && !report.ok ? 1 : 0;
    } catch (e) {
      if (e instanceof VoiceRefusal || e instanceof TakeCheckFailed) {
        log.warn(`showcase voice: ${e.message}`);
        return 1;
      }
      throw e;
    }
  },
};
