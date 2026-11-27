#!/usr/bin/env node
// The genericity check (platform-audit PLAN D9), adapted from user-guides'. This repo is public,
// .planning/ included, and must name neither the platform the sources describe nor any other:
//   - the host rule (always runs): no host but localhost, 127.0.0.1, 0.0.0.0 and example.* (plus
//     the documented exceptions in ALLOWED_HOSTS);
//   - the deny-list rule: no term from .planning/platform-audit/sources/deny.txt, a git-ignored
//     file, so this repo never holds the strings it forbids. When it is absent, that rule is
//     skipped and the report says so.
//
//   node test/genericity.mjs                    the plugin's tracked files and new files that aren't ignored
//   node test/genericity.mjs <path>…            those files (both rules); a folder means its
//                                               tracked and new unignored files.  --paths <p>…
//                                               is the same, for every argument after it
//   node test/genericity.mjs --added            the lines added under .planning/platform-audit/
//                                               since HEAD, plus new unignored files there
//                                               (deny-list rule)
//   node test/genericity.mjs --text "<line>"…   those lines;  "-" reads lines from stdin
//   --deny-only  skip the host rule   --deny <file>  another deny-list   --quiet  findings only
//
// Exit 0 when clean, 1 with findings, 2 on a usage error.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PLUGIN_DIR = path.resolve(HERE, '..');
export const REPO_DIR = path.resolve(PLUGIN_DIR, '..', '..');
export const DENY_FILE = path.join(REPO_DIR, '.planning', 'platform-audit', 'sources', 'deny.txt');
export const PLANNING_DIR = path.join('.planning', 'platform-audit');

/** Hosts allowed besides localhost, 127.0.0.1 and example.*, each with its reason. */
export const ALLOWED_HOSTS = {
  'github.com/AgentBlitz/cc-star-skills': "the plugin's own public repository",
};

