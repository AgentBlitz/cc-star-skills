/**
 * Everything the master needs besides the frames (PLAN §2.5), made in `<out>/.post/` from the
 * take's spans: the mixdown and its loudness-normalised audio, the ASS captions (with the DRAFT
 * watermark on a draft), the chapters, and the bundled font. The SRT goes straight to the
 * outputs. `record.ts` then encodes the picture and the master side by side.
 *
 * **A caption starts when its voice does:** at the sentence's start plus the clip's lead, the
 * silence the voice chain puts at the head of every clip (`post.leadMs` in the manifest, 30 ms).
 * Frames come every 33 ms, so this keeps a caption within a frame of its sound either way.
 *
 * **Draft or final** (a decision of Session 8): the film is a draft, written as
 * `<tour>-draft.mp4` with a watermark, unless every sentence has a clip in the narrator's voice
 * and `voice.narrator.approved` is set. Only one of `<tour>.mp4` and `<tour>-draft.mp4` is kept,
 * so a draft is never mistaken for the final cut.
 */
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Project } from "../host/project.ts";
import { parseManifest } from "../voice/manifest.ts";
import type { VoiceManifest } from "../runtime/src/protocol.ts";
import { beatsOf, type Tour } from "../runtime/src/schema.ts";
import { buildAss, buildSrt, CAPTION_FONT_FILE, type Cue } from "./captions.ts";
import type { MasterOptions } from "./encode.ts";
import { type LoudnormMeasure, normalise, type Placement, writeMix } from "./mix.ts";
import { chaptersMeta } from "./script.ts";
import type { Spans } from "./timeline.ts";

export const FONTS_DIR = resolve(import.meta.dirname, "..", "fonts");

/** Every sentence of the tour, in order, as written: what the SRT must equal. */
export function tourSentences(tour: Tour): string[] {
  return beatsOf(tour).flatMap(({ beat }) => (beat.narration ?? []).map((s) => (typeof s === "string" ? s : s.text)));
}

export interface VoiceInfo {
  draft: boolean;
  /** Who speaks, for the script and report. */
  label: string;
  /** Why it's a draft. */
  reasons: string[];
}

export function voiceInfo(p: Project, manifest: VoiceManifest | null, spans: Spans): VoiceInfo {
  const m = manifest ? parseManifest(manifest) : null;
  const byHash = new Map((m?.clips ?? []).map((c) => [c.hash, c]));
  const roles = spans.sentences.map((s) => (s.audio ? (byHash.get(s.audio.hash)?.voice ?? "draft") : null));
  const reasons: string[] = [];
  const silent = roles.filter((r) => r === null).length;
  if (silent) reasons.push(`${silent} sentence(s) have no clip`);
  if (roles.some((r) => r === "draft")) reasons.push("the draft voice speaks");
  const narrator = p.config.voice.narrator;
  if (!narrator) reasons.push("no narrator is chosen (voice.narrator)");
  else if (!narrator.approved) reasons.push("the narrator isn't approved yet (voice.narrator.approved)");
  const draftVoice = (m?.voices as { draft?: { provider?: string; voice?: string } } | undefined)?.draft;
  const label = roles.every((r) => r === "narrator") && narrator
    ? `the narrator (${narrator.model}, ${narrator.voice})`
    : draftVoice?.provider
      ? `the draft voice (${draftVoice.provider}${draftVoice.voice ? `, ${draftVoice.voice}` : ""})`
      : m && roles.some((r) => r !== null)
        ? "draft clips (a hand-made manifest)"
        : "no voice (reading time)";
  return { draft: reasons.length > 0, label, reasons };
}

/** The clips' silent lead, from the manifest's post settings (none for a hand-made manifest). */
export function clipLeadMs(manifest: VoiceManifest | null): number {
  const lead = Number((manifest ? parseManifest(manifest)?.post : undefined)?.leadMs);
  return Number.isFinite(lead) && lead > 0 ? lead : 0;
}

/** One cue per sentence; a voiced one starts after its clip's lead. */
export function captionCues(spans: Spans, manifest: VoiceManifest | null): Cue[] {
  const lead = clipLeadMs(manifest);
  return spans.sentences.map((s) => ({ startMs: s.audio ? Math.min(s.startMs + lead, s.endMs - 1) : s.startMs, endMs: s.endMs, text: s.text }));
}

export interface PostResult {
  master: Omit<MasterOptions, "out">;
  cues: Cue[];
  srt: string;
  placements: Placement[];
  missingClips: string[];
  loudnorm: LoudnormMeasure | null;
}

/** Builds `.post/` and writes the SRT. */
export async function preparePost(o: {
  ffmpeg: string;
  out: string;
  tour: Tour;
  spans: Spans;
  durationMs: number;
  manifest: VoiceManifest | null;
  voiceDir: string | null;
  draft: boolean;
}): Promise<PostResult> {
  const dir = join(o.out, ".post");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, "fonts"), { recursive: true });
  copyFileSync(join(FONTS_DIR, CAPTION_FONT_FILE), join(dir, "fonts", CAPTION_FONT_FILE));

  const files = new Map((o.manifest?.clips ?? []).map((c) => [c.hash, c.file]));
  const placements: Placement[] = [];
  const missingClips: string[] = [];
  for (const s of o.spans.sentences) {
    if (!s.audio) continue;
    const name = files.get(s.audio.hash);
    const file = name && o.voiceDir ? join(o.voiceDir, name) : null;
    if (!file || !existsSync(file)) {
      missingClips.push(`${s.beat}/${s.index}`);
      continue;
    }
    placements.push({ file, atMs: s.startMs });
  }
  await writeMix(o.ffmpeg, placements, o.durationMs, join(dir, "mix.wav"));
  const loudnorm = await normalise(o.ffmpeg, join(dir, "mix.wav"), join(dir, "audio.wav"));

  const cues = captionCues(o.spans, o.manifest);
  writeFileSync(join(dir, "captions.ass"), buildAss(cues, { durationMs: o.durationMs, draft: o.draft }));
  const srt = buildSrt(cues);
  writeFileSync(join(o.out, `${o.tour.id}.srt`), srt);
  writeFileSync(join(dir, "chapters.ffmeta"), chaptersMeta(o.spans.beats, o.durationMs, o.tour.title));
  return {
    master: { cwd: dir, ass: "captions.ass", fontsDir: "fonts", audio: "audio.wav", chapters: "chapters.ffmeta" },
    cues,
    srt,
    placements,
    missingClips,
    loudnorm,
  };
}
