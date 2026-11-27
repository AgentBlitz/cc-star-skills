// The in-page probe in headless Chromium against the Partner Portal fixture (platform-audit S4).
// The tests sign in with the fixture's demo button, the one place a session may click sign-in itself.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startPortal, TRUTH, SCRIPTS } from './portal.mjs';

const PROBE_FILE = path.join(SCRIPTS, 'probe.js');
const PROBE = fs.readFileSync(PROBE_FILE, 'utf8');
const REINSTALL = /^\/\/ After a full load: (.+)$/m.exec(PROBE)[1];

let pw = null;
try { pw = await import('playwright-core'); } catch { /* skipped below */ }

let portal, browser, page;
const outputs = []; // every probe output, for the privacy checks

before(async () => {
  if (!pw) return;
  portal = await startPortal(['--rate', '1000/10']);
  browser = await pw.chromium.launch({ headless: true });
  page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await page.goto(portal.url + '/');
  await page.click('text=Sign in as demo partner');
  await page.waitForSelector('main h1:has-text("Orders")');
});
after(async () => { await browser?.close(); await portal?.stop(); });

const skip = (t) => (pw ? false : (t.skip('playwright-core is not installed'), true));
const paste = async () => keep(await page.evaluate(PROBE));
const keep = (s) => { assert.equal(typeof s, 'string'); outputs.push(s); return JSON.parse(s); };
const call = async (m, ...a) => keep(await page.evaluate(([m, a]) => window.__auditProbe[m](...a), [m, a]));
const heading = (t) => page.waitForSelector(`main h1:has-text("${t}")`);
const go = async (text, h) => { assert.equal((await call('open', text)).ok, 1, `open ${text}`); await heading(h ?? text); };
const names = (list = []) => list.map((x) => x.t);
const byName = (list, t) => list.find((x) => x.t === t);

/** Data on the page right now: cell text, description values and every field value. */
const pageData = () => page.evaluate(() => [
  ...[...document.querySelectorAll('td,[role=gridcell],dd')].map((e) => e.textContent.trim()),
  ...[...document.querySelectorAll('input,textarea,select')].map((e) => e.value),
].filter((s) => s.length > 2 && !/^[A-Z_]+$/.test(s) && !/^(on|\d+)$/.test(s)));

