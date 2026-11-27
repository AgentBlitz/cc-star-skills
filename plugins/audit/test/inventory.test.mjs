// Tests for the bundle reader: inventory-core.js and the inventory.mjs CLI (platform-audit S2).
// Every bundle under test/bundles/ is synthetic, written by hand, and read as text only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS = path.resolve(HERE, '..', 'skills', 'platform-audit', 'scripts');
const CLI = path.join(SCRIPTS, 'inventory.mjs');
const CORE = path.join(SCRIPTS, 'inventory-core.js');
const BUNDLES = path.join(HERE, 'bundles');
const OUT = path.join(HERE, '.out', 'inventory');
const STYLES = ['vite-react', 'formatjs-compiled', 'webpack-i18next', 'vue', 'angular', 'next', 'gql-ast', 'noise'];

fs.mkdirSync(OUT, { recursive: true });
const run = (...args) => spawnSync('node', [CLI, ...args], { encoding: 'utf8' });
const tmp = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), `audit-inv-${prefix}-`));

function build(dir, name) {
  const out = path.join(OUT, `${name}.json`);
  const r = run('build', dir, '--out', out);
  assert.equal(r.status, 0, r.stderr);
  return { inv: JSON.parse(fs.readFileSync(out, 'utf8')), out, stdout: r.stdout };
}

/** A style's bundle, copied without its expected.json (which build would read as a JSON file). */
function styleDir(style) {
  const dir = path.join(OUT, 'src', style);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.cpSync(path.join(BUNDLES, style), dir, { recursive: true, filter: (f) => path.basename(f) !== 'expected.json' });
  return dir;
}

const expected = (style) => JSON.parse(fs.readFileSync(path.join(BUNDLES, style, 'expected.json'), 'utf8'));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const labelCount = (inv) => Object.values(inv.labels).reduce((n, ns) => n + Object.keys(ns).length, 0);
const unkeyedAll = (inv) => Object.values(inv.unkeyed).flat();

/** Everything expected.json asks for that the inventory lacks, as readable lines. */
function misses(inv, exp, { counts = true } = {}) {
  const out = [];
  const miss = (m) => out.push(m);
  for (const f of exp.frameworks || []) if (!inv.frameworks[f]) miss(`framework ${f}`);
  for (const f of exp.absentFrameworks || []) if (inv.frameworks[f]) miss(`framework ${f} should be absent`);
  for (const r of exp.routes || []) {
    const got = inv.routes.find((x) => x.path === r.path);
    if (!got) { miss(`route ${r.path}`); continue; }
    for (const k of r.kinds || []) if (!got.kinds.includes(k)) miss(`route ${r.path}: kind ${k} (has ${got.kinds})`);
    for (const k of r.keys || []) if (!got.keys.includes(k)) miss(`route ${r.path}: key ${k} (has ${got.keys})`);
    if (r.keys && !r.keys.length && got.keys.length) miss(`route ${r.path}: no keys expected (has ${got.keys})`);
  }
  for (const [ns, ids] of Object.entries(exp.labels || {})) {
    for (const [id, text] of Object.entries(ids)) {
      const got = inv.labels[ns] && inv.labels[ns][id];
      if (got !== text) miss(`label ${ns} › ${id} = ${JSON.stringify(text)} (got ${JSON.stringify(got)})`);
    }
  }
  const unkeyed = unkeyedAll(inv);
  for (const t of exp.unkeyed || []) if (!unkeyed.includes(t)) miss(`unkeyed text ${JSON.stringify(t)}`);
  for (const t of exp.absentUnkeyed || []) if (unkeyed.includes(t)) miss(`unkeyed text ${JSON.stringify(t)} should be absent`);
  for (const id of exp.idsWithoutText || []) if (!inv.idsWithoutText.includes(id)) miss(`id without text ${id}`);
  for (const set of exp.columns || []) if (!inv.columns.some((c) => eq(c.set, set))) miss(`column set ${set.map((s) => s.field).join(',')}`);
  for (const o of exp.operations || []) {
    const got = inv.operations.find((x) => x.kind === o.kind && x.name === o.name);
    if (!got) { miss(`operation ${o.kind} ${o.name}`); continue; }
    for (const k of Object.keys(o)) if (!eq(got[k], o[k])) miss(`operation ${o.name}: ${k} = ${JSON.stringify(o[k])} (got ${JSON.stringify(got[k])})`);
  }
  for (const e of exp.endpoints || []) if (!inv.endpoints.some((x) => x.method === e.method && x.path === e.path)) miss(`endpoint ${e.method} ${e.path}`);
  for (const [k, list] of Object.entries(exp.hosts || {})) for (const h of list) if (!inv.hosts[k].includes(h)) miss(`${k} host ${h}`);
  const a = exp.access || {};
  for (const c of a.constants || []) if (!inv.access.constants.includes(c)) miss(`access constant ${c}`);
  for (const r of a.rules || []) if (!inv.access.rules.some((x) => x.name === r.name && eq(x.roles, r.roles))) miss(`access rule ${r.name}: ${r.roles}`);
  for (const d of a.deniedMessages || []) if (!inv.access.deniedMessages.includes(d)) miss(`denied message ${d}`);
  for (const e of exp.enums || []) if (!inv.enums.some((x) => x.name === e.name && eq(x.members, e.members))) miss(`enum ${e.name}: ${e.members}`);
  for (const l of exp.limits || []) if (!inv.limits.some((x) => x.name === l.name && x.value === l.value && (l.raw === undefined || x.raw === l.raw))) miss(`limit ${l.name} = ${l.value}`);
  for (const c of exp.config || []) if (!inv.config.some((x) => x.key === c.key && x.value === c.value)) miss(`config ${c.key} = ${c.value}`);
  for (const u of exp.sourceMaps || []) if (!inv.sourceMaps.some((x) => x.url === u)) miss(`source map ${u}`);
  for (const u of exp.chunks || []) if (!inv.chunks.some((x) => x.ref === u)) miss(`chunk ${u}`);
  for (const u of exp.absentChunks || []) if (inv.chunks.some((x) => x.ref === u)) miss(`chunk ${u} should be absent`);
  const text = JSON.stringify(inv);
  for (const t of exp.absentText || []) if (text.includes(t)) miss(`text ${t.slice(0, 6)}… should not appear anywhere`);
  if (counts) {
    for (const [k, n] of Object.entries(exp.counts || {})) {
      const got = k === 'labels' ? labelCount(inv) : k === 'unkeyed' ? unkeyed.length
        : k === 'hosts' ? inv.hosts.api.length + inv.hosts.auth.length + inv.hosts.ws.length : inv[k].length;
      if (got !== n) miss(`${k}: ${n} expected, got ${got}`);
    }
  }
  return out;
}

