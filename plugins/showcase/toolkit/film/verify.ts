/**
 * The film's verify step (PLAN §2.5 "Verify") and its outputs: stills, the contact sheet,
 * `script.md`, `report.json` and `report.md`.
 *
 * Each check is `ok`, a `warn` or a `fail`. Failures fail the film; warnings fail it only under
 * `--strict`. The §2.5 list:
 * - duration within the target ± tolerance (max(5 s, 10 %); a warning);
 * - −16 ± 1 LUFS integrated and true peak ≤ −1 dBTP, measured on the master (warnings);
 * - no silent gap over 2.5 s between the first sound and the last (a warning);
 * - the SRT equals the sentences (a failure);
 * - captions and audio within 50 ms: each caption that appears after a blank is found in the
 *   master by comparing its caption band with the picture's, and the sound's onset is found in
 *   the master's own audio (a warning);
 * - the largest motion gap ≤ 100 ms, a `nav` load's held frame exempt (Session 7's check);
 * - the last `rehearse` deny-list result clean (a failure when it isn't; a warning when there's
 *   no rehearse, or it's older than the tour).
 * Plus the master itself: AAC 48 kHz stereo, faststart, a chapter per beat (failures), and every
 * sentence voiced (a warning).
 *
 * Then Claude reads the contact sheet and each still against its narration.
 */
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { runTool } from "./encode.ts";
import { decodeMono, type Loudness, levels, longestInnerSilence, measureLoudness, onsetMs } from "./mix.ts";
import type { BeatSpan, SentenceSpan } from "./timeline.ts";

export type Level = "ok" | "warn" | "fail";

export interface VerifyCheck {
  id: string;
  level: Level;
  detail: string;
}

export const LUFS_TARGET = -16;
export const LUFS_TOLERANCE = 1;
export const TRUE_PEAK_MAX = -1;
export const SILENT_GAP_MAX_MS = 2500;
export const SYNC_MAX_MS = 50;

/** The film's length may miss the tour's target by this much. */
export function durationTolerance(targetSec: number): number {
  return Math.max(5, targetSec * 0.1);
}

/** The caption band: where the bottom-centre captions are drawn, in 1920×1080 pixels. */
export const BAND = { x: 160, y: 840, w: 1600, h: 200 } as const;
const BAND_SCALE = { w: 160, h: 20 } as const;
/** A frame shows a caption when its band differs from the picture's by this much (mean of 0–255). */
export const CAPTION_DIFF = 3;

