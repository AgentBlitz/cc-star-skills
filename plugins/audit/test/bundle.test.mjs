// Integration tests for the downloader, bundle.mjs, against the Partner Portal fixture (platform-audit S3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { TRUTH, SCRIPTS, FIXTURE, startPortal, tmp, settle } from './portal.mjs';

const BUNDLE = path.join(SCRIPTS, 'bundle.mjs');
const INVENTORY = path.join(SCRIPTS, 'inventory.mjs');
const ENTRY = '/assets/index-3f9c2a71.js';
const CHUNKS = ['assets/index-3f9c2a71.js', 'assets/admin-8d41b6e0.js', 'assets/de-c27f5a94.js'];

/** Run a script without blocking the event loop (the fixture runs in another process, but tests may serve too). */
function run(script, args) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [script, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    p.stdout.on('data', (d) => { stdout += d; });
    p.stderr.on('data', (d) => { stderr += d; });
    p.on('exit', (status) => resolve({ status, stdout, stderr }));
  });
}
const manifestOf = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));

test('fetch discovers and downloads the index, admin and German chunks, paced, and writes the manifest', async () => {
  const p = await startPortal();
  try {
    const out = tmp('bundle');
    const r = await run(BUNDLE, ['fetch', '--origin', p.url, '--out', out, '--delay', '250', ENTRY, '/config.js']);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    for (const f of [...CHUNKS, 'config.js']) assert.ok(fs.existsSync(path.join(out, f)), f);

    const m = manifestOf(out);
    assert.equal(m.client, 'platform-audit/1.0 (public bundle reader)');
    assert.deepEqual(m.files.map((f) => f.file).sort(), [...CHUNKS, 'config.js'].sort());
    for (const f of m.files) {
      assert.deepEqual(Object.keys(f).slice(0, 6), ['url', 'file', 'status', 'bytes', 'type', 'sha256']);
      const buf = fs.readFileSync(path.join(out, f.file));
      assert.equal(f.bytes, buf.length);
      assert.equal(f.sha256, crypto.createHash('sha256').update(buf).digest('hex'));
      assert.equal(f.url, p.url + '/' + f.file);
      assert.deepEqual(buf, fs.readFileSync(path.join(FIXTURE, 'public', f.file)));
    }
    assert.ok(m.sourceMaps.some((s) => s.url.endsWith('/assets/index-3f9c2a71.js.map')), 'source map noted');

    // paced: each asset request at least --delay after the one before; no source map fetched
    await settle();
    const times = p.entries().filter((e) => e.kind === 'asset').map((e) => Date.parse(e.time));
    assert.equal(times.length, 4);
    for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 250, `gap ${i}: ${times[i] - times[i - 1]} ms`);
    assert.ok(!p.entries().some((e) => e.path.endsWith('.map')));

    // the inventory over the download: every route in truth.json, every GraphQL operation, the German labels
    const invFile = path.join(tmp('bundle-inv'), 'inventory.json');
    const b = await run(INVENTORY, ['build', out, '--out', invFile, '--origin', p.url]);
    assert.equal(b.status, 0, b.stderr);
    const inv = JSON.parse(fs.readFileSync(invFile, 'utf8'));
    assert.ok(!inv.files.some((f) => f.name === 'manifest.json'), 'manifest.json is not read as a bundle file');
    const found = new Set(inv.routes.map((r) => r.path));
    const missing = TRUTH.routes.filter((r) => !found.has(r.path)).map((r) => r.path);
    assert.deepEqual(missing, [], 'routes in truth.json the inventory missed');
    assert.deepEqual([...found].sort(), TRUTH.routes.map((r) => r.path).sort(), 'and no route outside truth.json');
    for (const r of TRUTH.routes.filter((x) => !x.visible)) assert.ok(found.has(r.path), `hidden ${r.path}`);

    const ops = new Set(inv.operations.map((o) => `${o.kind}:${o.name}`));
    for (const [kind, names] of Object.entries(TRUTH.operations)) for (const n of names) assert.ok(ops.has(`${kind}:${n}`), `${kind} ${n}`);
    assert.equal(inv.operations.length, Object.values(TRUTH.operations).flat().length);

    const de = 'assets/de-c27f5a94.js';
    assert.ok(inv.labelSources.orders.includes(de) && inv.labelSources.admin.includes(de), 'German locale feeds the namespaces');
    assert.equal(inv.labels.orders['orders.title'], 'Orders', 'English wins over German');
    const deOnly = tmp('bundle-de');
    fs.copyFileSync(path.join(out, de), path.join(deOnly, 'de.js'));
    const deInv = path.join(deOnly, 'inv.json');
    assert.equal((await run(INVENTORY, ['build', deOnly, '--out', deInv])).status, 0);
    const g = JSON.parse(fs.readFileSync(deInv, 'utf8')).labels;
    assert.equal(g.orders['orders.title'], 'Bestellungen');
    assert.equal(g.payouts['payouts.request'], 'Auszahlung anfordern');
    assert.equal(g.orders['orders.count'], '{count, plural, one {# Bestellung} other {# Bestellungen}}');

    // the fake key in config.js is redacted
    const key = inv.config.find((c) => c.key === 'mapsApiKey');
    assert.equal(key && key.value, '[redacted]');
    assert.ok(!fs.readFileSync(invFile, 'utf8').includes('9fQ2xLr7Vb4KmZt8NwY3cHs6PdJ1gUe5Ao0RiTv'));
  } finally { await p.stop(); }
});

