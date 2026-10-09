/**
 * `voice <tour>` (PLAN §2.4): every tour sentence → lexicon → TTS → trim, loudness, limit,
 * resample, pad → MP3 in `voice.dir`, and a manifest beside it. Planning is pure and local (no
 * network, no key, no ffmpeg), so `--check` and `--dry-run` use it as it is; `run` then does the
 * work three sentences at a time (fix 1).
 *
 * A clip is *fresh* when the manifest entry's synth key and file name are both what is expected
 * now. The file name carries the post-processing settings (fix 2), so changing the loudness
 * target makes every clip stale: it is re-processed from the cached raw audio, with no new spend.
 */
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { budgetFor, readingMs, wordCount } from "../runtime/src/narrative.ts";
import { narrationFingerprint, narrationLines } from "../runtime/src/narration.ts";
import { beatsOf, sentenceText, type Tour } from "../runtime/src/schema.ts";
import { encodeMp3, type FfmpegPaths, processClip, requireFfmpeg } from "./audio.ts";
import { fileKey, fileName, type PostConfig, POST, synthKey } from "./keys.ts";
import { applyLexicon, type Lexicon } from "./lexicon.ts";
import { type Clip, manifestFile, type Manifest, orphansIn, manifestFiles, readManifest, serializeManifest, type VoiceRole } from "./manifest.ts";
import { createPool } from "./pool.ts";
import type { VoiceSetup } from "./setup.ts";
import { createFormatMemory, OpenRouterKeyRejected, OpenRouterNoCredits, synthOpenRouter } from "./tts/openrouter.ts";
import { synthFake } from "./tts/fake.ts";
import { synthSay } from "./tts/say.ts";
import type { AudioFormat, TtsResult } from "./types.ts";

export const CONCURRENCY = 3;
export const DEFAULT_MAX_CHARS = 20_000;
export const MIN_WPM = 120;
export const MAX_WPM = 185;

export type Mode = "auto" | "draft" | "final";
export type Status = "fresh" | "draft" | "stale" | "missing";

/** A refusal the user can act on (a guard, a missing key): the command prints it and exits 1. */
export class VoiceRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VoiceRefusal";
  }
}

export interface Sentence {
  beat: string;
  n: number;
  text: string;
  /** After the lexicon. */
  spoken: string;
}

/** The tour's sentences in order, each with what will be spoken. */
export function sentencesOf(tour: Tour, lexicon: Lexicon): Sentence[] {
  return beatsOf(tour).flatMap(({ beat }) =>
    (beat.narration ?? []).map((s, n) => {
      const text = sentenceText(s);
      return { beat: beat.id, n, text, spoken: applyLexicon(text, lexicon) };
    }),
  );
}

export interface Expect {
  role: VoiceRole;
  synth: string;
  file: string;
}

export interface Item {
  sentence: Sentence;
  take: number;
  prior: Clip | undefined;
  status: Status;
  /** What this run would make for it, if it needs making. */
  job: (Expect & { cached: boolean }) | null;
}

export interface PlanOptions {
  tour: Tour;
  lexicon: Lexicon;
  setup: VoiceSetup;
  mode: Mode;
  check?: boolean;
  voiceDir: string;
  cacheDir: string;
  post?: PostConfig;
  redo?: { beat: string; n: number } | undefined;
}

export interface Plan {
  mode: Mode;
  /** The voice this run speaks with when something needs making. */
  target: VoiceRole;
  items: Item[];
  /** Characters that would go to OpenRouter (cached raw audio excluded). */
  paidChars: number;
  paidSentences: number;
  warnings: string[];
}

const RAW_EXTENSIONS: readonly AudioFormat[] = ["wav", "mp3", "pcm", "ogg", "flac"];

function rawCached(cacheDir: string, synth: string): boolean {
  return RAW_EXTENSIONS.some((ext) => existsSync(join(cacheDir, `${synth}.${ext}`)));
}

function findRaw(cacheDir: string, synth: string): TtsResult | null {
  for (const format of RAW_EXTENSIONS) {
    const path = join(cacheDir, `${synth}.${format}`);
    if (existsSync(path)) return { bytes: readFileSync(path), format };
  }
  return null;
}

export function expectFor(role: VoiceRole, s: Sentence, take: number, setup: VoiceSetup, post: PostConfig): Expect | null {
  let synth: string;
  if (role === "narrator") {
    const n = setup.narrator;
    if (!n) return null;
    synth = synthKey({ spoken: s.spoken, provider: "openrouter", model: n.model, voice: n.voice, instructions: n.instructions, speed: n.speed, take });
  } else {
    const d = setup.draft;
    synth = synthKey({ spoken: s.spoken, provider: d.provider, model: d.provider, voice: d.voice, rate: d.rate, take });
  }
  return { role, synth, file: fileName(fileKey(synth, post)) };
}

