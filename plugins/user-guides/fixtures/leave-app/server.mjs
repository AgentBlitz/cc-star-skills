#!/usr/bin/env node
// Leave Planner: a small, server-rendered leave-request app used as the user-guides plugin's
// test fixture. Dependency-free Node >= 20.
//
//   node server.mjs [--variant v1|v2] [--port 0] [--host 127.0.0.1]
//
// It listens on port 0 by default and prints its URL. See README.md for the screens, the roles
// and the v2 change table.

import http from 'node:http';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import * as lib from './lib.mjs';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmt = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};
const range = (r) => (r.from === r.to ? fmt(r.from) : `${fmt(r.from)} – ${fmt(r.to)}`);
const initials = (name) => name.split(' ').map((w) => w[0]).join('');
const ROLE_LABEL = { employee: 'Employee', manager: 'Manager', admin: 'Admin' };

const CSS = `
*{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1f2933;background:#f4f5f7}
header.top{position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:24px;padding:12px 24px;background:#1e3a5f;color:#fff;box-shadow:0 2px 6px rgba(0,0,0,.2)}
header.top .brand{font-weight:700;font-size:18px}header.top nav a{color:#dbe7f5;text-decoration:none;margin-right:16px}
header.top nav a[aria-current=page]{color:#fff;border-bottom:2px solid #fbbf24}
header.top .me{margin-left:auto;display:flex;gap:12px;align-items:center}header.top .me form{margin:0}
main{max-width:1040px;margin:24px auto;padding:0 24px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}
.card{background:#fff;border-radius:10px;padding:16px 20px;box-shadow:0 1px 3px rgba(0,0,0,.12)}
.card h2{font-size:15px;margin:0 0 8px;color:#52606d;text-transform:uppercase;letter-spacing:.04em}
.big{font-size:32px;font-weight:700}
.toolbar{display:flex;align-items:center;gap:12px;margin-bottom:16px}.toolbar h1{margin:0 auto 0 0}
button,.button{font:inherit;padding:8px 14px;border-radius:6px;border:1px solid #1e3a5f;background:#1e3a5f;color:#fff;cursor:pointer}
button.secondary{background:#fff;color:#1e3a5f}
table{width:100%;border-collapse:collapse;background:#fff}th,td{text-align:left;padding:10px;border-bottom:1px solid #e4e7eb}
.status{padding:2px 8px;border-radius:10px;font-size:13px}.status.pending{background:#fef3c7}.status.approved{background:#d1fae5}.status.declined{background:#fee2e2}
dialog{border:none;border-radius:12px;padding:24px;width:min(480px,90vw);box-shadow:0 10px 40px rgba(0,0,0,.35)}
dialog::backdrop{background:rgba(15,23,42,.55)}
label{display:block;margin:12px 0 4px;font-weight:600}input,select,textarea{font:inherit;width:100%;padding:8px;border:1px solid #9aa5b1;border-radius:6px}
.check label{display:flex;gap:8px;font-weight:400}.check input{width:auto}
.notice{background:#e0f2fe;border-left:4px solid #0284c7;padding:10px 14px;margin-bottom:16px}
.avatar{display:inline-flex;width:40px;height:40px;border-radius:50%;background:#cbd2d9;align-items:center;justify-content:center;font-weight:700;margin-right:10px}
.person{display:flex;align-items:center}.empty{color:#616e7c;font-style:italic}
section.panel{background:#fff;border-radius:10px;padding:16px 20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,.12)}
`;

const DIALOG_JS = `
document.addEventListener('DOMContentLoaded',()=>{const d=document.getElementById('new-request');if(!d)return;
if(d.hasAttribute('open')){d.close();d.showModal();}
const b=document.getElementById('open-new-request');if(b)b.closest('form').addEventListener('submit',e=>{e.preventDefault();d.showModal();});
d.querySelectorAll('[data-close]').forEach(c=>c.addEventListener('click',e=>{e.preventDefault();d.close();history.replaceState(null,'','/requests');}));});
`;

