#!/usr/bin/env node
// guide-set.mjs: the user-guides contract. Load, validate and save `guides.json`, and move
// guides and shots through their statuses with the owner each move belongs to.
//
// Both skills carry byte-identical copies of this file and of reference/guide-set.md; a
// plugin test keeps them in step. Node >= 20 built-ins only (installed plugins have no
// node_modules).
//
// CLI:
//   node guide-set.mjs validate <guides.json>       exit 0 when valid, 1 with the errors
//   node guide-set.mjs summary  <guides.json>       counts by status
//   node guide-set.mjs index    <guides.json> <README.md>   regenerate the status block

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCHEMA_VERSION = 1;

export const GUIDE_TYPES = ['role-guide', 'features-and-value', 'getting-started', 'admin-operations'];
export const GUIDE_STATUSES = ['outlined', 'written', 'checked'];
export const SHOT_STATUSES = ['placeholder', 'taken', 'retake', 'blocked', 'needs-text'];
export const SIGN_IN_KINDS = ['cookie-command', 'storage-state', 'form', 'module', 'none'];
export const ACTORS = ['write-guides', 'wiki-guides'];

/** Who owns which part of the file (PLAN §2.3). `shared` means either skill may write it. */
export const FIELD_OWNERS = {
  schemaVersion: 'shared',
  product: 'write-guides',
  app: 'shared',
  interview: 'write-guides',
  notChecked: 'write-guides',
  leftOut: 'write-guides',
  checks: 'write-guides',
  guides: 'write-guides (wiki-guides adds entries when they are absent, by adopting)',
  shots: 'the spec: write-guides; status, takenAt, release, fingerprint: wiki-guides (see SHOT_TRANSITIONS)',
  publish: 'wiki-guides (adopt may seed publish.confluence when it is absent)',
};

/** Guide moves: [from, to, who]. `null` from means a new entry. */
export const GUIDE_TRANSITIONS = [
  [null, 'outlined', ['write-guides']],
  ['outlined', 'written', ['write-guides']],
  ['written', 'checked', ['write-guides']],
  // Any text edit to a checked guide makes it written again: a refresh or a needs-text fix
  // (write-guides), or wiki-guides' fix of a wrong label it saw on screen.
  ['checked', 'written', ['write-guides', 'wiki-guides']],
];

/** Shot moves: [from, to, who]. `null` from means a new entry. */
export const SHOT_TRANSITIONS = [
  [null, 'placeholder', ['write-guides']],
  ['placeholder', 'taken', ['wiki-guides']],
  ['placeholder', 'blocked', ['wiki-guides']],
  ['placeholder', 'needs-text', ['wiki-guides']],
  ['taken', 'retake', ['write-guides']],
  ['retake', 'taken', ['wiki-guides']],
  ['retake', 'blocked', ['wiki-guides']],
  ['retake', 'needs-text', ['wiki-guides']],
  ['needs-text', 'placeholder', ['write-guides']],
  ['needs-text', 'retake', ['write-guides']],
  ['blocked', 'taken', ['wiki-guides']],
];

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ROLE_RE = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
const ENV_RE = /^[A-Z_][A-Z0-9_]*$/;
const FINGERPRINT_RE = /^sha256:[0-9a-f]{64}$/;
const ALT_RE = /^[^:\n]{1,80}: \S[^\n]*$/;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const LOCATOR_ENGINES = new Set(['role', 'css', 'text', 'id', 'data-testid', 'xpath', 'label', 'placeholder', 'alt', 'title']);

export class GuideSetError extends Error {
  constructor(message, errors = []) {
    super(errors.length ? `${message}:\n  - ${errors.join('\n  - ')}` : message);
    this.name = 'GuideSetError';
    this.errors = errors;
  }
}

// ---------------------------------------------------------------------------------------
// Creating, loading and saving

/** A new, empty guide set. */
export function createGuideSet({ name = '', language = 'en-GB', baseUrl = 'http://localhost:3000' } = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    product: { name, language },
    app: { baseUrl, signIn: { kind: 'none' }, accounts: {} },
    interview: { wordingVersion: '', answers: {} },
    notChecked: [],
    leftOut: [],
    checks: { patterns: [] },
    guides: [],
    shots: [],
    publish: {},
  };
}

