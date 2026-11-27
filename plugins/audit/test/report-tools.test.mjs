// Tests for the report tools (platform-audit S5): appendix.mjs, check-audit.mjs, the templates, and the
// dev scorer test/score-report.mjs, against the hand-written sample audit of the Partner Portal fixture.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SCRIPTS, FIXTURE, TRUTH, tmp } from './portal.mjs';
import { buildAppendix, OTHER_TITLE, SHARED_TITLE } from '../skills/platform-audit/scripts/appendix.mjs';
import { checkReport, CHECKS } from '../skills/platform-audit/scripts/check-audit.mjs';
import { scoreReport } from './score-report.mjs';
import { SAMPLE_DIR, CLEAN, DEFECTS, defectFile } from './samples/plant-defects.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES = path.resolve(HERE, '..', 'skills', 'platform-audit', 'templates');
const APPENDIX = path.join(SCRIPTS, 'appendix.mjs');
const CHECK = path.join(SCRIPTS, 'check-audit.mjs');
const SCORE = path.join(HERE, 'score-report.mjs');
const sample = (f) => path.join(SAMPLE_DIR, f);
const node = (script, args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });

let work, inv;
before(() => {
  // The inventory of the fixture's public files: the same code the sample's appendix was written from.
  work = tmp('report');
  inv = path.join(work, 'inventory.json');
  const r = node(path.join(SCRIPTS, 'inventory.mjs'), ['build', path.join(FIXTURE, 'public'), '--out', inv]);
  assert.equal(r.status, 0, r.stderr);
});

const appendixArgs = (out) => [
  inv, '--map', sample('label-map.json'), '--title', 'Partner Portal', '--out', out,
  '--build', 'index-3f9c2a71.js', '--date', '2026-11-27', '--report', CLEAN,
];
const checkArgs = (report) => [
  sample(report), '--inventory', inv, '--private', sample('private-terms.txt'), '--appendix', sample('appendix-ui-labels.md'), '--json',
];

// ---- appendix.mjs ---------------------------------------------------------------------------------------

test('the appendix is byte-identical across two runs, and matches the committed sample', () => {
  const a = path.join(work, 'a.md'), b = path.join(work, 'b.md');
  for (const out of [a, b]) assert.equal(node(APPENDIX, appendixArgs(out)).status, 0);
  const one = fs.readFileSync(a), two = fs.readFileSync(b);
  assert.ok(one.equals(two), 'two runs differ');
  assert.ok(one.equals(fs.readFileSync(sample('appendix-ui-labels.md'))), 'the committed appendix is stale: regenerate it');
});

