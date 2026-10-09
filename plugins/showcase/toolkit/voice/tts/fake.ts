/**
 * The fake provider (PLAN §2.4): an ffmpeg `sine` tone whose length follows the sentence's length
 * (characters ÷ 16 seconds), so the whole pipeline runs through real ffmpeg with no network call
 * and no real voice.
 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { toolEnv } from "../../lib/child-env.ts";
import type { TtsResult } from "../types.ts";

const execFileAsync = promisify(execFile);
export const CHARS_PER_SECOND = 16;

export async function synthFake(ffmpegPath: string, text: string): Promise<TtsResult> {
  const seconds = Math.max(0.5, text.length / CHARS_PER_SECOND);
  const dir = await mkdtemp(join(tmpdir(), "showcase-fake-"));
  const wav = join(dir, "tone.wav");
  try {
    await execFileAsync(
      ffmpegPath,
      ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", `sine=frequency=220:duration=${seconds.toFixed(3)}`, "-ar", "24000", "-ac", "1", wav],
      { env: toolEnv() },
    );
    return { bytes: await readFile(wav), format: "wav" };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
