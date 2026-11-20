#!/usr/bin/env node
// publish-node.mjs: run publish-core.js in Node, against a local mock wiki only. A real wiki is
// reached through the user's signed-in browser (reference/chrome-publishing.md), never from
// here: this script refuses any host but localhost, and holds no token or password.
//
//   node publish-node.mjs <detect|plan|test|remove-test|publish> --base http://127.0.0.1:<port>[/context]
//        [--input .user-guides/out/confluence/publish.json] [--root .] [--report <file>]
//        [--confirm-adopted] [--confirm-edited <page id>=<version>,…] [--page-id <id>]
//
//   detect       the wiki's flavour (Data Center, Cloud, unknown)
//   plan         what a publish would do, and what the user must confirm first
//   test         write only the test page, under the top page
//   remove-test  move the test page to the trash (--page-id from the test report)
//   publish      attach the images, then write the pages; the report goes to --report
//                (default: report.json beside the input), for publish-kit.mjs record
//
// Prints the report as JSON. Exit 0 when it is ok, 1 when not (refused, needs a confirmation,
// a stop), 2 on a usage error.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CORE = path.join(HERE, 'publish-core.js');
const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Is this URL on this machine? Anything else is refused. */
export function isLocal(url) {
  try {
    const u = new URL(url);
    return (u.protocol === 'http:' || u.protocol === 'https:') && LOCAL.has(u.hostname) && !u.username && !u.password;
  } catch {
    return false;
  }
}

/**
 * Evaluate publish-core.js as the browser would (the whole text, as a script) and point it at a
 * local base URL. `files` is a list of { name, path }, read when the publisher asks.
 */
export function loadCore({ base, files = [] }) {
  if (!isLocal(base)) throw new Error(`publish-node.mjs talks only to a wiki on localhost (a mock), not ${safeHost(base)}. A real wiki is published through the user's signed-in browser: see reference/chrome-publishing.md.`);
  const u = new URL(base);
  const ready = vm.runInThisContext(fs.readFileSync(CORE, 'utf8'), { filename: CORE });
  const api = globalThis.userGuides;
  const guarded = (url, init) => {
    if (!isLocal(url)) throw new Error('refused: a request to a host that is not this machine');
    return fetch(url, { ...init, redirect: 'error' });
  };
  api.configure({
    origin: u.origin,
    contextPath: u.pathname.replace(/\/+$/, ''),
    fetch: guarded,
    files: async () => files.filter((f) => fs.existsSync(f.path)).map((f) => new File([fs.readFileSync(f.path)], f.name)),
  });
  return { api, ready };
}

function safeHost(base) {
  try {
    return new URL(base).hostname;
  } catch {
    return 'that address';
  }
}

async function main(argv) {
  const [cmd, ...rest] = argv;
  const commands = ['detect', 'plan', 'test', 'remove-test', 'publish'];
  if (!commands.includes(cmd)) return console.error(`usage: publish-node.mjs <${commands.join('|')}> --base http://127.0.0.1:<port> [options] (see the head of this file)`), 2;
  const a = { root: '.', input: path.join('.user-guides', 'out', 'confluence', 'publish.json') };
  for (let i = 0; i < rest.length; i++) {
    const m = rest[i].match(/^--(base|input|root|report|confirm-adopted|confirm-edited|page-id)(?:=(.*))?$/);
    if (!m) return console.error(`unexpected argument: ${rest[i]}`), 2;
    a[m[1]] = m[1] === 'confirm-adopted' ? true : (m[2] ?? rest[++i]);
  }
  if (!a.base) return console.error('give --base, the mock wiki’s address (it prints it when it starts)'), 2;
  if (!isLocal(a.base)) return console.error(`refused: publish-node.mjs talks only to a wiki on localhost (a mock), not ${safeHost(a.base)}. A real wiki is published through the user's signed-in browser: see reference/chrome-publishing.md.`), 2;
  const confirm = { adopted: a['confirm-adopted'] === true, edited: {} };
  for (const pair of (a['confirm-edited'] || '').split(',').filter(Boolean)) {
    const m = /^(\d+)=(\d+)$/.exec(pair);
    if (!m) return console.error(`--confirm-edited takes <page id>=<version>, not ${pair}`), 2;
    confirm.edited[m[1]] = Number(m[2]);
  }

  const inputFile = path.resolve(a.root, a.input);
  const files = [];
  if (cmd !== 'detect') {
    if (!fs.existsSync(inputFile)) return console.error(`${a.input}: missing. Make it with publish-kit.mjs input`), 2;
    const input = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    files.push({ name: 'publish.json', path: inputFile });
    for (const img of [...input.images, ...(input.test?.images || [])]) files.push({ name: img.name, path: path.resolve(a.root, img.path) });
  }
  const { api } = loadCore({ base: a.base, files });
  const say = (report) => {
    console.log(JSON.stringify(report, null, 2));
    return report.ok ? 0 : 1;
  };

  const found = await api.detect();
  if (cmd === 'detect' || !found.ok) return say(found);
  const loaded = await api.load();
  if (!loaded.ok) return say(loaded);
  if (cmd === 'plan') return say(await api.plan());
  if (cmd === 'test') return say(await api.test());
  if (cmd === 'remove-test') return a['page-id'] ? say(await api.removeTest(a['page-id'])) : (console.error('remove-test: give --page-id from the test report'), 2);

  const images = await api.attach({ confirm });
  if (!images.ok && images.problem) return say(images);
  const report = await api.publish({ confirm });
  report.images = { attached: images.attached, replaced: images.replaced, unchanged: images.unchanged, held: images.held, waiting: images.waiting, failed: images.failed };
  const reportFile = path.resolve(a.root, a.report || path.join(path.dirname(a.input), 'report.json'));
  if (report.release) fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
  return say(report);
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) process.exitCode = await main(process.argv.slice(2));
