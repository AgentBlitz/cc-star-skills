// kit-core.mjs: what both skills need to reach a local app (PLAN R12).
//
//   1. Finding Playwright, in D10's order: the project's own dependency (app.playwrightFrom),
//      then USER_GUIDES_PLAYWRIGHT_CORE, then ${XDG_CACHE_HOME:-~/.cache}/user-guides/pw-<version>.
//      The cache is filled only after asking, and never in a headless run.
//   2. Signing a role in, for the five sign-in kinds of guides.json (`app.signIn`). A sign-in
//      value is never printed or stored, except a storage-state file: mode 600 under
//      .user-guides/auth/.
//   3. Reading a screen: a small, dependency-free HTML reader that finds headings, controls and
//      named regions, resolves the locators of `shots[].target`, and computes D3's fingerprint.
//      A browser walk passes it the live DOM (page.content()), a fetch walk the served HTML, so
//      both give the same answer for the same markup.
//
// Both skills carry byte-identical copies of this file; a plugin test keeps them in step.
// Node >= 20 built-ins only (installed plugins have no node_modules).

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const PW_VERSION = '1.63.0';
export const WORK_DIR = '.user-guides';

// ---------------------------------------------------------------------------------------
// 1. Playwright

/** `${XDG_CACHE_HOME:-~/.cache}/user-guides/pw-<version>` */
export function pwCacheDir(env = process.env) {
  const base = env.XDG_CACHE_HOME || path.join(env.HOME || os.homedir(), '.cache');
  return path.join(base, 'user-guides', `pw-${PW_VERSION}`);
}

function versionOf(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version ?? null;
  } catch {
    return null;
  }
}

/**
 * Where Playwright is, or null. `root` is the project root; `playwrightFrom` its package folder
 * (e.g. `apps/web`). Returns { dir, source, version } where `dir` is a package folder that
 * exports `chromium` (playwright-core, playwright or @playwright/test).
 */
export function findPlaywright({ root = '.', playwrightFrom, env = process.env } = {}) {
  if (playwrightFrom) {
    const req = createRequire(path.join(path.resolve(root, playwrightFrom), 'package.json'));
    for (const name of ['playwright-core', 'playwright', '@playwright/test']) {
      try {
        const dir = path.dirname(req.resolve(`${name}/package.json`));
        return { dir, source: `the project (${playwrightFrom}, ${name})`, version: versionOf(dir) };
      } catch {
        // not this one
      }
    }
  }
  const fromEnv = env.USER_GUIDES_PLAYWRIGHT_CORE;
  if (fromEnv && fs.existsSync(path.join(fromEnv, 'package.json'))) return { dir: fromEnv, source: 'USER_GUIDES_PLAYWRIGHT_CORE', version: versionOf(fromEnv) };
  const cached = path.join(pwCacheDir(env), 'node_modules', 'playwright-core');
  if (fs.existsSync(path.join(cached, 'package.json'))) return { dir: cached, source: 'the user-guides cache', version: versionOf(cached) };
  return null;
}

/** The command that fills the cache. Print it; run it only after the user says yes. */
export function installCommand(env = process.env) {
  return `npm install --prefix "${pwCacheDir(env)}" --ignore-scripts --no-audit --no-fund playwright-core@${PW_VERSION}`;
}

/** Fill the cache. Callers ask first; a headless run never calls this. */
export function installPlaywright({ headless = false, env = process.env } = {}) {
  if (headless) throw new Error(`a headless run never installs Playwright. To install it, run:\n  ${installCommand(env)}`);
  const prefix = pwCacheDir(env);
  fs.mkdirSync(prefix, { recursive: true });
  execFileSync('npm', ['install', '--prefix', prefix, '--ignore-scripts', '--no-audit', '--no-fund', `playwright-core@${PW_VERSION}`], { stdio: ['ignore', 'inherit', 'inherit'] });
  return findPlaywright({ env });
}

/** Import Playwright from a found package folder; returns the module (with `chromium`). */
export async function loadPlaywright(found) {
  const req = createRequire(path.join(found.dir, 'package.json'));
  const entry = req.resolve(found.dir);
  const mod = await import(pathToFileURL(entry).href);
  const pw = mod.chromium ? mod : mod.default;
  if (!pw?.chromium) throw new Error(`no chromium export in ${found.dir}`);
  return pw;
}

// ---------------------------------------------------------------------------------------
// 2. Signing in

/** The account settings for a role, or an error naming what is missing. */
export function accountFor(set, role) {
  const acc = set.app?.accounts?.[role];
  if (!acc) throw new Error(`no account for role "${role}" in app.accounts`);
  return acc;
}

/** `.user-guides/auth/<role>.json`, under the project root. */
export function storageStateFile(root, role) {
  return path.join(root, WORK_DIR, 'auth', `${role}.json`);
}

