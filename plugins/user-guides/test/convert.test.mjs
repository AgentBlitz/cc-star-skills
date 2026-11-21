// S7: the Markdown subset (md.mjs), the converters (to-confluence, to-html), bundle.mjs.
// Goldens: test/golden/expected/, made from a synthetic set (test/golden/src/ plus the
// template test page). Regenerate them with UPDATE_GOLDENS=1 npm test, then read the diff.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PLUGIN_DIR } from './helpers.mjs';
import { wellFormed, wrapStorage, xmllint } from './xml.mjs';

const WIKI = path.join(PLUGIN_DIR, 'skills', 'wiki-guides');
const md = await import(path.join(WIKI, 'scripts', 'md.mjs'));
const { convert, prepare } = await import(path.join(WIKI, 'scripts', 'to-confluence.mjs'));
const { convertHtml } = await import(path.join(WIKI, 'scripts', 'to-html.mjs'));
const { bundle } = await import(path.join(WIKI, 'scripts', 'bundle.mjs'));
const gs = await import(path.join(WIKI, 'scripts', 'guide-set.mjs'));

const GOLDEN = path.join(PLUGIN_DIR, 'test', 'golden');
const UPDATE = process.env.UPDATE_GOLDENS === '1';
const SET = 'docs/guides/guides.json';
const RELEASE = '1.0.0-test';

/** The synthetic set: golden/src plus the template test page and its picture. */
function stageSet({ topGuide, imageCap } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ug-convert-'));
  fs.cpSync(path.join(GOLDEN, 'src'), dir, { recursive: true });
  fs.copyFileSync(path.join(WIKI, 'templates', 'test-page.md'), path.join(dir, 'docs/guides/test-page.md'));
  fs.copyFileSync(path.join(WIKI, 'templates', 'test-page.png'), path.join(dir, 'docs/guides/test-page.png'));
  const set = gs.createGuideSet({ name: 'Example', language: 'en-GB' });
  set.app.accounts = { reader: {} };
  set.notChecked.push({ guide: 'test-page', claim: 'synthetic', reason: 'a test set' });
  gs.addGuide(set, { id: 'test-page', type: 'getting-started', file: 'docs/guides/test-page.md', title: 'User guides: test page', audience: [], order: 1 }, { by: 'write-guides' });
  gs.addGuide(set, { id: 'another', type: 'role-guide', file: 'docs/more/another-guide.md', title: 'Another guide', audience: ['reader'], parent: 'test-page', order: 2 }, { by: 'write-guides' });
  for (const id of ['test-page', 'another']) {
    gs.moveGuide(set, id, 'written', { by: 'write-guides' });
    gs.moveGuide(set, id, 'checked', { by: 'write-guides' });
  }
  gs.addShot(set, { id: 'test-page', alt: 'Test page: the sample picture', as: 'reader', path: 'docs/guides/test-page.png', target: { what: 'the page', locator: null }, state: 'On /: signed in', guides: ['test-page'] }, { by: 'write-guides', adopt: true });
  gs.addShot(set, { id: 'card', alt: 'Another guide: a placeholder card', as: 'reader', path: 'docs/more/images/card.svg', target: { what: 'the page', locator: null }, state: 'On /: signed in', guides: ['another'] }, { by: 'write-guides' });
  if (topGuide) set.publish.confluence = { topGuide };
  if (imageCap) set.publish.confluence = { ...(set.publish.confluence || {}), imageCap };
  gs.saveGuideSet(path.join(dir, SET), set);
  return dir;
}

function compareDir(actualDir, expectedDir) {
  if (UPDATE) {
    fs.rmSync(expectedDir, { recursive: true, force: true });
    fs.cpSync(actualDir, expectedDir, { recursive: true });
    return;
  }
  const names = (d) => fs.readdirSync(d).sort();
  assert.deepEqual(names(actualDir), names(expectedDir), `files in ${path.basename(expectedDir)}`);
  for (const n of names(expectedDir)) assert.equal(fs.readFileSync(path.join(actualDir, n), 'utf8'), fs.readFileSync(path.join(expectedDir, n), 'utf8'), `${path.basename(expectedDir)}/${n} differs from its golden (UPDATE_GOLDENS=1 regenerates)`);
}

