#!/usr/bin/env node
// bundle.mjs — downloads a web app's public script bundle, slowly and honestly (platform-audit PLAN §2.6, D6).
// Node ≥ 20, built-ins only. What it downloads is only ever written to disk and read as text: nothing here
// runs it (D8). Run from the target repo's root as  node $S/bundle.mjs fetch …   (--help for the options).

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './inventory-core.js';

const core = globalThis.AuditInventory;
const CLIENT = 'platform-audit/1.0 (public bundle reader)';
const KINDS = new Set(['.js', '.mjs', '.json']);

const USAGE = `Usage:
  node bundle.mjs fetch --origin <url> --out <dir> [options] <path | url>…

Downloads each script you name, then the chunks they refer to, one at a time, into <dir> (laid out by
URL path), and writes <dir>/manifest.json: url, file, status, bytes, type and sha256 for each file.

  --origin <url>        the app's origin; a bare path such as /assets/index-ab12cd34.js is read against it
  --out <dir>           where the files and manifest.json go
  --allow-host <host>   also fetch from this host (one the page itself loads scripts from); repeatable
  --delay <ms>          wait between files (default 1500)
  --max-files <n>       stop after this many files (default 40)
  --max-bytes <n>       skip any file larger than this (default 15000000)
  --no-discover         fetch only what you name; don't follow chunk references
  --dry-run             list what would be fetched first, and fetch nothing

Discovery follows import("./…"), …/assets/<name>-<hash>.js and static/js/….chunk.js references, and any
other chunk reference the inventory reader finds. Only .js, .mjs and .json files are fetched, only from
the origin and allowed hosts, and with no cookies. Source maps are noted in the manifest, never fetched.
Client name: ${CLIENT}

Exit codes:
  0  done (anything refused by the rules above is listed under "skipped" in the manifest)
  1  done, but some files failed (404, a network error)
  2  usage error
  3  stopped: the site answered 401, 403 or 429, redirected, or sent an HTML page (a sign-in or a
     challenge). Nothing is retried. Don't work around it: use the in-page fallback (D6).
`;

function fail(msg) {
  process.stderr.write(`bundle.mjs: ${msg}\n\nRun with --help for the usage.\n`);
  process.exit(2);
}

