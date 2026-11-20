// wiki-guides' screenshots (Session 6): shots-kit.mjs gives a project its shots.mjs and a
// stamped guides-kit.mjs; shots.mjs takes every shot of the frozen guide set (R15) on staged
// copies of the fixture (R13); swap-shots.mjs puts them in the guides. The gate: every fixture
// shot taken, a walk and a shot agree on every fingerprint (R12), and after v2 the fingerprints
// flag, and swap-shots updates, exactly the shots of R14's table (R28's oracle).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { stageFixture, releaseV2 } from './stage.mjs';
import { startFixture, browserAvailable, DEV_PLAYWRIGHT, PLUGIN_DIR, SCRIPTS } from './helpers.mjs';
import { loadGuideSet, saveGuideSet, addShot, moveShot } from '../skills/write-guides/scripts/guide-set.mjs';
import { createWalk, loadOutline, shotFingerprint } from '../skills/write-guides/scripts/walk-lib.mjs';
import { mustRetake } from '../evals/scripted/write-guides-refresh-v2/graders/refresh.mjs';
import { stampedKit, kitStatus, shotBlocks, shotsNamedIn, install, check, KIT_TEMPLATE } from '../skills/wiki-guides/scripts/shots-kit.mjs';
import { swapShots, rewriteLinks } from '../skills/wiki-guides/scripts/swap-shots.mjs';
import { pngSize } from '../skills/wiki-guides/templates/guides-kit.mjs';

const WIKI = path.join(PLUGIN_DIR, 'skills', 'wiki-guides', 'scripts');
const FROZEN = path.join(PLUGIN_DIR, 'fixtures', 'leave-app-guides', 'docs');
const SET = 'docs/user-guides/guides.json';
const ENV = { EVAL_LEAVE_APP: '1', USER_GUIDES_PLAYWRIGHT_CORE: DEV_PLAYWRIGHT };
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const cleanups = [];
after(async () => {
  for (const c of cleanups.reverse()) await c();
});

const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const run = (cwd, args, env = {}) => spawnSync('node', args, { cwd, env: { ...process.env, ...ENV, ...env }, encoding: 'utf8' });
const shots = (cwd, ...args) => run(cwd, ['scripts/user-guides/shots.mjs', ...args]);
const manifestOf = (dir) => JSON.parse(fs.readFileSync(path.join(dir, '.user-guides/out/shots.json'), 'utf8')).shots;

/** The frozen guide set in a plain temp dir (no app): enough for shots-kit and swap-shots. */
function frozenDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'user-guides-shots-'));
  cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.cpSync(FROZEN, path.join(dir, 'docs'), { recursive: true });
  return dir;
}

/** A staged fixture with the frozen guide set, served, walked (fetch), with shots.mjs installed. */
async function project(variant = 'v1') {
  const st = stageFixture({ variant });
  fs.cpSync(FROZEN, path.join(st.dir, 'docs'), { recursive: true });
  const p = { dir: st.dir, setFile: path.join(st.dir, SET), app: await startFixture(st.dir) };
  cleanups.push(() => st.cleanup(), () => p.app.stop());
  const set = loadGuideSet(p.setFile);
  set.app.baseUrl = p.app.url;
  saveGuideSet(p.setFile, set);
  assert.equal(run(p.dir, [path.join(SCRIPTS, 'walk-lib.mjs'), 'crawl', '--fetch']).status, 0);
  install({ root: p.dir, say: () => {} });
  return p;
}

