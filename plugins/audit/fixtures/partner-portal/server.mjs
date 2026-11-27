#!/usr/bin/env node
// Partner Portal — the fake partner back office that platform-audit's tests, rehearsal and trial run
// against (platform-audit PLAN §2.7). Dependency-free Node ≥ 20. Every name, number and account in it
// is invented; it holds no real data.
//
//   node fixtures/partner-portal/server.mjs [--port 0] [--log <file.jsonl>] [--rate <n>/<seconds>] [--forbid-assets]
//
// It listens on 127.0.0.1 only, on port 0 by default, and prints
//   Partner Portal fixture on http://127.0.0.1:<port>
// See README.md for the demo account, the rate limit and the log format.

import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(HERE, 'public');
const TRUTH = JSON.parse(fs.readFileSync(path.join(HERE, 'truth.json'), 'utf8'));
const COOKIE = 'pp_session';
const DENIED = 'You do not have permission to view this page.';

const USAGE = `Usage: node server.mjs [--port 0] [--log <file.jsonl>] [--rate <n>/<seconds>] [--forbid-assets]

  --port <n>         port to listen on (default 0: any free port); always on 127.0.0.1
  --log <file>       append one JSON line per request: time, method, path, op, kind, status
  --rate <n>/<s>     data requests allowed per session per window (default 6/10); above it, 429
                     with Retry-After: 30
  --forbid-assets    answer 403 for everything under /assets/ (the downloader's refusal test)
`;

// ─────────────────────────────── the demo data (invented) ───────────────────────────────

const ME = {
  displayName: 'Dana Example', email: 'dana@example.com', partnerId: 'P-104233', referralCode: 'REF-7Q2X',
  role: 'ROLE_PARTNER', phone: '+44 20 7946 0000', company: 'Example Trading Ltd', notifyOrders: true,
};
const BALANCES = { available: 1284.5, pending: 312.0, currency: 'GBP' };
const STATUSES = ['PENDING', 'PAID', 'SHIPPED', 'REFUNDED', 'CANCELLED'];
const TIERS = ['BRONZE', 'SILVER', 'GOLD'];
const FIRST = ['Alex', 'Sam', 'Jo', 'Robin', 'Chris', 'Kim', 'Lee', 'Max', 'Pat', 'Ray', 'Toni', 'Val', 'Ash', 'Bo'];
const LAST = ['Archer', 'Baker', 'Carter', 'Dale', 'Ellis', 'Fox', 'Gray', 'Hill', 'Iver', 'Jones', 'Knox', 'Lane', 'Moss', 'North'];
const PRODUCTS = [['Starter kit', 24.0], ['Refill pack', 9.5], ['Travel case', 18.0], ['Gift card', 25.0], ['Display stand', 42.0]];

const CUSTOMERS = FIRST.map((f, i) => ({
  id: `C-${2001 + i}`, name: `${f} ${LAST[i]}`, email: `${f.toLowerCase()}.${LAST[i].toLowerCase()}@example.com`,
  tier: TIERS[i % 3], city: ['Leeds', 'Bristol', 'York', 'Bath'][i % 4],
}));

const day = (n) => new Date(Date.UTC(2026, 10, 26) - n * 86400000).toISOString().slice(0, 10);
const ORDERS = Array.from({ length: 37 }, (_, i) => {
  const items = [PRODUCTS[i % 5], PRODUCTS[(i * 3 + 1) % 5]].map(([product, unitPrice], k) => ({ product, quantity: 1 + ((i + k) % 3), unitPrice }));
  const amount = items.reduce((s, x) => s + x.quantity * x.unitPrice, 0);
  const customer = CUSTOMERS[(i * 5) % CUSTOMERS.length];
  return {
    id: `O-${10001 + i}`, number: `#${10001 + i}`, date: day(Math.floor(i * 1.7)), customerId: customer.id,
    customerName: customer.name, status: STATUSES[i % 5], items: items.reduce((s, x) => s + x.quantity, 0),
    amount: Math.round(amount * 100) / 100, lines: items,
  };
});
for (const c of CUSTOMERS) {
  const own = ORDERS.filter((o) => o.customerId === c.id);
  c.orders = own.length;
  c.lastOrder = own.length ? own.map((o) => o.date).sort().at(-1) : null;
}

function salesReport(period) {
  const size = period === 'DAILY' ? 1 : 7;
  const rows = [];
  for (let b = 0; b < (period === 'DAILY' ? 14 : 8); b++) {
    const lo = day(b * size + size - 1), hi = day(b * size);
    const inside = ORDERS.filter((o) => o.date >= lo && o.date <= hi && o.status !== 'CANCELLED');
    const revenue = Math.round(inside.reduce((s, o) => s + o.amount, 0) * 100) / 100;
    rows.push({ label: period === 'DAILY' ? hi : `${lo} – ${hi}`, orders: inside.length, revenue, average: inside.length ? Math.round((revenue / inside.length) * 100) / 100 : 0 });
  }
  return rows;
}

