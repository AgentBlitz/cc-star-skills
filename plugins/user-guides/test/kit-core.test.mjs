// kit-core.mjs: the Playwright lookup, sign-in helpers and the screen reader / fingerprint.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as kit from '../skills/write-guides/scripts/kit-core.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ug-kit-'));

const PAGE = `<!doctype html><html><head><title>Settings · Demo</title><script>var x = "<b>";</script></head>
<body><header><nav aria-label="Main"><a href="/home" aria-current="page">Home</a><a href="/settings">Settings</a></nav></header>
<main><h1>Settings</h1>
<section data-region="notif" role="region" aria-labelledby="h-n"><h2 id="h-n">Notifications</h2>
<label><input type="checkbox" name="a" checked> Email me on 3 March 2026</label>
<label for="b">Weekly summary</label><input id="b" type="checkbox">
<p>You have 12 unread &amp; 3 new</p></section>
<dialog id="d" aria-labelledby="dt"><h2 id="dt">Hidden dialog</h2><button>Close</button></dialog>
<div hidden><button>Ghost</button></div>
<form method="get" action="/x"><input type="hidden" name="new" value="1"><button type="submit">Open</button></form>
<table aria-label="People"><tr><th>Name<td>Ana<tr><td>Ben</table>
<button type="submit">Save settings</button></main></body></html>`;

test('parseHtml reads tags, attributes, entities, raw text and implied ends', () => {
  const doc = kit.parseHtml(PAGE);
  const tags = [...kit.descendants(doc)].map((e) => e.tag);
  assert.ok(tags.includes('dialog') && tags.includes('table'));
  const script = [...kit.descendants(doc)].find((e) => e.tag === 'script');
  assert.equal(script.children[0].text, 'var x = "<b>";');
  const tds = [...kit.descendants(doc)].filter((e) => e.tag === 'td');
  assert.equal(tds.length, 2, 'td and tr close implicitly');
  assert.match(kit.textOf(kit.bodyOf(doc)), /You have 12 unread & 3 new/);
});

test('roles and accessible names follow the markup, and hidden parts are left out', () => {
  const s = kit.readScreen(PAGE);
  assert.equal(s.title, 'Settings · Demo');
  assert.equal(s.h1, 'Settings');
  assert.deepEqual(s.headings.map((h) => h.text), ['Settings', 'Notifications']);
  assert.deepEqual(
    s.controls.map((c) => `${c.role}:${c.name}`),
    ['link:Home', 'link:Settings', 'checkbox:Email me on 3 March 2026', 'checkbox:Weekly summary', 'button:Open', 'button:Save settings'],
  );
  assert.deepEqual(s.regions.map((r) => r.locator), ['role=navigation[name="Main"]', 'css=[data-region="notif"]', 'role=table[name="People"]']);
  assert.ok(!s.text.includes('Ghost') && !s.text.includes('Hidden dialog'));
});

test('locators: role and name, css, text, chains, ids; unsupported ones give null', () => {
  const doc = kit.parseHtml(PAGE);
  assert.equal(kit.queryLocator(doc, 'role=button[name="Save settings"]').tag, 'button');
  assert.equal(kit.queryLocator(doc, 'role=button[name="save"]').tag, 'button', 'names match case-insensitively by substring');
  assert.equal(kit.queryLocator(doc, 'role=button[name="save"s]'), null, '"…"s is exact');
  assert.equal(kit.queryLocator(doc, 'css=[data-region="notif"]').tag, 'section');
  assert.equal(kit.queryLocator(doc, 'section[data-region=notif] > h2').attrs.id, 'h-n');
  assert.equal(kit.queryLocator(doc, 'role=region[name="Notifications"] >> role=checkbox[name="Weekly summary"]').attrs.id, 'b');
  assert.equal(kit.queryLocator(doc, 'text="Weekly summary"').tag, 'label');
  assert.equal(kit.queryLocator(doc, 'id=b').attrs.id, 'b');
  assert.equal(kit.queryLocator(doc, 'role=dialog[name="Hidden dialog"]'), null, 'a closed dialog is hidden');
  assert.equal(kit.queryLocatorAll(doc, 'xpath=//main'), null);
});

