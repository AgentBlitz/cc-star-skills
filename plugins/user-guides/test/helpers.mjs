// Shared test helpers: start a staged fixture on port 0, write a guides.json for it, run a
// skill script in the staged copy.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLUGIN_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SCRIPTS = path.join(PLUGIN_DIR, 'skills', 'write-guides', 'scripts');
export const DEV_PLAYWRIGHT = path.join(PLUGIN_DIR, 'node_modules', 'playwright-core');

/** Start `node server.mjs` in a staged copy; resolves { url, child, stop() }. */
export function startFixture(dir, extraEnv = {}) {
  const child = spawn('node', ['server.mjs'], { cwd: dir, env: { ...process.env, LEAVE_APP_VARIANT: '', ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((resolve, reject) => {
    let out = '';
    const t = setTimeout(() => reject(new Error(`no URL printed: ${out}`)), 5000);
    child.stdout.on('data', (d) => {
      out += d;
      const m = out.match(/listening on (http:\/\/127\.0\.0\.1:\d+)/);
      if (m) {
        clearTimeout(t);
        resolve({
          url: m[1],
          child,
          stop: () =>
            new Promise((r) => {
              if (child.exitCode !== null) return r();
              child.once('exit', r);
              child.kill();
            }),
        });
      }
    });
    child.on('exit', (code) => reject(new Error(`server exited ${code}: ${out}`)));
  });
}

/** A guides.json for the fixture, signing in with its cookie helper. */
export function fixtureSet(url, over = {}) {
  return {
    schemaVersion: 1,
    product: { name: 'Leave Planner', language: 'en-GB' },
    app: {
      baseUrl: url,
      signIn: { kind: 'cookie-command', command: 'node sign-in.mjs {id}', cookie: { name: 'leave_session' } },
      accounts: { employee: { id: 'rowan' }, manager: { id: 'tamsin' }, admin: { id: 'idris' } },
    },
    interview: { wordingVersion: '1', answers: {} },
    notChecked: [],
    leftOut: [],
    checks: { patterns: [] },
    guides: [],
    shots: [],
    publish: {},
    ...over,
  };
}

export function writeSet(dir, set, rel = 'docs/user-guides/guides.json') {
  const file = path.join(dir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(set, null, 2) + '\n');
  return file;
}

/** Run a write-guides script in `cwd`; returns { status, stdout, stderr }. */
export function runScript(cwd, script, args = [], { env = {}, input } = {}) {
  return spawnSync('node', [path.join(SCRIPTS, script), ...args], { cwd, env: { ...process.env, EVAL_LEAVE_APP: '1', ...env }, encoding: 'utf8', input });
}

/** Can the dev playwright-core start Chromium here? (false in sandboxes without a browser) */
export async function browserAvailable() {
  try {
    const kit = await import(path.join(SCRIPTS, 'kit-core.mjs'));
    const found = kit.findPlaywright({ env: { ...process.env, USER_GUIDES_PLAYWRIGHT_CORE: DEV_PLAYWRIGHT } });
    if (!found) return false;
    const pw = await kit.loadPlaywright(found);
    const b = await pw.chromium.launch({ headless: true });
    await b.close();
    return true;
  } catch {
    return false;
  }
}