/** Write a secret file: directory 700, file 600, atomically. Nothing is printed from it. */
export function writeSecret(file, body) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.chmodSync(dir, 0o700);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, body, { mode: 0o600 });
  fs.chmodSync(tmp, 0o600);
  fs.renameSync(tmp, file);
}

const shQuote = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

/**
 * cookie-command: run the command (with {id} and {role}) from the project root and return the
 * cookie value it prints. The value and the command's output are never logged.
 */
export function cookieFromCommand({ root = '.', signIn, role, account, env = process.env }) {
  const cmd = signIn.command.replace(/\{id\}/g, shQuote(account.id ?? '')).replace(/\{role\}/g, shQuote(role));
  const r = spawnSync('/bin/sh', ['-c', cmd], { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (r.status !== 0) {
    const why = (r.stderr || '').split('\n').filter(Boolean).slice(-1)[0] || `exit ${r.status}`;
    throw new Error(`sign-in command for ${role} failed (${why.slice(0, 200)})`);
  }
  const value = (r.stdout || '').trim().split('\n').pop()?.trim();
  if (!value) throw new Error(`sign-in command for ${role} printed nothing`);
  return value;
}

function credentials(account, role, env) {
  const user = env[account.usernameEnv];
  const pass = env[account.passwordEnv];
  const missing = [[account.usernameEnv, user], [account.passwordEnv, pass]].filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`form sign-in for ${role} needs ${missing.join(' and ')} set (synthetic credentials only)`);
  return { user, pass };
}

const absUrl = (baseUrl, u) => new URL(u, baseUrl).href;

/**
 * Sign a role in to a Playwright browser context. `headless` refuses anything that needs a
 * person: a storage-state sign-in that has not been saved yet.
 */
export async function signInContext({ context, set, role, root = '.', env = process.env }) {
  const si = set.app.signIn;
  const account = accountFor(set, role);
  const baseUrl = set.app.baseUrl;
  const host = new URL(baseUrl).hostname;
  switch (si.kind) {
    case 'none':
      return;
    case 'cookie-command': {
      const value = cookieFromCommand({ root, signIn: si, role, account, env });
      await context.addCookies([{ name: si.cookie.name, value, domain: host, path: si.cookie.path || '/' }]);
      return;
    }
    case 'storage-state':
      return; // the context was created from the saved state (browserContextOptions)
    case 'form': {
      const { user, pass } = credentials(account, role, env);
      const page = await context.newPage();
      await page.goto(absUrl(baseUrl, si.loginUrl));
      await page.locator(si.fields.username).fill(user);
      await page.locator(si.fields.password).fill(pass);
      await Promise.all([page.waitForLoadState('load'), page.locator(si.fields.submit).click()]);
      await page.close();
      return;
    }
    case 'module': {
      const mod = await import(pathToFileURL(path.resolve(root, si.module)).href);
      if (typeof mod.signIn !== 'function') throw new Error(`${si.module} must export signIn({ role, account, baseUrl, context })`);
      await mod.signIn({ role, account, baseUrl, context });
      return;
    }
    default:
      throw new Error(`unknown sign-in kind ${si.kind}`);
  }
}

/** Options for browser.newContext(): the saved state for storage-state sign-ins. */
export function browserContextOptions({ set, role, root = '.', headless = false }) {
  if (set.app.signIn.kind !== 'storage-state') return {};
  const file = storageStateFile(root, role);
  if (!fs.existsSync(file)) {
    const how = 'run `node <skill dir>/scripts/walk-lib.mjs sign-in --role ' + role + '` in an interactive session and sign in by hand';
    throw new Error(headless ? `no saved sign-in for ${role}; a headless run cannot sign in by hand (${how})` : `no saved sign-in for ${role}: ${how}`);
  }
  return { storageState: file };
}

/**
 * storage-state: open a headed browser on the sign-in page; when the user closes the window,
 * save the state to .user-guides/auth/<role>.json (mode 600). Never in a headless run.
 */
export async function captureStorageState({ pw, set, role, root = '.', headless = false, say = console.log }) {
  if (headless) throw new Error('a headless run cannot sign in by hand');
  const si = set.app.signIn;
  const browser = await pw.chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(absUrl(set.app.baseUrl, si.loginUrl || '/'));
  say(`sign in as the ${role} account in the browser window, then close the window`);
  let state = null;
  const grab = async () => {
    try {
      state = JSON.stringify(await context.storageState());
    } catch {
      // closing
    }
  };
  const timer = setInterval(() => void grab(), 1000);
  await new Promise((resolve) => {
    page.on('close', resolve);
    browser.on('disconnected', resolve);
  });
  clearInterval(timer);
  await browser.close().catch(() => {});
  if (!state) throw new Error('no sign-in was recorded');
  const file = storageStateFile(root, role);
  writeSecret(file, state);
  return file;
}

/** A tiny cookie jar for fetch walks: name → value, for one host. */
export class CookieJar {
  constructor() {
    this.map = new Map();
  }
  set(name, value) {
    if (value === '' || value === undefined) this.map.delete(name);
    else this.map.set(name, value);
  }
  absorb(res) {
    const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    for (const line of list) {
      const [pair, ...attrs] = line.split(';');
      const eq = pair.indexOf('=');
      if (eq < 1) continue;
      const name = pair.slice(0, eq).trim();
      const expired = attrs.some((a) => /^\s*max-age\s*=\s*0\s*$/i.test(a));
      this.set(name, expired ? '' : pair.slice(eq + 1).trim());
    }
  }
  header() {
    return [...this.map].map(([k, v]) => `${k}=${v}`).join('; ');
  }
  addCookies(list) {
    for (const c of list) this.set(c.name, c.value);
  }
}

/** A fetch that keeps cookies and follows redirects itself (so Set-Cookie on a 302 counts). */
export async function jarFetch(jar, url, { method = 'GET', headers = {}, body, maxRedirects = 5 } = {}) {
  let u = url;
  let m = method;
  let b = body;
  for (let i = 0; i <= maxRedirects; i++) {
    const h = { ...headers };
    const c = jar.header();
    if (c) h.cookie = c;
    const res = await fetch(u, { method: m, headers: h, body: b, redirect: 'manual' });
    jar.absorb(res);
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      u = new URL(res.headers.get('location'), u).href;
      if (res.status !== 307 && res.status !== 308) {
        m = 'GET';
        b = undefined;
        delete headers['content-type'];
      }
      continue;
    }
    return { res, url: u };
  }
  throw new Error(`too many redirects from ${url}`);
}

