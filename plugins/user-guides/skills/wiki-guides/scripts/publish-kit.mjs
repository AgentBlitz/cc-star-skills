#!/usr/bin/env node
// publish-kit.mjs: the publisher's paperwork. It never talks to a wiki.
//
//   node publish-kit.mjs target --top-page <page id> [--base-url <url>] [--space <KEY>]
//                               [--top-guide <guide id>] [--image-cap <px>] [--set <guides.json>]
//       record where the guides are published: the page the user named (it becomes the top page)
//   node publish-kit.mjs input  [--pages .user-guides/out/confluence/pages.json] [--set …]
//       make publish.json, the one file the publisher reads: every page's storage format and
//       hash, the versions last published, the images, and the test page with its picture
//   node publish-kit.mjs record --report <report.json> [--base-url <url>] [--set …]
//       after a publish: write each page's id and version into publish.confluence.pages
//
// Run from the project root (or pass --root). Exit 0 done, 1 a problem, 2 a usage error.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from './md.mjs';
import { CONFLUENCE_DEFAULTS, loadGuideSet, saveGuideSet } from './guide-set.mjs';
import { DEFAULT_SET, imageSize, pageXhtml } from './to-confluence.mjs';

const TEMPLATES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'templates');
export const OUT = path.join('.user-guides', 'out', 'confluence');
const sha = (x) => crypto.createHash('sha256').update(x).digest('hex');
/** A page's hash covers its title and its storage format: either changing is a change. */
export const pageHash = (title, body) => sha(`${title}\n${body}`);
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/** The test page: the template with every construct, its picture attached to the page itself. */
export function testPage({ release, topTitle, imageCap, deviceScale }) {
  const doc = parse(fs.readFileSync(path.join(TEMPLATES, 'test-page.md'), 'utf8'), { file: 'test-page.md' });
  if (doc.errors.length) throw new Error(`the test page template is outside the subset: ${doc.errors[0].message}`);
  const png = fs.readFileSync(path.join(TEMPLATES, 'test-page.png'));
  const size = imageSize(png, 'test-page.png');
  const mark = (blocks) => {
    for (const b of blocks) {
      if (b.type === 'image') b.ref = 'test-page.png';
      if (b.blocks) mark(b.blocks);
      if (b.items) for (const it of b.items) mark(it.blocks);
    }
  };
  mark(doc.blocks);
  const page = { id: 'test-page', title: `${topTitle}: publishing test`, file: 'test-page.md', parent: null, order: 0, doc };
  const images = new Map([['test-page.png', { name: 'test-page.png', width: Math.min(imageCap, Math.round(size.px / deviceScale)) }]]);
  const prep = { pages: [page], top: { guide: null }, images, release, topTitle, setFile: 'guides.json' };
  const body = pageXhtml(prep, page, [], { ownImages: true });
  return { title: page.title, body, hash: pageHash(page.title, body), png };
}

/** Parents before their children, otherwise in guide order. */
function parentsFirst(pages) {
  const left = [...pages].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const out = [];
  const done = new Set();
  while (left.length) {
    const k = left.findIndex((p) => !p.parent || done.has(p.parent) || !pages.some((x) => x.id === p.parent));
    const [p] = left.splice(Math.max(k, 0), 1);
    out.push(p);
    done.add(p.id);
  }
  return out;
}

