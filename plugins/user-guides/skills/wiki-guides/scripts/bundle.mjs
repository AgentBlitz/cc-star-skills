#!/usr/bin/env node
// bundle.mjs: group the files to upload into batches under 9 MB (PLAN §2.5), so each batch
// reaches the browser in one go.
//
//   node bundle.mjs [--pages .user-guides/out/confluence/pages.json] [--limit 9000000]
//                   [--out <the pages.json folder>/batches.json] [--root .]
//
// Reads the images to-confluence.mjs listed in pages.json (every image is attached to the top
// page), in that order, and writes batches.json: [{ batch, bytes, files: [{ name, path, bytes,
// sha256 }] }]. A batch is kept under the limit by raw size; a single file at or over it is a
// problem (exit 1), as is a listed file that is missing or changed since the conversion.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LIMIT = 9_000_000;

/** Split files [{ name, bytes, … }] into batches under `limit` bytes, in order (first fit). */
export function bundle(files, limit = LIMIT) {
  const problems = [];
  const batches = [];
  let cur = null;
  for (const f of files) {
    if (f.bytes >= limit) {
      problems.push(`${f.path || f.name}: ${f.bytes} bytes, too big for one batch (limit ${limit})`);
      continue;
    }
    if (!cur || cur.bytes + f.bytes >= limit) {
      cur = { batch: batches.length + 1, bytes: 0, files: [] };
      batches.push(cur);
    }
    cur.files.push(f);
    cur.bytes += f.bytes;
  }
  return { batches, problems };
}

function main(argv) {
  const a = { pages: path.join('.user-guides', 'out', 'confluence', 'pages.json'), limit: String(LIMIT), root: '.' };
  for (let i = 0; i < argv.length; i++) {
    const m = argv[i].match(/^--(pages|limit|out|root)(?:=(.*))?$/);
    if (!m) return console.error(`unexpected argument: ${argv[i]}`), 2;
    a[m[1]] = m[2] ?? argv[++i];
  }
  const limit = Number(a.limit);
  if (!(limit > 0)) return console.error('--limit must be a number of bytes'), 2;
  const pagesFile = path.resolve(a.root, a.pages);
  const manifest = JSON.parse(fs.readFileSync(pagesFile, 'utf8'));
  const problems = [];
  const files = [];
  for (const img of manifest.images) {
    const file = path.resolve(a.root, img.path);
    if (!fs.existsSync(file)) {
      problems.push(`${img.path}: missing`);
      continue;
    }
    const buf = fs.readFileSync(file);
    const sha = `sha256:${crypto.createHash('sha256').update(buf).digest('hex')}`;
    if (sha !== img.sha256) problems.push(`${img.path}: changed since the conversion: convert again`);
    files.push({ name: img.name, path: img.path, bytes: buf.length, sha256: sha });
  }
  const res = bundle(files, limit);
  problems.push(...res.problems);
  for (const p of problems) console.error(p);
  if (problems.length) return 1;
  const out = a.out ? path.resolve(a.root, a.out) : path.join(path.dirname(pagesFile), 'batches.json');
  fs.writeFileSync(out, JSON.stringify(res.batches, null, 2) + '\n');
  for (const b of res.batches) console.log(`batch ${b.batch}: ${b.files.length} files, ${b.bytes} bytes`);
  console.log(`${res.batches.length} batch(es) in ${out}`);
  return 0;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) process.exitCode = main(process.argv.slice(2));
