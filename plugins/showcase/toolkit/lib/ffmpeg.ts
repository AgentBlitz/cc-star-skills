/**
 * Finding ffmpeg and ffprobe and checking what they can do (PLAN D10), ported from gods-eye's
 * `scripts/film/lib/ffmpeg.ts`: `FFMPEG_PATH`/`FFPROBE_PATH`, the Homebrew paths, then `which`.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { toolEnv } from "./child-env.ts";
import type { Env } from "./paths.ts";

export interface FfmpegPaths {
  ffmpeg: string;
  ffprobe: string;
}

const CANDIDATE_DIRS = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"];

export const FILTERS = ["ass", "subtitles", "aresample", "perspective", "loudnorm", "ebur128", "alimiter", "silenceremove"] as const;
export const ENCODERS = ["libx264", "aac", "libmp3lame"] as const;
export type Capability = (typeof FILTERS)[number] | (typeof ENCODERS)[number] | "soxr";

export interface Probe {
  version: string | null;
  capabilities: Record<Capability, boolean>;
}

function find(bin: string, override: string | undefined): string | null {
  if (override) return existsSync(override) ? override : null;
  for (const dir of CANDIDATE_DIRS) {
    const path = `${dir}/${bin}`;
    if (existsSync(path)) return path;
  }
  try {
    return execFileSync("which", [bin], { env: toolEnv(), stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || null;
  } catch {
    return null;
  }
}

/** `null` for whichever binary can't be found. */
export function findFfmpeg(env: Env = process.env): { ffmpeg: string | null; ffprobe: string | null } {
  return { ffmpeg: find("ffmpeg", env.FFMPEG_PATH), ffprobe: find("ffprobe", env.FFPROBE_PATH) };
}

/** Names in the second column of `ffmpeg -filters` / `-encoders` listings (after the flag column). */
function listed(text: string): Set<string> {
  const names = new Set<string>();
  for (const line of text.split("\n")) {
    const m = /^\s*([A-Z.|]{2,6})\s+(\S+)\s/.exec(line);
    if (m?.[2] && m[1] !== "------") names.add(m[2]);
  }
  return names;
}

/** Pure: what a build supports, from the text of `-version`, `-filters` and `-encoders`. */
export function parseCapabilities(versionText: string, filtersText: string, encodersText: string): Probe {
  const filters = listed(filtersText);
  const encoders = listed(encodersText);
  const capabilities = {} as Record<Capability, boolean>;
  for (const f of FILTERS) capabilities[f] = filters.has(f);
  for (const e of ENCODERS) capabilities[e] = encoders.has(e);
  capabilities.soxr = /--enable-libsoxr\b/.test(versionText);
  const version = /ffmpeg version (\S+)/.exec(versionText)?.[1] ?? null;
  return { version, capabilities };
}

export function probeCapabilities(ffmpeg: string): Probe {
  const run = (args: string[]) =>
    execFileSync(ffmpeg, ["-hide_banner", ...args], { env: toolEnv(), stdio: ["ignore", "pipe", "ignore"] }).toString();
  const versionText = execFileSync(ffmpeg, ["-version"], { env: toolEnv(), stdio: ["ignore", "pipe", "ignore"] }).toString();
  return parseCapabilities(versionText, run(["-filters"]), run(["-encoders"]));
}

export function missing(probe: Probe): Capability[] {
  return (Object.keys(probe.capabilities) as Capability[]).filter((k) => !probe.capabilities[k]);
}
