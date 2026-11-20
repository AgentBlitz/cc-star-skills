#!/usr/bin/env node
// mock-confluence: a dependency-free stand-in for the part of Confluence Data Center that the
// user-guides publisher talks to. It keeps everything in memory and listens on port 0.
//
//   node server.mjs [--mode data-center|cloud|unknown] [--context /confluence]
//                   [--seed empty|adopted|<file.json>] [--width 656] [--port 0]
//     prints "mock-confluence (<mode>) listening on http://127.0.0.1:<port><context>"
//
// As a module: startMock({ mode, context, seed, width, port }) → { url, origin, context, state,
// writes(), editPage(id, …), addPage(…), raceOnPut(id), snapshot(), close() }.
// README.md lists the REST subset, the view page and the /__mock control paths.

import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DC_VERSION = '9.2.0';
export const TOP_ID = '1001';

const HAND = '<p>Written by hand on the wiki.</p>';
/** Built-in seeds. Hand-made pages carry no version message (PLAN R21). */
export const SEEDS = {
  // an empty page to publish under, a sibling, and nothing else
  empty: {
    pages: [
      { id: '1000', space: 'DOCS', title: 'Team home', body: '<p>Welcome to the team space.</p>' },
      { id: TOP_ID, space: 'DOCS', title: 'Product guides', parent: '1000', body: '<p>The guides will go here.</p>' },
      { id: '1002', space: 'DOCS', title: 'Meeting notes', parent: '1000', body: '<p>Notes.</p>' },
    ],
  },
  // the same, with the Leave Planner guides already there as hand-made pages and one picture
  adopted: {
    pages: [
      { id: '1000', space: 'DOCS', title: 'Team home', body: '<p>Welcome to the team space.</p>' },
      { id: TOP_ID, space: 'DOCS', title: 'Product guides', parent: '1000', body: `<h1>Leave Planner</h1>${HAND}`, versions: 4 },
      { id: '1002', space: 'DOCS', title: 'Meeting notes', parent: '1000', body: '<p>Notes.</p>' },
      { id: '1010', space: 'DOCS', title: 'Getting started with Leave Planner', parent: TOP_ID, body: HAND, versions: 2 },
      { id: '1011', space: 'DOCS', title: 'Leave Planner for employees', parent: TOP_ID, body: HAND, versions: 3 },
      { id: '1012', space: 'DOCS', title: 'Leave Planner for managers', parent: TOP_ID, body: HAND },
    ],
    attachments: [{ page: TOP_ID, name: 'settings.png', text: 'a picture uploaded by hand' }],
  },
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unesc = (s) => String(s).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const MEDIA = { png: 'image/png', svg: 'image/svg+xml', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif' };
const mediaOf = (name) => MEDIA[name.split('.').pop().toLowerCase()] || 'application/octet-stream';

/** null when the storage format is well-formed, else what is wrong with it. */
export function storageProblem(x) {
  const stack = [];
  const bare = /&(?!(?:[a-zA-Z][a-zA-Z0-9]*|#\d+|#x[0-9a-fA-F]+);)/;
  let i = 0;
  while (i < x.length) {
    const lt = x.indexOf('<', i);
    if (bare.test(x.slice(i, lt < 0 ? x.length : lt))) return 'a bare & in text';
    if (lt < 0) break;
    if (x.startsWith('<![CDATA[', lt)) {
      const e = x.indexOf(']]>', lt);
      if (e < 0) return 'a CDATA section is not closed';
      i = e + 3;
      continue;
    }
    const gt = x.indexOf('>', lt);
    if (gt < 0) return 'a tag is not closed';
    const m = /^(\/?)([A-Za-z_][\w.:-]*)((?:\s+[\w.:-]+="[^"<]*")*)\s*(\/?)$/.exec(x.slice(lt + 1, gt));
    if (!m) return `a malformed tag: <${x.slice(lt + 1, Math.min(gt, lt + 40))}>`;
    if (bare.test(m[3])) return 'a bare & in an attribute';
    if (m[1]) {
      const open = stack.pop();
      if (open !== m[2]) return `</${m[2]}> closes <${open ?? 'nothing'}>`;
    } else if (!m[4]) stack.push(m[2]);
    i = gt + 1;
  }
  return stack.length ? `<${stack.pop()}> is not closed` : null;
}

function parseMultipart(buf, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType || '');
  if (!m) return null;
  const boundary = Buffer.from('--' + (m[1] || m[2]));
  const parts = [];
  let pos = buf.indexOf(boundary);
  while (pos >= 0) {
    const start = pos + boundary.length;
    if (buf.subarray(start, start + 2).toString() === '--') break;
    const next = buf.indexOf(boundary, start);
    if (next < 0) break;
    const part = buf.subarray(start + 2, next - 2);
    const headEnd = part.indexOf('\r\n\r\n');
    const head = part.subarray(0, headEnd).toString('utf8');
    parts.push({
      name: /[; ]name="([^"]*)"/i.exec(head)?.[1],
      filename: /filename="([^"]*)"/i.exec(head)?.[1],
      data: part.subarray(headEnd + 4),
    });
    pos = next;
  }
  return parts;
}

