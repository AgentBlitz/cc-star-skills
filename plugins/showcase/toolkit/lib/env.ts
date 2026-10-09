/**
 * The only key reader (PLAN §2.3, C1). Resolution order:
 *   1. the process environment;
 *   2. the repo's `.env.local`, only when `git check-ignore` confirms it is ignored;
 *   3. the user file, `${SHOWCASE_CONFIG_DIR:-${XDG_CONFIG_HOME:-~/.config}/showcase}/.env`.
 * Files are parsed with `util.parseEnv`, which never touches `process.env`, and only the names in
 * `KEY_NAMES` are taken. A user file looser than 600 (or its directory looser than 700) is refused
 * with the fix. Values are returned with their source and registered for redaction; nothing here
 * ever logs.
 */
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseEnv } from "node:util";
import { KEY_NAMES, type KeyName } from "./names.ts";
import { type Env, repoRoot, userKeyFile } from "./paths.ts";
import { registerSecret } from "./redact.ts";

export type Source = "environment" | "repo .env.local" | "user file";

export interface Resolved {
  name: KeyName;
  value: string | undefined;
  source: Source | null;
}

export class PermissionError extends Error {
  readonly path: string;
  readonly fix: string;
  constructor(path: string, kind: "file" | "directory", mode: number, fix: string) {
    super(`${kind} ${path} has mode ${mode.toString(8)}; it must not be readable by others. Fix: ${fix}`);
    this.name = "PermissionError";
    this.path = path;
    this.fix = fix;
  }
}

export interface FileState {
  path: string;
  /** missing · ok · loose (refused) · not-ignored (repo file skipped) */
  state: "missing" | "ok" | "loose" | "not-ignored";
  fix?: string;
}

export interface EnvOptions {
  env?: Env;
  cwd?: string;
}

/** Throws `PermissionError` if the file or its directory is open to group or others. */
export function checkModes(file: string): void {
  const dir = dirname(file);
  const dmode = statSync(dir).mode & 0o777;
  if (dmode & 0o077) throw new PermissionError(dir, "directory", dmode, `chmod 700 '${dir}'`);
  const fmode = statSync(file).mode & 0o777;
  if (fmode & 0o077) throw new PermissionError(file, "file", fmode, `chmod 600 '${file}'`);
}

function pick(text: string): Partial<Record<KeyName, string>> {
  const parsed = parseEnv(text) as Record<string, string>;
  const out: Partial<Record<KeyName, string>> = {};
  for (const name of KEY_NAMES) {
    const v = parsed[name];
    if (v !== undefined && v.trim() !== "") out[name] = v;
  }
  return out;
}

function isIgnored(root: string, file: string): boolean {
  try {
    execFileSync("git", ["check-ignore", "-q", file], { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export interface Loaded {
  repo: FileState | null;
  user: FileState;
  repoValues: Partial<Record<KeyName, string>>;
  userValues: Partial<Record<KeyName, string>>;
}

/** Reads both files (never `process.env`), reporting each one's state. */
export function loadFiles(opts: EnvOptions = {}): Loaded {
  const env = opts.env ?? process.env;
  let repo: FileState | null = null;
  let repoValues: Partial<Record<KeyName, string>> = {};
  const root = repoRoot(opts.cwd ?? process.cwd());
  if (root) {
    const path = join(root, ".env.local");
    if (!existsSync(path)) repo = { path, state: "missing" };
    else if (!isIgnored(root, path)) repo = { path, state: "not-ignored", fix: `add .env.local to ${root}/.gitignore` };
    else {
      repo = { path, state: "ok" };
      repoValues = pick(readFileSync(path, "utf8"));
    }
  }

  const upath = userKeyFile(env);
  let user: FileState = { path: upath, state: "missing" };
  let userValues: Partial<Record<KeyName, string>> = {};
  if (existsSync(upath)) {
    try {
      checkModes(upath);
      user = { path: upath, state: "ok" };
      userValues = pick(readFileSync(upath, "utf8"));
    } catch (e) {
      if (!(e instanceof PermissionError)) throw e;
      user = { path: upath, state: "loose", fix: e.fix };
    }
  }

  for (const v of [...Object.values(repoValues), ...Object.values(userValues)]) registerSecret(v);
  return { repo, user, repoValues, userValues };
}

/** Every known name, resolved in order, with where it came from. */
export function resolveAll(opts: EnvOptions = {}): { values: Resolved[]; files: Loaded } {
  const env = opts.env ?? process.env;
  const files = loadFiles(opts);
  const values = KEY_NAMES.map((name): Resolved => {
    const fromEnv = env[name];
    if (fromEnv !== undefined && fromEnv.trim() !== "") {
      registerSecret(fromEnv);
      return { name, value: fromEnv, source: "environment" };
    }
    if (files.repoValues[name] !== undefined) return { name, value: files.repoValues[name], source: "repo .env.local" };
    if (files.userValues[name] !== undefined) return { name, value: files.userValues[name], source: "user file" };
    return { name, value: undefined, source: null };
  });
  return { values, files };
}

/** One name. Throws `PermissionError` when the user file would have been the source but is too open. */
export function resolveKey(name: KeyName, opts: EnvOptions = {}): Resolved {
  const { values, files } = resolveAll(opts);
  const r = values.find((v) => v.name === name) ?? { name, value: undefined, source: null };
  if (!r.source && files.user.state === "loose") {
    throw new PermissionError(files.user.path, "file", 0, files.user.fix ?? "");
  }
  return r;
}

/* ---- Writing the user file (keys init / import / set). Values are never returned or logged. ---- */

/** Creates the directory (700) and the file (600) from the template. Never overwrites. */
export function initUserFile(template: string, opts: EnvOptions = {}): { path: string; created: boolean } {
  const path = userKeyFile(opts.env ?? process.env);
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
  if (existsSync(path)) return { path, created: false };
  writeFileSync(path, template, { mode: 0o600, flag: "wx" });
  chmodSync(path, 0o600);
  return { path, created: true };
}

/** Sets one name in the user file, replacing its line (commented or not) or appending one. */
export function writeUserKey(
  name: KeyName,
  value: string,
  template: string,
  opts: EnvOptions & { force?: boolean } = {},
): { path: string; replaced: boolean } {
  if (/[\r\n]/.test(value)) throw new Error(`${name} must be a single line`);
  registerSecret(value);
  const { path } = initUserFile(template, opts);
  checkModes(path);
  const text = readFileSync(path, "utf8");
  const existing = pick(text)[name];
  if (existing !== undefined && !opts.force) {
    throw new Error(`${name} is already set in ${path}; re-run with --force to replace it`);
  }
  const line = `${name}=${value}`;
  const re = new RegExp(`^#?\\s*${name}=.*$`, "m");
  const next = re.test(text) ? text.replace(re, () => line) : `${text.replace(/\n?$/, "\n")}${line}\n`;
  writeFileSync(path, next, { mode: 0o600 });
  chmodSync(path, 0o600);
  return { path, replaced: existing !== undefined };
}

/** Reads one name from another file (e.g. a repo's `.env.local`) without touching `process.env`. */
export function readKeyFrom(file: string, name: KeyName): string | undefined {
  const v = pick(readFileSync(file, "utf8"))[name];
  registerSecret(v);
  return v;
}
