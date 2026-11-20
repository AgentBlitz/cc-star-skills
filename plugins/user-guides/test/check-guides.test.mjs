// check-guides.mjs and set-edit.mjs, on a staged fixture walked with a fetch walk, and on the
// code path (no walk).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { stageFixture } from './stage.mjs';
import { startFixture, fixtureSet, writeSet, runScript } from './helpers.mjs';
import { checkGuides, anchors, slug, labelsIn } from '../skills/write-guides/scripts/check-guides.mjs';
import { loadGuideSet } from '../skills/write-guides/scripts/guide-set.mjs';

const cleanups = [];
after(async () => {
  for (const c of cleanups.reverse()) await c();
});

const GUIDE = `# Leave Planner for employees

You ask for time off and keep track of it here.

## What you can do

- See your balance on **Home**.
- Ask for leave on **Requests**, and see [what to change](#2-change-your-settings).

## 1. Ask for time off

1. Open **Requests** and select **Request leave**.
2. Fill in **First day** and **Last day**, then **Submit request**.

![Request leave: the dialog, with the dates filled in](images/request-dialog.svg)

## 2. Change your settings

On **Settings → Notifications**, tick **Email me when a
request changes** (a bold label may wrap) and **Save settings**.
See the [people directory](people.md#find-someone) too. Everyone is on **People**.
`;

const PEOPLE = `# Finding people

## Find someone

Search on **People** with **Search people**.
`;

const SHOT = {
  id: 'request-dialog',
  alt: 'Request leave: the dialog, with the dates filled in',
  as: 'employee',
  path: 'docs/user-guides/images/request-dialog.svg',
  target: { what: 'the Request leave dialog', locator: 'role=dialog[name="Request leave"]' },
  state: 'On /requests?new=1: the dates filled in',
  guides: ['employee'],
  status: 'placeholder',
};

