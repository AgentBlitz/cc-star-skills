#!/usr/bin/env node
// check-audit.mjs — checks a finished platform-audit report before it is handed over (platform-audit
// PLAN §2.6). Node ≥ 20, built-ins only. Prints each finding as `<check>: <line>: <what>`.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const USAGE = `Usage:
  node check-audit.mjs <report.md> [--inventory <inventory.json>] [--private <private-terms.txt>]
                       [--appendix <appendix-ui-labels.md>] [--json]

Checks a finished report. Each finding prints as  <check>: <line>: <what>.

  routes    every inventory route appears in the report in backticks (needs --inventory)
  private   no private term appears, whatever its case or spacing (needs --private)
  markers   no TODO, TBD, FIXME, <!-- SECTION, {{ or "In progress" is left
  tables    every table row has the header's number of columns
  xref      every §N or §N.N(.N) matches a numbered heading
  screens   every ### in the screen-by-screen map has a Route row, a State observed row and an
            evidence tag ([UI], [Code] or [UI + Code])
  keys      the reading key, the route status key and the capability key are all there
  links     relative links resolve
  summary   the executive summary has its six parts

--appendix also runs private, markers, tables and links over the appendix; its lines print as
<file>:<line>. --json prints { clean, findings: [{ check, line, what }], skipped }.

Exit 0 when clean, 1 with findings, 2 on a usage error.`;

export const CHECKS = ['routes', 'private', 'markers', 'tables', 'xref', 'screens', 'keys', 'links', 'summary'];

export const SUMMARY_PARTS = [
  ['What it is', /^\*\*What it is\b/i],
  ['What <role> can use', /^\*\*What .+? can use\b/i],
  ['Strengths', /^\*\*Strengths\b/i],
  ['Limitations and gaps', /^\*\*Limitations and gaps\b/i],
  ['Limits of this audit', /^\*\*Limits of this audit\b/i],
  ['Suggested next steps', /^\*\*Suggested next steps\b/i],
];
const ROUTE_STATUSES = ['✅', '📄', '🔗', '🚪', '⛔', '🔒'];
const CAPABILITY_STATUSES = ['✅', '🔒', '👁', '⚠️', '❌'];
const MARKERS = [
  ['TODO', /\bTODO\b/],
  ['TBD', /\bTBD\b/],
  ['FIXME', /\bFIXME\b/],
  ['<!-- SECTION', /<!--\s*SECTION/],
  ['{{', /\{\{/],
  ['In progress', /\bIn progress\b/],
];
const TAG = /\[(UI|Code|UI \+ Code)\]/;

/** Lines with their 1-based numbers, and whether each sits inside a code fence. */
function linesOf(text) {
  let fence = false;
  return text.split(/\r?\n/).map((raw, i) => {
    const isFence = /^\s*(```|~~~)/.test(raw);
    const inFence = fence || isFence;
    if (isFence) fence = !fence;
    return { n: i + 1, text: raw, code: inFence };
  });
}

