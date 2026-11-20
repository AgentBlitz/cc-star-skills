#!/usr/bin/env node
// placeholder.mjs: the picture placeholder (PLAN D3). An SVG card naming the caption, the role
// that takes the shot and the screen, written to `<guides>/images/<id>.svg`; the markdown link
// that shows it; and alt text in the form "Screen: what to notice". wiki-guides later replaces
// the card with `images/<id>.png` and rewrites the link.
//
// CLI (prints the markdown link):
//   node placeholder.mjs --dir docs/user-guides --id request-dialog --screen "Requests" \
//     --notice "the Request leave dialog, with the dates filled in" --role employee \
//     [--caption "…"] [--guide docs/user-guides/employee.md]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const CARD = { width: 800, height: 450 };

/** Alt text in the form "Screen: what to notice". */
export function altText(screen, notice) {
  const s = String(screen ?? '').replace(/[:\n]/g, ' ').replace(/\s+/g, ' ').trim();
  const n = String(notice ?? '').replace(/\s+/g, ' ').trim();
  if (!s) throw new Error('alt text needs the screen');
  if (!n) throw new Error('alt text needs what to notice');
  return `${s}: ${n}`;
}

/** Split "Screen: what to notice" back into its parts (null when it is not in that form). */
export function parseAlt(alt) {
  const m = String(alt).match(/^([^:\n]{1,80}): (\S[^\n]*)$/);
  return m ? { screen: m[1], notice: m[2] } : null;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Greedy word wrap to at most `max` characters a line, and at most `lines` lines. */
export function wrap(text, max = 46, lines = 4) {
  const out = [];
  let cur = '';
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const w = word.length > max ? word.slice(0, max - 1) + '…' : word;
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= max) cur += ' ' + w;
    else {
      out.push(cur);
      cur = w;
    }
  }
  if (cur) out.push(cur);
  if (out.length > lines) {
    out.length = lines;
    out[lines - 1] = out[lines - 1].replace(/.?$/, '…');
  }
  return out;
}

/** The SVG card. `caption` defaults to what to notice. */
export function placeholderSvg({ id, caption, role, screen }) {
  if (!ID_RE.test(id ?? '')) throw new Error(`placeholder id must be kebab-case: ${id}`);
  if (!caption) throw new Error('placeholder needs a caption');
  if (!role) throw new Error('placeholder needs the role that takes the shot');
  if (!screen) throw new Error('placeholder needs the screen');
  const { width: W, height: H } = CARD;
  const capLines = wrap(caption);
  const label = `Picture to come: ${screen}, as ${role}. ${caption}`;
  const tspans = capLines
    .map((l, i) => `<tspan x="${W / 2}" dy="${i === 0 ? 0 : 34}">${esc(l)}</tspan>`)
    .join('');
  const capY = H / 2 - ((capLines.length - 1) * 34) / 2 + 10;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}" data-user-guides-placeholder="${esc(id)}">`,
    `  <title>${esc(label)}</title>`,
    `  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="18" fill="#f5f6f8" stroke="#9aa3af" stroke-width="2" stroke-dasharray="10 8"/>`,
    `  <text x="32" y="56" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="22" font-weight="600" fill="#374151">${esc(screen)}</text>`,
    `  <rect x="${W - 32 - Math.max(90, role.length * 11 + 28)}" y="30" width="${Math.max(90, role.length * 11 + 28)}" height="36" rx="18" fill="#e0e7ff"/>`,
    `  <text x="${W - 32 - Math.max(90, role.length * 11 + 28) / 2}" y="54" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="17" fill="#3730a3">as ${esc(role)}</text>`,
    `  <text x="${W / 2}" y="${capY}" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="26" fill="#111827">${tspans}</text>`,
    `  <text x="32" y="${H - 32}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="15" fill="#6b7280">picture to come · ${esc(id)}</text>`,
    `</svg>`,
    '',
  ].join('\n');
}

/** Where the card goes, repo-relative: `<guidesDir>/images/<id>.svg`. */
export function placeholderPath(guidesDir, id) {
  return path.posix.join(guidesDir.split(path.sep).join('/').replace(/\/$/, ''), 'images', `${id}.svg`);
}

/** The markdown that shows an image from a guide file (both repo-relative). */
export function imageMarkdown({ alt, imagePath, guideFile }) {
  if (!parseAlt(alt)) throw new Error(`alt text must read "Screen: what to notice": ${alt}`);
  const from = guideFile ? path.posix.dirname(guideFile) : '.';
  const rel = path.posix.relative(from, imagePath);
  return `![${alt.replace(/([\[\]])/g, '\\$1')}](${rel.replace(/ /g, '%20')})`;
}

/**
 * Write the card under `root` (default: the current directory, the repo root) and return
 * `{ path, svg, alt, markdown }` (`path` repo-relative). `guideFile` (repo-relative) decides the
 * link's relative path; without it the link is relative to the guides folder.
 */
export function writePlaceholder({ root = '.', guidesDir, id, screen, notice, role, caption, guideFile }) {
  const alt = altText(screen, notice);
  const svg = placeholderSvg({ id, caption: caption || notice, role, screen });
  const rel = placeholderPath(guidesDir, id);
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, svg);
  const markdown = imageMarkdown({ alt, imagePath: rel, guideFile: guideFile || path.posix.join(guidesDir, 'README.md') });
  return { path: rel, svg, alt, markdown };
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const m = argv[i].match(/^--([a-z]+)$/);
    if (!m || argv[i + 1] === undefined) throw new Error(`unexpected argument: ${argv[i]}`);
    out[m[1]] = argv[++i];
  }
  return out;
}

function main(argv) {
  let a;
  try {
    a = parseArgs(argv);
    for (const k of ['dir', 'id', 'screen', 'notice', 'role']) if (!a[k]) throw new Error(`missing --${k}`);
    const r = writePlaceholder({ guidesDir: a.dir, id: a.id, screen: a.screen, notice: a.notice, role: a.role, caption: a.caption, guideFile: a.guide });
    console.log(r.markdown);
    return 0;
  } catch (err) {
    console.error(`placeholder: ${err.message}`);
    console.error('usage: placeholder.mjs --dir <guides> --id <id> --screen <screen> --notice <what to notice> --role <role> [--caption …] [--guide <guide.md>]');
    return 2;
  }
}

// Compare real paths: called through a symlink (macOS's /var → /private/var), argv[1] differs.
if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
