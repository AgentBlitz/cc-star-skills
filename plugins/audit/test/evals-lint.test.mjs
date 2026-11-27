// Lint for the plugin's evals (platform-audit S7). Nothing here runs an eval: they are billed, and
// this roadmap runs none (PLAN D17). Node has no YAML parser, so case.yaml is checked line by line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN = path.resolve(HERE, '..');
const EVALS = path.join(PLUGIN, 'evals');
const CASES = fs.readdirSync(EVALS, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(EVALS, d.name, 'case.yaml')))
  .map((d) => d.name);
const caseText = (name) => fs.readFileSync(path.join(EVALS, name, 'case.yaml'), 'utf8');

/** The graders of a case as { type, name, target, pattern, match } objects, read line by line. */
function graders(text) {
  const out = [];
  const block = text.split(/^graders:\s*$/m)[1] ?? '';
  for (const line of block.split('\n')) {
    if (/^\S/.test(line)) break;
    const start = line.match(/^ {2}- type: (\S+)/);
    if (start) { out.push({ type: start[1] }); continue; }
    const kv = line.match(/^ {4}(\w+): (.*)$/);
    if (kv && out.length) out.at(-1)[kv[1]] = kv[2].startsWith('"') ? JSON.parse(kv[2]) : kv[2];
  }
  return out;
}

/** A grader's pattern as a JS RegExp: a leading (?i) becomes the i flag. */
const toRegExp = (p) => (p.startsWith('(?i)') ? new RegExp(p.slice(4), 'i') : new RegExp(p));

test('there are the three cases of PLAN D11', () => {
  assert.deepEqual(CASES.sort(), ['platform-audit-check', 'platform-audit-headless-round-1', 'platform-audit-no-chrome']);
});

for (const name of CASES) {
  test(`${name}: required keys, its name, a prompt, graders`, () => {
    const text = caseText(name);
    assert.match(text, /^schema_version: "?1\.0"?$/m);
    assert.match(text, new RegExp(`^name: ${name}$`, 'm'), 'the name matches its folder');
    assert.match(name, /^platform-audit-/);
    assert.match(text, /^execution:\n(?: {2}.*\n)*? {2}prompt: \S/m, 'execution.prompt');
    assert.match(text, /^graders:\n {2}- type: /m);
    assert.ok(graders(text).length >= 3, 'at least three graders');
  });

  test(`${name}: every grader has a known type and a name, and its regex compiles`, () => {
    for (const g of graders(caseText(name))) {
      assert.ok(['regex', 'tool_used', 'file_exists'].includes(g.type), `${g.name}: type ${g.type}`);
      assert.ok(g.name, `a ${g.type} grader without a name`);
      for (const key of ['pattern', 'input_match']) if (g[key]) assert.doesNotThrow(() => toRegExp(g[key]), `${g.name}.${key}`);
    }
  });

  test(`${name}: its scaffold script exists and is executable`, () => {
    const m = caseText(name).match(/^ {2}scaffold_script: (\S+)$/m);
    assert.ok(m, 'context.scaffold_script');
    const file = path.join(EVALS, name, m[1]);
    assert.ok(fs.existsSync(file), `${m[1]} exists`);
    assert.ok(fs.statSync(file).mode & 0o111, `${m[1]} is executable`);
    assert.equal(spawnSync('bash', ['-n', file]).status, 0, `bash -n ${m[1]}`);
  });
}

test('the headless graders match the round interview.md prints, and the no-chrome ones a stop', () => {
  const interview = fs.readFileSync(path.join(PLUGIN, 'skills', 'platform-audit', 'reference', 'interview.md'), 'utf8');
  const round1 = interview.match(/```\n(platform-audit needs your answers \(Round 1 of 2\)[\s\S]*?)```/)[1];
  for (const g of graders(caseText('platform-audit-headless-round-1'))) {
    if (g.type === 'regex' && g.target === 'last_message') assert.match(round1, toRegExp(g.pattern), g.name);
  }
  const stop = "Claude in Chrome isn't connected, so I've stopped: nothing was opened or written.";
  for (const g of graders(caseText('platform-audit-no-chrome'))) {
    if (g.type !== 'regex' || g.target !== 'last_message') continue;
    if (g.match === 'not_contains') assert.doesNotMatch(stop, toRegExp(g.pattern), g.name);
    else assert.match(stop, toRegExp(g.pattern), g.name);
  }
});

test('the check scaffold plants exactly the checks its graders name', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-evals-lint-'));
  try {
    const run = spawnSync('bash', [path.join(EVALS, 'platform-audit-check', 'scaffold.sh')], { cwd: dir, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    const report = 'docs/partner-portal-audit/PARTNER-PORTAL-PLATFORM-AUDIT.md';
    const check = spawnSync('node', [path.join(PLUGIN, 'skills', 'platform-audit', 'scripts', 'check-audit.mjs'), report,
      '--appendix', 'docs/partner-portal-audit/appendix-ui-labels.md', '--json'], { cwd: dir, encoding: 'utf8' });
    const found = [...new Set(JSON.parse(check.stdout).findings.map((f) => f.check))].sort();
    const named = graders(caseText('platform-audit-check'))
      .map((g) => g.name.match(/^names-(\w+)$/)?.[1]).filter(Boolean).sort();
    assert.deepEqual(found, named);
    assert.ok(fs.existsSync(path.join(dir, 'README.md')));
    assert.ok(!fs.existsSync(path.join(dir, '.platform-audit')), 'no work folder, so routes and private are skipped');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the trigger set has 20 realistic queries, at least 8 of each kind', () => {
  const set = JSON.parse(fs.readFileSync(path.join(EVALS, 'triggers', 'platform-audit.json'), 'utf8'));
  assert.equal(set.length, 20);
  for (const q of set) {
    assert.equal(typeof q.query, 'string');
    assert.ok(q.query.length >= 40, `too short to be realistic: ${q.query}`);
    assert.equal(typeof q.should_trigger, 'boolean');
  }
  assert.ok(set.filter((q) => q.should_trigger).length >= 8);
  assert.ok(set.filter((q) => !q.should_trigger).length >= 8);
  assert.equal(new Set(set.map((q) => q.query)).size, 20, 'no duplicates');
});

test('run.sh parses, stages without node_modules, never publishes, and says the runs are billed', () => {
  const file = path.join(EVALS, 'run.sh');
  assert.equal(spawnSync('bash', ['-n', file]).status, 0);
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /--exclude node_modules/);
  assert.match(text, /--no-publish/);
  assert.match(text, /--trust-plugin/);
  assert.match(text, /evals\/results/);
  assert.match(text, /BILLED[\s\S]*D17/);
});
