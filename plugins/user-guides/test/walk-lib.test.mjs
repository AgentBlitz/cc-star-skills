// walk-lib.mjs on staged copies of the fixture (R13): crawls, sign-in kinds, outlines that
// repeat, the code path, and refresh's retakes against the v2 change table (R14).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { stageFixture, releaseV2 } from './stage.mjs';
import { startFixture, fixtureSet, writeSet, runScript, browserAvailable, DEV_PLAYWRIGHT } from './helpers.mjs';
import { createWalk, refreshShots, diffOutlines, loadOutline, shotFingerprint, nextScreens, screenKey, dumpName } from '../skills/write-guides/scripts/walk-lib.mjs';
import { loadGuideSet, addGuide, addShot, moveShot, saveGuideSet } from '../skills/write-guides/scripts/guide-set.mjs';
import * as kit from '../skills/write-guides/scripts/kit-core.mjs';

const cleanups = [];
after(async () => {
  for (const c of cleanups.reverse()) await c();
});

async function staged(variant = 'v1', env = {}) {
  const st = stageFixture({ variant });
  const app = await startFixture(st.dir, env);
  cleanups.push(() => st.cleanup(), () => app.stop());
  const setFile = writeSet(st.dir, fixtureSet(app.url));
  return { st, app, dir: st.dir, setFile };
}

const outlineText = (dir) => fs.readFileSync(path.join(dir, '.user-guides', 'walk', 'outline.json'), 'utf8');

test('screen keys, dump names and the links a crawl follows', () => {
  assert.equal(screenKey('http://localhost/requests?b=2&a=1#x', 'http://localhost/'), '/requests?a=1&b=2');
  assert.equal(dumpName('/'), 'index');
  assert.equal(dumpName('/requests?new=1'), 'requests_new-1');
  const doc = kit.parseHtml(`<a href="/a">A</a><a href="https://elsewhere.example/">x</a><a href="/sign-out">Sign out</a>
    <a href="/files/report.pdf">pdf</a><a href="mailto:x@example.com">m</a><form method="get" action="/r"><input type="hidden" name="new" value="1"><button>New</button></form>
    <form method="get" action="/s"><input name="q"><button>Search</button></form><form method="post" action="/p"><button>Go</button></form>`);
  assert.deepEqual(nextScreens(doc, 'http://localhost/', 'http://localhost/'), ['http://localhost/a', 'http://localhost/r?new=1']);
});

test('two fetch walks of the staged fixture give identical outlines', async () => {
  const { dir } = await staged();
  for (const n of [1, 2]) {
    const r = runScript(dir, 'walk-lib.mjs', ['crawl', '--fetch']);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /employee: 5 screens[\s\S]*manager: 6 screens[\s\S]*admin: 6 screens/);
    if (n === 1) fs.copyFileSync(path.join(dir, '.user-guides/walk/outline.json'), path.join(dir, 'first.json'));
  }
  assert.equal(outlineText(dir), fs.readFileSync(path.join(dir, 'first.json'), 'utf8'));
  const o = JSON.parse(outlineText(dir));
  assert.deepEqual(o.roles.manager.map((s) => s.path), ['/', '/inbox', '/people', '/requests', '/requests?new=1', '/settings']);
  assert.deepEqual(o.roles.manager[0].aliases, ['/home']);
  assert.ok(!o.roles.employee.some((s) => s.path === '/inbox'), 'the employee has no Inbox link');
  const dialog = o.roles.employee.find((s) => s.path === '/requests?new=1');
  assert.ok(dialog.regions.some((r) => r.locator === 'role=dialog[name="Request leave"]'));
  const dump = fs.readFileSync(path.join(dir, '.user-guides/walk', dialog.dump), 'utf8');
  assert.match(dump, /^\/requests\?new=1\n\n[\s\S]*Submit request/);
  assert.ok(!/\d{4,5}/.test(JSON.stringify(o).replace(/sha256:[0-9a-f]+/g, '')), 'no port in the outline');
  assert.match(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), /^\.user-guides\/$/m, 'the work folder is ignored');
  assert.ok(fs.existsSync(path.join(dir, '.user-guides/walk/outline.previous.json')), 'the walk before is kept');
});

test('a browser walk gives the same outline as a fetch walk', async (t) => {
  if (!(await browserAvailable())) return t.skip('Chromium does not start here');
  const { dir } = await staged();
  runScript(dir, 'walk-lib.mjs', ['crawl', '--fetch']);
  const fetched = JSON.parse(outlineText(dir));
  const r = runScript(dir, 'walk-lib.mjs', ['crawl'], { env: { USER_GUIDES_PLAYWRIGHT_CORE: DEV_PLAYWRIGHT } });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /walk: browser/);
  const browsed = JSON.parse(outlineText(dir));
  assert.equal(browsed.mode, 'browser');
  assert.deepEqual({ ...browsed, mode: 'x' }, { ...fetched, mode: 'x' });
});

