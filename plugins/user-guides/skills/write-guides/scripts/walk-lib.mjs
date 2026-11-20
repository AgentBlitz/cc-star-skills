#!/usr/bin/env node
// walk-lib.mjs: walk the LOCAL app as each role and record what is on every screen, so guides
// are written in the screens' own words (write-guides step 3).
//
// Built on kit-core.mjs. It uses Playwright when it can find and launch it, and otherwise walks
// by fetching the server-rendered pages. Either way each screen goes through the same reader,
// so both give the same outline for the same markup. Walk outlines and dumps go to the
// project's git-ignored .user-guides/walk/, so a later session can resume from them.
//
// CLI (run from the repo root; --set defaults to docs/user-guides/guides.json):
//   node walk-lib.mjs preflight [--set …] [--fetch] [--headless]
//       the base URL, Playwright, and every role's sign-in. Exit 3: the app is unreachable
//       (take the code path and record notChecked[]).
//   node walk-lib.mjs crawl [--set …] [--roles a,b] [--from /,/home] [--max 60] [--fetch] [--headless]
//       every screen each role can reach by links (and forms with nothing to fill in), GET
//       only; writes the dumps and outline.json / outline.md.
//   node walk-lib.mjs diff
//       what changed since the walk before (outline.previous.json → outline.json).
//   node walk-lib.mjs refresh [--set …] [--write]
//       after a new walk: each taken shot whose region fingerprint changed, or that has none,
//       is marked retake (--write saves guides.json).
//   node walk-lib.mjs sign-in --role <role> [--set …]
//       storage-state only: sign in by hand in a headed browser; saved mode 600. Never headless.
//   node walk-lib.mjs install-playwright --yes
//       fill the user-level cache. Only after the user said yes; never headless.
//
// As a module, for a walk script of your own (the interactions a crawl can't do):
//   const walk = await createWalk({ setFile: 'docs/user-guides/guides.json' });
//   const p = await walk.open('manager');
//   await walk.go(p, '/inbox');  await walk.dump(p, 'inbox');
//   const r = await walk.api(p, 'POST', '/api/thing', { … });
//   await walk.save();  await walk.close();
// With a browser, `p.page` is the Playwright page, for clicks and typing; dump again after.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as kit from './kit-core.mjs';
import { loadGuideSet, saveGuideSet, markRetakeIfChanged } from './guide-set.mjs';

export const OUTLINE_VERSION = 1;
export const DEFAULT_SET = 'docs/user-guides/guides.json';
const SKIP_LINK = /(?:^|[^a-z])(?:sign|log)[\s_-]?(?:out|off)\b|logout|delete|remove|destroy|unsubscribe/i;
const SKIP_EXT = /\.(?:png|jpe?g|gif|svg|webp|pdf|zip|csv|xlsx?|docx?|json|xml|ics|txt|mp4|mp3)$/i;

/** Is anything answering at the base URL? Any HTTP status counts. */
export async function reachable(baseUrl, timeoutMs = 4000) {
  try {
    const res = await fetch(baseUrl, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, reason: err.cause?.code || err.name || err.message };
  }
}

/** Add `.user-guides/` to the project's .gitignore when it isn't there (the skill adds the line). */
export function ensureIgnored(root = '.') {
  const file = path.join(root, '.gitignore');
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (text.split('\n').some((l) => /^\/?\.user-guides\/?$/.test(l.trim()))) return false;
  fs.writeFileSync(file, text + (text && !text.endsWith('\n') ? '\n' : '') + '.user-guides/\n');
  return true;
}

/** An outline entry's key: its path, plus its name for a walk script's named dump. */
export const entryKey = (s) => (s.name ? `${s.path}#${s.name}` : s.path);
const byEntry = (a, b) => a.path.localeCompare(b.path) || (a.name || '').localeCompare(b.name || '');