test('shots-kit writes a shots.mjs that takes every shot, and stamps the kit it copies', () => {
  const dir = frozenDir();
  const r = install({ root: dir, say: () => {} });
  assert.ok(r.ok, r.problems.join('; '));
  const text = fs.readFileSync(path.join(dir, 'scripts/user-guides/shots.mjs'), 'utf8');
  assert.deepEqual(shotsNamedIn(text).sort(), ['home-first-look', 'inbox', 'my-requests', 'request-dialog', 'settings']);
  assert.match(text, /const employee = await k\.as\('employee'\);/);
  assert.match(text, /await k\.open\(employee, '\/requests\?new=1'\);\nawait k\.shot\('request-dialog', employee\);/);
  assert.match(text, /const manager = await k\.as\('manager'\);[\s\S]*await k\.shot\('inbox', manager\);/);
  assert.match(text, /setFile: 'docs\/user-guides\/guides\.json'/);
  assert.equal(spawnSync('node', ['--check', path.join(dir, 'scripts/user-guides/shots.mjs')]).status, 0, 'shots.mjs parses');
  const kit = fs.readFileSync(path.join(dir, 'scripts/user-guides/guides-kit.mjs'), 'utf8');
  assert.match(kit.split('\n')[0], /^\/\/ guides-kit stamp: user-guides \d+\.\d+\.\d+ sha256:[0-9a-f]{64}; /);
  assert.equal(kit.slice(kit.indexOf('\n') + 1), fs.readFileSync(KIT_TEMPLATE, 'utf8'));

  // A second install keeps the project's shots.mjs and reports the kit current.
  const said = [];
  fs.appendFileSync(path.join(dir, 'scripts/user-guides/shots.mjs'), '// the project edits its own script\n');
  install({ root: dir, say: (s) => said.push(s) });
  assert.match(said.join('\n'), /guides-kit\.mjs: current[\s\S]*shots\.mjs: kept/);
  assert.match(fs.readFileSync(path.join(dir, 'scripts/user-guides/shots.mjs'), 'utf8'), /the project edits its own script/);
});

test('shots-kit check flags a stale kit, an edited kit, and shots the script lacks', () => {
  const dir = frozenDir();
  install({ root: dir, say: () => {} });
  const kitFile = path.join(dir, 'scripts/user-guides/guides-kit.mjs');

  // Stale: copied from an older template (its stamp and body agree, but differ from the plugin's).
  fs.writeFileSync(kitFile, stampedKit(fs.readFileSync(KIT_TEMPLATE, 'utf8') + '// an older kit\n', '0.0.9'));
  assert.equal(kitStatus(kitFile).status, 'stale');
  let r = check({ root: dir, say: () => {} });
  assert.equal(r.ok, false);
  assert.match(r.problems.join('\n'), /guides-kit\.mjs: stale: copied from user-guides 0\.0\.9/);
  assert.equal(run(dir, [path.join(WIKI, 'shots-kit.mjs'), 'check']).status, 1);
  install({ root: dir, say: () => {} });
  assert.equal(kitStatus(kitFile).status, 'current');

  // Edited by hand: flagged, and not replaced without --force.
  fs.appendFileSync(kitFile, '// a local fix\n');
  assert.equal(kitStatus(kitFile).status, 'edited');
  assert.throws(() => install({ root: dir, say: () => {} }), /edited by hand/);
  install({ root: dir, force: true, say: () => {} });
  assert.equal(kitStatus(kitFile).status, 'current');

  // A shot the script lacks, and the blocks to paste in.
  const sf = path.join(dir, 'scripts/user-guides/shots.mjs');
  fs.writeFileSync(sf, fs.readFileSync(sf, 'utf8').replace("await k.shot('inbox', manager);", ''));
  r = check({ root: dir, say: () => {} });
  assert.deepEqual(r.missing, ['inbox']);
  const blocks = run(dir, [path.join(WIKI, 'shots-kit.mjs'), 'blocks']);
  assert.equal(blocks.status, 0, blocks.stderr);
  assert.match(blocks.stdout, /const manager = await k\.as\('manager'\);[\s\S]*await k\.open\(manager, '\/inbox'\);\nawait k\.shot\('inbox', manager\);/);

  // A shot before sign-in gets a signed-out page.
  const b = shotBlocks([{ id: 'sign-in', as: 'employee', state: 'On /sign-in: signed out', alt: 'Sign in: the form', target: { what: 'the form', locator: null } }]);
  assert.match(b, /const employeeSignedOut = await k\.as\('employee', \{ signedOut: true \}\);[\s\S]*await k\.open\(employeeSignedOut, '\/sign-in'\);/);
});

