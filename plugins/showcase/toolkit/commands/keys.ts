/**
 * `showcase keys status|init|import|test|set` (PLAN §2.3). No subcommand ever prints a value:
 * names, sources and states only. `set` needs a TTY, so only the user's own terminal can run it.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { initUserFile, PermissionError, readKeyFrom, resolveAll, resolveKey, writeUserKey } from "../lib/env.ts";
import { pluginRoot } from "../lib/paths.ts";
import { redact } from "../lib/redact.ts";
import { type Command, type Ctx, UsageError } from "./types.ts";

const KEY = "OPENROUTER_API_KEY";

function template(): string {
  return readFileSync(join(pluginRoot, "skills", "showcase", "templates", "env.template"), "utf8");
}

/** OpenRouter's free key-info endpoint. A loopback override exists for tests only. */
export function keyEndpoint(): string {
  const base = process.env.SHOWCASE_OPENROUTER_BASE;
  if (base && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(base)) return `${base.replace(/\/$/, "")}/key`;
  return "https://openrouter.ai/api/v1/key";
}

/** The non-secret fields of `GET /api/v1/key` worth showing. `label` (a partial key) and ids are left out. */
export const SAFE_KEY_FIELDS = ["is_free_tier", "limit", "limit_remaining", "limit_reset", "usage", "usage_monthly", "expires_at"] as const;

async function status({ log }: Ctx): Promise<number> {
  const { values, files } = resolveAll();
  log.result(
    {
      keys: values.map((v) => ({ name: v.name, set: Boolean(v.source), source: v.source })),
      userFile: files.user,
      repoFile: files.repo,
    },
    () => {
      const width = Math.max(...values.map((v) => v.name.length));
      const lines = values.map((v) => `${v.name.padEnd(width)}  ${v.source ? `set    (${v.source})` : "unset"}`);
      lines.push("", `user file: ${files.user.path} (${files.user.state})`);
      if (files.user.fix) lines.push(`  fix: ${files.user.fix}`);
      if (files.repo) {
        lines.push(`repo file: ${files.repo.path} (${files.repo.state})`);
        if (files.repo.fix) lines.push(`  skipped, because it isn't git-ignored: ${files.repo.fix}`);
      }
      return lines;
    },
  );
  return files.user.state === "loose" ? 1 : 0;
}

async function init({ log }: Ctx): Promise<number> {
  const { path, created } = initUserFile(template());
  log.result({ path, created }, () => [
    created ? `Created ${path} (mode 600).` : `${path} already exists; left as is.`,
    `Edit it in your own editor (open -e '${path}'), or run 'showcase keys set' in your own terminal.`,
  ]);
  return 0;
}

async function importKey({ positionals, values, log }: Ctx): Promise<number> {
  const file = positionals[1];
  if (!file) throw new UsageError("keys import needs a file, e.g. showcase keys import ~/repo/.env.local");
  const src = resolve(file);
  if (!existsSync(src)) {
    log.warn(`No such file: ${src}`);
    return 1;
  }
  const value = readKeyFrom(src, KEY);
  if (!value) {
    log.warn(`${src} has no ${KEY} line; nothing imported.`);
    return 1;
  }
  const { path, replaced } = writeUserKey(KEY, value, template(), { force: Boolean(values.force) });
  log.result({ imported: KEY, from: src, to: path, replaced }, () => `${replaced ? "Replaced" : "Imported"} ${KEY} from ${src} into ${path}.`);
  return 0;
}

async function test({ log }: Ctx): Promise<number> {
  let key;
  try {
    key = resolveKey(KEY);
  } catch (e) {
    if (e instanceof PermissionError) {
      log.warn(e.message);
      return 1;
    }
    throw e;
  }
  if (!key.value) {
    log.warn(`${KEY} is not set. Run 'showcase keys status' to see where showcase looks.`);
    return 1;
  }
  const res = await fetch(keyEndpoint(), { headers: { Authorization: `Bearer ${key.value}` } });
  const text = await res.text();
  if (!res.ok) {
    let message = text;
    try {
      message = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? text;
    } catch {}
    log.warn(`OpenRouter rejected ${KEY} (${key.source}): HTTP ${res.status} ${redact(message).slice(0, 200)}`);
    return 1;
  }
  const data = (JSON.parse(text) as { data?: Record<string, unknown> }).data ?? {};
  const safe: Record<string, unknown> = {};
  for (const f of SAFE_KEY_FIELDS) if (f in data) safe[f] = data[f];
  log.result({ ok: true, source: key.source, key: safe }, () => [
    `${KEY} works (${key.source}).`,
    ...Object.entries(safe).map(([k, v]) => `  ${k}: ${v === null ? "none" : String(v)}`),
  ]);
  return 0;
}

async function set({ values, log }: Ctx): Promise<number> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    log.warn("keys set needs your own terminal (it reads the key with hidden input). Run it there, after 'showcase shim'.");
    return 1;
  }
  let muted = false;
  const out = new Writable({
    write(chunk, _enc, cb) {
      if (!muted) process.stdout.write(chunk);
      cb();
    },
  });
  const rl = createInterface({ input: process.stdin, output: out, terminal: true });
  const value = await new Promise<string>((done) => {
    rl.question(`${KEY} (input hidden): `, (answer) => done(answer.trim()));
    muted = true;
  });
  rl.close();
  process.stdout.write("\n");
  if (!value) {
    log.warn("Nothing entered; unchanged.");
    return 1;
  }
  const { path, replaced } = writeUserKey(KEY, value, template(), { force: Boolean(values.force) });
  log.result({ set: KEY, path, replaced }, () => `${replaced ? "Replaced" : "Saved"} ${KEY} in ${path}. Check it with 'showcase keys test'.`);
  return 0;
}

const SUBS: Record<string, (ctx: Ctx) => Promise<number>> = { status, init, import: importKey, test, set };

export const keys: Command = {
  name: "keys",
  summary: "Key status, init, import <file>, test, set (never prints a value)",
  usage: [
    "Usage: showcase keys <status|init|import <file>|test|set> [--force] [--json]",
    "  status         each known variable: set or unset, and its source",
    "  init           create the user key file (700 dir, 600 file) from the template",
    "  import <file>  copy only the OPENROUTER_API_KEY line from <file>; --force to replace",
    "  test           check the key with OpenRouter's free GET /api/v1/key",
    "  set            enter the key with hidden input (your own terminal only); --force to replace",
  ].join("\n"),
  options: { force: { type: "boolean" } },
  allowPositionals: true,
  async run(ctx) {
    const sub = ctx.positionals[0] ?? "status";
    const fn = SUBS[sub];
    if (!fn) throw new UsageError(`unknown keys subcommand '${sub}'`);
    if (sub !== "import" && ctx.positionals.length > 1) throw new UsageError(`keys ${sub} takes no arguments`);
    return fn(ctx);
  },
};