/** The screen's key: its path and sorted query, relative to the app's origin. */
export function screenKey(url, baseUrl) {
  const u = new URL(url, baseUrl);
  const params = [...u.searchParams].sort(([a, x], [b, y]) => a.localeCompare(b) || x.localeCompare(y));
  const qs = new URLSearchParams(params).toString();
  return u.pathname + (qs ? `?${qs}` : '');
}

/** A file name for a screen's dump: `/requests?new=1` → `requests_new-1`. */
export function dumpName(key) {
  const [p, qs] = key.split('?');
  const base = p.replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase() || 'index';
  return qs ? `${base}_${qs.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}` : base;
}

/** Links and nothing-to-fill GET forms on a parsed page that a crawl may follow. */
export function nextScreens(doc, pageUrl, baseUrl) {
  const base = new URL(baseUrl);
  const prefix = base.pathname.replace(/\/?$/, '/');
  const out = [];
  const take = (href, label) => {
    let u;
    try {
      u = new URL(href, pageUrl);
    } catch {
      return;
    }
    if (u.origin !== base.origin || !(u.pathname + '/').startsWith(prefix) && u.pathname !== base.pathname) return;
    if (SKIP_EXT.test(u.pathname) || SKIP_LINK.test(u.pathname) || SKIP_LINK.test(label || '')) return;
    u.hash = '';
    out.push(u.href);
  };
  for (const el of kit.descendants(doc)) {
    if (!kit.visible(el)) continue;
    if (el.tag === 'a' && el.attrs.href && !/^(?:mailto|tel|javascript):/i.test(el.attrs.href)) take(el.attrs.href, kit.accessibleName(el));
    if (el.tag === 'form' && (el.attrs.method || 'get').toLowerCase() === 'get') {
      const fields = [...kit.descendants(el)].filter((f) => ['input', 'select', 'textarea'].includes(f.tag));
      const fillable = fields.filter((f) => !(f.tag === 'input' && ['hidden', 'submit', 'button', 'image'].includes((f.attrs.type || '').toLowerCase())));
      if (fillable.length) continue;
      const params = new URLSearchParams();
      for (const f of fields) if ((f.attrs.type || '').toLowerCase() === 'hidden' && f.attrs.name) params.set(f.attrs.name, f.attrs.value ?? '');
      const action = new URL(el.attrs.action || pageUrl, pageUrl);
      action.search = params.toString();
      const button = [...kit.descendants(el)].find((b) => kit.roleOf(b) === 'button');
      take(action.href, button ? kit.accessibleName(button) : '');
    }
  }
  return out;
}

/**
 * Start a walk. mode: 'auto' (a browser when Playwright is found and Chromium starts, else a
 * fetch walk), 'browser' or 'fetch'. A headless run never installs anything or signs in by hand.
 */