test('screenNames: the title before its suffix, without a leading count, and the h1', () => {
  assert.deepEqual(kit.screenNames({ title: 'Requests · Leave Planner', h1: 'Your requests' }), ['Requests', 'Your requests']);
  assert.deepEqual(kit.screenNames({ title: '(1) Today · Leave Planner', h1: 'Good afternoon' }), ['Today', 'Good afternoon']);
  assert.deepEqual(kit.screenNames({ title: '(12+) Inbox | Mail' }), ['Inbox']);
  assert.deepEqual(kit.screenNames({ title: 'Team', h1: 'Team' }), ['Team']);});

test('normaliseText turns dates, times and numbers into placeholders', () => {
  for (const [a, b] of [
    ['On 3 March 2026 at 14:05', 'On 9 May 2027 at 9:30'],
    ['Due 2026-03-02', 'Due 2027-12-31'],
    ['12 days left', '3 days left'],
    ['Mon 2 Mar', 'Fri 13 Nov'],
    ['March 2026', 'April 2027'],
  ]) assert.equal(kit.normaliseText(a), kit.normaliseText(b), `${a} ~ ${b}`);
  assert.notEqual(kit.normaliseText('Request leave'), kit.normaliseText('New request'));
});

test('fingerprint: pure, blind to numbers and dates, sensitive to headings and control names', () => {
  const base = { headings: [{ level: 2, text: 'Inbox (3)' }], controls: [{ role: 'button', name: 'Approve' }] };
  const fp = kit.fingerprint(base);
  assert.match(fp, /^sha256:[0-9a-f]{64}$/);
  assert.equal(kit.fingerprint(structuredClone(base)), fp);
  assert.equal(kit.fingerprint({ ...base, headings: [{ level: 2, text: 'Inbox (12)' }] }), fp);
  assert.notEqual(kit.fingerprint({ ...base, controls: [{ role: 'button', name: 'Accept' }] }), fp);
  assert.notEqual(kit.fingerprint({ ...base, controls: [] }), fp);
  assert.notEqual(kit.fingerprint({ ...base, headings: [{ level: 2, text: 'Outbox (3)' }] }), fp);
});

test('regionFingerprint finds the region, or says it is not there', () => {
  const r = kit.regionFingerprint(PAGE, 'css=[data-region="notif"]');
  assert.ok(r.found);
  const changed = PAGE.replace('Weekly summary', 'Monthly summary');
  assert.notEqual(kit.regionFingerprint(changed, 'css=[data-region="notif"]').fingerprint, r.fingerprint);
  const datesOnly = PAGE.replace('3 March 2026', '9 April 2027').replace('12 unread', '40 unread');
  assert.equal(kit.regionFingerprint(datesOnly, 'css=[data-region="notif"]').fingerprint, r.fingerprint);
  assert.deepEqual(kit.regionFingerprint(PAGE, 'role=dialog[name="Nope"]'), { found: false, fingerprint: null });
  assert.ok(kit.regionFingerprint(PAGE, null).found, 'null means the whole screen');
});