test('swap-shots: placeholders become PNGs, failures are blocked, and a retake needs a new run', () => {
  const dir = frozenDir();
  const setFile = path.join(dir, SET);
  const out = path.join(dir, '.user-guides/out');
  fs.mkdirSync(path.join(out, 'shots'), { recursive: true });
  const fp = (n) => 'sha256:' + String(n).repeat(64).slice(0, 64);
  const entry = (id, n, takenAt = '2026-03-02T10:00:00.000Z') => {
    fs.writeFileSync(path.join(out, 'shots', `${id}.png`), PNG_1X1);
    return { as: 'employee', file: `.user-guides/out/shots/${id}.png`, fingerprint: fp(n), takenAt };
  };
  const manifest = { 'home-first-look': entry('home-first-look', 1), settings: entry('settings', 2), inbox: entry('inbox', 3), 'my-requests': { as: 'employee', error: 'region not found on /requests: role=table[name="My requests"]', takenAt: '2026-03-02T10:00:00.000Z' } };
  fs.writeFileSync(path.join(out, 'shots.json'), JSON.stringify({ manifestVersion: 1, shots: manifest }));

  assert.throws(() => swapShots({ root: dir }), /name the release/);
  const rows = swapShots({ root: dir, release: '1.0' });
  const by = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.deepEqual(rows.map((r) => `${r.id}:${r.action}`).sort(), ['home-first-look:swapped', 'inbox:swapped', 'my-requests:blocked', 'request-dialog:skipped', 'settings:swapped']);
  assert.match(by['request-dialog'].why, /not taken yet/);
  let set = loadGuideSet(setFile);
  const s = set.shots.find((x) => x.id === 'settings');
  assert.deepEqual({ status: s.status, path: s.path, release: s.release, fingerprint: s.fingerprint, takenAt: s.takenAt }, { status: 'taken', path: 'docs/user-guides/images/settings.png', release: '1.0', fingerprint: fp(2), takenAt: '2026-03-02T10:00:00.000Z' });
  assert.ok(fs.existsSync(path.join(dir, 'docs/user-guides/images/settings.png')));
  assert.ok(!fs.existsSync(path.join(dir, 'docs/user-guides/images/settings.svg')), 'the card is deleted');
  const employee = fs.readFileSync(path.join(dir, 'docs/user-guides/employee.md'), 'utf8');
  assert.match(employee, /\]\(images\/settings\.png\)/);
  assert.doesNotMatch(employee, /settings\.svg/);
  assert.match(employee, /\]\(images\/my-requests\.svg\)/, 'a blocked shot keeps its card');
  assert.equal(set.shots.find((x) => x.id === 'my-requests').note, manifest['my-requests'].error);
  assert.match(fs.readFileSync(path.join(dir, 'docs/user-guides/README.md'), 'utf8'), /\| 1 of 1 taken \|/, 'the index counts the taken pictures');

  // check-guides finds nothing wrong with the images or the shots.
  const cg = run(dir, [path.join(SCRIPTS, 'check-guides.mjs')]);
  assert.doesNotMatch(cg.stdout, /^\S+:\d+\s+(?:image|shots|index)\s/m, cg.stdout);

  // Refresh marks settings retake; the same run's image is not a retake.
  set = loadGuideSet(setFile);
  moveShot(set, 'settings', 'retake', { by: 'write-guides' });
  saveGuideSet(setFile, set);
  assert.match(swapShots({ root: dir, release: '1.1', only: ['settings'] })[0].why, /not taken again since/);
  manifest.settings = entry('settings', 4, '2026-04-01T09:00:00.000Z');
  fs.writeFileSync(path.join(out, 'shots.json'), JSON.stringify({ manifestVersion: 1, shots: manifest }));
  const again = swapShots({ root: dir, release: '1.1' });
  assert.deepEqual(again.filter((r) => r.action === 'retaken').map((r) => r.id), ['settings']);
  assert.ok(!again.some((r) => ['swapped', 'changed'].includes(r.action)), 'taken shots are left alone');
  set = loadGuideSet(setFile);
  assert.deepEqual([set.shots.find((x) => x.id === 'settings').release, set.shots.find((x) => x.id === 'home-first-look').release], ['1.1', '1.0']);

  // A placeholder whose text is wrong goes back to write-guides.
  const nt = swapShots({ root: dir, release: '1.1', needsText: { 'request-dialog': 'the dialog has no Note field' } });
  assert.deepEqual(nt.filter((r) => r.action === 'needs-text').map((r) => r.id), ['request-dialog']);
  assert.equal(loadGuideSet(setFile).shots.find((x) => x.id === 'request-dialog').status, 'needs-text');
});

