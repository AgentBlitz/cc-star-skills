// Integration tests for the Partner Portal fixture (platform-audit PLAN §2.7, S3). No browser: plain HTTP.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRUTH, startPortal, signIn, gql, concrete, settle } from './portal.mjs';

const DENIED = 'You do not have permission to view this page.';

test('the server starts on port 0, on 127.0.0.1, and prints its URL', async () => {
  const p = await startPortal(['--port', '0']);
  try {
    assert.match(p.line, /^Partner Portal fixture on http:\/\/127\.0\.0\.1:\d+$/);
    assert.ok(p.port > 0);
    const res = await fetch(p.url + '/login');
    assert.equal(res.status, 200);
    assert.match(await res.text(), /Sign in as demo partner/);
  } finally { await p.stop(); }
});

test('sign-in sets the session cookie; pages and the API refuse a request without it', async () => {
  const p = await startPortal();
  try {
    const page = await fetch(p.url + '/orders', { redirect: 'manual' });
    assert.equal(page.status, 302);
    assert.equal(page.headers.get('location'), '/login?next=%2Forders');
    assert.equal((await gql(p.url, null, 'query Shell { me { displayName } }')).status, 401);
    assert.equal((await fetch(p.url + '/api/export/orders.csv')).status, 401);

    const { res, cookie, setCookie } = await signIn(p.url);
    assert.equal(res.status, 303);
    assert.equal(res.headers.get('location'), '/orders');
    assert.match(setCookie, /^pp_session=[\w-]+; Path=\/; HttpOnly; SameSite=Lax$/);

    const ok = await fetch(p.url + '/orders', { headers: { Cookie: cookie } });
    assert.equal(ok.status, 200);
    assert.match(await ok.text(), /\/assets\/index-3f9c2a71\.js/);
    const shell = await (await gql(p.url, cookie, 'query Shell { me { displayName } }')).json();
    assert.equal(shell.data.me.displayName, 'Dana Example');

    // the scripts are public, as a real app's are
    assert.equal((await fetch(p.url + '/assets/index-3f9c2a71.js')).status, 200);

    const out = await fetch(p.url + '/logout', { redirect: 'manual', headers: { Cookie: cookie } });
    assert.equal(out.status, 303);
    assert.match(out.headers.get('set-cookie'), /Max-Age=0/);
    assert.equal((await fetch(p.url + '/orders', { redirect: 'manual', headers: { Cookie: cookie } })).status, 302);
  } finally { await p.stop(); }
});

test('each hidden route shows the permission screen to the demo role, and visible ones do not', async () => {
  const p = await startPortal();
  try {
    const { cookie } = await signIn(p.url);
    const hidden = TRUTH.routes.filter((r) => !r.visible);
    assert.equal(hidden.length, 4);
    for (const r of TRUTH.routes.filter((x) => x.path !== '/login')) {
      const res = await fetch(p.url + concrete(r.path), { headers: { Cookie: cookie } });
      assert.equal(res.status, 200, r.path);
      assert.equal((await res.text()).includes(DENIED), !r.visible, r.path);
    }
    // the API behind a hidden screen refuses too
    const fin = await (await gql(p.url, cookie, 'query FinanceReport { financeReport { month } }')).json();
    assert.equal(fin.errors[0].extensions.code, 'FORBIDDEN');
    assert.equal((await fetch(p.url + '/no-such-page', { headers: { Cookie: cookie } })).status, 404);
  } finally { await p.stop(); }
});

test('six quick data requests pass, and the seventh gets 429 with Retry-After: 30', async () => {
  const p = await startPortal();
  try {
    const { cookie } = await signIn(p.url);
    for (let i = 1; i <= 6; i++) assert.equal((await gql(p.url, cookie, 'query Payouts { payouts { id } }')).status, 200, `request ${i}`);
    const seventh = await gql(p.url, cookie, 'query Payouts { payouts { id } }');
    assert.equal(seventh.status, 429);
    assert.equal(seventh.headers.get('retry-after'), '30');
    // pages and assets are not data requests
    assert.equal((await fetch(p.url + '/payouts', { headers: { Cookie: cookie } })).status, 200);
    // the limit is per session
    const other = await signIn(p.url);
    assert.equal((await gql(p.url, other.cookie, 'query Payouts { payouts { id } }')).status, 200);
  } finally { await p.stop(); }
});

