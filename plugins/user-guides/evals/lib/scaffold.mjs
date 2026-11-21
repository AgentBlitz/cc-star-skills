#!/usr/bin/env node
// Eval scaffolding (PLAN R13, R16): every case stages the Leave Planner fixture through
// test/stage.mjs and then lays out what the case starts from. Run as the operator, in the run's
// workspace (an eval-format `scaffold_script`, or the scripted runner), never in this repo.
//
//   node scaffold.mjs stage   [--variant v1|v2]             stage the fixture into the cwd
//   node scaffold.mjs answers <preset> [--base-url <url>]    write docs/user-guides/guides.json
//   node scaffold.mjs hand-written                          add guides written by hand (adopt)
//   node scaffold.mjs guides  [--taken] [--release 1.0]      the frozen guide set (wiki-guides);
//                                                           --taken swaps every card for a PNG
//   node scaffold.mjs commit  <message>                      commit what the scaffold added
//
// Presets: `walk` (every answer, the local app, every task), `code` (every answer, facts from the
// code, the main tasks only),
// `nonlocal` (every answer, a base URL that is not local). Round 3 is recorded as
// "approve as proposed" in all three (R9).

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import _zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN = path.resolve(HERE, '..', '..');
const { stageFixture, git } = await import(path.join(PLUGIN, 'test', 'stage.mjs'));
const gs = await import(path.join(PLUGIN, 'skills', 'write-guides', 'scripts', 'guide-set.mjs'));

export const SET_FILE = 'docs/user-guides/guides.json';

/** Stage the fixture into `into` (which may already hold files), keeping its git repo. */
export function stageInto(into, variant = 'v1') {
  const tmp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'ug-eval-stage-'));
  const { dir } = stageFixture({ variant, into: path.join(tmp, 'app') });
  fs.cpSync(dir, into, { recursive: true });
  fs.rmSync(tmp, { recursive: true, force: true });
  return into;
}

const ANSWERS = {
  readers: ['employee', 'manager'],
  kinds: ['Role guides, one per role, by task', 'Getting started'],
  depth: 'The main tasks only',
  whereRead: 'In the repo and on a wiki',
  languageTone: 'UK English, plain and direct',
  pictures: 'Placeholders now, screenshots later',
  facts: 'Walk the local app as each role',
  folder: 'docs/user-guides/',
  appSignIn: 'A helper that prints a session cookie (node sign-in.mjs <id>, with EVAL_LEAVE_APP=1)',
  appReset: 'No, walk the data as it is',
  approval: 'approve as proposed',
};

/** A guides.json holding every interview answer, for a headless run that needs none asked. */
export function answersSet(preset, baseUrl) {
  const url = baseUrl || { walk: 'http://127.0.0.1:9', code: 'http://127.0.0.1:9', nonlocal: 'https://leave.example.com' }[preset];
  if (!url) throw new Error(`unknown preset "${preset}"`);
  const set = gs.createGuideSet({ name: 'Leave Planner', language: 'en-GB', baseUrl: url });
  set.app.signIn = { kind: 'cookie-command', command: 'node sign-in.mjs {id}', cookie: { name: 'leave_session' } };
  set.app.accounts = { employee: { id: 'rowan' }, manager: { id: 'tamsin' } };
  const answers = { ...ANSWERS, appBaseUrl: url };
  if (preset === 'code') answers.facts = 'From the code only (every claim is listed as not checked)';
  // A walk goes task by task, so the set shows the two screens v2 changes (R14).
  if (preset === 'walk') answers.depth = 'Every task, step by step';
  set.interview = { wordingVersion: '2', answers };
  return set;
}

export function writeAnswers(root, preset, baseUrl) {
  const file = path.join(root, SET_FILE);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  gs.saveGuideSet(file, answersSet(preset, baseUrl));
  return file;
}