/** Sign a role in for a fetch walk: returns a CookieJar. */
export async function signInJar({ set, role, root = '.', env = process.env, headless = false }) {
  const si = set.app.signIn;
  const account = accountFor(set, role);
  const baseUrl = set.app.baseUrl;
  const jar = new CookieJar();
  switch (si.kind) {
    case 'none':
      return jar;
    case 'cookie-command':
      jar.set(si.cookie.name, cookieFromCommand({ root, signIn: si, role, account, env }));
      return jar;
    case 'storage-state': {
      const { storageState } = browserContextOptions({ set, role, root, headless });
      const host = new URL(baseUrl).hostname;
      const state = JSON.parse(fs.readFileSync(storageState, 'utf8'));
      for (const c of state.cookies || []) if (String(c.domain).replace(/^\./, '') === host) jar.set(c.name, c.value);
      return jar;
    }
    case 'form': {
      const { user, pass } = credentials(account, role, env);
      const loginUrl = absUrl(baseUrl, si.loginUrl);
      const { res, url } = await jarFetch(jar, loginUrl);
      const doc = parseHtml(await res.text());
      const field = (loc, what) => {
        const el = queryLocator(doc, loc);
        if (!el) throw new Error(`form sign-in: no ${what} field for ${loc} on ${si.loginUrl}`);
        return el;
      };
      const uEl = field(si.fields.username, 'username');
      const pEl = field(si.fields.password, 'password');
      const form = ancestor(uEl, 'form');
      if (!form) throw new Error(`form sign-in: the username field on ${si.loginUrl} is not in a form`);
      const params = new URLSearchParams();
      for (const el of descendants(form)) {
        if (!['input', 'select', 'textarea'].includes(el.tag) || !el.attrs.name) continue;
        if (el === uEl) params.set(el.attrs.name, user);
        else if (el === pEl) params.set(el.attrs.name, pass);
        else if (!['submit', 'button', 'image', 'checkbox', 'radio'].includes((el.attrs.type || '').toLowerCase())) params.set(el.attrs.name, el.attrs.value ?? '');
      }
      const action = absUrl(url, form.attrs.action || url);
      await jarFetch(jar, action, { method: (form.attrs.method || 'post').toUpperCase(), headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: params.toString() });
      return jar;
    }
    case 'module': {
      const mod = await import(pathToFileURL(path.resolve(root, si.module)).href);
      if (typeof mod.signIn !== 'function') throw new Error(`${si.module} must export signIn({ role, account, baseUrl, context })`);
      // A fetch walk passes a context that only takes cookies; a module that drives a page needs a browser.
      await mod.signIn({ role, account, baseUrl, context: { addCookies: async (list) => jar.addCookies(list), baseUrl } });
      return jar;
    }
    default:
      throw new Error(`unknown sign-in kind ${si.kind}`);
  }
}