test('the appendix: contents with counts, map order, prefix keys, Other, shared last, ids without text at the end', () => {
  const fake = {
    labels: {
      zeta: { 'zeta.a': 'Zed' },
      ordersList: { 'ordersList.b': 'Beta | pipe', 'ordersList.a': 'Alpha', 'ordersList.c': 'Alpha' },
      orderDetails: { 'orderDetails.x': 'Detail' },
      lib: { 'lib.ok': 'OK', 'lib.no': 'No' },
      stray: { 'stray.s': 'Stray' },
    },
    idsWithoutText: ['b.id', 'a.id', 'b.id'],
  };
  const map = { zeta: 'Zeta screen', 'order*': 'Orders', orderDetails: 'Order details', lib: 'shared' };
  const { md } = buildAppendix(fake, map, { title: 'Demo' });
  const heads = [...md.matchAll(/^## (.*)$/gm)].map((m) => m[1]);
  assert.deepEqual(heads, ['Contents', 'Zeta screen', 'Orders', 'Order details', OTHER_TITLE, SHARED_TITLE, 'Label ids without built-in text (2)']);
  assert.match(md, /^- Orders — 1 group, 3 labels$/m);
  assert.match(md, /^- Shared library .* — 1 group, 2 labels$/m);
  assert.match(md, /^- Label ids without built-in text — 2$/m);
  assert.match(md, /^\| `ordersList` \| Alpha · Beta \\\| pipe \|$/m, 'labels sorted by id, de-duplicated, pipes escaped');
  assert.match(md, /^\| `stray` \| Stray \|$/m);
  assert.match(md, /`a\.id` · `b\.id`\n$/);
  assert.doesNotMatch(md, /read on|build `/, 'no date or build unless given');
});

test('appendix.mjs: --help exits 0, usage errors exit 2', () => {
  assert.equal(node(APPENDIX, ['--help']).status, 0);
  assert.equal(node(APPENDIX, []).status, 2);
  assert.equal(node(APPENDIX, [inv, '--title', 'X', '--out', path.join(work, 'x.md')]).status, 2, 'no --map');
  assert.equal(node(APPENDIX, [...appendixArgs(path.join(work, 'x.md')), '--date', '27 Nov']).status, 2);
  assert.equal(node(APPENDIX, [...appendixArgs(path.join(work, 'x.md')), '--bogus']).status, 2);
});

// ---- check-audit.mjs ------------------------------------------------------------------------------------

test('check-audit passes the clean sample, with every check run', () => {
  const r = node(CHECK, checkArgs(CLEAN));
  assert.equal(r.status, 0, r.stdout);
  const out = JSON.parse(r.stdout);
  assert.equal(out.clean, true);
  assert.deepEqual(out.findings, []);
  assert.deepEqual(out.skipped, []);
});

test('the planted-defect copies are up to date with plant-defects.mjs', () => {
  const clean = fs.readFileSync(sample(CLEAN), 'utf8');
  for (const [check, plant] of Object.entries(DEFECTS)) {
    assert.equal(fs.readFileSync(sample(defectFile(check)), 'utf8'), plant(clean), `${defectFile(check)} is stale: rerun plant-defects.mjs`);
  }
});

for (const check of CHECKS) {
  test(`check-audit catches the planted ${check} defect, under ${check} only`, () => {
    assert.ok(DEFECTS[check], `no planted defect for ${check}`);
    const r = node(CHECK, checkArgs(defectFile(check)));
    assert.equal(r.status, 1, r.stdout);
    const out = JSON.parse(r.stdout);
    assert.ok(out.findings.length >= 1);
    assert.deepEqual([...new Set(out.findings.map((f) => f.check))], [check], JSON.stringify(out.findings));
  });
}

test('check-audit prints `<check>: <line>: <what>`, and never prints a private term whole', () => {
  const r = node(CHECK, checkArgs(defectFile('private')).filter((a) => a !== '--json'));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /^private: \d+: a private term appears/m);
  for (const t of TRUTH.privateTerms) assert.ok(!r.stdout.includes(t), 'the term is printed whole');
});

test('check-audit: private terms match without regard to case or spacing, and the appendix is checked too', () => {
  const text = fs.readFileSync(sample(CLEAN), 'utf8') + '\nSigned in as dana   EXAMPLE.\n';
  const { findings } = checkReport(text, { file: sample(CLEAN), privateTerms: ['Dana Example'] });
  assert.deepEqual(findings.map((f) => f.check), ['private']);

  const appendix = { file: path.join(SAMPLE_DIR, 'appendix-ui-labels.md'), text: '| a | b |\n|---|---|\n| only one |\nFIXME\n' };
  const r = checkReport(fs.readFileSync(sample(CLEAN), 'utf8'), { file: sample(CLEAN), appendix });
  assert.deepEqual(r.findings.map((f) => `${f.check} ${f.line}`), ['markers appendix-ui-labels.md:4', 'tables appendix-ui-labels.md:3']);
});

test('check-audit: markers, code fences and § references at a sentence end', () => {
  const base = fs.readFileSync(sample(CLEAN), 'utf8');
  const marks = checkReport(base + '\nTBD\n\nFIXME\n\n<!-- SECTION x -->\n\n{{name}}\n\nIn progress\n', { file: sample(CLEAN) });
  assert.equal(marks.findings.filter((f) => f.check === 'markers').length, 5);
  const fenced = checkReport(base + '\n```\n| a | b |\n|---|---|\n| one |\n§42\n```\n\nSee §9.\n', { file: sample(CLEAN) });
  assert.deepEqual(fenced.findings, []);
});

test('check-audit: the template flags its own placeholders, but has its keys, summary parts and tables', () => {
  const file = path.join(TEMPLATES, 'audit.md');
  const { findings } = checkReport(fs.readFileSync(file, 'utf8'), { file });
  const checks = new Set(findings.map((f) => f.check));
  assert.ok(checks.has('markers'), 'the SECTION comments are markers');
  for (const c of ['keys', 'summary', 'tables', 'xref']) assert.ok(!checks.has(c), `${c}: ${JSON.stringify(findings.filter((f) => f.check === c))}`);
});

test('check-audit: --help exits 0, usage errors exit 2', () => {
  assert.equal(node(CHECK, ['--help']).status, 0);
  assert.equal(node(CHECK, []).status, 2);
  assert.equal(node(CHECK, [path.join(work, 'missing.md')]).status, 2);
  assert.equal(node(CHECK, [sample(CLEAN), '--bogus']).status, 2);
  assert.equal(node(CHECK, [sample(CLEAN), '--inventory']).status, 2);
});

// ---- the templates --------------------------------------------------------------------------------------

test('the templates hold the report skeleton, the screen block and the progress log', () => {
  const audit = fs.readFileSync(path.join(TEMPLATES, 'audit.md'), 'utf8');
  for (const h of ['Executive summary', 'Requirements check (optional)', 'Platform architecture and access model', 'Navigation map',
    'Global interface', 'Screen-by-screen map', 'Screens not available to', 'Capability matrix', 'Limits, rules and constraints found',
    'Reference lists', 'Appendix A — Server operations', 'Appendix B — UI label inventory']) assert.ok(audit.includes(h), h);
  const screen = fs.readFileSync(path.join(TEMPLATES, 'screen.md'), 'utf8');
  for (const s of ['| Route |', '| Menu |', '| Who sees it |', '| State observed |', '**Purpose.**', '**Layout.**',
    '| Button | State seen | What it does |', '| Filter | Type | Options seen |', '**Toolbar.**', '| Column | Can hide? | Notes |',
    '**Pagination:**', '**Forms and dialogs**', '**Code-only notes**']) assert.ok(screen.includes(s), s);
  const progress = fs.readFileSync(path.join(TEMPLATES, 'progress.md'), 'utf8');
  for (const h of ['## Target', '## Answers', '## Decisions', '## Checklist', '## Rate-limit log', '## Resume point']) assert.ok(progress.includes(h), h);
});

// ---- score-report.mjs -----------------------------------------------------------------------------------

test('the scorer gives the clean sample full marks', () => {
  const r = scoreReport(fs.readFileSync(sample(CLEAN), 'utf8'), TRUTH);
  assert.equal(r.routeScore, 1, JSON.stringify(r.routes.filter((x) => !x.ok)));
  assert.equal(r.itemScore, 1, JSON.stringify(r.screens.filter((s) => s.missing.length)));
  const cli = node(SCORE, [sample(CLEAN)]);
  assert.equal(cli.status, 0, cli.stdout);
  assert.match(cli.stdout, /routes 100\.0% .* items 100\.0% .* PASS/);
});

test('the scorer puts a sample missing a screen below the threshold, and a wrong status below full routes', () => {
  const clean = fs.readFileSync(sample(CLEAN), 'utf8');
  const noOrders = clean.replace(/### 5\.2 Sales › Orders\n[\s\S]*?(?=### 5\.3 )/, '');
  assert.notEqual(noOrders, clean);
  const r = scoreReport(noOrders, TRUTH);
  assert.ok(r.itemScore < 0.9, `items ${r.itemScore}`);
  const file = path.join(work, 'no-orders.md');
  fs.writeFileSync(file, noOrders);
  assert.equal(node(SCORE, [file]).status, 1);

  const wrong = scoreReport(clean.replace('| 6 | `/payouts` | Payouts | 📄 |', '| 6 | `/payouts` | Payouts | ✅ |'), TRUTH);
  assert.ok(wrong.routeScore < 1);
  assert.deepEqual(wrong.routes.filter((x) => !x.ok).map((x) => x.path), ['/payouts']);
  assert.equal(node(SCORE, [sample(CLEAN), '--min-items', '2']).status, 2);
});
