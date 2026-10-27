/**
 * `showcase keys status|init|import|test|set` (PLAN §2.3). No subcommand ever prints a value:
 * names, sources and states only. `set` needs a TTY, so only the user's own terminal can run it.
 * Two keys can be set, tested and imported: OpenRouter's and, from 1.1, Requesty's.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { initUserFile, PermissionError, readKeyFrom, type Resolved, resolveAll, resolveKey, writeUserKey } from "../lib/env.ts";
import { pluginRoot } from "../lib/paths.ts";
import { redact } from "../lib/redact.ts";
import { requestyBase } from "../voice/tts/requesty.ts";
import { type Command, type Ctx, UsageError } from "./types.ts";

const KEY = "OPENROUTER_API_KEY";
/** The keys `set`, `test` and `import` take. */
const PROVIDER_KEYS = ["OPENROUTER_API_KEY", "REQUESTY_API_KEY"] as const;
type ProviderKey = (typeof PROVIDER_KEYS)[number];

function keyName(given: string | undefined): ProviderKey {
  if (given === undefined) return KEY;
  if (!(PROVIDER_KEYS as readonly string[]).includes(given)) throw new UsageError(`'${given}' isn't a key showcase sets: ${PROVIDER_KEYS.join(" or ")}`);
  return given as ProviderKey;
}

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

/** Requesty's free `GET /v1/manage/apikey/self`: the fields worth showing. Its id, name and group are left out. */
export const SAFE_REQUESTY_FIELDS = ["monthly_spend", "monthly_limit", "logging"] as const;

/** Where each key is checked, for free, and which of the answer's fields are safe to show. */
function checkOf(name: ProviderKey): { url: string; provider: string; safe: (body: unknown) => Record<string, unknown> } {
  const pick = (data: Record<string, unknown>, fields: readonly string[]) => Object.fromEntries(fields.filter((f) => f in data).map((f) => [f, data[f]]));
  if (name === "REQUESTY_API_KEY")
    return {
      url: `${requestyBase().manage}/manage/apikey/self`,
      provider: "Requesty",
      safe: (body) => {
        const data = (body ?? {}) as Record<string, unknown>;
        const completions = (data.permissions as { completions?: unknown } | undefined)?.completions;
        return { ...pick(data, SAFE_REQUESTY_FIELDS), ...(typeof completions === "string" ? { completions } : {}) };
      },
    };
  return { url: keyEndpoint(), provider: "OpenRouter", safe: (body) => pick((body as { data?: Record<string, unknown> }).data ?? {}, SAFE_KEY_FIELDS) };
}

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
  if (positionals.length > 3) throw new UsageError("keys import takes a file and, optionally, a key name");
  const KEY = keyName(positionals[2]);
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

async function test({ positionals, log }: Ctx): Promise<number> {
  const asked = positionals[1] === undefined ? null : keyName(positionals[1]);
  const toTest: Resolved[] = [];
  let problem: PermissionError | null = null;
  for (const name of asked ? [asked] : PROVIDER_KEYS) {
    try {
      const key = resolveKey(name);
      if (key.value) toTest.push(key);
    } catch (e) {
      if (!(e instanceof PermissionError)) throw e;
      problem = e;
    }
  }
  if (toTest.length === 0) {
    log.warn(problem ? problem.message : `${asked ?? PROVIDER_KEYS.join(" and ")} ${asked ? "is" : "are"} not set. Run 'showcase keys status' to see where showcase looks.`);
    return 1;
  }
  const results: { name: string; ok: boolean; source: string | null; key?: Record<string, unknown> }[] = [];
  for (const key of toTest) {
    const check = checkOf(key.name as ProviderKey);
    const res = await fetch(check.url, { headers: { Authorization: `Bearer ${key.value}` } });
    const text = await res.text();
    if (!res.ok) {
      let message = text;
      try {
        message = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? text;
      } catch {}
      log.warn(`${check.provider} rejected ${key.name} (${key.source}): HTTP ${res.status} ${redact(message).slice(0, 200)}`);
      results.push({ name: key.name, ok: false, source: key.source });
      continue;
    }
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      // The body is never shown: it could echo the key.
      log.warn(`${check.provider} answered ${key.name} (${key.source}) with HTTP ${res.status} but a body that isn't JSON`);
      results.push({ name: key.name, ok: false, source: key.source });
      continue;
    }
    results.push({ name: key.name, ok: true, source: key.source, key: check.safe(body) });
  }
  const ok = results.every((r) => r.ok);
  const passed = results.filter((r) => r.ok);
  if (passed.length)
    log.result(results.length === 1 ? { ...(results[0] as object) } : { ok, results }, () =>
      passed.flatMap((r) => [`${r.name} works (${r.source}).`, ...Object.entries(r.key ?? {}).map(([k, v]) => `  ${k}: ${v === null ? "none" : String(v)}`)]),
    );
  return ok ? 0 : 1;
}

async function set({ positionals, values, log }: Ctx): Promise<number> {
  const KEY = keyName(positionals[1]);
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
    "Usage: showcase keys <status|init|import <file> [NAME]|test [NAME]|set [NAME]> [--force] [--json]",
    "  NAME is OPENROUTER_API_KEY (the default) or REQUESTY_API_KEY",
    "  status                each known variable: set or unset, and its source",
    "  init                  create the user key file (700 dir, 600 file) from the template",
    "  import <file> [NAME]  copy only that key's line from <file>; --force to replace",
    "  test [NAME]           check the key for free (OpenRouter's GET /api/v1/key, Requesty's GET /v1/manage/apikey/self); every set key without NAME",
    "  set [NAME]            enter the key with hidden input (your own terminal only); --force to replace",
  ].join("\n"),
  options: { force: { type: "boolean" } },
  allowPositionals: true,
  async run(ctx) {
    const sub = ctx.positionals[0] ?? "status";
    const fn = SUBS[sub];
    if (!fn) throw new UsageError(`unknown keys subcommand '${sub}'`);
    const max = sub === "import" ? 3 : sub === "test" || sub === "set" ? 2 : 1;
    if (ctx.positionals.length > max) throw new UsageError(`keys ${sub} takes ${max === 1 ? "no arguments" : "at most one key name"}`);
    return fn(ctx);
  },
};