for (const style of STYLES) {
  test(`${style}: every expected item is found`, () => {
    const { inv } = build(styleDir(style), style);
    assert.deepEqual(misses(inv, expected(style)), []);
    assert.equal(inv.version, 1);
    assert.equal(inv.errors, undefined);
  });
}

test('noise yields no routes and no labels', () => {
  const { inv } = build(styleDir('noise'), 'noise');
  assert.deepEqual(inv.routes, []);
  assert.deepEqual(inv.labels, {});
  assert.deepEqual(inv.unkeyed, {});
});

test('every bundle file stays within about 200 lines', () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  for (const f of walk(BUNDLES).filter((f) => f.endsWith('.js'))) {
    assert.ok(fs.readFileSync(f, 'utf8').split('\n').length <= 210, path.relative(BUNDLES, f));
  }
});

test('build over a folder holding two styles merges them', () => {
  const dir = tmp('merge');
  fs.cpSync(path.join(BUNDLES, 'vite-react'), path.join(dir, 'a'), { recursive: true });
  fs.cpSync(path.join(BUNDLES, 'vue'), path.join(dir, 'b'), { recursive: true });
  for (const f of ['a/expected.json', 'b/expected.json']) fs.rmSync(path.join(dir, f));
  const { inv } = build(dir, 'merged');
  assert.deepEqual(misses(inv, expected('vite-react'), { counts: false }), []);
  assert.deepEqual(misses(inv, expected('vue'), { counts: false }), []);
  const paths = new Set([...expected('vite-react').routes, ...expected('vue').routes].map((r) => r.path));
  assert.equal(inv.routes.length, paths.size);
  assert.deepEqual(inv.routes.find((r) => r.path === '/orders').files, ['a/index-a1b2c3d4.js', 'b/index-7c6b5a4d.js']);
  assert.deepEqual(inv.labelSources.orders.sort(), ['a/index-a1b2c3d4.js', 'b/index-7c6b5a4d.js']);
  // the descriptor's English text wins over the vue-i18n one for the same id; the rest merge in
  assert.equal(inv.labels.orders['orders.title'], 'Orders');
  assert.equal(inv.labels.common['common.save'], 'Save');
  fs.rmSync(dir, { recursive: true });
});

