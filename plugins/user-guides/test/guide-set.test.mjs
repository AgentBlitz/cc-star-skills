import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as gs from '../skills/write-guides/scripts/guide-set.mjs';

const FP = 'sha256:' + 'a'.repeat(64);
const FP2 = 'sha256:' + 'b'.repeat(64);

/** A full, valid set that uses every key in the contract. */
export function fullSet() {
  const s = gs.createGuideSet({ name: 'Leave Planner', language: 'en-GB', baseUrl: 'http://127.0.0.1:4310' });
  s.app.start = 'npm start';
  s.app.reset = 'npm run reset';
  s.app.playwrightFrom = '.';
  s.app.signIn = { kind: 'cookie-command', command: 'node sign-in.mjs {id}', cookie: { name: 'leave_session', path: '/' } };
  s.app.accounts = { employee: { id: 'rowan', label: 'Rowan Pell' }, manager: { id: 'tamsin' }, admin: { id: 'idris' } };
  s.interview = { wordingVersion: '1', answers: { readers: ['employee', 'manager'], depth: 'Task by task', approve: 'approve as proposed' } };
  s.guides = [
    { id: 'getting-started', type: 'getting-started', file: 'docs/user-guides/getting-started.md', title: 'Getting started', audience: [], parent: '', order: 1, status: 'checked' },
    { id: 'employee', type: 'role-guide', file: 'docs/user-guides/employee.md', title: 'For employees', audience: ['employee'], parent: 'getting-started', order: 2, status: 'written' },
    { id: 'admin', type: 'admin-operations', file: 'docs/wiki/admin.md', title: 'Running Leave Planner', audience: ['admin'], parent: '', order: 3, status: 'outlined' },
  ];
  s.shots = [
    { id: 'request-dialog', alt: 'Requests: the Request leave dialog with both dates filled in', as: 'employee', path: 'docs/user-guides/images/request-dialog.svg', target: { what: 'the dialog', locator: 'role=dialog[name="Request leave"]' }, state: 'the dialog is open', guides: ['employee'], status: 'placeholder' },
    { id: 'home-cards', alt: 'Home: the balance card', as: 'employee', path: 'docs/user-guides/images/home-cards.png', target: { what: 'the cards', locator: null }, state: '', guides: ['employee', 'getting-started'], status: 'taken', takenAt: '2026-03-02T10:00:00Z', release: '1.0', fingerprint: FP },
  ];
  s.notChecked = [{ guide: 'admin', claim: 'Carry-over applies on 1 January', reason: 'not visible in the app' }];
  s.leftOut = [{ screen: '/admin roles table', role: 'admin', reason: 'covered by the policy section' }];
  s.checks.patterns = ['\\bJIRA-\\d+\\b', 'internal\\.only'];
  s.publish = {
    release: '1.0',
    html: { outDir: 'site/guides' },
    confluence: { baseUrl: 'https://wiki.example.com', space: 'LEAVE', topPageId: '1001', topGuide: 'getting-started', pages: { employee: { pageId: '1002', version: 3 }, admin: { pageId: '1003', version: null } }, imageCap: 640, deviceScale: 2 },
  };
  return s;
}

const errorsOf = (s) => gs.validateGuideSet(s).errors;

test('a new set and a full set are valid', () => {
  assert.deepEqual(errorsOf(gs.createGuideSet()), []);
  assert.deepEqual(errorsOf(fullSet()), []);
});

test('every sign-in kind validates with its own settings', () => {
  const kinds = {
    'cookie-command': [{ kind: 'cookie-command', command: 'x {id}', cookie: { name: 'c' } }, { employee: { id: 'e' } }],
    'storage-state': [{ kind: 'storage-state', loginUrl: '/login' }, { employee: {} }],
    form: [{ kind: 'form', loginUrl: '/sign-in', fields: { username: 'label=Username', password: 'label=Password', submit: 'role=button[name="Sign in"]' } }, { employee: { usernameEnv: 'EVAL_USER', passwordEnv: 'EVAL_PASS' } }],
    module: [{ kind: 'module', module: 'scripts/user-guides/sign-in.mjs' }, { employee: {} }],
    none: [{ kind: 'none' }, {}],
  };
  assert.deepEqual(Object.keys(kinds), gs.SIGN_IN_KINDS);
  for (const [kind, [signIn, accounts]] of Object.entries(kinds)) {
    const s = gs.createGuideSet();
    s.app.signIn = signIn;
    s.app.accounts = accounts;
    assert.deepEqual(errorsOf(s), [], kind);
  }
});