test('a walk script adds to the crawl, and a crawl of one role keeps the others', async () => {
  const { dir, setFile } = await staged();
  runScript(dir, 'walk-lib.mjs', ['crawl', '--fetch']);
  const walk = await createWalk({ root: dir, setFile: path.relative(dir, setFile), mode: 'fetch', env: { ...process.env, EVAL_LEAVE_APP: '1' } });
  const p = await walk.open('manager');
  await walk.go(p, '/people?q=hale');
  await walk.dump(p, 'people-search');
  await walk.save();
  await walk.close();
  const o = JSON.parse(outlineText(dir));
  assert.ok(o.roles.manager.some((s) => s.path === '/people?q=hale' && s.dump === 'dumps/manager/people-search.txt'));
  assert.equal(o.roles.manager.length, 7);
  const r = runScript(dir, 'walk-lib.mjs', ['crawl', '--fetch', '--roles', 'employee']);
  assert.equal(r.status, 0, r.stderr);
  const o2 = JSON.parse(outlineText(dir));
  assert.equal(o2.roles.manager.length, 7, 'the manager was not walked again');
  assert.equal(o2.roles.employee.length, 5);
});

test('form sign-in from environment variables, on a fetch walk', async () => {
  const { dir, app } = await staged('v1', { EVAL_LEAVE_APP_PASSWORD: 'synthetic-pass' });
  const set = fixtureSet(app.url, {});
  set.app.signIn = { kind: 'form', loginUrl: '/sign-in', fields: { username: 'label=Username', password: 'label=Password', submit: 'role=button[name="Sign in"]' } };
  set.app.accounts = { manager: { usernameEnv: 'EVAL_USER', passwordEnv: 'EVAL_PASS' } };
  writeSet(dir, set);
  const missing = runScript(dir, 'walk-lib.mjs', ['preflight', '--fetch']);
  assert.equal(missing.status, 1);
  assert.match(missing.stdout, /manager: form sign-in for manager needs EVAL_USER and EVAL_PASS set/);
  const ok = runScript(dir, 'walk-lib.mjs', ['preflight', '--fetch'], { env: { EVAL_USER: 'tamsin', EVAL_PASS: 'synthetic-pass' } });
  assert.equal(ok.status, 0, ok.stdout);
  assert.match(ok.stdout, /manager: signed in; \/ lands on \/ \(200\)/);
  assert.ok(!ok.stdout.includes('synthetic-pass'));
});

test('storage-state: a headless walk refuses to sign in by hand; a saved state signs in', async () => {
  const { dir, app } = await staged();
  const set = fixtureSet(app.url);
  set.app.signIn = { kind: 'storage-state', loginUrl: '/sign-in' };
  set.app.accounts = { employee: {} };
  writeSet(dir, set);
  const r = runScript(dir, 'walk-lib.mjs', ['crawl', '--fetch', '--headless']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /headless run cannot sign in by hand/);
  const h = runScript(dir, 'walk-lib.mjs', ['sign-in', '--role', 'employee', '--headless']);
  assert.notEqual(h.status, 0);
  const cookie = spawnSync('node', ['sign-in.mjs', 'rowan'], { cwd: dir, env: { ...process.env, EVAL_LEAVE_APP: '1' }, encoding: 'utf8' }).stdout.trim();
  kit.writeSecret(kit.storageStateFile(dir, 'employee'), JSON.stringify({ cookies: [{ name: 'leave_session', value: cookie, domain: '127.0.0.1', path: '/' }], origins: [] }));
  const ok = runScript(dir, 'walk-lib.mjs', ['crawl', '--fetch', '--headless']);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /employee: 5 screens/);
});

test('an unreachable app means the code path, and a headless run never starts it', () => {
  const st = stageFixture({});
  cleanups.push(() => st.cleanup());
  writeSet(st.dir, fixtureSet('http://127.0.0.1:9', { app: { ...fixtureSet('').app, baseUrl: 'http://127.0.0.1:9', start: 'node server.mjs --port 9' } }));
  const r = runScript(st.dir, 'walk-lib.mjs', ['preflight', '--headless']);
  assert.equal(r.status, 3);
  assert.match(r.stdout, /unreachable[\s\S]*headless run never starts the app: take the code path[\s\S]*notChecked/);
  const i = runScript(st.dir, 'walk-lib.mjs', ['install-playwright', '--headless', '--yes']);
  assert.equal(i.status, 2);
  assert.match(i.stdout, /never installs Playwright/);
  const ask = runScript(st.dir, 'walk-lib.mjs', ['install-playwright']);
  assert.match(ask.stdout, /ask the user first/);
});