test('rewriteLinks resolves each link against its guide', () => {
  const md = '![Settings: the panels](images/settings.svg)\n![x: y](../user-guides/images/settings.svg "t")\n![a: b](images/other.svg)';
  const r = rewriteLinks(md, 'docs/user-guides/employee.md', 'docs/user-guides/images/settings.svg', 'docs/user-guides/images/settings.png');
  assert.equal(r.count, 2);
  assert.equal(r.text, '![Settings: the panels](images/settings.png)\n![x: y](images/settings.png "t")\n![a: b](images/other.svg)');
});

test('shots.mjs takes every fixture shot; a walk agrees on every fingerprint; v2 retakes exactly R14\'s shots', async (t) => {
  if (!(await browserAvailable())) return t.skip('Chromium does not start here');
  const p = await project('v1');
  const outputs = [];
  const keep = (r) => (outputs.push(r.stdout, r.stderr), r);

  // The preflight.
  const pre = keep(shots(p.dir, '--check'));
  assert.equal(pre.status, 0, pre.stdout + pre.stderr);
  assert.match(pre.stdout, /ok {3}Playwright 1\.63\.0[\s\S]*ok {3}the base URL answers[\s\S]*ok {3}employee: signed in[\s\S]*ok {3}manager: signed in[\s\S]*ready: 5 shot/);

  // Every shot of the frozen set.
  const v1 = keep(shots(p.dir));
  assert.equal(v1.status, 0, v1.stdout + v1.stderr);
  assert.match(v1.stdout, /took 5: /);
  const set1 = loadGuideSet(p.setFile);
  const m1 = manifestOf(p.dir);
  assert.deepEqual(Object.keys(m1).sort(), set1.shots.map((s) => s.id).sort());
  for (const s of set1.shots) {
    const e = m1[s.id];
    const full = pngSize(fs.readFileSync(path.join(p.dir, e.file)));
    const half = pngSize(fs.readFileSync(path.join(p.dir, e.review)));
    assert.deepEqual([full.width, full.height], [e.width, e.height]);
    assert.ok(Math.abs(full.width - 2 * half.width) <= 1 && Math.abs(full.height - 2 * half.height) <= 1, `${s.id}: the review copy is half size (${full.width}×${full.height} vs ${half.width}×${half.height})`);
    if (!s.target.locator) assert.equal(full.width, 2560, `${s.id}: a whole screen is 1280 wide at scale 2`);
    else assert.ok(full.width < 2560, `${s.id}: cropped to its region`);
  }

  // A walk and a shot agree (R12): the fetch walk, then a browser walk.
  const walkDir = path.join(p.dir, '.user-guides', 'walk');
  const agree = (label) => {
    const outline = loadOutline(walkDir);
    for (const s of set1.shots) assert.equal(shotFingerprint(walkDir, outline, s).fingerprint, m1[s.id].fingerprint, `${label} walk and shot differ for ${s.id}`);
  };
  agree('fetch');
  assert.equal(run(p.dir, [path.join(SCRIPTS, 'walk-lib.mjs'), 'crawl']).status, 0);
  assert.equal(loadOutline(walkDir).mode, 'browser');
  agree('browser');

  // Swap them in.
  const sw = keep(run(p.dir, [path.join(WIKI, 'swap-shots.mjs'), '--release', '1.0']));
  assert.equal(sw.status, 0, sw.stderr);
  assert.match(sw.stdout, /taken: 5 shot/);
  const taken1 = loadGuideSet(p.setFile);
  assert.ok(taken1.shots.every((s) => s.status === 'taken' && s.path.endsWith('.png') && s.fingerprint === m1[s.id].fingerprint));
  assert.deepEqual(fs.readdirSync(path.join(p.dir, 'docs/user-guides/images')).sort(), set1.shots.map((s) => `${s.id}.png`).sort());
  const cg = run(p.dir, [path.join(SCRIPTS, 'check-guides.mjs')]);
  assert.doesNotMatch(cg.stdout, /^\S+:\d+\s+(?:image|shots|index)\s/m, cg.stdout);
  const pngs1 = Object.fromEntries(taken1.shots.map((s) => [s.id, sha(path.join(p.dir, s.path))]));

  // Release 1.1 (v2): walk, refresh, then shoot every shot again.
  await p.app.stop();
  releaseV2(p.dir);
  p.app = await startFixture(p.dir);
  cleanups.push(() => p.app.stop());
  const s2 = loadGuideSet(p.setFile);
  s2.app.baseUrl = p.app.url;
  saveGuideSet(p.setFile, s2);
  assert.equal(run(p.dir, [path.join(SCRIPTS, 'walk-lib.mjs'), 'crawl', '--fetch']).status, 0);
  assert.equal(run(p.dir, [path.join(SCRIPTS, 'walk-lib.mjs'), 'refresh', '--write']).status, 0);
  const oracle = set1.shots.filter(mustRetake).map((s) => s.id).sort();
  assert.deepEqual(oracle, ['settings'], "R28: against v2 the frozen set retakes the whole Settings screen only");
  assert.deepEqual(loadGuideSet(p.setFile).shots.filter((s) => s.status === 'retake').map((s) => s.id), oracle);

  const v2 = keep(shots(p.dir));
  assert.equal(v2.status, 0, v2.stdout + v2.stderr);
  const m2 = manifestOf(p.dir);
  const flagged = set1.shots.filter((s) => m2[s.id].fingerprint !== m1[s.id].fingerprint).map((s) => s.id).sort();
  assert.deepEqual(flagged, oracle, 'the shots\' own fingerprints flag exactly R14\'s shots');

  const sw2 = keep(run(p.dir, [path.join(WIKI, 'swap-shots.mjs'), '--release', '1.1', '--json']));
  assert.equal(sw2.status, 0, sw2.stderr);
  const rows = JSON.parse(sw2.stdout);
  assert.deepEqual(rows.map((r) => `${r.id}:${r.action}`), ['settings:retaken']);
  const taken2 = loadGuideSet(p.setFile);
  for (const s of taken2.shots) {
    const before = taken1.shots.find((x) => x.id === s.id);
    const changed = sha(path.join(p.dir, s.path)) !== pngs1[s.id];
    if (oracle.includes(s.id)) {
      assert.ok(changed, `${s.id}: a new picture`);
      assert.deepEqual([s.status, s.release, s.fingerprint], ['taken', '1.1', m2[s.id].fingerprint]);
    } else {
      assert.ok(!changed, `${s.id}: its picture is untouched`);
      assert.deepEqual(s, before, `${s.id}: its entry is untouched`);
    }
  }

  // No sign-in value is ever printed or stored.
  const cookies = ['rowan', 'tamsin'].map((id) => spawnSync('node', ['sign-in.mjs', id], { cwd: p.dir, env: { ...process.env, EVAL_LEAVE_APP: '1' }, encoding: 'utf8' }).stdout.trim());
  assert.ok(cookies.every((c) => c.length > 8));
  const printed = outputs.join('\n');
  const stored = [];
  const walkFiles = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walkFiles(path.join(d, e.name)) : [path.join(d, e.name)])) : []);
  for (const f of [...walkFiles(path.join(p.dir, '.user-guides', 'out')), ...walkFiles(path.join(p.dir, 'scripts')), ...walkFiles(path.join(p.dir, 'docs'))]) stored.push(fs.readFileSync(f, 'latin1'));
  for (const c of cookies) {
    assert.ok(!printed.includes(c), 'a sign-in value was printed');
    assert.ok(!stored.some((x) => x.includes(c)), 'a sign-in value was stored');
  }
});