// ---------------------------------------------------------------------------------------
// 3. Reading a screen

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'textarea', 'title']);
const BLOCK = new Set(['address', 'article', 'aside', 'blockquote', 'details', 'dialog', 'div', 'dl', 'fieldset', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'ul']);
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', copy: '©', times: '×', rarr: '→', larr: '←', bull: '•' };

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function closesP(tag) {
  return BLOCK.has(tag) || tag === 'li';
}

/** Parse HTML into { tag: '#document', children } with element nodes { tag, attrs, children, parent }. */
export function parseHtml(html) {
  const doc = { tag: '#document', attrs: {}, children: [], parent: null };
  const stack = [doc];
  const top = () => stack[stack.length - 1];
  const re = /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/gi;
  let last = 0;
  let m;
  const text = (t) => {
    if (t) top().children.push({ text: decodeEntities(t), parent: top() });
  };
  while ((m = re.exec(html))) {
    text(html.slice(last, m.index));
    last = re.lastIndex;
    if (m[0].startsWith('<!')) continue;
    if (m[1]) {
      const tag = m[1].toLowerCase();
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }
    const tag = m[2].toLowerCase();
    const attrs = {};
    const ar = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let a;
    while ((a = ar.exec(m[3] || ''))) attrs[a[1].toLowerCase()] = decodeEntities(a[2] ?? a[3] ?? a[4] ?? '');
    // implied end tags
    if (top().tag === 'p' && closesP(tag)) stack.pop();
    if (tag === 'li' || tag === 'option' || tag === 'tr' || tag === 'td' || tag === 'th' || tag === 'dt' || tag === 'dd') {
      const peers = { li: ['li'], option: ['option'], tr: ['tr', 'td', 'th'], td: ['td', 'th'], th: ['td', 'th'], dt: ['dt', 'dd'], dd: ['dt', 'dd'] }[tag];
      for (let i = stack.length - 1; i > 0; i--) {
        if (peers.includes(stack[i].tag)) {
          stack.length = i;
          break;
        }
        if (['ul', 'ol', 'table', 'tbody', 'thead', 'select', 'dl'].includes(stack[i].tag)) break;
      }
    }
    const el = { tag, attrs, children: [], parent: top() };
    top().children.push(el);
    if (VOID.has(tag) || m[4] === '/') continue;
    if (RAW.has(tag)) {
      const end = html.toLowerCase().indexOf(`</${tag}`, last);
      const stop = end === -1 ? html.length : end;
      const raw = html.slice(last, stop);
      if (raw) el.children.push({ text: tag === 'script' || tag === 'style' ? raw : decodeEntities(raw), parent: el });
      const close = html.indexOf('>', stop);
      last = re.lastIndex = close === -1 ? html.length : close + 1;
      continue;
    }
    stack.push(el);
  }
  text(html.slice(last));
  return doc;
}

export function* descendants(node) {
  for (const c of node.children || []) {
    if (c.tag) {
      yield c;
      yield* descendants(c);
    }
  }
}

function ancestor(node, tag) {
  for (let p = node.parent; p; p = p.parent) if (p.tag === tag) return p;
  return null;
}

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** Not shown: hidden, aria-hidden, a closed <dialog>, <template>, scripts, hidden inputs. */
export function isHidden(el) {
  if (!el.tag) return false;
  if (['script', 'style', 'template', 'noscript', 'head', 'meta', 'link'].includes(el.tag)) return true;
  if ('hidden' in el.attrs || el.attrs['aria-hidden'] === 'true') return true;
  if (el.tag === 'dialog' && !('open' in el.attrs)) return true;
  if (el.tag === 'input' && (el.attrs.type || '').toLowerCase() === 'hidden') return true;
  return false;
}

export function visible(el) {
  for (let n = el; n && n.tag !== '#document'; n = n.parent) if (isHidden(n)) return false;
  return true;
}

function rawText(node) {
  if (node.text !== undefined) return node.text;
  if (isHidden(node)) return '';
  if (node.tag === 'img') return node.attrs.alt || '';
  if (node.tag === 'br') return ' ';
  return (node.children || []).map(rawText).join('');
}

function root(node) {
  let n = node;
  while (n.parent) n = n.parent;
  return n;
}

function byId(doc, id) {
  for (const el of descendants(doc)) if (el.attrs.id === id) return el;
  return null;
}

const INPUT_ROLES = { checkbox: 'checkbox', radio: 'radio', submit: 'button', button: 'button', reset: 'button', image: 'button', range: 'slider', number: 'spinbutton', search: 'searchbox' };

