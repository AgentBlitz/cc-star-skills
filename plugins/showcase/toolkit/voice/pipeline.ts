/**
 * `voice <tour>` (PLAN §2.4): the tour's narration → lexicon → TTS → trim, loudness, limit,
 * resample, pad → MP3 in `voice.dir`, and a manifest beside it. Planning is pure and local (no
 * network, no key, no ffmpeg), so `--check` and `--dry-run` use it as it is; `run` then does the
 * work three at a time (fix 1).
 *
 * `voice.takes` (showcase 1.1, `takes.ts`) says how much is read in one go. In `sentence` mode
 * (1.0, and the default) every sentence is its own call and clip. In `tour` and `step` modes a
 * take is one call; it is processed as a whole, cut at its pauses (`align.ts`), checked against a
 * transcription when there's a Requesty key (`transcribe.ts`), and written as one slice per
 * sentence, under manifest v2. A take that skipped, repeated or garbled a sentence is voiced again
 * whole, at most twice more; one sentence is never patched.
 *
 * A clip is *fresh* when the manifest entry's synth key and file name are both what is expected
 * now. The file name carries the post-processing settings (fix 2), so changing the loudness
 * target makes every clip stale: it is re-processed from the cached raw audio, with no new spend.
 * A slice's synth key is its take's, so a changed sentence makes its whole take stale.
 */
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { budgetFor, readingMs, wordCount } from "../runtime/src/narrative.ts";
import { narrationFingerprint, narrationLines } from "../runtime/src/narration.ts";
import { beatsOf, sentenceText, type Tour } from "../runtime/src/schema.ts";
import { ALIGN_VERSION, detectPauses, fitBoundaries, type Pause, SOFT_PAUSE_DB, slicesFor, writeSlices } from "./align.ts";
import { encodeMp3, type FfmpegPaths, processClip, requireFfmpeg } from "./audio.ts";
import { fileKey, fileName, type PostConfig, POST, synthKey } from "./keys.ts";
import { applyLexicon, type Lexicon } from "./lexicon.ts";
import { type Clip, manifestFile, type Manifest, orphansIn, manifestFiles, readManifest, serializeManifest, type TakeRecord, type VoiceRole } from "./manifest.ts";
import { createPool } from "./pool.ts";
import type { Narrator, VoiceSetup } from "./setup.ts";
import { PROVIDER_LABEL, stopsQueue, synthNarrator } from "./tts/narrator.ts";
import { createFormatMemory } from "./tts/openrouter.ts";
import { synthFake } from "./tts/fake.ts";
import { synthSay } from "./tts/say.ts";
import { fakeTake, groupTakes, inputLimit, type TakeGroup, type TakeMode, TakeTooLong } from "./takes.ts";
import { checkTable, checkTake, confirmBoundaries, pickTranscriptionModel, type TakeCheck, type Transcript, transcribeRequesty } from "./transcribe.ts";
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
  /** The take this sentence is read in (`t1`, …), when takes hold more than one sentence. */
  group: string | null;
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
  redo?: Redo | undefined;
  /** `voice.takes`; default `sentence`, 1.0's behaviour. */
  takes?: TakeMode;
}

/** `--redo`: a sentence (`beat/n`), or under takes a step id or a take (`t2`), whose whole take is voiced again. */
export type Redo = { beat: string; n: number } | { target: string };

/** One take of the plan (takes modes only). */
export interface TakePlan {
  group: TakeGroup;
  take: number;
  /** What this run would make for it, if anything in it needs making. */
  job: (Expect & { cached: boolean }) | null;
  /** The manifest's record of it, from before this run. */
  prior: TakeRecord | undefined;
}