test('sign-in settings are checked per kind, and no secret key is accepted', () => {
  const s = gs.createGuideSet();
  s.app.signIn = { kind: 'cookie-command', cookie: { name: 'c' } };
  s.app.accounts = { employee: {} };
  const e = errorsOf(s).join('\n');
  assert.match(e, /app\.signIn\.command/);
  assert.match(e, /app\.accounts\.employee\.id is required/);

  const f = gs.createGuideSet();
  f.app.signIn = { kind: 'form', loginUrl: '/in', fields: { username: 'label=U', password: 'label=P', submit: 'bogus=x' } };
  f.app.accounts = { employee: { usernameEnv: 'EVAL_U', passwordEnv: 'EVAL_P', password: 'hunter2' } };
  const fe = errorsOf(f).join('\n');
  assert.match(fe, /fields\.submit uses unknown engine "bogus="/);
  assert.match(fe, /unknown key "password"/);

  const t = gs.createGuideSet();
  t.app.signIn = { kind: 'none', token: 'x' };
  assert.match(errorsOf(t).join('\n'), /unknown key "token"/);
});

test('unknown keys, bad paths and bad references are errors', () => {
  const s = fullSet();
  s.extra = 1;
  s.guides[0].file = '/abs/path.md';
  s.guides[1].parent = 'nope';
  s.shots[0].guides = ['ghost'];
  s.shots[1].path = '../outside.png';
  s.publish.confluence.pages.ghost = { pageId: '9' };
  s.publish.confluence.topGuide = 'ghost';
  s.notChecked[0].guide = 'ghost';
  const e = errorsOf(s).join('\n');
  for (const re of [/unknown key "extra"/, /guides\[0\].*file must be a repo-relative/, /parent "nope" is not a guide id/, /names "ghost", which is not a guide id/, /shots\[1\].*path must be repo-relative/, /pages\.ghost: "ghost" is not a guide id/, /topGuide must be a guide id/, /notChecked\[0\]\.guide "ghost"/]) {
    assert.match(e, re);
  }
});

test('repo-relative paths', () => {
  for (const ok of ['docs/a.md', 'a.md', 'docs/wiki/x/y.png']) assert.equal(gs.isRepoRelative(ok), true, ok);
  for (const bad of ['/a.md', '../a.md', 'docs/../a.md', '~/a.md', 'C:/a.md', 'a\\b.md', './a.md', 'docs//a.md', '']) assert.equal(gs.isRepoRelative(bad), false, bad);
});

test('the locator syntax', () => {
  for (const ok of ['role=button[name="Save"]', 'role=dialog[name="Request leave"] >> role=button[name="Cancel"]', 'css=[data-region="requests-toolbar"]', 'text=Save', '#main', 'role=checkbox[checked]', 'role=link[name="A \\"b\\""i]', 'data-testid=card']) {
    assert.equal(gs.checkLocator(ok), null, ok);
  }
  for (const bad of ['', 'role=Button[name="x"]', 'role=button[name="x"', 'foo=bar', 'role=button >> ', 'css=']) {
    assert.notEqual(gs.checkLocator(bad), null, bad);
  }
});

test('alt text, shot paths and fingerprints', () => {
  const s = fullSet();
  s.shots[0].alt = 'no colon here';
  s.shots[0].path = 'docs/user-guides/images/request-dialog.png';
  s.shots[1].fingerprint = 'md5:abc';
  const e = errorsOf(s).join('\n');
  assert.match(e, /alt must read "Screen: what to notice"/);
  assert.match(e, /must be the \.svg card while the shot is a placeholder/);
  assert.match(e, /fingerprint must be sha256/);
});

test('warnings: a non-local base URL and roles not in accounts', () => {
  const s = fullSet();
  s.app.baseUrl = 'https://staging.example.com';
  s.shots[0].as = 'visitor';
  const { errors, warnings } = gs.validateGuideSet(s);
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => /not localhost/.test(w)));
  assert.ok(warnings.some((w) => /"visitor" is not in app\.accounts/.test(w)));
});