/** Read and validate a guides.json; throws GuideSetError listing every problem. */
export function loadGuideSet(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    throw new GuideSetError(`cannot read ${file}: ${err.code || err.message}`);
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new GuideSetError(`${file} is not valid JSON: ${err.message}`);
  }
  const { errors } = validateGuideSet(data);
  if (errors.length) throw new GuideSetError(`${file} is not a valid guide set`, errors);
  return data;
}

/** Validate, then write atomically with the keys in contract order, 2-space indent. */
export function saveGuideSet(file, set) {
  const { errors } = validateGuideSet(set);
  if (errors.length) throw new GuideSetError(`refusing to save an invalid guide set to ${file}`, errors);
  const text = JSON.stringify(canonical(set), null, 2) + '\n';
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
  return text;
}

const TOP_ORDER = ['schemaVersion', 'product', 'app', 'interview', 'notChecked', 'leftOut', 'checks', 'guides', 'shots', 'publish'];
const GUIDE_ORDER = ['id', 'type', 'file', 'title', 'audience', 'parent', 'order', 'status'];
const SHOT_ORDER = ['id', 'alt', 'as', 'path', 'target', 'state', 'guides', 'status', 'takenAt', 'release', 'fingerprint', 'note'];

function ordered(obj, order) {
  const out = {};
  for (const k of order) if (obj[k] !== undefined) out[k] = obj[k];
  for (const k of Object.keys(obj)) if (!(k in out) && obj[k] !== undefined) out[k] = obj[k];
  return out;
}

function canonical(set) {
  const out = ordered(set, TOP_ORDER);
  if (Array.isArray(out.guides)) out.guides = out.guides.map((g) => ordered(g, GUIDE_ORDER));
  if (Array.isArray(out.shots)) out.shots = out.shots.map((s) => ordered(s, SHOT_ORDER));
  return out;
}

// ---------------------------------------------------------------------------------------
// Validation

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string';
const nonEmpty = (v) => isStr(v) && v.trim() !== '';

function keysOnly(obj, allowed, where, errors) {
  for (const k of Object.keys(obj)) if (!allowed.includes(k)) errors.push(`${where}: unknown key "${k}"`);
}

/** A path relative to the repo root: forward slashes, no leading slash, no `..`, no `~`. */
export function isRepoRelative(p) {
  if (!nonEmpty(p)) return false;
  if (p.startsWith('/') || p.startsWith('~') || p.includes('\\') || /^[a-zA-Z]:/.test(p)) return false;
  return !p.split('/').some((seg) => seg === '..' || seg === '' || seg === '.');
}

/**
 * The locator syntax for shots[].target.locator: a Playwright selector string. Each part of a
 * `>>` chain is either `engine=body` with a known engine, or a bare CSS selector. A `role=`
 * part is a lowercase ARIA role with optional `[attr]` or `[attr=value]` filters, e.g.
 * `role=button[name="Save"]`, `role=dialog[name="Request leave"] >> role=button[name="Cancel"]`.
 */
