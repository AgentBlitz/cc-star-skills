#!/usr/bin/env node
// swap-shots.mjs: put the shots a project's shots.mjs took into its guides (wiki-guides step 4,
// PLAN D3 and R7). For each shot still to take (placeholder, retake or blocked) that the
// latest shots run took (.user-guides/out/shots.json):
//   - write images/<id>.png beside its card, from .user-guides/out/shots/<id>.png;
//   - rewrite every guide's link to the card (images/<id>.svg) to the PNG, and delete the card;
//   - set the shot `taken`, with takenAt (when shots.mjs took it), the release and the
//     region's fingerprint (from the manifest);
//   - regenerate the README index's status block.
// A shot the run failed to take is set `blocked`, with the reason. A taken shot is never
// touched: if its region changed, write-guides' refresh marks it `retake` first (D5).
//
//   node swap-shots.mjs [--set docs/user-guides/guides.json] [--release <name>] [--only a,b]
//                       [--needs-text <id>=<what is wrong>]… [--dry-run] [--json]
//
// The release defaults to guides.json's publish.release. Run from the project root.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGuideSet, saveGuideSet, moveShot, updateIndex } from './guide-set.mjs';

export const DEFAULT_SET = 'docs/user-guides/guides.json';
export const MANIFEST = '.user-guides/out/shots.json';
const TO_TAKE = new Set(['placeholder', 'retake', 'blocked']);
const IMAGE_RE = /(!\[(?:\\.|[^\]\\])*\]\(\s*<?)([^)\s>]+)(>?(?:\s+"[^"]*")?\s*\))/g;

const posix = (p) => p.split(path.sep).join('/');

/** Rewrite a guide's image links that point at `from` (repo-relative) to `to`. Returns { text, count }. */
export function rewriteLinks(text, guideFile, from, to) {
  const dir = path.posix.dirname(guideFile);
  let count = 0;
  const out = text.replace(IMAGE_RE, (all, pre, src, post) => {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(src)) return all;
    const clean = decodeURI(src.split('#')[0].split('?')[0]);
    if (path.posix.normalize(path.posix.join(dir, clean)) !== from) return all;
    count++;
    return pre + path.posix.relative(dir, to) + post;
  });
  return { text: out, count };
}

/**
 * Work out, and unless `dryRun` apply, the swaps. Returns rows { id, action, … }:
 * swapped (placeholder → taken), retaken (retake → taken), unblocked (blocked → taken),
 * blocked, needs-text, skipped (with why), changed (taken, but the run saw a new fingerprint).
 */