/** Where every sentence stands, and what a run would do about it. No network, no key, no ffmpeg. */
export function plan(o: PlanOptions): Plan {
  const post = o.post ?? POST;
  const { setup } = o;
  const warnings: string[] = [];
  const narratorReady = Boolean(setup.narrator && setup.apiKey);
  if (setup.draftWarning) warnings.push(setup.draftWarning);
  if (o.mode === "auto" && setup.narrator && !setup.apiKey && !o.check)
    warnings.push(setup.keyProblem ?? "OPENROUTER_API_KEY is unset: speaking with the draft voice (see `showcase keys status`)");

  const target: VoiceRole = o.mode === "draft" ? "draft" : o.mode === "final" ? "narrator" : narratorReady ? "narrator" : "draft";
  const candidates: VoiceRole[] =
    o.mode === "draft" ? ["draft"] : o.mode === "final" ? ["narrator"] : narratorReady && !o.check ? ["narrator"] : setup.narrator ? ["narrator", "draft"] : ["draft"];

  const prior = readManifest(manifestFile(o.voiceDir, o.tour.id));
  const sentences = sentencesOf(o.tour, o.lexicon);
  if (o.redo && !sentences.some((s) => s.beat === o.redo?.beat && s.n === o.redo.n)) throw new VoiceRefusal(`--redo ${o.redo.beat}/${o.redo.n}: there is no such sentence (beat/n counts from 0)`);

  const items = sentences.map((sentence): Item => {
    const before = prior?.clips.find((c) => c.beat === sentence.beat && c.text === sentence.text);
    const redo = o.redo?.beat === sentence.beat && o.redo.n === sentence.n;
    const take = (before?.take ?? 0) + (redo ? 1 : 0);
    let status: Status = before ? "stale" : "missing";
    for (const role of candidates) {
      const e = expectFor(role, sentence, take, setup, post);
      if (before && e && before.synth === e.synth && before.file === e.file) {
        status = existsSync(join(o.voiceDir, before.file)) ? (role === "narrator" ? "fresh" : "draft") : "missing";
        break;
      }
    }
    let job: Item["job"] = null;
    if (status === "stale" || status === "missing") {
      const e = expectFor(target, sentence, take, setup, post);
      if (e) job = { ...e, cached: rawCached(o.cacheDir, e.synth) };
    }
    return { sentence, take, prior: before, status, job };
  });

  const paid = items.filter((i) => i.job?.role === "narrator" && !i.job.cached);
  return { mode: o.mode, target, items, paidChars: paid.reduce((n, i) => n + i.sentence.spoken.length, 0), paidSentences: paid.length, warnings };
}

// ——— The pacing table ———

export interface PaceRow {
  beat: string;
  n: number;
  words: number;
  seconds: number;
  wpm: number;
  /** The duration is a reading-time estimate: no clip yet. */
  estimated: boolean;
  note: string | null;
}

export interface Pacing {
  rows: PaceRow[];
  narrationSec: number;
  window: { min: number; max: number };
  warnings: string[];
}

/** Durations from the clips (or `readingMs` where there are none yet), against 120–185 wpm and the preset's window. */
export function pacing(tour: Tour, items: readonly Item[], durations: ReadonlyMap<Item, number> = new Map()): Pacing {
  const rows = items.map((item): PaceRow => {
    const known = durations.get(item) ?? (item.status === "fresh" || item.status === "draft" ? item.prior?.durationMs : undefined);
    const ms = known ?? readingMs(item.sentence.spoken);
    const words = wordCount(item.sentence.spoken);
    const wpm = (words / (ms / 1000)) * 60;
    const note = known === undefined || words < 4 ? null : wpm > MAX_WPM ? `fast (${Math.round(wpm)} wpm)` : wpm < MIN_WPM ? `slow (${Math.round(wpm)} wpm)` : null;
    return { beat: item.sentence.beat, n: item.sentence.n, words, seconds: ms / 1000, wpm, estimated: known === undefined, note };
  });
  const narrationSec = rows.reduce((s, r) => s + r.seconds, 0);
  const window = budgetFor(tour.meta).narration;
  const warnings: string[] = [];
  for (const r of rows) if (r.note) warnings.push(`${r.beat}/${r.n}: ${r.note}; rewrite the sentence, never speed the voice up`);
  if (narrationSec < window.min || narrationSec > window.max)
    warnings.push(`narration is ${narrationSec.toFixed(1)} s, outside the ${Number(window.min.toFixed(1))}–${Number(window.max.toFixed(1))} s window; rewrite the text`);
  return { rows, narrationSec, window: { min: window.min, max: window.max }, warnings };
}

// ——— Running ———