// ─────────────────────────────── GraphQL ───────────────────────────────

const forbidden = () => ({ errors: [{ message: DENIED, extensions: { code: 'FORBIDDEN' } }] });

function ordersQuery(v) {
  const f = v.filter || {};
  let rows = ORDERS.slice();
  if (f.status && f.status.length) rows = rows.filter((o) => f.status.includes(o.status));
  if (f.from) rows = rows.filter((o) => o.date >= f.from);
  if (f.to) rows = rows.filter((o) => o.date <= f.to);
  if (f.search) { const q = String(f.search).toLowerCase(); rows = rows.filter((o) => o.number.includes(q) || o.customerName.toLowerCase().includes(q)); }
  if (f.amountMin != null && f.amountMin !== '') rows = rows.filter((o) => o.amount >= Number(f.amountMin));
  if (f.amountMax != null && f.amountMax !== '') rows = rows.filter((o) => o.amount <= Number(f.amountMax));
  if (v.sort && v.sort.field) {
    const k = v.sort.field, dir = v.sort.direction === 'DESC' ? -1 : 1;
    rows.sort((a, b) => (a[k] > b[k] ? dir : a[k] < b[k] ? -dir : 0));
  } else rows.sort((a, b) => (a.date < b.date ? 1 : -1));
  const first = Math.min(Number(v.first) || 25, 50), offset = Math.max(Number(v.offset) || 0, 0);
  return { orders: { total: rows.length, nodes: rows.slice(offset, offset + first).map(({ lines, ...o }) => o) } };
}

const RESOLVERS = {
  Shell: () => ({ me: ME, balances: BALANCES }),
  Orders: ordersQuery,
  OrderDetails: (v) => {
    const o = ORDERS.find((x) => x.id === v.id);
    return { order: o ? { ...o, timeline: [{ at: o.date, event: 'Order placed' }, { at: o.date, event: `Status: ${o.status}` }] } : null };
  },
  Payouts: () => ({ payouts: [] }),
  Customers: (v) => {
    let rows = CUSTOMERS.slice();
    if (v.search) { const q = String(v.search).toLowerCase(); rows = rows.filter((c) => c.name.toLowerCase().includes(q) || c.email.includes(q)); }
    if (v.tier) rows = rows.filter((c) => c.tier === v.tier);
    return { customers: rows };
  },
  CustomerDetails: (v) => {
    const c = CUSTOMERS.find((x) => x.id === v.id);
    return { customer: c ? { ...c, recentOrders: ORDERS.filter((o) => o.customerId === c.id).slice(0, 5).map(({ lines, ...o }) => o) } : null };
  },
  SalesReport: (v) => ({ salesReport: salesReport(v.period === 'DAILY' ? 'DAILY' : 'WEEKLY') }),
  Profile: () => ({ profile: ME }),
  RequestPayout: (v) => {
    const a = Number(v.input && v.input.amount);
    if (!(a >= 50 && a <= 5000)) return { errors: [{ message: 'Amount must be between 50 and 5000.', extensions: { code: 'BAD_USER_INPUT' } }] };
    return { requestPayout: { ok: true, id: 'PO-TEST', status: 'PENDING' } };
  },
  SendVoucher: (v) => ({ sendVoucher: { ok: true, sent: (v.input && v.input.customerIds || []).length } }),
  ImportCustomers: (v) => ({ importCustomers: { ok: true, uploadId: v.uploadId || null, imported: 0 } }),
  UpdateProfile: () => ({ updateProfile: { ok: true } }),
  // role-gated: the demo role is a partner, so these always refuse
  FinanceReport: forbidden, AdminUsers: forbidden, AuditLog: forbidden, AdminSettings: forbidden,
  UpdateUserRole: forbidden, UpdateAdminSettings: forbidden,
};

/** The first operation in a document: { kind, name }, ignoring fragment definitions. */
function parseOperation(doc) {
  const m = /(?:^|[\s}])(query|mutation|subscription)\s+([A-Za-z_]\w*)/.exec(String(doc || ''));
  return m ? { kind: m[1], name: m[2] } : { kind: 'query', name: null };
}

// ─────────────────────────────── HTTP plumbing ───────────────────────────────

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json' };

