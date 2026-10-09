/**
 * CLI output (PLAN C7): terse human lines, or one JSON document with `--json`. Everything is
 * redacted on the way out.
 */
import { redact } from "./redact.ts";

export interface Log {
  readonly json: boolean;
  /** A human line on stdout; silent under `--json`. */
  info(msg: string): void;
  /** A warning or error line on stderr, in both modes. */
  warn(msg: string): void;
  /** The command's result: JSON under `--json`, else the human rendering. */
  result(data: unknown, human: () => string | string[]): void;
}

export function createLog(json: boolean, out: NodeJS.WritableStream = process.stdout, err: NodeJS.WritableStream = process.stderr): Log {
  return {
    json,
    info(msg) {
      if (!json) out.write(redact(msg) + "\n");
    },
    warn(msg) {
      err.write(redact(msg) + "\n");
    },
    result(data, human) {
      if (json) out.write(redact(JSON.stringify(data, null, 2)) + "\n");
      else {
        const h = human();
        const text = Array.isArray(h) ? h.join("\n") : h;
        if (text) out.write(redact(text) + "\n");
      }
    },
  };
}
