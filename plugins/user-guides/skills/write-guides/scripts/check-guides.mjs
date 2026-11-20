#!/usr/bin/env node
// check-guides.mjs: hold a guide set to write-guides' rules before it is reported (step 5).
//
//   node check-guides.mjs [--set docs/user-guides/guides.json] [--walk .user-guides/walk]
//                         [--record] [--mark-checked] [--json]
//
// Run from the repo root. Exit 0 when every guide passes, 1 with the problems (file:line).
//   --record        with no walk, write each unconfirmed bold label to notChecked[] (R11), and
//                   regenerate the README index's status block
//   --mark-checked  after a clean pass, move every `written` guide to `checked`
//
// The checks:
//   refs      no internal references: decision, ticket and session ids, file paths, code names,
//             nor the project's own checks.patterns[]
//   template  no template comments or {{slots}} left in a written guide
//   image     alt text present and in the form "Screen: what to notice"; each image alone on
//             its line; the file exists
//   shots     every image is a shot that lists the guide, and every shot of the guide is shown
//   links     links to files resolve, and so do their anchors (GitHub slugs, -1 for duplicates)
//   labels    every bold UI label is on a walked screen (the walk dumps); with no walk, each one
//             is in notChecked[]
//   coverage  every walked screen is in a guide for its role, or listed in leftOut[]
//   walk      with no walk, notChecked[] is not empty
//   index     the guides folder's README.md status block is current

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as kit from './kit-core.mjs';
import { loadGuideSet, saveGuideSet, moveGuide, updateIndex } from './guide-set.mjs';

export const DEFAULT_SET = 'docs/user-guides/guides.json';