/** Assert no output since `from` holds a query string, a private term, or any of the page's data. */
async function assertPrivate(from, where) {
  const data = await pageData();
  for (const s of outputs.slice(from)) {
    assert.doesNotMatch(s, /\?[^\s"]*=/, `${where}: a query string`);
    assert.doesNotMatch(s, /@example\.com/, `${where}: an email`);
    for (const term of TRUTH.privateTerms) assert.ok(!s.includes(term), `${where}: private term ${term}`);
    for (const d of data) assert.ok(!s.includes(d), `${where}: page data "${d}"`);
  }
}

test('probe.js is at most 12 KB (D18)', () => {
  const bytes = fs.statSync(PROBE_FILE).size;
  assert.ok(bytes <= 12288, `probe.js is ${bytes} bytes`);
});

test('pasting defines window.__auditProbe and returns recon(); pasting twice is harmless', async (t) => {
  if (skip(t)) return;
  const r = await paste();
  assert.equal(r.version, await page.evaluate(() => window.__auditProbe.version));
  await page.evaluate(() => { window.__auditProbe.mark = 1; });
  const again = await paste();
  assert.deepEqual(again, r);
  assert.equal(await page.evaluate(() => window.__auditProbe.mark), 1, 'the second paste kept the first probe');
  assert.equal(await page.evaluate(() => typeof sessionStorage.__auditProbe), 'string', 'source saved');
  await call('requests');
  await go('Payouts');
  const { calls } = await call('requests');
  assert.deepEqual(Object.keys(calls), [`127.0.0.1:${portal.port}`]);
  assert.deepEqual(calls[`127.0.0.1:${portal.port}`], ['/api/graphql 200×1'], 'one call, counted once');
});

test('recon() on Orders: title, language, host, scripts, nav summary and parameter names only', async (t) => {
  if (skip(t)) return;
  const from = outputs.length;
  await page.goto(portal.url + '/orders?status=PAID&ref=REF-7Q2X');
  await heading('Orders');
  const r = await paste();
  assert.equal(r.title, 'Partner Portal');
  assert.equal(r.lang, 'en');
  assert.equal(r.host, `127.0.0.1:${portal.port}`);
  assert.equal(r.path, '/orders');
  assert.deepEqual(r.params, ['status', 'ref']);
  assert.deepEqual(r.scripts, ['/config.js', '/assets/index-3f9c2a71.js']);
  assert.deepEqual(r.styles, ['/app.css']);
  assert.deepEqual(r.nav.top, Object.keys(TRUTH.shell.menu));
  assert.equal(r.nav.items, Object.keys(TRUTH.shell.menu).length + Object.values(TRUTH.shell.menu).flat().length);
  assert.equal(r.signin, undefined, 'signed in');
  assert.ok(!JSON.stringify(r).includes('PAID'));
  await assertPrivate(from, 'recon');
});

test('recon() on the sign-in page gives the signed-in hint', async (t) => {
  if (skip(t)) return;
  const other = await (await browser.newContext()).newPage();
  await other.goto(portal.url + '/payouts');
  const r = JSON.parse(await other.evaluate(PROBE));
  assert.equal(r.signin, 'auth page');
  assert.deepEqual(r.params, ['next']);
  await other.context().close();
});

test('nav(): the menu tree with depth, path and expanded state, and no hidden routes', async (t) => {
  if (skip(t)) return;
  const n = await call('nav');
  assert.equal(n.menus.length, 1);
  assert.equal(n.menus[0].t, 'Main menu');
  const tree = {};
  let group;
  for (const it of n.menus[0].items) {
    if (!it.d) { group = it.t; tree[group] = []; assert.equal(it.exp, 'true', `${it.t} expanded`); }
    else { assert.equal(it.d, 1); tree[group].push(it.t); }
  }
  assert.deepEqual(tree, TRUTH.shell.menu);
  const paths = Object.fromEntries(n.menus[0].items.filter((i) => i.path).map((i) => [i.t, i.path]));
  for (const r of TRUTH.routes.filter((x) => x.menu && x.visible)) assert.equal(paths[r.menu.split(' › ')[1]], r.path);
  for (const r of TRUTH.routes.filter((x) => !x.visible)) assert.ok(!Object.values(paths).includes(r.path), `${r.path} not in the menu`);
  assert.equal(n.menus[0].items.find((i) => i.cur === 'page').t, 'Orders');
});

test('screen() on Orders: filters, actions, fields, the table and the pager', async (t) => {
  if (skip(t)) return;
  const from = outputs.length;
  const s = await call('screen');
  const truth = TRUTH.screens.Orders;
  assert.equal(s.path, '/orders');
  assert.deepEqual(s.h, ['1 Orders']);
  const labels = [...names(s.buttons), ...names(s.fields)];
  for (const f of truth.filters) assert.ok(labels.some((l) => l.startsWith(f)), `filter ${f}`);
  for (const a of ['Clear filters', 'Columns', 'Export CSV', 'Rows per page', 'Previous page', 'Next page']) assert.ok(labels.includes(a), `action ${a}`);
  assert.equal(byName(s.buttons, 'Previous page').dis, true);
  assert.equal(byName(s.buttons, 'Next page').dis, undefined);
  assert.equal(s.buttons.find((b) => b.t.startsWith('Status')).pop, 'listbox');
  assert.equal(byName(s.buttons, 'Date range').pop, 'dialog');
  const search = byName(s.fields, 'Search');
  assert.equal(search.type, 'search');
  assert.equal(search.ph, 'Order number or customer');
  assert.equal(byName(s.fields, 'Amount from').type, 'number');
  assert.deepEqual(byName(s.fields, 'Rows per page').opts, truth.rowsPerPage.map(String));
  assert.equal(s.tables.length, 1);
  const table = s.tables[0];
  assert.equal(table.t, 'Orders');
  assert.deepEqual(names(table.cols), truth.columns);
  assert.ok(table.cols.every((c) => typeof c.menu === 'number'), 'every column has a menu');
  assert.equal(table.rows, 25);
  assert.equal(table.total, 25, 'from aria-rowcount');
  assert.ok(s.pager.some((p) => p.startsWith('Rows per page') && /of \d+/.test(p)), 'pager text');
  assert.ok(s.rowControls.some((c) => /^link ×25$/.test(c)), 'row links counted, not listed');
  assert.equal(s.links, undefined, 'no row links listed (empty lists are left out)');
  assert.ok((await pageData()).length >= 50, 'the privacy check has data to look for');
  await assertPrivate(from, 'Orders');
});

test('overlays(): the column menu, the status listbox, the Columns chooser and the date picker', async (t) => {
  if (skip(t)) return;
  const from = outputs.length;
  const s = await call('screen');
  assert.equal((await call('open', s.tables[0].cols[0].menu)).ok, 1);
  let o = await call('overlays');
  assert.equal(o.length, 1);
  assert.equal(o[0].kind, 'menu');
  assert.deepEqual(names(o[0].options), ['Sort ascending', 'Sort descending', 'Hide column']);
  await page.keyboard.press('Escape');

  assert.equal((await call('open', 'Status')).ok, 1, 'a filter button is allowed');
  o = await call('overlays');
  assert.equal(o[0].kind, 'listbox');
  assert.equal(o[0].t, 'Status');
  assert.deepEqual(names(o[0].options), ['PENDING', 'PAID', 'SHIPPED', 'REFUNDED', 'CANCELLED']);
  await page.keyboard.press('Escape');

  assert.equal((await call('open', 'Columns')).ok, 1);
  o = await call('overlays');
  assert.equal(o[0].kind, 'dialog');
  assert.equal(o[0].t, 'Columns');
  assert.deepEqual(names(o[0].toggles), TRUTH.screens.Orders.columns);
  assert.ok(o[0].toggles.every((x) => x.on === 1));
  assert.equal((await call('open', 'Order')).refused, 'toggle', 'a column checkbox is a toggle');
  await page.keyboard.press('Escape');

  assert.equal((await call('open', 'Date range')).ok, 1);
  o = await call('overlays');
  assert.equal(o[0].t, 'Date range');
  for (const p of TRUTH.screens.Orders.datePresets) assert.ok(names(o[0].buttons).includes(p), `preset ${p}`);
  assert.ok(names(o[0].buttons).includes('Apply'));
  assert.deepEqual(o[0].fields.map((f) => [f.t, f.type]), [['From', 'date'], ['To', 'date']]);
  await page.keyboard.press('Escape');
  assert.deepEqual(await call('overlays'), []);
  await assertPrivate(from, 'Orders overlays');
});

test('open() refuses Export CSV, Log out, Copy, the language switch and the external Help link', async (t) => {
  if (skip(t)) return;
  const from = outputs.length;
  assert.deepEqual(await call('open', 'Export CSV'), { refused: 'download', t: 'Export CSV' });
  assert.equal((await call('open', 'Help')).refused, 'other host');
  assert.equal((await call('open', 'Account')).ok, 1);
  const o = await call('overlays');
  assert.equal(o[0].kind, 'menu');
  assert.deepEqual(names(o[0].options), ['English', 'Deutsch', 'Copy', 'Log out']);
  assert.deepEqual(o[0].groups, ['Language']);
  assert.equal((await call('open', 'Log out')).refused, 'log out');
  assert.equal((await call('open', 'Copy')).refused, 'danger word');
  assert.equal((await call('open', 'Deutsch')).refused, 'toggle');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
  assert.equal(new URL(page.url()).pathname, '/orders');
  await assertPrivate(from, 'Account menu');
});

test('screen() on Payouts (empty), and the Request payout dialog with its Submit refused', async (t) => {
  if (skip(t)) return;
  const from = outputs.length;
  await go('Payouts');
  const s = await call('screen');
  assert.deepEqual(s.tables, undefined);
  assert.ok(s.empty.some((e) => e.startsWith(TRUTH.screens.Payouts.empty)));
  assert.deepEqual(names(s.buttons), TRUTH.screens.Payouts.actions);
  assert.equal((await call('open', 'Request payout')).ok, 1, 'Request payout opens its form');
  const [d] = await call('overlays');
  const truth = TRUTH.screens.Payouts.dialogs['Request payout'];
  assert.equal(d.kind, 'dialog');
  assert.equal(d.t, 'Request payout');
  assert.deepEqual(names(d.fields), truth.fields);
  assert.deepEqual(d.fields.map((f) => f.type), ['number', 'select-one', 'textarea']);
  assert.equal(d.fields[0].req, true);
  assert.deepEqual(names(d.buttons), truth.actions.slice().reverse());
  assert.equal((await call('open', 'Submit')).refused, 'submit');
  await page.keyboard.press('Escape');
  await assertPrivate(from, 'Payouts');
});

test('screen() on Customers, and the Import customers wizard with its file input refused', async (t) => {
  if (skip(t)) return;
  const from = outputs.length;
  await go('Customers');
  const s = await call('screen');
  const truth = TRUTH.screens.Customers;
  for (const f of truth.filters) assert.ok(names(s.fields).includes(f), `filter ${f}`);
  assert.ok(byName(s.fields, 'Tier').opts.includes('GOLD'));
  assert.deepEqual(names(s.buttons), truth.actions);
  assert.equal(byName(s.buttons, 'Send voucher').dis, true);
  assert.deepEqual(names(s.tables[0].cols), ['(select)', ...truth.columns]);
  assert.deepEqual(names(s.toggles), ['Select all']);
  const n = s.tables[0].rows;
  assert.ok(n > 2);
  assert.deepEqual(s.rowControls, [`checkbox ×${n}`, `link ×${n}`], 'row controls counted, not listed');
  assert.equal((await call('open', 'Select all')).refused, 'toggle');

  assert.equal((await call('open', 'Import customers')).ok, 1, 'a form-opening button is allowed');
  const [d] = await call('overlays');
  const wiz = truth.dialogs['Import customers'];
  assert.equal(d.t, 'Import customers');
  const file = d.fields.find((f) => f.type === 'file');
  assert.equal(file.t, 'File');
  assert.equal((await call('open', file.i)).refused, 'file input');
  assert.equal((await call('open', 'Drop a file')).refused, 'file input');
  assert.equal((await call('open', 'Download template')).refused, 'download');
  assert.ok(d.notes.some((n) => n.includes(wiz.steps[0])), 'the step is a note');
  assert.ok(d.notes.some((n) => n.startsWith(wiz.accepts.slice(0, 11))), 'the accepted types are a note');
  await page.keyboard.press('Escape');
  await assertPrivate(from, 'Customers');
});

test('screen() on Order details: panels, terms, the line items, and no record data', async (t) => {
  if (skip(t)) return;
  const from = outputs.length;
  await go('Orders');
  await page.click('main td a'); // the test harness picks a row; the probe never lists row links
  await page.waitForSelector('main h1:has-text("Order #")');
  const s = await call('screen');
  assert.match(s.path, /^\/orders\/O-#$/);
  assert.deepEqual(s.h, ['1 Order ##', ...TRUTH.screens['Order details'].panels.map((p) => '2 ' + p)]);
  assert.deepEqual(s.terms, ['Date', 'Status', 'Customer', 'Amount']);
  assert.deepEqual(names(s.links), TRUTH.screens['Order details'].actions);
  assert.deepEqual(names(s.tables[0].cols), TRUTH.screens['Order details'].columns);
  await assertPrivate(from, 'Order details');
});

test('screen() on Profile reads labels, never the values', async (t) => {
  if (skip(t)) return;
  const from = outputs.length;
  await page.click('nav a:has-text("Profile")');
  await heading('Profile');
  const s = await call('screen');
  for (const f of TRUTH.shell.profile.slice(0, 2)) assert.ok(names(s.fields).includes(f), `field ${f}`);
  assert.equal(byName(s.fields, 'Email').ro, true);
  const save = s.buttons.find((b) => b.i != null && /save/i.test(b.t));
  assert.equal((await call('open', save.i)).refused, 'submit');
  await assertPrivate(from, 'Profile');
});

test('peek() reads the cached scripts and finds the hidden routes', async (t) => {
  if (skip(t)) return;
  const p = await call('peek');
  assert.ok(p.files.some((f) => f.path === '/assets/index-3f9c2a71.js' && f.kb > 10));
  for (const r of TRUTH.routes) assert.ok(p.routes.includes(r.path), `route ${r.path}`);
  const hidden = TRUTH.routes.filter((r) => !r.visible).map((r) => r.path);
  for (const h of hidden) assert.ok(p.hidden.includes(h), `hidden ${h}`);
  for (const r of TRUTH.routes.filter((x) => x.menu && x.visible)) assert.ok(!p.hidden.includes(r.path), `${r.path} is in the menu`);
  assert.ok(!p.hidden.includes('/logout'), 'log-out routes are never candidates');
  assert.ok(p.detail.includes('/orders/:orderId'));
  assert.ok(p.chunks.includes('/assets/admin-8d41b6e0.js'), 'the lazy admin chunk is named');
  assert.ok(p.labels > 50 && p.ops >= 10, `labels ${p.labels}, ops ${p.ops}`);
  const r = await call('requests');
  assert.ok(!Object.values(r.calls || {}).flat().some((c) => c.includes('/assets/')), "peek's own reads are not counted");
});

test('nothing the tests did changed anything on the server', async (t) => {
  if (skip(t)) return;
  const kinds = new Set(portal.entries().map((e) => e.kind));
  for (const k of ['mutation', 'upload', 'download']) assert.ok(!kinds.has(k), `no ${k}`);
});

test('requests() notices a 429', async (t) => {
  if (skip(t)) return;
  const strict = await startPortal();
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  try {
    await p.goto(strict.url + '/');
    await p.click('text=Sign in as demo partner');
    await p.waitForSelector('main h1:has-text("Orders")');
    await p.evaluate(PROBE);
    await p.evaluate(() => Promise.all(Array.from({ length: 8 }, () => fetch('/api/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"query":"query P { profile { displayName } }"}' }).then((r) => r.text()))));
    await p.waitForTimeout(200);
    const r = JSON.parse(await p.evaluate(() => window.__auditProbe.requests()));
    assert.ok(r.n429 >= 1, JSON.stringify(r));
    assert.ok(Object.values(r.calls).flat().some((c) => / 429×\d+$/.test(c)), JSON.stringify(r));
  } finally { await ctx.close(); await strict.stop(); }
});

test('reinstall() after a full load, and its clean failures', async (t) => {
  if (skip(t)) return;
  await page.reload();
  await heading('Profile');
  assert.equal(await page.evaluate(() => typeof window.__auditProbe), 'undefined');
  const r = JSON.parse(await page.evaluate(REINSTALL));
  assert.equal(r.path, '/settings/profile');
  assert.equal(await page.evaluate(() => typeof window.__auditProbe.screen), 'function');

  // DevTools-evaluated code is exempt from the page's CSP, so a CSP that forbids eval is simulated here:
  // the page's own eval throws, as it does for page scripts under script-src without 'unsafe-eval'.
  await page.reload();
  await heading('Profile');
  const blocked = await page.evaluate((code) => {
    const real = window.eval;
    window.eval = () => { throw new EvalError('unsafe-eval'); };
    try { return real(code); } finally { window.eval = real; }
  }, REINSTALL);
  assert.equal(blocked, 'eval blocked: paste probe.js');
  assert.equal(await page.evaluate(() => typeof window.__auditProbe), 'undefined');
  assert.equal(JSON.parse(await page.evaluate(PROBE)).path, '/settings/profile', 'pasting again works');

  const fresh = await (await browser.newContext()).newPage();
  await fresh.goto(portal.url + '/login');
  assert.equal(await fresh.evaluate(REINSTALL), 'paste probe.js', 'nothing saved in a new tab');
  await fresh.context().close();
});
