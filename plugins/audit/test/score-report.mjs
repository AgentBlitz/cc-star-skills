#!/usr/bin/env node
// score-report.mjs — dev tool (platform-audit PLAN §5 S5, D15, D16): scores an audit of the Partner Portal
// fixture against fixtures/partner-portal/truth.json. Not shipped to users; the skill never calls it.
//
//   node test/score-report.mjs <report.md> [--truth <truth.json>] [--min-routes 1.0] [--min-items 0.9] [--json]
//
// Routes: a route scores when a table row holds it in backticks with a status the truth expects.
// Items: per screen, the share of its filters, columns, actions and form fields (dialogs' too) that the
// screen's ### block mentions. A block is found by its heading's last part, or loosely (singular or
// plural, the parent › child path joined: "Admin › Settings" for "Admin settings"). A screen truth marks
// `optional` (a signed-out page, which may be 🚪) is scored only when it has a block.
// Exit 0 at or above both thresholds, 1 below, 2 on a usage error.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_TRUTH = path.resolve(HERE, '..', 'fixtures', 'partner-portal', 'truth.json');
const STATUSES = ['✅', '📄', '🔗', '🚪', '⛔', '🔒'];

const cells = (row) => row.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim());
const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Every item truth expects a screen's block to mention, de-duplicated. */
export function itemsOf(screen) {
  const out = [...(screen.filters ?? []), ...(screen.columns ?? []), ...(screen.actions ?? []), ...(screen.fields ?? [])];
  for (const d of Object.values(screen.dialogs ?? {})) out.push(...(d.fields ?? []), ...(d.actions ?? []));
  return [...new Set(out)];
}

/** A heading's name parts: no number, route, emoji or parentheses; split at › and →. */
function headingParts(text) {
  const t = text
    .replace(/^\d+(?:\.\d+)*\.?\s*/, '')
    .replace(/`[^`]*`/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[\p{Extended_Pictographic}️]/gu, '')
    .trim();
  return t.split(/[›→]/).map(norm).filter(Boolean);
}

/** Each word in the singular, roughly: "Order details" and "Order detail" read the same. */
const loose = (s) => norm(s).split(' ').map((w) => (w.length > 3 && /[^s]s$/.test(w) ? w.slice(0, -1) : w)).join(' ');

/**
 * The names a heading may stand for, loosely: its last part ("Sales › Orders" → orders), its last two
 * parts joined ("Admin › Settings" → admin settings), and the whole path joined.
 */
function looseNames(parts) {
  const names = [parts.at(-1), parts.slice(-2).join(' '), parts.join(' ')];
  return [...new Set(names.filter(Boolean).map(loose))];
}

/** ### and #### blocks: { name, text } — the text runs to the next heading of the same or a higher level. */
function screenBlocks(lines) {
  const heads = [];
  lines.forEach((l, i) => {
    const m = /^(#{2,4})\s+(.*)$/.exec(l);
    if (m) heads.push({ i, level: m[1].length, text: m[2] });
  });
  return heads
    .filter((h) => h.level >= 3)
    .map((h) => {
      const next = heads.find((x) => x.i > h.i && x.level <= h.level);
      const parts = headingParts(h.text);
      return { name: parts.at(-1) ?? '', loose: looseNames(parts), text: lines.slice(h.i, next ? next.i : lines.length).join('\n') };
    });
}

/** The block for a truth screen: an exact match on the last part first, then a loose one. */
function blockFor(blocks, name) {
  return blocks.find((b) => b.name === norm(name)) ?? blocks.find((b) => b.loose.includes(loose(name)));
}

export function scoreReport(text, truth) {
  const lines = text.split(/\r?\n/);
  const rows = lines.filter((l) => l.trim().startsWith('|')).map(cells);

  const routes = truth.routes.map((r) => {
    const hits = rows.filter((c) => c.some((x) => x === `\`${r.path}\``));
    const found = [...new Set(hits.flatMap((c) => STATUSES.filter((s) => c.some((x) => x === s || x.startsWith(s + ' ')))))];
    return { path: r.path, expected: r.expected, found, ok: found.some((s) => r.expected.includes(s)) };
  });

  const blocks = screenBlocks(lines);
  const screens = Object.entries(truth.screens).flatMap(([name, s]) => {
    const block = blockFor(blocks, name);
    // an optional screen (a signed-out page the walk may never see, 🚪) counts only when it has a block
    if (s.optional && !block) return [];
    const items = itemsOf(s);
    const hay = block ? norm(block.text) : '';
    const missing = items.filter((it) => !hay.includes(norm(it)));
    return [{ screen: name, block: Boolean(block), items: items.length, mentioned: items.length - missing.length, missing }];
  });

  const totalItems = screens.reduce((n, s) => n + s.items, 0);
  const mentioned = screens.reduce((n, s) => n + s.mentioned, 0);
  return {
    routes,
    screens,
    routeScore: routes.length ? routes.filter((r) => r.ok).length / routes.length : 1,
    itemScore: totalItems ? mentioned / totalItems : 1,
  };
}

function main(argv) {
  const o = { report: null, truth: DEFAULT_TRUTH, minRoutes: 1.0, minItems: 0.9, json: false };
  let text, truth;
  try {
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      if (a === '--help' || a === '-h') {
        console.log('Usage: node test/score-report.mjs <report.md> [--truth <truth.json>] [--min-routes 1.0] [--min-items 0.9] [--json]');
        return 0;
      }
      if (a === '--json') o.json = true;
      else if (a === '--truth') o.truth = argv[++i];
      else if (a === '--min-routes' || a === '--min-items') {
        const v = Number(argv[++i]);
        if (!(v >= 0 && v <= 1)) throw new Error(`${a} takes a number from 0 to 1`);
        o[a === '--min-routes' ? 'minRoutes' : 'minItems'] = v;
      } else if (a.startsWith('--')) throw new Error(`unknown option ${a}`);
      else if (!o.report) o.report = a;
      else throw new Error(`unexpected argument ${a}`);
    }
    if (!o.report || !o.truth) throw new Error('name the report');
    text = fs.readFileSync(o.report, 'utf8');
    truth = JSON.parse(fs.readFileSync(o.truth, 'utf8'));
  } catch (e) {
    console.error(`score-report.mjs: ${e.message}`);
    return 2;
  }
  const r = scoreReport(text, truth);
  const pass = r.routeScore >= o.minRoutes && r.itemScore >= o.minItems;
  if (o.json) {
    console.log(JSON.stringify({ pass, ...r, thresholds: { routes: o.minRoutes, items: o.minItems } }, null, 2));
  } else {
    const pct = (x) => `${(x * 100).toFixed(1)}%`;
    console.log('| Route | Expected | Found | OK |\n|---|---|---|---|');
    for (const x of r.routes) console.log(`| \`${x.path}\` | ${x.expected.join(' ')} | ${x.found.join(' ') || '—'} | ${x.ok ? 'yes' : 'NO'} |`);
    console.log('\n| Screen | Block | Items | Mentioned | Missing |\n|---|---|---|---|---|');
    for (const s of r.screens) console.log(`| ${s.screen} | ${s.block ? 'yes' : 'NO'} | ${s.items} | ${s.mentioned} | ${s.missing.join(', ') || '—'} |`);
    console.log(`\nroutes ${pct(r.routeScore)} (min ${pct(o.minRoutes)}) · items ${pct(r.itemScore)} (min ${pct(o.minItems)}) · ${pass ? 'PASS' : 'BELOW THRESHOLD'}`);
  }
  return pass ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