export interface Plan {
  mode: Mode;
  /** The voice this run speaks with when something needs making. */
  target: VoiceRole;
  items: Item[];
  /** Characters that would go to the narrator's provider (cached raw audio excluded). */
  paidChars: number;
  paidSentences: number;
  /** Takes modes: every take, in order (null in `sentence` mode). */
  takes: TakePlan[] | null;
  paidTakes: number;
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

/** The narrator as the manifest records it: OpenRouter, the 1.0 default, goes unnamed, so a 1.0 manifest is unchanged. */
export function manifestNarrator(n: Narrator): Omit<Narrator, "provider"> & { provider?: Narrator["provider"] } {
  const { provider, ...rest } = n;
  return provider === "openrouter" ? rest : { provider, ...rest };
}

export function expectFor(role: VoiceRole, s: Sentence, take: number, setup: VoiceSetup, post: PostConfig): Expect | null {
  let synth: string;
  if (role === "narrator") {
    const n = setup.narrator;
    if (!n) return null;
    synth = synthKey({ spoken: s.spoken, provider: n.provider, model: n.model, voice: n.voice, instructions: n.instructions, speed: n.speed, take });
  } else {
    const d = setup.draft;
    synth = synthKey({ spoken: s.spoken, provider: d.provider, model: d.provider, voice: d.voice, rate: d.rate, take });
  }
  return { role, synth, file: fileName(fileKey(synth, post)) };
}

/** A slice's file name: its take's synth key, its place in the take, the alignment and the post settings. */
export function sliceFile(synth: string, index: number, post: PostConfig): string {
  return fileName(fileKey(`${synth}#${index}@align${ALIGN_VERSION}`, post));
}

/** Where every sentence stands, and what a run would do about it. No network, no key, no ffmpeg. */
export function plan(o: PlanOptions): Plan {
  const post = o.post ?? POST;
  const { setup } = o;
  const warnings: string[] = [];
  const narratorReady = Boolean(setup.narrator && setup.apiKey);
  if (setup.draftWarning) warnings.push(setup.draftWarning);
  if (o.mode === "auto" && setup.narrator && !setup.apiKey && !o.check)
    warnings.push(setup.keyProblem ?? `${setup.keyName} is unset: speaking with the draft voice (see \`showcase keys status\`)`);

  const target: VoiceRole = o.mode === "draft" ? "draft" : o.mode === "final" ? "narrator" : narratorReady ? "narrator" : "draft";
  const candidates: VoiceRole[] =
    o.mode === "draft" ? ["draft"] : o.mode === "final" ? ["narrator"] : narratorReady && !o.check ? ["narrator"] : setup.narrator ? ["narrator", "draft"] : ["draft"];

  const prior = readManifest(manifestFile(o.voiceDir, o.tour.id));
  const sentences = sentencesOf(o.tour, o.lexicon);
  if (o.takes && o.takes !== "sentence") return planTakes(o, { mode: o.takes, post, target, candidates, prior, sentences, warnings });
  const redoAt = o.redo && "beat" in o.redo ? o.redo : null;
  if (o.redo && !redoAt) throw new VoiceRefusal(`--redo ${(o.redo as { target: string }).target}: with voice.takes "sentence", --redo names a sentence as beat/n`);
  if (redoAt && !sentences.some((s) => s.beat === redoAt.beat && s.n === redoAt.n)) throw new VoiceRefusal(`--redo ${redoAt.beat}/${redoAt.n}: there is no such sentence (beat/n counts from 0)`);

  const items = sentences.map((sentence): Item => {
    const before = prior?.clips.find((c) => c.beat === sentence.beat && c.text === sentence.text);
    const redo = redoAt?.beat === sentence.beat && redoAt.n === sentence.n;
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
    return { sentence, group: null, take, prior: before, status, job };
  });

  const paid = items.filter((i) => i.job?.role === "narrator" && !i.job.cached);
  return { mode: o.mode, target, items, paidChars: paid.reduce((n, i) => n + i.sentence.spoken.length, 0), paidSentences: paid.length, takes: null, paidTakes: 0, warnings };
}

/** The take's expectation: its script is what the voice is asked to read. */
function takeExpect(role: VoiceRole, group: TakeGroup, take: number, setup: VoiceSetup, post: PostConfig): Expect | null {
  return expectFor(role, { beat: "", n: 0, text: group.script, spoken: group.script }, take, setup, post);
}

/** The takes a role's voice would read: the narrator's are cut to its model's input limit. */
function groupsFor(role: VoiceRole, o: PlanOptions, mode: Exclude<TakeMode, "sentence">, sentences: readonly Sentence[]): TakeGroup[] {
  const limit = inputLimit(role === "narrator" ? (o.setup.narrator?.model ?? null) : null);
  try {
    return groupTakes(o.tour, sentences, mode, limit);
  } catch (e) {
    if (e instanceof TakeTooLong) throw new VoiceRefusal(e.message);
    throw e;
  }
}

/** The take a `--redo` names, among the target's takes. */
function redoGroup(redo: Redo, groups: readonly TakeGroup[]): TakeGroup {
  const found =
    "beat" in redo
      ? groups.find((g) => g.sentences.some((s) => s.beat === redo.beat && s.n === redo.n))
      : (groups.find((g) => g.steps.includes(redo.target)) ?? groups.find((g) => g.id === redo.target || g.id === `t${redo.target}`));
  if (!found) throw new VoiceRefusal(`--redo ${"beat" in redo ? `${redo.beat}/${redo.n}` : redo.target}: no take holds it (name a step id, a take such as t1, or a sentence as beat/n)`);
  return found;
}

function planTakes(
  o: PlanOptions,
  c: { mode: Exclude<TakeMode, "sentence">; post: PostConfig; target: VoiceRole; candidates: VoiceRole[]; prior: Manifest | null; sentences: Sentence[]; warnings: string[] },
): Plan {
  const { setup } = o;
  const priorRecord = (g: TakeGroup) => c.prior?.takes?.find((t) => t.steps.join("\u0000") === g.steps.join("\u0000"));
  const priorTake = (g: TakeGroup) => priorRecord(g)?.take ?? 0;
  const targetGroups = groupsFor(c.target, o, c.mode, c.sentences);
  const redone = o.redo ? redoGroup(o.redo, targetGroups) : null;

  // What each candidate voice would have made of each sentence: its take's synth key and its slice's file.
  const expected = new Map<VoiceRole, Map<Sentence, { synth: string; file: string }>>();
  for (const role of c.candidates) {
    const map = new Map<Sentence, { synth: string; file: string }>();
    const groups = role === c.target ? targetGroups : groupsFor(role, o, c.mode, c.sentences);
    for (const g of groups) {
      const e = takeExpect(role, g, priorTake(g) + (role === c.target && g === redone ? 1 : 0), setup, c.post);
      if (e) g.sentences.forEach((s, i) => map.set(s, { synth: e.synth, file: sliceFile(e.synth, i, c.post) }));
    }
    expected.set(role, map);
  }

  const items: Item[] = [];
  const takes: TakePlan[] = [];
  for (const g of targetGroups) {
    const take = priorTake(g) + (g === redone ? 1 : 0);
    const groupItems = g.sentences.map((sentence): Item => {
      const before = c.prior?.clips.find((x) => x.beat === sentence.beat && x.text === sentence.text);
      let status: Status = before ? "stale" : "missing";
      for (const role of c.candidates) {
        const e = expected.get(role)?.get(sentence);
        if (before && e && before.synth === e.synth && before.file === e.file) {
          status = existsSync(join(o.voiceDir, before.file)) ? (role === "narrator" ? "fresh" : "draft") : "missing";
          break;
        }
      }
      return { sentence, group: g.id, take, prior: before, status, job: null };
    });
    let job: TakePlan["job"] = null;
    if (groupItems.some((i) => i.status === "stale" || i.status === "missing")) {
      const e = takeExpect(c.target, g, take, setup, c.post);
      if (e) job = { ...e, cached: rawCached(o.cacheDir, e.synth) };
    }
    for (const i of groupItems) i.job = job;
    items.push(...groupItems);
    takes.push({ group: g, take, job, prior: priorRecord(g) });
  }
  const paid = takes.filter((t) => t.job?.role === "narrator" && !t.job.cached);
  return {
    mode: o.mode,
    target: c.target,
    items,
    paidChars: paid.reduce((n, t) => n + t.group.script.length, 0),
    paidSentences: paid.reduce((n, t) => n + t.group.sentences.length, 0),
    takes,
    paidTakes: paid.length,
    warnings: c.warnings,
  };
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
  /** Characters allowed to go to the narrator's provider in this run. */
  maxChars?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  retryDelaysMs?: readonly number[];
  concurrency?: number;
  ffmpeg?: FfmpegPaths;
  say?: (line: string) => void;
}

/** Takes modes: one take's outcome, as the report gives it. */
export interface TakeReport {
  id: string;
  steps: string[];
  sentences: number;
  chars: number;
  take: number;
  /** Voiced (or cut again) this run, current from before, or still to do (`--check`, `--dry-run`). */
  status: "voiced" | "current" | "pending";
  voice: VoiceRole | null;
  check: TakeRecord["check"] | null;
  /** How many times it was voiced this run (a failed transcription check voices it again). */
  attempts: number;
}

/** A take still wrong after its retakes: the per-sentence table is in the message. */
export class TakeCheckFailed extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TakeCheckFailed";
  }
}

