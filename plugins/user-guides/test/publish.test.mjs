// S8: the mock Confluence, the publisher (publish-core.js in Node and in a page), publish-kit
// and check-page. Every scenario runs against fixtures/mock-confluence on port 0: nothing here
// can reach a real wiki.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { browserAvailable, DEV_PLAYWRIGHT, PLUGIN_DIR, SCRIPTS } from './helpers.mjs';
import { wellFormed } from './xml.mjs';

const WIKI = path.join(PLUGIN_DIR, 'skills', 'wiki-guides', 'scripts');
const { startMock, storageProblem, TOP_ID } = await import(path.join(PLUGIN_DIR, 'fixtures', 'mock-confluence', 'server.mjs'));
const gs = await import(path.join(WIKI, 'guide-set.mjs'));
const { convert } = await import(path.join(WIKI, 'to-confluence.mjs'));
const kit = await import(path.join(WIKI, 'publish-kit.mjs'));
const { isLocal, loadCore } = await import(path.join(WIKI, 'publish-node.mjs'));

const SET = 'docs/user-guides/guides.json';
const OUT = '.user-guides/out/confluence';
const TOP_TITLE = 'Product guides';
const GUIDES = ['getting-started', 'employee', 'manager'];
const MARK = /^user-guides \S+ sha256:[0-9a-f]{64}$/;

