// Shared scaffolding and grading for the wiki-guides scripted cases: the Leave Planner fixture
// served on port 0, the frozen guide set over it, the bundled mock Confluence (in this, the
// runner's, process), an operator-side first publish, and what the mock holds once a run is
// over. Nothing here can reach a real wiki: the mock and the fixture listen on 127.0.0.1 only.
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

export const SET_FILE = 'docs/user-guides/guides.json';
export const TOP_ID = '1001';
export const TOP_TITLE = 'Product guides';
export const GUIDE_TITLES = { 'getting-started': 'Getting started with Leave Planner', employee: 'Leave Planner for employees', manager: 'Leave Planner for managers' };

const lib = (plugin) => path.join(plugin, 'evals', 'lib', 'scaffold.mjs');
const W = (plugin) => path.join(plugin, 'skills', 'wiki-guides', 'scripts');

/** Serve the staged fixture in `cwd` (its own server.mjs) on `port` (0: any). */
export function serve(cwd, port = 0) {
  const child = spawn('node', ['server.mjs', '--port', String(port)], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((resolve, reject) => {
    let out = '';
    child.stdout.on('data', (d) => {
      out += d;
      const m = out.match(/listening on (http:\/\/127\.0\.0\.1:(\d+))/);
      if (m) resolve({ url: m[1], port: Number(m[2]), stop: () => new Promise((r) => (child.exitCode !== null ? r() : (child.once('exit', r), child.kill()))) });
    });
    child.on('exit', (code) => reject(new Error(`server exited ${code}: ${out}`)));
  });
}

/** Start the mock Confluence in this process. */
export async function mock(plugin, opts = {}) {
  const { startMock } = await import(path.join(plugin, 'fixtures', 'mock-confluence', 'server.mjs'));
  return startMock(opts);
}

/** The page the user names, as an address: the mock's view of the top page. */
export const pageAddress = (m) => `${m.url}/pages/viewpage.action?pageId=${TOP_ID}`;

/**
 * The staged fixture with the frozen guide set over it. `taken`: every card already swapped for
 * a PNG (release 1.0). Returns the scaffold module, for more.
 */
export async function stageGuides({ cwd, plugin, variant = 'v1', baseUrl, taken = false }) {
  const sc = await import(lib(plugin));
  sc.stageInto(cwd, variant);
  sc.copyFrozenSet(cwd, baseUrl);
  if (taken) sc.takeAll(cwd, { release: '1.0' });
  return sc;
}

/** Point the set at where the fixture listens now. */
export async function setBaseUrl(cwd, plugin, url) {
  const gs = await import(path.join(W(plugin), 'guide-set.mjs'));
  const file = path.join(cwd, SET_FILE);
  const set = gs.loadGuideSet(file);
  set.app.baseUrl = url;
  set.interview.answers.appBaseUrl = url;
  gs.saveGuideSet(file, set);
}

/**
 * A first publish made by the operator with the plugin's own scripts, as a run before would.
 * Async: the mock answers from this process, so a synchronous child would deadlock.
 */
export async function operatorPublish({ cwd, plugin, m, release = '1.0' }) {
  const run = (script, ...args) => promisify(execFile)('node', [path.join(W(plugin), script), ...args], { cwd, encoding: 'utf8' });
  await run('publish-kit.mjs', 'target', '--top-page', TOP_ID, '--base-url', m.url);
  await run('to-confluence.mjs', '--release', release, '--top-title', TOP_TITLE);
  await run('bundle.mjs');
  await run('publish-kit.mjs', 'input');
  await run('publish-node.mjs', 'publish', '--base', m.url, '--confirm-adopted');
  await run('publish-kit.mjs', 'record', '--report', '.user-guides/out/confluence/report.json');
}

/** Every page the mock holds, with its current body, read over its REST API. */
export async function capture(m) {
  const snap = m.snapshot();
  const pages = [];
  for (const p of snap.pages) {
    let body = null;
    if (p.status === 'current') {
      const r = await fetch(`${m.url}/rest/api/content/${p.id}?expand=body.storage,version`);
      if (r.ok) body = (await r.json()).body?.storage?.value ?? null;
    }
    pages.push({ ...p, body });
  }
  return { pages, attachments: snap.attachments, writes: m.writes() };
}

// ── grading ─────────────────────────────────────────────────────────────────────────────

/**
 * Every shot in `ids` has a Read of its PNG (the review copy or the full-size shot) before the
 * first swap-shots call that is not a dry run.
 */
export function readBeforeSwap(toolCalls, ids) {
  const swapAt = toolCalls.findIndex((t) => t.name === 'Bash' && /swap-shots\.mjs/.test(t.input?.command || '') && !/--dry-run/.test(t.input?.command || ''));
  if (swapAt < 0) return [`no swap-shots call`];
  const before = toolCalls.slice(0, swapAt).filter((t) => t.name === 'Read').map((t) => String(t.input?.file_path || ''));
  return ids.filter((id) => !before.some((f) => new RegExp(`\\.user-guides/out/(review|shots)/${id}\\.png$`).test(f))).map((id) => `${id}.png was not read before the swap`);
}

export const current = (cap) => cap.pages.filter((p) => p.status === 'current');
export const byTitle = (cap, title) => current(cap).find((p) => p.title === title);

/** Write requests that changed the wiki: "<METHOD> <path>", anything but a GET. */
export const wikiWrites = (cap) => cap.writes;

export const ok = (problems, good) => ({ passed: !problems.length, explanation: problems.length ? problems.join('; ').slice(0, 900) : good });
