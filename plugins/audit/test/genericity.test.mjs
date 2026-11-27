import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as g from './genericity.mjs';

// Every host and term below is made up, and the hosts are built at run time so that this file
// never holds a disallowed host itself.
const corp = ['portal', 'acme-corp', 'com'].join('.');
const CLI = new URL('./genericity.mjs', import.meta.url).pathname;
const run = (...args) => spawnSync('node', [CLI, ...args], { encoding: 'utf8', cwd: g.REPO_DIR });

function tempDeny(body = '# made-up terms\nZORBLAX\n4242424242\nQuux Person\n') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-deny-'));
  const file = path.join(dir, 'deny.txt');
  fs.writeFileSync(file, body);
  return { dir, file };
}

test('the host rule allows only localhost, 127.0.0.1, 0.0.0.0, example.* and the repo', () => {
  assert.deepEqual(
    g.hostFindings('http://localhost:3000/x http://127.0.0.1:4310 http://0.0.0.0:80 https://app.example.com/a fixture@example.org'),
    [],
  );
  assert.deepEqual(g.hostFindings('`http://${host}:${port}` and set.app and probe.js and 1.63.0'), []);
  assert.deepEqual(g.hostFindings(`see https://${corp}/admin and ${corp}`), [corp]);
  const co = ['agents', 'zorblax', 'co'].join('.');
  assert.deepEqual(g.hostFindings(`open ${co} in Chrome`), [co]);
  const io = ['acme-corp', 'io'].join('.');
  assert.deepEqual(g.hostFindings(`mail someone@${io}`), [io]);
  const ip = [10, 1, 2, 3].join('.');
  assert.deepEqual(g.hostFindings(`ssh ${ip}`), [ip]);
  const repo = ['github', 'com'].join('.');
  assert.deepEqual(g.hostFindings(`https://${repo}/AgentBlitz/cc-star-skills`), []);
  assert.deepEqual(g.hostFindings(`https://${repo}/someone/else`), [repo]);
  const w3 = ['www', 'w3', 'org'].join('.');
  assert.deepEqual(g.hostFindings(`xmlns="http://${w3}/2000/svg"`), [w3]);
});

test('the deny-list matches whole terms, case-insensitively, across separators, and never prints them', () => {
  const { dir, file } = tempDeny();
  assert.deepEqual(g.loadDenyList(file), ['ZORBLAX', '4242424242', 'Quux Person']);
  const m = g.denyMatcher(g.loadDenyList(file));
  assert.deepEqual(m('space zorblax here'), ['ZORBLAX']);
  assert.deepEqual(m('uid 4242424242'), ['4242424242']);
  for (const form of ['quux person', 'quux-person', 'QUUX_PERSON', 'quux+person']) assert.deepEqual(m(`by ${form}`), ['Quux Person']);
  assert.deepEqual(m('ZORBLAXES 14242424242 quuxperson'), []);
  const r = run('--deny', file, '--text', 'a ZORBLAX b');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /text:1: a deny-list term/);
  assert.doesNotMatch(r.stdout, /ZORBLAX/i);
  fs.rmSync(dir, { recursive: true });
});

test('with no deny-list the rule is skipped, with a note', () => {
  assert.equal(g.loadDenyList('/nonexistent/deny.txt'), null);
  const r = run('--deny', '/nonexistent/deny.txt', '--text', 'plain');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /note: deny-list rule skipped/);
});

test('--text checks the lines given, and - reads them from stdin', () => {
  const { dir, file } = tempDeny();
  assert.equal(run('--deny', file, '--text', 'clean', '--text', `see ${corp}`).status, 1);
  const r = spawnSync('node', [CLI, '--deny', file, '-'], { encoding: 'utf8', input: 'one\nzorblax two\n' });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /text:2: a deny-list term/);
  assert.equal(run('--deny', file, '--deny-only', '--text', `see ${corp}`).status, 0);
  assert.equal(run('--bogus').status, 2);
  fs.rmSync(dir, { recursive: true });
});

test('<path>… and --paths check the files given, both rules', () => {
  const { dir, file } = tempDeny();
  const dirty = path.join(dir, 'dirty.md');
  const clean = path.join(dir, 'clean.md');
  fs.writeFileSync(dirty, `line one\nby Quux Person at ${corp}\n`);
  fs.writeFileSync(clean, 'nothing to see on http://127.0.0.1:4000\n');
  const r = run('--deny', file, dirty, clean);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /dirty\.md:2: host/);
  assert.match(r.stdout, /dirty\.md:2: a deny-list term/);
  assert.match(r.stdout, /2 finding\(s\) over 2 file\(s\)/);
  assert.equal(run('--deny', file, '--paths', clean).status, 0);
  assert.equal(run('--deny', file, '--paths', clean, dirty).status, 1);
  assert.equal(run('--deny', file, path.join(dir, 'missing.md')).status, 2);
  fs.rmSync(dir, { recursive: true });
});

test('--added checks new unignored files under .planning/platform-audit/', () => {
  const { dir, file } = tempDeny();
  const probe = path.join(g.REPO_DIR, g.PLANNING_DIR, `.genericity-test-${process.pid}.md`);
  try {
    fs.writeFileSync(probe, 'fine\nnamed zorblax here\n');
    const lines = g.addedPlanningLines();
    assert.ok(lines.some((l) => l.where.endsWith(`${path.basename(probe)}:2`)));
    const r = run('--deny', file, '--added');
    assert.equal(r.status, 1);
    assert.match(r.stdout, new RegExp(`${path.basename(probe).replace(/\./g, '\\.')}:2: a deny-list term`));
  } finally {
    fs.rmSync(probe, { force: true });
    fs.rmSync(dir, { recursive: true });
  }
});

test('the default mode covers the plugin and its new unignored files, and the plugin is generic', () => {
  const files = g.pluginFiles();
  assert.ok(files.some((f) => f.endsWith(path.join('skills', 'platform-audit', 'SKILL.md'))));
  assert.ok(files.some((f) => f.endsWith('genericity.mjs')));
  assert.ok(!files.some((f) => f.includes(`${path.sep}node_modules${path.sep}`) || f.includes(`${path.sep}.out${path.sep}`)));
  const deny = g.loadDenyList();
  if (!deny) console.log(`note: deny-list rule skipped: ${g.DENY_FILE} is absent`);
  const findings = g.scanFiles(files, { hosts: true, deny });
  assert.deepEqual(findings.map((f) => `${f.where}: ${f.rule}`), []);
});