/** How many more times a take is voiced when the transcription check fails it. */
export const RETAKES = 2;

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
  /** Takes modes only. */
  takes: TakeReport[] | null;
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
      if (!o.setup.apiKey) throw new VoiceRefusal(o.setup.keyProblem ?? `${o.setup.keyName} is unset: see \`showcase keys status\`, or use --draft`);
    }
    if (p.paidSentences > 0) {
      const via = PROVIDER_LABEL[o.setup.narrator?.provider ?? "openrouter"];
      const what = p.takes ? `${p.paidTakes} take(s) (${p.paidSentences} sentences)` : `${p.paidSentences} sentence(s)`;
      if (p.paidChars > maxChars) throw new VoiceRefusal(`${what} need ${via}, ${p.paidChars} characters: over --max-chars ${maxChars}`);
      if (!o.yes)
        throw new VoiceRefusal(
          `${what}, ${p.paidChars} characters need a paid ${via} call${p.takes && o.setup.keys.requesty ? ", plus a transcription of each take" : ""}: pass --yes to spend on it (limit --max-chars ${maxChars}, retakes included), --dry-run to preview, or --draft for the offline voice`,
        );
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
  const takeWarnings: string[] = [];

  const takeRuns = new Map<string, TakeOutcome>();
  if (p.takes && !check && !dryRun && jobs.length > 0) {
    mkdirSync(o.voiceDir, { recursive: true });
    mkdirSync(o.cacheDir, { recursive: true });
    const ffmpegPaths = o.ffmpeg ?? requireFfmpeg();
    const formatsFile = join(o.cacheDir, "formats.json");
    const formats = createFormatMemory(readFormats(formatsFile));
    const before = JSON.stringify(formats.entries());
    const budget = { sent: 0, max: maxChars };
    const ctx: TakeContext = { o, post, ffmpeg: ffmpegPaths, formats, budget, model: undefined, say, warnings: [] };
    const pool = createPool(o.concurrency ?? CONCURRENCY);
    let fatal: Error | null = null;
    const todo = p.takes.filter((t) => t.job);
    say(`voicing ${todo.length} take(s) with ${p.target === "narrator" ? "the narrator" : `the draft voice (${o.setup.draft.provider})`}`);
    const settled = await Promise.allSettled(
      todo.map((t) =>
        pool(async () => {
          if (fatal) throw fatal;
          try {
            const out = await voiceTake(ctx, t);
            takeRuns.set(t.group.id, out);
            const byItem = p.items.filter((i) => i.group === t.group.id);
            byItem.forEach((item, k) => {
              const clip = out.clips[k] as Clip;
              clips.set(item, clip);
              durations.set(item, clip.durationMs);
            });
          } catch (e) {
            if (stopsQueue(e)) fatal = e as Error;
            throw e;
          }
        }),
      ),
    );
    synthesised += [...takeRuns.values()].reduce((n, r) => n + r.synthesised, 0);
    fromCache += [...takeRuns.values()].reduce((n, r) => n + r.fromCache, 0);
    charsSent += budget.sent;
    takeWarnings.push(...ctx.warnings);
    if (JSON.stringify(formats.entries()) !== before) writeFileSync(formatsFile, `${JSON.stringify(formats.entries(), null, 2)}\n`);
    const failed = settled.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    if (failed.length > 0) {
      const first = fatal ?? (failed[0]?.reason as Error);
      if (first instanceof TakeCheckFailed) throw first;
      throw new Error(`${first.message}${failed.length > 1 ? ` (${failed.length} of ${todo.length} takes failed; ${takeRuns.size} done, and a re-run reuses them)` : ""}`);
    }
  }

  if (!p.takes && !check && !dryRun && jobs.length > 0) {
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
              ? await synthNarrator(
                  n.provider,
                  { text, provider: n.provider, model: n.model, voice: n.voice, ...(n.instructions ? { instructions: n.instructions } : {}), ...(n.speed !== undefined ? { speed: n.speed } : {}) },
                  { apiKey: o.setup.apiKey ?? "", formats, ...(o.fetchImpl ? { fetchImpl: o.fetchImpl } : {}), ...(o.sleep ? { sleep: o.sleep } : {}), ...(o.retryDelaysMs ? { retryDelaysMs: o.retryDelaysMs } : {}) },
                )
              : o.setup.draft.provider === "say"
                ? await synthSay(text, { voice: o.setup.draft.voice, rate: o.setup.draft.rate })
                : await synthFake(needsFfmpeg.ffmpeg, text);
        } catch (e) {
          if (stopsQueue(e)) fatal = e as Error;
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
        v: p.takes ? 2 : 1,
        id: narrationFingerprint(narrationLines(o.tour)),
        tour: o.tour.id,
        narrationMs: manifestClips.reduce((n, c) => n + c.durationMs, 0),
        voices: { ...(o.setup.narrator ? { narrator: manifestNarrator(o.setup.narrator) } : {}), draft: { provider: o.setup.draft.provider, voice: o.setup.draft.voice } },
        post: { ...post },
        ...(p.takes ? { takes: p.takes.map((t) => takeRecord(t, p.items.filter((i) => i.group === t.group.id).map((i) => finalClip(i) as Clip), takeRuns.get(t.group.id))) } : {}),
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
  const takes: TakeReport[] | null = p.takes
    ? p.takes.map((t) => {
        const ran = takeRuns.get(t.group.id);
        const first = finalClip(p.items.find((i) => i.group === t.group.id) as Item);
        return {
          id: t.group.id,
          steps: t.group.steps,
          sentences: t.group.sentences.length,
          chars: t.group.script.length,
          take: ran?.take ?? t.take,
          status: ran ? "voiced" : t.job ? "pending" : "current",
          voice: ran ? (t.job?.role ?? null) : t.job ? null : (first?.voice ?? null),
          check: ran ? ran.check : null,
          attempts: ran?.attempts ?? 0,
        };
      })
    : null;
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
    takes,
    warnings: [...p.warnings, ...takeWarnings, ...table.warnings],
    ok,
  };
}