export function swapShots({ root = '.', setFile = DEFAULT_SET, release, only = null, needsText = {}, dryRun = false } = {}) {
  const setPath = path.resolve(root, setFile);
  const set = loadGuideSet(setPath);
  const rel = release || set.publish?.release;
  const mfile = path.resolve(root, MANIFEST);
  const manifest = fs.existsSync(mfile) ? JSON.parse(fs.readFileSync(mfile, 'utf8')).shots || {} : {};
  const rows = [];
  const writes = []; // [file, content | null (delete) | { copyFrom }]
  const guideTexts = new Map(set.guides.map((g) => [g.file, fs.existsSync(path.resolve(root, g.file)) ? fs.readFileSync(path.resolve(root, g.file), 'utf8') : null]));

  for (const shot of set.shots) {
    if (only && !only.includes(shot.id)) continue;
    const m = manifest[shot.id];
    if (needsText[shot.id] !== undefined) {
      if (!['placeholder', 'retake'].includes(shot.status)) {
        rows.push({ id: shot.id, action: 'skipped', why: `is ${shot.status}; only a placeholder or a retake can need text` });
        continue;
      }
      moveShot(set, shot.id, 'needs-text', { by: 'wiki-guides', note: needsText[shot.id] });
      rows.push({ id: shot.id, action: 'needs-text', note: needsText[shot.id] });
      continue;
    }
    if (shot.status === 'taken') {
      if (m && !m.error && m.fingerprint && shot.fingerprint && m.fingerprint !== shot.fingerprint && m.takenAt > (shot.takenAt || ''))
        rows.push({ id: shot.id, action: 'changed', why: "the latest run saw its region change: run write-guides' refresh, which marks it retake" });
      continue;
    }
    if (!TO_TAKE.has(shot.status)) {
      rows.push({ id: shot.id, action: 'skipped', why: `is ${shot.status}` });
      continue;
    }
    if (!m) {
      rows.push({ id: shot.id, action: 'skipped', why: 'not taken yet: run shots.mjs' });
      continue;
    }
    if (shot.takenAt && !(m.takenAt > shot.takenAt)) {
      rows.push({ id: shot.id, action: 'skipped', why: `not taken again since ${shot.takenAt}: run shots.mjs ${shot.id}` });
      continue;
    }
    if (m.error) {
      if (shot.status === 'blocked' && shot.note === m.error) {
        rows.push({ id: shot.id, action: 'skipped', why: `still blocked: ${m.error}` });
        continue;
      }
      moveShot(set, shot.id, 'blocked', { by: 'wiki-guides', note: m.error });
      rows.push({ id: shot.id, action: 'blocked', note: m.error });
      continue;
    }
    const src = path.resolve(root, m.file);
    if (!fs.existsSync(src)) {
      rows.push({ id: shot.id, action: 'skipped', why: `the run's image is missing: ${m.file}` });
      continue;
    }
    if (!rel) throw new Error('name the release the pictures show: --release <name>, or set publish.release in guides.json');
    const from = shot.path;
    const png = from.replace(/\.svg$/i, '.png');
    writes.push([png, { copyFrom: src }]);
    let links = 0;
    if (from !== png) {
      for (const [file, text] of guideTexts) {
        if (text === null) continue;
        const r = rewriteLinks(text, file, from, png);
        if (r.count) {
          guideTexts.set(file, r.text);
          links += r.count;
          writes.push([file, () => guideTexts.get(file)]);
        }
      }
      if (fs.existsSync(path.resolve(root, from))) writes.push([from, null]);
    }
    const was = shot.status;
    moveShot(set, shot.id, 'taken', { by: 'wiki-guides', path: png, takenAt: m.takenAt, release: rel, fingerprint: m.fingerprint });
    rows.push({ id: shot.id, action: { placeholder: 'swapped', retake: 'retaken', blocked: 'unblocked' }[was], path: png, links, fingerprint: m.fingerprint });
  }

  if (!dryRun) {
    const done = new Set();
    for (const [file, what] of writes) {
      const abs = path.resolve(root, file);
      if (what === null) fs.rmSync(abs, { force: true });
      else if (typeof what === 'function') {
        if (done.has(file)) continue;
        done.add(file);
        fs.writeFileSync(abs, what());
      } else {
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.copyFileSync(what.copyFrom, abs);
      }
    }
    saveGuideSet(setPath, set);
    const readme = path.posix.join(path.posix.dirname(posix(setFile)), 'README.md');
    const rf = path.resolve(root, readme);
    if (fs.existsSync(rf)) {
      const text = fs.readFileSync(rf, 'utf8');
      const next = updateIndex(text, set, readme);
      if (next !== text) fs.writeFileSync(rf, next);
    }
  }
  return rows;
}

function parseArgs(argv) {
  const a = { set: DEFAULT_SET, release: undefined, only: null, needsText: {}, dryRun: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--set') a.set = argv[++i];
    else if (x === '--release') a.release = argv[++i];
    else if (x === '--only') a.only = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (x === '--needs-text') {
      const v = argv[++i] || '';
      const eq = v.indexOf('=');
      if (eq < 1) throw new Error('--needs-text <id>=<what is wrong>');
      a.needsText[v.slice(0, eq)] = v.slice(eq + 1).trim() || 'the text does not match the screen';
    } else if (x === '--dry-run') a.dryRun = true;
    else if (x === '--json') a.json = true;
    else throw new Error(`unexpected argument: ${x}`);
  }
  return a;
}

function main(argv) {
  const a = parseArgs(argv);
  const rows = swapShots({ setFile: a.set, release: a.release, only: a.only, needsText: a.needsText, dryRun: a.dryRun });
  if (a.json) console.log(JSON.stringify(rows, null, 2));
  else {
    for (const r of rows) {
      if (['swapped', 'retaken', 'unblocked'].includes(r.action)) console.log(`${r.action} ${r.id}: ${r.path}${r.links ? ` (${r.links} link${r.links > 1 ? 's' : ''} rewritten)` : ''}`);
      else if (r.action === 'blocked' || r.action === 'needs-text') console.log(`${r.action} ${r.id}: ${r.note}`);
      else console.log(`${r.action} ${r.id}: ${r.why}`);
    }
    const n = rows.filter((r) => ['swapped', 'retaken', 'unblocked'].includes(r.action)).length;
    console.log(`${a.dryRun ? 'would take' : 'taken'}: ${n} shot(s)${a.dryRun ? ' (dry run: nothing written)' : ''}`);
  }
  return rows.some((r) => r.action === 'blocked') ? 1 : 0;
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (err) {
    console.error(`swap-shots: ${err.message}`);
    process.exitCode = 2;
  }
}