test('refresh after v2: exactly the shots on the two changed regions retake (the change table)', async () => {
  const st = stageFixture({ variant: 'v1' });
  cleanups.push(() => st.cleanup());
  let app = await startFixture(st.dir);
  const dir = st.dir;
  const setFile = writeSet(dir, fixtureSet(app.url));
  runScript(dir, 'walk-lib.mjs', ['crawl', '--fetch']);

  // A set with one shot per screen region, taken (as wiki-guides would) with the v1 walk's fingerprints.
  const set = loadGuideSet(setFile);
  addGuide(set, { id: 'employee', type: 'role-guide', file: 'docs/user-guides/employee.md', title: 'Leave Planner for employees', audience: ['employee'] }, { by: 'write-guides' });
  addGuide(set, { id: 'manager', type: 'role-guide', file: 'docs/user-guides/manager.md', title: 'Leave Planner for managers', audience: ['manager'] }, { by: 'write-guides' });
  const shots = [
    ['requests-toolbar', 'employee', 'css=[data-region="requests-toolbar"]', 'On /requests: nothing first', 'Requests: the toolbar'],
    ['request-dialog', 'employee', 'role=dialog[name="Request leave"]', 'On /requests?new=1: the dialog open', 'Request leave: the dialog'],
    ['settings-notifications', 'employee', 'role=region[name="Notifications"]', 'On /settings', 'Settings: the Notifications panel'],
    ['home', 'employee', null, 'On /home', 'Home: the cards'],
    ['inbox', 'manager', null, 'On /inbox: two requests waiting', 'Inbox: two requests waiting'],
    ['people', 'manager', null, '', 'People: the directory'],
  ];
  const walkDir = path.join(dir, '.user-guides', 'walk');
  const v1 = loadOutline(walkDir);
  for (const [id, as, locator, state, alt] of shots) {
    addShot(set, { id, alt, as, path: `docs/user-guides/images/${id}.svg`, target: { what: alt, locator }, state, guides: [as] }, { by: 'write-guides' });
    const { fingerprint } = shotFingerprint(walkDir, v1, set.shots.find((s) => s.id === id));
    assert.ok(fingerprint, `${id} is found on the v1 walk`);
    moveShot(set, id, 'taken', { by: 'wiki-guides', path: `docs/user-guides/images/${id}.png`, takenAt: '2026-03-02T10:00:00Z', release: '1.0', fingerprint });
  }
  saveGuideSet(setFile, set);

  // Unchanged app: nothing to retake.
  runScript(dir, 'walk-lib.mjs', ['crawl', '--fetch']);
  assert.equal(refreshShots(loadGuideSet(setFile), walkDir).filter((r) => r.retake).length, 0);

  // Release 1.1 (v2), walk again, refresh.
  await app.stop();
  releaseV2(dir);
  app = await startFixture(dir);
  cleanups.push(() => app.stop());
  const s2 = loadGuideSet(setFile);
  s2.app.baseUrl = app.url;
  saveGuideSet(setFile, s2);
  runScript(dir, 'walk-lib.mjs', ['crawl', '--fetch']);
  const r = runScript(dir, 'walk-lib.mjs', ['refresh', '--write']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /2 of 6 taken shots to retake/);
  const after = loadGuideSet(setFile);
  assert.deepEqual(after.shots.filter((s) => s.status === 'retake').map((s) => s.id).sort(), ['requests-toolbar', 'settings-notifications']);

  // diff names the two changed screens and what changed on them.
  const d = diffOutlines(JSON.parse(fs.readFileSync(path.join(walkDir, 'outline.previous.json'), 'utf8')), loadOutline(walkDir));
  const employee = d.filter((x) => x.role === 'employee');
  assert.deepEqual(employee.map((x) => x.path).sort(), ['/requests', '/requests?new=1', '/settings']);
  const req = employee.find((x) => x.path === '/requests');
  assert.deepEqual(req.controlsAdded, ['button "New request"']);
  assert.deepEqual(req.controlsRemoved, ['button "Request leave"']);
  assert.deepEqual(req.regions, ['css=[data-region="requests-toolbar"]']);
  const settings = employee.find((x) => x.path === '/settings');
  assert.deepEqual(settings.controlsRemoved, ['checkbox "Sync my leave to my calendar"']);
});

test('an adopted shot (taken, no fingerprint) always retakes', async () => {
  const { dir, setFile } = await staged();
  runScript(dir, 'walk-lib.mjs', ['crawl', '--fetch']);
  const set = loadGuideSet(setFile);
  addGuide(set, { id: 'old', type: 'role-guide', file: 'docs/old.md', title: 'Old guide', audience: ['employee'] }, { by: 'write-guides', adopt: true });
  addShot(set, { id: 'old-shot', alt: 'Home: the cards', as: 'employee', path: 'docs/img/old.png', target: { what: 'the cards', locator: null }, state: '', guides: ['old'] }, { by: 'write-guides', adopt: true });
  const rows = refreshShots(set, path.join(dir, '.user-guides', 'walk'));
  assert.deepEqual(rows.map((x) => [x.id, x.retake, x.why]), [['old-shot', true, 'no fingerprint recorded']]);
});