export function checkLocator(locator) {
  if (!nonEmpty(locator)) return 'is empty';
  for (const raw of locator.split(/\s+>>\s+/)) {
    const part = raw.trim();
    if (!part) return 'has an empty part in its >> chain';
    const m = part.match(/^([a-z][a-z-]*)=(.*)$/s);
    if (m && !part.startsWith('[')) {
      const [, engine, body] = m;
      if (!LOCATOR_ENGINES.has(engine)) return `uses unknown engine "${engine}="`;
      if (!body.trim()) return `has an empty ${engine}= body`;
      if (engine === 'role' && !/^[a-z]+(\[[a-z-]+(=("([^"\\]|\\.)*"[is]?|[^\]\s]+))?\])*$/.test(body)) {
        return `has a malformed role= part "${part}" (expected e.g. role=button[name="Save"])`;
      }
    }
  }
  return null;
}

function checkUrl(v) {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : null;
  } catch {
    return null;
  }
}

/** Every problem in `set`, as `errors` (invalid) and `warnings` (valid, but worth saying). */
export function validateGuideSet(set) {
  const errors = [];
  const warnings = [];
  if (!isObj(set)) return { errors: ['the guide set must be a JSON object'], warnings };

  keysOnly(set, TOP_ORDER, 'guides.json', errors);
  if (set.schemaVersion !== SCHEMA_VERSION) errors.push(`schemaVersion must be ${SCHEMA_VERSION}`);

  // product
  if (!isObj(set.product)) errors.push('product must be an object');
  else {
    keysOnly(set.product, ['name', 'language'], 'product', errors);
    if (!isStr(set.product.name)) errors.push('product.name must be a string');
    if (!isStr(set.product.language) || !/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(set.product.language)) {
      errors.push('product.language must be a language tag such as en-GB');
    }
  }

  // app
  const roles = validateApp(set.app, errors, warnings);

  // interview
  if (!isObj(set.interview)) errors.push('interview must be an object');
  else {
    keysOnly(set.interview, ['wordingVersion', 'answers'], 'interview', errors);
    if (!isStr(set.interview.wordingVersion)) errors.push('interview.wordingVersion must be a string');
    if (!isObj(set.interview.answers)) errors.push('interview.answers must be an object');
    else {
      for (const [q, a] of Object.entries(set.interview.answers)) {
        const ok = isStr(a) || (Array.isArray(a) && a.every(isStr));
        if (!ok) errors.push(`interview.answers.${q} must be a string or a list of strings (word for word)`);
      }
    }
  }

  // guides
  const guideIds = new Set();
  if (!Array.isArray(set.guides)) errors.push('guides must be a list');
  else {
    set.guides.forEach((g, i) => {
      const at = `guides[${i}]${isObj(g) && isStr(g.id) ? ` (${g.id})` : ''}`;
      if (!isObj(g)) return errors.push(`${at} must be an object`);
      keysOnly(g, GUIDE_ORDER, at, errors);
      if (!isStr(g.id) || !ID_RE.test(g.id)) errors.push(`${at}.id must be kebab-case`);
      else if (guideIds.has(g.id)) errors.push(`${at}.id is a duplicate`);
      else guideIds.add(g.id);
      if (!GUIDE_TYPES.includes(g.type)) errors.push(`${at}.type must be one of ${GUIDE_TYPES.join(', ')}`);
      if (!isRepoRelative(g.file) || !g.file.endsWith('.md')) errors.push(`${at}.file must be a repo-relative .md path`);
      if (!nonEmpty(g.title)) errors.push(`${at}.title must be a non-empty string`);
      if (!Array.isArray(g.audience) || !g.audience.every(isStr)) errors.push(`${at}.audience must be a list of roles`);
      else if (roles) for (const r of g.audience) if (!roles.has(r)) warnings.push(`${at}.audience names "${r}", which is not in app.accounts`);
      if (!(g.parent === '' || isStr(g.parent))) errors.push(`${at}.parent must be a guide id or "" (directly under the top page)`);
      if (!Number.isInteger(g.order)) errors.push(`${at}.order must be an integer`);
      if (!GUIDE_STATUSES.includes(g.status)) errors.push(`${at}.status must be one of ${GUIDE_STATUSES.join(', ')}`);
    });
    const byId = new Map(set.guides.filter(isObj).map((g) => [g.id, g]));
    const files = new Set();
    for (const g of byId.values()) {
      if (g.parent && !byId.has(g.parent)) errors.push(`guides (${g.id}).parent "${g.parent}" is not a guide id`);
      if (isStr(g.file)) {
        if (files.has(g.file)) errors.push(`guides (${g.id}).file "${g.file}" is used by another guide`);
        files.add(g.file);
      }
      // parent cycles
      const seen = new Set([g.id]);
      let p = g.parent;
      while (p && byId.has(p)) {
        if (seen.has(p)) {
          errors.push(`guides (${g.id}) has a parent cycle`);
          break;
        }
        seen.add(p);
        p = byId.get(p).parent;
      }
    }
  }

  // shots
  if (!Array.isArray(set.shots)) errors.push('shots must be a list');
  else {
    const shotIds = new Set();
    set.shots.forEach((s, i) => {
      const at = `shots[${i}]${isObj(s) && isStr(s.id) ? ` (${s.id})` : ''}`;
      if (!isObj(s)) return errors.push(`${at} must be an object`);
      keysOnly(s, SHOT_ORDER, at, errors);
      if (!isStr(s.id) || !ID_RE.test(s.id)) errors.push(`${at}.id must be kebab-case`);
      else if (shotIds.has(s.id)) errors.push(`${at}.id is a duplicate`);
      else shotIds.add(s.id);
      if (!isStr(s.alt) || !ALT_RE.test(s.alt)) errors.push(`${at}.alt must read "Screen: what to notice"`);
      if (!isStr(s.as) || !ROLE_RE.test(s.as)) errors.push(`${at}.as must be a role name`);
      else if (roles && !roles.has(s.as)) warnings.push(`${at}.as "${s.as}" is not in app.accounts`);
      if (!isRepoRelative(s.path)) errors.push(`${at}.path must be repo-relative`);
      if (!isObj(s.target)) errors.push(`${at}.target must be { "what": …, "locator": … }`);
      else {
        keysOnly(s.target, ['what', 'locator'], `${at}.target`, errors);
        if (!nonEmpty(s.target.what)) errors.push(`${at}.target.what must say, in words, what to crop`);
        if (s.target.locator !== null && s.target.locator !== undefined) {
          const bad = isStr(s.target.locator) ? checkLocator(s.target.locator) : 'must be a string or null';
          if (bad) errors.push(`${at}.target.locator ${bad}`);
        }
      }
      if (!isStr(s.state)) errors.push(`${at}.state must be a string ("" when nothing must be true first)`);
      if (!Array.isArray(s.guides) || !s.guides.length || !s.guides.every(isStr)) errors.push(`${at}.guides must list the guide ids that show it`);
      else for (const gid of s.guides) if (!guideIds.has(gid)) errors.push(`${at}.guides names "${gid}", which is not a guide id`);
      if (!SHOT_STATUSES.includes(s.status)) errors.push(`${at}.status must be one of ${SHOT_STATUSES.join(', ')}`);
      if (s.status === 'placeholder' && isStr(s.path) && !s.path.endsWith('.svg')) errors.push(`${at}.path must be the .svg card while the shot is a placeholder`);
      if (s.takenAt !== undefined && (!isStr(s.takenAt) || Number.isNaN(Date.parse(s.takenAt)))) errors.push(`${at}.takenAt must be an ISO date-time`);
      if (s.release !== undefined && !isStr(s.release)) errors.push(`${at}.release must be a string`);
      if (s.fingerprint !== undefined && (!isStr(s.fingerprint) || !FINGERPRINT_RE.test(s.fingerprint))) errors.push(`${at}.fingerprint must be sha256:<64 hex>`);
      if (s.note !== undefined && !isStr(s.note)) errors.push(`${at}.note must be a string`);
      if ((s.status === 'placeholder') && (s.takenAt || s.fingerprint)) errors.push(`${at} is a placeholder but has takenAt or fingerprint`);
    });
  }

  // notChecked, leftOut, checks
  listOf(set.notChecked, 'notChecked', ['guide', 'claim', 'reason'], errors, (e, at) => {
    if (guideIds.size && isStr(e.guide) && !guideIds.has(e.guide)) errors.push(`${at}.guide "${e.guide}" is not a guide id`);
  });
  listOf(set.leftOut, 'leftOut', ['screen', 'role', 'reason'], errors);
  if (!isObj(set.checks)) errors.push('checks must be an object');
  else {
    keysOnly(set.checks, ['patterns'], 'checks', errors);
    if (!Array.isArray(set.checks.patterns)) errors.push('checks.patterns must be a list');
    else set.checks.patterns.forEach((p, i) => {
      if (!nonEmpty(p)) return errors.push(`checks.patterns[${i}] must be a non-empty string`);
      try {
        new RegExp(p, 'i');
      } catch (err) {
        errors.push(`checks.patterns[${i}] is not a valid regular expression: ${err.message}`);
      }
    });
  }

  // publish
  validatePublish(set.publish, guideIds, errors);

  return { errors, warnings };
}

function listOf(list, name, fields, errors, extra) {
  if (!Array.isArray(list)) return errors.push(`${name} must be a list`);
  list.forEach((e, i) => {
    const at = `${name}[${i}]`;
    if (!isObj(e)) return errors.push(`${at} must be an object`);
    keysOnly(e, fields, at, errors);
    for (const f of fields) if (!nonEmpty(e[f])) errors.push(`${at}.${f} must be a non-empty string`);
    if (extra) extra(e, at);
  });
}

/** Returns the set of roles in app.accounts, or null when app is unusable. */
function validateApp(app, errors, warnings) {
  if (!isObj(app)) {
    errors.push('app must be an object');
    return null;
  }
  keysOnly(app, ['baseUrl', 'start', 'reset', 'playwrightFrom', 'signIn', 'accounts'], 'app', errors);
  const u = checkUrl(app.baseUrl);
  if (!u) errors.push('app.baseUrl must be an http(s) URL');
  else if (!LOCAL_HOSTS.has(u.hostname)) warnings.push(`app.baseUrl is not localhost or 127.0.0.1 (${u.hostname}): the user must have confirmed it`);
  for (const k of ['start', 'reset']) if (app[k] !== undefined && !nonEmpty(app[k])) errors.push(`app.${k} must be a non-empty command when present`);
  if (app.playwrightFrom !== undefined && !(app.playwrightFrom === '.' || isRepoRelative(app.playwrightFrom))) {
    errors.push('app.playwrightFrom must be a repo-relative package folder (or ".")');
  }

  const si = app.signIn;
  const kind = isObj(si) ? si.kind : undefined;
  if (!isObj(si)) errors.push('app.signIn must be an object');
  else if (!SIGN_IN_KINDS.includes(kind)) errors.push(`app.signIn.kind must be one of ${SIGN_IN_KINDS.join(', ')}`);
  else {
    const allowed = {
      'cookie-command': ['kind', 'command', 'cookie'],
      'storage-state': ['kind', 'loginUrl'],
      form: ['kind', 'loginUrl', 'fields'],
      module: ['kind', 'module'],
      none: ['kind'],
    }[kind];
    keysOnly(si, allowed, `app.signIn (${kind})`, errors);
    if (kind === 'cookie-command') {
      if (!nonEmpty(si.command)) errors.push('app.signIn.command must be the command that prints a role\'s session cookie value');
      if (!isObj(si.cookie) || !nonEmpty(si.cookie.name)) errors.push('app.signIn.cookie must be { "name": …, "path"?: … }');
      else keysOnly(si.cookie, ['name', 'path'], 'app.signIn.cookie', errors);
    }
    if (kind === 'storage-state' && si.loginUrl !== undefined && !validLoginUrl(si.loginUrl)) errors.push('app.signIn.loginUrl must be a path starting with / or an http(s) URL');
    if (kind === 'form') {
      if (!validLoginUrl(si.loginUrl)) errors.push('app.signIn.loginUrl must be a path starting with / or an http(s) URL');
      if (!isObj(si.fields)) errors.push('app.signIn.fields must be { "username", "password", "submit" } locators');
      else {
        keysOnly(si.fields, ['username', 'password', 'submit'], 'app.signIn.fields', errors);
        for (const f of ['username', 'password', 'submit']) {
          const bad = checkLocator(si.fields[f]);
          if (bad) errors.push(`app.signIn.fields.${f} ${bad}`);
        }
      }
    }
    if (kind === 'module' && !(isRepoRelative(si.module) && /\.(m?js|cjs)$/.test(si.module))) errors.push('app.signIn.module must be a repo-relative .mjs/.js path');
  }

  if (!isObj(app.accounts)) {
    errors.push('app.accounts must be an object of role → account');
    return null;
  }
  const roles = new Set();
  for (const [role, acc] of Object.entries(app.accounts)) {
    const at = `app.accounts.${role}`;
    if (!ROLE_RE.test(role)) errors.push(`${at}: role names are lowercase, e.g. "manager"`);
    roles.add(role);
    if (!isObj(acc)) {
      errors.push(`${at} must be an object`);
      continue;
    }
    keysOnly(acc, ['id', 'label', 'usernameEnv', 'passwordEnv'], at, errors);
    for (const k of ['id', 'label']) if (acc[k] !== undefined && !nonEmpty(acc[k])) errors.push(`${at}.${k} must be a non-empty string`);
    for (const k of ['usernameEnv', 'passwordEnv']) if (acc[k] !== undefined && !(isStr(acc[k]) && ENV_RE.test(acc[k]))) errors.push(`${at}.${k} must name an environment variable (UPPER_SNAKE)`);
    if (kind === 'cookie-command' && !nonEmpty(acc.id)) errors.push(`${at}.id is required: it is passed to the sign-in command as {id}`);
    if (kind === 'form' && !(acc.usernameEnv && acc.passwordEnv)) errors.push(`${at} needs usernameEnv and passwordEnv: the names of the variables that hold its synthetic credentials`);
  }
  if (kind && kind !== 'none' && roles.size === 0) warnings.push('app.accounts is empty: no role can sign in');
  return roles;
}

function validLoginUrl(v) {
  return isStr(v) && (/^\/(?!\/)/.test(v) || !!checkUrl(v));
}

function validatePublish(pub, guideIds, errors) {
  if (!isObj(pub)) return errors.push('publish must be an object ({} until something is published)');
  keysOnly(pub, ['release', 'confluence', 'html'], 'publish', errors);
  if (pub.release !== undefined && !nonEmpty(pub.release)) errors.push('publish.release must be a non-empty string');
  if (pub.html !== undefined) {
    if (!isObj(pub.html)) errors.push('publish.html must be { "outDir": … }');
    else {
      keysOnly(pub.html, ['outDir'], 'publish.html', errors);
      if (!isRepoRelative(pub.html.outDir)) errors.push('publish.html.outDir must be repo-relative');
    }
  }
  const c = pub.confluence;
  if (c === undefined) return;
  if (!isObj(c)) return errors.push('publish.confluence must be an object');
  keysOnly(c, ['baseUrl', 'space', 'topPageId', 'topGuide', 'pages', 'imageCap', 'deviceScale'], 'publish.confluence', errors);
  if (c.baseUrl !== undefined && !checkUrl(c.baseUrl)) errors.push('publish.confluence.baseUrl must be an http(s) URL');
  if (c.space !== undefined && !nonEmpty(c.space)) errors.push('publish.confluence.space must be a space key');
  if (c.topPageId !== undefined && !/^\d+$/.test(String(c.topPageId))) errors.push('publish.confluence.topPageId must be a page id (digits, as a string)');
  if (c.topGuide !== undefined && !(isStr(c.topGuide) && guideIds.has(c.topGuide))) errors.push('publish.confluence.topGuide must be a guide id');
  if (c.imageCap !== undefined && !(Number.isInteger(c.imageCap) && c.imageCap > 0)) errors.push('publish.confluence.imageCap must be a positive integer (pixels)');
  if (c.deviceScale !== undefined && !(typeof c.deviceScale === 'number' && c.deviceScale > 0)) errors.push('publish.confluence.deviceScale must be a positive number');
  if (c.pages !== undefined) {
    if (!isObj(c.pages)) errors.push('publish.confluence.pages must be an object of guide id → { pageId, version }');
    else for (const [gid, pg] of Object.entries(c.pages)) {
      const at = `publish.confluence.pages.${gid}`;
      if (!guideIds.has(gid)) errors.push(`${at}: "${gid}" is not a guide id`);
      if (!isObj(pg)) {
        errors.push(`${at} must be { "pageId": …, "version": … }`);
        continue;
      }
      keysOnly(pg, ['pageId', 'version'], at, errors);
      if (!/^\d+$/.test(String(pg.pageId ?? ''))) errors.push(`${at}.pageId must be a page id (digits, as a string)`);
      if (!(pg.version === null || pg.version === undefined || (Number.isInteger(pg.version) && pg.version > 0))) {
        errors.push(`${at}.version must be the version last published (a positive integer), or null when adopted`);
      }
    }
  }
}

/** Defaults the publisher applies when a key is absent (PLAN §2.5). */
export const CONFLUENCE_DEFAULTS = { imageCap: 640, deviceScale: 2 };

// ---------------------------------------------------------------------------------------
// Status transitions

function allowed(table, from, to, by) {
  const row = table.find(([f, t]) => f === from && t === to);
  if (!row) return `no move from ${from ?? '(new)'} to ${to}`;
  if (!row[2].includes(by)) return `${from ?? '(new)'} → ${to} belongs to ${row[2].join(' or ')}, not ${by}`;
  return null;
}

function actor(by) {
  if (!ACTORS.includes(by)) throw new GuideSetError(`unknown actor "${by}": use ${ACTORS.join(' or ')}`);
  return by;
}

function findById(list, id, what) {
  const item = list.find((x) => x.id === id);
  if (!item) throw new GuideSetError(`no ${what} with id "${id}"`);
  return item;
}

/**
 * Add a guide. write-guides adds new guides at `outlined`. Adopting (either skill, `adopt:
 * true`) registers a guide it did not write at `written`.
 */
export function addGuide(set, guide, { by, adopt = false } = {}) {
  actor(by);
  if (set.guides.some((g) => g.id === guide.id)) throw new GuideSetError(`guide "${guide.id}" already exists`);
  let status;
  if (adopt) status = 'written';
  else {
    const bad = allowed(GUIDE_TRANSITIONS, null, 'outlined', by);
    if (bad) throw new GuideSetError(`cannot add guide "${guide.id}": ${bad}`);
    status = 'outlined';
  }
  const g = { parent: '', order: set.guides.length + 1, audience: [], ...guide, status };
  set.guides.push(g);
  return g;
}

/** Move a guide to `to`, if that move belongs to `by`. */
export function moveGuide(set, id, to, { by } = {}) {
  actor(by);
  const g = findById(set.guides, id, 'guide');
  const bad = allowed(GUIDE_TRANSITIONS, g.status, to, by);
  if (bad) throw new GuideSetError(`guide "${id}": ${bad}`);
  g.status = to;
  return g;
}

/** Any text edit to a checked guide makes it written again (either skill). */
export function markGuideEdited(set, id, { by } = {}) {
  actor(by);
  const g = findById(set.guides, id, 'guide');
  if (g.status === 'checked') moveGuide(set, id, 'written', { by });
  return g;
}

/**
 * Add a shot. write-guides adds new shots at `placeholder`. Adopting (either skill, `adopt:
 * true`) registers an existing image at `taken` with no fingerprint, so the first refresh
 * retakes it.
 */
export function addShot(set, shot, { by, adopt = false } = {}) {
  actor(by);
  if (set.shots.some((s) => s.id === shot.id)) throw new GuideSetError(`shot "${shot.id}" already exists`);
  const s = { state: '', ...shot };
  delete s.fingerprint;
  delete s.takenAt;
  if (adopt) s.status = 'taken';
  else {
    const bad = allowed(SHOT_TRANSITIONS, null, 'placeholder', by);
    if (bad) throw new GuideSetError(`cannot add shot "${shot.id}": ${bad}`);
    s.status = 'placeholder';
  }
  set.shots.push(s);
  return s;
}

/**
 * Move a shot to `to`, if that move belongs to `by`. Moving to `taken` needs `path` (the new
 * image), `takenAt`, `release` and `fingerprint`. `note` records why a shot is blocked or
 * needs text.
 */
export function moveShot(set, id, to, { by, path: newPath, takenAt, release, fingerprint, note } = {}) {
  actor(by);
  const s = findById(set.shots, id, 'shot');
  const bad = allowed(SHOT_TRANSITIONS, s.status, to, by);
  if (bad) throw new GuideSetError(`shot "${id}": ${bad}`);
  if (to === 'taken') {
    const missing = Object.entries({ takenAt, release, fingerprint }).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) throw new GuideSetError(`shot "${id}": taking it needs ${missing.join(', ')}`);
    if (!FINGERPRINT_RE.test(fingerprint)) throw new GuideSetError(`shot "${id}": fingerprint must be sha256:<64 hex>`);
    Object.assign(s, { takenAt, release, fingerprint });
    if (newPath) s.path = newPath;
    delete s.note;
  } else if (to === 'placeholder') {
    if (!newPath || !newPath.endsWith('.svg')) throw new GuideSetError(`shot "${id}": back to placeholder needs the .svg card's path`);
    s.path = newPath;
    delete s.takenAt;
    delete s.release;
    delete s.fingerprint;
    delete s.note;
  } else if (note !== undefined) s.note = note;
  else if (to === 'retake') delete s.note;
  s.status = to;
  return s;
}