test('retake by name, a failure that leaves the rest, and a shot before sign-in', async (t) => {
  if (!(await browserAvailable())) return t.skip('Chromium does not start here');
  const p = await project('v1');
  const set = loadGuideSet(p.setFile);
  addShot(set, { id: 'sign-in-screen', alt: 'Sign in: the form a new starter sees', as: 'employee', path: 'docs/user-guides/images/sign-in-screen.svg', target: { what: 'the sign-in screen, whole', locator: null }, state: 'On /sign-in: signed out', guides: ['getting-started'] }, { by: 'write-guides' });
  addShot(set, { id: 'broken', alt: 'Settings: a panel that is not there', as: 'employee', path: 'docs/user-guides/images/broken.svg', target: { what: 'a missing panel', locator: 'role=region[name="Nowhere"]' }, state: 'On /settings', guides: ['employee'] }, { by: 'write-guides' });
  saveGuideSet(p.setFile, set);
  fs.rmSync(path.join(p.dir, 'scripts/user-guides/shots.mjs'));
  install({ root: p.dir, say: () => {} });

  // By name: only that shot.
  const one = shots(p.dir, 'inbox');
  assert.equal(one.status, 0, one.stdout + one.stderr);
  assert.match(one.stdout, /took 1: inbox\n/);
  assert.deepEqual(Object.keys(manifestOf(p.dir)), ['inbox']);
  assert.equal(shots(p.dir, 'no-such-shot').status, 1);

  // A failure is reported and the others carry on.
  const two = shots(p.dir, 'sign-in-screen', 'broken', 'settings');
  assert.equal(two.status, 1);
  assert.match(two.stdout, /took 2: settings, sign-in-screen\n/);
  assert.match(two.stdout, /failed 1:\n {2}broken: region not found on \/settings: role=region\[name="Nowhere"\]/);

  // The signed-out shot agrees with a signed-out walk of the same screen.
  const walk = await createWalk({ root: p.dir, setFile: SET, mode: 'fetch', env: { ...process.env, EVAL_LEAVE_APP: '1' } });
  const out = await walk.open('employee', { signedOut: true });
  await walk.go(out, '/sign-in');
  await walk.dump(out, 'signed-out-sign-in');
  await walk.save();
  await walk.close();
  const walkDir = path.join(p.dir, '.user-guides', 'walk');
  const shot = loadGuideSet(p.setFile).shots.find((s) => s.id === 'sign-in-screen');
  const m = manifestOf(p.dir);
  assert.equal(shotFingerprint(walkDir, loadOutline(walkDir), shot).fingerprint, m['sign-in-screen'].fingerprint);
  assert.equal(m['sign-in-screen'].signedOut, true);

  // swap-shots: the broken shot is blocked with the reason; the rest are taken.
  const sw = run(p.dir, [path.join(WIKI, 'swap-shots.mjs'), '--release', '1.0']);
  assert.equal(sw.status, 1, 'a blocked shot sets the exit code');
  assert.match(sw.stdout, /blocked broken: region not found/);
  const after = loadGuideSet(p.setFile);
  assert.deepEqual(Object.fromEntries(after.shots.map((s) => [s.id, s.status])), { 'home-first-look': 'placeholder', 'request-dialog': 'placeholder', 'my-requests': 'placeholder', settings: 'taken', inbox: 'taken', 'sign-in-screen': 'taken', broken: 'blocked' });

  // A page from the wrong role is refused.
  const sf = path.join(p.dir, 'scripts/user-guides/shots.mjs');
  fs.writeFileSync(sf, fs.readFileSync(sf, 'utf8').replace("await k.shot('inbox', manager);", "await k.shot('inbox', employee);"));
  const wrong = shots(p.dir, 'inbox');
  assert.equal(wrong.status, 1);
  assert.match(wrong.stdout, /inbox: FAILED: the shot is for manager, the page is employee/);
});