function parseArgs(argv) {
  const a = { cmd: argv[0], origin: null, out: null, allow: [], delay: 1500, maxFiles: 40, maxBytes: 15000000, discover: true, dry: false, targets: [] };
  const num = (k, v) => { const n = Number(v); if (!Number.isFinite(n) || n < 0) fail(`${k} takes a number`); return n; };
  for (let i = 1; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--origin') a.origin = argv[++i];
    else if (k === '--out') a.out = argv[++i];
    else if (k === '--allow-host') a.allow.push(String(argv[++i] || '').toLowerCase());
    else if (k === '--delay') a.delay = num(k, argv[++i]);
    else if (k === '--max-files') a.maxFiles = num(k, argv[++i]);
    else if (k === '--max-bytes') a.maxBytes = num(k, argv[++i]);
    else if (k === '--no-discover') a.discover = false;
    else if (k === '--dry-run') a.dry = true;
    else if (k === '--help' || k === '-h') a.help = true;
    else if (k.startsWith('--')) fail(`unknown option ${k}`);
    else a.targets.push(k);
  }
  return a;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const extOf = (u) => path.posix.extname(u.pathname).toLowerCase();

/** Where a URL is saved under out: its path for the origin, _hosts/<host>/<path> for an allowed host. */
function fileFor(u, origin) {
  const parts = decodeURIComponent(u.pathname).split('/').filter((p) => p && p !== '.' && p !== '..').map((p) => p.replace(/[^\w@~.\-]/g, '_'));
  if (!parts.length) parts.push('index.js');
  return (u.host === origin.host ? parts : ['_hosts', u.host.replace(/[^\w.\-]/g, '_'), ...parts]).join('/');
}

/** The chunk references in one downloaded file, as absolute URLs. */
export function discover(text, name, fileUrl, origin) {
  const refs = new Set();
  for (const m of text.matchAll(/\bimport\(\s*(["'`])(\.{1,2}\/[^"'`\s]+?)\1\s*\)/g)) refs.add(m[2]);
  for (const m of text.matchAll(/["'`]((?:[\w\-./]*\/)?assets\/[\w\-.]+-[\w]{6,}\.m?js)["'`]/g)) refs.add(m[1]);
  for (const m of text.matchAll(/["'`]((?:[\w\-./]*\/)?static\/js\/[\w\-.]+\.chunk\.js)["'`]/g)) refs.add(m[1]);
  if (core) {
    let inv = null;
    try { inv = core.build([{ name, text }]); } catch (e) { inv = null; }
    for (const c of (inv && inv.chunks) || []) {
      const r = c.ref;
      if (/^(\.{1,2}\/|\/|https?:\/\/)/.test(r) || /(^|\/)(assets|static\/js)\//.test(r)) refs.add(r);
    }
  }
  const out = [];
  for (const r of refs) {
    let u;
    try {
      // ./x and ../x are relative to the file that names them; a bare assets/… or static/… is relative to the site root
      u = /^(\.{1,2}\/|\/|https?:\/\/)/.test(r) ? new URL(r, fileUrl) : new URL('/' + r, origin);
    } catch (e) { continue; }
    u.hash = '';
    out.push(u.href);
  }
  return out;
}

async function fetchCmd(a) {
  if (!a.origin) fail('fetch needs --origin <url>');
  if (!a.out) fail('fetch needs --out <dir>');
  if (!a.targets.length) fail('name at least one script path or URL to fetch');
  let origin;
  try { origin = new URL(a.origin); } catch (e) { fail(`--origin is not a URL: ${a.origin}`); }
  if (!/^https?:$/.test(origin.protocol)) fail('--origin must be http or https');
  const allowed = new Set([origin.host.toLowerCase(), ...a.allow]);

  const manifest = {
    version: 1, client: CLIENT, origin: origin.origin, started: new Date().toISOString(), finished: null,
    delayMs: a.delay, files: [], skipped: [], failed: [], sourceMaps: [], stopped: null,
  };
  const seen = new Set();
  const queue = [];
  const enqueue = (raw, from) => {
    let u;
    try { u = new URL(raw, origin); } catch (e) { manifest.skipped.push({ url: String(raw), reason: 'not a URL', from }); return; }
    u.hash = '';
    if (seen.has(u.href)) return;
    seen.add(u.href);
    if (!/^https?:$/.test(u.protocol)) return manifest.skipped.push({ url: u.href, reason: 'not http(s)', from });
    if (!allowed.has(u.host.toLowerCase())) return manifest.skipped.push({ url: u.href, reason: 'another host (add --allow-host only for a host the page itself loads scripts from)', from });
    if (!KINDS.has(extOf(u))) return manifest.skipped.push({ url: u.href, reason: 'not .js, .mjs or .json', from });
    queue.push({ url: u, from });
  };
  for (const t of a.targets) enqueue(t, null);

  if (a.dry) {
    for (const q of queue) console.log(`would fetch  ${q.url.href}  →  ${fileFor(q.url, origin)}`);
    for (const s of manifest.skipped) console.log(`would skip   ${s.url}  (${s.reason})`);
    console.log(`${queue.length} to fetch, then the chunks they name${a.discover ? '' : ' (not followed: --no-discover)'}; ${a.delay} ms apart; nothing fetched (--dry-run)`);
    return 0;
  }

  fs.mkdirSync(a.out, { recursive: true });
  const writeManifest = () => {
    manifest.finished = new Date().toISOString();
    fs.writeFileSync(path.join(a.out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  };

  let last = 0;
  while (queue.length) {
    if (manifest.files.length >= a.maxFiles) {
      for (const q of queue.splice(0)) manifest.skipped.push({ url: q.url.href, reason: `--max-files ${a.maxFiles} reached`, from: q.from });
      break;
    }
    const { url, from } = queue.shift();
    // --delay counts from the end of the previous file, so the gap the server sees is never shorter
    if (last) { let wait; while ((wait = last + a.delay - Date.now()) > 0) await sleep(wait); }
    const code = await one(url, from);
    last = Date.now();
    if (code !== undefined) return code;
  }

  writeManifest();
  const kb = Math.round(manifest.files.reduce((s, f) => s + f.bytes, 0) / 1024);
  console.log(`fetched ${manifest.files.length} files (${kb} KB) into ${a.out}; skipped ${manifest.skipped.length}, failed ${manifest.failed.length}; source maps noted ${manifest.sourceMaps.length} (not fetched)`);
  for (const f of manifest.files) console.log(`  ${f.file}  ${f.bytes} B`);
  for (const s of manifest.skipped) console.log(`  skipped ${s.url}: ${s.reason}`);
  for (const f of manifest.failed) console.log(`  failed  ${f.url}: ${f.status || f.reason}`);
  return manifest.failed.length ? 1 : 0;

  /** Fetch one file; returns an exit code to stop with, or undefined to carry on. */
  async function one(url, from) {
    let res;
    try {
      res = await fetch(url, { headers: { 'User-Agent': CLIENT, Accept: '*/*' }, redirect: 'manual', credentials: 'omit' });
    } catch (e) {
      manifest.failed.push({ url: url.href, reason: e.cause ? String(e.cause.code || e.cause.message) : e.message, from });
      return;
    }
    const type = (res.headers.get('content-type') || '').split(';')[0].trim();
    const stop = (reason) => {
      manifest.stopped = { url: url.href, status: res.status, reason };
      for (const q of queue.splice(0)) manifest.skipped.push({ url: q.url.href, reason: 'not fetched: stopped', from: q.from });
      writeManifest();
      process.stderr.write(`bundle.mjs: stopped at ${url.href}: ${reason}. Not retried; use the in-page fallback (D6).\n`);
      return 3;
    };
    if ([401, 403, 429].includes(res.status)) return stop(`HTTP ${res.status}${res.headers.get('retry-after') ? `, Retry-After ${res.headers.get('retry-after')}` : ''}`);
    if (res.status >= 300 && res.status < 400) return stop(`HTTP ${res.status} redirect to ${res.headers.get('location') || '?'} (likely a sign-in)`);
    if (!res.ok) { manifest.failed.push({ url: url.href, status: res.status, from }); await res.body?.cancel(); return; }
    if (type === 'text/html') return stop('an HTML page instead of a script (a sign-in or a challenge page)');
    const len = Number(res.headers.get('content-length'));
    if (len > a.maxBytes) { manifest.skipped.push({ url: url.href, reason: `larger than --max-bytes (${len})`, from }); await res.body?.cancel(); return; }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > a.maxBytes) { manifest.skipped.push({ url: url.href, reason: `larger than --max-bytes (${buf.length})`, from }); return; }
    const text = buf.toString('utf8');
    if (/^\s*(<!doctype html|<html)/i.test(text)) return stop('an HTML page instead of a script (a sign-in or a challenge page)');

    const file = fileFor(url, origin);
    fs.mkdirSync(path.dirname(path.join(a.out, file)), { recursive: true });
    fs.writeFileSync(path.join(a.out, file), buf);
    manifest.files.push({ url: url.href, file, status: res.status, bytes: buf.length, type, sha256: crypto.createHash('sha256').update(buf).digest('hex'), from });
    for (const m of text.matchAll(/[#@]\s*sourceMappingURL\s*=\s*(\S+)/g)) {
      manifest.sourceMaps.push({ file, url: m[1].startsWith('data:') ? 'data:(inline)' : new URL(m[1], url).href });
    }
    if (a.discover && extOf(url) !== '.json') for (const ref of discover(text, file, url, origin)) enqueue(ref, file);
    return undefined;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const a = parseArgs(process.argv.slice(2));
  if (a.help || !a.cmd || a.cmd === '--help' || a.cmd === '-h') { process.stdout.write(USAGE); process.exit(a.cmd ? 0 : 2); }
  if (a.cmd !== 'fetch') fail(`unknown command ${a.cmd}`);
  fetchCmd(a).then((code) => process.exit(code), (e) => { process.stderr.write(`bundle.mjs: ${e.stack || e}\n`); process.exit(1); });
}