/** The element's ARIA role (explicit, else implicit), or ''. */
export function roleOf(el, shallow = false) {
  if (!el.tag) return '';
  if (el.attrs.role) return el.attrs.role.trim().split(/\s+/)[0];
  const t = el.tag;
  if (t === 'a') return 'href' in el.attrs ? 'link' : '';
  if (t === 'button') return 'button';
  if (t === 'input') return INPUT_ROLES[(el.attrs.type || 'text').toLowerCase()] ?? 'textbox';
  if (t === 'textarea') return 'textbox';
  if (t === 'select') return 'multiple' in el.attrs || Number(el.attrs.size) > 1 ? 'listbox' : 'combobox';
  if (/^h[1-6]$/.test(t)) return 'heading';
  if (t === 'dialog') return 'dialog';
  if (t === 'nav') return 'navigation';
  if (t === 'main') return 'main';
  if (t === 'aside') return 'complementary';
  if (t === 'header' || t === 'footer') {
    const scoped = ['article', 'aside', 'main', 'nav', 'section'].some((s) => ancestor(el, s));
    return scoped ? '' : t === 'header' ? 'banner' : 'contentinfo';
  }
  if (t === 'section') return !shallow && accessibleName(el) ? 'region' : '';
  if (t === 'form') return !shallow && accessibleName(el) ? 'form' : '';
  if (t === 'table') return 'table';
  if (t === 'ul' || t === 'ol') return 'list';
  if (t === 'li') return 'listitem';
  if (t === 'img') return el.attrs.alt === '' ? 'presentation' : 'img';
  if (t === 'fieldset') return 'group';
  if (t === 'option') return 'option';
  return '';
}

const NAME_FROM_CONTENT = new Set(['button', 'link', 'heading', 'checkbox', 'radio', 'tab', 'menuitem', 'option', 'switch', 'cell', 'columnheader', 'rowheader', 'listitem', 'status']);

/** A simplified accessible name: aria-labelledby, aria-label, labels, content, title, placeholder. */
export function accessibleName(el) {
  const a = el.attrs;
  if (a['aria-labelledby']) {
    const doc = root(el);
    const s = a['aria-labelledby'].split(/\s+/).map((id) => byId(doc, id)).filter(Boolean).map(rawText).join(' ');
    if (norm(s)) return norm(s);
  }
  if (norm(a['aria-label'])) return norm(a['aria-label']);
  const t = el.tag;
  if (t === 'input' || t === 'select' || t === 'textarea') {
    const type = (a.type || '').toLowerCase();
    if (t === 'input' && ['submit', 'button', 'reset'].includes(type)) return norm(a.value || (type === 'submit' ? 'Submit' : type === 'reset' ? 'Reset' : ''));
    if (t === 'input' && type === 'image') return norm(a.alt || 'Submit');
    let label = '';
    if (a.id) for (const l of descendants(root(el))) if (l.tag === 'label' && l.attrs.for === a.id) label += ' ' + rawText(l);
    const wrap = ancestor(el, 'label');
    if (!norm(label) && wrap) label = labelTextWithout(wrap, el);
    if (norm(label)) return norm(label);
    return norm(a.title || a.placeholder || '');
  }
  if (t === 'img') return norm(a.alt || a.title || '');
  const role = roleOf(el, true);
  if (NAME_FROM_CONTENT.has(role) || /^h[1-6]$/.test(t)) {
    const s = norm(rawText(el));
    if (s) return s;
  }
  return norm(a.title || '');
}

function labelTextWithout(label, control) {
  const parts = [];
  const walk = (n) => {
    if (n === control) return;
    if (n.text !== undefined) parts.push(n.text);
    else if (!isHidden(n) && !['select', 'textarea'].includes(n.tag)) (n.children || []).forEach(walk);
  };
  walk(label);
  return parts.join('');
}

export const CONTROL_ROLES = new Set(['button', 'link', 'checkbox', 'radio', 'textbox', 'searchbox', 'combobox', 'listbox', 'switch', 'tab', 'menuitem', 'slider', 'spinbutton']);
export const REGION_ROLES = new Set(['region', 'dialog', 'alertdialog', 'navigation', 'form', 'search', 'complementary', 'main', 'banner', 'contentinfo', 'table']);