export async function startMock({ mode = 'data-center', context, seed = 'empty', width = 656, port = 0 } = {}) {
  if (!['data-center', 'cloud', 'unknown'].includes(mode)) throw new Error(`unknown mode: ${mode}`);
  const ctx = (context ?? (mode === 'cloud' ? '/wiki' : '')).replace(/\/$/, '');
  const state = { mode, context: ctx, width, pages: new Map(), attachments: new Map(), log: [], nextId: 2000, nextAtt: 5000, race: new Set() };
  const now = () => new Date().toISOString();
  const cur = (p) => p.versions[p.versions.length - 1];
  const live = (id) => {
    const p = state.pages.get(String(id));
    return p && p.status === 'current' ? p : null;
  };
  const byTitle = (space, title) => [...state.pages.values()].find((p) => p.status === 'current' && p.space === space && p.title === title) || null;
  const children = (id) => [...state.pages.values()].filter((p) => p.status === 'current' && p.parent === String(id));
  const ancestors = (p) => {
    const out = [];
    for (let a = p.parent && state.pages.get(p.parent); a; a = a.parent && state.pages.get(a.parent)) out.unshift(a);
    return out;
  };
  const attachmentsOf = (id) => [...state.attachments.values()].filter((a) => a.page === String(id)).sort((a, b) => a.title.localeCompare(b.title));

  /** Add a page as if someone had written it by hand: no version message. */
  function addPage({ id, space = 'DOCS', title, parent = null, body = HAND, versions = 1, message = '', by = 'A colleague' }) {
    const pid = String(id ?? state.nextId++);
    const p = { id: pid, space, title, parent: parent ? String(parent) : null, status: 'current', versions: [] };
    for (let n = 1; n <= versions; n++) p.versions.push({ number: n, message, by, when: now(), body });
    state.pages.set(pid, p);
    return p;
  }
  /** Someone else edits a page on the wiki: its next version, with no message of ours. */
  function editPage(id, { body, title, message = '', by = 'A colleague' } = {}) {
    const p = live(id);
    if (!p) throw new Error(`no page ${id}`);
    const v = cur(p);
    if (title) p.title = title;
    p.versions.push({ number: v.number + 1, message, by, when: now(), body: body ?? `${v.body}<p>An edit made on the wiki.</p>` });
    return cur(p).number;
  }
  function addAttachment(pageId, name, data, comment = '') {
    const a = { id: `att${state.nextAtt++}`, page: String(pageId), title: name, data, comment, version: 1 };
    state.attachments.set(a.id, a);
    return a;
  }

  const seedData = typeof seed === 'string' ? SEEDS[seed] || JSON.parse(fs.readFileSync(seed, 'utf8')) : seed;
  for (const p of seedData.pages || []) addPage(p);
  for (const a of seedData.attachments || []) addAttachment(a.page, a.name, Buffer.from(a.text ?? '', 'utf8'), a.comment || '');

  // ── JSON shapes ───────────────────────────────────────────────────────────────────────
  const pageJson = (p, expand) => {
    const v = cur(p);
    const j = { id: p.id, type: 'page', status: p.status, title: p.title };
    if (expand.has('space')) j.space = { key: p.space, name: p.space };
    if (expand.has('version')) j.version = { number: v.number, message: v.message, minorEdit: false, when: v.when, by: { type: 'known', displayName: v.by } };
    if (expand.has('ancestors')) j.ancestors = ancestors(p).map((a) => ({ id: a.id, type: 'page', title: a.title }));
    if (expand.has('body.storage')) (j.body ??= {}).storage = { value: v.body, representation: 'storage' };
    if (expand.has('body.view')) (j.body ??= {}).view = { value: renderView(p), representation: 'view' };
    j._links = { webui: `/pages/viewpage.action?pageId=${p.id}` };
    return j;
  };
  const WRITTEN = new Set(['space', 'version', 'ancestors', 'body.storage']);
  const attJson = (a) => ({
    id: a.id,
    type: 'attachment',
    status: 'current',
    title: a.title,
    version: { number: a.version },
    metadata: { comment: a.comment, mediaType: mediaOf(a.title) },
    extensions: { mediaType: mediaOf(a.title), fileSize: a.data.length, comment: a.comment },
  });
  const listJson = (all, q) => {
    const start = Number(q.get('start') || 0);
    const limit = Math.min(Number(q.get('limit') || 25), 200);
    const results = all.slice(start, start + limit);
    const j = { results, start, limit, size: results.length, _links: {} };
    if (start + limit < all.length) j._links.next = `?limit=${limit}&start=${start + limit}`;
    return j;
  };
  const error = (statusCode, message) => ({ statusCode, data: { authorized: statusCode !== 403, valid: statusCode !== 400, errors: [], successful: false }, message });

  // ── the view page ─────────────────────────────────────────────────────────────────────
  // Data Center prefixes an anchor's id with the page title, spaces removed.
  const anchorId = (p, a) => `${p.title.replace(/\s+/g, '')}-${a}`;
  function renderView(p) {
    let h = cur(p).body;
    h = h.replace(/<ac:structured-macro ac:name="code">([\s\S]*?)<\/ac:structured-macro>/g, (m, inner) => {
      const c = /<!\[CDATA\[([\s\S]*)\]\]>/.exec(inner);
      return `<div class="code panel"><pre>${esc(c ? c[1].split(']]]]><![CDATA[>').join(']]>') : '')}</pre></div>`;
    });
    h = h.replace(/<ac:structured-macro ac:name="anchor"><ac:parameter ac:name="">([^<]*)<\/ac:parameter><\/ac:structured-macro>/g, (m, a) => `<span class="confluence-anchor-link" id="${esc(anchorId(p, unesc(a)))}"></span>`);
    h = h.replace(/<ac:structured-macro ac:name="toc">[\s\S]*?<\/ac:structured-macro>/g, '<div class="toc-macro"></div>');
    h = h.replace(/<ac:image([^>]*)><ri:attachment ri:filename="([^"]*)"\s*(?:\/>|>(?:<ri:page ri:content-title="([^"]*)"\s*\/>)?<\/ri:attachment>)<\/ac:image>/g, (m, attrs, file, onPage) => {
      const holder = onPage ? byTitle(p.space, unesc(onPage)) : p;
      const att = holder && attachmentsOf(holder.id).find((a) => a.title === unesc(file));
      const w = / ac:width="(\d+)"/.exec(attrs)?.[1];
      const alt = / ac:alt="([^"]*)"/.exec(attrs)?.[1] || '';
      if (!att) return `<img class="confluence-embedded-image unresolved" title="Unknown Attachment" alt="${alt}" src="${ctx}/images/unknown-attachment.png" />`;
      return `<img class="confluence-embedded-image"${w ? ` width="${w}"` : ''} alt="${alt}" src="${ctx}/download/attachments/${holder.id}/${encodeURIComponent(att.title)}?version=${att.version}" />`;
    });
    h = h.replace(/<ac:link(?: ac:anchor="([^"]*)")?>(?:<ri:page ri:content-title="([^"]*)"\s*\/>)?<ac:link-body>([\s\S]*?)<\/ac:link-body><\/ac:link>/g, (m, anchor, title, body) => {
      const to = title ? byTitle(p.space, unesc(title)) : p;
      if (!to) return `<a class="createlink unresolved" href="#">${body}</a>`;
      const hash = anchor ? `#${encodeURIComponent(anchorId(to, unesc(anchor)))}` : '';
      return `<a href="${to === p ? hash || '#' : `${ctx}/pages/viewpage.action?pageId=${to.id}${hash}`}">${body}</a>`;
    });
    const boxed = /<ac:structured-macro ac:name="(info|note|warning|panel)">((?:<ac:parameter[^>]*>[^<]*<\/ac:parameter>)*)<ac:rich-text-body>((?:(?!<ac:structured-macro)[\s\S])*?)<\/ac:rich-text-body><\/ac:structured-macro>/g;
    for (let k = 0; k < 5 && boxed.test(h); k++) {
      h = h.replace(boxed, (m, name, params, body) => {
        const title = /<ac:parameter ac:name="title">([^<]*)<\/ac:parameter>/.exec(params)?.[1];
        return `<div class="confluence-information-macro ${name}">${title ? `<p class="title">${title}</p>` : ''}<div class="confluence-information-macro-body">${body}</div></div>`;
      });
    }
    return h;
  }
  function viewPage(p) {
    const v = cur(p);
    const meta = [
      ['ajs-page-id', p.id],
      ['ajs-page-version', v.number],
      ['ajs-page-title', p.title],
      ['ajs-space-key', p.space],
    ];
    if (mode !== 'unknown') meta.push(['ajs-context-path', ctx], ['ajs-version-number', mode === 'cloud' ? '1000.0.0' : DC_VERSION]);
    if (mode === 'cloud') meta.push(['ajs-cloud-id', 'mock-cloud-0000']);
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><title>${esc(p.title)} - ${esc(p.space)} - Mock wiki</title>
${meta.map(([n, c]) => `<meta name="${n}" content="${esc(c)}" />`).join('\n')}
<style>body{margin:0;font:14px/1.5 sans-serif}#main{padding:20px 40px}#main-content{width:${state.width}px}table{border-collapse:collapse}td,th{border:1px solid #c1c7d0;padding:4px 8px}.confluence-information-macro{border:1px solid #c1c7d0;padding:8px;margin:8px 0}pre{background:#f4f5f7;padding:8px;overflow:auto}</style>
</head><body><div id="main"><h1 id="title-text">${esc(p.title)}</h1>
<div id="main-content" class="wiki-content">
${renderView(p)}
</div></div></body></html>
`;
  }

  // ── requests ──────────────────────────────────────────────────────────────────────────
  const readBody = (req) =>
    new Promise((resolve) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => resolve(Buffer.concat(chunks)));
    });

  function checkWrite(p, j, isNew) {
    const title = j.title;
    if (typeof title !== 'string' || !title.trim()) return error(400, 'A title is required.');
    const clash = byTitle(p.space, title);
    if (clash && clash.id !== p.id) return error(400, `A page with this title already exists: A page already exists with the title ${title} in the space with key ${p.space}`);
    const value = j.body?.storage?.value;
    if (isNew && typeof value !== 'string') return error(400, 'A body in storage format is required.');
    if (value !== undefined) {
      if (j.body.storage.representation !== 'storage') return error(400, 'The body must be in the storage representation.');
      const bad = storageProblem(value);
      if (bad) return error(400, `Error parsing xhtml: ${bad}`);
    }
    return null;
  }

  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const q = url.searchParams;
    const send = (status, body, type = 'application/json') => {
      const data = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
      res.writeHead(status, { 'Content-Type': Buffer.isBuffer(body) || typeof body === 'string' ? type : 'application/json', 'Content-Length': data.length, 'Cache-Control': 'no-store' });
      res.end(data);
    };
    const expand = new Set((q.get('expand') || '').split(',').filter(Boolean));

    // the mock's own control paths, outside the context path
    if (url.pathname.startsWith('/__mock/')) {
      const what = url.pathname.slice(8);
      if (what === 'state' && req.method === 'GET') return send(200, snapshot());
      const body = req.method === 'POST' ? JSON.parse((await readBody(req)).toString() || '{}') : {};
      if (what === 'edit' && req.method === 'POST') return live(q.get('pageId')) ? send(200, { version: editPage(q.get('pageId'), body) }) : send(404, error(404, 'No such page'));
      if (what === 'page' && req.method === 'POST') return send(200, { id: addPage(body).id });
      if (what === 'race' && req.method === 'POST') return state.race.add(String(q.get('pageId'))), send(200, { ok: true });
      return send(404, error(404, 'No such control path'));
    }
    if (mode === 'cloud' && url.pathname === '/_edge/tenant_info') return send(200, { cloudId: 'mock-cloud-0000' });
    if (ctx && !(url.pathname === ctx || url.pathname.startsWith(ctx + '/'))) return send(404, '<html><body>Not found</body></html>', 'text/html');
    const pathname = url.pathname.slice(ctx.length) || '/';
    if (pathname.startsWith('/rest/') || pathname.startsWith('/download/')) state.log.push({ method: req.method, path: pathname });

    if (pathname === '/rest/applinks/1.0/manifest') {
      if (mode === 'unknown') return send(404, '<html><body>Not found</body></html>', 'text/html');
      return send(200, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><manifest><id>00000000-0000-0000-0000-000000000000</id><name>Mock wiki</name><typeId>confluence</typeId><version>${mode === 'cloud' ? '1000.0.0' : DC_VERSION}</version><buildNumber>9109</buildNumber><applinksVersion>10.0.0</applinksVersion></manifest>`, 'application/xml');
    }

    if (pathname === '/pages/viewpage.action') {
      const p = live(q.get('pageId'));
      return p ? send(200, viewPage(p), 'text/html; charset=utf-8') : send(404, '<html><body>Page not found</body></html>', 'text/html');
    }
    let m = /^\/download\/attachments\/(\d+)\/([^/]+)$/.exec(pathname);
    if (m) {
      const a = attachmentsOf(m[1]).find((x) => x.title === decodeURIComponent(m[2]));
      return a ? send(200, a.data, mediaOf(a.title)) : send(404, 'Not found', 'text/plain');
    }
    if (pathname === '/') return send(200, `<!doctype html><html><head><title>Mock wiki</title></head><body><ul>${[...state.pages.values()].filter((p) => p.status === 'current').map((p) => `<li><a href="${ctx}/pages/viewpage.action?pageId=${p.id}">${esc(p.title)}</a></li>`).join('')}</ul></body></html>`, 'text/html; charset=utf-8');

    if (!pathname.startsWith('/rest/api/content')) return send(404, error(404, 'No such resource'));
    const rest = pathname.slice('/rest/api/content'.length);

    if (rest === '' && req.method === 'GET') {
      const all = [...state.pages.values()].filter((p) => p.status === 'current' && (!q.get('spaceKey') || p.space === q.get('spaceKey')) && (!q.get('title') || p.title === q.get('title')));
      return send(200, listJson(all.map((p) => pageJson(p, expand)), q));
    }
    if (rest === '' && req.method === 'POST') {
      const j = JSON.parse((await readBody(req)).toString() || '{}');
      if (j.type !== 'page') return send(400, error(400, 'Only pages can be created here.'));
      const space = j.space?.key;
      if (![...state.pages.values()].some((p) => p.space === space)) return send(404, error(404, `No space with key: ${space}`));
      const parent = j.ancestors?.length ? live(j.ancestors[j.ancestors.length - 1].id) : null;
      if (j.ancestors?.length && (!parent || parent.space !== space)) return send(400, error(400, 'The parent page does not exist in this space.'));
      const bad = checkWrite({ id: null, space }, j, true);
      if (bad) return send(bad.statusCode, bad);
      const p = addPage({ space, title: j.title, parent: parent?.id, body: j.body.storage.value, message: j.version?.message || '', by: 'The signed-in user' });
      return send(200, pageJson(p, WRITTEN));
    }

    m = /^\/(\d+)(\/.*)?$/.exec(rest);
    if (!m) return send(404, error(404, 'No such resource'));
    const p = live(m[1]);
    const sub = m[2] || '';
    if (!p) return send(404, error(404, `No content found with id: ${m[1]}`));

    if (sub === '' && req.method === 'GET') return send(200, pageJson(p, expand));
    if (sub === '' && req.method === 'PUT') {
      const j = JSON.parse((await readBody(req)).toString() || '{}');
      if (state.race.delete(p.id)) editPage(p.id); // someone saves just before this request lands
      const n = cur(p).number;
      if (j.version?.number !== n + 1) return send(409, error(409, `Version must be incremented on update. Current version is: ${n}`));
      const bad = checkWrite(p, j, false);
      if (bad) return send(bad.statusCode, bad);
      if (j.ancestors?.length) {
        const parent = live(j.ancestors[j.ancestors.length - 1].id);
        if (!parent || parent.space !== p.space) return send(400, error(400, 'The parent page does not exist in this space.'));
        p.parent = parent.id;
      }
      p.title = j.title;
      p.versions.push({ number: n + 1, message: j.version.message || '', by: 'The signed-in user', when: now(), body: j.body?.storage?.value ?? cur(p).body });
      return send(200, pageJson(p, WRITTEN));
    }
    if (sub === '' && req.method === 'DELETE') {
      const trash = (x) => {
        x.status = 'trashed';
        for (const c of [...state.pages.values()].filter((y) => y.parent === x.id && y.status === 'current')) trash(c);
      };
      trash(p);
      res.writeHead(204);
      return res.end();
    }
    if (sub === '/child/page' && req.method === 'GET') return send(200, listJson(children(p.id).map((c) => pageJson(c, expand)), q));
    if (sub === '/child/attachment' && req.method === 'GET') {
      const all = attachmentsOf(p.id).filter((a) => !q.get('filename') || a.title === q.get('filename'));
      return send(200, listJson(all.map(attJson), q));
    }
    const data = /^\/child\/attachment(?:\/(att\d+)\/data)?$/.exec(sub);
    if (data && req.method === 'POST') {
      const body = await readBody(req);
      if (!['no-check', 'nocheck'].includes(String(req.headers['x-atlassian-token'] || '').toLowerCase())) return send(403, 'XSRF check failed', 'text/plain');
      const parts = parseMultipart(body, req.headers['content-type']);
      const files = (parts || []).filter((x) => x.name === 'file' && x.filename !== undefined);
      if (!files.length) return send(400, error(400, 'At least one attachment file must be included.'));
      const comment = parts.find((x) => x.name === 'comment')?.data.toString('utf8') || '';
      if (data[1]) {
        const a = state.attachments.get(data[1]);
        if (!a || a.page !== p.id) return send(404, error(404, `No attachment with id ${data[1]} on this page`));
        a.data = Buffer.from(files[0].data);
        a.comment = comment;
        a.version += 1;
        return send(200, attJson(a));
      }
      const have = attachmentsOf(p.id);
      const dup = files.find((f) => have.some((a) => a.title === f.filename));
      if (dup) return send(400, error(400, `Cannot add a new attachment with same file name as an existing attachment: ${dup.filename}`));
      return send(200, { results: files.map((f) => attJson(addAttachment(p.id, f.filename, Buffer.from(f.data), comment))), size: files.length });
    }
    return send(404, error(404, 'No such resource'));
  }

  /** What tests and graders read: pages, attachments, and every write request so far. */
  function snapshot() {
    return {
      mode,
      context: ctx,
      pages: [...state.pages.values()].map((p) => ({ id: p.id, space: p.space, title: p.title, parent: p.parent, status: p.status, version: cur(p).number, message: cur(p).message, by: cur(p).by, bodySha256: sha(cur(p).body), bodyLength: cur(p).body.length })),
      attachments: [...state.attachments.values()].map((a) => ({ id: a.id, page: a.page, title: a.title, comment: a.comment, version: a.version, bytes: a.data.length, sha256: sha(a.data) })),
      writes: writes(),
    };
  }
  const writes = () => state.log.filter((r) => r.method !== 'GET').map((r) => `${r.method} ${r.path}`);

  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(error(500, String(err.message || err))));
    });
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    url: origin + ctx,
    origin,
    context: ctx,
    state,
    page: (id) => state.pages.get(String(id)),
    body: (id) => cur(state.pages.get(String(id))).body,
    addPage,
    editPage,
    raceOnPut: (id) => state.race.add(String(id)),
    writes,
    snapshot,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections?.();
        server.close(resolve);
      }),
  };
}

async function main(argv) {
  const a = { mode: 'data-center', seed: 'empty', width: '656', port: '0' };
  for (let i = 0; i < argv.length; i++) {
    const m = argv[i].match(/^--(mode|context|seed|width|port)(?:=(.*))?$/);
    if (!m) return console.error(`unexpected argument: ${argv[i]}`), 2;
    a[m[1]] = m[2] ?? argv[++i];
  }
  let mock;
  try {
    mock = await startMock({ mode: a.mode, context: a.context, seed: a.seed, width: Number(a.width), port: Number(a.port) });
  } catch (err) {
    return console.error(err.message), 2;
  }
  console.log(`mock-confluence (${a.mode}) listening on ${mock.url}`);
  const stop = () => mock.close().then(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  return null;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  const code = await main(process.argv.slice(2));
  if (code !== null) process.exitCode = code;
}
export const MOCK_DIR = path.dirname(fileURLToPath(import.meta.url));