function page({ title, user, current, body, variant }) {
  const nav = [['/home', 'Home'], ['/requests', 'Requests']];
  if (user && user.role === 'manager') nav.push(['/inbox', 'Inbox']);
  nav.push(['/people', 'People'], ['/settings', 'Settings']);
  if (user && user.role === 'admin') nav.push(['/admin', 'Admin']);
  const header = user
    ? `<header class="top"><span class="brand">Leave Planner</span>
<nav aria-label="Main">${nav.map(([href, label]) => `<a href="${href}"${href === current ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
<div class="me"><span>${esc(user.name)} · ${ROLE_LABEL[user.role]}</span><form method="post" action="/sign-out"><button class="secondary" type="submit">Sign out</button></form></div></header>`
    : `<header class="top"><span class="brand">Leave Planner</span></header>`;
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>${esc(title)} · Leave Planner</title>
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="leave-app-variant" content="${variant}"><style>${CSS}</style><script>${DIALOG_JS}</script></head>
<body>${header}<main id="main">${body}</main></body></html>`;
}

const statusChip = (s) => `<span class="status ${s}">${s[0].toUpperCase() + s.slice(1)}</span>`;
const nameOf = (state, u) => (state.people.find((p) => p.username === u) || { name: u }).name;

// ---------------------------------------------------------------------------------------
// Screens

function home(state, user) {
  const me = state.people.find((p) => p.username === user.username);
  const left = state.policy.allowance - me.used;
  const mine = state.requests.filter((r) => r.who === user.username && r.status !== 'declined' && r.to >= lib.today()).sort((a, b) => a.from.localeCompare(b.from));
  const out = state.requests.filter((r) => r.status === 'approved' && r.from <= lib.today() && r.to >= lib.today());
  const cards = [
    `<section class="card" aria-labelledby="c-balance"><h2 id="c-balance">Your balance</h2><div class="big">${left} days</div><p>Annual leave left of ${state.policy.allowance} this year.</p></section>`,
    `<section class="card" aria-labelledby="c-next"><h2 id="c-next">Next time off</h2>${mine.length ? `<p><strong>${range(mine[0])}</strong></p><p>${esc(mine[0].type)} ${statusChip(mine[0].status)}</p>` : '<p class="empty">Nothing booked yet.</p>'}</section>`,
    `<section class="card" aria-labelledby="c-out"><h2 id="c-out">Who's out today</h2>${out.length ? `<ul>${out.map((r) => `<li>${esc(nameOf(state, r.who))}</li>`).join('')}</ul>` : '<p class="empty">Everyone is in.</p>'}</section>`,
  ];
  if (user.role === 'manager') {
    const waiting = teamPending(state, user).length;
    cards.push(`<section class="card" aria-labelledby="c-wait"><h2 id="c-wait">Waiting for you</h2><div class="big">${waiting}</div><p><a href="/inbox">Open your inbox</a></p></section>`);
  }
  if (user.role === 'admin') {
    cards.push(`<section class="card" aria-labelledby="c-policy"><h2 id="c-policy">Leave policy</h2><p>${state.policy.allowance} days a year; carry over up to ${state.policy.carryOver}.</p><p><a href="/admin">Change the policy</a></p></section>`);
  }
  return `<h1>Hello, ${esc(user.name.split(' ')[0])}</h1><p>Today is ${fmt(lib.today())}.</p><div class="cards">${cards.join('')}</div>`;
}

function requestsScreen(state, user, q, variant) {
  const mine = state.requests.filter((r) => r.who === user.username);
  const show = ['pending', 'approved', 'declined'].includes(q.get('show')) ? q.get('show') : 'all';
  const list = mine.filter((r) => show === 'all' || r.status === show).sort((a, b) => b.from.localeCompare(a.from));
  const label = variant === 'v2' ? 'New request' : 'Request leave';
  const sent = q.get('sent') ? `<p class="notice" role="status">Request sent to ${esc(nameOf(state, state.people.find((p) => p.username === user.username).manager))}.</p>` : '';
  const table = list.length
    ? `<table aria-label="My requests"><thead><tr><th>Dates</th><th>Type</th><th>Days</th><th>Status</th><th>Note</th></tr></thead><tbody>${list
        .map((r) => `<tr><td>${range(r)}</td><td>${esc(r.type)}</td><td>${r.days}</td><td>${statusChip(r.status)}</td><td>${esc(r.note)}</td></tr>`)
        .join('')}</tbody></table>`
    : '<p class="empty">You have no requests yet.</p>';
  const opts = ['all', 'pending', 'approved', 'declined'].map((o) => `<option value="${o}"${o === show ? ' selected' : ''}>${o[0].toUpperCase() + o.slice(1)}</option>`).join('');
  const dialog = `<dialog id="new-request" aria-labelledby="dlg-title"${q.get('new') ? ' open' : ''}>
<h2 id="dlg-title">Request leave</h2>
<form method="post" action="/requests">
<label for="f-type">Type of leave</label><select id="f-type" name="type"><option>Annual leave</option><option>Sick leave</option><option>Unpaid leave</option></select>
<label for="f-from">First day</label><input id="f-from" name="from" type="date" required value="${lib.today()}">
<label for="f-to">Last day</label><input id="f-to" name="to" type="date" required value="${lib.today()}">
<label for="f-note">Note for your manager</label><textarea id="f-note" name="note" rows="3"></textarea>
<p style="display:flex;gap:12px;justify-content:flex-end"><a class="button secondary" href="/requests" data-close role="button">Cancel</a><button type="submit">Submit request</button></p>
</form></dialog>`;
  return `${sent}<div class="toolbar" data-region="requests-toolbar" role="region" aria-label="Requests toolbar"><h1>My requests</h1>
<form method="get" action="/requests"><label for="f-show" style="display:inline;margin-right:6px">Show</label><select id="f-show" name="show" style="width:auto" onchange="this.form.submit()">${opts}</select></form>
<form method="get" action="/requests"><input type="hidden" name="new" value="1"><button id="open-new-request" type="submit">${label}</button></form></div>
${table}${dialog}`;
}

function teamPending(state, user) {
  return state.requests.filter((r) => r.status === 'pending' && (state.people.find((p) => p.username === r.who) || {}).manager === user.username);
}

function inbox(state, user) {
  const list = teamPending(state, user);
  const rows = list
    .map((r) => `<li class="card" style="margin-bottom:12px"><div class="person"><span class="avatar" aria-hidden="true">${initials(nameOf(state, r.who))}</span><div><strong>${esc(nameOf(state, r.who))}</strong><br>${esc(r.type)}, ${range(r)} (${r.days} days)${r.note ? `<br><em>${esc(r.note)}</em>` : ''}</div></div>
<form method="post" action="/inbox/${r.id}/approve" style="display:inline"><button type="submit">Approve</button></form>
<form method="post" action="/inbox/${r.id}/decline" style="display:inline"><button class="secondary" type="submit">Decline</button></form></li>`)
    .join('');
  return `<h1>Inbox</h1><p>Requests from your team waiting for a decision.</p>${list.length ? `<ul aria-label="Waiting for you" style="list-style:none;padding:0">${rows}</ul>` : '<p class="empty">Nothing waiting for you.</p>'}`;
}

function people(state, q) {
  const term = (q.get('q') || '').toLowerCase();
  const list = state.people.filter((p) => !term || p.name.toLowerCase().includes(term) || p.team.toLowerCase().includes(term));
  return `<h1>People</h1><form method="get" action="/people" role="search"><label for="f-q">Search people</label><input id="f-q" name="q" value="${esc(q.get('q') || '')}" placeholder="Name or team"></form>
<div class="cards" style="margin-top:16px">${list
    .map((p) => `<article class="card person-card"><div class="person"><span class="avatar" aria-hidden="true">${initials(p.name)}</span><div><h3 style="margin:0">${esc(p.name)}</h3>${esc(p.team)} · ${ROLE_LABEL[p.role]}</div></div></article>`)
    .join('')}</div>${list.length ? '' : '<p class="empty">No one matches.</p>'}`;
}

function settings(state, user, q, variant) {
  const s = lib.settingsFor(state, user.username);
  const box = (name, label, on) => `<div class="check"><label><input type="checkbox" name="${name}"${on ? ' checked' : ''}> ${label}</label></div>`;
  const notif = [box('emailChanges', 'Email me when a request changes', s.emailChanges), box('weeklySummary', 'Send me a weekly summary', s.weeklySummary)];
  if (variant !== 'v2') notif.push(box('calendarSync', 'Sync my leave to my calendar', s.calendarSync));
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => box(`day-${d}`, d, s.workDays.includes(d))).join('');
  return `<h1>Settings</h1>${q.get('saved') ? '<p class="notice" role="status">Settings saved.</p>' : ''}<form method="post" action="/settings">
<section class="panel" data-region="settings-notifications" role="region" aria-labelledby="s-notif"><h2 id="s-notif">Notifications</h2>${notif.join('')}</section>
<section class="panel" data-region="settings-week" role="region" aria-labelledby="s-week"><h2 id="s-week">Working week</h2><div style="display:flex;gap:16px">${days}</div></section>
<button type="submit">Save settings</button></form>`;
}

