/**
 * What child processes see (PLAN §2.3). The app server gets its normal environment minus
 * showcase's names; tools (ffmpeg, say, Chromium, npm) get a short allowlist.
 */
import { SHOWCASE_NAMES } from "./names.ts";
import type { Env } from "./paths.ts";

const TOOL_ALLOW = ["PATH", "HOME", "LANG", "TMPDIR"] as const;

/** The app server's environment: everything except showcase's keys and overrides. */
export function appEnv(base: Env = process.env, extra: Env = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(base)) {
    if (v !== undefined && !SHOWCASE_NAMES.includes(k)) out[k] = v;
  }
  for (const [k, v] of Object.entries(extra)) if (v !== undefined) out[k] = v;
  return out;
}

/** A tool's environment: `PATH`, `HOME`, `LANG`, `TMPDIR`, plus explicit additions. */
export function toolEnv(extra: Env = {}, base: Env = process.env): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of TOOL_ALLOW) {
    const v = base[k];
    if (v !== undefined) out[k] = v;
  }
  out.PATH ??= "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin";
  for (const [k, v] of Object.entries(extra)) if (v !== undefined) out[k] = v;
  return out;
}