function parseArgs(argv) {
  const a = { port: 0, log: null, rate: { n: 6, seconds: 10 }, forbidAssets: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--port') a.port = Number(argv[++i]);
    else if (k === '--log') a.log = argv[++i];
    else if (k === '--rate') {
      const m = /^(\d+)\/(\d+(?:\.\d+)?)$/.exec(argv[++i] || '');
      if (!m) throw new Error('--rate takes <n>/<seconds>, such as 6/10');
      a.rate = { n: Number(m[1]), seconds: Number(m[2]) };
    } else if (k === '--forbid-assets') a.forbidAssets = true;
    else if (k === '--help' || k === '-h') a.help = true;
    else throw new Error(`unknown argument ${k}`);
  }
  if (!Number.isInteger(a.port) || a.port < 0) throw new Error('--port takes a number');
  return a;
}

function compileRoutes() {
  return TRUTH.routes.filter((r) => r.path !== '/login').map((r) => ({
    ...r, re: new RegExp('^' + r.path.replace(/:[\w]+/g, '[^/]+') + '/?$'),
  }));
}

function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > limit) { reject(Object.assign(new Error('too large'), { status: 413 })); req.resume(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** The first file part of a multipart body: { name, bytes, text }. */
function firstFile(buf, contentType) {
  const b = /boundary=(?:"([^"]+)"|([^;]+))/.exec(contentType || '');
  if (!b) return null;
  const s = buf.toString('latin1'), sep = '--' + (b[1] || b[2]);
  for (const part of s.split(sep)) {
    const head = part.indexOf('\r\n\r\n');
    if (head < 0) continue;
    const fn = /filename="([^"]*)"/.exec(part.slice(0, head));
    if (!fn) continue;
    const body = part.slice(head + 4).replace(/\r\n$/, '');
    return { name: fn[1], bytes: Buffer.byteLength(body, 'latin1'), text: body };
  }
  return null;
}