function admin(state, q) {
  const roleSel = (p) => `<select name="role-${p.username}" aria-label="Role for ${esc(p.name)}" style="width:auto">${['employee', 'manager', 'admin'].map((r) => `<option value="${r}"${r === p.role ? ' selected' : ''}>${ROLE_LABEL[r]}</option>`).join('')}</select>`;
  return `<h1>Admin</h1>${q.get('saved') ? '<p class="notice" role="status">Saved.</p>' : ''}
<section class="panel" role="region" aria-labelledby="a-policy"><h2 id="a-policy">Leave policy</h2><form method="post" action="/admin/policy">
<label for="f-allow">Annual allowance (days)</label><input id="f-allow" name="allowance" type="number" min="0" value="${state.policy.allowance}">
<label for="f-carry">Carry over up to (days)</label><input id="f-carry" name="carryOver" type="number" min="0" value="${state.policy.carryOver}">
<p><button type="submit">Save policy</button></p></form></section>
<section class="panel" role="region" aria-labelledby="a-people"><h2 id="a-people">People and roles</h2><form method="post" action="/admin/roles">
<table aria-label="People and roles"><thead><tr><th>Name</th><th>Team</th><th>Role</th></tr></thead><tbody>${state.people.map((p) => `<tr><td>${esc(p.name)}</td><td>${esc(p.team)}</td><td>${roleSel(p)}</td></tr>`).join('')}</tbody></table>
<p><button type="submit">Save roles</button></p></form></section>`;
}

