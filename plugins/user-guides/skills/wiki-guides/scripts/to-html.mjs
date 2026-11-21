#!/usr/bin/env node
// to-html.mjs: convert a guide set to self-contained HTML pages (PLAN §2.5).
//
//   node to-html.mjs --release <release> [--set docs/user-guides/guides.json]
//        [--out <publish.html.outDir, else .user-guides/out/html>] [--top-title <title>]
//        [--guides id,id] [--allow-placeholders] [--escape-unsupported] [--root .]
//
// Run from the repo root. Writes index.html (the top page: the README's intro or topGuide, then
// the guides) and <guide id>.html. Each page holds its own styles and its images as data URIs,
// so a page opens anywhere on its own; links between guides point to the sibling files. The
// markup is XHTML-clean (every element closed), so an XML parser reads it too. The options
// are to-confluence.mjs's; exit 0 when it converted, 1 with the problems (file:line).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALERTS } from './md.mjs';
import { esc, pageParts, parseArgs, prepare, report, resolveLink } from './to-confluence.mjs';

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp' };

export const CSS = `
body { margin: 0; font: 16px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1f2328; background: #fff; }
main { max-width: 52rem; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
h1, h2, h3, h4, h5, h6 { line-height: 1.25; margin: 1.6em 0 0.6em; }
h1 { font-size: 2rem; margin-top: 0.5em; }
a { color: #0969da; }
code { font: 0.9em ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: #f3f4f6; padding: 0.1em 0.3em; border-radius: 4px; }
pre { background: #f6f8fa; padding: 0.9rem 1rem; overflow: auto; border-radius: 6px; }
pre code { background: none; padding: 0; }
img { max-width: 100%; height: auto; border: 1px solid #d0d7de; border-radius: 6px; }
table { border-collapse: collapse; margin: 1rem 0; }
th, td { border: 1px solid #d0d7de; padding: 0.4rem 0.7rem; vertical-align: top; }
th { background: #f6f8fa; }
blockquote { margin: 1rem 0; padding: 0 1rem; color: #59636e; border-left: 4px solid #d0d7de; }
hr { border: 0; border-top: 1px solid #d0d7de; margin: 2rem 0; }
.banner { font-size: 0.9rem; color: #59636e; background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; padding: 0.6rem 0.9rem; }
.alert { margin: 1rem 0; padding: 0.5rem 1rem; border-left: 4px solid; border-radius: 4px; }
.alert-title { font-weight: 600; margin: 0.4rem 0; }
.alert-note { border-color: #0969da; background: #f0f6ff; }
.alert-tip { border-color: #1a7f37; background: #effaf2; }
.alert-important { border-color: #8250df; background: #f6f2ff; }
.alert-warning { border-color: #9a6700; background: #fff8e6; }
.alert-caution { border-color: #cf222e; background: #fff0f0; }
nav.guides ul { padding-left: 1.2rem; }
`.trim();

const fileOf = (id) => `${id}.html`;
const hrefTo = (file, anchor) => (anchor ? `${file}#${encodeURIComponent(anchor)}` : file);

function inlineHtml(nodes, rc) {
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
          return `<strong>${inlineHtml(n.children, rc)}</strong>`;
        case 'em':
          return `<em>${inlineHtml(n.children, rc)}</em>`;
        case 'link': {
          const body = inlineHtml(n.children, rc);
          const to = resolveLink(rc.prep, n.href, rc.from);
          if (to.kind === 'external') return `<a href="${esc(to.href)}">${body}</a>`;
          if (to.kind === 'anchor') return to.anchor ? `<a href="#${esc(encodeURIComponent(to.anchor))}">${body}</a>` : body;
          if (to.kind === 'guide') return `<a href="${esc(hrefTo(fileOf(to.id), to.anchor))}">${body}</a>`;
          if (to.kind === 'top') return `<a href="${esc(hrefTo(rc.isTop ? '' : 'index.html', to.anchor) || '#')}">${body}</a>`;
          return body;
        }
        default:
          throw new Error(`unknown inline ${n.type}`);
      }
    })
    .join('');
}