test('build reads .json resources, skips manifest.json, and records sizes and hashes', () => {
  const dir = tmp('json');
  fs.mkdirSync(path.join(dir, 'locales'));
  const en = JSON.stringify({ shell: { menu: 'Menu', logout: 'Log out', language: 'Language' }, orders: { title: 'Orders' } });
  fs.writeFileSync(path.join(dir, 'locales', 'en.json'), en);
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ secret: { a: 'Must not be read', b: 'Nor this one', c: 'Or this' } }));
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'navigate("/never-read")');
  const { inv } = build(dir, 'json');
  assert.deepEqual(inv.files.map((f) => f.name), ['locales/en.json']);
  assert.equal(inv.files[0].bytes, Buffer.byteLength(en));
  assert.equal(inv.files[0].sha256, crypto.createHash('sha256').update(en).digest('hex'));
  assert.equal(inv.labels.shell['shell.logout'], 'Log out');
  assert.equal(inv.labels.orders['orders.title'], 'Orders');
  assert.ok(!JSON.stringify(inv).includes('Must not be read'));
  fs.rmSync(dir, { recursive: true });
});

test('a long random value is redacted, and ordinary long text is not', () => {
  const { inv } = build(styleDir('vite-react'), 'vite-react');
  assert.equal(inv.config.find((c) => c.key === 'mapsKey').value, '[redacted]');
  const core = loadCore();
  const fake = ['sk', 'live', '51Hx9QpLm2Zr8TvW4yNc7KbD3fGh'].join('_');
  assert.equal(core.redactText(`key ${fake} end`), 'key [redacted] end');
  assert.equal(core.redactText('a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f9'), '[redacted]');
  for (const keep of ['orders.list.filters.status.placeholder', 'REACT_APP_FEATURE_FLAGS_ENABLED_2', 'No customers match these filters', 'static/js/214.8a7b6c5d.chunk.js', 'abcdefghijklmnopqrstuvwxyz']) {
    assert.equal(core.redactText(keep), keep);
  }
});