export async function createWalk({ root = '.', setFile = DEFAULT_SET, set: given, mode = 'auto', headless = false, fresh = false, out, env = process.env, viewport = { width: 1440, height: 900 }, log = () => {} } = {}) {
  const set = given || loadGuideSet(path.resolve(root, setFile));
  const baseUrl = set.app.baseUrl;
  const outDir = path.resolve(root, out || path.join(kit.WORK_DIR, 'walk'));
  const outline = { outlineVersion: OUTLINE_VERSION, mode: 'fetch', roles: {} };
  let browser = null;
  let reason = 'fetch walk asked for';

  if (mode !== 'fetch') {
    const found = kit.findPlaywright({ root, playwrightFrom: set.app.playwrightFrom, env });
    if (!found) reason = `Playwright not found (install: ${kit.installCommand(env)})`;
    else {
      try {
        const pw = await kit.loadPlaywright(found);
        browser = await pw.chromium.launch({ headless: true });
        outline.mode = 'browser';
        reason = `Playwright from ${found.source}`;
      } catch (err) {
        reason = `Chromium did not start (${String(err.message).split('\n')[0]})`;
      }
    }
    if (!browser && mode === 'browser') throw new Error(`no browser: ${reason}`);
  }
  log(`walk: ${outline.mode} (${reason})`);

  const screens = new Map(); // role → Map(key → screen)
  const outlineFile = path.join(outDir, 'outline.json');
  if (fresh) {
    // A new walk: the one before is kept as outline.previous.json, for `diff`.
    if (fs.existsSync(outlineFile)) fs.renameSync(outlineFile, path.join(outDir, 'outline.previous.json'));
    fs.rmSync(path.join(outDir, 'dumps'), { recursive: true, force: true });
  } else if (fs.existsSync(outlineFile)) {
    // A walk script after a crawl adds to the walk's outline (and replaces the screens it dumps again).
    const prev = JSON.parse(fs.readFileSync(outlineFile, 'utf8'));
    for (const [role, list] of Object.entries(prev.roles || {})) screens.set(role, new Map(list.map((x) => [entryKey(x), x])));
  }
  const usedNames = new Map();
  for (const [role, m] of screens) usedNames.set(role, new Map([...m.values()].map((x) => [path.posix.basename(x.dump, '.txt'), x.path])));

  const walk = {
    mode: outline.mode,
    reason,
    outDir,
    set,

    /**
     * A page for the role, signed in. `{ signedOut: true }` gives the same role a page that is
     * not signed in, for the screens before sign-in (sign-in, register, a sign-up link); its
     * dumps are recorded under that role.
     */
    async open(role, { signedOut = false } = {}) {
      kit.accountFor(set, role);
      if (signedOut) {
        if (browser) {
          const context = await browser.newContext({ viewport });
          const page = await context.newPage();
          page.on('pageerror', (e) => log(`[pageerror ${role}, signed out] ${e.message}`));
          return { role, kind: 'browser', context, page, url: null, status: null, html: null, signedOut };
        }
        return { role, kind: 'fetch', jar: new kit.CookieJar(), url: null, status: null, html: null, signedOut };
      }
      if (browser) {
        const context = await browser.newContext({ viewport, ...kit.browserContextOptions({ set, role, root, headless }) });
        await kit.signInContext({ context, set, role, root, env });
        const page = await context.newPage();
        page.on('pageerror', (e) => log(`[pageerror ${role}] ${e.message}`));
        return { role, kind: 'browser', context, page, url: null, status: null, html: null };
      }
      const jar = await kit.signInJar({ set, role, root, env, headless });
      return { role, kind: 'fetch', jar, url: null, status: null, html: null };
    },

    async go(p, to) {
      const url = new URL(to, baseUrl).href;
      if (p.kind === 'browser') {
        const res = await p.page.goto(url);
        await p.page.waitForLoadState('networkidle').catch(() => {});
        p.status = res ? res.status() : null;
        p.url = p.page.url();
        p.html = null;
      } else {
        const { res, url: final } = await kit.jarFetch(p.jar, url);
        p.status = res.status;
        p.url = final;
        p.html = await res.text();
      }
      return { status: p.status, path: screenKey(p.url, baseUrl) };
    },

    /** Record the screen the page is on: its text and HTML to dumps/<role>/, its outline entry. */
    async dump(p, name) {
      const html = p.kind === 'browser' ? await p.page.content() : p.html;
      if (html === null || html === undefined) throw new Error('dump: go somewhere first');
      const key = screenKey(p.kind === 'browser' ? p.page.url() : p.url, baseUrl);
      const s = kit.readScreen(html);
      const roleDir = path.join(outDir, 'dumps', p.role);
      fs.mkdirSync(roleDir, { recursive: true });
      let file = name || dumpName(key);
      const taken = usedNames.get(p.role) || new Map();
      usedNames.set(p.role, taken);
      if (taken.has(file) && taken.get(file) !== key) {
        let i = 2;
        while (taken.has(`${file}-${i}`)) i++;
        file = `${file}-${i}`;
      }
      taken.set(file, key);
      fs.writeFileSync(path.join(roleDir, `${file}.txt`), `${key}\n\n${s.text}\n`);
      fs.writeFileSync(path.join(roleDir, `${file}.html`), html);
      const screen = {
        path: key,
        status: p.status,
        title: s.title,
        h1: s.h1,
        headings: s.headings,
        controls: s.controls,
        regions: s.regions,
        fingerprint: s.fingerprint,
        dump: path.posix.join('dumps', p.role, `${file}.txt`),
      };
      // A named dump (a walk script's state: a dialog opened by a click, the page after an
      // action) is its own entry; an unnamed one (the crawl's) is the screen at that path.
      if (name) screen.name = name;
      if (!screens.has(p.role)) screens.set(p.role, new Map());
      screens.get(p.role).set(entryKey(screen), screen);
      return screen;
    },

    /** A same-origin API call with the role's session. Returns { status, body }. */
    async api(p, method, to, body) {
      if (p.kind === 'browser') {
        return p.page.evaluate(
          async ([m, u, b]) => {
            const res = await fetch(u, { method: m, credentials: 'same-origin', headers: b === null ? {} : { 'Content-Type': 'application/json' }, body: b === null ? undefined : JSON.stringify(b) });
            let parsed = null;
            try {
              parsed = await res.json();
            } catch {}
            return { status: res.status, body: parsed };
          },
          [method, new URL(to, baseUrl).href, body ?? null],
        );
      }
      const { res } = await kit.jarFetch(p.jar, new URL(to, baseUrl).href, { method, headers: body === undefined ? {} : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
      let parsed = null;
      try {
        parsed = await res.json();
      } catch {}
      return { status: res.status, body: parsed };
    },

    /** Drop a role's screens and dumps, before walking it again. */
    forget(role) {
      screens.delete(role);
      usedNames.delete(role);
      fs.rmSync(path.join(outDir, 'dumps', role), { recursive: true, force: true });
    },

    /** Every screen the role reaches by GET links and nothing-to-fill forms, breadth first. */
    async crawl(role, { from = ['/'], max = 60 } = {}) {
      const p = await walk.open(role);
      const queue = from.map((f) => new URL(f, baseUrl).href);
      const seen = new Set();
      let count = 0;
      while (queue.length && count < max) {
        const url = queue.shift();
        const want = screenKey(url, baseUrl);
        if (seen.has(want)) continue;
        seen.add(want);
        const { path: landed } = await walk.go(p, url);
        if (seen.has(landed) && landed !== want) continue; // a redirect to a screen already recorded
        seen.add(landed);
        const html = p.kind === 'browser' ? await p.page.content() : p.html;
        // The same screen under another path (`/` and `/home`): recorded once, with its aliases.
        const peek = kit.readScreen(html);
        const same = [...(screens.get(role)?.values() || [])].find((s) => !s.name && s.fingerprint === peek.fingerprint && s.title === peek.title && s.status === p.status);
        if (same) {
          same.aliases = [...new Set([...(same.aliases || []), landed])].sort();
        } else {
          await walk.dump(p);
          count++;
        }
        const next = nextScreens(kit.parseHtml(html), p.url, baseUrl).filter((u) => !seen.has(screenKey(u, baseUrl)));
        queue.push(...next.sort((a, b) => screenKey(a, baseUrl).localeCompare(screenKey(b, baseUrl))));
      }
      if (p.kind === 'browser') await p.context.close();
      return count;
    },

    /** The outline: per role, every recorded screen sorted by path. No times, hosts or ports. */
    outline() {
      const roles = {};
      for (const role of [...screens.keys()].sort()) roles[role] = [...screens.get(role).values()].sort(byEntry);
      return { ...outline, roles };
    },

    /** Write outline.json and outline.md. */
    async save() {
      fs.mkdirSync(outDir, { recursive: true });
      const o = walk.outline();
      const file = path.join(outDir, 'outline.json');
      fs.writeFileSync(file, JSON.stringify(o, null, 2) + '\n');
      fs.writeFileSync(path.join(outDir, 'outline.md'), outlineMarkdown(o));
      return o;
    },

    async close() {
      await browser?.close().catch(() => {});
    },
  };
  return walk;
}

// A control named after a whole row ("Before I go to the airportPhoebe (own) · …") is cut short,
// and a control repeated on every row ("Switch off" × 40) is listed once with its count, so the
// outline stays readable on a busy screen. outline.json keeps every control in full.
const NAME_MAX = 80;
const shortName = (n) => (n.length > NAME_MAX ? `${n.slice(0, NAME_MAX - 1)}…` : n);
function counted(items) {
  const n = new Map();
  for (const x of items) n.set(x, (n.get(x) || 0) + 1);
  return [...n].map(([x, k]) => (k > 1 ? `${x} ×${k}` : x));
}

/** The outline as a page a writer can read. */
export function outlineMarkdown(o) {
  const lines = [`# Walk outline (${o.mode} walk)`, ''];
  for (const [role, list] of Object.entries(o.roles)) {
    lines.push(`## ${role}`, '');
    for (const s of list) {
      lines.push(`### ${s.path} — ${s.title || s.h1 || '(untitled)'} (${s.status})${s.name ? ` · state \`${s.name}\`` : ''}`, '');
      if (s.headings.length) lines.push(`- Headings: ${s.headings.map((h) => `${'#'.repeat(h.level)} ${h.text}`).join(' · ')}`);
      const links = s.controls.filter((c) => c.role === 'link');
      const controls = s.controls.filter((c) => c.role !== 'link');
      if (links.length) lines.push(`- Links: ${counted(links.map((c) => `"${shortName(c.name)}"`)).join(', ')}`);
      if (controls.length) lines.push(`- Controls: ${counted(controls.map((c) => `${c.role} "${shortName(c.name)}"`)).join(', ')}`);
      if (s.regions.length) lines.push(`- Regions: ${s.regions.map((r) => `\`${r.locator}\``).join(', ')}`);
      lines.push(`- Dump: \`${s.dump}\``, '');
    }
  }
  return lines.join('\n');
}

export function loadOutline(walkDir) {
  const file = path.join(walkDir, 'outline.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

/** The first path in a shot's `state` ("On /requests?new=1: …"), or null. */
export function statePath(state) {
  const m = String(state || '').match(/(?:^|\s)(\/[\w\-./?=&%~]*)/);
  return m ? m[1].replace(/[.,:;)]+$/, '') : null;
}

const screenName = (s) => kit.screenNames(s).map((x) => x.toLowerCase());

/** The screens of the outline a shot may sit on: its state's path, else its alt's screen name. */
export function shotScreens(outline, shot) {
  const list = outline?.roles?.[shot.as] || [];
  const p = statePath(shot.state);
  if (p) return list.filter((s) => s.path === p || (s.aliases || []).includes(p));
  const name = String(shot.alt || '').split(':')[0].trim().toLowerCase();
  const named = list.filter((s) => screenName(s).includes(name));
  return named.length ? named : shot.target?.locator ? list : [];
}

/** The fingerprint of a shot's region in the walk's HTML dumps, or null when it can't be found. */
export function shotFingerprint(walkDir, outline, shot) {
  for (const s of shotScreens(outline, shot)) {
    const html = fs.readFileSync(path.join(walkDir, s.dump.replace(/\.txt$/, '.html')), 'utf8');
    const r = kit.regionFingerprint(html, shot.target?.locator || null);
    if (r.found) return { fingerprint: r.fingerprint, screen: s.path };
  }
  return { fingerprint: null, screen: null };
}

/**
 * What changed between two walks, per role: screens added and removed, and screens whose
 * fingerprint changed, with the headings and controls that came and went.
 */
export function diffOutlines(before, after) {
  const out = [];
  const label = (c) => `${c.role} "${c.name}"`;
  const roles = [...new Set([...Object.keys(before?.roles || {}), ...Object.keys(after?.roles || {})])].sort();
  for (const role of roles) {
    const a = new Map((before?.roles?.[role] || []).map((s) => [entryKey(s), s]));
    const b = new Map((after?.roles?.[role] || []).map((s) => [entryKey(s), s]));
    for (const [k, s] of b) if (!a.has(k)) out.push({ role, path: k, change: 'added', title: s.title });
    for (const [k, s] of a) if (!b.has(k)) out.push({ role, path: k, change: 'removed', title: s.title });
    for (const [p, s] of b) {
      const old = a.get(p);
      if (!old || old.fingerprint === s.fingerprint) continue;
      const gone = (x, y) => x.filter((i) => !y.includes(i));
      const [oc, nc] = [old.controls.map(label), s.controls.map(label)];
      const [oh, nh] = [old.headings.map((h) => h.text), s.headings.map((h) => h.text)];
      const regions = s.regions.filter((r) => { const o = old.regions.find((x) => x.locator === r.locator); return !o || o.fingerprint !== r.fingerprint; }).map((r) => r.locator);
      out.push({ role, path: p, change: 'changed', title: s.title, controlsAdded: gone(nc, oc), controlsRemoved: gone(oc, nc), headingsAdded: gone(nh, oh), headingsRemoved: gone(oh, nh), regions });
    }
  }
  return out;
}

/** Refresh's rule over a set, from the latest walk. Returns one row per taken shot. */
export function refreshShots(set, walkDir) {
  const outline = loadOutline(walkDir);
  if (!outline) throw new Error(`no walk outline in ${walkDir}: walk first`);
  const rows = [];
  for (const shot of set.shots) {
    if (shot.status !== 'taken') continue;
    const now = shotFingerprint(walkDir, outline, shot);
    const before = shot.fingerprint || null;
    const marked = markRetakeIfChanged(set, shot.id, now.fingerprint);
    rows.push({ id: shot.id, screen: now.screen, before, now: now.fingerprint, retake: marked, why: !marked ? 'unchanged' : !before ? 'no fingerprint recorded' : !now.fingerprint ? 'region not found' : 'region changed' });
  }
  return rows;
}

// ---------------------------------------------------------------------------------------
// CLI

function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  const a = { cmd, _: [] };
  for (let i = 0; i < rest.length; i++) {
    const m = rest[i].match(/^--([a-z-]+)$/);
    if (!m) a._.push(rest[i]);
    else if (['fetch', 'headless', 'write', 'yes'].includes(m[1])) a[m[1]] = true;
    else a[m[1]] = rest[++i];
  }
  a.headless = a.headless || process.env.USER_GUIDES_HEADLESS === '1';
  return a;
}

async function main(argv) {
  const a = parseArgs(argv);
  const setFile = a.set || DEFAULT_SET;
  const say = (s) => console.log(s);
  if (a.cmd === 'install-playwright') {
    if (a.headless) return say(`a headless run never installs Playwright. To install it, run:\n  ${kit.installCommand()}`), 2;
    if (!a.yes) return say(`ask the user first, then run with --yes. It runs:\n  ${kit.installCommand()}`), 2;
    const found = kit.installPlaywright();
    say(`Playwright ${found?.version} in ${found?.dir}`);
    return 0;
  }
  if (a.cmd === 'diff') {
    const walkDir = path.resolve(a.out || path.join(kit.WORK_DIR, 'walk'));
    const before = JSON.parse(fs.readFileSync(path.join(walkDir, 'outline.previous.json'), 'utf8'));
    const rows = diffOutlines(before, loadOutline(walkDir));
    for (const r of rows) {
      say(`${r.role}  ${r.path}  ${r.change}${r.title ? ` (${r.title})` : ''}`);
      for (const k of ['controlsAdded', 'controlsRemoved', 'headingsAdded', 'headingsRemoved', 'regions']) if (r[k]?.length) say(`    ${k}: ${r[k].join(', ')}`);
    }
    say(`${rows.length} screen changes`);
    return 0;
  }
  const set = loadGuideSet(setFile);
  if (a.cmd === 'refresh') {
    const walkDir = path.resolve(a.out || path.join(kit.WORK_DIR, 'walk'));
    const rows = refreshShots(set, walkDir);
    for (const r of rows) say(`${r.retake ? 'retake' : 'keep  '}  ${r.id}  (${r.why}${r.screen ? `, on ${r.screen}` : ''})`);
    say(`${rows.filter((r) => r.retake).length} of ${rows.length} taken shots to retake`);
    if (a.write) {
      saveGuideSet(setFile, set);
      say(`${setFile}: saved`);
    }
    return 0;
  }
  const r = await reachable(set.app.baseUrl);
  if (!r.ok) {
    say(`unreachable: ${set.app.baseUrl} (${r.reason}).`);
    say(a.headless ? 'A headless run never starts the app: take the code path and record each unchecked claim in notChecked[].' : 'Ask before running app.start, or take the code path and record each unchecked claim in notChecked[].');
    return 3;
  }
  if (a.cmd === 'sign-in') {
    if (set.app.signIn.kind !== 'storage-state') return say(`sign-in is only for storage-state sign-ins (this set uses ${set.app.signIn.kind})`), 2;
    if (!a.role) return say('usage: walk-lib.mjs sign-in --role <role>'), 2;
    const found = kit.findPlaywright({ playwrightFrom: set.app.playwrightFrom });
    if (!found) return say(`Playwright not found. With the user's yes: node walk-lib.mjs install-playwright --yes`), 2;
    ensureIgnored('.');
    const file = await kit.captureStorageState({ pw: await kit.loadPlaywright(found), set, role: a.role, headless: a.headless, say });
    say(`saved the ${a.role} sign-in to ${path.relative('.', file)} (mode 600; never print or commit it)`);
    return 0;
  }
  if (a.cmd === 'preflight') {
    say(`base URL: ${set.app.baseUrl} answers (${r.status})`);
    const walk = await createWalk({ set, mode: a.fetch ? 'fetch' : 'auto', headless: a.headless });
    say(`walk: ${walk.mode} (${walk.reason})`);
    let bad = 0;
    for (const role of Object.keys(set.app.accounts)) {
      try {
        const p = await walk.open(role);
        const { status, path: landed } = await walk.go(p, '/');
        say(`  ${role}: signed in; / lands on ${landed} (${status})`);
        if (p.context) await p.context.close();
      } catch (err) {
        bad++;
        say(`  ${role}: ${err.message}`);
      }
    }
    await walk.close();
    return bad ? 1 : 0;
  }
  if (a.cmd === 'crawl') {
    ensureIgnored('.');
    // All roles: a fresh walk. Some roles (--roles): only theirs are walked again.
    const walk = await createWalk({ set, mode: a.fetch ? 'fetch' : 'auto', headless: a.headless, out: a.out, fresh: !a.roles });
    say(`walk: ${walk.mode} (${walk.reason})`);
    const roles = a.roles ? a.roles.split(',') : Object.keys(set.app.accounts);
    try {
      for (const role of roles) {
        if (a.roles) walk.forget(role);
        const n = await walk.crawl(role, { from: a.from ? a.from.split(',') : ['/'], max: Number(a.max || 60) });
        say(`  ${role}: ${n} screens`);
      }
      await walk.save();
    } finally {
      await walk.close();
    }
    say(`outline: ${path.relative('.', path.join(walk.outDir, 'outline.md'))}`);
    return 0;
  }
  console.error('usage: walk-lib.mjs preflight|crawl|diff|refresh|sign-in|install-playwright [--set guides.json] …');
  return 2;
}

// Compare real paths: called through a symlink (macOS's /var → /private/var), argv[1] differs.
if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => (process.exitCode = code),
    (err) => {
      console.error(`walk-lib: ${err.message}`);
      process.exitCode = 1;
    },
  );
}