export function makeInput({ root = '.', pagesFile = path.join(OUT, 'pages.json'), setFile } = {}) {
  const abs = (p) => path.resolve(root, p);
  const problems = [];
  if (!fs.existsSync(abs(pagesFile))) return { problems: [`${pagesFile}: missing. Convert first (to-confluence.mjs)`] };
  const manifest = readJson(abs(pagesFile));
  const outDir = path.dirname(pagesFile);
  const set = loadGuideSet(abs(setFile || manifest.setFile || DEFAULT_SET));
  const conf = { ...CONFLUENCE_DEFAULTS, ...(set.publish.confluence || {}) };
  if (!conf.topPageId) problems.push('no page to publish under: record the page the user named with publish-kit.mjs target --top-page <page id>');
  const lastFile = abs(path.join(outDir, 'last-publish.json'));
  const last = fs.existsSync(lastFile) ? readJson(lastFile) : { pages: {} };
  const recorded = conf.pages || {};
  const read = (file) => {
    const f = abs(path.join(outDir, file));
    if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
    problems.push(`${path.join(outDir, file)}: missing. Convert again`);
    return '';
  };
  const topBody = read(manifest.top.file);
  const top = { title: manifest.top.title, guide: manifest.top.guide, body: topBody, hash: pageHash(manifest.top.title, topBody), version: (manifest.top.guide && recorded[manifest.top.guide]?.version) || null, sent: last.top || null };
  const pages = parentsFirst(manifest.pages).map((p) => {
    const body = read(p.file);
    return { id: p.id, title: p.title, parent: p.parent, body, hash: pageHash(p.title, body), pageId: recorded[p.id]?.pageId ?? null, version: recorded[p.id]?.version ?? null, sent: last.pages[p.id] || null };
  });
  const images = manifest.images.map(({ name, path: p, bytes, sha256 }) => ({ name, path: p, bytes, sha256 }));
  const cards = manifest.images.filter((i) => i.placeholder).length;
  if (problems.length) return { problems };

  const t = testPage({ release: manifest.release, topTitle: top.title, imageCap: conf.imageCap, deviceScale: conf.deviceScale });
  const pngFile = path.join(outDir, 'test-page.png');
  fs.writeFileSync(abs(pngFile), t.png);
  let contextPath = null;
  if (conf.baseUrl) contextPath = new URL(conf.baseUrl).pathname.replace(/\/+$/, '');
  const input = {
    tool: 'user-guides',
    format: 1,
    release: manifest.release,
    space: conf.space || null,
    contextPath,
    topPageId: String(conf.topPageId),
    top,
    pages,
    images,
    test: { title: t.title, body: t.body, hash: t.hash, images: [{ name: 'test-page.png', path: pngFile.split(path.sep).join('/'), bytes: t.png.length, sha256: `sha256:${sha(t.png)}` }] },
  };
  const file = path.join(outDir, 'publish.json');
  fs.writeFileSync(abs(file), JSON.stringify(input, null, 1) + '\n');
  return { problems, input, file, pngFile, cards };
}

export function record({ root = '.', reportFile, setFile = DEFAULT_SET, baseUrl, outDir = OUT } = {}) {
  const abs = (p) => path.resolve(root, p);
  const report = readJson(abs(reportFile));
  if (!report.release || !report.space || !Array.isArray(report.pages)) return { problems: [`${reportFile}: not a publish report (a refusal, a plan or a test-page report records nothing)`] };
  const set = loadGuideSet(abs(setFile));
  const conf = (set.publish.confluence ??= {});
  conf.space = report.space;
  if (baseUrl) conf.baseUrl = baseUrl;
  conf.pages ??= {};
  const lastFile = abs(path.join(outDir, 'last-publish.json'));
  const last = fs.existsSync(lastFile) ? readJson(lastFile) : { pages: {} };
  const keep = ({ pageId, version, hash }) => ({ pageId: String(pageId), version, hash });
  const rows = [];
  if (report.top) {
    conf.topPageId = String(report.top.pageId);
    last.top = keep(report.top);
    if (report.top.guide) conf.pages[report.top.guide] = { pageId: String(report.top.pageId), version: report.top.version };
    rows.push(`top page: ${report.top.action}, version ${report.top.version}`);
  }
  for (const p of report.pages) {
    conf.pages[p.id] = { pageId: String(p.pageId), version: p.version };
    last.pages[p.id] = keep(p);
    rows.push(`${p.id}: ${p.action}, version ${p.version}`);
  }
  set.publish.release = report.release;
  saveGuideSet(abs(setFile), set);
  fs.mkdirSync(path.dirname(lastFile), { recursive: true });
  fs.writeFileSync(lastFile, JSON.stringify(last, null, 2) + '\n');
  return { problems: [], rows, partial: report.ok === false };
}

