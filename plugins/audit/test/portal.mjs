// Test helper: starts the Partner Portal fixture on port 0 and hands back its URL (platform-audit S3).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURE = path.resolve(HERE, '..', 'fixtures', 'partner-portal');
export const SERVER = path.join(FIXTURE, 'server.mjs');
export const TRUTH = JSON.parse(fs.readFileSync(path.join(FIXTURE, 'truth.json'), 'utf8'));
export const SCRIPTS = path.resolve(HERE, '..', 'skills', 'platform-audit', 'scripts');

export const tmp = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), `audit-${prefix}-`));

/** Start the fixture; resolves to { url, line, log, stop(), entries() }. */
export function startPortal(args = []) {
  const log = path.join(tmp('portal-log'), 'requests.jsonl');
  const proc = spawn(process.execPath, [SERVER, '--log', log, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((resolve, reject) => {
    let out = '', err = '';
    const timer = setTimeout(() => { proc.kill(); reject(new Error(`fixture did not start: ${out}${err}`)); }, 5000);
    proc.stderr.on('data', (d) => { err += d; });
    proc.on('exit', (code) => { clearTimeout(timer); if (!out.includes('http')) reject(new Error(`fixture exited ${code}: ${err}`)); });
    proc.stdout.on('data', (d) => {
      out += d;
      const m = /^(Partner Portal fixture on (http:\/\/127\.0\.0\.1:(\d+)))$/m.exec(out);
      if (!m) return;
      clearTimeout(timer);
      resolve({
        url: m[2], port: Number(m[3]), line: m[1], log,
        entries: () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []),
        stop: () => new Promise((r) => { if (proc.exitCode !== null) return r(); proc.once('exit', () => r()); proc.kill('SIGTERM'); }),
      });
    });
  });
}

/** Sign in as the demo partner; resolves to the Cookie header value. */
export async function signIn(url) {
  const res = await fetch(url + '/login', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'next=' });
  const set = res.headers.get('set-cookie') || '';
  return { res, cookie: set.split(';')[0], setCookie: set };
}

export function gql(url, cookie, query, variables = {}) {
  return fetch(url + '/api/graphql', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ query, variables }),
  });
}

/** A concrete path for a truth.json route (its :params filled with ids the fixture knows). */
export const concrete = (p) => p.replace(':orderId', 'O-10001').replace(':customerId', 'C-2001');

/** Small settle for the log, which is written when each response finishes. */
export const settle = () => new Promise((r) => setTimeout(r, 50));