/**
 * Refresh's rule (write-guides): a taken shot whose region fingerprint changed, or that has
 * none recorded, goes to retake. Returns true when it was marked.
 */
export function markRetakeIfChanged(set, id, currentFingerprint) {
  const s = findById(set.shots, id, 'shot');
  if (s.status !== 'taken') return false;
  if (s.fingerprint && currentFingerprint && s.fingerprint === currentFingerprint) return false;
  moveShot(set, id, 'retake', { by: 'write-guides' });
  return true;
}

// ---------------------------------------------------------------------------------------
// The README index's status block

export const INDEX_BEGIN = '<!-- user-guides:status:begin -->';
export const INDEX_END = '<!-- user-guides:status:end -->';

/** The status block's markdown, regenerated from the set. Paths are relative to `indexFile`. */
export function statusBlock(set, indexFile = null) {
  const rel = (p) => (indexFile ? path.posix.relative(path.posix.dirname(indexFile), p) || p : p);
  const lines = [INDEX_BEGIN, '', '| Guide | Type | For | Status | Pictures |', '|---|---|---|---|---|'];
  const guides = [...set.guides].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  for (const g of guides) {
    const shots = set.shots.filter((s) => s.guides.includes(g.id));
    const taken = shots.filter((s) => s.status === 'taken').length;
    const pics = shots.length ? `${taken} of ${shots.length} taken` : 'none';
    lines.push(`| [${g.title.replace(/\|/g, '\\|')}](${rel(g.file)}) | ${g.type} | ${g.audience.join(', ') || 'everyone'} | ${g.status} | ${pics} |`);
  }
  if (!guides.length) lines.push('| (no guides yet) | | | | |');
  const nc = set.notChecked.length;
  lines.push('', `Claims not checked against the running app: ${nc}.`, '', INDEX_END);
  return lines.join('\n');
}