function assertWellFormed(text, label, tmp) {
  assert.deepEqual(wellFormed(text), [], `${label} is not well-formed`);
  const lint = xmllint(text, path.join(tmp, 'lint.xml'));
  if (lint) assert.deepEqual(lint, [], `xmllint: ${label}`);
}

// ── the subset ──────────────────────────────────────────────────────────────────────────

const kinds = (blocks, out = new Set()) => {
  for (const b of blocks) {
    out.add(b.type === 'alert' ? `alert:${b.kind}` : b.type);
    if (b.type === 'list') out.add(b.ordered ? 'list:ordered' : 'list:bullet');
    for (const n of [...(b.inlines || []), ...(b.head || []).flat(), ...(b.rows || []).flat(2)]) inlineKinds(n, out);
    if (b.blocks) kinds(b.blocks, out);
    if (b.items) for (const it of b.items) kinds(it.blocks, out);
  }
  return out;
};
const inlineKinds = (n, out) => {
  out.add(`inline:${n.type}`);
  for (const c of n.children || []) inlineKinds(c, out);
};

test('the test page holds every construct in the subset, and none outside it', () => {
  const doc = md.parse(fs.readFileSync(path.join(WIKI, 'templates', 'test-page.md'), 'utf8'), { file: 'test-page.md' });
  assert.deepEqual(doc.errors, []);
  const seen = kinds(doc.blocks);
  for (const k of ['heading', 'para', 'image', 'list:bullet', 'list:ordered', 'hr', 'table', 'code', 'quote', ...Object.keys(md.ALERTS).map((a) => `alert:${a}`), 'inline:text', 'inline:strong', 'inline:em', 'inline:code', 'inline:link']) assert.ok(seen.has(k), `the test page has no ${k}`);
  const levels = new Set(md.headings(doc.blocks).map((h) => h.level));
  assert.deepEqual([...levels].sort(), [1, 2, 3, 4, 5, 6]);
  const list = doc.blocks.find((b) => b.type === 'list' && b.ordered);
  assert.ok(list.loose, 'the numbered list has paragraphs inside its items');
  assert.ok(list.items.some((it) => it.blocks.some((b) => b.type === 'list')), 'a nested list inside a step');
});

test('slugs and anchors are GitHub’s: rendered text, -1 for duplicates, the title counted', () => {
  assert.equal(md.slug('2. Change your settings'), '2-change-your-settings');
  assert.deepEqual([...md.anchors('# A\n\n## Notes\n\n```\n## Not a heading\n```\n\n## Notes\n\n## What’s **new** in `1.1`?\n\n## _Under_ score_d\n')], ['a', 'notes', 'notes-1', 'whats-new-in-11', 'under-score_d']);
  assert.deepEqual([...md.anchors('# Notes\n\n## Notes\n')], ['notes', 'notes-1']);
});

test('inline markdown: emphasis, code, links, escapes, bare addresses', () => {
  const p = (s) => md.parse(s).blocks[0].inlines;
  assert.deepEqual(p('**a *b* c**'), [{ type: 'strong', children: [{ type: 'text', text: 'a ' }, { type: 'em', children: [{ type: 'text', text: 'b' }] }, { type: 'text', text: ' c' }] }]);
  assert.deepEqual(p('snake_case_name and 2 * 3 * 4'), [{ type: 'text', text: 'snake_case_name and 2 * 3 * 4' }]);
  assert.deepEqual(p('`a **b**`'), [{ type: 'code', text: 'a **b**' }]);
  assert.deepEqual(p('\\*not\\*'), [{ type: 'text', text: '*not*' }]);
  const l = p('see [the **guide**](../x.md#y "t") now');
  assert.equal(l[1].href, '../x.md#y');
  assert.equal(md.plainText(l[1].children), 'the guide');
  assert.deepEqual(p('at https://example.com/a(b). Then').map((n) => n.href || n.text), ['at ', 'https://example.com/a(b)', '. Then']);
  assert.equal(p('<https://example.com>')[0].href, 'https://example.com');
});

