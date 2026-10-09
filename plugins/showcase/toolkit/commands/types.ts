/** The shape every subcommand registers with `cli.ts` (PLAN C7). */
import type { ParseArgsOptionsConfig } from "node:util";
import type { Log } from "../lib/log.ts";

export interface Ctx {
  values: Record<string, string | boolean | undefined>;
  positionals: string[];
  log: Log;
}

export interface Command {
  name: string;
  summary: string;
  /** Shown by `showcase <name> --help`. */
  usage: string;
  options?: ParseArgsOptionsConfig;
  allowPositionals?: boolean;
  /** Resolves to the exit code: 0 ok, 1 failure, 2 usage. */
  run(ctx: Ctx): Promise<number>;
}

/** Thrown for bad arguments; the CLI prints the message and exits 2. */
export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}