function signInPage(q, formEnabled) {
  const err = q.get('error') ? '<p class="notice" role="alert">That username and password don\'t match.</p>' : '';
  const form = formEnabled
    ? `<form method="post" action="/sign-in"><label for="f-user">Username</label><input id="f-user" name="username" autocomplete="username">
<label for="f-pass">Password</label><input id="f-pass" name="password" type="password" autocomplete="current-password"><p><button type="submit">Sign in</button></p></form>`
    : '<p>This demo copy signs people in with its sign-in helper (see the README).</p>';
  return `<section class="panel" style="max-width:420px;margin:48px auto"><h1>Sign in</h1>${err}${form}</section>`;
}

// ---------------------------------------------------------------------------------------
// Server

function cookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

async function body(req) {
  let s = '';
  for await (const chunk of req) {
    s += chunk;
    if (s.length > 1e5) break;
  }
  return new URLSearchParams(s);
}

export function createServer({ appDir = lib.APP_DIR, variant: flag } = {}) {
  const { variant, release } = lib.releaseInfo(appDir, flag);
  const dir = process.env.LEAVE_APP_DATA || path.join(appDir, 'data');
  const formEnabled = !!process.env[lib.PASSWORD_ENV];

  const server = http.createServer(async (req, res) => {
    const send = (status, html, headers = {}) => {
      res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...headers });
      res.end(html);
    };
    const redirect = (to, headers = {}) => {
      res.writeHead(303, { location: to, ...headers });
      res.end();
    };
    try {
      const url = new URL(req.url, 'http://localhost');
      const q = url.searchParams;
      const p = url.pathname;
      if (p === '/__health') return send(200, `ok ${variant} ${release}`, { 'content-type': 'text/plain' });

      const state = lib.load(dir);
      const username = lib.userFromSession(cookies(req)[lib.COOKIE], dir);
      const user = username && state.people.find((x) => x.username === username && Object.values(lib.ACCOUNTS).includes(x.username));
      const render = (title, current, html, status = 200) => send(status, page({ title, user, current, body: html, variant }));

      if (p === '/sign-in' && req.method === 'GET') return render('Sign in', '', signInPage(q, formEnabled));
      if (p === '/sign-in' && req.method === 'POST') {
        const f = await body(req);
        const who = state.people.find((x) => x.username === f.get('username') && Object.values(lib.ACCOUNTS).includes(x.username));
        if (!formEnabled || !who || f.get('password') !== process.env[lib.PASSWORD_ENV]) return redirect('/sign-in?error=1');
        return redirect('/home', { 'set-cookie': `${lib.COOKIE}=${encodeURIComponent(lib.sessionFor(who.username, dir))}; Path=/; HttpOnly; SameSite=Lax` });
      }
      if (p === '/sign-out' && req.method === 'POST') return redirect('/sign-in', { 'set-cookie': `${lib.COOKIE}=; Path=/; Max-Age=0` });
      if (!user) return redirect('/sign-in');

      const forbidden = () => render('No access', '', `<h1>You don't have access to this page</h1><p><a href="/home">Back to Home</a></p>`, 403);

      if (p === '/' || p === '/home') return render('Home', '/home', home(state, user));
      if (p === '/requests' && req.method === 'GET') return render('Requests', '/requests', requestsScreen(state, user, q, variant));
      if (p === '/requests' && req.method === 'POST') {
        const f = await body(req);
        const from = f.get('from') || lib.today();
        const to = f.get('to') && f.get('to') >= from ? f.get('to') : from;
        const days = Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1;
        state.requests.push({ id: `r${state.nextId++}`, who: user.username, type: f.get('type') || 'Annual leave', from, to, days, status: 'pending', note: (f.get('note') || '').slice(0, 200) });
        lib.save(state, dir);
        return redirect('/requests?sent=1');
      }
      if (p === '/inbox') return user.role === 'manager' ? render('Inbox', '/inbox', inbox(state, user)) : forbidden();
      const decide = p.match(/^\/inbox\/(r\d+)\/(approve|decline)$/);
      if (decide && req.method === 'POST') {
        if (user.role !== 'manager') return forbidden();
        const r = teamPending(state, user).find((x) => x.id === decide[1]);
        if (r) {
          r.status = decide[2] === 'approve' ? 'approved' : 'declined';
          lib.save(state, dir);
        }
        return redirect('/inbox');
      }
      if (p === '/people') return render('People', '/people', people(state, q));
      if (p === '/settings' && req.method === 'GET') return render('Settings', '/settings', settings(state, user, q, variant));
      if (p === '/settings' && req.method === 'POST') {
        const f = await body(req);
        state.settings[user.username] = {
          emailChanges: f.has('emailChanges'),
          weeklySummary: f.has('weeklySummary'),
          calendarSync: variant === 'v2' ? lib.settingsFor(state, user.username).calendarSync : f.has('calendarSync'),
          workDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].filter((d) => f.has(`day-${d}`)),
        };
        lib.save(state, dir);
        return redirect('/settings?saved=1');
      }
      if (p.startsWith('/admin')) {
        if (user.role !== 'admin') return forbidden();
        if (p === '/admin' && req.method === 'GET') return render('Admin', '/admin', admin(state, q));
        if (p === '/admin/policy' && req.method === 'POST') {
          const f = await body(req);
          const n = (v, d) => (Number.isInteger(Number(v)) && Number(v) >= 0 ? Number(v) : d);
          state.policy = { allowance: n(f.get('allowance'), state.policy.allowance), carryOver: n(f.get('carryOver'), state.policy.carryOver) };
          lib.save(state, dir);
          return redirect('/admin?saved=1');
        }
        if (p === '/admin/roles' && req.method === 'POST') {
          const f = await body(req);
          for (const person of state.people) {
            const r = f.get(`role-${person.username}`);
            if (['employee', 'manager', 'admin'].includes(r)) person.role = r;
          }
          lib.save(state, dir);
          return redirect('/admin?saved=1');
        }
      }
      return render('Not found', '', '<h1>Page not found</h1><p><a href="/home">Back to Home</a></p>', 404);
    } catch (err) {
      send(500, `<h1>Something went wrong</h1><pre>${esc(err.message)}</pre>`);
    }
  });
  return { server, variant, release };
}

function parseArgs(argv) {
  const a = { port: 0, host: '127.0.0.1' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--variant') a.variant = argv[++i];
    else if (argv[i] === '--port') a.port = Number(argv[++i]);
    else if (argv[i] === '--host') a.host = argv[++i];
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  return a;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const a = parseArgs(process.argv.slice(2));
  const { server, variant, release } = createServer({ variant: a.variant });
  server.listen(a.port, a.host, () => {
    const { port } = server.address();
    console.log(`Leave Planner ${release} (${variant}) listening on http://${a.host}:${port}`);
  });
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
}