test('parent cycles and duplicate ids', () => {
  const s = fullSet();
  s.guides[0].parent = 'employee';
  s.guides.push({ ...s.guides[2], file: 'docs/x.md' });
  const e = errorsOf(s).join('\n');
  assert.match(e, /parent cycle/);
  assert.match(e, /id is a duplicate/);
});

test('save writes canonical order and load round-trips; save refuses an invalid set', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-'));
  const file = path.join(dir, 'docs', 'guides.json');
  const s = fullSet();
  const shuffled = Object.fromEntries(Object.entries(s).reverse());
  gs.saveGuideSet(file, shuffled);
  const text = fs.readFileSync(file, 'utf8');
  assert.deepEqual(Object.keys(JSON.parse(text)), ['schemaVersion', 'product', 'app', 'interview', 'notChecked', 'leftOut', 'checks', 'guides', 'shots', 'publish']);
  assert.ok(text.endsWith('}\n'));
  assert.deepEqual(gs.loadGuideSet(file), JSON.parse(JSON.stringify(s)));
  const bad = fullSet();
  bad.schemaVersion = 2;
  assert.throws(() => gs.saveGuideSet(file, bad), gs.GuideSetError);
  fs.writeFileSync(file, '{ nope');
  assert.throws(() => gs.loadGuideSet(file), /not valid JSON/);
  fs.rmSync(dir, { recursive: true });
});

test('guide transitions and their owners', () => {
  const s = gs.createGuideSet();
  gs.addGuide(s, { id: 'g', type: 'role-guide', file: 'docs/g.md', title: 'G' }, { by: 'write-guides' });
  assert.equal(s.guides[0].status, 'outlined');
  assert.throws(() => gs.addGuide(s, { id: 'h', type: 'role-guide', file: 'docs/h.md', title: 'H' }, { by: 'wiki-guides' }), /belongs to write-guides/);
  assert.throws(() => gs.moveGuide(s, 'g', 'checked', { by: 'write-guides' }), /no move from outlined to checked/);
  gs.moveGuide(s, 'g', 'written', { by: 'write-guides' });
  assert.throws(() => gs.moveGuide(s, 'g', 'checked', { by: 'wiki-guides' }), /belongs to write-guides/);
  gs.moveGuide(s, 'g', 'checked', { by: 'write-guides' });
  gs.markGuideEdited(s, 'g', { by: 'wiki-guides' }); // a label fix
  assert.equal(s.guides[0].status, 'written');
  const a = gs.addGuide(s, { id: 'adopted', type: 'features-and-value', file: 'docs/wiki/a.md', title: 'A' }, { by: 'wiki-guides', adopt: true });
  assert.equal(a.status, 'written');
  assert.throws(() => gs.moveGuide(s, 'g', 'outlined', { by: 'write-guides' }), /no move/);
  assert.throws(() => gs.moveGuide(s, 'g', 'written', { by: 'someone' }), /unknown actor/);
  assert.deepEqual(errorsOf(s), []);
});

