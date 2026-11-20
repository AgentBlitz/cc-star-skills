import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { stageFixture, git, FIXTURE_DIR, PLUGIN_DIR, CANARY_PREFIX } from './stage.mjs';

test('staging copies the fixture into its own git repo, outside cc-star-skills', () => {
  const s = stageFixture({ variant: 'v1' });
  try {
    assert.ok(!s.dir.startsWith(PLUGIN_DIR));
    assert.equal(fs.realpathSync(git(s.dir, 'rev-parse', '--show-toplevel').trim()), fs.realpathSync(s.dir));
    const tracked = git(s.dir, 'ls-files').trim().split('\n').sort();
    for (const f of ['.gitignore', 'CLAUDE.md', 'README.md', 'lib.mjs', 'package.json', 'release.json', 'reset.mjs', 'server.mjs', 'sign-in.mjs']) assert.ok(tracked.includes(f), f);
    assert.ok(!tracked.some((f) => f.startsWith('private/') || f.startsWith('data/')));
    assert.equal(git(s.dir, 'status', '--porcelain').trim(), '');
    assert.equal(git(s.dir, 'log', '--format=%s').trim(), 'Leave Planner 1.0');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(s.dir, 'release.json'), 'utf8')), { release: '1.0', variant: 'v1' });
  } finally {
    s.cleanup();
  }
  assert.ok(!fs.existsSync(s.dir));
});

test('the canary is fresh each time, lives only in the ignored private/, and never in git', () => {
  const a = stageFixture();
  const b = stageFixture({ variant: 'v2' });
  try {
    assert.match(a.canary, new RegExp(`^${CANARY_PREFIX}[0-9a-f]{16}$`));
    assert.notEqual(a.canary, b.canary);
    assert.ok(fs.readFileSync(path.join(a.dir, 'private', 'hr-notes.md'), 'utf8').includes(a.canary));
    assert.equal(fs.readFileSync(a.canaryFile, 'utf8').trim(), a.canary);
    assert.ok(!a.canaryFile.startsWith(a.dir + path.sep));
    assert.equal(git(a.dir, 'check-ignore', 'private/hr-notes.md').trim(), 'private/hr-notes.md');
    const history = git(a.dir, 'log', '-p', '--all');
    assert.ok(!history.includes(a.canary));
    assert.ok(!history.includes(CANARY_PREFIX));
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(b.dir, 'release.json'), 'utf8')), { release: '1.1', variant: 'v2' });
  } finally {
    a.cleanup();
    b.cleanup();
  }
});

test('the fixture in place holds no private/, data/ or canary', () => {
  assert.ok(!fs.existsSync(path.join(FIXTURE_DIR, 'private')));
  for (const f of fs.readdirSync(FIXTURE_DIR)) {
    const p = path.join(FIXTURE_DIR, f);
    if (fs.statSync(p).isFile()) assert.ok(!fs.readFileSync(p, 'utf8').includes(CANARY_PREFIX), f);
  }
});

test('--into refuses a non-empty folder; the CLI prints the staged dir', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stage-into-'));
  fs.writeFileSync(path.join(dir, 'x'), '');
  assert.throws(() => stageFixture({ into: dir }), /non-empty/);
  const target = path.join(dir, 'copy');
  const out = execFileSync('node', [new URL('./stage.mjs', import.meta.url).pathname, '--variant', 'v2', '--into', target], { encoding: 'utf8' });
  assert.equal(out.trim(), target);
  assert.ok(fs.existsSync(path.join(target, '.git')));
  assert.deepEqual(fs.readdirSync(dir).sort(), ['copy', 'x']); // no canary file beside it unless asked
  assert.throws(() => stageFixture({ into: path.join(dir, 'c2'), canaryFile: path.join(dir, 'c2', 'k') }), /outside/);
  fs.rmSync(dir, { recursive: true });
});