// ——— Takes ———

interface TakeContext {
  o: RunOptions;
  post: PostConfig;
  ffmpeg: FfmpegPaths;
  formats: ReturnType<typeof createFormatMemory>;
  /** Characters sent to the narrator's provider this run, against `--max-chars`. */
  budget: { sent: number; max: number };
  /** The transcription model: undefined until looked up, null when there is none to use. */
  model: string | null | undefined;
  say: (line: string) => void;
  warnings: string[];
}

interface TakeOutcome {
  take: number;
  synth: string;
  clips: Clip[];
  durationMs: number;
  check: TakeRecord["check"];
  model?: string;
  unconfirmed: number[];
  attempts: number;
  synthesised: number;
  fromCache: number;
}

/** The manifest's record of a take, from this run's outcome or the clips it already had. */
function takeRecord(t: TakePlan, clips: readonly Clip[], ran: TakeOutcome | undefined): TakeRecord {
  const first = clips[0] as Clip;
  const priorCheck = t.prior && t.prior.synth === first.synth ? t.prior : undefined;
  return {
    id: t.group.id,
    steps: t.group.steps,
    take: ran?.take ?? first.take,
    synth: ran?.synth ?? first.synth,
    voice: first.voice,
    chars: t.group.script.length,
    durationMs: clips.reduce((n, c) => n + c.durationMs, 0),
    check: ran?.check ?? priorCheck?.check ?? "unchecked",
    ...((ran ? ran.model : priorCheck?.model) ? { model: (ran ? ran.model : priorCheck?.model) as string } : {}),
    ...((ran ? ran.unconfirmed : (priorCheck?.unconfirmed ?? [])).length ? { unconfirmed: ran ? ran.unconfirmed : (priorCheck?.unconfirmed as number[]) } : {}),
  };
}