/** The text of a line with inline code spans removed. */
const noCode = (s) => s.replace(/`[^`]*`/g, '');
const cells = (row) => {
  let s = row.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/);
};
const isSeparator = (row) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(row);

/** Headings: { n, level, text, number } — number is "3" or "6.2.1" for a numbered heading. */
function headingsOf(lines) {
  const out = [];
  for (const l of lines) {
    if (l.code) continue;
    const m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(l.text);
    if (!m) continue;
    const num = /^(\d+(?:\.\d+)*)\.?(?:\s|$)/.exec(m[2]);
    out.push({ n: l.n, level: m[1].length, text: m[2], number: num ? num[1] : null });
  }
  return out;
}

/** The lines of the section a heading opens: up to the next heading of the same or a higher level. */
function sectionLines(lines, headings, h) {
  const next = headings.find((x) => x.n > h.n && x.level <= h.level);
  return lines.filter((l) => l.n > h.n && (!next || l.n < next.n));
}

/** Paragraphs (runs of non-blank lines outside code), each { n, text }. */
function paragraphs(lines) {
  const out = [];
  let cur = null;
  for (const l of lines) {
    if (l.code || !l.text.trim()) { cur = null; continue; }
    const t = l.text.replace(/^\s*>\s?/, '');
    if (!cur) out.push((cur = { n: l.n, text: t }));
    else cur.text += ' ' + t;
  }
  return out;
}

const squash = (s) => s.toLowerCase().replace(/[\s_\-.]+/g, '');

/** The checks that apply to any markdown file. `where` turns a line number into the printed location. */
function checkCommon(text, { privateTerms, file, where }) {
  const lines = linesOf(text);
  const out = [];
  const add = (check, n, what) => out.push({ check, line: where(n), what });

  if (privateTerms) {
    const terms = privateTerms.map((t) => [t, squash(t)]).filter(([, s]) => s);
    for (const l of lines) {
      const s = squash(l.text);
      for (const [t, q] of terms) if (s.includes(q)) add('private', l.n, `a private term appears ("${t.slice(0, 2)}…", ${t.length} characters)`);
    }
  }

  for (const l of lines) {
    for (const [name, re] of MARKERS) if (re.test(l.text)) add('markers', l.n, `leftover marker ${name}`);
  }

  for (let i = 0; i + 1 < lines.length; i++) {
    const head = lines[i], sep = lines[i + 1];
    if (head.code || !head.text.trim().startsWith('|') || !isSeparator(sep.text)) continue;
    if (i > 0 && lines[i - 1].text.trim().startsWith('|') && !lines[i - 1].code) continue;
    const width = cells(head.text).length;
    if (cells(sep.text).length !== width) add('tables', sep.n, `the separator has ${cells(sep.text).length} columns, the header ${width}`);
    for (let j = i + 2; j < lines.length && !lines[j].code && lines[j].text.trim().startsWith('|'); j++) {
      const w = cells(lines[j].text).length;
      if (w !== width) add('tables', lines[j].n, `the row has ${w} columns, the header ${width}`);
    }
  }

  const dir = path.dirname(path.resolve(file));
  for (const l of lines) {
    if (l.code) continue;
    for (const m of noCode(l.text).matchAll(/!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
      const target = m[1];
      if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#') || target.startsWith('//')) continue;
      const p = decodeURIComponent(target.split('#')[0].split('?')[0]);
      if (!p) continue;
      if (!fs.existsSync(path.resolve(dir, p))) add('links', l.n, `the link to ${target} doesn't resolve`);
    }
  }
  return out;
}

/**
 * Check a report. Returns { findings: [{ check, line, what }], skipped: [check] }.
 * opts: { file, inventory, privateTerms, appendix: { file, text } }
 */