export interface RunOptions extends PlanOptions {
  yes?: boolean;
  dryRun?: boolean;
  prune?: boolean;
  /** Characters allowed to go to OpenRouter in this run. */
  maxChars?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  retryDelaysMs?: readonly number[];
  concurrency?: number;
  ffmpeg?: FfmpegPaths;
  say?: (line: string) => void;
}

export interface Report {
  tour: string;
  mode: Mode;
  target: VoiceRole;
  check: boolean;
  dryRun: boolean;
  counts: Record<Status, number>;
  synthesised: number;
  fromCache: number;
  charsSent: number;
  manifest: string | null;
  pruned: string[];
  items: { beat: string; n: number; text: string; status: Status; voice: VoiceRole | null; durationMs: number | null }[];
  pacing: Pacing;
  warnings: string[];
  /** For `--check`: every sentence is current (and, under `--final`, spoken by the narrator). */
  ok: boolean;
}

function readFormats(file: string): Record<string, AudioFormat> {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as Record<string, AudioFormat>;
  } catch {
    return {};
  }
}

export async function run(o: RunOptions): Promise<Report> {
  const post = o.post ?? POST;
  const p = plan(o);
  const check = Boolean(o.check);
  const dryRun = Boolean(o.dryRun);
  const say = o.say ?? (() => {});
  const jobs = p.items.filter((i) => i.job);
  const maxChars = o.maxChars ?? DEFAULT_MAX_CHARS;

  const pending = p.items.filter((i) => i.status === "stale" || i.status === "missing");
  if (!check && !dryRun && pending.length > 0) {
    if (p.target === "narrator") {
      if (!o.setup.narrator) throw new VoiceRefusal("there is no narrator: choose one with `showcase voice <tour> --audition`, then set voice.narrator in showcase/config.json");
      if (!o.setup.apiKey) throw new VoiceRefusal(o.setup.keyProblem ?? "OPENROUTER_API_KEY is unset: see `showcase keys status`, or use --draft");
    }
    if (p.paidSentences > 0) {
      if (p.paidChars > maxChars) throw new VoiceRefusal(`${p.paidSentences} sentence(s) need OpenRouter, ${p.paidChars} characters: over --max-chars ${maxChars}`);
      if (!o.yes)
        throw new VoiceRefusal(`${p.paidSentences} sentence(s), ${p.paidChars} characters need a paid OpenRouter call: pass --yes to spend on it (limit --max-chars ${maxChars}), --dry-run to preview, or --draft for the offline voice`);
    }
  }
  if (o.prune && !check && !dryRun && manifestFiles(o.voiceDir).some((f) => !readManifest(f))) throw new VoiceRefusal("--prune: a manifest in the voice dir isn't readable, so its clips can't be told from orphans");

  const durations = new Map<Item, number>();
  const clips = new Map<Item, Clip>();
  let synthesised = 0;
  let fromCache = 0;
  let charsSent = 0;
  let wroteManifest: string | null = null;
  const pruned: string[] = [];

  if (!check && !dryRun && jobs.length > 0) {
    mkdirSync(o.voiceDir, { recursive: true });
    mkdirSync(o.cacheDir, { recursive: true });
    const needsFfmpeg = o.ffmpeg ?? requireFfmpeg();
    const formatsFile = join(o.cacheDir, "formats.json");
    const formats = createFormatMemory(readFormats(formatsFile));
    const before = JSON.stringify(formats.entries());
    const pool = createPool(o.concurrency ?? CONCURRENCY);
    let fatal: Error | null = null;

    const work = async (item: Item): Promise<Clip> => {
      const job = item.job as NonNullable<Item["job"]>;
      if (fatal) throw fatal;
      let raw = findRaw(o.cacheDir, job.synth);
      if (raw) fromCache++;
      else {
        synthesised++;
        if (job.role === "narrator") charsSent += item.sentence.spoken.length;
        const text = item.sentence.spoken;
        const n = o.setup.narrator;
        try {
          raw =
            job.role === "narrator" && n
              ? await synthOpenRouter(
                  { text, provider: "openrouter", model: n.model, voice: n.voice, ...(n.instructions ? { instructions: n.instructions } : {}), ...(n.speed !== undefined ? { speed: n.speed } : {}) },
                  { apiKey: o.setup.apiKey ?? "", formats, ...(o.fetchImpl ? { fetchImpl: o.fetchImpl } : {}), ...(o.sleep ? { sleep: o.sleep } : {}), ...(o.retryDelaysMs ? { retryDelaysMs: o.retryDelaysMs } : {}) },
                )
              : o.setup.draft.provider === "say"
                ? await synthSay(text, { voice: o.setup.draft.voice, rate: o.setup.draft.rate })
                : await synthFake(needsFfmpeg.ffmpeg, text);
        } catch (e) {
          if (e instanceof OpenRouterKeyRejected || e instanceof OpenRouterNoCredits) fatal = e;
          throw e;
        }
        writeFileSync(join(o.cacheDir, `${job.synth}.${raw.format}`), raw.bytes);
      }
      const workDir = mkdtempSync(join(tmpdir(), "showcase-voice-"));
      try {
        const processed = await processClip(needsFfmpeg, raw, post, workDir);
        const mp3 = join(workDir, "out.mp3");
        await encodeMp3(needsFfmpeg, processed.wavPath, mp3, post);
        const target = join(o.voiceDir, job.file);
        copyFileSync(mp3, `${target}.part`);
        renameSync(`${target}.part`, target);
        durations.set(item, processed.durationMs);
        return {
          beat: item.sentence.beat,
          n: item.sentence.n,
          text: item.sentence.text,
          ...(item.sentence.spoken !== item.sentence.text ? { spoken: item.sentence.spoken } : {}),
          voice: job.role,
          take: item.take,
          synth: job.synth,
          hash: job.file.replace(/\.mp3$/, ""),
          file: job.file,
          durationMs: processed.durationMs,
        };
      } finally {
        rmSync(workDir, { recursive: true, force: true });
      }
    };

    say(`voicing ${jobs.length} sentence(s) with ${p.target === "narrator" ? "the narrator" : `the draft voice (${o.setup.draft.provider})`}, ${o.concurrency ?? CONCURRENCY} at a time`);
    const settled = await Promise.allSettled(jobs.map((item) => pool(() => work(item).then((c) => void clips.set(item, c)))));
    const failed = settled.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    if (JSON.stringify(formats.entries()) !== before) writeFileSync(formatsFile, `${JSON.stringify(formats.entries(), null, 2)}\n`);
    if (failed.length > 0) {
      const first = fatal ?? (failed[0]?.reason as Error);
      throw new Error(`${first.message}${failed.length > 1 ? ` (${failed.length} of ${jobs.length} sentences failed; ${clips.size} done, and a re-run reuses them)` : ""}`);
    }
  }

  // The manifest: tour order, one clip per distinct beat and text.
  const finalClip = (item: Item): Clip | undefined => clips.get(item) ?? (item.status === "fresh" || item.status === "draft" ? item.prior : undefined);
  const seen = new Set<string>();
  const manifestClips: Clip[] = [];
  for (const item of p.items) {
    const c = finalClip(item);
    const id = `${item.sentence.beat}\u0000${item.sentence.text}`;
    if (c && !seen.has(id)) {
      seen.add(id);
      manifestClips.push({ ...c, n: item.sentence.n });
    }
  }

  if (!check && !dryRun) {
    const complete = p.items.every((i) => finalClip(i));
    if (complete) {
      mkdirSync(o.voiceDir, { recursive: true });
      const manifest: Manifest = {
        v: 1,
        id: narrationFingerprint(narrationLines(o.tour)),
        tour: o.tour.id,
        narrationMs: manifestClips.reduce((n, c) => n + c.durationMs, 0),
        voices: { ...(o.setup.narrator ? { narrator: o.setup.narrator } : {}), draft: { provider: o.setup.draft.provider, voice: o.setup.draft.voice } },
        post: { ...post },
        clips: manifestClips,
      };
      const file = manifestFile(o.voiceDir, o.tour.id);
      const text = serializeManifest(manifest);
      if (!existsSync(file) || readFileSync(file, "utf8") !== text) writeFileSync(file, text);
      wroteManifest = file;
    }
  }

  const orphans = o.prune ? orphansIn(o.voiceDir) : [];
  if (o.prune) {
    if (check || dryRun) say(`--prune would remove ${orphans.length} orphaned clip(s)`);
    else for (const f of orphans) (rmSync(join(o.voiceDir, f)), pruned.push(f));
  }

  const counts: Record<Status, number> = { fresh: 0, draft: 0, stale: 0, missing: 0 };
  for (const i of p.items) counts[clips.has(i) ? (clips.get(i)?.voice === "narrator" ? "fresh" : "draft") : i.status]++;
  const table = pacing(o.tour, p.items, durations);
  const ok = counts.stale === 0 && counts.missing === 0 && (o.mode !== "final" || counts.draft === 0);
  return {
    tour: o.tour.id,
    mode: p.mode,
    target: p.target,
    check,
    dryRun,
    counts,
    synthesised,
    fromCache,
    charsSent,
    manifest: wroteManifest,
    pruned,
    items: p.items.map((i) => ({
      beat: i.sentence.beat,
      n: i.sentence.n,
      text: i.sentence.text,
      status: clips.has(i) ? (clips.get(i)?.voice === "narrator" ? "fresh" : "draft") : i.status,
      voice: finalClip(i)?.voice ?? null,
      durationMs: finalClip(i)?.durationMs ?? null,
    })),
    pacing: table,
    warnings: [...p.warnings, ...table.warnings],
    ok,
  };
}

