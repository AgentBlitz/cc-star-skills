#!/usr/bin/env node
// to-confluence.mjs: convert a guide set to Confluence storage format (PLAN §2.5).
//
//   node to-confluence.mjs --release <release> [--set docs/user-guides/guides.json]
//        [--out .user-guides/out/confluence] [--top-title <title>] [--guides id,id]
//        [--allow-placeholders] [--escape-unsupported] [--root .]
//
// Run from the repo root. Writes top.xhtml (the page the user names), <guide id>.xhtml and
// pages.json (the page tree, each page's images, and every image to attach to the top page,
// with its size and sha256). Exit 0 when it converted, 1 with the problems (file:line).
//   --release             the release recorded with each page sent (else publish.release)
//   --top-title           the top page's title, for image and page links (else the README's
//                         title, else "<product> user guides")
//   --allow-placeholders  convert even though a placeholder card (an .svg shot) is in place:
//                         only when the user chose to publish the cards as they are
//   --escape-unsupported  show a construct outside the subset as escaped text, rather than
//                         failing: only with the user's go-ahead
//
// The exports (prepare, pageParts, imageInfo) are shared with to-html.mjs.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALERTS, headings, parse, plainText } from './md.mjs';
import { CONFLUENCE_DEFAULTS, INDEX_BEGIN, loadGuideSet } from './guide-set.mjs';

export const DEFAULT_SET = 'docs/user-guides/guides.json';
export const BANNER = (source, release) => [
  'This page is made from ',
  { code: source },
  ` at release ${release}. Change it there and publish again: an edit made here is overwritten by the next publish.`,
];