test('every subcommand prints what it should', () => {
  const { out, stdout } = build(styleDir('vite-react'), 'vite-react');
  assert.match(stdout, /inventory written to .*vite-react\.json/);
  assert.match(stdout, /routes 8/);
  const ok = (...args) => { const r = run(...args); assert.equal(r.status, 0, `${args.join(' ')}: ${r.stderr}`); return r.stdout; };
  assert.match(ok('summary', out), /^files 1 \(\d+ bytes\)\nframeworks apollo, data-grid, formatjs, mui, react, react-router\nroutes 8\nlabels 5 in 2 namespaces/);
  assert.match(ok('routes', out), /^routes \(8\)\n\/  \[path-prop, route-map\]  keys: home/);
  assert.match(ok('routes', out), /\/settings\/profile  \[path-prop\]  — index-a1b2c3d4\.js/);
  const list = ok('labels', out, 'list');
  assert.match(list, /^namespaces \(2\)\norders \(4\)\npayouts \(1\)\n/);
  assert.match(list, /unkeyed text, by file \(1\)\nindex-a1b2c3d4\.js \(\d+\)/);
  assert.match(ok('labels', out, 'show', 'orders'), /^## orders \(4\)\nAmount\n/);
  assert.match(ok('labels', out, 'show', 'ord*,pay*', '--ids'), /orders\.title = Orders[\s\S]*## payouts \(1\)\npayouts\.request = Request payout/);
  assert.match(ok('labels', out, 'show', 'missing'), /## missing: \(none\)/);
  assert.match(ok('labels', out, 'grep', 'payout'), /payouts\.request = Request payout/);
  assert.match(ok('labels', out, 'grep', 'dashboard'), /\(index-a1b2c3d4\.js\) Partner dashboard/);
  assert.match(ok('labels', out, 'grep', 'zzzz'), /\(no match\)/);
  const ctx = ok('context', styleDir('vite-react'), 'maxPageSize', '--chars', '60', '--max', '1');
  assert.match(ctx, /── index-a1b2c3d4\.js:\d+\n.*maxPageSize:ad/);
  assert.match(ctx, /1 occurrence/);
  assert.match(ok('context', styleDir('vite-react'), 'mapsKey'), /\[redacted\]/);
  assert.match(ok('context', styleDir('vite-react'), 'not-in-the-code'), /no occurrence/);
  const ops = ok('ops', out);
  assert.match(ops, /query ListOrders\(\$first: Int!, \$after: String, \$status: \[OrderStatus!\]\) \{ orders viewer \}  \[document\]/);
  assert.match(ops, /POST \/graphql  \[endpoint\]/);
  const md = path.join(OUT, 'api-operations.md');
  assert.match(ok('ops', out, '--md', md), /4 operations and 1 endpoints written to/);
  const mdText = fs.readFileSync(md, 'utf8');
  assert.match(mdText, /^# Server operations/);
  assert.match(mdText, /## Query \(1\)\n\n### ListOrders\n\n- Variables: `\$first: Int!`/);
  assert.match(mdText, /\| POST \| `\/graphql` \|/);
  assert.match(ok('columns', out), /set 1 \(index-a1b2c3d4\.js\): id=Order \| status=Status \| amount=Amount \| createdAt=Created/);
  assert.match(ok('limits', out), /MAX_UPLOAD_SIZE = 5242880 \(5\*1024\*1024\)/);
  assert.match(ok('enums', out), /OrderStatus: PENDING, PAID, REFUNDED, CANCELLED/);
  const access = ok('access', out);
  assert.match(access, /constants \(6\): ADMIN, MANAGER, PARTNER, ROLE_ADMIN/);
  assert.match(access, /  finance: MANAGER, ADMIN  — rules — /);
  assert.match(access, /denied messages \(1\)\n  You do not have permission to view this page\./);
});

test('--help prints the usage, and usage errors exit 2', () => {
  const help = run('--help');
  assert.equal(help.status, 0);
  for (const cmd of ['build', 'summary', 'routes', 'labels', 'context', 'ops', 'columns', 'limits', 'enums', 'access']) assert.match(help.stdout, new RegExp(`^  ${cmd} `, 'm'));
  assert.equal(run().status, 2);
  assert.equal(run('nonsense').status, 2);
  assert.equal(run('build', path.join(BUNDLES, 'noise')).status, 2);
  assert.equal(run('build', '/nonexistent/dir', '--out', path.join(OUT, 'x.json')).status, 2);
  assert.equal(run('labels', path.join(OUT, 'vite-react.json'), 'bogus').status, 2);
  assert.equal(run('summary', '/nonexistent.json').status, 2);
  assert.match(run('nonsense').stderr, /unknown command: nonsense/);
});

function loadCore(context) {
  const ctx = context || {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(CORE, 'utf8'), ctx, { filename: 'inventory-core.js' });
  return ctx.AuditInventory;
}

test('inventory-core.js is a classic script that runs with no Node APIs (the in-page fallback)', () => {
  const src = fs.readFileSync(CORE, 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const [what, re] of [['import', /^\s*import\b/m], ['export', /^\s*export\b/m], ['eval', /\beval\s*\(/], ['Function', /\bFunction\s*\(/],
    ['require', /\brequire\s*\(/], ['process', /\bprocess\./], ['Buffer', /\bBuffer\b/]]) {
    assert.doesNotMatch(code, re, `inventory-core.js must not use ${what}`);
  }
  // a bare context has only the language built-ins, as a page would after the paste
  const core = loadCore({});
  assert.equal(typeof core.build, 'function');
  const files = fs.readdirSync(path.join(BUNDLES, 'vite-react')).filter((f) => f.endsWith('.js'))
    .map((name) => ({ name, text: fs.readFileSync(path.join(BUNDLES, 'vite-react', name), 'utf8') }));
  const inv = JSON.parse(JSON.stringify(core.build(files, { now: '2026-01-01T00:00:00.000Z' })));
  assert.equal(inv.generated, '2026-01-01T00:00:00.000Z');
  assert.deepEqual(misses(inv, expected('vite-react')), []);
});

test('the scanner steps over strings, templates, regex literals and comments', () => {
  const core = loadCore();
  const src = 'a = "x{" + `t${ {b: "}"} }u` + /re{"/g; // c {\n/* d } */ e = {f: 1}';
  const { clean, quoted, templates } = core.scan(src);
  assert.equal(clean.length, src.length);
  assert.doesNotMatch(clean, /\/\/ c|d \}|re\{/);
  assert.equal(quoted.length, 2);
  assert.equal(templates.length, 1);
  const v = JSON.parse(JSON.stringify(core.readLiteral('{a:1,"b":[!0,!1,null,"s",`t`],c:x.y,d:f(1),e:{g:-2.5e1},h,...r,i(){return 1},j:0x1f}', 0).value));
  assert.deepEqual(v, { a: 1, b: [true, false, null, 's', 't'], c: { $ref: 'x.y' }, d: { $expr: 'f(1)' }, e: { g: -25 }, h: { $ref: 'h' }, i: { $expr: 'method' }, j: 31 });
  assert.equal(core.evalArith('5*1024*1024'), 5242880);
  assert.equal(core.evalArith('(2+3)*1e3'), 5000);
  assert.ok(Number.isNaN(core.evalArith('a*2')));
});