test('findPlaywright: the project first, then USER_GUIDES_PLAYWRIGHT_CORE, then the cache', () => {
  const root = tmp();
  const fake = (dir, name, version) => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name, version, main: 'index.js' }));
    fs.writeFileSync(path.join(dir, 'index.js'), 'exports.chromium = {};');
  };
  const cacheHome = path.join(root, 'cache');
  const env = { XDG_CACHE_HOME: cacheHome, HOME: root };
  assert.equal(kit.findPlaywright({ root, env }), null);
  assert.equal(kit.pwCacheDir(env), path.join(cacheHome, 'user-guides', `pw-${kit.PW_VERSION}`));
  fake(path.join(kit.pwCacheDir(env), 'node_modules', 'playwright-core'), 'playwright-core', kit.PW_VERSION);
  assert.equal(kit.findPlaywright({ root, env }).source, 'the user-guides cache');
  fake(path.join(root, 'pw-env'), 'playwright-core', '1.0.0');
  assert.equal(kit.findPlaywright({ root, env: { ...env, USER_GUIDES_PLAYWRIGHT_CORE: path.join(root, 'pw-env') } }).source, 'USER_GUIDES_PLAYWRIGHT_CORE');
  fs.mkdirSync(path.join(root, 'apps', 'web'), { recursive: true });
  fs.writeFileSync(path.join(root, 'apps', 'web', 'package.json'), '{}');
  fake(path.join(root, 'apps', 'web', 'node_modules', '@playwright', 'test'), '@playwright/test', '1.50.0');
  const found = kit.findPlaywright({ root, playwrightFrom: 'apps/web', env: { ...env, USER_GUIDES_PLAYWRIGHT_CORE: path.join(root, 'pw-env') } });
  assert.match(found.source, /^the project \(apps\/web, @playwright\/test\)$/);
  assert.equal(found.version, '1.50.0');
});

test('installPlaywright never runs headless; the command names the cache', () => {
  const env = { XDG_CACHE_HOME: '/tmp/x' };
  assert.throws(() => kit.installPlaywright({ headless: true, env }), /headless run never installs Playwright[\s\S]*npm install --prefix "\/tmp\/x\/user-guides\/pw-1\.63\.0"/);
  assert.match(kit.installCommand(env), /--ignore-scripts .*playwright-core@1\.63\.0$/);
});

test('writeSecret writes mode 600 in a mode 700 folder', () => {
  const file = path.join(tmp(), '.user-guides', 'auth', 'employee.json');
  kit.writeSecret(file, '{"cookies":[]}');
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.equal(fs.statSync(path.dirname(file)).mode & 0o777, 0o700);
  assert.equal(kit.storageStateFile('/r', 'manager'), path.join('/r', '.user-guides', 'auth', 'manager.json'));
});

test('cookieFromCommand returns the value and never puts it in an error', () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'ok.mjs'), 'console.log("debug line"); console.log("s3cr3t-" + process.argv[2]);');
  fs.writeFileSync(path.join(root, 'bad.mjs'), 'console.log("s3cr3t-leak"); console.error("refusing: set FLAG=1"); process.exit(2);');
  const signIn = (cmd) => ({ kind: 'cookie-command', command: cmd, cookie: { name: 'sid' } });
  assert.equal(kit.cookieFromCommand({ root, signIn: signIn('node ok.mjs {id}'), role: 'employee', account: { id: "o'neil" } }), "s3cr3t-o'neil");
  assert.throws(
    () => kit.cookieFromCommand({ root, signIn: signIn('node bad.mjs {id}'), role: 'employee', account: { id: 'x' } }),
    (err) => /refusing: set FLAG=1/.test(err.message) && !err.message.includes('s3cr3t'),
  );
});

test('browserContextOptions: storage-state needs a saved file, and says how to make one', () => {
  const root = tmp();
  const set = { app: { baseUrl: 'http://127.0.0.1:1', signIn: { kind: 'storage-state' }, accounts: { admin: {} } } };
  assert.throws(() => kit.browserContextOptions({ set, role: 'admin', root, headless: true }), /headless run cannot sign in by hand/);
  kit.writeSecret(kit.storageStateFile(root, 'admin'), '{}');
  assert.deepEqual(kit.browserContextOptions({ set, role: 'admin', root }), { storageState: kit.storageStateFile(root, 'admin') });
  assert.deepEqual(kit.browserContextOptions({ set: { app: { signIn: { kind: 'none' } } }, role: 'x', root }), {});
});

test('CookieJar keeps, replaces and expires cookies', () => {
  const jar = new kit.CookieJar();
  const res = (lines) => ({ headers: { getSetCookie: () => lines } });
  jar.absorb(res(['a=1; Path=/; HttpOnly', 'b=2']));
  assert.equal(jar.header(), 'a=1; b=2');
  jar.absorb(res(['a=; Path=/; Max-Age=0']));
  assert.equal(jar.header(), 'b=2');
});