/** Built-in internal-reference patterns: [rule name, regex]. */
export const INTERNAL_REFS = [
  ['a decision or plan id', /\b(?:D|R|SP|C)\d{1,3}\b/g],
  ['a session id', /\b[Ss]ession \d+\b|\bS\d{1,2}\b/g],
  ['a ticket id', /\b[A-Z][A-Z0-9]{1,9}-\d{1,6}\b/g],
  ['a file path', /(?:^|[\s(`'"])(?:\.{1,2}\/|\/)?(?:[\w.-]+\/)+[\w.-]+\.(?:m?[jt]sx?|json|ya?ml|md|py|go|rb|java|kt|cs|php|sql|sh|css|scss|html|toml|lock|env)\b/g],
  ['a source folder', /(?:^|[\s(`'"])(?:src|lib|apps|packages|scripts|tests?|config|migrations|internal)\/[\w./-]*/g],
];

/** A code span that names code: camelCase, snake_case, a call, a module path, a source file. */
const CODE_NAME = /^(?:[a-z]+[A-Z]\w*|[A-Z][a-z0-9]+[A-Z]\w*|\w+_\w+|[\w.]+\(\)|\w+::\w+|[\w-]+\.(?:m?[jt]sx?|json|ya?ml|py|go|rb|sql|sh|css|html))$/;

/** GitHub's heading slug. */
export function slug(text) {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[`*]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

/** Every heading's anchor in a markdown text, with -1, -2 for duplicates. */
export function anchors(md) {
  const out = new Set();
  const count = new Map();
  let fence = false;
  for (const line of md.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    if (fence) continue;
    const m = line.match(/^#{1,6}\s+(.*?)\s*#*\s*$/);
    if (!m) continue;
    const s = slug(m[1]);
    const n = count.get(s) || 0;
    count.set(s, n + 1);
    out.add(n ? `${s}-${n}` : s);
  }
  return out;
}

const IMAGE_RE = /!\[((?:\\.|[^\]\\])*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const LINK_RE = /(?<!!)\[((?:\\.|[^\]\\])*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const BOLD_RE = /\*\*(?!\s)((?:[^*]|\*(?!\*))+?)\*\*|__(?!\s)([^_]+?)__/g;

const toPosix = (p) => p.split(path.sep).join('/');
const repoRel = (fromFile, target) => path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), decodeURI(target)));

/** The words a walk saw for one role: screen text, control names, options and labelling attributes. */
function corpusFor(walkDir, outline, roles) {
  const parts = [];
  for (const role of roles) {
    for (const s of outline.roles[role] || []) {
      const htmlFile = path.join(walkDir, s.dump.replace(/\.txt$/, '.html'));
      if (!fs.existsSync(htmlFile)) continue;
      const doc = kit.parseHtml(fs.readFileSync(htmlFile, 'utf8'));
      parts.push(kit.textOf(kit.bodyOf(doc)));
      for (const el of kit.descendants(doc)) {
        if (!kit.visible(el) && el.tag !== 'dialog') continue;
        const role2 = kit.roleOf(el);
        if (kit.CONTROL_ROLES.has(role2) || role2 === 'heading' || el.tag === 'option' || kit.REGION_ROLES.has(role2)) parts.push(kit.accessibleName(el) || '');
        if (el.tag === 'option') parts.push(el.children.map((c) => c.text || '').join(''));
        for (const a of ['placeholder', 'aria-label', 'title', 'alt']) if (el.attrs[a]) parts.push(el.attrs[a]);
      }
    }
  }
  return parts.join('\n').replace(/\s+/g, ' ');
}

/** Split a bold run into the labels it names: `**Settings → Notifications**` is two. */
export function labelsIn(bold) {
  return bold
    .split(/\s*(?:→|->|›|>)\s*/)
    .map((s) => s.trim().replace(/^["“'‘]|["”'’]$/g, '').replace(/[.:,;]$/, '').trim())
    .filter(Boolean);
}

const labelClaim = (label) => `UI label "${label}"`;

/**
 * Check a guide set. Returns { problems: [{ file, line, rule, message }], recorded, walked }.
 * `record` writes unconfirmed labels to notChecked[] when there is no walk.
 */
export function checkGuides({ root = '.', setFile = DEFAULT_SET, walkDir, record = false } = {}) {
  const abs = (p) => path.resolve(root, p);
  const set = loadGuideSet(abs(setFile));
  const wdir = abs(walkDir || path.join(kit.WORK_DIR, 'walk'));
  const outlineFile = path.join(wdir, 'outline.json');
  const outline = fs.existsSync(outlineFile) ? JSON.parse(fs.readFileSync(outlineFile, 'utf8')) : null;
  const walked = !!outline && Object.values(outline.roles || {}).some((l) => l.length);
  const problems = [];
  const recorded = [];
  const add = (file, line, rule, message) => problems.push({ file, line, rule, message });
  const patterns = set.checks.patterns.map((p) => new RegExp(p, 'gi'));
  const allRoles = Object.keys(set.app.accounts);
  const texts = new Map();
  const anchorCache = new Map();
  const anchorsOf = (rel) => {
    if (!anchorCache.has(rel)) anchorCache.set(rel, anchors(fs.readFileSync(abs(rel), 'utf8')));
    return anchorCache.get(rel);
  };
  const corpusCache = new Map();
  const corpus = (roles) => {
    const key = roles.join(',');
    if (!corpusCache.has(key)) corpusCache.set(key, corpusFor(wdir, outline, roles));
    return corpusCache.get(key);
  };

  for (const g of set.guides) {
    if (!fs.existsSync(abs(g.file))) {
      add(g.file, 0, 'links', `guide file missing (guides[${g.id}])`);
      continue;
    }
    const md = fs.readFileSync(abs(g.file), 'utf8');
    texts.set(g.id, md);
    const lines = md.split('\n');
    const shown = new Set();
    let fence = false;
    let para = [];
    const flush = () => {
      if (!para.length) return;
      const n = para[0].n;
      const text = para.map((x) => x.plain).join(' ');
      para = [];
      for (const m of text.matchAll(BOLD_RE)) {
        for (const label of labelsIn(m[1] ?? m[2])) {
          const listed = set.notChecked.some((e) => e.guide === g.id && e.claim.includes(`"${label}"`));
          if (listed) continue;
          if (walked) {
            const roles = g.audience.length ? g.audience : allRoles;
            const hay = corpus(roles);
            if (!hay.includes(label.replace(/\s+/g, ' '))) add(g.file, n, 'labels', `"${label}" is on no screen walked as ${roles.join(', ')}: fix it, walk the screen it is on, or record it in notChecked[]`);
          } else if (record) {
            set.notChecked.push({ guide: g.id, claim: labelClaim(label), reason: 'no walk confirmed it (written from the code)' });
            recorded.push({ guide: g.id, label });
          } else add(g.file, n, 'labels', `"${label}" is unconfirmed and not in notChecked[] (no walk): rerun with --record`);
        }
      }
    };
    lines.forEach((line, i) => {
      const n = i + 1;
      if (/^\s*(```|~~~)/.test(line)) {
        flush();
        fence = !fence;
        return;
      }
      if (fence) return;

      // template leftovers
      if (g.status !== 'outlined' && (/<!--/.test(line) || /\{\{[^}]*\}\}/.test(line))) add(g.file, n, 'template', 'a template comment or {{slot}} is left in');

      // images
      const imgs = [...line.matchAll(IMAGE_RE)];
      if (line.includes('![') && !imgs.length) add(g.file, n, 'image', 'an image whose markdown does not parse');
      if (imgs.length && (imgs.length > 1 || line.trim() !== imgs[0][0])) add(g.file, n, 'image', 'an image must be alone on its line');
      for (const [, alt, src] of imgs) {
        const a = alt.replace(/\\(.)/g, '$1').trim();
        if (!a) add(g.file, n, 'image', `no alt text for ${src}`);
        else if (!/^[^:\n]{1,80}: \S/.test(a)) add(g.file, n, 'image', `alt text must read "Screen: what to notice": "${a}"`);
        if (/^[a-z]+:/i.test(src)) {
          add(g.file, n, 'shots', `an image from outside the repo: ${src}`);
          continue;
        }
        const rel = repoRel(g.file, src);
        if (!fs.existsSync(abs(rel))) add(g.file, n, 'image', `image file missing: ${rel}`);
        const shot = set.shots.find((s) => s.path === rel);
        if (!shot) add(g.file, n, 'shots', `image ${rel} is not in shots[]`);
        else {
          shown.add(shot.id);
          if (!shot.guides.includes(g.id)) add(g.file, n, 'shots', `shot ${shot.id} does not list guide ${g.id}`);
          if (rel.endsWith('.svg') && !['placeholder', 'needs-text', 'blocked'].includes(shot.status)) add(g.file, n, 'shots', `shot ${shot.id} is ${shot.status} but the guide still shows its placeholder`);
        }
      }

      // links
      for (const [, , target] of line.matchAll(LINK_RE)) {
        if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target)) continue;
        const [file, anchor] = target.split('#');
        const rel = file ? repoRel(g.file, file) : g.file;
        if (file && !fs.existsSync(abs(rel))) {
          add(g.file, n, 'links', `link to a missing file: ${target}`);
          continue;
        }
        if (anchor !== undefined && rel.endsWith('.md') && !anchorsOf(rel).has(decodeURIComponent(anchor))) add(g.file, n, 'links', `no heading for the anchor #${anchor} in ${rel}`);
      }

      // internal references (link targets and URLs left out; code spans checked for code names)
      const prose = line.replace(IMAGE_RE, '').replace(/\]\([^)]*\)/g, ']').replace(/<?https?:\/\/[^\s>)]+>?/g, '');
      const seen = new Set();
      for (const [what, re] of INTERNAL_REFS) for (const m of prose.matchAll(re)) {
        const hit = m[0].trim().replace(/^[(`'"]/, '');
        if ([...seen].some((x) => x.includes(hit))) continue;
        seen.add(hit);
        add(g.file, n, 'refs', `${what}: "${hit}"`);
      }
      for (const re of patterns) for (const m of prose.matchAll(re)) add(g.file, n, 'refs', `matches checks.patterns ${re.source}: "${m[0]}"`);
      for (const [, code] of prose.matchAll(/`([^`]+)`/g)) if (CODE_NAME.test(code.trim())) add(g.file, n, 'refs', `a code name: \`${code}\``);

      // bold UI labels: a bold run may wrap, so they are read a paragraph at a time
      if (!line.trim()) flush();
      else para.push({ n, plain: prose.replace(/`[^`]*`/g, '') });
    });
    flush();
    if (fence) add(g.file, lines.length, 'template', 'a code fence is not closed');
    for (const s of set.shots) if (s.guides.includes(g.id) && !shown.has(s.id)) add(g.file, 0, 'shots', `shot ${s.id} lists this guide but the guide does not show ${s.path}`);
  }

  // coverage of the walked screens
  if (walked) {
    for (const [role, list] of Object.entries(outline.roles)) {
      const guides = set.guides.filter((g) => !g.audience.length || g.audience.includes(role));
      const hay = guides.map((g) => (texts.get(g.id) || '').toLowerCase()).join('\n');
      for (const s of list) {
        if (s.status !== 200) continue;
        const names = kit.screenNames(s);
        const paths = [s.path, ...(s.aliases || [])];
        const left = set.leftOut.some((e) => e.role === role && (paths.includes(e.screen) || names.some((x) => x.toLowerCase() === e.screen.toLowerCase())));
        if (left) continue;
        const inGuide = names.some((x) => hay.includes(x.toLowerCase()));
        const shot = set.shots.some((sh) => sh.as === role && paths.includes(walkPath(sh.state)));
        if (!inGuide && !shot) add(toPosix(path.relative(root, outlineFile)), 0, 'coverage', `${s.path} (${names.join(' / ')}), walked as ${role}, is in no guide for ${role} and not in leftOut[]`);
      }
    }
  } else if (!set.notChecked.length) {
    add(setFile, 0, 'walk', 'no walk was recorded, so notChecked[] must list the claims that were not checked');
  }

  return { set, problems, recorded, walked };
}

function walkPath(state) {
  const m = String(state || '').match(/(?:^|\s)(\/[\w\-./?=&%~]*)/);
  return m ? m[1].replace(/[.,:;)]+$/, '') : null;
}

/** The README index beside guides.json: its status block must be current. */
export function checkIndex({ root = '.', setFile = DEFAULT_SET, set, fix = false }) {
  const readme = path.posix.join(path.posix.dirname(setFile), 'README.md');
  const file = path.resolve(root, readme);
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  const want = updateIndex(text ?? '', set, readme);
  if (text === want) return null;
  if (fix) {
    fs.writeFileSync(file, want);
    return null;
  }
  return { file: readme, line: 0, rule: 'index', message: text === null ? 'no README.md index in the guides folder (guide-set.mjs index writes one)' : 'the README.md status block is out of date (guide-set.mjs index regenerates it)' };
}

function main(argv) {
  const a = { set: DEFAULT_SET };
  for (let i = 0; i < argv.length; i++) {
    const m = argv[i].match(/^--([a-z-]+)$/);
    if (!m) return console.error(`unexpected argument: ${argv[i]}`), 2;
    if (['record', 'mark-checked', 'json'].includes(m[1])) a[m[1]] = true;
    else a[m[1]] = argv[++i];
  }
  let res;
  try {
    res = checkGuides({ setFile: a.set, walkDir: a.walk, record: a.record });
  } catch (err) {
    console.error(`check-guides: ${err.message}`);
    return 1;
  }
  const { set, problems, recorded, walked } = res;
  let changed = recorded.length > 0;
  if (!problems.length && a['mark-checked']) {
    for (const g of set.guides) if (g.status === 'written') {
      moveGuide(set, g.id, 'checked', { by: 'write-guides' });
      changed = true;
    }
  }
  if (changed) saveGuideSet(a.set, set);
  const idx = checkIndex({ setFile: a.set, set, fix: a.record || changed });
  if (idx) problems.push(idx);
  if (a.json) {
    console.log(JSON.stringify({ ok: !problems.length, walked, problems, recorded }, null, 2));
  } else {
    for (const p of problems) console.log(`${p.file}${p.line ? `:${p.line}` : ''}  ${p.rule}  ${p.message}`);
    for (const r of recorded) console.log(`recorded in notChecked[]: ${r.guide}: UI label "${r.label}"`);
    console.log(`check-guides: ${set.guides.length} guides, ${set.shots.length} shots, ${walked ? 'walked' : 'no walk'}; ${problems.length ? `${problems.length} problems` : 'all checks pass'}`);
  }
  return problems.length ? 1 : 0;
}

// Compare real paths: called through a symlink (macOS's /var → /private/var), argv[1] differs.
if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