// A tiny valid PNG (1×1, transparent), for images that are "taken".
export const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/** Two guides written by hand, with no guides.json, as an adopt run finds them. */
export function writeHandWritten(root) {
  const help = path.join(root, 'docs', 'help');
  fs.mkdirSync(path.join(help, 'img'), { recursive: true });
  fs.writeFileSync(path.join(help, 'img', 'my-requests.png'), PNG_1X1);
  fs.writeFileSync(path.join(help, 'img', 'inbox.png'), PNG_1X1);
  fs.writeFileSync(
    path.join(help, 'employee.md'),
    `# Leave Planner for employees

Use Leave Planner to ask for time off and see how much you have left.

## Ask for time off

1. Open **My requests** from the navigation.
2. Press **Request leave**.
3. Pick the type of leave and your first and last day, then press **Submit request**.

![My requests: the Request leave button above your requests](img/my-requests.png)

Your manager sees the request in their inbox.
`,
  );
  fs.writeFileSync(
    path.join(help, 'manager.md'),
    `# Leave Planner for managers

## Decide on requests

Open **Inbox**. Each waiting request has **Approve** and **Decline**.

![Inbox: a waiting request with Approve and Decline](img/inbox.png)
`,
  );
  return ['docs/help/employee.md', 'docs/help/manager.md'];
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
/** A real PNG, w × h, its pixels set by `seed` (a stand-in for a screenshot). */
export function png(w, h, seed = 0) {
  const zlib = _zlib;
  const row = w * 3 + 1;
  const raw = Buffer.alloc(row * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.writeUIntBE((((x >> 4) * 16 + seed * 40) & 255) * 65536 + (((y >> 3) * 8) & 255) * 256 + ((seed * 70) & 255), y * row + 1 + x * 3, 3);
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(w, 0);
  head.writeUInt32BE(h, 4);
  head[8] = 8;
  head[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** The frozen guide set (fixtures/leave-app-guides) over a staged copy; its base URL set. */
export function copyFrozenSet(root, baseUrl = 'http://127.0.0.1:9') {
  const from = path.join(PLUGIN, 'fixtures', 'leave-app-guides');
  fs.cpSync(from, root, { recursive: true, filter: (p) => p !== path.join(from, 'README.md') });
  const file = path.join(root, SET_FILE);
  const set = gs.loadGuideSet(file);
  set.app.baseUrl = baseUrl;
  set.interview.answers.appBaseUrl = baseUrl;
  gs.saveGuideSet(file, set);
  return file;
}

/**
 * Every card (or the shots named) swapped for a PNG, as wiki-guides leaves a set once its
 * pictures are taken: the link rewritten, the card deleted, the shot `taken` at `release`.
 */
export function takeAll(root, { release = '1.0', only = null } = {}) {
  const file = path.join(root, SET_FILE);
  const set = gs.loadGuideSet(file);
  set.shots.forEach((shot, n) => {
    if (only && !only.includes(shot.id)) return;
    const svg = shot.path;
    const pngPath = svg.replace(/\.svg$/, '.png');
    fs.writeFileSync(path.join(root, pngPath), png(1280, 160 + 40 * n, n + 1));
    fs.rmSync(path.join(root, svg));
    for (const g of set.guides.filter((g2) => shot.guides.includes(g2.id))) {
      const f = path.join(root, g.file);
      fs.writeFileSync(f, fs.readFileSync(f, 'utf8').split(path.basename(svg)).join(path.basename(pngPath)));
    }
    const fingerprint = 'sha256:' + crypto.createHash('sha256').update(`v1 ${shot.id}`).digest('hex');
    gs.moveShot(set, shot.id, 'taken', { by: 'wiki-guides', path: pngPath, takenAt: '2026-11-01T10:00:00.000Z', release, fingerprint });
  });
  set.publish = { ...set.publish, release };
  gs.saveGuideSet(file, set);
  const readme = path.join(path.dirname(file), 'README.md');
  fs.writeFileSync(readme, gs.updateIndex(fs.readFileSync(readme, 'utf8'), set, path.posix.join(path.posix.dirname(SET_FILE), 'README.md')));
  return set;
}

export function commit(root, message) {
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', message);
}

function main(argv) {
  const [cmd, ...rest] = argv;
  const opt = (name) => {
    const i = rest.indexOf(name);
    return i < 0 ? undefined : rest[i + 1];
  };
  const root = process.cwd();
  if (cmd === 'stage') stageInto(root, opt('--variant') || 'v1');
  else if (cmd === 'answers') writeAnswers(root, rest[0], opt('--base-url'));
  else if (cmd === 'hand-written') writeHandWritten(root);
  else if (cmd === 'guides') {
    copyFrozenSet(root);
    if (rest.includes('--taken')) takeAll(root, { release: opt('--release') || '1.0' });
  }
  else if (cmd === 'commit') commit(root, rest[0] || 'Scaffold');
  else {
    console.error('usage: scaffold.mjs stage|answers <preset>|hand-written|guides [--taken]|commit <message>');
    return 2;
  }
  return 0;
}

// Compare real paths: called through a symlink (macOS's /var → /private/var), argv[1] differs.
if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
