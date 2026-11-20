import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as g from './genericity.mjs';

// Built at run time so that this file never holds a disallowed host itself.
const corp = ['intranet', 'acme-corp', 'com'].join('.');

test('the host rule allows only localhost, 127.0.0.1, example.* and the listed exceptions', () => {
  assert.deepEqual(g.hostFindings('http://localhost:3000/x and http://127.0.0.1:4310 and https://wiki.example.com/a and fixture@example.com'), []);
  assert.deepEqual(g.hostFindings('<svg xmlns="http://www.w3.org/2000/svg">'), []);
  assert.deepEqual(g.hostFindings('`http://${host}:${port}` and set.app and kit-core.mjs and 1.63.0'), []);
  assert.deepEqual(g.hostFindings(`see https://${corp}/spaces/X and ${corp}`), [corp]);
  const io = ['acme-corp', 'io'].join('.');
  assert.deepEqual(g.hostFindings(`mail someone@${io}`), [io]);
  const ip = [10, 1, 2, 3].join('.');
  assert.deepEqual(g.hostFindings(`ssh ${ip}`), [ip]);
  const repo = ['github', 'com'].join('.');
  assert.deepEqual(g.hostFindings(`https://${repo}/AgentBlitz/cc-star-skills`), []);
  assert.deepEqual(g.hostFindings(`https://${repo}/someone/else`), [repo]);
});

test('the deny-list matches whole terms, case-insensitively, and never prints them', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deny-'));
  const file = path.join(dir, 'deny.txt');
  fs.writeFileSync(file, '# comment\nZORBLAX\n4242424242\nQuux Person\n');
  assert.deepEqual(g.loadDenyList(file), ['ZORBLAX', '4242424242', 'Quux Person']);
  const m = g.denyMatcher(g.loadDenyList(file));
  assert.deepEqual(m('space zorblax here'), ['ZORBLAX']);
  assert.deepEqual(m('page 4242424242'), ['4242424242']);
  assert.deepEqual(m('by quux+person'), ['Quux Person']);
  assert.deepEqual(m('ZORBLAXES 14242424242'), []);
  const cli = new URL('./genericity.mjs', import.meta.url).pathname;
  const r = spawnSync('node', [cli, '--deny', file, '--text', 'a ZORBLAX b'], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /text:1: a deny-list term/);
  assert.doesNotMatch(r.stdout, /ZORBLAX/);
  fs.rmSync(dir, { recursive: true });
});

test('with no deny-list the rule is skipped, with a note', () => {
  assert.equal(g.loadDenyList('/nonexistent/deny.txt'), null);
  const cli = new URL('./genericity.mjs', import.meta.url).pathname;
  const r = spawnSync('node', [cli, '--deny', '/nonexistent/deny.txt', '--text', 'plain'], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /note: deny-list rule skipped/);
});

test('the plugin itself is generic (tracked files and new unignored files)', () => {
  const files = g.pluginFiles();
  assert.ok(files.some((f) => f.endsWith('guide-set.mjs')));
  assert.ok(!files.some((f) => f.includes(`${path.sep}node_modules${path.sep}`)));
  const deny = g.loadDenyList();
  if (!deny) console.log(`note: deny-list rule skipped: ${g.DENY_FILE} is absent`);
  const findings = g.scanFiles(files, { hosts: true, deny });
  assert.deepEqual(findings.map((f) => `${f.where}: ${f.rule}`), []);
});