test('constructs outside the subset fail with their line, or show as escaped text', () => {
  const cases = [
    ['# T\n\n<div>x</div>\n', 3, /raw HTML/],
    ['# T\n\ntext <b>bold</b>\n', 3, /raw HTML/],
    ['# T\n\n<!-- a comment -->\n', 3, /raw HTML/],
    ['# T\n\nsee [x][ref]\n\n[ref]: https://example.com\n', 3, /reference-style/],
    ['# T\n\na footnote[^1]\n', 3, /footnote/],
    ['# T\n\n    indented code\n', 3, /indented code/],
    ['# T\n\nTitle\n=====\n', 3, /underlined/],
    ['# T\n\ntext ![Screen: x](a.png) inline\n', 3, /image inside a line/],
    ['# T\n\n~~gone~~\n', 3, /strikethrough/],
    ['# T\n\n- [ ] a task\n', 3, /task-list/],
    ['# T\n\n- item\n\n  ## heading in a list\n', 5, /heading inside/],
    ['# T\n\n# Second title\n', 3, /second level-1/],
    ['# T\n\nline one  \nline two\n', 3, /hard line break/],
    ['# T\n\n```\nnever closed\n', 3, /never closed/],
  ];
  for (const [src, line, re] of cases) {
    const r = md.parse(src, { file: 'g.md' });
    assert.ok(r.errors.length >= 1, `no error for ${JSON.stringify(src)}`);
    assert.equal(r.errors[0].line, line, JSON.stringify(src));
    assert.match(r.errors[0].message, re);
    assert.equal(r.errors[0].file, 'g.md');
  }
  const esc = md.parse('# T\n\n<div>x</div>\n\nafter\n', { escapeUnsupported: true });
  assert.deepEqual(esc.errors, []);
  assert.equal(esc.escaped.length, 1);
  assert.deepEqual(esc.blocks.map((b) => b.type), ['heading', 'raw', 'para']);
  assert.equal(esc.blocks[1].text, '<div>x</div>');
});

test('lists: nesting, tight and loose, lazy lines, code in an item', () => {
  const r = md.parse('- a\n- b\n  - c\n  continued\n- d\n\n1. one\n\n   para\n2. two\n');
  assert.deepEqual(r.errors, []);
  const [ul, ol] = r.blocks;
  assert.equal(ul.loose, false);
  assert.equal(ul.items.length, 3);
  assert.equal(ul.items[1].blocks[1].type, 'list');
  assert.equal(md.plainText(ul.items[1].blocks[1].items[0].blocks[0].inlines), 'c continued');
  assert.equal(ol.ordered, true);
  assert.equal(ol.loose, true);
  assert.equal(ol.items[0].blocks[1].type, 'para');
});

// ── the goldens ─────────────────────────────────────────────────────────────────────────

