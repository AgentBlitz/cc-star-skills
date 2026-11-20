#!/usr/bin/env node
// shots-kit.mjs: give a project its screenshot script, and keep the helpers it uses current.
//
//   node shots-kit.mjs install [--set docs/user-guides/guides.json] [--into scripts/user-guides] [--force]
//       copies templates/guides-kit.mjs into <into>/ with a stamp line (the plugin version and
//       the template's hash), and writes <into>/shots.mjs from templates/shots.template.mjs,
//       one block per shot of guides.json, unless the project has one already (it is theirs).
//       A guides-kit.mjs edited by hand is not replaced without --force.
//   node shots-kit.mjs check [--set …] [--into …]
//       flags a stale guides-kit.mjs (the plugin's is different), one edited by hand, and the
//       shots of guides.json that shots.mjs does not take (or names it takes that aren't
//       there). Exit 1 when anything is flagged.
//   node shots-kit.mjs blocks [--set …] [--into …] [id…]
//       prints shots.mjs blocks for the named shots, or for every shot shots.mjs lacks, to
//       paste in.
//
// Run from the project root. Node >= 20 built-ins only.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TEMPLATES = path.join(HERE, '..', 'templates');
export const KIT_TEMPLATE = path.join(TEMPLATES, 'guides-kit.mjs');
export const SHOTS_TEMPLATE = path.join(TEMPLATES, 'shots.template.mjs');
export const DEFAULT_SET = 'docs/user-guides/guides.json';
export const DEFAULT_INTO = 'scripts/user-guides';
const STAMP_RE = /^\/\/ guides-kit stamp: user-guides (\S+) (sha256:[0-9a-f]{64})\b.*\n/;

const sha = (buf) => 'sha256:' + crypto.createHash('sha256').update(buf).digest('hex');

export function pluginVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(HERE, '..', '..', '..', '.claude-plugin', 'plugin.json'), 'utf8')).version || 'unknown';
  } catch {
    return 'unknown';
  }
}

/** The project's copy of guides-kit.mjs: the template with a stamp line on top. */
export function stampedKit(template = fs.readFileSync(KIT_TEMPLATE, 'utf8'), version = pluginVersion()) {
  return `// guides-kit stamp: user-guides ${version} ${sha(template)}; copied by wiki-guides' shots-kit.mjs install. Do not edit this copy.\n${template}`;
}

/**
 * Where a project's copy stands: 'current', 'stale' (the plugin's template is different),
 * 'edited' (changed since it was copied), 'unstamped' or 'missing'.
 */
export function kitStatus(file, template = fs.readFileSync(KIT_TEMPLATE, 'utf8')) {
  if (!fs.existsSync(file)) return { status: 'missing' };
  const text = fs.readFileSync(file, 'utf8');
  const m = text.match(STAMP_RE);
  if (!m) return { status: 'unstamped' };
  const body = text.slice(m[0].length);
  if (sha(body) !== m[2]) return { status: 'edited', version: m[1] };
  if (m[2] !== sha(template)) return { status: 'stale', version: m[1], current: pluginVersion() };
  return { status: 'current', version: m[1] };
}

/** The first path in a shot's state ("On /requests?new=1: …"), as write-guides reads it. */
export function statePath(state) {
  const m = String(state || '').match(/(?:^|\s)(\/[\w\-./?=&%~]*)/);
  return m ? m[1].replace(/[.,:;)]+$/, '') : null;
}

const SIGNED_OUT_RE = /\bsigned[ -]out\b/i;
const oneLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const lit = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

function pageVar(role, signedOut) {
  const camel = role.replace(/[-_]+([a-z0-9])/g, (_, c) => c.toUpperCase());
  return (/^[0-9]/.test(camel) ? `role${camel}` : camel) + (signedOut ? 'SignedOut' : '');
}

/** shots.mjs blocks for some shots: a page per role (signed in or out), then open and shoot. */
export function shotBlocks(shots) {
  const groups = new Map();
  for (const s of shots) {
    const out = SIGNED_OUT_RE.test(s.state || '');
    const key = `${s.as}\u0000${out}`;
    if (!groups.has(key)) groups.set(key, { role: s.as, out, shots: [] });
    groups.get(key).shots.push(s);
  }
  const lines = [];
  for (const g of groups.values()) {
    const v = pageVar(g.role, g.out);
    if (lines.length) lines.push('');
    lines.push(`// ── ${g.role}${g.out ? ', signed out' : ''} ──`);
    lines.push(`const ${v} = await k.as(${lit(g.role)}${g.out ? ', { signedOut: true }' : ''});`);
    for (const s of g.shots) {
      const p = statePath(s.state);
      lines.push('');
      lines.push(`// ${s.id}: ${oneLine(s.alt)}`);
      lines.push(`// state: ${oneLine(s.state) || '(none given)'}; target: ${oneLine(s.target?.what) || 'the whole screen'}`);
      if (p) lines.push(`await k.open(${v}, ${lit(p)});`);
      else {
        lines.push('// TODO: the state names no path; open the screen this shot shows.');
        lines.push(`await k.open(${v}, '/');`);
      }
      lines.push(`await k.shot(${lit(s.id)}, ${v});`);
    }
  }
  return lines.join('\n');
}

