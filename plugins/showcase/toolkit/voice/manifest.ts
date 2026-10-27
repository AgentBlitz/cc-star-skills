/**
 * The voice manifest (PLAN §2.4): `<voice.dir>/<tour>.manifest.json`, one per tour, beside the
 * clips (which are named by hash, so tours share the directory). It extends the runtime's
 * `VoiceManifest` (`{v, id, tour, clips[{beat, text, hash, file, durationMs}]}`, what Watch and
 * the film read) with what the pipeline needs: the take, the synth key, `spoken` when the lexicon
 * changed the text, and the voices and post settings used. Keys are sorted and nothing is
 * timestamped, so a re-run that changes nothing changes no bytes.
 *
 * **v2** (showcase 1.1) is written when a take holds more than one sentence (`voice.takes`). It
 * adds `takes` (each take's steps, take number, synth key, length and transcription check) and,
 * on each clip, `slice`: its take, where it was cut from (`fromMs`, `toMs`) and where its speech
 * starts inside it (`onsetMs`). Every v1 field keeps its meaning, so v1 manifests still load and
 * `sentence` mode still writes v1, byte for byte as 1.0 did.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { VoiceClip, VoiceManifest } from "../runtime/src/protocol.ts";

export type VoiceRole = "narrator" | "draft";

/** Where a v2 clip was cut from its take. */
export interface SliceInfo {
  /** The take's id (`t1`, …). */
  take: string;
  fromMs: number;
  toMs: number;
  /** Where the speech starts, from the slice's start: captions and the sync check start there. */
  onsetMs: number;
}

export interface Clip extends VoiceClip {
  /** The sentence's place in its beat (the `--redo beat/n` address). */
  n: number;
  /** What was spoken, when the lexicon changed the text. */
  spoken?: string;
  voice: VoiceRole;
  take: number;
  /** The synthesis key: a hash of what was asked of the voice (for a slice, its take's). */
  synth: string;
  /** v2: the take it was cut from. */
  slice?: SliceInfo;
}

/** v2: one take. */
export interface TakeRecord {
  id: string;
  steps: string[];
  /** The take number: it goes up with each `--redo` and each retake the check asks for. */
  take: number;
  synth: string;
  voice: VoiceRole;
  chars: number;
  durationMs: number;
  /** `passed` once a transcription confirmed every sentence; `unchecked` when none ran. */
  check: "passed" | "unchecked";
  /** The transcription model, when one ran. */
  model?: string;
  /** Cuts the heard words couldn't confirm (boundary k falls between sentences k and k + 1 of the take). */
  unconfirmed?: number[];
}

export interface Manifest extends VoiceManifest {
  clips: Clip[];
  narrationMs: number;
  voices: Record<string, unknown>;
  post: Record<string, unknown>;
  /** v2 only. */
  takes?: TakeRecord[];
}

export const MANIFEST_SUFFIX = ".manifest.json";

/** The tour's manifest inside the voice dir. */
export function manifestFile(dir: string, tourId: string): string {
  return join(dir, `${tourId}${MANIFEST_SUFFIX}`);
}

/** Every manifest in a voice dir, including a hand-made `manifest.json`. */
export function manifestFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(MANIFEST_SUFFIX) || f === "manifest.json")
    .sort()
    .map((f) => join(dir, f));
}

function isClip(c: unknown): c is Clip {
  if (!c || typeof c !== "object") return false;
  const x = c as Record<string, unknown>;
  return typeof x.beat === "string" && typeof x.text === "string" && typeof x.file === "string" && typeof x.hash === "string" && typeof x.durationMs === "number";
}

function isSlice(s: unknown): s is SliceInfo {
  if (!s || typeof s !== "object") return false;
  const x = s as Record<string, unknown>;
  return typeof x.take === "string" && typeof x.fromMs === "number" && typeof x.toMs === "number" && typeof x.onsetMs === "number";
}

function isTake(t: unknown): t is TakeRecord {
  if (!t || typeof t !== "object") return false;
  const x = t as Record<string, unknown>;
  return typeof x.id === "string" && Array.isArray(x.steps) && typeof x.take === "number" && typeof x.synth === "string";
}

/** Where the clip's speech starts inside it: a v2 slice's onset, else the post chain's lead (none for a hand-made manifest). */
export function clipOnsetMs(clip: Clip, manifest: Pick<Manifest, "post">): number {
  if (clip.slice) return clip.slice.onsetMs;
  const lead = Number(manifest.post.leadMs);
  return Number.isFinite(lead) && lead > 0 ? lead : 0;
}

/** A parsed manifest, or null when the file isn't one of ours (a draft hand-made one has no `synth`). */
export function parseManifest(raw: unknown): Manifest | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if ((m.v !== 1 && m.v !== 2) || typeof m.tour !== "string" || typeof m.id !== "string" || !Array.isArray(m.clips) || !m.clips.every(isClip)) return null;
  return {
    v: m.v,
    id: m.id,
    tour: m.tour,
    narrationMs: typeof m.narrationMs === "number" ? m.narrationMs : 0,
    voices: (m.voices as Record<string, unknown>) ?? {},
    post: (m.post as Record<string, unknown>) ?? {},
    ...(m.v === 2 && Array.isArray(m.takes) ? { takes: (m.takes as unknown[]).filter(isTake) } : {}),
    clips: (m.clips as Clip[]).map((c) => {
      const { slice, ...rest } = c;
      return {
        ...rest,
        n: typeof c.n === "number" ? c.n : 0,
        take: typeof c.take === "number" ? c.take : 0,
        synth: typeof c.synth === "string" ? c.synth : "",
        voice: c.voice === "narrator" ? "narrator" : "draft",
        ...(isSlice(slice) ? { slice } : {}),
      };
    }),
  };
}

export function readManifest(file: string): Manifest | null {
  try {
    return parseManifest(JSON.parse(readFileSync(file, "utf8")));
  } catch {
    return null;
  }
}

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = sorted(v);
    }
    return out;
  }
  return value;
}

/** The manifest's bytes: sorted keys, two-space indent, a final newline. */
export function serializeManifest(m: Manifest): string {
  return `${JSON.stringify(sorted(m), null, 2)}\n`;
}

/** Every file name any manifest in the dir points to. */
export function referencedFiles(dir: string): Set<string> {
  const files = new Set<string>();
  for (const f of manifestFiles(dir)) for (const c of readManifest(f)?.clips ?? []) files.add(c.file);
  return files;
}

/** Clips on disk that no manifest points to any more: `--prune` deletes these. */
export function orphansIn(dir: string, extra: Iterable<string> = []): string[] {
  if (!existsSync(dir)) return [];
  const keep = referencedFiles(dir);
  for (const f of extra) keep.add(f);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".mp3") && !keep.has(f))
    .sort();
}