// ── helpers ─────────────────────────────────────────────────────────────────────────────

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
/** A real PNG, w × h, its pixels set by `seed`. */
function png(w, h, seed = 0) {
  const row = w * 3 + 1;
  const raw = Buffer.alloc(row * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.writeUIntBE((((x >> 4) * 16 + seed * 40) & 255) * 65536 + (((y >> 3) * 8) & 255) * 256 + ((seed * 70) & 255), y * row + 1 + x * 3, 3);
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(w, 0);
  head.writeUInt32BE(h, 4);
  head[8] = 8;
  head[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** The frozen Leave Planner guides in a temp project, every card swapped for a PNG. */
function stageProject({ width = 1280 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ug-publish-'));
  fs.cpSync(path.join(PLUGIN_DIR, 'fixtures', 'leave-app-guides', 'docs'), path.join(dir, 'docs'), { recursive: true });
  const setFile = path.join(dir, SET);
  const set = gs.loadGuideSet(setFile);
  set.shots.forEach((shot, n) => {
    const svg = shot.path;
    const file = svg.replace(/\.svg$/, '.png');
    fs.writeFileSync(path.join(dir, file), png(width, 160, n + 1));
    fs.rmSync(path.join(dir, svg));
    gs.moveShot(set, shot.id, 'taken', { by: 'wiki-guides', path: file, takenAt: '2026-01-05T09:00:00.000Z', release: '1.0', fingerprint: `sha256:${'0'.repeat(64)}` });
    for (const g of set.guides) {
      const f = path.join(dir, g.file);
      fs.writeFileSync(f, fs.readFileSync(f, 'utf8').split(path.basename(svg)).join(path.basename(file)));
    }
  });
  gs.saveGuideSet(setFile, set);
  return dir;
}

const run = (script, args, cwd) =>
  new Promise((resolve) => {
    execFile('node', [path.join(WIKI, script), ...args], { cwd, encoding: 'utf8' }, (err, stdout, stderr) => {
      let json = null;
      try {
        json = JSON.parse(stdout);
      } catch {
        // not a report
      }
      resolve({ status: err ? (typeof err.code === 'number' ? err.code : 1) : 0, stdout, stderr, json });
    });
  });

/** Convert the staged project and make publish.json. */
function prepare(dir, { release = '1.0', topTitle = TOP_TITLE } = {}) {
  const res = convert({ root: dir, setFile: SET, release, topTitle });
  assert.deepEqual(res.problems, [], 'the conversion has problems');
  const made = kit.makeInput({ root: dir });
  assert.deepEqual(made.problems, []);
  return made.input;
}
const publish = (dir, mock, ...extra) => run('publish-node.mjs', ['publish', '--base', mock.url, ...extra], dir);
const plan = (dir, mock) => run('publish-node.mjs', ['plan', '--base', mock.url], dir);
function recordIt(dir) {
  const res = kit.record({ root: dir, reportFile: path.join(OUT, 'report.json'), setFile: SET });
  assert.deepEqual(res.problems, []);
  return gs.loadGuideSet(path.join(dir, SET)).publish;
}
const target = (dir, mock, more = {}) => assert.deepEqual(kit.target({ root: dir, setFile: SET, topPage: TOP_ID, baseUrl: mock.url, ...more }).problems, []);
const pagesNamed = (mock) => Object.fromEntries(mock.snapshot().pages.filter((p) => p.status === 'current').map((p) => [p.title, p]));
const noAddress = (report, label) => assert.doesNotMatch(JSON.stringify(report), /[a-z][a-z0-9+.-]*:\/\/|\?[a-z]+=/i, `${label} holds an address or a query string`);

async function firstPublish(dir, mock) {
  target(dir, mock);
  prepare(dir);
  const r = await publish(dir, mock, '--confirm-adopted');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  recordIt(dir);
  return r.json;
}

// ── the mock ────────────────────────────────────────────────────────────────────────────

test('the mock: content, versions, the trash, attachments and their token, well-formed storage', async () => {
  const mock = await startMock();
  try {
    const api = `${mock.url}/rest/api/content`;
    const json = { 'Content-Type': 'application/json' };
    const get = async (p) => (await fetch(api + p)).json();
    const found = await get(`?spaceKey=DOCS&title=${encodeURIComponent(TOP_TITLE)}&expand=version,ancestors,space`);
    assert.equal(found.size, 1);
    assert.equal(found.results[0].id, TOP_ID);
    assert.deepEqual([found.results[0].version.number, found.results[0].version.message, found.results[0].ancestors.at(-1).title, found.results[0].space.key], [1, '', 'Team home', 'DOCS']);

    const page = (title, value, more = {}) => JSON.stringify({ type: 'page', title, space: { key: 'DOCS' }, ancestors: [{ id: TOP_ID }], body: { storage: { value, representation: 'storage' } }, ...more });
    let r = await fetch(api, { method: 'POST', headers: json, body: page('A child', '<p>One &amp; two</p>') });
    assert.equal(r.status, 200);
    const made = await r.json();
    assert.equal(made.version.number, 1);
    assert.equal((await get(`/${TOP_ID}/child/page`)).results[0].id, made.id);
    r = await fetch(api, { method: 'POST', headers: json, body: page('A child', '<p>again</p>') });
    assert.equal(r.status, 400, 'a title is unique in its space');
    assert.match((await r.json()).message, /already exists/);
    for (const bad of ['<p>open', '<p>a <b>b</p></b>', '<p>fish & chips</p>', '<p class=x>y</p>']) {
      r = await fetch(api, { method: 'POST', headers: json, body: page(`Bad ${bad.length}`, bad) });
      assert.equal(r.status, 400, `storage format that is not well-formed is refused: ${bad}`);
    }
    assert.equal(storageProblem('<p>ok<br />&nbsp;</p><ac:structured-macro ac:name="code"><ac:plain-text-body><![CDATA[a < b && c]]></ac:plain-text-body></ac:structured-macro>'), null);

    r = await fetch(`${api}/${made.id}`, { method: 'PUT', headers: json, body: page('A child', '<p>two</p>', { version: { number: 3 } }) });
    assert.equal(r.status, 409, 'an update must name the next version');
    r = await fetch(`${api}/${made.id}`, { method: 'PUT', headers: json, body: page('A child', '<p>two</p>', { version: { number: 2, message: 'mine' } }) });
    assert.deepEqual([r.status, (await r.json()).version.number], [200, 2]);
    assert.equal((await get(`/${made.id}?expand=version,body.storage`)).version.message, 'mine');
    assert.equal(mock.editPage(made.id), 3, 'the hook: someone else saves the page');
    assert.deepEqual([(await get(`/${made.id}?expand=version`)).version.message, mock.snapshot().pages.find((p) => p.id === made.id).by], ['', 'A colleague']);

    const form = () => {
      const f = new FormData();
      f.append('file', new File([png(4, 4)], 'dot.png'), 'dot.png');
      f.append('comment', 'sha256:abc');
      f.append('minorEdit', 'true');
      return f;
    };
    r = await fetch(`${api}/${TOP_ID}/child/attachment`, { method: 'POST', body: form() });
    assert.equal(r.status, 403, 'an attachment without X-Atlassian-Token: no-check is refused');
    const token = { 'X-Atlassian-Token': 'no-check' };
    r = await fetch(`${api}/${TOP_ID}/child/attachment`, { method: 'POST', headers: token, body: form() });
    assert.equal(r.status, 200);
    const att = (await r.json()).results[0];
    assert.equal(att.metadata.comment, 'sha256:abc');
    r = await fetch(`${api}/${TOP_ID}/child/attachment`, { method: 'POST', headers: token, body: form() });
    assert.equal(r.status, 400, 'a second attachment of the same name is refused');
    r = await fetch(`${api}/${TOP_ID}/child/attachment/${att.id}/data`, { method: 'POST', headers: token, body: form() });
    assert.deepEqual([r.status, (await r.json()).version.number], [200, 2]);
    const listed = await get(`/${TOP_ID}/child/attachment?limit=50`);
    assert.deepEqual(listed.results.map((a) => [a.title, a.extensions.fileSize]), [['dot.png', png(4, 4).length]]);
    assert.equal((await fetch(`${mock.url}/download/attachments/${TOP_ID}/dot.png`)).headers.get('content-type'), 'image/png');

    r = await fetch(`${api}/${made.id}`, { method: 'DELETE' });
    assert.equal(r.status, 204);
    assert.equal((await fetch(`${api}/${made.id}`)).status, 404, 'a page in the trash is not found');
    assert.equal(mock.page(made.id).status, 'trashed');
    r = await fetch(api, { method: 'POST', headers: json, body: page('A child', '<p>new</p>') });
    assert.equal(r.status, 200, 'a title in the trash is free again');

    const view = await (await fetch(`${mock.url}/pages/viewpage.action?pageId=${TOP_ID}`)).text();
    assert.match(view, /<meta name="ajs-page-version" content="1" \/>/);
    assert.match(view, /#main-content\{width:656px\}/);
    assert.match(await (await fetch(`${mock.url}/rest/applinks/1.0/manifest`)).text(), /<typeId>confluence<\/typeId><version>9\.2\.0<\/version>/);
  } finally {
    await mock.close();
  }
});

test('the mock: a context path, and its cloud and unknown modes', async () => {
  const dc = await startMock({ context: '/confluence', width: 700 });
  const cloud = await startMock({ mode: 'cloud' });
  const unknown = await startMock({ mode: 'unknown' });
  try {
    assert.ok(dc.url.endsWith('/confluence'));
    assert.equal((await fetch(`${dc.origin}/rest/api/content/${TOP_ID}`)).status, 404, 'nothing answers outside the context path');
    assert.equal((await fetch(`${dc.url}/rest/api/content/${TOP_ID}`)).status, 200);
    assert.match(await (await fetch(`${dc.url}/pages/viewpage.action?pageId=${TOP_ID}`)).text(), /content="\/confluence"[\s\S]*#main-content\{width:700px\}/);
    assert.ok(cloud.url.endsWith('/wiki'));
    assert.equal((await (await fetch(`${cloud.origin}/_edge/tenant_info`)).json()).cloudId, 'mock-cloud-0000');
    assert.match(await (await fetch(`${cloud.url}/pages/viewpage.action?pageId=${TOP_ID}`)).text(), /ajs-cloud-id/);
    assert.equal((await fetch(`${unknown.url}/rest/applinks/1.0/manifest`)).status, 404);
    assert.equal((await fetch(`${unknown.origin}/_edge/tenant_info`)).status, 404);
  } finally {
    await Promise.all([dc.close(), cloud.close(), unknown.close()]);
  }
});

// ── the scenarios ───────────────────────────────────────────────────────────────────────

test('scenario: first publish. Nothing is written before the confirmation; then every page and image; a second run changes nothing', async () => {
  const mock = await startMock({ context: '/confluence' });
  const dir = stageProject();
  try {
    target(dir, mock);
    const input = prepare(dir);
    assert.deepEqual([input.topPageId, input.contextPath, input.pages.map((p) => p.id), input.images.length, input.test.images[0].name], [TOP_ID, '/confluence', GUIDES, 5, 'test-page.png']);

    const p = await plan(dir, mock);
    assert.equal(p.status, 0, p.stdout + p.stderr);
    assert.deepEqual([p.json.flavour, p.json.space, p.json.top.action, p.json.counts], ['data-center', 'DOCS', 'adopted', { create: 3, update: 0, unchanged: 0, adopted: 1, edited: 0 }]);
    assert.deepEqual([p.json.images.attach.length, p.json.needs.adopted], [5, ['top']], 'the page the user named was not made by this publisher: it needs a yes');
    noAddress(p.json, 'the plan');

    const refused = await publish(dir, mock);
    assert.equal(refused.status, 1);
    assert.deepEqual([refused.json.published, refused.json.problem, refused.json.unconfirmed], [false, 'needs-confirmation', ['adopted']]);
    assert.deepEqual(mock.writes(), [], 'nothing is written without the confirmation: no page, and no image either');
    assert.equal(mock.page(TOP_ID).versions.length, 1);

    const done = await publish(dir, mock, '--confirm-adopted');
    assert.equal(done.status, 0, done.stdout + done.stderr);
    assert.deepEqual([done.json.published, done.json.counts, done.json.top.version, done.json.pages.map((x) => [x.id, x.action, x.version])], [true, { created: 3, updated: 1, unchanged: 0 }, 2, GUIDES.map((id) => [id, 'created', 1])]);
    noAddress(done.json, 'the report');
    const snap = mock.snapshot();
    const pages = pagesNamed(mock);
    assert.match(pages[TOP_TITLE].message, MARK, 'the top page records its body hash in the version message');
    for (const title of ['Getting started with Leave Planner', 'Leave Planner for employees', 'Leave Planner for managers']) assert.equal(pages[title].parent, TOP_ID, `${title} sits under the top page`);
    assert.equal(snap.attachments.length, 5);
    for (const a of snap.attachments) assert.deepEqual([a.page, a.comment, a.version], [TOP_ID, `sha256:${a.sha256}`, 1], `${a.title} carries its sha256 in the comment`);
    for (const id of [TOP_ID, ...done.json.pages.map((x) => x.pageId)]) assert.deepEqual(wellFormed(`<r xmlns:ac="a" xmlns:ri="r">${mock.body(id)}</r>`), []);
    assert.match(mock.body(TOP_ID), /at release 1\.0\./);

    const pub = recordIt(dir);
    assert.deepEqual([pub.release, pub.confluence.space, pub.confluence.topPageId, Object.keys(pub.confluence.pages)], ['1.0', 'DOCS', TOP_ID, GUIDES]);
    for (const row of done.json.pages) assert.deepEqual(pub.confluence.pages[row.id], { pageId: row.pageId, version: 1 });

    // idempotent: the same input again, with no confirmation, writes nothing
    const before = mock.writes().length;
    prepare(dir);
    const again = await publish(dir, mock);
    assert.equal(again.status, 0, again.stdout + again.stderr);
    assert.deepEqual([again.json.counts, again.json.images.unchanged], [{ created: 0, updated: 0, unchanged: 4 }, 5]);
    assert.equal(mock.writes().length, before, 'a republish of unchanged guides sends no write');

    // a fresh clone has no last-publish.json: created pages carry no message yet, so each is
    // written once more (their versions are the recorded ones), and after that nothing is
    fs.rmSync(path.join(dir, OUT, 'last-publish.json'));
    prepare(dir);
    const clone = await publish(dir, mock);
    assert.deepEqual(clone.json.counts, { created: 0, updated: 3, unchanged: 1 });
    recordIt(dir);
    fs.rmSync(path.join(dir, OUT, 'last-publish.json'));
    prepare(dir);
    assert.deepEqual((await publish(dir, mock)).json.counts, { created: 0, updated: 0, unchanged: 4 });
  } finally {
    await mock.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('scenario: republish after v2. Only the changed image is replaced; every page reaches its next version with the new banner', async () => {
  const mock = await startMock();
  const dir = stageProject();
  try {
    await firstPublish(dir, mock);
    const v1 = mock.snapshot();

    // release 1.1: the Settings screen changed (its picture is retaken) and one guide's text
    fs.writeFileSync(path.join(dir, 'docs/user-guides/images/settings.png'), png(1280, 160, 99));
    const guide = path.join(dir, 'docs/user-guides/employee.md');
    fs.writeFileSync(guide, fs.readFileSync(guide, 'utf8') + '\nA sentence added for release 1.1.\n');
    prepare(dir, { release: '1.1' });

    const p = await plan(dir, mock);
    assert.deepEqual([p.json.images.replace, p.json.images.attach, p.json.images.unchanged, p.json.counts.update, p.json.needs], [['settings.png'], [], 4, 4, { adopted: [], foreignImages: [], edited: {} }]);
    const done = await publish(dir, mock);
    assert.equal(done.status, 0, done.stdout + done.stderr);
    assert.deepEqual([done.json.counts, done.json.images.replaced, done.json.images.attached, done.json.images.unchanged], [{ created: 0, updated: 4, unchanged: 0 }, 1, 0, 4]);

    const v2 = mock.snapshot();
    for (const a of v2.attachments) {
      const was = v1.attachments.find((x) => x.id === a.id);
      if (a.title === 'settings.png') assert.deepEqual([a.version, a.sha256 !== was.sha256, a.comment], [2, true, `sha256:${a.sha256}`]);
      else assert.deepEqual([a.version, a.sha256], [1, was.sha256], `${a.title} was not sent again`);
    }
    assert.equal(v2.pages.length, v1.pages.length, 'no page was made a second time');
    for (const pg of v2.pages.filter((x) => x.id === TOP_ID || x.parent === TOP_ID)) {
      assert.equal(pg.version, v1.pages.find((x) => x.id === pg.id).version + 1, `${pg.title} reached its next version`);
      assert.match(pg.message, /^user-guides 1\.1 sha256:/);
      assert.match(mock.body(pg.id), /at release 1\.1\./, `${pg.title} carries the new banner`);
    }
    const pub = recordIt(dir);
    assert.deepEqual([pub.release, pub.confluence.pages.employee.version], ['1.1', 2]);
  } finally {
    await mock.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('scenario: an edit made on the wiki since. The page is not overwritten until the user confirms that version', async () => {
  const mock = await startMock();
  const dir = stageProject();
  try {
    const first = await firstPublish(dir, mock);
    const employee = first.pages.find((x) => x.id === 'employee').pageId;
    mock.editPage(employee, { body: '<p>A colleague rewrote this page on the wiki.</p>' });
    prepare(dir, { release: '1.1' });

    const p = await plan(dir, mock);
    assert.deepEqual([p.json.needs.edited, p.json.counts.edited, p.json.pages.find((x) => x.id === 'employee').action], [{ [employee]: 2 }, 1, 'edited']);
    const before = mock.writes().length;
    for (const extra of [[], ['--confirm-adopted'], ['--confirm-edited', `${employee}=1`]]) {
      const r = await publish(dir, mock, ...extra);
      assert.deepEqual([r.status, r.json.published, r.json.problem, r.json.unconfirmed], [1, false, 'needs-confirmation', [`edited:${employee}`]], `refused with ${extra.join(' ') || 'no confirmation'}`);
    }
    assert.equal(mock.writes().length, before, 'nothing at all was written: not the other pages either');
    assert.equal(mock.body(employee), '<p>A colleague rewrote this page on the wiki.</p>');

    const done = await publish(dir, mock, '--confirm-edited', `${employee}=2`);
    assert.equal(done.status, 0, done.stdout + done.stderr);
    assert.deepEqual([done.json.pages.find((x) => x.id === 'employee').version, done.json.counts], [3, { created: 0, updated: 4, unchanged: 0 }]);
    assert.match(mock.body(employee), /at release 1\.1\./);
    recordIt(dir);

    // someone saves between the publisher's read and its write: the wiki refuses the stale
    // version, the publisher stops there and says which pages went out
    const manager = first.pages.find((x) => x.id === 'manager').pageId;
    prepare(dir, { release: '1.2' });
    mock.raceOnPut(manager);
    const raced = await publish(dir, mock);
    assert.equal(raced.status, 1);
    assert.deepEqual([raced.json.ok, raced.json.failed.id, raced.json.failed.status, raced.json.pages.map((x) => x.id)], [false, 'manager', 409, ['getting-started', 'employee']]);
    assert.doesNotMatch(mock.body(manager), /at release 1\.2\./, 'the colleague’s save stands');
    const part = kit.record({ root: dir, reportFile: path.join(OUT, 'report.json'), setFile: SET });
    assert.deepEqual([part.problems, part.partial], [[], true]);
    prepare(dir, { release: '1.2' });
    const after = await plan(dir, mock);
    assert.deepEqual([after.json.needs.edited, after.json.counts], [{ [manager]: 3 }, { create: 0, update: 0, unchanged: 3, adopted: 0, edited: 1 }], 'next time, only that page asks');
  } finally {
    await mock.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('scenario: adopted hand-made pages are updated in place by id after one confirmation', async () => {
  const mock = await startMock({ seed: 'adopted' });
  const dir = stageProject();
  try {
    // adopt seeds the page ids it was told of, with no version (PLAN R8); one guide is left
    // for the publisher to find by its title under the top page
    target(dir, mock);
    const setFile = path.join(dir, SET);
    const set = gs.loadGuideSet(setFile);
    set.publish.confluence.pages = { 'getting-started': { pageId: '1010', version: null }, employee: { pageId: '1011', version: null } };
    gs.saveGuideSet(setFile, set);
    prepare(dir);
    const seeded = mock.snapshot();

    const p = await plan(dir, mock);
    assert.deepEqual([p.json.needs.adopted, p.json.needs.foreignImages, p.json.needs.edited, p.json.counts.create], [['top', ...GUIDES], ['settings.png'], {}, 0]);
    const refused = await publish(dir, mock);
    assert.deepEqual([refused.status, refused.json.problem, refused.json.unconfirmed], [1, 'needs-confirmation', ['adopted']]);
    const now = mock.snapshot();
    assert.deepEqual(now.pages, seeded.pages, 'no hand-made page was touched');
    assert.deepEqual(now.attachments.find((a) => a.title === 'settings.png'), seeded.attachments.find((a) => a.title === 'settings.png'), 'the picture uploaded by hand was held back');

    const done = await publish(dir, mock, '--confirm-adopted');
    assert.equal(done.status, 0, done.stdout + done.stderr);
    assert.deepEqual(done.json.counts, { created: 0, updated: 4, unchanged: 0 });
    assert.deepEqual(done.json.pages.map((x) => [x.id, x.pageId, x.version]), [['getting-started', '1010', 3], ['employee', '1011', 4], ['manager', '1012', 2]]);
    assert.equal(done.json.top.version, 5);
    const after = mock.snapshot();
    assert.equal(after.pages.length, seeded.pages.length, 'updated in place: no new page');
    assert.deepEqual([after.attachments.find((a) => a.title === 'settings.png').version, after.attachments.length], [2, 5]);
    for (const id of ['1010', '1011', '1012', TOP_ID]) assert.match(after.pages.find((x) => x.id === id).message, MARK);
    assert.equal(recordIt(dir).confluence.pages.manager.pageId, '1012');
    prepare(dir);
    assert.deepEqual((await publish(dir, mock)).json.counts, { created: 0, updated: 0, unchanged: 4 }, 'and from then on they are the publisher’s own');
  } finally {
    await mock.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

for (const mode of ['cloud', 'unknown']) {
  test(`scenario: ${mode === 'cloud' ? 'Confluence Cloud' : 'a wiki that cannot be identified'} is refused, and nothing is sent`, async () => {
    const mock = await startMock({ mode });
    const dir = stageProject();
    try {
      target(dir, mock);
      prepare(dir);
      const d = await run('publish-node.mjs', ['detect', '--base', mock.url], dir);
      assert.deepEqual([d.status, d.json.ok, d.json.flavour], [1, false, mode]);
      if (mode === 'cloud') assert.ok(d.json.signals.includes('cloud:tenant'));
      else assert.deepEqual(d.json.signals, []);
      for (const cmd of ['plan', 'test', 'publish']) {
        const r = await run('publish-node.mjs', [cmd, '--base', mock.url, '--confirm-adopted'], dir);
        assert.deepEqual([r.status, r.json.ok, r.json.flavour], [1, false, mode], cmd);
      }
      // the calls themselves refuse too, however they are reached
      const { api } = loadCore({ base: mock.url, files: [{ name: 'publish.json', path: path.join(dir, OUT, 'publish.json') }] });
      await api.load();
      for (const call of [() => api.plan(), () => api.attach({ confirm: { adopted: true } }), () => api.publish({ confirm: { adopted: true } }), () => api.test(), () => api.removeTest('1002')]) {
        const r = await call();
        assert.deepEqual([r.ok, r.problem, r.refused], [false, 'refused', mode]);
      }
      assert.deepEqual(mock.writes(), [], 'not one write request reached the wiki');
      assert.equal(mock.state.log.filter((x) => x.path.startsWith('/rest/api/')).length, 0, 'not even a read of its content');
    } finally {
      await mock.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

test('a title used elsewhere in the space stops the publish, whatever is confirmed', async () => {
  const mock = await startMock();
  const dir = stageProject();
  try {
    const other = mock.addPage({ title: 'Leave Planner for managers', parent: '1000' });
    target(dir, mock);
    prepare(dir);
    const p = await plan(dir, mock);
    assert.equal(p.status, 1);
    assert.deepEqual(p.json.stops.map((s) => [s.id, s.why, s.pageId]), [['manager', 'title-taken', other.id]]);
    const r = await publish(dir, mock, '--confirm-adopted');
    assert.deepEqual([r.status, r.json.published, r.json.problem], [1, false, 'stops']);
    assert.deepEqual(mock.writes(), [], 'nothing was written, images included');
  } finally {
    await mock.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('other stops: a top title that is not the wiki’s, a recorded page that is gone, a top page that cannot be read', async () => {
  const mock = await startMock();
  const dir = stageProject();
  try {
    target(dir, mock);
    prepare(dir, { topTitle: 'Some other title' });
    const title = await publish(dir, mock, '--confirm-adopted');
    assert.deepEqual([title.status, title.json.problem, title.json.title], [1, 'top-title', TOP_TITLE]);

    const first = await firstPublish(dir, mock);
    const manager = first.pages.find((x) => x.id === 'manager').pageId;
    await fetch(`${mock.url}/rest/api/content/${manager}`, { method: 'DELETE' });
    const before = mock.writes().length;
    prepare(dir, { release: '1.1' });
    const gone = await publish(dir, mock, '--confirm-adopted');
    assert.deepEqual([gone.status, gone.json.problem, gone.json.stops.map((x) => [x.id, x.why, x.pageId])], [1, 'stops', [['manager', 'gone', manager]]]);
    assert.equal(mock.writes().length, before, 'a page someone removed is not quietly made again, and nothing else is written');

    const set = gs.loadGuideSet(path.join(dir, SET));
    set.publish.confluence.topPageId = '4242';
    set.publish.confluence.pages = {};
    gs.saveGuideSet(path.join(dir, SET), set);
    prepare(dir, { release: '1.1' });
    const unread = await publish(dir, mock, '--confirm-adopted');
    assert.deepEqual([unread.status, unread.json.problem], [1, 'top-page']);
    assert.match(unread.json.message, /Is this browser signed in/);
    assert.equal(mock.writes().length, before);
  } finally {
    await mock.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the test page: written under the top page with its own picture, then removed; the real pages are untouched', async () => {
  const mock = await startMock();
  const dir = stageProject();
  try {
    target(dir, mock);
    prepare(dir);
    const t = await run('publish-node.mjs', ['test', '--base', mock.url], dir);
    assert.equal(t.status, 0, t.stdout + t.stderr);
    assert.deepEqual([t.json.test.action, t.json.images.attached], ['created', 1]);
    const id = t.json.test.pageId;
    const made = mock.snapshot();
    assert.deepEqual([made.pages.find((p) => p.id === id).title, made.pages.find((p) => p.id === id).parent], [`${TOP_TITLE}: publishing test`, TOP_ID]);
    assert.deepEqual(made.attachments.map((a) => [a.page, a.title]), [[id, 'test-page.png']], 'its picture is attached to the test page, not to the top page');
    assert.equal(made.pages.find((p) => p.id === TOP_ID).version, 1, 'the top page was not written');
    const view = await (await fetch(`${mock.url}/pages/viewpage.action?pageId=${id}`)).text();
    assert.match(view, new RegExp(`<img class="confluence-embedded-image" width="\\d+"[^>]*src="/download/attachments/${id}/test-page\\.png`));
    assert.doesNotMatch(view, /ac:|ri:/, 'the mock renders every construct of the test page');

    const twice = await run('publish-node.mjs', ['test', '--base', mock.url], dir);
    assert.deepEqual([twice.json.test.action, twice.json.test.pageId, twice.json.images.unchanged], ['updated', id, 1]);
    const wrong = await run('publish-node.mjs', ['remove-test', '--base', mock.url, '--page-id', '1002'], dir);
    assert.deepEqual([wrong.status, wrong.json.problem, mock.page('1002').status], [1, 'not-the-test-page', 'current']);
    const gone = await run('publish-node.mjs', ['remove-test', '--base', mock.url, '--page-id', id], dir);
    assert.deepEqual([gone.status, gone.json.removed, mock.page(id).status], [0, id, 'trashed']);
  } finally {
    await mock.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('publish-node.mjs refuses anything but localhost, and no script holds a credential', async () => {
  for (const base of ['https://wiki.example.com', 'https://wiki.example.com/confluence', 'http://localhost.example.com', 'http://user:pw@localhost:8090', 'ftp://localhost']) assert.equal(isLocal(base), false, base);
  for (const base of ['http://localhost:8090', 'http://127.0.0.1:1/confluence', `http://${'[::1]'}:8090`]) assert.equal(isLocal(base), true, base);
  const dir = stageProject();
  try {
    for (const cmd of ['detect', 'plan', 'publish', 'test']) {
      const r = await run('publish-node.mjs', [cmd, '--base', 'https://wiki.example.com/confluence', '--confirm-adopted'], dir);
      assert.equal(r.status, 2, cmd);
      assert.match(r.stderr, /refused: publish-node\.mjs talks only to a wiki on localhost/);
    }
    assert.throws(() => loadCore({ base: 'https://wiki.example.com' }), /only to a wiki on localhost/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  for (const f of ['publish-core.js', 'publish-node.mjs', 'publish-kit.mjs', 'check-page.js']) {
    const text = fs.readFileSync(path.join(WIKI, f), 'utf8');
    assert.doesNotMatch(text, /authorization|bearer |api[_-]?token|personal access|passwd|\.cookie/i, `${f} handles a credential`);
  }
});

test('publish-kit: what stops the input, the target and the record; bundle --only', async () => {
  const dir = stageProject();
  try {
    assert.match(kit.makeInput({ root: dir }).problems[0], /pages\.json: missing\. Convert first/);
    assert.deepEqual(convert({ root: dir, setFile: SET, release: '1.0', topTitle: TOP_TITLE }).problems, []);
    assert.match(kit.makeInput({ root: dir }).problems[0], /no page to publish under/);
    assert.ok(!fs.existsSync(path.join(dir, OUT, 'publish.json')), 'no input without a page to publish under');

    assert.deepEqual(kit.target({ root: dir, setFile: SET, topPage: '1001', baseUrl: 'https://wiki.example.com/confluence', space: 'DOCS', topGuide: 'getting-started' }).problems, []);
    const input = prepare(dir);
    assert.deepEqual([input.contextPath, input.space, input.top.guide, input.pages.map((p) => p.id), input.top.version], ['/confluence', 'DOCS', 'getting-started', ['employee', 'manager'], null], 'the top guide opens the top page and is no page of its own');
    for (const p of [input.top, ...input.pages, input.test]) assert.equal(p.hash, kit.pageHash(p.title, p.body));
    assert.deepEqual(wellFormed(`<r xmlns:ac="a" xmlns:ri="r">${input.test.body}</r>`), []);
    assert.doesNotMatch(input.test.body, /<ri:attachment[^>]*><ri:page/, 'the test page shows its own attachment');
    assert.match(input.test.body, new RegExp(`<ri:page ri:content-title="${TOP_TITLE}" />`), 'and links to the top page by its title');

    // a report from a publish under a top guide records the top page under that guide
    const report = { ok: true, published: true, release: '1.0', space: 'DOCS', top: { pageId: '1001', version: 2, hash: input.top.hash, action: 'updated', guide: 'getting-started' }, pages: [{ id: 'employee', pageId: '2000', version: 1, hash: input.pages[0].hash, action: 'created' }] };
    fs.writeFileSync(path.join(dir, OUT, 'report.json'), JSON.stringify(report));
    const pub = recordIt(dir);
    assert.deepEqual(pub.confluence.pages, { 'getting-started': { pageId: '1001', version: 2 }, employee: { pageId: '2000', version: 1 } });
    const next = prepare(dir);
    assert.deepEqual([next.top.version, next.top.sent.version, next.pages[0].pageId, next.pages[0].sent.hash, next.pages[1].pageId], [2, 2, '2000', input.pages[0].hash, null]);
    assert.match(kit.target({ root: dir, setFile: SET, topPage: '1002' }).problems[0], /recorded under page 1001/);
    for (const notOne of [{ ok: false, problem: 'refused', refused: 'cloud' }, { ok: true, flavour: 'data-center', pages: [] }, { ok: true, test: { pageId: '5' } }]) {
      fs.writeFileSync(path.join(dir, OUT, 'other.json'), JSON.stringify(notOne));
      assert.match(kit.record({ root: dir, reportFile: path.join(OUT, 'other.json'), setFile: SET }).problems[0], /not a publish report/);
    }

    const only = await run('bundle.mjs', ['--only', 'settings.png,inbox.png'], dir);
    assert.equal(only.status, 0, only.stderr);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, OUT, 'batches.json'), 'utf8')).flatMap((b) => b.files.map((f) => f.name)), ['inbox.png', 'settings.png']);
    assert.match((await run('bundle.mjs', ['--only', 'nope.png'], dir)).stderr, /nope\.png: not an image/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── in a page ───────────────────────────────────────────────────────────────────────────

test('in a page: inject the script, fill the input, publish; reload and inject again; check-page catches 900 px and passes at 640', async (t) => {
  if (!(await browserAvailable())) return t.skip('Chromium does not start here');
  const core = await import(path.join(SCRIPTS, 'kit-core.mjs'));
  const pw = await core.loadPlaywright(core.findPlaywright({ env: { ...process.env, USER_GUIDES_PLAYWRIGHT_CORE: DEV_PLAYWRIGHT } }));
  const mock = await startMock({ context: '/confluence', width: 656 });
  const dir = stageProject({ width: 1800 });
  const browser = await pw.chromium.launch({ headless: true });
  try {
    const coreText = fs.readFileSync(path.join(WIKI, 'publish-core.js'), 'utf8');
    const checkText = fs.readFileSync(path.join(WIKI, 'check-page.js'), 'utf8');
    const out = (name) => path.join(dir, OUT, name);
    const images = (input) => input.images.map((i) => path.join(dir, i.path));
    const view = (id) => `${mock.url}/pages/viewpage.action?pageId=${id}`;
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const inject = async () => {
      assert.equal(await page.evaluate(coreText), 'user-guides publisher 1 ready');
      assert.deepEqual(await page.evaluate('userGuides.input()'), { ok: true, input: 'user-guides-upload', files: 0 });
    };
    const check = async (id, version) => {
      await page.goto(view(id));
      assert.match(await page.evaluate(checkText), /page check ready/);
      return page.evaluate(`userGuidesCheck({ version: ${version} })`);
    };

    // the images are 1800 px wide at scale 2: with the cap at 900 they run past the column
    target(dir, mock, { imageCap: 900 });
    let input = prepare(dir);
    await page.goto(view(TOP_ID));
    await inject();
    const found = await page.evaluate('userGuides.detect()');
    assert.deepEqual([found.flavour, found.version, found.contextPath, found.page], ['data-center', '9.2.0', '/confluence', { id: TOP_ID, version: 1, title: TOP_TITLE, space: 'DOCS' }]);
    assert.deepEqual(found.signals, ['data-center:manifest', 'data-center:meta']);
    assert.equal((await page.evaluate('userGuides.plan()')).problem, 'no-input', 'no plan before the input is loaded');

    await page.setInputFiles('#user-guides-upload', [out('publish.json'), out('test-page.png')]);
    assert.deepEqual(await page.evaluate('userGuides.load()'), { ok: true, release: '1.0', topPageId: TOP_ID, pages: 3, images: 5, test: true });
    const testPage = await page.evaluate('userGuides.test()');
    assert.deepEqual([testPage.ok, testPage.test.action, testPage.images.attached], [true, 'created', 1]);
    const tested = await check(testPage.test.pageId, 1);
    assert.deepEqual([tested.ok, tested.images, tested.loaded, tested.brokenAnchors, tested.unresolvedPageLinks], [true, 2, 2, [], 0], JSON.stringify(tested)); // the template shows its one picture twice
    assert.ok(tested.anchors >= 2, 'the test page has in-page links to check');
    mock.editPage(testPage.test.pageId, { body: `${mock.body(testPage.test.pageId)}<p><ac:link ac:anchor="nowhere"><ac:link-body>a link to nothing</ac:link-body></ac:link></p>` });
    assert.deepEqual([(await page.evaluate('userGuidesCheck({ version: 2 })')).stale, (await check(testPage.test.pageId, 2)).brokenAnchors], [true, ['a link to nothing']], 'a stale view is named, and a link without its target is caught');

    // back on the top page: the reload removed the script and the input
    await page.goto(view(TOP_ID));
    assert.equal(await page.evaluate('typeof userGuides'), 'undefined');
    await inject();
    await page.setInputFiles('#user-guides-upload', [out('publish.json')]);
    await page.evaluate('userGuides.load()');
    const removed = await page.evaluate(`userGuides.removeTest('${testPage.test.pageId}')`);
    assert.deepEqual([removed.ok, mock.page(testPage.test.pageId).status], [true, 'trashed']);
    const first = await page.evaluate('userGuides.plan()');
    assert.deepEqual([first.needs.adopted, first.images.attach.length], [['top'], 5]);
    assert.equal((await page.evaluate('userGuides.publish({ confirm: { adopted: true } })')).problem, 'images', 'no page before its images');

    // two upload batches; each replaces the input's files, and the loaded input stays in memory
    await page.setInputFiles('#user-guides-upload', images(input).slice(0, 3));
    assert.equal((await page.evaluate('userGuides.attach()')).problem, 'needs-confirmation');
    assert.deepEqual(mock.writes().filter((w) => w.includes(`/${TOP_ID}`)), [], 'the top page has not been written to yet, its attachments included');
    const yes = '{ confirm: { adopted: true } }';
    assert.deepEqual(await page.evaluate(`userGuides.attach(${yes}).then((r) => [r.attached, r.waiting.length])`), [3, 2]);
    await page.setInputFiles('#user-guides-upload', images(input).slice(3));
    assert.deepEqual(await page.evaluate(`userGuides.attach(${yes}).then((r) => [r.attached, r.unchanged, r.waiting.length, r.ok])`), [2, 3, 0, true]);
    assert.equal((await page.evaluate('userGuides.publish()')).problem, 'needs-confirmation');
    const done = await page.evaluate('userGuides.publish({ confirm: { adopted: true } })');
    assert.deepEqual([done.ok, done.counts, done.top.version], [true, { created: 3, updated: 1, unchanged: 0 }, 2]);
    noAddress(done, 'the in-page report');
    fs.writeFileSync(out('report.json'), JSON.stringify(done));
    recordIt(dir);

    // reload: the script and the input are gone; inject again, load again, and nothing is left to do
    await page.reload();
    assert.equal(await page.evaluate('typeof userGuides'), 'undefined');
    assert.equal(await page.evaluate('document.getElementById("user-guides-upload")'), null);
    input = prepare(dir);
    await inject();
    await page.setInputFiles('#user-guides-upload', [out('publish.json')]);
    await page.evaluate('userGuides.load()');
    const again = await page.evaluate('userGuides.publish()');
    assert.deepEqual([again.ok, again.counts], [true, { created: 0, updated: 0, unchanged: 4 }]);

    // check-page: 900 px in a 656 px column is caught
    const employee = done.pages.find((x) => x.id === 'employee');
    const wide = await check(employee.pageId, employee.version);
    assert.deepEqual([wide.ok, wide.images, wide.loaded, wide.column, wide.widest, wide.tooWide.sort()], [false, 3, 3, 656, 900, ['my-requests.png', 'request-dialog.png', 'settings.png']], JSON.stringify(wide));
    assert.match(wide.message, /lower publish\.confluence\.imageCap/);

    // lower the cap to 640, convert and publish again from the page: it passes
    target(dir, mock, { imageCap: 640 });
    prepare(dir);
    await page.goto(view(TOP_ID));
    await inject();
    await page.setInputFiles('#user-guides-upload', [out('publish.json')]);
    await page.evaluate('userGuides.load()');
    const narrow = await page.evaluate('userGuides.publish()');
    assert.deepEqual([narrow.ok, narrow.counts], [true, { created: 0, updated: 3, unchanged: 1 }], 'the three guide pages changed; the top page shows no image');
    const fits = await check(employee.pageId, 2);
    assert.deepEqual([fits.ok, fits.loaded, fits.widest, fits.tooWide, fits.brokenAnchors, fits.unresolvedPageLinks], [true, 3, 640, [], [], 0], JSON.stringify(fits));
    const keep = process.env.USER_GUIDES_TEST_SHOTS; // a folder: keep pictures of the mock's pages, to look at
    if (keep) await page.screenshot({ path: path.join(keep, 'mock-guide-page.png'), fullPage: true });
    const top = await check(TOP_ID, 2);
    if (keep) await page.screenshot({ path: path.join(keep, 'mock-top-page.png'), fullPage: true });
    assert.deepEqual([top.ok, top.unresolvedPageLinks, top.page], [true, 0, { id: TOP_ID, version: 2 }], JSON.stringify(top));
  } finally {
    await browser.close();
    await mock.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