test('storage format: the synthetic set matches its golden and is well-formed XHTML', () => {
  const dir = stageSet();
  try {
    const out = path.join(dir, '.user-guides/out/confluence');
    const res = convert({ root: dir, setFile: SET, release: RELEASE, allowPlaceholders: true, out });
    assert.deepEqual(res.problems, []);
    assert.deepEqual(res.written.sort(), ['another.xhtml', 'pages.json', 'test-page.xhtml', 'top.xhtml']);
    for (const f of res.written.filter((n) => n.endsWith('.xhtml'))) assertWellFormed(wrapStorage(fs.readFileSync(path.join(out, f), 'utf8')), f, dir);
    compareDir(out, path.join(GOLDEN, 'expected', 'confluence'));

    const page = fs.readFileSync(path.join(out, 'test-page.xhtml'), 'utf8');
    // no banner: a wiki page carries no notice about where it is made (R34); the page opens with its text
    assert.doesNotMatch(page, /This page is made from/);
    assert.match(page.split('\n')[0], /^<p>This page holds every construct/);
    // headings shift up one, each with its GitHub anchor
    assert.match(page, /<h1><ac:structured-macro ac:name="anchor"><ac:parameter ac:name="">a-repeated-heading-1<\/ac:parameter><\/ac:structured-macro>A repeated heading<\/h1>/);
    assert.match(page, /<h5>.*A sixth level<\/h5>/);
    assert.doesNotMatch(page, /User guides: test page<\/h/);
    // links: in-page, another guide in another folder, the index (the top page), a repo file as text
    assert.match(page, /<ac:link ac:anchor="tables"><ac:link-body>a heading on this page<\/ac:link-body><\/ac:link>/);
    assert.match(page, /<ac:link ac:anchor="first-steps"><ri:page ri:content-title="Another guide" \/><ac:link-body>another guide<\/ac:link-body><\/ac:link>/);
    assert.match(page, /<ac:link><ri:page ri:content-title="Example user guides" \/><ac:link-body>the guides' index<\/ac:link-body><\/ac:link>/);
    assert.match(page, /and a file in the repository, which shows/);
    assert.match(page, /<a href="https:\/\/example\.com\/start">https:\/\/example\.com\/start<\/a>/);
    // images: attached to the top page, with no fixed width by default, so the wiki fits them to the column
    assert.match(page, /<ac:image ac:alt="Test page: the sample picture on its own line" [^>]*><ri:attachment ri:filename="test-page\.png"><ri:page ri:content-title="Example user guides" \/><\/ri:attachment><\/ac:image>/);
    // code, alerts, tables
    assert.match(page, /<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">js<\/ac:parameter><ac:plain-text-body><!\[CDATA\[const ok = 1 < 2 && "]]]]><!\[CDATA\[>"/);
    for (const [kind, name] of [['info', 'Note'], ['info', 'Tip'], ['note', 'Important'], ['note', 'Warning'], ['warning', 'Caution']]) assert.match(page, new RegExp(`<ac:structured-macro ac:name="${kind}"><ac:parameter ac:name="title">${name}</ac:parameter>`));
    assert.match(page, /<th style="text-align: center;">Centre<\/th>/);
    assert.match(page, /<td style="text-align: left;">a \| pipe<\/td><td style="text-align: center;"><code>a\|b<\/code> in code<\/td>/);

    const top = fs.readFileSync(path.join(out, 'top.xhtml'), 'utf8');
    assert.doesNotMatch(top, /This page is made from/, 'no banner (R34)');
    assert.match(top, /These guides show how to use Example/);
    assert.doesNotMatch(top, /Not on the top page/);
    // the list of guides, nested by parent, with the README's descriptions
    assert.match(top, /<ul><li><ac:link><ri:page ri:content-title="User guides: test page" \/><ac:link-body>User guides: test page<\/ac:link-body><\/ac:link>: every construct the guides use\.<ul><li><ac:link><ri:page ri:content-title="Another guide" \/>/);

    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'pages.json'), 'utf8'));
    assert.equal(manifest.top.title, 'Example user guides');
    assert.deepEqual(manifest.pages.map((p) => [p.id, p.parent]), [['test-page', null], ['another', 'test-page']]);
    assert.deepEqual(manifest.images.map((i) => [i.name, i.width, i.placeholder]), [['card.svg', 640, true], ['test-page.png', 240, false]]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('an imageCap gives each image a fixed width, min(cap, px / scale); without one there is none (R33)', () => {
  for (const [imageCap, want] of [[undefined, null], [640, '240'], [200, '200']]) {
    const dir = stageSet({ imageCap });
    try {
      const out = path.join(dir, '.user-guides/out/confluence');
      assert.deepEqual(convert({ root: dir, setFile: SET, release: RELEASE, allowPlaceholders: true, out }).problems, []);
      const widths = [...fs.readFileSync(path.join(out, 'test-page.xhtml'), 'utf8').matchAll(/<ac:image([^>]*)>/g)].map((m) => / ac:width="(\d+)"/.exec(m[1])?.[1] ?? null);
      assert.ok(widths.length >= 2);
      assert.deepEqual([...new Set(widths)], [want], `imageCap ${imageCap}`);
      // HTML keeps the image's own size either way: its CSS fits it to the page
      const html = path.join(dir, '.user-guides/out/html');
      convertHtml({ root: dir, setFile: SET, release: RELEASE, allowPlaceholders: true, out: html });
      assert.match(fs.readFileSync(path.join(html, 'test-page.html'), 'utf8'), new RegExp(`alt="Test page: the sample picture on its own line" width="${want ?? 240}"`));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('HTML: self-contained pages and an index match their goldens and are well-formed', () => {
  const dir = stageSet();
  try {
    const out = path.join(dir, '.user-guides/out/html');
    const res = convertHtml({ root: dir, setFile: SET, release: RELEASE, allowPlaceholders: true, out });
    assert.deepEqual(res.problems, []);
    assert.deepEqual(res.written.sort(), ['another.html', 'index.html', 'test-page.html']);
    for (const f of res.written) {
      const html = fs.readFileSync(path.join(out, f), 'utf8');
      assertWellFormed(html, f, dir);
      assert.doesNotMatch(html, /\s(?:src|href)="(?!data:|#|https?:|mailto:|[\w-]+\.html)/, `${f} points outside itself`);
    }
    compareDir(out, path.join(GOLDEN, 'expected', 'html'));
    const page = fs.readFileSync(path.join(out, 'test-page.html'), 'utf8');
    assert.match(page, /<img src="data:image\/png;base64,[A-Za-z0-9+/=]+" alt="Test page: the sample picture on its own line" width="240" \/>/);
    assert.match(page, /<a href="another\.html#first-steps">another guide<\/a>/);
    assert.match(page, /<a href="index\.html">the guides' index<\/a>/);
    assert.match(page, /<h2 id="a-repeated-heading-1">/);
    assert.match(page, /<div class="alert alert-caution" role="note"><p class="alert-title">Caution<\/p>/);
    assert.match(fs.readFileSync(path.join(out, 'another.html'), 'utf8'), /<img src="data:image\/svg\+xml;base64,/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a placeholder card in place stops the conversion, with its file and line', () => {
  const dir = stageSet();
  try {
    for (const run of [convert, convertHtml]) {
      const res = run({ root: dir, setFile: SET, release: RELEASE, out: path.join(dir, 'out') });
      assert.deepEqual(res.problems.map((p) => [p.file, p.line, p.rule]), [['docs/more/another-guide.md', 9, 'placeholder']]);
      assert.match(res.problems[0].message, /shot card/);
      assert.deepEqual(res.written, []);
    }
    assert.ok(!fs.existsSync(path.join(dir, 'out')));
    // the CLI exits 1 and names it
    const r = spawnSync('node', [path.join(WIKI, 'scripts', 'to-confluence.mjs'), '--set', SET, '--release', RELEASE], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /docs\/more\/another-guide\.md:9: placeholder/);
    const ok = spawnSync('node', [path.join(WIKI, 'scripts', 'to-confluence.mjs'), '--set', SET, '--release', RELEASE, '--allow-placeholders'], { cwd: dir, encoding: 'utf8' });
    assert.equal(ok.status, 0, ok.stderr);
    assert.ok(fs.existsSync(path.join(dir, '.user-guides/out/confluence/top.xhtml')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('an unsupported construct fails the conversion, or with --escape-unsupported shows as text', () => {
  const dir = stageSet();
  try {
    const f = path.join(dir, 'docs/more/another-guide.md');
    fs.appendFileSync(f, '\n<details>hidden</details>\n');
    const res = convert({ root: dir, setFile: SET, release: RELEASE, allowPlaceholders: true, out: path.join(dir, 'out') });
    assert.deepEqual(res.problems.map((p) => [p.file, p.line, p.rule]), [['docs/more/another-guide.md', 11, 'subset']]);
    const esc = convert({ root: dir, setFile: SET, release: RELEASE, allowPlaceholders: true, escapeUnsupported: true, out: path.join(dir, 'out') });
    assert.deepEqual(esc.problems, []);
    assert.ok(esc.notes.some((n) => /another-guide\.md:11: shown as escaped text/.test(n)));
    assert.match(fs.readFileSync(path.join(dir, 'out/another.xhtml'), 'utf8'), /<p>&lt;details&gt;hidden&lt;\/details&gt;<\/p>/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('topGuide opens the top page: its intro, the guides, "On this page", then the rest', () => {
  const dir = stageSet({ topGuide: 'test-page' });
  try {
    const out = path.join(dir, 'out');
    const res = convert({ root: dir, setFile: SET, release: RELEASE, allowPlaceholders: true, out });
    assert.deepEqual(res.problems, []);
    assert.deepEqual(res.written.sort(), ['another.xhtml', 'pages.json', 'top.xhtml']);
    const top = fs.readFileSync(path.join(out, 'top.xhtml'), 'utf8');
    assertWellFormed(wrapStorage(top), 'top.xhtml', dir);
    const at = (re) => top.search(re);
    assert.equal(at(/This page is made from/), -1, 'no banner (R34)');
    assert.ok(at(/This page holds every construct/) === top.indexOf('<p>') + 3, 'the top page opens with the guide');
    assert.ok(at(/This page holds every construct/) < at(/<ri:page ri:content-title="Another guide" \/><ac:link-body>Another guide/));
    assert.ok(at(/<ac:link-body>Another guide<\/ac:link-body>/) < at(/ac:name="panel"><ac:parameter ac:name="title">On this page/));
    assert.ok(at(/On this page/) < at(/<h1>.*Lists<\/h1>/));
    // on the top page, images and links to it need no page name
    assert.match(top, /<ri:attachment ri:filename="test-page\.png"><\/ri:attachment>/);
    const another = fs.readFileSync(path.join(out, 'another.xhtml'), 'utf8');
    assert.match(another, /<ac:link ac:anchor="tables"><ri:page ri:content-title="Example user guides" \/>/);
    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'pages.json'), 'utf8'));
    assert.equal(manifest.top.guide, 'test-page');
    assert.deepEqual(manifest.pages.map((p) => [p.id, p.parent]), [['another', null]]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('image names must be unique, since every image is attached to the top page', () => {
  const dir = stageSet();
  try {
    fs.mkdirSync(path.join(dir, 'docs/more/x'), { recursive: true });
    fs.copyFileSync(path.join(dir, 'docs/guides/test-page.png'), path.join(dir, 'docs/more/x/test-page.png'));
    fs.appendFileSync(path.join(dir, 'docs/more/another-guide.md'), '\n![Another guide: the same name](x/test-page.png)\n');
    const prep = prepare({ root: dir, setFile: SET, release: RELEASE, allowPlaceholders: true });
    assert.ok(prep.problems.some((p) => p.rule === 'image' && /two images share the name test-page\.png/.test(p.message)));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── bundle ──────────────────────────────────────────────────────────────────────────────

test('bundle: batches stay under the limit, in order; an oversized file is a problem', () => {
  const files = [5, 3, 2, 6, 1].map((mb, k) => ({ name: `f${k}.png`, bytes: mb * 1_000_000 }));
  const { batches, problems } = bundle(files);
  assert.deepEqual(problems, []);
  assert.deepEqual(batches.map((b) => b.files.map((f) => f.name)), [['f0.png', 'f1.png'], ['f2.png', 'f3.png'], ['f4.png']]);
  for (const b of batches) assert.ok(b.bytes < 9_000_000);
  assert.equal(bundle([{ name: 'big.png', bytes: 9_000_000 }]).problems.length, 1);

  const dir = stageSet();
  try {
    convert({ root: dir, setFile: SET, release: RELEASE, allowPlaceholders: true });
    const r = spawnSync('node', [path.join(WIKI, 'scripts', 'bundle.mjs')], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(fs.readFileSync(path.join(dir, '.user-guides/out/confluence/batches.json'), 'utf8'));
    assert.deepEqual(out.map((b) => b.files.map((f) => f.name)), [['card.svg', 'test-page.png']]);
    fs.appendFileSync(path.join(dir, 'docs/guides/test-page.png'), 'x');
    const stale = spawnSync('node', [path.join(WIKI, 'scripts', 'bundle.mjs')], { cwd: dir, encoding: 'utf8' });
    assert.equal(stale.status, 1);
    assert.match(stale.stderr, /changed since the conversion/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the well-formedness check itself catches broken XHTML', () => {
  assert.deepEqual(wellFormed('<root><p>a &amp; b</p></root>'), []);
  assert.ok(wellFormed('<root><p>a & b</p></root>').length);
  assert.ok(wellFormed('<root><p><b>x</p></b></root>').length);
  assert.ok(wellFormed('<root><img src=x></root>').length);
  assert.ok(wellFormed('<root><br></root>').length);
  assert.ok(wellFormed('<a/><b/>').length);
});