const posix = path.posix;
const repoRel = (fromFile, target) => posix.normalize(posix.join(posix.dirname(fromFile), decodeURI(target)));
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/** An image's pixel width and height from its header: PNG, JPEG, GIF or SVG. */
export function imageSize(buf, name = '') {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { px: buf.readUInt32BE(16), py: buf.readUInt32BE(20) };
  if (buf.length > 10 && buf.toString('latin1', 0, 3) === 'GIF') return { px: buf.readUInt16LE(6), py: buf.readUInt16LE(8) };
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let k = 2;
    while (k + 9 < buf.length) {
      if (buf[k] !== 0xff) return null;
      const marker = buf[k + 1];
      const len = buf.readUInt16BE(k + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { px: buf.readUInt16BE(k + 7), py: buf.readUInt16BE(k + 5) };
      k += 2 + len;
    }
    return null;
  }
  if (/\.svg$/i.test(name)) {
    const head = buf.toString('utf8', 0, 2000);
    const w = head.match(/<svg[^>]*\swidth="(\d+(?:\.\d+)?)/);
    const h = head.match(/<svg[^>]*\sheight="(\d+(?:\.\d+)?)/);
    const vb = head.match(/<svg[^>]*\sviewBox="[\d.-]+[ ,]+[\d.-]+[ ,]+([\d.]+)[ ,]+([\d.]+)"/);
    if (w) return { px: Number(w[1]), py: h ? Number(h[1]) : null };
    if (vb) return { px: Number(vb[1]), py: Number(vb[2]) };
  }
  return null;
}

/**
 * Read the set and every guide, and check what the converters need: the subset, the images,
 * placeholders. Returns { set, pages, top, images, problems, notes, release, topTitle }.
 *   pages:  [{ id, title, file, parent, order, doc }] in order (doc: md.mjs's parse)
 *   top:    { source, title, intro: blocks, rest: blocks, descriptions: Map(guide id → inlines),
 *             guide: the topGuide's id or null }
 *   images: Map(repo path → { name, path, bytes, sha256, px, py, width, placeholder, shot })
 */
export function prepare({ root = '.', setFile = DEFAULT_SET, release, topTitle, only = null, allowPlaceholders = false, escapeUnsupported = false } = {}) {
  const abs = (p) => path.resolve(root, p);
  const set = loadGuideSet(abs(setFile));
  const problems = [];
  const notes = [];
  const add = (file, line, rule, message) => problems.push({ file, line, rule, message });
  release = release || set.publish.release;
  if (!release) add(setFile, 0, 'release', 'no release given: pass --release (or set publish.release)');
  const conf = { ...CONFLUENCE_DEFAULTS, ...(set.publish.confluence || {}) };

  const chosen = set.guides
    .filter((g) => !only || only.includes(g.id))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  if (only) for (const id of only) if (!set.guides.some((g) => g.id === id)) add(setFile, 0, 'guides', `no guide with id "${id}"`);

  const pages = [];
  for (const g of chosen) {
    if (!fs.existsSync(abs(g.file))) {
      add(g.file, 0, 'file', `guide file missing (guides[${g.id}])`);
      continue;
    }
    const doc = parse(fs.readFileSync(abs(g.file), 'utf8'), { file: g.file, escapeUnsupported });
    for (const e of doc.errors) add(e.file, e.line, 'subset', e.message);
    for (const e of doc.escaped) notes.push(`${e.file}:${e.line}: shown as escaped text: ${e.message}`);
    if (g.status === 'outlined') notes.push(`${g.file}: guide ${g.id} is only outlined`);
    else if (g.status === 'written') notes.push(`${g.file}: guide ${g.id} is written but not checked`);
    const parent = g.parent && chosen.some((x) => x.id === g.parent) ? g.parent : null;
    pages.push({ id: g.id, title: g.title, file: g.file, parent, order: g.order, doc });
  }

  // the top page: topGuide's text, else the README index's intro
  const indexFile = posix.join(posix.dirname(setFile), 'README.md');
  const topGuide = conf.topGuide && pages.find((p) => p.id === conf.topGuide);
  const top = { source: indexFile, title: null, intro: [], rest: [], descriptions: new Map(), guide: null };
  if (fs.existsSync(abs(indexFile))) {
    let text = fs.readFileSync(abs(indexFile), 'utf8');
    const cut = text.indexOf(INDEX_BEGIN);
    if (cut >= 0) text = text.slice(0, cut);
    const doc = parse(text, { file: indexFile, escapeUnsupported: true });
    top.title = doc.title;
    const firstOther = doc.blocks.findIndex((b) => b.type !== 'para' && !(b.type === 'heading' && b.level === 1));
    const intro = doc.blocks.slice(0, firstOther < 0 ? undefined : firstOther).filter((b) => b.type === 'para');
    if (!topGuide) {
      top.intro = intro;
      const extra = doc.blocks.slice(intro.length + (doc.blocks[0]?.type === 'heading' ? 1 : 0)).filter((b) => b.type !== 'list');
      if (extra.length) notes.push(`${indexFile}: only its opening paragraphs open the top page; the rest of it is not published`);
    }
    // a description for each guide: the rest of the README list item that links to it
    for (const b of doc.blocks) {
      if (b.type !== 'list') continue;
      for (const it of b.items) {
        const p = it.blocks[0];
        if (p?.type !== 'para' || p.inlines[0]?.type !== 'link' || EXTERNAL.test(p.inlines[0].href)) continue;
        const target = repoRel(indexFile, p.inlines[0].href.split('#')[0]);
        const g = pages.find((x) => x.file === target);
        if (g) top.descriptions.set(g.id, p.inlines.slice(1));
      }
    }
  } else if (!topGuide) notes.push(`${indexFile}: no README index, so the top page opens with the list of guides`);
  if (topGuide) {
    const blocks = topGuide.doc.blocks.filter((b) => !(b.type === 'heading' && b.level === 1));
    const h = blocks.findIndex((b) => b.type === 'heading');
    top.intro = h < 0 ? blocks : blocks.slice(0, h);
    top.rest = h < 0 ? [] : blocks.slice(h);
    top.source = topGuide.file;
    top.guide = topGuide.id;
  }
  topTitle = topTitle || top.title || `${set.product.name || 'Product'} user guides`;
  top.title = topTitle;

  // images: each must exist in the repo; a placeholder card stops the conversion unless allowed
  const images = new Map();
  const byName = new Map();
  const seeImage = (b, from) => {
    if (EXTERNAL.test(b.src)) return add(from, b.line, 'image', `an image from outside the repo: ${b.src}`);
    const rel = repoRel(from, b.src);
    if (!images.has(rel)) {
      if (!fs.existsSync(abs(rel))) return add(from, b.line, 'image', `image file missing: ${rel}`);
      const buf = fs.readFileSync(abs(rel));
      const name = posix.basename(rel);
      const size = imageSize(buf, name);
      const shot = set.shots.find((s) => s.path === rel) || null;
      const placeholder = /\.svg$/i.test(rel);
      // `width`: the image's size in CSS pixels (capped by imageCap when one is set), for HTML.
      // `fixed`: Confluence gets ac:width only with an imageCap; without one the wiki fits the
      // image to the page column, which it never does for an image with a width (R33).
      const cap = conf.imageCap || Infinity;
      const width = size ? Math.min(cap, Math.round(size.px / (placeholder ? 1 : conf.deviceScale))) : (conf.imageCap || null);
      const fixed = Boolean(conf.imageCap);
      if (!size && fixed) notes.push(`${rel}: size unknown, shown at ${conf.imageCap}px`);
      if (byName.has(name) && byName.get(name) !== rel) add(from, b.line, 'image', `two images share the name ${name} (${byName.get(name)} and ${rel}): every image is attached to the top page, so names must be unique`);
      byName.set(name, rel);
      images.set(rel, { name, path: rel, bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex'), px: size?.px ?? null, py: size?.py ?? null, width, fixed, placeholder, shot: shot?.id ?? null });
    }
    const img = images.get(rel);
    if (img.placeholder && !allowPlaceholders) add(from, b.line, 'placeholder', `a placeholder card is still in place: ${rel}${img.shot ? ` (shot ${img.shot})` : ''}. Take the shot, or pass --allow-placeholders if the user chose to publish the cards as they are`);
    b.ref = rel;
  };
  const walkImages = (blocks, from) => {
    for (const b of blocks) {
      if (b.type === 'image') seeImage(b, from);
      if (b.blocks) walkImages(b.blocks, from);
      if (b.items) for (const it of b.items) walkImages(it.blocks, from);
    }
  };
  for (const p of pages) walkImages(p.doc.blocks, p.file);
  if (!top.guide) walkImages(top.intro, top.source);

  return { set, pages, top, images, problems, notes, release, topTitle, conf, setFile };
}

/**
 * Resolve a link from `fromFile`: { kind: 'anchor', anchor } · { kind: 'external', href } ·
 * { kind: 'guide', id, title, anchor } · { kind: 'top', anchor } · { kind: 'text' } (a file in
 * the repo that is not a page: its text only).
 */
export function resolveLink(prep, href, fromFile) {
  if (EXTERNAL.test(href)) return { kind: 'external', href };
  if (href.startsWith('#')) return { kind: 'anchor', anchor: decodeURIComponent(href.slice(1)) };
  const [file, anchor] = href.split('#');
  const rel = repoRel(fromFile, file);
  const a = anchor === undefined ? undefined : decodeURIComponent(anchor);
  if (rel === fromFile) return { kind: 'anchor', anchor: a };
  const g = prep.pages.find((p) => p.file === rel);
  if (g) return prep.top.guide === g.id ? { kind: 'top', anchor: a } : { kind: 'guide', id: g.id, title: g.title, anchor: a };
  if (rel === posix.join(posix.dirname(prep.setFile), 'README.md')) return { kind: 'top', anchor: a };
  return { kind: 'text' };
}

/** The guides list for the top page: [{ id, title, description (inlines), children }] by parent. */
export function guideTree(prep) {
  const listed = prep.pages.filter((p) => p.id !== prep.top.guide);
  const node = (p) => ({ id: p.id, title: p.title, description: prep.top.descriptions.get(p.id) || [], children: listed.filter((c) => c.parent === p.id).map(node) });
  return listed.filter((p) => !p.parent || p.parent === prep.top.guide).map(node);
}

/**
 * The parts each page is made of: { banner, intro, list, toc, body } (top) or { banner, body }.
 * Only the HTML pages show the banner: a wiki page has none (R34), and its release is recorded in
 * the version message of each update instead.
 */
export function pageParts(prep, page) {
  if (page === 'top') {
    const toc = headings(prep.top.rest).length > 0;
    return { banner: BANNER(prep.top.source, prep.release), intro: prep.top.intro, list: guideTree(prep), toc, body: prep.top.rest, from: prep.top.source };
  }
  return { banner: BANNER(page.file, prep.release), body: page.doc.blocks.filter((b) => !(b.type === 'heading' && b.level === 1)), from: page.file };
}

// ── storage format ──────────────────────────────────────────────────────────────────────

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Confluence Data Center's code macro languages, and the names guides use for them. */
const CODE_LANGS = { actionscript3: 'actionscript3', applescript: 'applescript', bash: 'bash', sh: 'bash', shell: 'bash', zsh: 'bash', console: 'bash', 'c#': 'c#', csharp: 'c#', cs: 'c#', cpp: 'cpp', c: 'cpp', 'c++': 'cpp', css: 'css', coldfusion: 'coldfusion', delphi: 'delphi', diff: 'diff', patch: 'diff', erlang: 'erl', erl: 'erl', groovy: 'groovy', xml: 'xml', html: 'xml', xhtml: 'xml', svg: 'xml', java: 'java', javafx: 'jfx', jfx: 'jfx', javascript: 'js', js: 'js', mjs: 'js', jsx: 'js', json: 'js', typescript: 'js', ts: 'js', tsx: 'js', php: 'php', perl: 'perl', pl: 'perl', powershell: 'powershell', ps1: 'powershell', python: 'py', py: 'py', ruby: 'ruby', rb: 'ruby', sql: 'sql', sass: 'sass', scss: 'sass', scala: 'scala', vb: 'vb', yaml: 'yml', yml: 'yml', text: 'text', txt: 'text', plain: 'text' };
/** GitHub alerts → Confluence macros. */
const ALERT_MACROS = { NOTE: 'info', TIP: 'info', IMPORTANT: 'note', WARNING: 'note', CAUTION: 'warning' };

const macro = (name, params, body) =>
  `<ac:structured-macro ac:name="${name}">${Object.entries(params)
    .map(([k, v]) => `<ac:parameter ac:name="${k}">${esc(v)}</ac:parameter>`)
    .join('')}${body}</ac:structured-macro>`;

function inlineXhtml(nodes, rc) {
  return nodes
    .map((n) => {
      if (n.code !== undefined) return `<code>${esc(n.code)}</code>`;
      if (typeof n === 'string') return esc(n);
      switch (n.type) {
        case 'text':
          return esc(n.text.replace(/\n/g, ' '));
        case 'code':
          return `<code>${esc(n.text)}</code>`;
        case 'strong':
          return `<strong>${inlineXhtml(n.children, rc)}</strong>`;
        case 'em':
          return `<em>${inlineXhtml(n.children, rc)}</em>`;
        case 'link': {
          const body = inlineXhtml(n.children, rc);
          const to = resolveLink(rc.prep, n.href, rc.from);
          const anchor = to.anchor ? ` ac:anchor="${esc(to.anchor)}"` : '';
          if (to.kind === 'external') return `<a href="${esc(to.href)}">${body}</a>`;
          if (to.kind === 'anchor') return to.anchor ? `<ac:link${anchor}><ac:link-body>${body}</ac:link-body></ac:link>` : body;
          if (to.kind === 'guide') return `<ac:link${anchor}><ri:page ri:content-title="${esc(to.title)}" /><ac:link-body>${body}</ac:link-body></ac:link>`;
          if (to.kind === 'top') return rc.isTop ? (to.anchor ? `<ac:link${anchor}><ac:link-body>${body}</ac:link-body></ac:link>` : body) : `<ac:link${anchor}><ri:page ri:content-title="${esc(rc.prep.topTitle)}" /><ac:link-body>${body}</ac:link-body></ac:link>`;
          return body; // a file in the repo that is not a page: its text
        }
        default:
          throw new Error(`unknown inline ${n.type}`);
      }
    })
    .join('');
}

function blocksXhtml(blocks, rc, tight = false) {
  return blocks
    .map((b, k) => {
      switch (b.type) {
        case 'heading':
          return `<h${b.level - 1}>${macro('anchor', { '': b.anchor }, '')}${inlineXhtml(b.inlines, rc)}</h${b.level - 1}>`;
        case 'para':
          return tight && k === 0 ? inlineXhtml(b.inlines, rc) : `<p>${inlineXhtml(b.inlines, rc)}</p>`;
        case 'image': {
          const img = rc.prep.images.get(b.ref);
          const onTop = rc.isTop || rc.ownImages ? '' : `<ri:page ri:content-title="${esc(rc.prep.topTitle)}" />`;
          return `<p><ac:image${img.fixed && img.width ? ` ac:width="${img.width}"` : ''} ac:alt="${esc(b.alt)}" ac:title="${esc(b.alt)}"><ri:attachment ri:filename="${esc(img.name)}">${onTop}</ri:attachment></ac:image></p>`;
        }
        case 'list': {
          const tag = b.ordered ? 'ol' : 'ul';
          const start = b.ordered && b.start !== 1 ? ` start="${b.start}"` : '';
          return `<${tag}${start}>${b.items.map((it) => `<li>${blocksXhtml(it.blocks, rc, !b.loose)}</li>`).join('')}</${tag}>`;
        }
        case 'hr':
          return '<hr />';
        case 'table': {
          const cell = (tag, c, a) => `<${tag}${a ? ` style="text-align: ${a};"` : ''}>${inlineXhtml(c, rc)}</${tag}>`;
          const head = `<tr>${b.head.map((c, x) => cell('th', c, b.align[x])).join('')}</tr>`;
          const rows = b.rows.map((r) => `<tr>${r.map((c, x) => cell('td', c, b.align[x])).join('')}</tr>`).join('');
          return `<table><tbody>${head}${rows}</tbody></table>`;
        }
        case 'code': {
          const lang = CODE_LANGS[b.lang.toLowerCase()] || (b.lang ? (rc.notes.push(`${rc.from}:${b.line}: code language "${b.lang}" is not one Confluence knows, shown as text`), 'text') : null);
          const params = lang ? { language: lang } : {};
          return macro('code', params, `<ac:plain-text-body><![CDATA[${b.text.replace(/]]>/g, ']]]]><![CDATA[>')}]]></ac:plain-text-body>`);
        }
        case 'quote':
          return `<blockquote>${blocksXhtml(b.blocks, rc)}</blockquote>`;
        case 'alert':
          return macro(ALERT_MACROS[b.kind], { title: ALERTS[b.kind] }, `<ac:rich-text-body>${blocksXhtml(b.blocks, rc)}</ac:rich-text-body>`);
        case 'raw':
          return `<p>${b.text.split('\n').map(esc).join('<br />')}</p>`;
        default:
          throw new Error(`unknown block ${b.type}`);
      }
    })
    .join('\n');
}

function listXhtml(tree, rc) {
  if (!tree.length) return '';
  return `<ul>${tree
    .map((g) => `<li><ac:link><ri:page ri:content-title="${esc(g.title)}" /><ac:link-body>${esc(g.title)}</ac:link-body></ac:link>${inlineXhtml(g.description, rc)}${listXhtml(g.children, rc)}</li>`)
    .join('')}</ul>`;
}

/**
 * One page in storage format; `page` is a prepared page or 'top'. With `ownImages`, the page
 * shows images attached to itself, not to the top page (the test page, publish-kit.mjs).
 */
export function pageXhtml(prep, page, notes = [], { ownImages = false } = {}) {
  const parts = pageParts(prep, page);
  const rc = { prep, from: parts.from, isTop: page === 'top', ownImages, notes };
  const out = [];
  if (page === 'top') {
    if (parts.intro.length) out.push(blocksXhtml(parts.intro, rc));
    const list = listXhtml(parts.list, rc);
    if (list) out.push(list);
    if (parts.toc) out.push(macro('panel', { title: 'On this page' }, `<ac:rich-text-body>${macro('toc', { maxLevel: '2' }, '')}</ac:rich-text-body>`));
  }
  if (parts.body.length) out.push(blocksXhtml(parts.body, rc));
  return out.join('\n') + '\n';
}

/** Images a page shows, by attachment name, sorted. */
function imagesOf(prep, blocks) {
  const names = new Set();
  const walk = (bs) => {
    for (const b of bs) {
      if (b.type === 'image' && b.ref) names.add(prep.images.get(b.ref).name);
      if (b.blocks) walk(b.blocks);
      if (b.items) for (const it of b.items) walk(it.blocks);
    }
  };
  walk(blocks);
  return [...names].sort();
}

/** Convert and write; returns { problems, notes, written, manifest }. */
export function convert(opts) {
  const prep = prepare(opts);
  const { problems, notes } = prep;
  if (problems.length) return { problems, notes, written: [] };
  const out = path.resolve(opts.root || '.', opts.out || path.join('.user-guides', 'out', 'confluence'));
  fs.mkdirSync(out, { recursive: true });
  const written = [];
  const write = (name, text) => {
    fs.writeFileSync(path.join(out, name), text);
    written.push(name);
  };
  write('top.xhtml', pageXhtml(prep, 'top', notes));
  for (const p of prep.pages) if (p.id !== prep.top.guide) write(`${p.id}.xhtml`, pageXhtml(prep, p, notes));
  const manifest = {
    release: prep.release,
    setFile: prep.setFile,
    top: { title: prep.topTitle, file: 'top.xhtml', source: prep.top.source, guide: prep.top.guide, images: imagesOf(prep, [...prep.top.intro, ...prep.top.rest]) },
    pages: prep.pages
      .filter((p) => p.id !== prep.top.guide)
      .map((p) => ({ id: p.id, title: p.title, file: `${p.id}.xhtml`, source: p.file, parent: p.parent === prep.top.guide ? null : p.parent, order: p.order, images: imagesOf(prep, p.doc.blocks) })),
    images: [...prep.images.values()].sort((a, b) => a.name.localeCompare(b.name)).map(({ name, path: p, bytes, sha256, px, width, placeholder, shot }) => ({ name, path: p, bytes, sha256: `sha256:${sha256}`, px, width, placeholder, shot })),
  };
  write('pages.json', JSON.stringify(manifest, null, 2) + '\n');
  return { problems, notes, written, manifest, out };
}

export function parseArgs(argv, extra = []) {
  const a = { set: DEFAULT_SET, root: '.' };
  const flags = ['allow-placeholders', 'escape-unsupported', ...extra.filter((x) => !x.endsWith('='))];
  const values = ['release', 'set', 'out', 'top-title', 'guides', 'root', ...extra.filter((x) => x.endsWith('=')).map((x) => x.slice(0, -1))];
  for (let i = 0; i < argv.length; i++) {
    const m = argv[i].match(/^--([a-z-]+)(?:=(.*))?$/);
    if (!m) throw new Error(`unexpected argument: ${argv[i]}`);
    if (flags.includes(m[1])) a[m[1]] = true;
    else if (values.includes(m[1])) a[m[1]] = m[2] ?? argv[++i];
    else throw new Error(`unknown option --${m[1]}`);
  }
  return a;
}

export function report({ problems, notes, written, out }, what) {
  for (const p of problems) console.error(`${p.file}:${p.line}: ${p.rule}: ${p.message}`);
  for (const n of notes) console.log(`note: ${n}`);
  if (problems.length) {
    console.error(`${problems.length} problem(s): nothing was written`);
    return 1;
  }
  console.log(`${what}: ${written.length} files in ${out}`);
  return 0;
}

function main(argv) {
  let a;
  try {
    a = parseArgs(argv);
  } catch (e) {
    console.error(e.message);
    return 2;
  }
  const res = convert({
    root: a.root,
    setFile: a.set,
    release: a.release,
    topTitle: a['top-title'],
    only: a.guides ? a.guides.split(',') : null,
    out: a.out,
    allowPlaceholders: !!a['allow-placeholders'],
    escapeUnsupported: !!a['escape-unsupported'],
  });
  return report(res, 'storage format');
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) process.exitCode = main(process.argv.slice(2));
