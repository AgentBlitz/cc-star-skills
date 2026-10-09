/**
 * The voice manifest (PLAN §2.4): `<voice.dir>/<tour>.manifest.json`, one per tour, beside the
 * clips (which are named by hash, so tours share the directory). It extends the runtime's
 * `VoiceManifest` (`{v, id, tour, clips[{beat, text, hash, file, durationMs}]}`, what Watch and
 * the film read) with what the pipeline needs: the take, the synth key, `spoken` when the lexicon
 * changed the text, and the voices and post settings used. Keys are sorted and nothing is
 * timestamped, so a re-run that changes nothing changes no bytes.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { VoiceClip, VoiceManifest } from "../runtime/src/protocol.ts";

export type VoiceRole = "narrator" | "draft";

export interface Clip extends VoiceClip {
  /** The sentence's place in its beat (the `--redo beat/n` address). */
  n: number;
  /** What was spoken, when the lexicon changed the text. */
  spoken?: string;
  voice: VoiceRole;
  take: number;
  /** The synthesis key: a hash of what was asked of the voice. */
  synth: string;
}

export interface Manifest extends VoiceManifest {
  clips: Clip[];
  narrationMs: number;
  voices: Record<string, unknown>;
  post: Record<string, unknown>;
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

/** A parsed manifest, or null when the file isn't one of ours (a draft hand-made one has no `synth`). */
export function parseManifest(raw: unknown): Manifest | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (m.v !== 1 || typeof m.tour !== "string" || typeof m.id !== "string" || !Array.isArray(m.clips) || !m.clips.every(isClip)) return null;
  return {
    v: 1,
    id: m.id,
    tour: m.tour,
    narrationMs: typeof m.narrationMs === "number" ? m.narrationMs : 0,
    voices: (m.voices as Record<string, unknown>) ?? {},
    post: (m.post as Record<string, unknown>) ?? {},
    clips: (m.clips as Clip[]).map((c) => ({ ...c, n: typeof c.n === "number" ? c.n : 0, take: typeof c.take === "number" ? c.take : 0, synth: typeof c.synth === "string" ? c.synth : "", voice: c.voice === "narrator" ? "narrator" : "draft" })),
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
