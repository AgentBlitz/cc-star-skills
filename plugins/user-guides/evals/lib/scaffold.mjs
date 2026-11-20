#!/usr/bin/env node
// Eval scaffolding (PLAN R13, R16): every case stages the Leave Planner fixture through
// test/stage.mjs and then lays out what the case starts from. Run as the operator, in the run's
// workspace (an eval-format `scaffold_script`, or the scripted runner), never in this repo.
//
//   node scaffold.mjs stage   [--variant v1|v2]             stage the fixture into the cwd
//   node scaffold.mjs answers <preset> [--base-url <url>]    write docs/user-guides/guides.json
//   node scaffold.mjs hand-written                          add guides written by hand (adopt)
//   node scaffold.mjs commit  <message>                      commit what the scaffold added
//
// Presets: `walk` (every answer, the local app, every task), `code` (every answer, facts from the
// code, the main tasks only),
// `nonlocal` (every answer, a base URL that is not local). Round 3 is recorded as
// "approve as proposed" in all three (R9).

import fs from 'node:fs';
import os from 'node:os';
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
  set.interview = { wordingVersion: '1', answers };
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
  else if (cmd === 'commit') commit(root, rest[0] || 'Scaffold');
  else {
    console.error('usage: scaffold.mjs stage|answers <preset>|hand-written|commit <message>');
    return 2;
  }
  return 0;
}

// Compare real paths: called through a symlink (macOS's /var → /private/var), argv[1] differs.
if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