/** The mean luma of `crop` (x:y:w:h), downscaled, for every frame of a video. */
export async function bandSeries(ffmpeg: string, file: string, crop: { x: number; y: number; w: number; h: number } = BAND): Promise<Float64Array[]> {
  const raw = await runTool(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", file, "-an", "-vf", `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},scale=${BAND_SCALE.w}:${BAND_SCALE.h}:flags=area,format=gray`, "-f", "rawvideo", "pipe:1"]);
  const n = BAND_SCALE.w * BAND_SCALE.h;
  const frames: Float64Array[] = [];
  for (let off = 0; off + n <= raw.length; off += n) {
    const f = new Float64Array(n);
    for (let i = 0; i < n; i++) f[i] = raw[off + i] as number;
    frames.push(f);
  }
  return frames;
}

/** Pure: per frame, the mean absolute difference between two series. */
export function frameDiffs(a: readonly Float64Array[], b: readonly Float64Array[]): number[] {
  const out: number[] = [];
  for (let k = 0; k < Math.min(a.length, b.length); k++) {
    const x = a[k] as Float64Array;
    const y = b[k] as Float64Array;
    let sum = 0;
    for (let i = 0; i < x.length; i++) sum += Math.abs((x[i] as number) - (y[i] as number));
    out.push(sum / x.length);
  }
  return out;
}

export interface SyncRow {
  beat: string;
  index: number;
  startMs: number;
  /** When the caption first shows in the master. */
  captionMs: number | null;
  /** When the sound starts in the master. */
  audioMs: number | null;
  /** `audioMs − captionMs`. */
  deltaMs: number | null;
}

/**
 * Pure: for each cue that follows a blank (no caption for at least one frame before it), the
 * first frame showing it, and the first sound at or after 50 ms before it starts.
 */
export function syncRows(sentences: readonly SentenceSpan[], diffs: readonly number[], lv: Float64Array, fps: number): SyncRow[] {
  const frameMs = 1000 / fps;
  const rows: SyncRow[] = [];
  sentences.forEach((s, i) => {
    const prev = sentences[i - 1];
    if (prev && s.startMs - prev.endMs < frameMs) return;
    let captionMs: number | null = null;
    const from = Math.max(0, Math.floor((s.startMs - 100) / frameMs));
    for (let k = from; k < diffs.length && k * frameMs <= s.startMs + 250; k++) {
      if ((diffs[k] as number) > CAPTION_DIFF) {
        captionMs = Math.round(k * frameMs * 10) / 10;
        break;
      }
    }
    const audioMs = s.audio ? onsetMs(lv, s.startMs - 50, s.startMs + 400) : null;
    rows.push({ beat: s.beat, index: s.index, startMs: s.startMs, captionMs, audioMs, deltaMs: captionMs !== null && audioMs !== null ? Math.round((audioMs - captionMs) * 10) / 10 : null });
  });
  return rows;
}

/** Whether `moov` comes before `mdat` (faststart), from the file's top-level boxes. */
export function isFaststart(file: string): boolean {
  const fd = openSync(file, "r");
  try {
    const size = statSync(file).size;
    const head = Buffer.alloc(16);
    let pos = 0;
    while (pos + 8 <= size) {
      readSync(fd, head, 0, 16, pos);
      let len = head.readUInt32BE(0);
      const type = head.toString("latin1", 4, 8);
      if (type === "moov") return true;
      if (type === "mdat") return false;
      if (len === 1) len = Number(head.readBigUInt64BE(8));
      if (len < 8) return false;
      pos += len;
    }
    return false;
  } finally {
    closeSync(fd);
  }
}

export interface MasterProbe {
  audioCodec: string | null;
  sampleRate: number | null;
  channels: number | null;
  chapters: number;
  durationSec: number;
}

export async function probeMaster(ffprobe: string, file: string): Promise<MasterProbe> {
  const j = JSON.parse((await runTool(ffprobe, ["-v", "error", "-show_entries", "stream=codec_type,codec_name,sample_rate,channels:format=duration", "-show_chapters", "-of", "json", file])).toString()) as {
    streams: { codec_type: string; codec_name: string; sample_rate?: string; channels?: number }[];
    chapters?: unknown[];
    format: { duration?: string };
  };
  const a = j.streams.find((s) => s.codec_type === "audio");
  return { audioCodec: a?.codec_name ?? null, sampleRate: a?.sample_rate ? Number(a.sample_rate) : null, channels: a?.channels ?? null, chapters: j.chapters?.length ?? 0, durationSec: Number(j.format.duration) };
}

/** When each beat's still is taken: just before its last sentence ends (else its end), in the master. */
export function stillTimes(beats: readonly BeatSpan[], sentences: readonly SentenceSpan[]): number[] {
  return beats.map((b) => {
    const last = sentences.filter((s) => s.beat === b.beat).at(-1);
    const t = last ? Math.max(last.startMs, last.endMs - 150) : b.endMs - 150;
    return Math.max(b.startMs, Math.round(t));
  });
}

export function stillName(i: number, beat: string): string {
  return `${String(i + 1).padStart(2, "0")}-${beat.replace(/[^a-z0-9-]+/gi, "-")}.png`;
}

/** A still per beat and `contact-sheet.png` (ffmpeg `tile`, 4 across). */
export async function writeStills(ffmpeg: string, master: string, out: string, beats: readonly BeatSpan[], times: readonly number[]): Promise<{ stills: string[]; contactSheet: string | null }> {
  const dir = join(out, "stills");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const stills: string[] = [];
  for (const [i, b] of beats.entries()) {
    const file = join(dir, stillName(i, b.beat));
    await runTool(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-ss", ((times[i] as number) / 1000).toFixed(3), "-i", master, "-frames:v", "1", "-update", "1", file]);
    stills.push(file);
  }
  if (stills.length === 0) return { stills, contactSheet: null };
  const sheet = join(out, "contact-sheet.png");
  const cols = Math.min(4, stills.length);
  const rows = Math.ceil(stills.length / cols);
  await runTool(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-framerate", "1", "-pattern_type", "glob", "-i", join(dir, "*.png"), "-vf", `scale=480:-2,tile=${cols}x${rows}:padding=8:margin=8:color=white`, "-frames:v", "1", "-update", "1", sheet]);
  return { stills, contactSheet: sheet };
}

export interface Measured {
  loudness: Loudness;
  silence: { ms: number; atMs: number | null };
  sync: SyncRow[];
}

/** Measures the master: its loudness, its silences and where each caption and its sound start. */
export async function measureMaster(ffmpeg: string, o: { master: string; picture: string; sentences: readonly SentenceSpan[]; fps: number }): Promise<Measured> {
  const [loudness, samples, a, b] = await Promise.all([measureLoudness(ffmpeg, o.master), decodeMono(ffmpeg, o.master, { stream: "0:a" }), bandSeries(ffmpeg, o.picture), bandSeries(ffmpeg, o.master)]);
  const lv = levels(samples);
  return { loudness, silence: longestInnerSilence(lv), sync: syncRows(o.sentences, frameDiffs(a, b), lv, o.fps) };
}

export interface DenyState {
  file: string;
  present: boolean;
  clean: boolean | null;
  stale: boolean;
  at: string | null;
}

/** The last `rehearse` of this tour: `out/<id>/rehearse.json`. */
export function denyState(out: string, tourFile: string | null): DenyState {
  const file = join(out, "rehearse.json");
  if (!existsSync(file)) return { file, present: false, clean: null, stale: false, at: null };
  try {
    const r = JSON.parse(readFileSync(file, "utf8")) as { at?: string; deny?: { clean?: boolean; checked?: number } };
    const at = r.at ?? null;
    const stale = !!(at && tourFile && existsSync(tourFile) && statSync(tourFile).mtimeMs > Date.parse(at));
    return { file, present: true, clean: r.deny?.clean === true && (r.deny.checked ?? 0) > 0, stale, at };
  } catch {
    return { file, present: true, clean: null, stale: false, at: null };
  }
}

export interface VerifyInput {
  durationMs: number;
  targetSec: number;
  measured: Measured;
  srtProblems: string[];
  sentenceCount: number;
  missingClips: string[];
  silentSentences: number;
  master: MasterProbe;
  faststart: boolean;
  beats: number;
  deny: DenyState;
}

const f1 = (n: number | null) => (n === null ? "?" : n.toFixed(1));

/** Pure: the §2.5 checks, from what was measured. */
export function verifyChecks(v: VerifyInput): VerifyCheck[] {
  const checks: VerifyCheck[] = [];
  const add = (id: string, ok: boolean, bad: Level, detail: string) => checks.push({ id, level: ok ? "ok" : bad, detail });
  const tol = durationTolerance(v.targetSec);
  const sec = v.durationMs / 1000;
  add("duration-target", Math.abs(sec - v.targetSec) <= tol, "warn", `${sec.toFixed(1)} s for a ${v.targetSec} s target (± ${Number(tol.toFixed(1))} s)`);
  const { integratedLufs: i, truePeakDb: tp } = v.measured.loudness;
  add("loudness", i !== null && Math.abs(i - LUFS_TARGET) <= LUFS_TOLERANCE, "warn", `${f1(i)} LUFS integrated (target ${LUFS_TARGET} ± ${LUFS_TOLERANCE})`);
  add("true-peak", tp !== null && tp <= TRUE_PEAK_MAX, "warn", `${f1(tp)} dBTP (at most ${TRUE_PEAK_MAX})`);
  const gap = v.measured.silence;
  add("silence", gap.ms <= SILENT_GAP_MAX_MS, "warn", `longest silence ${(gap.ms / 1000).toFixed(2)} s${gap.atMs !== null && gap.ms > 0 ? ` at ${(gap.atMs / 1000).toFixed(2)} s` : ""} (at most ${SILENT_GAP_MAX_MS / 1000} s)`);
  add("srt", v.srtProblems.length === 0, "fail", v.srtProblems.length ? v.srtProblems.slice(0, 3).join("; ") : `${v.sentenceCount} cues equal the ${v.sentenceCount} sentences`);
  const measured = v.measured.sync.filter((r) => r.deltaMs !== null);
  const worst = measured.reduce((m, r) => Math.max(m, Math.abs(r.deltaMs as number)), 0);
  add(
    "av-sync",
    measured.length > 0 && worst <= SYNC_MAX_MS,
    "warn",
    measured.length ? `captions and sound within ${worst.toFixed(1)} ms over ${measured.length} sentence(s) (at most ${SYNC_MAX_MS})` : "no caption could be measured against its sound",
  );
  add("voiced", v.silentSentences === 0 && v.missingClips.length === 0, "warn", v.silentSentences || v.missingClips.length ? `${v.silentSentences} sentence(s) without a clip${v.missingClips.length ? `; clip files missing for ${v.missingClips.join(", ")}` : ""} (run \`showcase voice\`)` : "every sentence has its clip");
  add("audio", v.master.audioCodec === "aac" && v.master.sampleRate === 48_000 && v.master.channels === 2, "fail", `${v.master.audioCodec ?? "no audio"} ${v.master.sampleRate ?? "?"} Hz × ${v.master.channels ?? "?"}`);
  add("faststart", v.faststart, "fail", v.faststart ? "moov before mdat" : "moov after mdat");
  add("chapters", v.master.chapters === v.beats, "fail", `${v.master.chapters} chapters for ${v.beats} beats`);
  const d = v.deny;
  if (!d.present) checks.push({ id: "deny-list", level: "warn", detail: "no rehearse yet: run `showcase rehearse` first" });
  else if (d.clean === false || d.clean === null) checks.push({ id: "deny-list", level: "fail", detail: `the last rehearse (${d.at ?? "?"}) found deny-list text on screen, or checked nothing` });
  else checks.push({ id: "deny-list", level: d.stale ? "warn" : "ok", detail: d.stale ? `clean, but the tour changed after the last rehearse (${d.at})` : `the last rehearse (${d.at}) was clean` });
  return checks;
}

export interface Report {
  v: 1;
  tour: string;
  title: string;
  at: string;
  ok: boolean;
  strict: boolean;
  draft: boolean;
  draftReasons: string[];
  voice: string;
  durationMs: number;
  outputs: Record<string, string | string[] | null>;
  checks: VerifyCheck[];
  loudness: Loudness & { loudnorm: unknown };
  silence: Measured["silence"];
  sync: SyncRow[];
  stills: { beat: string; atMs: number; file: string; narration: string[] }[];
  deny: DenyState;
  notes: string[];
}

export function reportMd(r: Report): string {
  const mark = (l: Level) => (l === "ok" ? "✓" : l === "warn" ? "⚠" : "✗");
  const lines = [
    `# Film report: ${r.title}`,
    "",
    `**${r.ok ? "PASS" : "FAIL"}**${r.strict ? " (strict)" : ""} · ${(r.durationMs / 1000).toFixed(1)} s · ${r.voice}${r.draft ? ` · **draft** (${r.draftReasons.join("; ")})` : ""} · ${r.at}`,
    "",
    "## Checks",
    "",
    "| | Check | Detail |",
    "|---|---|---|",
    ...r.checks.map((c) => `| ${mark(c.level)} | ${c.id} | ${c.detail.replace(/\|/g, "\\|")} |`),
    "",
    "## Captions against sound",
    "",
    "| Sentence | Starts | Caption | Sound | Δ ms |",
    "|---|---|---|---|---|",
    ...r.sync.map((s) => `| ${s.beat}/${s.index} | ${(s.startMs / 1000).toFixed(2)} | ${s.captionMs === null ? "—" : (s.captionMs / 1000).toFixed(3)} | ${s.audioMs === null ? "—" : (s.audioMs / 1000).toFixed(3)} | ${s.deltaMs ?? "—"} |`),
    "",
    "## Read the stills back",
    "",
    "Does each screen show what its sentence says?",
    "",
    ...r.stills.flatMap((s) => [`- **${s.beat}** at ${(s.atMs / 1000).toFixed(2)} s — \`${s.file}\``, ...s.narration.map((n) => `  - “${n}”`)]),
    "",
  ];
  if (r.notes.length) lines.push("## Notes", "", ...r.notes.map((n) => `- ${n}`), "");
  return lines.join("\n");
}

export function writeReport(out: string, r: Report): void {
  writeFileSync(join(out, "report.json"), `${JSON.stringify(r, null, 2)}\n`);
  writeFileSync(join(out, "report.md"), reportMd(r));
}

export function rel(out: string, file: string | null): string | null {
  return file ? relative(out, file) : null;
}
