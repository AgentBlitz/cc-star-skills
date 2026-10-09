/**
 * macOS `say`: the offline draft voice, standing in for the narrator until the key is present or
 * a sentence needs a quick redo (PLAN §2.4). No shell: the text goes through a file, and the
 * command runs as an argument vector. Off macOS, or without `say`, the pipeline falls back to the
 * fake provider with a warning (`resolveDraft`).
 */
import { execFile, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { toolEnv } from "../../lib/child-env.ts";
import type { TtsResult } from "../types.ts";

const execFileAsync = promisify(execFile);

export const DEFAULT_SAY_VOICE = "Daniel";
export const DEFAULT_SAY_RATE = 175;

/** Where `say` lives, or null when this machine has none (not macOS, or the binary is gone). */
export function findSay(platform: string = process.platform): string | null {
  if (platform !== "darwin") return null;
  if (existsSync("/usr/bin/say")) return "/usr/bin/say";
  try {
    return execFileSync("which", ["say"], { env: toolEnv(), stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || null;
  } catch {
    return null;
  }
}

export async function synthSay(text: string, opts: { voice?: string; rate?: number; say?: string }): Promise<TtsResult> {
  const say = opts.say ?? findSay();
  if (!say) throw new Error("`say` isn't available on this machine");
  const dir = await mkdtemp(join(tmpdir(), "showcase-say-"));
  const txt = join(dir, "line.txt");
  const wav = join(dir, "line.wav");
  try {
    await writeFile(txt, text, "utf8");
    await execFileAsync(
      say,
      ["-v", opts.voice ?? DEFAULT_SAY_VOICE, "-r", String(opts.rate ?? DEFAULT_SAY_RATE), "--file-format=WAVE", "--data-format=LEI16@24000", "-o", wav, "-f", txt],
      { env: toolEnv() },
    );
    return { bytes: await readFile(wav), format: "wav" };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
