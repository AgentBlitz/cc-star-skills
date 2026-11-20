// The Leave Planner fixture, always on a staged copy (R13), on port 0 (C6).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { stageFixture, releaseV2, git } from './stage.mjs';

const kids = [];
const staged = [];

function start(dir, extraEnv = {}) {
  const child = spawn('node', ['server.mjs'], { cwd: dir, env: { ...process.env, ...extraEnv, LEAVE_APP_VARIANT: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  kids.push(child);
  return new Promise((resolve, reject) => {
    let out = '';
    const t = setTimeout(() => reject(new Error(`no URL printed: ${out}`)), 5000);
    child.stdout.on('data', (d) => {
      out += d;
      const m = out.match(/listening on (http:\/\/127\.0\.0\.1:(\d+))/);
      if (m) {
        clearTimeout(t);
        resolve({ url: m[1], port: Number(m[2]), out, child });
      }
    });
    child.on('exit', (code) => reject(new Error(`server exited ${code}: ${out}`)));
  });
}

const signIn = (dir, who) => {
  const r = spawnSync('node', ['sign-in.mjs', who], { cwd: dir, env: { ...process.env, EVAL_LEAVE_APP: '1' }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};
const get = async (url, cookie, p) => {
  const res = await fetch(url + p, { headers: cookie ? { cookie: `leave_session=${cookie}` } : {}, redirect: 'manual' });
  return { status: res.status, location: res.headers.get('location'), html: await res.text() };
};
const post = async (url, cookie, p, form) =>
  fetch(url + p, { method: 'POST', headers: { cookie: `leave_session=${cookie}`, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form), redirect: 'manual' });

let v1;
let v2;
before(async () => {
  v1 = stageFixture({ variant: 'v1' });
  staged.push(v1);
  v1.app = await start(v1.dir);
  v2 = stageFixture({ variant: 'v2' });
  staged.push(v2);
  v2.app = await start(v2.dir);
});
after(() => {
  for (const k of kids) k.kill();
  for (const s of staged) s.cleanup();
});

test('it listens on port 0, prints its URL and answers the health check', async () => {
  assert.ok(v1.app.port > 0);
  assert.match(v1.app.out, /Leave Planner 1\.0 \(v1\) listening on http:\/\/127\.0\.0\.1:\d+/);
  assert.match(v2.app.out, /Leave Planner 1\.1 \(v2\)/);
  assert.equal((await get(v1.app.url, null, '/__health')).html, 'ok v1 1.0');
});

test('the sign-in helper refuses without EVAL_LEAVE_APP=1, and signs each role in with it', async () => {
  const r = spawnSync('node', ['sign-in.mjs', 'employee'], { cwd: v1.dir, env: { ...process.env, EVAL_LEAVE_APP: '' }, encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /refusing to run: set EVAL_LEAVE_APP=1/);
  assert.equal(r.stdout, '');
  assert.equal(spawnSync('node', ['sign-in.mjs', 'nobody'], { cwd: v1.dir, env: { ...process.env, EVAL_LEAVE_APP: '1' } }).status, 2);
  for (const [role, name] of [['employee', 'Rowan Pell · Employee'], ['manager', 'Tamsin Hale · Manager'], ['admin', 'Idris Kettle · Admin']]) {
    const h = await get(v1.app.url, signIn(v1.dir, role), '/home');
    assert.equal(h.status, 200, role);
    assert.ok(h.html.includes(name), role);
  }
  assert.equal(signIn(v1.dir, 'rowan'), signIn(v1.dir, 'employee'));
});

test('signed out, every screen redirects to Sign in; a forged cookie is refused', async () => {
  for (const p of ['/', '/home', '/requests', '/inbox', '/people', '/settings', '/admin']) {
    const r = await get(v1.app.url, null, p);
    assert.equal(r.status, 303, p);
    assert.equal(r.location, '/sign-in', p);
  }
  assert.equal((await get(v1.app.url, 'idris.forged', '/admin')).status, 303);
  // a cookie from another staged copy (another secret) is refused too
  assert.equal((await get(v2.app.url, signIn(v1.dir, 'admin'), '/admin')).status, 303);
});

test('the screens: sticky header, role-gated navigation, cards, dialog, inbox, people, settings, admin', async () => {
  const emp = signIn(v1.dir, 'employee');
  const mgr = signIn(v1.dir, 'manager');
  const adm = signIn(v1.dir, 'admin');
  const home = await get(v1.app.url, emp, '/home');
  assert.match(home.html, /header\.top\{position:sticky/);
  assert.match(home.html, /<nav aria-label="Main">/);
  assert.doesNotMatch(home.html, /href="\/inbox"/);
  assert.doesNotMatch(home.html, /href="\/admin"/);
  for (const h of ['Your balance', 'Next time off', "Who's out today"]) assert.ok(home.html.includes(h), h);
  assert.match(home.html, /18 days/);
  assert.match((await get(v1.app.url, mgr, '/home')).html, /href="\/inbox"[\s\S]*Waiting for you/);
  assert.match((await get(v1.app.url, adm, '/home')).html, /href="\/admin"[\s\S]*Leave policy/);

  const req = await get(v1.app.url, emp, '/requests');
  assert.match(req.html, /data-region="requests-toolbar"/);
  assert.match(req.html, />Request leave<\/button>/);
  assert.match(req.html, /<dialog id="new-request" aria-labelledby="dlg-title">/);
  assert.match((await get(v1.app.url, emp, '/requests?new=1')).html, /<dialog id="new-request" aria-labelledby="dlg-title" open>/);
  assert.match((await get(v1.app.url, mgr, '/requests')).html, /You have no requests yet\./);

  assert.equal((await get(v1.app.url, emp, '/inbox')).status, 403);
  assert.equal((await get(v1.app.url, adm, '/inbox')).status, 403);
  const inbox = await get(v1.app.url, mgr, '/inbox');
  assert.equal((inbox.html.match(/>Approve</g) || []).length, 2);
  assert.equal((await get(v1.app.url, emp, '/admin')).status, 403);
  const admin = await get(v1.app.url, adm, '/admin');
  assert.match(admin.html, /Annual allowance \(days\)[\s\S]*People and roles/);

  const people = await get(v1.app.url, emp, '/people');
  assert.equal((people.html.match(/class="card person-card"/g) || []).length, 10);
  assert.equal((await get(v1.app.url, emp, '/people?q=design')).html.match(/person-card/g).length, 3);
  const settings = await get(v1.app.url, emp, '/settings');
  assert.match(settings.html, /data-region="settings-notifications"/);
  assert.match(settings.html, /Sync my leave to my calendar/);
  assert.equal((await get(v1.app.url, emp, '/nowhere')).status, 404);
});

test('v2 changes exactly the two screens in the README change table', async () => {
  const strip = (html) => html.replace(/<meta name="leave-app-variant" content="v\d">/, '');
  const c1 = (role) => signIn(v1.dir, role);
  const c2 = (role) => signIn(v2.dir, role);
  const changed = [];
  for (const [role, p] of [['employee', '/home'], ['employee', '/requests'], ['employee', '/requests?new=1'], ['manager', '/inbox'], ['employee', '/people'], ['employee', '/settings'], ['admin', '/admin'], ['manager', '/home']]) {
    const a = strip((await get(v1.app.url, c1(role), p)).html);
    const b = strip((await get(v2.app.url, c2(role), p)).html);
    if (a !== b) changed.push(`${role} ${p}`);
  }
  assert.deepEqual(changed, ['employee /requests', 'employee /requests?new=1', 'employee /settings']);
  const r2 = (await get(v2.app.url, c2('employee'), '/requests')).html;
  assert.match(r2, />New request<\/button>/);
  assert.doesNotMatch(r2, />Request leave<\/button>/);
  assert.match(r2, /<h2 id="dlg-title">Request leave<\/h2>/); // the dialog is unchanged
  const dialog = (html) => html.match(/<dialog[\s\S]*<\/dialog>/)[0];
  assert.equal(dialog(r2), dialog((await get(v1.app.url, c1('employee'), '/requests')).html));
  const s2 = (await get(v2.app.url, c2('employee'), '/settings')).html;
  assert.doesNotMatch(s2, /Sync my leave to my calendar/);
  assert.match(s2, /Email me when a request changes/);
  // the README's table names both changes
  const readme = fs.readFileSync(new URL('../fixtures/leave-app/README.md', import.meta.url), 'utf8');
  assert.match(readme, /\*\*Request leave\*\* is renamed \*\*New request\*\*/);
  assert.match(readme, /\*\*Sync my leave to my calendar\*\* is removed/);
});

test('requests, decisions and the reset', async () => {
  const emp = signIn(v1.dir, 'employee');
  const mgr = signIn(v1.dir, 'manager');
  const r = await post(v1.app.url, emp, '/requests', { type: 'Annual leave', from: '2026-05-04', to: '2026-05-06', note: 'Trip' });
  assert.equal(r.status, 303);
  assert.equal(r.headers.get('location'), '/requests?sent=1');
  assert.match((await get(v1.app.url, emp, '/requests?sent=1')).html, /Request sent to Tamsin Hale/);
  assert.equal(((await get(v1.app.url, mgr, '/inbox')).html.match(/>Approve</g) || []).length, 3);
  await post(v1.app.url, mgr, '/inbox/r1/approve', {});
  assert.equal(((await get(v1.app.url, mgr, '/inbox')).html.match(/>Approve</g) || []).length, 2);
  const reset = spawnSync('node', ['reset.mjs'], { cwd: v1.dir, encoding: 'utf8' });
  assert.equal(reset.status, 0);
  assert.equal(((await get(v1.app.url, mgr, '/inbox')).html.match(/>Approve</g) || []).length, 2);
  assert.doesNotMatch((await get(v1.app.url, emp, '/requests')).html, /Trip/);
});

test('the form sign-in is offered only when EVAL_LEAVE_APP_PASSWORD is set', async () => {
  const off = await get(v1.app.url, null, '/sign-in');
  assert.doesNotMatch(off.html, /type="password"/);
  const s = stageFixture({ variant: 'v1' });
  staged.push(s);
  const app = await start(s.dir, { EVAL_LEAVE_APP_PASSWORD: 'synthetic-pass' });
  assert.match((await get(app.url, null, '/sign-in')).html, /<label for="f-user">Username<\/label>[\s\S]*type="password"/);
  const bad = await fetch(app.url + '/sign-in', { method: 'POST', body: new URLSearchParams({ username: 'rowan', password: 'nope' }), redirect: 'manual' });
  assert.equal(bad.headers.get('location'), '/sign-in?error=1');
  const ok = await fetch(app.url + '/sign-in', { method: 'POST', body: new URLSearchParams({ username: 'rowan', password: 'synthetic-pass' }), redirect: 'manual' });
  assert.equal(ok.headers.get('location'), '/home');
  const cookie = ok.headers.get('set-cookie').match(/leave_session=([^;]+)/)[1];
  assert.equal((await get(app.url, decodeURIComponent(cookie), '/home')).status, 200);
});

test('releaseV2 turns a staged v1 copy into v2 with a release commit', () => {
  const s = stageFixture({ variant: 'v1' });
  staged.push(s);
  releaseV2(s.dir);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(s.dir, 'release.json'), 'utf8')), { release: '1.1', variant: 'v2' });
  assert.match(git(s.dir, 'log', '--format=%s'), /^Release 1\.1\nLeave Planner 1\.0\n$/);
});