/** The transcription model, looked up once per run; null (with a warning) when the listing names none. */
async function transcriptionModel(ctx: TakeContext): Promise<string | null> {
  if (ctx.model !== undefined) return ctx.model;
  try {
    ctx.model = await pickTranscriptionModel(ctx.o.fetchImpl);
    if (!ctx.model) ctx.warnings.push("Requesty lists no OpenAI Whisper model: the takes weren't checked by transcription");
  } catch (e) {
    ctx.model = null;
    ctx.warnings.push(`Requesty's transcription listing couldn't be read (${(e as Error).message}): the takes weren't checked by transcription`);
  }
  return ctx.model;
}

/** The raw take: from the cache, else from its voice. */
async function rawTake(ctx: TakeContext, group: TakeGroup, synth: string, role: VoiceRole): Promise<{ raw: TtsResult; cached: boolean }> {
  const found = findRaw(ctx.o.cacheDir, synth);
  if (found) return { raw: found, cached: true };
  const { setup } = ctx.o;
  const n = setup.narrator;
  let raw: TtsResult;
  if (role === "narrator" && n) {
    ctx.budget.sent += group.script.length;
    raw = await synthNarrator(
      n.provider,
      { text: group.script, provider: n.provider, model: n.model, voice: n.voice, ...(n.instructions ? { instructions: n.instructions } : {}), ...(n.speed !== undefined ? { speed: n.speed } : {}) },
      { apiKey: setup.apiKey ?? "", formats: ctx.formats, ...(ctx.o.fetchImpl ? { fetchImpl: ctx.o.fetchImpl } : {}), ...(ctx.o.sleep ? { sleep: ctx.o.sleep } : {}), ...(ctx.o.retryDelaysMs ? { retryDelaysMs: ctx.o.retryDelaysMs } : {}) },
    );
  } else if (setup.draft.provider === "say") raw = await synthSay(group.script, { voice: setup.draft.voice, rate: setup.draft.rate });
  else raw = { bytes: fakeTake(group.sentences).wav, format: "wav" };
  writeFileSync(join(ctx.o.cacheDir, `${synth}.${raw.format}`), raw.bytes);
  return { raw, cached: false };
}