/** The shot ids a shots.mjs takes, from its `.shot('<id>'` calls. */
export function shotsNamedIn(text) {
  return [...new Set([...text.matchAll(/\.shot\(\s*(['"`])([a-z0-9]+(?:-[a-z0-9]+)*)\1/g)].map((m) => m[2]))];
}

function loadSet(root, setFile) {
  const file = path.resolve(root, setFile);
  if (!fs.existsSync(file)) throw new Error(`no ${setFile}: run write-guides first, or adopt the guides`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function install({ root = '.', setFile = DEFAULT_SET, into = DEFAULT_INTO, force = false, say = console.log } = {}) {
  const set = loadSet(root, setFile);
  const dir = path.resolve(root, into);
  fs.mkdirSync(dir, { recursive: true });
  const kitFile = path.join(dir, 'guides-kit.mjs');
  const st = kitStatus(kitFile);
  if (st.status === 'edited' && !force) throw new Error(`${path.join(into, 'guides-kit.mjs')} was edited by hand: move the changes into shots.mjs, or pass --force to replace it`);
  if (st.status === 'current') say(`${path.join(into, 'guides-kit.mjs')}: current (user-guides ${st.version})`);
  else {
    fs.writeFileSync(kitFile, stampedKit());
    say(`${path.join(into, 'guides-kit.mjs')}: ${st.status === 'missing' ? 'copied' : `replaced (was ${st.status})`}, user-guides ${pluginVersion()}`);
  }
  const shotsFile = path.join(dir, 'shots.mjs');
  if (fs.existsSync(shotsFile) && !force) say(`${path.join(into, 'shots.mjs')}: kept (it is the project's own)`);
  else {
    const rel = path.relative(dir, path.resolve(root)).split(path.sep).join('/') || '.';
    const text = fs
      .readFileSync(SHOTS_TEMPLATE, 'utf8')
      .replace(/\{\{SET_FILE\}\}/g, setFile)
      .replace("new URL('../..', import.meta.url)", `new URL(${lit(rel.endsWith('/') ? rel : rel + '/')}, import.meta.url)`)
      .replace('{{SHOTS}}', shotBlocks(set.shots || []));
    fs.writeFileSync(shotsFile, text, { mode: 0o755 });
    say(`${path.join(into, 'shots.mjs')}: written, ${(set.shots || []).length} shot(s)`);
  }
  return check({ root, setFile, into, say: () => {} });
}

export function check({ root = '.', setFile = DEFAULT_SET, into = DEFAULT_INTO, say = console.log } = {}) {
  const set = loadSet(root, setFile);
  const problems = [];
  const st = kitStatus(path.resolve(root, into, 'guides-kit.mjs'));
  if (st.status === 'current') say(`guides-kit.mjs: current (user-guides ${st.version})`);
  else {
    const fix = { missing: 'run shots-kit.mjs install', unstamped: 'not copied by shots-kit.mjs: run install --force', edited: 'edited by hand: move the changes into shots.mjs, then install --force', stale: `copied from user-guides ${st.version}; the plugin's (${st.current}) is different: run shots-kit.mjs install` }[st.status];
    problems.push(`guides-kit.mjs: ${st.status}: ${fix}`);
  }
  const shotsFile = path.resolve(root, into, 'shots.mjs');
  const missing = [];
  if (!fs.existsSync(shotsFile)) problems.push('shots.mjs: missing: run shots-kit.mjs install');
  else {
    const named = shotsNamedIn(fs.readFileSync(shotsFile, 'utf8'));
    const ids = (set.shots || []).map((s) => s.id);
    missing.push(...ids.filter((id) => !named.includes(id)));
    const extra = named.filter((id) => !ids.includes(id));
    if (missing.length) problems.push(`shots.mjs does not take ${missing.join(', ')} (shots-kit.mjs blocks prints the blocks to add)`);
    if (extra.length) problems.push(`shots.mjs takes ${extra.join(', ')}, which guides.json does not have`);
    if (!missing.length && !extra.length) say(`shots.mjs: takes all ${ids.length} shot(s)`);
  }
  for (const p of problems) say(`FLAG ${p}`);
  return { ok: problems.length === 0, problems, kit: st.status, missing };
}

function parseArgs(argv) {
  const a = { cmd: argv[0], set: DEFAULT_SET, into: DEFAULT_INTO, force: false, ids: [] };
  for (let i = 1; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--set') a.set = argv[++i];
    else if (x === '--into') a.into = argv[++i];
    else if (x === '--force') a.force = true;
    else if (x.startsWith('-')) throw new Error(`unknown option ${x}`);
    else a.ids.push(x);
  }
  return a;
}

function main(argv) {
  const a = parseArgs(argv);
  if (a.cmd === 'install') return install({ setFile: a.set, into: a.into, force: a.force }).ok ? 0 : 1;
  if (a.cmd === 'check') return check({ setFile: a.set, into: a.into }).ok ? 0 : 1;
  if (a.cmd === 'blocks') {
    const set = loadSet('.', a.set);
    const ids = a.ids.length ? a.ids : check({ setFile: a.set, into: a.into, say: () => {} }).missing;
    const unknown = ids.filter((id) => !(set.shots || []).some((s) => s.id === id));
    if (unknown.length) throw new Error(`no shot named ${unknown.join(', ')}`);
    console.log(ids.length ? shotBlocks((set.shots || []).filter((s) => ids.includes(s.id))) : '// shots.mjs already takes every shot');
    return 0;
  }
  console.error('usage: shots-kit.mjs install|check|blocks [--set guides.json] [--into scripts/user-guides] [--force] [id…]');
  return 2;
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (err) {
    console.error(`shots-kit: ${err.message}`);
    process.exitCode = 2;
  }
}