/** Replace the status block in a README's text (or append one when it has none). */
export function updateIndex(readmeText, set, indexFile = null) {
  const block = statusBlock(set, indexFile);
  const b = readmeText.indexOf(INDEX_BEGIN);
  const e = readmeText.indexOf(INDEX_END);
  if (b !== -1 && e > b) return readmeText.slice(0, b) + block + readmeText.slice(e + INDEX_END.length);
  return readmeText.replace(/\s*$/, '') + '\n\n' + block + '\n';
}

/** Counts by status, for reports. */
export function summary(set) {
  const count = (list, key) => list.reduce((acc, x) => ((acc[x[key]] = (acc[x[key]] || 0) + 1), acc), {});
  return { guides: count(set.guides, 'status'), shots: count(set.shots, 'status'), notChecked: set.notChecked.length };
}

// ---------------------------------------------------------------------------------------
// CLI

function main(argv) {
  const [cmd, file, readme] = argv;
  if (!cmd || !file || !['validate', 'summary', 'index'].includes(cmd)) {
    console.error('usage: guide-set.mjs validate|summary <guides.json> | index <guides.json> <README.md>');
    return 2;
  }
  let set;
  try {
    set = loadGuideSet(file);
  } catch (err) {
    console.error(err.message);
    return 1;
  }
  if (cmd === 'validate') {
    const { warnings } = validateGuideSet(set);
    for (const w of warnings) console.log(`warning: ${w}`);
    console.log(`${file}: valid (${set.guides.length} guides, ${set.shots.length} shots)`);
  } else if (cmd === 'summary') {
    console.log(JSON.stringify(summary(set), null, 2));
  } else {
    if (!readme) {
      console.error('usage: guide-set.mjs index <guides.json> <README.md>');
      return 2;
    }
    const text = fs.existsSync(readme) ? fs.readFileSync(readme, 'utf8') : '';
    const rel = path.relative(process.cwd(), path.resolve(readme)).split(path.sep).join('/');
    fs.writeFileSync(readme, updateIndex(text, set, rel));
    console.log(`${readme}: status block regenerated`);
  }
  return 0;
}

// Compare real paths: called through a symlink (macOS's /var → /private/var), argv[1] differs.
if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