export function target({ root = '.', setFile = DEFAULT_SET, topPage, baseUrl, space, topGuide, imageCap } = {}) {
  const file = path.resolve(root, setFile);
  const set = loadGuideSet(file);
  const conf = (set.publish.confluence ??= {});
  if (topPage) {
    if (conf.topPageId && String(conf.topPageId) !== String(topPage) && Object.keys(conf.pages || {}).length) return { problems: [`the guides are recorded under page ${conf.topPageId}: publishing under another page would make every page again there. Remove publish.confluence.pages first if that is what the user wants`] };
    conf.topPageId = String(topPage);
  }
  if (baseUrl) conf.baseUrl = baseUrl;
  if (space) conf.space = space;
  if (topGuide) conf.topGuide = topGuide;
  if (imageCap) conf.imageCap = Number(imageCap);
  saveGuideSet(file, set);
  return { problems: [], conf };
}

function main(argv) {
  const [cmd, ...rest] = argv;
  const a = { root: '.' };
  const known = { target: ['top-page', 'base-url', 'space', 'top-guide', 'image-cap', 'set', 'root'], input: ['pages', 'set', 'root'], record: ['report', 'base-url', 'set', 'root', 'out'] }[cmd];
  if (!known) return console.error('usage: publish-kit.mjs target|input|record [options] (see the head of this file)'), 2;
  for (let i = 0; i < rest.length; i++) {
    const m = rest[i].match(/^--([a-z-]+)(?:=(.*))?$/);
    if (!m || !known.includes(m[1])) return console.error(`unexpected argument: ${rest[i]}`), 2;
    a[m[1]] = m[2] ?? rest[++i];
  }
  let res;
  try {
    if (cmd === 'target') {
      if (!a['top-page'] && !a['base-url'] && !a.space && !a['top-guide'] && !a['image-cap']) return console.error('target: give at least --top-page'), 2;
      res = target({ root: a.root, setFile: a.set, topPage: a['top-page'], baseUrl: a['base-url'], space: a.space, topGuide: a['top-guide'], imageCap: a['image-cap'] });
      if (!res.problems.length) console.log(`recorded: top page ${res.conf.topPageId ?? '(none yet)'}${res.conf.space ? `, space ${res.conf.space}` : ''}${res.conf.topGuide ? `, opened by guide ${res.conf.topGuide}` : ''}`);
    } else if (cmd === 'input') {
      res = makeInput({ root: a.root, pagesFile: a.pages, setFile: a.set });
      if (!res.problems.length) {
        console.log(`${res.file}: release ${res.input.release}, the top page and ${res.input.pages.length} guide page(s), ${res.input.images.length} image(s)`);
        if (res.cards) console.log(`note: ${res.cards} placeholder card(s) will be published as they are`);
        console.log(`the test page's picture: ${res.pngFile}`);
      }
    } else {
      if (!a.report) return console.error('record: give --report <report.json>'), 2;
      res = record({ root: a.root, reportFile: a.report, setFile: a.set, baseUrl: a['base-url'], outDir: a.out });
      for (const r of res.rows || []) console.log(r);
      if (!res.problems.length) console.log(res.partial ? 'recorded what was published: the publish stopped part-way' : 'recorded in guides.json (publish.confluence)');
    }
  } catch (err) {
    console.error(err.message);
    for (const e of err.errors || []) console.error(`  ${e}`);
    return 1;
  }
  for (const p of res.problems) console.error(p);
  return res.problems.length ? 1 : 0;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) process.exitCode = main(process.argv.slice(2));
