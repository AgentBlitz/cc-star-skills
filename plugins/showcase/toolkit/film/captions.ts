/**
 * The film's captions (PLAN §2.5 "Captions", D15): one cue per sentence, timed from the take's
 * `sentence:start` and `sentence:end`, wrapped greedily into at most 2 lines of 42 characters
 * (`wrapCaption`, the rule `check` enforces as T007).
 *
 * - **ASS** is what ffmpeg burns in, after scaling, in the bundled font (`toolkit/fonts/`, found
 *   through `fontsdir`), so macOS and Linux render the same pixels. A draft also gets a DRAFT
 *   watermark, drawn by the same file.
 * - **SRT** comes from the same timings, so the sidecar and the burned-in text never disagree.
 *
 * Pure: strings in, strings out.
 */
import { wrapCaption } from "../runtime/src/schema.ts";

/** The bundled caption font (SIL Open Font License; `toolkit/fonts/OFL.txt`). */
export const CAPTION_FONT = "Atkinson Hyperlegible";
export const CAPTION_FONT_FILE = "AtkinsonHyperlegible-Bold.ttf";

export interface Cue {
  startMs: number;
  endMs: number;
  text: string;
}

/**
 * `H:MM:SS.cc`, ASS's clock (centiseconds), rounded to the nearest; `down` rounds down instead.
 * libass shows an event on a frame whose time is at or after its start, so a start is rounded
 * down: the caption shows on the frame its start names, never the one after (frames come every
 * 33 ms, more than a centisecond apart).
 */
export function assTime(ms: number, down = false): string {
  const cs = Math.max(0, down ? Math.floor(ms / 10 + 1e-6) : Math.round(ms / 10));
  const h = Math.floor(cs / 360_000);
  const m = Math.floor((cs % 360_000) / 6_000);
  const s = Math.floor((cs % 6_000) / 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
}

/** `HH:MM:SS,mmm`, SRT's clock. */
export function srtTime(ms: number): string {
  const t = Math.max(0, Math.round(ms));
  const h = Math.floor(t / 3_600_000);
  const m = Math.floor((t % 3_600_000) / 60_000);
  const s = Math.floor((t % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(t % 1000).padStart(3, "0")}`;
}

/** Text safe inside an ASS Dialogue line: no override blocks, no hard breaks of its own. */
function assText(text: string): string {
  return text.replace(/\\/g, "⧵").replace(/[{}]/g, (c) => (c === "{" ? "(" : ")"));
}

export interface AssOptions {
  /** The video's length: the watermark spans it. */
  durationMs: number;
  /** Draws DRAFT in the top-right corner for the whole film. */
  draft?: boolean;
  width?: number;
  height?: number;
}

/**
 * The ASS script. Styling (a decision of Session 8): the bundled font in bold at 46 px on a
 * 1080-line canvas, white on a 60 %-opaque dark box, bottom centre, 64 px up; lines are broken
 * by `wrapCaption`, never by libass (`WrapStyle: 2`). The watermark is 64 px, half transparent.
 */
export function buildAss(cues: readonly Cue[], o: AssOptions): string {
  const w = o.width ?? 1920;
  const h = o.height ?? 1080;
  const lines = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${w}`,
    `PlayResY: ${h}`,
    "WrapStyle: 2",
    "ScaledBorderAndShadow: yes",
    "YCbCr Matrix: TV.709",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Caption,${CAPTION_FONT},46,&H00FFFFFF,&H00FFFFFF,&H66141414,&H00000000,-1,0,0,0,100,100,0,0,3,14,0,2,160,160,64,1`,
    `Style: Draft,${CAPTION_FONT},64,&H70FFFFFF,&H70FFFFFF,&H90000000,&H00000000,-1,0,0,0,100,100,6,0,1,2,0,9,48,48,40,1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];
  if (o.draft) lines.push(`Dialogue: 1,${assTime(0)},${assTime(o.durationMs)},Draft,,0,0,0,,DRAFT`);
  for (const c of cues) lines.push(`Dialogue: 0,${assTime(c.startMs, true)},${assTime(c.endMs)},Caption,,0,0,0,,${wrapCaption(assText(c.text)).join("\\N")}`);
  return `${lines.join("\n")}\n`;
}

export function buildSrt(cues: readonly Cue[]): string {
  return cues.map((c, i) => `${i + 1}\n${srtTime(c.startMs)} --> ${srtTime(c.endMs)}\n${wrapCaption(c.text).join("\n")}\n`).join("\n");
}

function parseSrtTime(s: string): number {
  const m = /^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/.exec(s.trim());
  if (!m) return Number.NaN;
  return Number(m[1]) * 3_600_000 + Number(m[2]) * 60_000 + Number(m[3]) * 1000 + Number(m[4]);
}

/** An SRT read back: each cue's lines joined with a space. */
export function parseSrt(srt: string): Cue[] {
  const cues: Cue[] = [];
  for (const block of srt.replace(/\r/g, "").split(/\n{2,}/)) {
    const rows = block.split("\n").filter((l) => l.length > 0);
    const times = rows[1]?.split(" --> ");
    if (rows.length < 3 || !times || times.length !== 2) continue;
    cues.push({ startMs: parseSrtTime(times[0] as string), endMs: parseSrtTime(times[1] as string), text: rows.slice(2).join(" ") });
  }
  return cues;
}

/**
 * What the verify step checks of the SRT: one cue per sentence, in order, with the tour's text,
 * each cue's lines within 42 characters and 2 lines, never overlapping the next, all ending
 * before the video does. Returns the problems; none means it equals the sentences.
 */
export function srtProblems(srt: string, sentences: readonly string[], durationMs: number): string[] {
  const cues = parseSrt(srt);
  const problems: string[] = [];
  if (cues.length !== sentences.length) problems.push(`${cues.length} cues for ${sentences.length} sentences`);
  sentences.forEach((s, i) => {
    const c = cues[i];
    if (c && c.text !== s.trim().split(/\s+/).join(" ")) problems.push(`cue ${i + 1} reads "${c.text}", the sentence is "${s}"`);
  });
  const blocks = srt.replace(/\r/g, "").split(/\n{2,}/);
  cues.forEach((c, i) => {
    const textLines = (blocks[i] ?? "").split("\n").slice(2).filter(Boolean);
    if (textLines.length > 2 || textLines.some((l) => l.length > 42)) problems.push(`cue ${i + 1} needs more than 2 lines of 42 characters`);
    if (!(c.endMs > c.startMs)) problems.push(`cue ${i + 1} doesn't end after it starts`);
    const next = cues[i + 1];
    if (next && next.startMs < c.endMs) problems.push(`cue ${i + 1} overlaps cue ${i + 2}`);
    if (c.endMs > durationMs) problems.push(`cue ${i + 1} ends after the video`);
  });
  return problems;
}