// Bare names (no scheme) are matched only on these endings, so that code such as `set.app` passes.
const TLDS = 'com|net|org|io|co|co\\.uk|org\\.uk|eu|de|fr|internal|corp|intranet|lan';
const URL_RE = /\b[a-z][a-z0-9+.-]*:\/\/([^\s/'"<>()`\]\\{},;]+)([^\s'"<>()`\]\\{},;]*)/gi;
const BARE_RE = new RegExp(`(?<![\\w@./-])((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+(?:${TLDS}))(?![\\w-])(\\/[^\\s'"<>()\`]*)?`, 'gi');
const EMAIL_RE = /[\w.+-]+@((?:[a-z0-9-]+\.)+[a-z]{2,})/gi;
const IP_RE = /(?<![\d.])(\d{1,3}(?:\.\d{1,3}){3})(?![\d.])/g;

function hostAllowed(host, rest = '') {
  const h = host.toLowerCase().replace(/^[^@]*@/, '').replace(/:\d*$/, '');
  if (!h || !/^[a-z0-9.[\]:-]+$/.test(h)) return true; // a template such as ${host}, not a host
  if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '[::1]') return true;
  if (/(^|\.)example(\.[a-z]+)?$/.test(h) || /^example\./.test(h)) return true;
  for (const allowed of Object.keys(ALLOWED_HOSTS)) {
    const [ah, ...ap] = allowed.split('/');
    if (h !== ah) continue;
    if (!ap.length) return true;
    if ((rest || '').toLowerCase().startsWith('/' + ap.join('/').toLowerCase())) return true;
  }
  return false;
}

/** Host findings in one line of text. */
export function hostFindings(line) {
  const out = [];
  const seen = new Set();
  const add = (what) => {
    if (!seen.has(what)) out.push(what);
    seen.add(what);
  };
  for (const m of line.matchAll(URL_RE)) if (!hostAllowed(m[1], m[2])) add(m[1].toLowerCase());
  const noUrls = line.replace(URL_RE, ' ');
  for (const m of noUrls.matchAll(EMAIL_RE)) if (!hostAllowed(m[1])) add(m[1].toLowerCase());
  const noEmails = noUrls.replace(EMAIL_RE, ' ');
  for (const m of noEmails.matchAll(BARE_RE)) if (!hostAllowed(m[1], m[2])) add(m[1].toLowerCase());
  for (const m of line.matchAll(IP_RE)) {
    const ip = m[1];
    if (ip !== '127.0.0.1' && ip !== '0.0.0.0' && ip.split('.').every((n) => Number(n) <= 255)) add(ip);
  }
  return out;
}

/** The deny-list: one term per line, `#` comments. null when the file is absent. */
export function loadDenyList(file = DENY_FILE) {
  if (!fs.existsSync(file)) return null;
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function denyMatcher(terms) {
  if (!terms || !terms.length) return () => [];
  const res = terms.map((t) => ({ t, re: new RegExp(`(?<![A-Za-z0-9])${reEsc(t).replace(/\\? /g, '[\\s+_-]')}(?![A-Za-z0-9])`, 'i') }));
  return (line) => res.filter(({ re }) => re.test(line)).map(({ t }) => t);
}

/** Text of a file as scanned. plugin.json's author, homepage and repository are left out. */
function scannable(file) {
  const buf = fs.readFileSync(file);
  if (buf.includes(0)) return null; // binary
  let text = buf.toString('utf8');
  if (path.basename(file) === 'plugin.json' && path.basename(path.dirname(file)) === '.claude-plugin') {
    try {
      const m = JSON.parse(text);
      delete m.author;
      delete m.homepage;
      delete m.repository;
      text = JSON.stringify(m, null, 2);
    } catch {
      // scan it as it is
    }
  }
  return text;
}

/** Scan named lines: [{ where, text }]. Returns findings [{ where, rule, what }]. */
export function scanLines(lines, { hosts = true, deny = null } = {}) {
  const denied = denyMatcher(deny);
  const findings = [];
  for (const { where, text } of lines) {
    if (hosts) for (const h of hostFindings(text)) findings.push({ where, rule: 'host', what: h });
    for (const t of denied(text)) findings.push({ where, rule: 'deny-list', what: t });
  }
  return findings;
}

export function scanFiles(files, opts = {}) {
  const lines = [];
  for (const f of files) {
    if (path.basename(f) === 'package-lock.json') continue; // generated: the public npm registry
    const text = scannable(f);
    if (text === null) continue;
    text.split('\n').forEach((t, i) => lines.push({ where: `${path.relative(REPO_DIR, f)}:${i + 1}`, text: t }));
  }
  return scanLines(lines, opts);
}

function gitLines(...args) {
  return execFileSync('git', ['-C', REPO_DIR, ...args], { encoding: 'utf8', maxBuffer: 64 << 20 })
    .split('\n')
    .filter(Boolean);
}

/** The plugin's tracked files and its new files that aren't ignored. */
export function pluginFiles() {
  const rel = path.relative(REPO_DIR, PLUGIN_DIR);
  return gitLines('ls-files', '--cached', '--others', '--exclude-standard', '--', rel)
    .map((f) => path.join(REPO_DIR, f))
    .filter((f) => fs.existsSync(f) && fs.statSync(f).isFile());
}

/** Lines added under .planning/platform-audit/ since HEAD (staged or not), plus new unignored files there. */
export function addedPlanningLines(dir = PLANNING_DIR) {
  const out = [];
  let file = null;
  let n = 0;
  for (const l of gitLines('diff', 'HEAD', '--unified=0', '--no-color', '--', dir)) {
    if (l.startsWith('+++ ')) file = l.slice(4).replace(/^b\//, '');
    else if (l.startsWith('@@')) n = Number((l.match(/\+(\d+)/) || [0, 0])[1]);
    else if (l.startsWith('+') && file) out.push({ where: `${file}:${n++}`, text: l.slice(1) });
  }
  for (const f of gitLines('ls-files', '--others', '--exclude-standard', '--', dir)) {
    const text = scannable(path.join(REPO_DIR, f));
    if (text !== null) text.split('\n').forEach((t, i) => out.push({ where: `${f}:${i + 1}`, text: t }));
  }
  return out;
}

function main(argv) {
  const o = { paths: [], texts: [], added: false, hosts: true, quiet: false, deny: DENY_FILE };
  let allPaths = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (allPaths) o.paths.push(path.resolve(a));
    else if (a === '--paths') allPaths = true;
    else if (a === '--added') o.added = true;
    else if (a === '--deny-only') o.hosts = false;
    else if (a === '--quiet') o.quiet = true;
    else if (a === '--deny') o.deny = path.resolve(argv[++i] ?? '');
    else if (a === '--text') o.texts.push(argv[++i] ?? '');
    else if (a === '-') o.texts.push(...fs.readFileSync(0, 'utf8').split('\n'));
    else if (a.startsWith('--')) {
      console.error(`genericity: unknown option ${a}`);
      return 2;
    } else o.paths.push(path.resolve(a));
  }
  const deny = loadDenyList(o.deny);
  const notes = [];
  if (!deny) notes.push(`deny-list rule skipped: ${path.relative(REPO_DIR, o.deny) || o.deny} is absent`);

  let findings = [];
  let scope;
  if (o.added) {
    // D9: the deny-list part, over what this session adds under .planning/platform-audit/.
    const lines = addedPlanningLines();
    findings.push(...scanLines(lines, { hosts: false, deny }));
    scope = `${lines.length} added line(s) under ${PLANNING_DIR}/`;
  }
  if (o.texts.length) {
    findings.push(...scanLines(o.texts.map((text, i) => ({ where: `text:${i + 1}`, text })), { hosts: o.hosts, deny }));
    scope = [scope, `${o.texts.length} line(s) given`].filter(Boolean).join(', ');
  }
  if (o.paths.length) {
    const files = [];
    for (const p of o.paths) {
      if (!fs.existsSync(p)) {
        console.error(`genericity: no such file: ${p}`);
        return 2;
      }
      if (fs.statSync(p).isDirectory()) {
        const rel = path.relative(REPO_DIR, p);
        files.push(...gitLines('ls-files', '--cached', '--others', '--exclude-standard', '--', rel || '.').map((f) => path.join(REPO_DIR, f)));
      } else files.push(p);
    }
    findings.push(...scanFiles(files, { hosts: o.hosts, deny }));
    scope = [scope, `${files.length} file(s)`].filter(Boolean).join(', ');
  }
  if (!scope) {
    const files = pluginFiles();
    findings = scanFiles(files, { hosts: o.hosts, deny });
    scope = `${files.length} plugin file(s)`;
  }

  for (const n of notes) console.log(`note: ${n}`);
  // Never echo a deny-list term itself: say which rule and where.
  for (const f of findings) console.log(`${f.where}: ${f.rule === 'host' ? `host "${f.what}" is not allowed` : 'a deny-list term'}`);
  if (!o.quiet || findings.length) {
    console.log(`genericity: ${findings.length ? `${findings.length} finding(s)` : 'clean'} over ${scope}${deny ? ` (deny-list: ${deny.length} terms)` : ''}`);
  }
  return findings.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
