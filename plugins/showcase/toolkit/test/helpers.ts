/** Shared test helpers: scratch dirs, a scratch git repo, and running the CLI as a child. */
import { execFileSync, spawn } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export const CANARY = "sk-or-v1-CANARY-0123456789abcdef";
export const BIN = resolve(import.meta.dirname, "..", "..", "bin", "showcase");

export function scratch(prefix = "showcase-test-"): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

/** A config dir (700) holding a user key file (600) with `body`. */
export function userConfig(body: string): string {
  const dir = join(scratch(), "showcase");
  mkdirSync(dir, { mode: 0o700 });
  chmodSync(dir, 0o700);
  writeFileSync(join(dir, ".env"), body, { mode: 0o600 });
  return dir;
}

/** A scratch git repo with a `.env.local`, ignored or not. */
export function scratchRepo(envLocal: string, ignored: boolean): string {
  const dir = scratch("showcase-repo-");
  execFileSync("git", ["init", "-q"], { cwd: dir });
  if (ignored) writeFileSync(join(dir, ".gitignore"), ".env.local\n");
  writeFileSync(join(dir, ".env.local"), envLocal);
  return dir;
}

export interface Run {
  code: number | null;
  stdout: string;
  stderr: string;
}

/** Runs `bin/showcase` with a clean environment plus `env`. */
export function cli(args: string[], opts: { env?: Record<string, string>; cwd?: string; input?: string } = {}): Promise<Run> {
  return new Promise((done, fail) => {
    const child = spawn(BIN, args, {
      cwd: opts.cwd ?? scratch(),
      env: { PATH: process.env.PATH ?? "", HOME: scratch("showcase-home-"), ...opts.env },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", fail);
    child.on("close", (code) => done({ code, stdout, stderr }));
    child.stdin.end(opts.input ?? "");
  });
}