/** The text a person reads in a node, a line per block, hidden parts left out. */
export function textOf(node) {
  const lines = [];
  let cur = '';
  const flush = () => {
    if (norm(cur)) lines.push(norm(cur));
    cur = '';
  };
  const walk = (n) => {
    if (n.text !== undefined) {
      cur += n.text;
      return;
    }
    if (isHidden(n)) return;
    if (n.tag === 'title') return;
    if (n.tag === 'img') {
      if (n.attrs.alt) cur += n.attrs.alt;
      return;
    }
    if (n.tag === 'input' || n.tag === 'select' || n.tag === 'textarea') {
      const type = (n.attrs.type || '').toLowerCase();
      if (['submit', 'button', 'reset'].includes(type)) cur += ` ${accessibleName(n)} `;
      else if (n.tag === 'select') {
        const sel = (n.children || []).filter((c) => c.tag === 'option');
        const chosen = sel.find((o) => 'selected' in o.attrs) || sel[0];
        if (chosen) cur += ` ${norm(rawText(chosen))} `;
      }
      return;
    }
    const block = BLOCK.has(n.tag) || ['li', 'tr', 'br', 'dt', 'dd', 'label', 'option', 'caption'].includes(n.tag);
    if (block) flush();
    const inline = n.tag === 'a' || n.tag === 'button';
    if (inline) cur += ' ';
    (n.children || []).forEach(walk);
    if (inline) cur += ' ';
    if (n.tag === 'td' || n.tag === 'th') cur += ' | ';
    if (block) flush();
  };
  walk(node);
  flush();
  return lines.join('\n');
}

/** Quote a name for a role locator. */
const q = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** The best locator for an element: a role and name, else a data-region / test id / id. */
export function suggestLocator(el) {
  const role = roleOf(el);
  const name = accessibleName(el);
  if (el.attrs['data-region']) return `css=[data-region=${q(el.attrs['data-region'])}]`;
  if (el.attrs['data-testid']) return `data-testid=${el.attrs['data-testid']}`;
  if (role && name) return `role=${role}[name=${q(name)}]`;
  if (el.attrs.id) return `id=${el.attrs.id}`;
  if (role) return `role=${role}`;
  return null;
}

/**
 * What a region shows: its headings and controls (in document order), and the named regions
 * inside it. Hidden parts are left out.
 */
export function structureOf(node) {
  const headings = [];
  const controls = [];
  const regions = [];
  const walk = (n) => {
    if (!n.tag || isHidden(n)) return;
    const role = roleOf(n);
    if (role === 'heading' && n.tag !== '#document') headings.push({ level: Number(n.attrs['aria-level'] || n.tag.slice(1)) || 2, text: accessibleName(n) });
    if (CONTROL_ROLES.has(role)) controls.push({ role, name: accessibleName(n) });
    if (n !== node && REGION_ROLES.has(role)) {
      const name = accessibleName(n);
      if (name || n.attrs['data-region']) regions.push({ role, name, el: n });
    }
    (n.children || []).forEach(walk);
  };
  walk(node);
  return { headings, controls, regions };
}

/** D3's normalisation: dates, then times, then numbers, and whitespace. */
const MONTH = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DAY = '(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)';
const DATE_RES = [
  /\b\d{4}-\d{2}-\d{2}(?:[t ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:z|[+-]\d{2}:?\d{2})?)?\b/gi,
  /\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b/g,
  new RegExp(`\\b(?:${DAY},?\\s+)?\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH}\\b\\.?(?:,?\\s+\\d{4})?`, 'gi'),
  new RegExp(`\\b(?:${DAY},?\\s+)?${MONTH}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?\\b`, 'gi'),
  new RegExp(`\\b${MONTH}\\s+\\d{4}\\b`, 'gi'),
  new RegExp(`\\b${DAY}\\b`, 'gi'),
  /\b\d{1,2}:\d{2}(?::\d{2})?(?:\s?[ap]\.?m\.?)?\b/gi,
];

export function normaliseText(s) {
  let t = norm(s);
  for (const re of DATE_RES) t = t.replace(re, '<date>');
  return t.replace(/\d+(?:[.,]\d+)*/g, '#');
}

/**
 * A screen's names, as a guide would call it: the page title before its site suffix
 * ("Requests · Leave Planner" → "Requests"), without a leading count that many apps put in the
 * title ("(3) Inbox" → "Inbox"), and the screen's h1.
 */
export function screenNames({ title = '', h1 = '' } = {}) {
  const fromTitle = title.split(/\s+[·|–—-]\s+/)[0].replace(/^\(\d+\+?\)\s*/, '');
  return [...new Set([fromTitle, h1].filter(Boolean))];
}

/**
 * D3's fingerprint: a pure function of a region's headings and control names, with numbers and
 * dates normalised, then hashed. Returns `sha256:<64 hex>`.
 */
export function fingerprint({ headings = [], controls = [] }) {
  const body = JSON.stringify({
    h: headings.map((h) => normaliseText(typeof h === 'string' ? h : h.text)),
    c: controls.map((c) => `${c.role}:${normaliseText(c.name)}`),
  });
  return 'sha256:' + sha256Hex(body);
}

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/**
 * SHA-256 of a string's UTF-8 bytes, as 64 hex digits, in plain JavaScript (FIPS 180-4). The kit
 * imports no crypto module: it is copied into projects, and some allow cryptography in one place
 * only. A fingerprint is a checksum, not cryptography. The tests hold it to node:crypto's answer.
 */