/** The take's transcript: from the cache, else from Requesty. */
async function transcriptOf(ctx: TakeContext, synth: string, model: string, mp3: string): Promise<Transcript> {
  const file = join(ctx.o.cacheDir, `${fileKey(synth, ctx.post).slice(0, 16)}.${model.replace(/[^a-z0-9.-]+/gi, "_")}.words.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")) as Transcript;
  const t = await transcribeRequesty(readFileSync(mp3), {
    apiKey: ctx.o.setup.keys.requesty as string,
    model,
    ...(ctx.o.fetchImpl ? { fetchImpl: ctx.o.fetchImpl } : {}),
    ...(ctx.o.sleep ? { sleep: ctx.o.sleep } : {}),
    ...(ctx.o.retryDelaysMs ? { retryDelaysMs: ctx.o.retryDelaysMs } : {}),
  });
  writeFileSync(file, `${JSON.stringify(t)}\n`);
  return t;
}

/**
 * Voices one take, checks it, cuts it and writes its slices. A narrator take the transcription
 * fails (or that has too few pauses to cut) is voiced again whole as a new take, at most
 * {@link RETAKES} more times and within `--max-chars`; then it fails with a per-sentence table.
 */
async function voiceTake(ctx: TakeContext, t: TakePlan): Promise<TakeOutcome> {
  const job = t.job as NonNullable<TakePlan["job"]>;
  const { group } = t;
  const role = job.role;
  const labels = group.sentences.map((s) => `${s.beat}/${s.n}`);
  const checkable = role === "narrator" && Boolean(ctx.o.setup.keys.requesty);
  if (role === "narrator" && !checkable) ctx.warnings.push(`take ${group.id} wasn't checked by transcription: there's no REQUESTY_API_KEY`);
  let take = t.take;
  let attempts = 0;
  let synthesised = 0;
  let fromCache = 0;
  for (;;) {
    const e = takeExpect(role, group, take, ctx.o.setup, ctx.post) as Expect;
    if (attempts > 0 && role === "narrator" && !rawCached(ctx.o.cacheDir, e.synth) && ctx.budget.sent + group.script.length > ctx.budget.max)
      throw new TakeCheckFailed(`take ${group.id} needs voicing again, but ${group.script.length} more characters would pass --max-chars ${ctx.budget.max}`);
    const { raw, cached } = await rawTake(ctx, group, e.synth, role);
    attempts++;
    if (cached) fromCache++;
    else synthesised++;
    const work = mkdtempSync(join(tmpdir(), "showcase-take-"));
    try {
      const processed = await processClip(ctx.ffmpeg, raw, ctx.post, work);
      const pauses = await detectPauses(ctx.ffmpeg, processed.wavPath, processed.durationMs);
      const speechStartMs = ctx.post.leadMs;
      let boundaries: Pause[] | null = fitBoundaries({ pauses, weights: group.sentences.map((s) => s.spoken.length), speechStartMs, speechEndMs: processed.durationMs - ctx.post.tailMs });
      let check: TakeCheck | null = null;
      let model: string | null = null;
      let unconfirmed: number[] = [];
      if (checkable && (model = await transcriptionModel(ctx))) {
        const mp3 = join(work, "take.mp3");
        await encodeMp3(ctx.ffmpeg, processed.wavPath, mp3, ctx.post);
        try {
          check = checkTake(group.sentences.map((s) => s.spoken), (await transcriptOf(ctx, e.synth, model, mp3)).words);
        } catch (err) {
          if (stopsQueue(err)) throw err;
          ctx.warnings.push(`take ${group.id} wasn't checked by transcription: ${(err as Error).message}`);
          model = null;
        }
        if (check?.ok && boundaries) {
          const soft = await detectPauses(ctx.ffmpeg, processed.wavPath, processed.durationMs, SOFT_PAUSE_DB);
          ({ boundaries, unconfirmed } = confirmBoundaries(boundaries, pauses, check, soft));
        }
      }
      const wrong = (check && !check.ok) || !boundaries;
      if (wrong) {
        const why = !boundaries ? `it has too few pauses to cut into ${group.sentences.length} sentences` : "the transcription doesn't match the script";
        if (role !== "narrator" || attempts > RETAKES)
          throw new TakeCheckFailed([`take ${group.id} (${group.steps.join(", ")}): ${why}${attempts > 1 ? ` after ${attempts} takes` : ""}`, ...(check ? checkTable(check, labels) : [])].join("\n"));
        ctx.say(`take ${group.id}: ${why}; voicing it again (retake ${attempts} of ${RETAKES})`);
        take++;
        continue;
      }
      const cuts = boundaries as Pause[];
      const slices = slicesFor(cuts, { durationMs: processed.durationMs, speechStartMs, sampleRate: ctx.post.sampleRate });
      const files = group.sentences.map((_, i) => sliceFile(e.synth, i, ctx.post));
      await writeSlices(ctx.ffmpeg, processed.wavPath, slices, files.map((f) => join(work, f)), work, ctx.post);
      for (const f of files) {
        const target = join(ctx.o.voiceDir, f);
        copyFileSync(join(work, f), `${target}.part`);
        renameSync(`${target}.part`, target);
      }
      for (const k of unconfirmed) ctx.warnings.push(`take ${group.id}: the cut after ${labels[k]} isn't confirmed by the heard words; listen to it`);
      const clips = group.sentences.map((s, i): Clip => {
        const sl = slices[i] as (typeof slices)[number];
        return {
          beat: s.beat,
          n: s.n,
          text: s.text,
          ...(s.spoken !== s.text ? { spoken: s.spoken } : {}),
          voice: role,
          take,
          synth: e.synth,
          hash: (files[i] as string).replace(/\.mp3$/, ""),
          file: files[i] as string,
          durationMs: Math.round(sl.toMs - sl.fromMs),
          slice: { take: group.id, fromMs: Math.round(sl.fromMs), toMs: Math.round(sl.toMs), onsetMs: sl.onsetMs },
        };
      });
      return { take, synth: e.synth, clips, durationMs: processed.durationMs, check: check ? "passed" : "unchecked", ...(model ? { model } : {}), unconfirmed, attempts, synthesised, fromCache };
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }
}