function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} · Partner Portal</title><link rel="stylesheet" href="/app.css"></head><body class="plain">${body}</body></html>`;
}

const LOGIN_PAGE = page('Sign in', `<main class="login" role="main"><h1>Partner Portal</h1><p>This is a test system. The demo partner needs no password.</p><form method="post" action="/login"><input type="hidden" name="next" value="__NEXT__"><button type="submit" class="primary">Sign in as demo partner</button></form></main>`);
const NOT_FOUND = page('Page not found', '<main role="main"><h1>Page not found</h1><p><a href="/orders">Go to Orders</a></p></main>');

export function createPortal(opts = {}) {
  const rate = opts.rate || { n: 6, seconds: 10 };
  const routes = compileRoutes();
  const sessions = new Map(); // id → { hits: [ms] }
  const shellHtml = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
  const logFd = opts.log ? fs.openSync(opts.log, 'a') : null;

  return http.createServer(async (req, res) => {
    const time = new Date().toISOString();
    const url = new URL(req.url, 'http://127.0.0.1');
    const p = url.pathname;
    const entry = { time, method: req.method, path: p, op: null, kind: 'page', status: 0 };
    res.on('finish', () => {
      entry.status = res.statusCode;
      if (logFd !== null) fs.writeSync(logFd, JSON.stringify(entry) + '\n');
    });
    const send = (status, type, body, headers = {}) => {
      res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...headers });
      res.end(body);
    };
    const json = (status, obj, headers) => send(status, 'application/json', JSON.stringify(obj), headers);
    const sid = cookies(req)[COOKIE];
    const session = sid && sessions.get(sid);

    try {
      // ── public: assets, the stylesheet, runtime config, sign-in ──
      if (p.startsWith('/assets/') || p === '/app.css' || p === '/config.js' || p === '/favicon.ico') {
        entry.kind = 'asset';
        if (p.startsWith('/assets/') && opts.forbidAssets) return send(403, 'text/plain', 'Forbidden');
        if (p === '/favicon.ico') return send(204, 'image/x-icon', '');
        const file = path.join(PUBLIC, path.normalize(p).replace(/^([/\\])+/, ''));
        if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(404, 'text/plain', 'Not found');
        return send(200, TYPES[path.extname(file)] || 'application/octet-stream', fs.readFileSync(file));
      }
      if (p === '/login') {
        if (req.method === 'POST') {
          const form = new URLSearchParams((await readBody(req, 4096)).toString('utf8'));
          const id = crypto.randomBytes(18).toString('base64url');
          sessions.set(id, { hits: [] });
          const next = form.get('next') || '';
          const to = next.startsWith('/') && !next.startsWith('//') && routes.some((r) => r.re.test(next.split('?')[0])) ? next : '/orders';
          return send(303, 'text/plain', '', { Location: to, 'Set-Cookie': `${COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax` });
        }
        const next = url.searchParams.get('next') || '';
        return send(200, TYPES['.html'], LOGIN_PAGE.replace('__NEXT__', next.replace(/[^\w/:\-?=&.]/g, '')));
      }
      if (p === '/logout') {
        if (sid) sessions.delete(sid);
        return send(303, 'text/plain', '', { Location: '/login', 'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` });
      }

      // ── the API: signed in, rate-limited per session ──
      if (p.startsWith('/api/')) {
        let body = null;
        if (p === '/api/graphql') {
          entry.kind = 'query';
          if (req.method !== 'POST') return json(405, { error: 'Use POST' });
          body = JSON.parse((await readBody(req, 1 << 20)).toString('utf8') || '{}');
          const op = parseOperation(body.query);
          entry.op = body.operationName || op.name;
          entry.kind = op.kind === 'mutation' ? 'mutation' : 'query';
        } else if (p === '/api/upload') entry.kind = 'upload';
        else if (p.startsWith('/api/export/')) entry.kind = 'download';
        if (!session) return json(401, { error: 'Sign in first.' });
        const now = Date.now(), win = rate.seconds * 1000;
        session.hits = session.hits.filter((t) => now - t < win);
        if (session.hits.length >= rate.n) return json(429, { error: 'Too many requests. Try again in 30 seconds.' }, { 'Retry-After': '30' });
        session.hits.push(now);

        if (p === '/api/graphql') {
          const fn = RESOLVERS[entry.op];
          if (!fn) return json(400, { errors: [{ message: `Unknown operation ${entry.op}` }] });
          const out = fn(body.variables || {});
          return json(200, out.errors ? out : { data: out });
        }
        if (p === '/api/export/orders.csv' && req.method === 'GET') {
          const rows = ordersQuery({ first: 50, filter: { status: url.searchParams.getAll('status'), search: url.searchParams.get('search') } }).orders.nodes;
          const csv = ['Order,Date,Customer,Status,Items,Amount', ...rows.map((o) => [o.number, o.date, o.customerName, o.status, o.items, o.amount.toFixed(2)].join(','))].join('\n') + '\n';
          return send(200, 'text/csv; charset=utf-8', csv, { 'Content-Disposition': 'attachment; filename="orders.csv"' });
        }
        if (p === '/api/export/customers-template.csv' && req.method === 'GET') {
          return send(200, 'text/csv; charset=utf-8', 'Name,Email,Tier\n', { 'Content-Disposition': 'attachment; filename="customers-template.csv"' });
        }
        if (p === '/api/upload' && req.method === 'POST') {
          const buf = await readBody(req, 2 * 1024 * 1024 + 64 * 1024);
          const f = firstFile(buf, req.headers['content-type']);
          if (!f) return json(400, { error: 'Send one file as multipart/form-data.' });
          if (!/\.(csv|xlsx)$/i.test(f.name)) return json(415, { error: 'Only CSV or XLSX files.' });
          if (f.bytes > 2 * 1024 * 1024) return json(413, { error: 'The file is larger than 2 MB.' });
          const rows = /\.csv$/i.test(f.name) ? Math.max(f.text.split(/\r?\n/).filter(Boolean).length - 1, 0) : null;
          return json(200, { uploadId: 'U-' + crypto.randomBytes(4).toString('hex'), fileName: f.name, bytes: f.bytes, rows, columns: /\.csv$/i.test(f.name) ? f.text.split(/\r?\n/)[0].split(',').filter(Boolean) : [] });
        }
        return json(404, { error: 'Not found' });
      }

      // ── pages: the single-page app, signed in ──
      if (p === '/') return send(302, 'text/plain', '', { Location: session ? '/orders' : '/login' });
      const route = routes.find((r) => r.re.test(p));
      if (!route) return send(404, TYPES['.html'], NOT_FOUND);
      if (!session) return send(302, 'text/plain', '', { Location: '/login?next=' + encodeURIComponent(p) });
      // A role-gated route answers like an SPA does (200), with the permission screen already in place.
      const pre = route.visible ? '' : `<section class="denied" role="alert"><h1>Access denied</h1><p>${DENIED}</p></section>`;
      return send(200, TYPES['.html'], shellHtml.replace('<!--prerender-->', pre));
    } catch (e) {
      if (res.headersSent) return res.destroy();
      if (e.status === 413) return json(413, { error: 'Request too large.' });
      if (e instanceof SyntaxError) return json(400, { error: 'Bad JSON.' });
      return json(500, { error: 'Server error.' });
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let a;
  try { a = parseArgs(process.argv.slice(2)); } catch (e) { process.stderr.write(`${e.message}\n\n${USAGE}`); process.exit(2); }
  if (a.help) { process.stdout.write(USAGE); process.exit(0); }
  const server = createPortal(a);
  server.listen(a.port, '127.0.0.1', () => {
    console.log(`Partner Portal fixture on http://127.0.0.1:${server.address().port}`);
  });
  const stop = () => { server.close(() => process.exit(0)); server.closeAllConnections(); };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