test('shot transitions follow the table, with their owners', () => {
  const s = gs.createGuideSet();
  gs.addGuide(s, { id: 'g', type: 'role-guide', file: 'docs/g.md', title: 'G' }, { by: 'write-guides' });
  const base = { alt: 'Home: the cards', as: 'employee', path: 'docs/images/x.svg', target: { what: 'cards', locator: null }, guides: ['g'] };
  gs.addShot(s, { id: 'x', ...base }, { by: 'write-guides' });
  assert.equal(s.shots[0].status, 'placeholder');
  assert.throws(() => gs.addShot(s, { id: 'y', ...base }, { by: 'wiki-guides' }), /belongs to write-guides/);
  assert.throws(() => gs.moveShot(s, 'x', 'taken', { by: 'write-guides' }), /belongs to wiki-guides/);
  assert.throws(() => gs.moveShot(s, 'x', 'taken', { by: 'wiki-guides' }), /needs takenAt, release, fingerprint/);
  assert.throws(() => gs.moveShot(s, 'x', 'retake', { by: 'write-guides' }), /no move from placeholder to retake/);
  gs.moveShot(s, 'x', 'taken', { by: 'wiki-guides', path: 'docs/images/x.png', takenAt: '2026-03-02T10:00:00Z', release: '1.0', fingerprint: FP });
  assert.equal(s.shots[0].path, 'docs/images/x.png');
  assert.equal(gs.markRetakeIfChanged(s, 'x', FP), false);
  assert.equal(gs.markRetakeIfChanged(s, 'x', FP2), true);
  assert.equal(s.shots[0].status, 'retake');
  gs.moveShot(s, 'x', 'needs-text', { by: 'wiki-guides', note: 'the dialog has a new field' });
  assert.equal(s.shots[0].note, 'the dialog has a new field');
  gs.moveShot(s, 'x', 'retake', { by: 'write-guides' });
  gs.moveShot(s, 'x', 'blocked', { by: 'wiki-guides', note: 'the inbox was empty' });
  gs.moveShot(s, 'x', 'taken', { by: 'wiki-guides', takenAt: '2026-03-03T10:00:00Z', release: '1.1', fingerprint: FP2 });
  assert.equal(s.shots[0].note, undefined);
  assert.deepEqual(errorsOf(s), []);

  // needs-text back to placeholder needs the card and clears the taken fields
  gs.markRetakeIfChanged(s, 'x', FP);
  gs.moveShot(s, 'x', 'needs-text', { by: 'wiki-guides' });
  assert.throws(() => gs.moveShot(s, 'x', 'placeholder', { by: 'write-guides' }), /\.svg card/);
  gs.moveShot(s, 'x', 'placeholder', { by: 'write-guides', path: 'docs/images/x.svg' });
  assert.equal(s.shots[0].fingerprint, undefined);
  assert.deepEqual(errorsOf(s), []);

  // an adopted image is taken with no fingerprint, so the first refresh retakes it
  gs.addShot(s, { id: 'old', ...base, path: 'docs/images/old.png', fingerprint: FP }, { by: 'write-guides', adopt: true });
  assert.equal(s.shots[1].status, 'taken');
  assert.equal(s.shots[1].fingerprint, undefined);
  assert.equal(gs.markRetakeIfChanged(s, 'old', FP), true);
  assert.deepEqual(errorsOf(s), []);
});

test('every row of the transition tables is reachable through moveShot/moveGuide', () => {
  for (const [from, to, who] of gs.SHOT_TRANSITIONS) for (const w of who) assert.ok(gs.ACTORS.includes(w), `${from}→${to}`);
  const fromStates = new Set(gs.SHOT_TRANSITIONS.map(([f]) => f).filter(Boolean));
  for (const st of gs.SHOT_STATUSES) assert.ok(fromStates.has(st), `${st} has a way out`);
});

test('the README status block is regenerated between its markers only', () => {
  const s = fullSet();
  const readme = '# Guides\n\nIntro text.\n\n<!-- user-guides:status:begin -->\nold\n<!-- user-guides:status:end -->\n\nFooter.\n';
  const out = gs.updateIndex(readme, s, 'docs/user-guides/README.md');
  assert.match(out, /^# Guides\n\nIntro text\.\n\n<!-- user-guides:status:begin -->/);
  assert.match(out, /\| \[For employees\]\(employee\.md\) \| role-guide \| employee \| written \| 1 of 2 taken \|/);
  assert.match(out, /\| \[Running Leave Planner\]\(\.\.\/wiki\/admin\.md\) \|/);
  assert.match(out, /Claims not checked against the running app: 1\./);
  assert.match(out, /<!-- user-guides:status:end -->\n\nFooter\.\n$/);
  assert.equal(gs.updateIndex(out, s, 'docs/user-guides/README.md'), out);
  assert.match(gs.updateIndex('# New\n', s), /# New\n\n<!-- user-guides:status:begin -->/);
});

test('the CLI validates and reports', async () => {
  const { execFileSync, spawnSync } = await import('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-cli-'));
  const file = path.join(dir, 'guides.json');
  gs.saveGuideSet(file, fullSet());
  const script = new URL('../skills/write-guides/scripts/guide-set.mjs', import.meta.url).pathname;
  assert.match(execFileSync('node', [script, 'validate', file], { encoding: 'utf8' }), /valid \(3 guides, 2 shots\)/);
  assert.match(execFileSync('node', [script, 'summary', file], { encoding: 'utf8' }), /"placeholder": 1/);
  fs.writeFileSync(file, JSON.stringify({ ...fullSet(), schemaVersion: 9 }));
  const r = spawnSync('node', [script, 'validate', file], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /schemaVersion must be 1/);
  fs.rmSync(dir, { recursive: true });
});