test('another host, and anything but .js, .mjs or .json, is refused without a request', async () => {
  const p = await startPortal();
  try {
    const out = tmp('bundle-host');
    const other = `http://localhost:${p.port}/assets/admin-8d41b6e0.js`;
    const r = await run(BUNDLE, ['fetch', '--origin', p.url, '--out', out, '--delay', '0', '--no-discover', other, '/app.css', '/assets/de-c27f5a94.js']);
    assert.equal(r.status, 0, r.stderr);
    const m = manifestOf(out);
    assert.deepEqual(m.files.map((f) => f.file), ['assets/de-c27f5a94.js']);
    assert.match(m.skipped.find((s) => s.url === other).reason, /another host/);
    assert.match(m.skipped.find((s) => s.url.endsWith('/app.css')).reason, /not \.js/);
    await settle();
    assert.deepEqual(p.entries().map((e) => e.path), ['/assets/de-c27f5a94.js']);
  } finally { await p.stop(); }
});

test('--forbid-assets: the downloader stops with exit 3 and does not retry', async () => {
  const p = await startPortal(['--forbid-assets']);
  try {
    const out = tmp('bundle-403');
    const r = await run(BUNDLE, ['fetch', '--origin', p.url, '--out', out, '--delay', '0', ENTRY, '/assets/de-c27f5a94.js']);
    assert.equal(r.status, 3, r.stderr + r.stdout);
    assert.match(r.stderr, /HTTP 403/);
    const m = manifestOf(out);
    assert.equal(m.stopped.status, 403);
    assert.equal(m.files.length, 0);
    await settle();
    assert.equal(p.entries().length, 1, 'one request, no retry, nothing after the stop');
  } finally { await p.stop(); }
});

test('an HTML page where a script should be (a challenge) stops with exit 3; --dry-run fetches nothing', async () => {
  let hits = 0;
  const srv = http.createServer((req, res) => { hits++; res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<!doctype html><title>Checking your browser</title>'); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${srv.address().port}`;
  try {
    const out = tmp('bundle-html');
    const r = await run(BUNDLE, ['fetch', '--origin', origin, '--out', out, '--delay', '0', '/assets/app-12345678.js']);
    assert.equal(r.status, 3);
    assert.match(manifestOf(out).stopped.reason, /HTML page/);
    assert.equal(hits, 1);

    const dry = await run(BUNDLE, ['fetch', '--origin', origin, '--out', tmp('bundle-dry'), '--dry-run', '/assets/app-12345678.js', '/x.css']);
    assert.equal(dry.status, 0);
    assert.match(dry.stdout, /would fetch {2}http:\/\/127\.0\.0\.1:\d+\/assets\/app-12345678\.js/);
    assert.match(dry.stdout, /would skip {3}.*x\.css/);
    assert.equal(hits, 1, 'the dry run sent nothing');
  } finally { srv.close(); }
});

test('usage errors exit 2, and --help prints the usage', async () => {
  assert.equal((await run(BUNDLE, ['fetch', '--out', tmp('bundle-usage'), ENTRY])).status, 2);
  const h = await run(BUNDLE, ['--help']);
  assert.equal(h.status, 0);
  assert.match(h.stdout, /platform-audit\/1\.0 \(public bundle reader\)/);
});
