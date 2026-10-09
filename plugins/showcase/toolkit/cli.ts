/**
 * The `showcase` CLI (PLAN §2.2, C7): a `parseArgs` router over a subcommand registry.
 * Every command takes `--help` and `--json`. Exit codes: 0 ok, 1 failure, 2 usage. Anything
 * that escapes a command is redacted before it is printed.
 */
import { parseArgs } from "node:util";
import { auth } from "./commands/auth.ts";
import { check } from "./commands/check.ts";
import { doctor } from "./commands/doctor.ts";
import { docs } from "./commands/docs.ts";
import { init } from "./commands/init.ts";
import { inspect } from "./commands/inspect.ts";
import { keys } from "./commands/keys.ts";
import { rehearse } from "./commands/rehearse.ts";
import { shim } from "./commands/shim.ts";
import { storyboard } from "./commands/storyboard.ts";
import { type Command, UsageError } from "./commands/types.ts";
import { watch } from "./commands/watch.ts";
import { createLog } from "./lib/log.ts";
import { describeError, redact } from "./lib/redact.ts";

export const COMMANDS: readonly Command[] = [doctor, keys, shim, docs, init, check, storyboard, rehearse, watch, inspect, auth];

function help(): string {
  const width = Math.max(...COMMANDS.map((c) => c.name.length));
  return [
    "Usage: showcase <command> [options]",
    "",
    "Commands:",
    ...COMMANDS.map((c) => `  ${c.name.padEnd(width)}  ${c.summary}`),
    "",
    "Every command takes --help and --json. Exit codes: 0 ok, 1 failure, 2 usage.",
  ].join("\n");
}

export async function main(argv: string[]): Promise<number> {
  const [name, ...rest] = argv;
  if (!name || name === "--help" || name === "-h" || name === "help") {
    (name ? process.stdout : process.stderr).write(help() + "\n");
    return name ? 0 : 2;
  }
  const cmd = COMMANDS.find((c) => c.name === name);
  if (!cmd) {
    process.stderr.write(`showcase: unknown command '${name}'. Run 'showcase --help'.\n`);
    return 2;
  }

  let parsed;
  try {
    parsed = parseArgs({
      args: rest,
      options: { ...cmd.options, help: { type: "boolean", short: "h" }, json: { type: "boolean" } },
      allowPositionals: cmd.allowPositionals ?? false,
      strict: true,
    });
  } catch (e) {
    process.stderr.write(`showcase ${name}: ${redact((e as Error).message)}\n${cmd.usage}\n`);
    return 2;
  }
  if (parsed.values.help) {
    process.stdout.write(cmd.usage + "\n");
    return 0;
  }

  const log = createLog(Boolean(parsed.values.json));
  try {
    return await cmd.run({
      values: parsed.values as Record<string, string | boolean | undefined>,
      positionals: parsed.positionals,
      log,
    });
  } catch (e) {
    if (e instanceof UsageError) {
      log.warn(`showcase ${name}: ${e.message}\n${cmd.usage}`);
      return 2;
    }
    log.warn(`showcase ${name}: ${describeError(e)}`);
    return 1;
  }
}

process.on("uncaughtException", (e) => {
  process.stderr.write(`showcase: ${describeError(e)}\n`);
  process.exit(1);
});
process.on("unhandledRejection", (e) => {
  process.stderr.write(`showcase: ${describeError(e)}\n`);
  process.exit(1);
});

process.exitCode = await main(process.argv.slice(2));