function writeGuides(dir, url, { employeeText, ...over } = {}) {
  const set = fixtureSet(url, {
    guides: [
      { id: 'employee', type: 'role-guide', file: 'docs/user-guides/employee.md', title: 'Leave Planner for employees', audience: ['employee'], parent: '', order: 1, status: 'written' },
      { id: 'people', type: 'getting-started', file: 'docs/user-guides/people.md', title: 'Finding people', audience: [], parent: '', order: 2, status: 'written' },
    ],
    shots: [SHOT],
    ...over,
  });
  const file = writeSet(dir, set);
  fs.writeFileSync(path.join(dir, 'docs/user-guides/employee.md'), employeeText ?? GUIDE);
  fs.writeFileSync(path.join(dir, 'docs/user-guides/people.md'), PEOPLE);
  fs.mkdirSync(path.join(dir, 'docs/user-guides/images'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs/user-guides/images/request-dialog.svg'), '<svg/>');
  runScript(dir, 'guide-set.mjs', ['index', 'docs/user-guides/guides.json', 'docs/user-guides/README.md']);
  return file;
}

async function walkedFixture() {
  const st = stageFixture({});
  const app = await startFixture(st.dir);
  cleanups.push(() => st.cleanup(), () => app.stop());
  writeSet(st.dir, fixtureSet(app.url));
  const r = runScript(st.dir, 'walk-lib.mjs', ['crawl', '--fetch', '--roles', 'employee']);
  assert.equal(r.status, 0, r.stderr);
  return { dir: st.dir, url: app.url };
}

const rules = (res) => res.problems.map((p) => `${p.rule}: ${p.message}`);

test('slugs and anchors are GitHub’s, with -1 for duplicates; bold paths split into labels', () => {
  assert.equal(slug('2. Change your settings'), '2-change-your-settings');
  assert.equal(slug('What’s **new** in `1.1`?'), 'whats-new-in-11');
  assert.deepEqual([...anchors('# A\n## Notes\n```\n## Not a heading\n```\n## Notes\n')], ['a', 'notes', 'notes-1']);
  assert.deepEqual(labelsIn('Settings → Notifications'), ['Settings', 'Notifications']);
  assert.deepEqual(labelsIn('Save settings.'), ['Save settings']);
});

test('a walked set that follows the rules passes, and every walked screen is covered', async () => {
  const { dir, url } = await walkedFixture();
  writeGuides(dir, url, { leftOut: [] });
  const res = checkGuides({ root: dir });
  assert.ok(res.walked);
  assert.deepEqual(rules(res), []);
  const cli = runScript(dir, 'check-guides.mjs', ['--mark-checked']);
  assert.equal(cli.status, 0, cli.stdout);
  assert.match(cli.stdout, /all checks pass/);
  const set = loadGuideSet(path.join(dir, 'docs/user-guides/guides.json'));
  assert.deepEqual(set.guides.map((g) => g.status), ['checked', 'checked']);
  assert.match(fs.readFileSync(path.join(dir, 'docs/user-guides/README.md'), 'utf8'), /\| checked \|/, 'the index follows');
});

test('each rule catches its problem', async () => {
  const { dir, url } = await walkedFixture();
  const bad = `# Leave Planner for employees

Per D7 and CB-123 (session 42), see apps/web/src/requests.tsx and call \`submitRequest()\`.
Our CODENAME-X flag is on. <!-- fill in -->

Open **Request time off** on **Requests**. ![Requests: the toolbar](images/request-dialog.svg)

![](images/missing.png)

![Not in the form](images/request-dialog.svg)

Go to [nowhere](missing.md) or [the top](#no-such-heading) or [people](people.md#nope).
`;
  writeGuides(dir, url, { employeeText: bad, checks: { patterns: ['CODENAME-\\w+'] } });
  const got = rules(checkGuides({ root: dir })).join('\n');
  for (const want of [
    /refs: a decision or plan id: "D7"/,
    /refs: a ticket id: "CB-123"/,
    /refs: a session id: "session 42"/,
    /refs: a file path: "apps\/web\/src\/requests.tsx"/,
    /refs: a code name: `submitRequest\(\)`/,
    /refs: matches checks.patterns CODENAME-\\w\+: "CODENAME-X"/,
    /template: a template comment/,
    /labels: "Request time off" is on no screen walked as employee/,
    /image: an image must be alone on its line/,
    /image: no alt text for images\/missing.png/,
    /image: image file missing: docs\/user-guides\/images\/missing.png/,
    /shots: image docs\/user-guides\/images\/missing.png is not in shots\[\]/,
    /image: alt text must read "Screen: what to notice": "Not in the form"/,
    /links: link to a missing file: missing.md/,
    /links: no heading for the anchor #no-such-heading/,
    /links: no heading for the anchor #nope in docs\/user-guides\/people.md/,
    /coverage: \/settings \(Settings\), walked as employee, is in no guide for employee and not in leftOut\[\]/,
  ]) assert.match(got, want);
  assert.doesNotMatch(got, /coverage: \/people/, 'People is covered by the guide for everyone');
});

test('a shot not shown, a placeholder shown for a taken shot, and leftOut[] covering a screen', async () => {
  const { dir, url } = await walkedFixture();
  const extra = { ...SHOT, id: 'home-cards', alt: 'Home: the cards', path: 'docs/user-guides/images/home-cards.svg', state: 'On /home', target: { what: 'the cards', locator: null } };
  writeGuides(dir, url, { shots: [SHOT, extra], leftOut: [{ screen: '/settings', role: 'employee', reason: 'covered by the admin guide' }] });
  const got = rules(checkGuides({ root: dir })).join('\n');
  assert.match(got, /shots: shot home-cards lists this guide but the guide does not show docs\/user-guides\/images\/home-cards.svg/);
  assert.doesNotMatch(got, /coverage/);
});

test('the code path: labels go to notChecked[] with --record, and an empty notChecked[] fails', () => {
  const st = stageFixture({});
  cleanups.push(() => st.cleanup());
  const dir = st.dir;
  writeGuides(dir, 'http://127.0.0.1:9');
  const before = rules(checkGuides({ root: dir })).join('\n');
  assert.match(before, /labels: "Request leave" is unconfirmed and not in notChecked\[\] \(no walk\): rerun with --record/);
  assert.match(before, /walk: no walk was recorded, so notChecked\[\] must list/);
  const r = runScript(dir, 'check-guides.mjs', ['--record']);
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /recorded in notChecked\[\]: employee: UI label "Request leave"/);
  const set = loadGuideSet(path.join(dir, 'docs/user-guides/guides.json'));
  assert.ok(set.notChecked.length >= 8);
  assert.ok(set.notChecked.every((e) => e.reason.includes('no walk')));
  assert.match(fs.readFileSync(path.join(dir, 'docs/user-guides/README.md'), 'utf8'), new RegExp(`Claims not checked against the running app: ${set.notChecked.length}\\.`));
  const again = runScript(dir, 'check-guides.mjs', []);
  assert.equal(again.status, 0, again.stdout);
});

test('a stale README index fails until it is regenerated', () => {
  const st = stageFixture({});
  cleanups.push(() => st.cleanup());
  writeGuides(st.dir, 'http://127.0.0.1:9', { notChecked: [{ guide: 'employee', claim: 'all of it', reason: 'code path' }] });
  fs.writeFileSync(path.join(st.dir, 'docs/user-guides/README.md'), '# Guides\n');
  const r = runScript(st.dir, 'check-guides.mjs', []);
  assert.match(r.stdout, /index  the README.md status block is out of date/);
});

test('set-edit: operations apply together through the contract, or not at all', () => {
  const st = stageFixture({});
  cleanups.push(() => st.cleanup());
  const dir = st.dir;
  const file = 'docs/user-guides/guides.json';
  const ops = (list, extra = []) => runScript(dir, 'set-edit.mjs', [file, ...extra], { input: JSON.stringify(list) });
  const missing = ops([{ op: 'set', path: 'product.name', value: 'x' }]);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /does not exist: start with an "init" operation/);
  const init = ops([
    { op: 'init', product: { name: 'Leave Planner', language: 'en-GB' }, app: { baseUrl: 'http://127.0.0.1:4000', accounts: { employee: { id: 'rowan' } }, signIn: { kind: 'cookie-command', command: 'node sign-in.mjs {id}', cookie: { name: 'leave_session' } } } },
    { op: 'set', path: 'interview.wordingVersion', value: '1' },
    { op: 'set', path: 'interview.answers.readers', value: ['Every role'] },
    { op: 'addGuide', guide: { id: 'employee', type: 'role-guide', file: 'docs/user-guides/employee.md', title: 'For employees', audience: ['employee'] } },
    { op: 'addShot', shot: { ...SHOT, status: undefined } },
    { op: 'push', list: 'leftOut', item: { screen: '/admin', role: 'employee', reason: 'not theirs' } },
    { op: 'push', list: 'leftOut', item: { screen: '/admin', role: 'employee', reason: 'not theirs' } },
  ], ['--index', 'docs/user-guides/README.md']);
  assert.equal(init.status, 0, init.stderr);
  let set = loadGuideSet(path.join(dir, file));
  assert.equal(set.guides[0].status, 'outlined');
  assert.equal(set.shots[0].status, 'placeholder');
  assert.equal(set.leftOut.length, 1, 'push skips a duplicate');
  assert.deepEqual(set.interview.answers.readers, ['Every role']);
  assert.match(fs.readFileSync(path.join(dir, 'docs/user-guides/README.md'), 'utf8'), /user-guides:status:begin/);
  const wrong = ops([
    { op: 'moveGuide', id: 'employee', to: 'written' },
    { op: 'moveShot', id: 'request-dialog', to: 'taken' },
  ]);
  assert.equal(wrong.status, 1);
  assert.match(wrong.stderr, /nothing saved: operation 2 \(moveShot\): shot "request-dialog": placeholder → taken belongs to wiki-guides, not write-guides/);
  set = loadGuideSet(path.join(dir, file));
  assert.equal(set.guides[0].status, 'outlined', 'the first operation was not saved either');
  const ok = ops([
    { op: 'moveGuide', id: 'employee', to: 'written' },
    { op: 'drop', list: 'leftOut', where: { screen: '/admin' } },
    { op: 'updateShot', id: 'request-dialog', fields: { alt: 'Request leave: the empty dialog' } },
  ]);
  assert.equal(ok.status, 0, ok.stderr);
  set = loadGuideSet(path.join(dir, file));
  assert.equal(set.guides[0].status, 'written');
  assert.equal(set.leftOut.length, 0);
  assert.equal(set.shots[0].alt, 'Request leave: the empty dialog');
  const status = ops([{ op: 'updateShot', id: 'request-dialog', fields: { status: 'taken' } }]);
  assert.equal(status.status, 1);
  assert.match(status.stderr, /changes only alt, as, target, state and guides, not status/);
});