function blocksHtml(blocks, rc, tight = false) {
  return blocks
    .map((b, k) => {
      switch (b.type) {
        case 'heading':
          return `<h${b.level} id="${esc(b.anchor)}">${inlineHtml(b.inlines, rc)}</h${b.level}>`;
        case 'para':
          return tight && k === 0 ? inlineHtml(b.inlines, rc) : `<p>${inlineHtml(b.inlines, rc)}</p>`;
        case 'image': {
          const img = rc.prep.images.get(b.ref);
          const ext = img.name.split('.').pop().toLowerCase();
          const data = fs.readFileSync(path.resolve(rc.root, img.path)).toString('base64');
          return `<p><img src="data:${MIME[ext] || 'application/octet-stream'};base64,${data}" alt="${esc(b.alt)}"${img.width ? ` width="${img.width}"` : ''} /></p>`;
        }
        case 'list': {
          const tag = b.ordered ? 'ol' : 'ul';
          const start = b.ordered && b.start !== 1 ? ` start="${b.start}"` : '';
          return `<${tag}${start}>${b.items.map((it) => `<li>${blocksHtml(it.blocks, rc, !b.loose)}</li>`).join('')}</${tag}>`;
        }
        case 'hr':
          return '<hr />';
        case 'table': {
          const cell = (tag, c, a) => `<${tag}${a ? ` style="text-align: ${a};"` : ''}>${inlineHtml(c, rc)}</${tag}>`;
          return `<table><thead><tr>${b.head.map((c, x) => cell('th', c, b.align[x])).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c, x) => cell('td', c, b.align[x])).join('')}</tr>`).join('')}</tbody></table>`;
        }
        case 'code':
          return `<pre><code${b.lang ? ` class="language-${esc(b.lang.toLowerCase())}"` : ''}>${esc(b.text)}</code></pre>`;
        case 'quote':
          return `<blockquote>${blocksHtml(b.blocks, rc)}</blockquote>`;
        case 'alert':
          return `<div class="alert alert-${b.kind.toLowerCase()}" role="note"><p class="alert-title">${ALERTS[b.kind]}</p>${blocksHtml(b.blocks, rc)}</div>`;
        case 'raw':
          return `<p>${b.text.split('\n').map(esc).join('<br />')}</p>`;
        default:
          throw new Error(`unknown block ${b.type}`);
      }
    })
    .join('\n');
}

function listHtml(tree, rc) {
  if (!tree.length) return '';
  return `<ul>${tree.map((g) => `<li><a href="${esc(fileOf(g.id))}">${esc(g.title)}</a>${inlineHtml(g.description, rc)}${listHtml(g.children, rc)}</li>`).join('')}</ul>`;
}

/** One self-contained page; `page` is a prepared page or 'top'. */
export function pageHtml(prep, page, root = '.') {
  const parts = pageParts(prep, page);
  const rc = { prep, from: parts.from, isTop: page === 'top', root };
  const title = page === 'top' ? prep.topTitle : page.title;
  const body = [`<p class="banner">${inlineHtml(parts.banner, rc)}</p>`, `<h1>${esc(title)}</h1>`];
  if (page === 'top') {
    if (parts.intro.length) body.push(blocksHtml(parts.intro, rc));
    const list = listHtml(parts.list, rc);
    if (list) body.push(`<nav class="guides">${list}</nav>`);
  } else body.push(`<p><a href="index.html">${esc(prep.topTitle)}</a></p>`);
  if (parts.body.length) body.push(blocksHtml(parts.body, rc));
  const lang = esc(prep.set.product.language || 'en');
  return `<!DOCTYPE html>
<html lang="${lang}" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<style>
${CSS}
</style>
</head>
<body>
<main>
${body.join('\n')}
</main>
</body>
</html>
`;
}

/** Convert and write; returns { problems, notes, written, out }. */
export function convertHtml(opts) {
  const prep = prepare(opts);
  const { problems, notes } = prep;
  if (problems.length) return { problems, notes, written: [] };
  const root = opts.root || '.';
  const out = path.resolve(root, opts.out || prep.set.publish.html?.outDir || path.join('.user-guides', 'out', 'html'));
  fs.mkdirSync(out, { recursive: true });
  const written = [];
  const write = (name, text) => {
    fs.writeFileSync(path.join(out, name), text);
    written.push(name);
  };
  write('index.html', pageHtml(prep, 'top', root));
  for (const p of prep.pages) if (p.id !== prep.top.guide) write(fileOf(p.id), pageHtml(prep, p, root));
  return { problems, notes, written, out };
}

function main(argv) {
  let a;
  try {
    a = parseArgs(argv);
  } catch (e) {
    console.error(e.message);
    return 2;
  }
  const res = convertHtml({
    root: a.root,
    setFile: a.set,
    release: a.release,
    topTitle: a['top-title'],
    only: a.guides ? a.guides.split(',') : null,
    out: a.out,
    allowPlaceholders: !!a['allow-placeholders'],
    escapeUnsupported: !!a['escape-unsupported'],
  });
  return report(res, 'HTML');
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) process.exitCode = main(process.argv.slice(2));