export function sha256Hex(text) {
  const msg = new TextEncoder().encode(text);
  const total = Math.ceil((msg.length + 9) / 64) * 64;
  const buf = new Uint8Array(total);
  buf.set(msg);
  buf[msg.length] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(total - 8, Math.floor(msg.length / 0x20000000));
  view.setUint32(total - 4, (msg.length * 8) >>> 0);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = w[i - 16] + s0 + w[i - 7] + s1;
    }
    let [a, b, c, d, e, f, g, k] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (k + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + SHA256_K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      k = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += k;
  }
  return Array.from(h, (x) => x.toString(16).padStart(8, '0')).join('');
}

// --- Locators (R8's syntax: Playwright selector strings) --------------------------------

function parseRolePart(body) {
  const m = body.match(/^([a-z]+)((?:\[[^\]]*\])*)$/i);
  if (!m) return null;
  const out = { role: m[1].toLowerCase(), name: null, exact: false, level: null };
  for (const [, inner] of m[2].matchAll(/\[([^\]]*)\]/g)) {
    const nm = inner.match(/^name\s*=\s*"((?:[^"\\]|\\.)*)"([si])?$/) || inner.match(/^name\s*=\s*'((?:[^'\\]|\\.)*)'([si])?$/);
    if (nm) {
      out.name = nm[1].replace(/\\(.)/g, '$1');
      out.exact = nm[2] === 's';
      continue;
    }
    const lv = inner.match(/^level\s*=\s*(\d)$/);
    if (lv) out.level = Number(lv[1]);
  }
  return out;
}

function matchName(actual, want, exact) {
  if (want === null) return true;
  return exact ? actual === want : actual.toLowerCase().includes(want.toLowerCase());
}

// A small CSS subset: compound selectors (tag, #id, .class, [attr], [attr=v], [attr^=|$=|*=v])
// joined by descendant (space) or child (>) combinators, and comma lists.
function parseCompound(s) {
  const out = { tag: null, id: null, classes: [], attrs: [] };
  const re = /^([a-z][\w-]*|\*)|#([\w-]+)|\.([\w-]+)|\[\s*([\w-]+)\s*(?:([~^$*|]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+)))?\s*\]/gi;
  let m;
  let pos = 0;
  re.lastIndex = 0;
  while ((m = re.exec(s))) {
    if (m.index !== pos) return null;
    pos = re.lastIndex;
    if (m[1]) out.tag = m[1] === '*' ? null : m[1].toLowerCase();
    else if (m[2]) out.id = m[2];
    else if (m[3]) out.classes.push(m[3]);
    else out.attrs.push({ name: m[4].toLowerCase(), op: m[5] || null, value: m[6] ?? m[7] ?? m[8] ?? null });
  }
  return pos === s.length && pos > 0 ? out : null;
}

function matchesCompound(el, c) {
  if (c.tag && el.tag !== c.tag) return false;
  if (c.id && el.attrs.id !== c.id) return false;
  const cls = (el.attrs.class || '').split(/\s+/);
  for (const k of c.classes) if (!cls.includes(k)) return false;
  for (const a of c.attrs) {
    const v = el.attrs[a.name];
    if (v === undefined) return false;
    if (!a.op) continue;
    if (a.op === '=' && v !== a.value) return false;
    if (a.op === '^=' && !v.startsWith(a.value)) return false;
    if (a.op === '$=' && !v.endsWith(a.value)) return false;
    if (a.op === '*=' && !v.includes(a.value)) return false;
    if (a.op === '~=' && !v.split(/\s+/).includes(a.value)) return false;
    if (a.op === '|=' && !(v === a.value || v.startsWith(a.value + '-'))) return false;
  }
  return true;
}

function parseCss(sel) {
  const alts = [];
  for (const part of sel.split(',')) {
    const tokens = part.trim().replace(/\s*>\s*/g, ' > ').split(/\s+/).filter(Boolean);
    const steps = [];
    let comb = ' ';
    for (const t of tokens) {
      if (t === '>') {
        comb = '>';
        continue;
      }
      const c = parseCompound(t);
      if (!c) return null;
      steps.push({ comb, c });
      comb = ' ';
    }
    if (!steps.length) return null;
    alts.push(steps);
  }
  return alts;
}

function matchesCss(el, steps, scope) {
  let i = steps.length - 1;
  if (!matchesCompound(el, steps[i].c)) return false;
  let node = el;
  while (i > 0) {
    const comb = steps[i].comb;
    i--;
    if (comb === '>') {
      node = node.parent;
      if (!node || node === scope?.parent || !node.tag || !matchesCompound(node, steps[i].c)) return false;
    } else {
      let p = node.parent;
      while (p && p.tag && p !== scope?.parent && !matchesCompound(p, steps[i].c)) p = p.parent;
      if (!p || !p.tag || p === scope?.parent) return false;
      node = p;
    }
  }
  return true;
}

