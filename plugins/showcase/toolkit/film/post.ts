/**
 * Everything the master needs besides the frames (PLAN §2.5), made in `<out>/.post/` from the
 * take's spans: the mixdown and its loudness-normalised audio, the ASS captions (with the DRAFT
 * watermark on a draft), the chapters, and the bundled font. The SRT goes straight to the
 * outputs. `record.ts` then encodes the picture and the master side by side.
 *
 * **A caption starts when its voice does.** A clip cut from a take (manifest v2) records its own
 * onset, the half pause it opens with; any other clip opens with the lead the voice chain puts at
 * its head (`post.leadMs` in the manifest, 30 ms). From that onset the speech is found in the
 * normalised mix (`speechStartMs`), past a breath or a lip click that can sit between the pause
 * and the first word (100–320 ms in Session 7's take). Each caption then starts on the frame
 * nearest that speech, within half a frame (17 ms at 30 fps) of its sound.
 *
 * **Draft or final** (a decision of Session 8): the film is a draft, written as
 * `<tour>-draft.mp4` with a watermark, unless every sentence has a clip in the narrator's voice
 * and `voice.narrator.approved` is set. Only one of `<tour>.mp4` and `<tour>-draft.mp4` is kept,
 * so a draft is never mistaken for the final cut.
 */
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Project } from "../host/project.ts";
import { clipOnsetMs, parseManifest } from "../voice/manifest.ts";
import type { VoiceManifest } from "../runtime/src/protocol.ts";
import { beatsOf, type Tour } from "../runtime/src/schema.ts";
import { buildAss, buildSrt, CAPTION_FONT_FILE, type Cue } from "./captions.ts";
import type { MasterOptions } from "./encode.ts";
import { decodeMono, levels, type LoudnormMeasure, normalise, type Placement, speechStartMs, writeMix } from "./mix.ts";
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

/**
 * Where each sentence's speech starts, from its start, 0 when it has no clip. The clip's onset
 * (a v2 slice's own, else the lead) is where its pause ends. With the mix's levels (`lv`), the
 * speech is found from there to the clip's end (`speechStartMs`), past any breath or click
 * between the two; the onset stands when none is found.
 */
export function speechOnsets(spans: Spans, manifest: VoiceManifest | null, lv?: Float64Array): number[] {
  const m = manifest ? parseManifest(manifest) : null;
  const byHash = new Map((m?.clips ?? []).map((c) => [c.hash, c]));
  const lead = clipLeadMs(manifest);
  return spans.sentences.map((s) => {
    if (!s.audio) return 0;
    const clip = byHash.get(s.audio.hash);
    const onset = clip && m ? clipOnsetMs(clip, m) : lead;
    if (!lv) return onset;
    const heard = speechStartMs(lv, s.startMs + Math.max(0, onset - ONSET_SLACK_MS), s.startMs + s.audio.durationMs);
    return heard === null ? onset : heard - s.startMs;
  });
}

/** How far before its recorded onset a clip's speech is looked for: a pause's end is found to about a window (Session 7b: within 6 ms). */
const ONSET_SLACK_MS = 20;

/** The time of the frame nearest `ms`, to a tenth of a ms. */
export function nearestFrameMs(ms: number, fps: number): number {
  const frameMs = 1000 / fps;
  return Math.round(Math.round(ms / frameMs) * frameMs * 10) / 10;
}

/**
 * One cue per sentence; a voiced one starts where its speech does (`speechOnsets`, from the mix's
 * levels `lv` when given). With `fps`, each start moves to the nearest frame, so the caption
 * shows within half a frame of its sound, never before the cue it follows has ended.
 */
export function captionCues(spans: Spans, manifest: VoiceManifest | null, fps?: number, lv?: Float64Array): Cue[] {
  const onsets = speechOnsets(spans, manifest, lv);
  const cues: Cue[] = [];
  for (const [i, s] of spans.sentences.entries()) {
    let startMs = s.audio ? s.startMs + (onsets[i] as number) : s.startMs;
    if (fps) startMs = Math.max(nearestFrameMs(startMs, fps), cues.at(-1)?.endMs ?? 0);
    cues.push({ startMs: Math.min(startMs, s.endMs - 1), endMs: s.endMs, text: s.text });
  }
  return cues;
}

export interface PostResult {
  master: Omit<MasterOptions, "out">;
  cues: Cue[];
  /** Where each sentence's speech starts, from its start (`speechOnsets`): what av-sync looks from. */
  onsets: number[];
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
  /** The video's frame rate: each caption starts on the frame nearest its sound. */
  fps: number;
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

  // The captions follow the speech in the very sound the master carries.
  const lv = levels(await decodeMono(o.ffmpeg, join(dir, "audio.wav")));
  const cues = captionCues(o.spans, o.manifest, o.fps, lv);
  writeFileSync(join(dir, "captions.ass"), buildAss(cues, { durationMs: o.durationMs, draft: o.draft }));
  const srt = buildSrt(cues);
  writeFileSync(join(o.out, `${o.tour.id}.srt`), srt);
  writeFileSync(join(dir, "chapters.ffmeta"), chaptersMeta(o.spans.beats, o.durationMs, o.tour.title));
  return {
    master: { cwd: dir, ass: "captions.ass", fontsDir: "fonts", audio: "audio.wav", chapters: "chapters.ffmeta" },
    cues,
    onsets: speechOnsets(o.spans, o.manifest, lv),
    srt,
    placements,
    missingClips,
    loudnorm,
  };
}