export function checkReport(text, opts = {}) {
  const file = opts.file ?? 'report.md';
  const lines = linesOf(text);
  const headings = headingsOf(lines);
  const findings = [];
  const skipped = [];
  const add = (check, line, what) => findings.push({ check, line, what });

  // routes
  if (opts.inventory) {
    const inline = new Set();
    for (const l of lines) if (!l.code) for (const m of l.text.matchAll(/`([^`]+)`/g)) inline.add(m[1].trim());
    for (const r of opts.inventory.routes ?? []) {
      if (!inline.has(r.path)) add('routes', 0, `the route \`${r.path}\` is not in the report in backticks`);
    }
  } else skipped.push('routes');

  if (!opts.privateTerms) skipped.push('private');
  findings.push(...checkCommon(text, { privateTerms: opts.privateTerms, file, where: (n) => n }));

  // xref
  const numbers = new Set(headings.filter((h) => h.number).map((h) => h.number));
  for (const l of lines) {
    if (l.code) continue;
    for (const m of noCode(l.text).matchAll(/§\s?(\d+(?:\.\d+){0,2})/g)) {
      if (!numbers.has(m[1])) add('xref', l.n, `§${m[1]} matches no numbered heading`);
    }
  }

  // screens
  const map = headings.find((h) => h.level === 2 && /screen-by-screen/i.test(h.text));
  if (!map) add('screens', 0, 'there is no "Screen-by-screen map" section');
  else {
    const end = headings.find((h) => h.n > map.n && h.level <= 2);
    const blocks = headings.filter((h) => h.level === 3 && h.n > map.n && (!end || h.n < end.n));
    if (!blocks.length) add('screens', map.n, 'the screen-by-screen map has no ### screen blocks');
    for (const h of blocks) {
      const own = sectionLines(lines, headings, h);
      const rows = own.filter((l) => !l.code && l.text.trim().startsWith('|')).map((l) => cells(l.text).map((c) => c.trim().replace(/\*\*/g, '')));
      const label = `"${h.text}"`;
      if (!rows.some((r) => /^Route$/i.test(r[0]) && (r[1] ?? '').trim())) add('screens', h.n, `${label} has no Route row`);
      if (!rows.some((r) => /^State observed$/i.test(r[0]) && (r[1] ?? '').trim())) add('screens', h.n, `${label} has no State observed row`);
      if (!own.some((l) => !l.code && TAG.test(l.text)) && !TAG.test(h.text)) add('screens', h.n, `${label} has no evidence tag`);
    }
  }

  // keys
  const paras = paragraphs(lines);
  const reading = paras.find((p) => /How to read this document/i.test(p.text));
  if (!reading) add('keys', 0, 'the reading key ("How to read this document") is missing');
  else {
    const missing = ['[UI]', '[Code]', '[UI + Code]'].filter((t) => !reading.text.includes(t));
    if (missing.length) add('keys', reading.n, `the reading key doesn't explain ${missing.join(', ')}`);
  }
  const statusKey = paras.find((p) => /^\**Status key\b/i.test(p.text));
  if (!statusKey) add('keys', 0, 'the route status key ("Status key: …") is missing');
  else {
    const missing = ROUTE_STATUSES.filter((s) => !statusKey.text.includes(s));
    if (missing.length) add('keys', statusKey.n, `the route status key lacks ${missing.join(' ')}`);
  }
  const capHeading = headings.find((h) => h.level === 2 && /capability matrix/i.test(h.text));
  const capKey = capHeading && paragraphs(sectionLines(lines, headings, capHeading)).find((p) => /^\**Key\b/i.test(p.text));
  if (!capKey) add('keys', capHeading ? capHeading.n : 0, 'the capability key ("Key: …" under the capability matrix) is missing');
  else {
    const missing = CAPABILITY_STATUSES.filter((s) => !capKey.text.includes(s));
    if (missing.length) add('keys', capKey.n, `the capability key lacks ${missing.join(' ')}`);
  }

  // summary
  const sum = headings.find((h) => h.level === 2 && /executive summary/i.test(h.text));
  if (!sum) add('summary', 0, 'there is no "Executive summary" section');
  else {
    const body = sectionLines(lines, headings, sum).filter((l) => !l.code).map((l) => l.text.trim());
    for (const [name, re] of SUMMARY_PARTS) {
      if (!body.some((t) => re.test(t))) add('summary', sum.n, `the executive summary lacks "${name}"`);
    }
  }

  // the appendix
  if (opts.appendix) {
    const base = path.basename(opts.appendix.file);
    findings.push(
      ...checkCommon(opts.appendix.text, { privateTerms: opts.privateTerms, file: opts.appendix.file, where: (n) => `${base}:${n}` })
        .filter((f) => f.check !== 'xref'),
    );
  }

  const rank = (f) => CHECKS.indexOf(f.check);
  const lineKey = (l) => (typeof l === 'number' ? [0, l] : [1, Number(String(l).split(':').pop())]);
  findings.sort((a, b) => {
    const [ka, na] = lineKey(a.line), [kb, nb] = lineKey(b.line);
    return rank(a) - rank(b) || ka - kb || na - nb;
  });
  return { findings, skipped };
}

function parseArgs(argv) {
  const o = { report: null, inventory: null, private: null, appendix: null, json: false };
  const takes = { '--inventory': 'inventory', '--private': 'private', '--appendix': 'appendix' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') return { help: true };
    if (a === '--json') o.json = true;
    else if (takes[a]) {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      o[takes[a]] = argv[++i];
    } else if (a.startsWith('--')) throw new Error(`unknown option ${a}`);
    else if (!o.report) o.report = a;
    else throw new Error(`unexpected argument ${a}`);
  }
  if (!o.report) throw new Error('name the report');
  return o;
}

function main(argv) {
  let o, text, opts;
  try {
    o = parseArgs(argv);
    if (o.help) {
      console.log(USAGE);
      return 0;
    }
    text = fs.readFileSync(o.report, 'utf8');
    opts = { file: o.report };
    if (o.inventory) opts.inventory = JSON.parse(fs.readFileSync(o.inventory, 'utf8'));
    if (o.private) {
      opts.privateTerms = fs.readFileSync(o.private, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    }
    if (o.appendix) opts.appendix = { file: o.appendix, text: fs.readFileSync(o.appendix, 'utf8') };
  } catch (e) {
    console.error(`check-audit.mjs: ${e.message}\n\n${USAGE}`);
    return 2;
  }
  const { findings, skipped } = checkReport(text, opts);
  if (o.json) console.log(JSON.stringify({ clean: findings.length === 0, findings, skipped }, null, 2));
  else {
    for (const f of findings) console.log(`${f.check}: ${f.line}: ${f.what}`);
    const note = skipped.length ? ` (skipped: ${skipped.join(', ')})` : '';
    console.log(findings.length ? `${findings.length} finding(s) in ${o.report}${note}` : `clean: ${o.report}${note}`);
  }
  return findings.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