function partMatcher(part) {
  const eq = part.match(/^([a-z-]+)=([\s\S]*)$/i);
  const engine = eq ? eq[1].toLowerCase() : null;
  const body = eq ? eq[2].trim() : part.trim();
  const unq = (s) => {
    const m = s.match(/^"((?:[^"\\]|\\.)*)"([si])?$/) || s.match(/^'((?:[^'\\]|\\.)*)'([si])?$/);
    return m ? { v: m[1].replace(/\\(.)/g, '$1'), exact: m[2] !== 'i' } : { v: s, exact: false };
  };
  if (engine === 'role') {
    const r = parseRolePart(body);
    if (!r) return null;
    return (el) => roleOf(el) === r.role && (r.level === null || Number(el.tag.slice(1)) === r.level) && matchName(accessibleName(el), r.name, r.exact);
  }
  if (engine === 'text') {
    const { v, exact } = unq(body);
    return (el) => {
      if (!el.tag || ['html', 'body', 'main'].includes(el.tag)) return false;
      const t = norm(rawText(el));
      if (!(exact ? t === v : t.toLowerCase().includes(v.toLowerCase()))) return false;
      // the innermost element holding the text
      return !(el.children || []).some((c) => c.tag && (exact ? norm(rawText(c)) === v : norm(rawText(c)).toLowerCase().includes(v.toLowerCase())));
    };
  }
  const attrEngines = { id: 'id', 'data-testid': 'data-testid', placeholder: 'placeholder', alt: 'alt', title: 'title' };
  if (engine in attrEngines) {
    const { v, exact } = unq(body);
    const attr = attrEngines[engine];
    return (el) => el.attrs[attr] !== undefined && (engine === 'id' || exact ? el.attrs[attr] === v : el.attrs[attr].toLowerCase().includes(v.toLowerCase()));
  }
  if (engine === 'label') {
    const { v, exact } = unq(body);
    return (el) => ['input', 'select', 'textarea'].includes(el.tag) && matchName(accessibleName(el), v, exact);
  }
  if (engine === 'xpath') return null;
  const css = parseCss(engine === 'css' ? body : part.trim());
  if (!css) return null;
  return (el, scope) => css.some((steps) => matchesCss(el, steps, scope));
}

/**
 * Every element a locator matches under `scope`, in document order; null when the locator
 * uses something this reader can't resolve (xpath, pseudo-classes). Hidden elements never match.
 */
export function queryLocatorAll(scope, locator) {
  let scopes = [scope];
  for (const part of String(locator).split(/\s+>>\s+/)) {
    const match = partMatcher(part);
    if (!match) return null;
    const next = [];
    for (const s of scopes) for (const el of descendants(s)) if (visible(el) && match(el, s) && !next.includes(el)) next.push(el);
    scopes = next;
    if (!scopes.length) break;
  }
  return scopes;
}

export function queryLocator(scope, locator) {
  const all = queryLocatorAll(scope, locator);
  return all && all.length ? all[0] : null;
}

/** The <body> (or the document) of a parsed page. */
export function bodyOf(doc) {
  for (const el of descendants(doc)) if (el.tag === 'body') return el;
  return doc;
}

/**
 * The fingerprint of a shot's region on a page's HTML. `locator` null means the whole screen.
 * Returns { fingerprint, found } — found false (and fingerprint null) when the region isn't there.
 */
export function regionFingerprint(html, locator) {
  const doc = typeof html === 'string' ? parseHtml(html) : html;
  const el = locator ? queryLocator(doc, locator) : bodyOf(doc);
  if (!el) return { found: false, fingerprint: null };
  return { found: true, fingerprint: fingerprint(structureOf(el)) };
}

/** Everything a walk records about one screen, from its HTML. Deterministic. */
export function readScreen(html) {
  const doc = parseHtml(html);
  const body = bodyOf(doc);
  let title = '';
  for (const el of descendants(doc)) if (el.tag === 'title') {
    title = norm(rawText(el));
    break;
  }
  const s = structureOf(body);
  const h1 = s.headings.find((h) => h.level === 1)?.text || '';
  return {
    title,
    h1,
    headings: s.headings,
    controls: s.controls.map((c) => ({ ...c })),
    regions: s.regions.map((r) => ({ role: r.role, name: r.name, locator: suggestLocator(r.el), fingerprint: fingerprint(structureOf(r.el)) })),
    fingerprint: fingerprint(s),
    text: textOf(body),
    doc,
  };
}