test('--rate changes the limit', async () => {
  const p = await startPortal(['--rate', '2/10']);
  try {
    const { cookie } = await signIn(p.url);
    assert.equal((await gql(p.url, cookie, 'query Payouts { payouts { id } }')).status, 200);
    assert.equal((await gql(p.url, cookie, 'query Payouts { payouts { id } }')).status, 200);
    assert.equal((await gql(p.url, cookie, 'query Payouts { payouts { id } }')).status, 429);
  } finally { await p.stop(); }
});

test('a mutation, an upload and a download each appear in the log with the right kind', async () => {
  const p = await startPortal();
  try {
    const { cookie } = await signIn(p.url);
    await fetch(p.url + '/customers', { headers: { Cookie: cookie } });
    await fetch(p.url + '/assets/de-c27f5a94.js');
    const m = await (await gql(p.url, cookie, 'mutation RequestPayout($input: PayoutInput!) { requestPayout(input: $input) { ok } }', { input: { amount: 100, method: 'WALLET' } })).json();
    assert.equal(m.data.requestPayout.ok, true);

    const fd = new FormData();
    fd.append('file', new Blob(['Name,Email,Tier\nTest One,one@example.com,GOLD\n'], { type: 'text/csv' }), 'customers.csv');
    const up = await fetch(p.url + '/api/upload', { method: 'POST', body: fd, headers: { Cookie: cookie } });
    assert.equal(up.status, 200);
    const uj = await up.json();
    assert.equal(uj.rows, 1);
    assert.deepEqual(uj.columns, ['Name', 'Email', 'Tier']);

    const csv = await fetch(p.url + '/api/export/orders.csv', { headers: { Cookie: cookie } });
    assert.equal(csv.status, 200);
    assert.match(await csv.text(), /^Order,Date,Customer,Status,Items,Amount\n#1000/);
    await settle();

    const log = p.entries();
    for (const e of log) assert.deepEqual(Object.keys(e), ['time', 'method', 'path', 'op', 'kind', 'status']);
    const find = (pred) => log.find(pred);
    assert.ok(find((e) => e.kind === 'mutation' && e.op === 'RequestPayout' && e.path === '/api/graphql' && e.status === 200));
    assert.ok(find((e) => e.kind === 'upload' && e.method === 'POST' && e.path === '/api/upload' && e.status === 200));
    assert.ok(find((e) => e.kind === 'download' && e.path === '/api/export/orders.csv' && e.status === 200));
    assert.ok(find((e) => e.kind === 'page' && e.path === '/customers' && e.status === 200));
    assert.ok(find((e) => e.kind === 'asset' && e.path === '/assets/de-c27f5a94.js' && e.status === 200));
  } finally { await p.stop(); }
});

test('an upload over 2 MB or of the wrong type is refused', async () => {
  const p = await startPortal();
  try {
    const { cookie } = await signIn(p.url);
    const send = (name, bytes) => { const fd = new FormData(); fd.append('file', new Blob([Buffer.alloc(bytes, 97)]), name); return fetch(p.url + '/api/upload', { method: 'POST', body: fd, headers: { Cookie: cookie } }); };
    assert.equal((await send('notes.txt', 10)).status, 415);
    assert.equal((await send('big.csv', 2 * 1024 * 1024 + 10)).status, 413);
  } finally { await p.stop(); }
});

test('truth.json is in step with itself: every route has a screen entry and the expected statuses', () => {
  const paths = TRUTH.routes.map((r) => r.path);
  assert.equal(new Set(paths).size, paths.length);
  for (const r of TRUTH.routes) {
    assert.ok(TRUTH.screens[r.screen], `screen for ${r.path}`);
    const visible = r.screen === 'Payouts' ? ['📄'] : r.public ? ['✅', '🚪'] : ['✅'];
    assert.deepEqual(r.expected, r.visible ? visible : ['⛔', '🔒'], r.path);
    // a signed-out page may go unseen (🚪), so its block is scored only when the report has one
    assert.equal(Boolean(TRUTH.screens[r.screen].optional), Boolean(r.public), r.path);
  }
  assert.equal(Object.keys(TRUTH.screens).length, TRUTH.routes.length);
});
