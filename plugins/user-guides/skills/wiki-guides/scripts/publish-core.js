// publish-core.js: the user-guides publisher for Confluence Data Center. One script, two hosts:
// in the wiki page (pass this whole text to the browser's JavaScript tool; the page's own
// sign-in does the rest) and in Node (publish-node.mjs, a local mock only). It installs
// `userGuides`: input, load, detect, plan, attach, publish, test, removeTest.
// reference/chrome-publishing.md gives the calls in order. Rules it keeps:
//   - the flavour is detected first; nothing is sent to Confluence Cloud or an unidentified wiki;
//   - a page is overwritten only when its current version is the one last published, or the
//     user confirmed it; every update names the version it replaces;
//   - an unchanged image or page is skipped;
//   - reports hold ids and counts, never URLs.
(function (root) {
  'use strict';
  var VERSION = 1;
  var INPUT_ID = 'user-guides-upload';
  var PAGE_MARK = /^user-guides\b.*\bsha256:([0-9a-f]{64})$/;
  var IMAGE_MARK = /^sha256:[0-9a-f]{64}$/;
  var host = { origin: '', contextPath: null, files: null, fetch: null };
  var mem = { input: null, ctx: null, found: null };

  var doc = function () { return typeof document !== 'undefined' ? document : null; };
  var meta = function (name) {
    var e = doc() && doc().querySelector('meta[name="ajs-' + name + '"]');
    return e ? e.getAttribute('content') || '' : '';
  };
  var clean = function (s) { return String(s || '').replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, '(address)').replace(/\s+/g, ' ').trim().slice(0, 300); };
  var stop = function (problem, message, more) { return Object.assign({ ok: false, published: false, problem: problem, message: message }, more || {}); };

  async function raw(path, init) {
    try {
      var r = await (host.fetch || fetch)(host.origin + path, Object.assign({ credentials: 'include' }, init || {}));
      var text = await r.text();
      var json = null;
      try { json = JSON.parse(text); } catch (e) { /* not JSON: a sign-in page, an error page */ }
      return { status: r.status, ok: r.ok, text: text, json: json, message: clean(json && json.message ? json.message : r.ok ? '' : text) };
    } catch (e) {
      return { status: 0, ok: false, text: '', json: null, message: clean(e && e.message) };
    }
  }
  function call(method, path, body) {
    var init = { method: method, headers: { Accept: 'application/json' } };
    if (method !== 'GET') init.headers['X-Atlassian-Token'] = 'no-check';
    if (body && typeof body.append === 'function') init.body = body;
    else if (body) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    return raw(mem.ctx + '/rest/api/content' + path, init);
  }

  // ── files: the injected input in a page, the host's list in Node ────────────────────────
  function input() {
    var d = doc();
    if (!d) return { ok: false, problem: 'no-page', message: 'There is no page here: the Node host passes its files itself.' };
    var el = d.getElementById(INPUT_ID);
    if (!el) {
      el = d.createElement('input');
      el.type = 'file';
      el.multiple = true;
      el.id = INPUT_ID;
      el.setAttribute('aria-label', 'user-guides upload');
      d.body.appendChild(el);
    }
    return { ok: true, input: INPUT_ID, files: el.files.length };
  }
  async function files() {
    if (host.files) return host.files();
    var el = doc() && doc().getElementById(INPUT_ID);
    return el ? Array.prototype.slice.call(el.files) : [];
  }
  async function load() {
    var all = await files();
    var f = all.filter(function (x) { return x.name === 'publish.json'; })[0];
    if (!f) return stop('no-input', 'publish.json is not in the upload input: add the input, upload publish.json, and load again.');
    var data;
    try { data = JSON.parse(await f.text()); } catch (e) { return stop('bad-input', 'publish.json is not valid JSON.'); }
    if (data.tool !== 'user-guides' || data.format !== 1 || !data.topPageId || !data.top) return stop('bad-input', 'publish.json is not a user-guides publish input (make it again with publish-kit.mjs input).');
    mem.input = data;
    return { ok: true, release: data.release, topPageId: data.topPageId, pages: data.pages.length, images: data.images.length, test: !!data.test };
  }

  // ── the flavour, first ─────────────────────────────────────────────────────────────────
  async function detect() {
    var loc = host.origin ? new URL(host.origin + (host.contextPath || '') + '/') : location;
    var signals = [];
    if (/(^|\.)(atlassian\.net|jira\.com)$/i.test(loc.hostname)) signals.push('cloud:host');
    if (meta('cloud-id')) signals.push('cloud:meta');
    var tenant = await raw('/_edge/tenant_info');
    if (tenant.ok && tenant.json && tenant.json.cloudId) signals.push('cloud:tenant');
    var first = '/' + loc.pathname.split('/')[1];
    var tries = [host.contextPath, doc() && doc().querySelector('meta[name="ajs-context-path"]') ? meta('context-path') : null, mem.input && mem.input.contextPath, '', first.length > 1 ? first : null];
    var ctx = null;
    var version = null;
    var seen = {};
    for (var i = 0; i < tries.length && ctx === null; i++) {
      var c = tries[i];
      if (c === null || c === undefined || seen[c]) continue;
      seen[c] = true;
      var m = await raw(c + '/rest/applinks/1.0/manifest', { headers: { Accept: 'application/xml' } });
      var v = /<version>\s*(\d+\.\d+[^<\s]*)/.exec(m.text);
      if (m.ok && /<typeId>\s*confluence\s*<\/typeId>/.test(m.text) && v) {
        ctx = c;
        version = v[1];
        signals.push('data-center:manifest');
      }
    }
    if (meta('version-number')) signals.push('data-center:meta');
    var cloud = signals.some(function (s) { return s.indexOf('cloud:') === 0; });
    var flavour = cloud ? 'cloud' : ctx !== null ? 'data-center' : 'unknown';
    mem.ctx = ctx;
    mem.found = { flavour: flavour, signals: signals, version: flavour === 'data-center' ? version : null };
    var out = { ok: flavour === 'data-center', flavour: flavour, signals: signals, version: mem.found.version, contextPath: ctx };
    if (doc()) out.page = { id: meta('page-id') || null, version: Number(meta('page-version')) || null, title: meta('page-title') || null, space: meta('space-key') || null };
    if (flavour === 'cloud') out.message = 'This is Confluence Cloud. user-guides publishes to Confluence Data Center only, so nothing was sent. HTML files are the other destination.';
    if (flavour === 'unknown') out.message = 'This wiki could not be identified as Confluence Data Center, so nothing was sent.';
    return out;
  }
  /** null when this is Data Center; otherwise the refusal every other call returns. */
  async function refused() {
    if (!mem.found) await detect();
    if (mem.found.flavour === 'data-center') return null;
    return stop('refused', mem.found.flavour === 'cloud' ? 'This is Confluence Cloud: nothing was sent. user-guides publishes to Confluence Data Center only.' : 'This wiki could not be identified as Confluence Data Center: nothing was sent.', { refused: mem.found.flavour, signals: mem.found.signals });
  }

  // ── reading the wiki: what each page and image needs ───────────────────────────────────
  var messageFor = function (hash) { return 'user-guides ' + mem.input.release + ' sha256:' + hash; };
  /** skip · update · adopted (no version recorded) · edited (another version than recorded). */
  function judge(cur, p) {
    var n = cur.version.number;
    var mark = PAGE_MARK.exec(cur.version.message || '');
    if (mark && mark[1] === p.hash) return 'skip';
    if (p.sent && p.sent.version === n && p.sent.hash === p.hash) return 'skip';
    if (mark || (p.version && p.version === n)) return 'update';
    return p.version ? 'edited' : 'adopted';
  }
  async function attachmentsOf(pageId) {
    var all = {};
    for (var start = 0; ; start += 100) {
      var r = await call('GET', '/' + pageId + '/child/attachment?limit=100&start=' + start);
      if (!r.ok || !r.json) return null;
      r.json.results.forEach(function (a) { all[a.title] = { id: a.id, comment: (a.metadata && a.metadata.comment) || (a.extensions && a.extensions.comment) || '' }; });
      if (r.json.results.length < 100) return all;
    }
  }
  function imageState(have, img) {
    var a = have[img.name];
    if (!a) return 'attach';
    if (a.comment === img.sha256) return 'unchanged';
    return IMAGE_MARK.test(a.comment) ? 'replace' : 'foreign';
  }
  async function survey() {
    var inp = mem.input;
    if (!inp) return stop('no-input', 'Load publish.json first.');
    var t = await call('GET', '/' + inp.topPageId + '?expand=version,space,ancestors');
    if (!t.ok || !t.json || !t.json.version) return stop('top-page', 'The top page could not be read (status ' + t.status + '). Is this browser signed in, and may this account see the page?');
    var space = t.json.space.key;
    if (inp.space && inp.space !== space) return stop('space', 'The top page is in space ' + space + ', not ' + inp.space + '.');
    if (t.json.title !== inp.top.title) return stop('top-title', 'The top page is titled "' + t.json.title + '" on the wiki. Convert again with --top-title set to that, then make the input again.', { title: t.json.title });
    var s = { ok: true, space: space, top: { pageId: String(inp.topPageId), version: t.json.version.number, action: judge(t.json, inp.top) }, pages: [], stops: [] };
    var ids = {};
    for (var i = 0; i < inp.pages.length; i++) {
      var p = inp.pages[i];
      var row = { id: p.id, pageId: p.pageId ? String(p.pageId) : null, version: null, action: 'create' };
      var parentId = p.parent ? ids[p.parent] || null : s.top.pageId;
      row.parentId = parentId;
      if (p.parent && !(p.parent in ids)) s.stops.push({ id: p.id, why: 'parent', message: 'its parent guide "' + p.parent + '" is not in this publish' });
      var cur = null;
      if (row.pageId) {
        var r = await call('GET', '/' + row.pageId + '?expand=version,space,ancestors');
        if (!r.ok || !r.json || !r.json.version) s.stops.push({ id: p.id, pageId: row.pageId, why: 'gone', message: 'its recorded page could not be read (status ' + r.status + '): restore it, or remove its entry from publish.confluence.pages to make a new page' });
        else if (r.json.space.key !== space) s.stops.push({ id: p.id, pageId: row.pageId, why: 'space', message: 'its recorded page is in another space' });
        else cur = r.json;
      }
      if (!cur || cur.title !== p.title) {
        var f = await call('GET', '?spaceKey=' + encodeURIComponent(space) + '&title=' + encodeURIComponent(p.title) + '&expand=version,ancestors');
        var hit = f.ok && f.json && f.json.results[0];
        if (!f.ok || !f.json) s.stops.push({ id: p.id, why: 'lookup', message: 'the space could not be searched for its title (status ' + f.status + ')' });
        else if (hit && hit.id !== row.pageId) {
          var under = hit.ancestors && hit.ancestors.length ? hit.ancestors[hit.ancestors.length - 1].id : null;
          if (!row.pageId && parentId && under === parentId) {
            cur = hit; // made by an earlier publish that was not recorded, or by hand: update it in place
            row.pageId = hit.id;
          } else s.stops.push({ id: p.id, pageId: hit.id, why: 'title-taken', message: 'the title "' + p.title + '" is already used by another page in this space: rename the guide, or adopt that page by its id' });
        }
        if (cur && cur.title !== p.title) row.rename = true;
      }
      if (cur) {
        row.version = cur.version.number;
        row.action = judge(cur, p);
      }
      ids[p.id] = row.pageId || 'new:' + p.id;
      s.pages.push(row);
    }
    var have = await attachmentsOf(s.top.pageId);
    if (!have) return stop('attachments', "The top page's attachments could not be listed.");
    s.have = have;
    s.images = inp.images.map(function (img) { return { name: img.name, state: imageState(have, img) }; });
    return s;
  }
  var named = function (list, state) { return list.filter(function (x) { return x.state === state; }).map(function (x) { return x.name; }); };
  function needsOf(s) {
    var rows = [Object.assign({ id: 'top' }, s.top)].concat(s.pages);
    var adopted = rows.filter(function (r) { return r.action === 'adopted'; }).map(function (r) { return r.id; });
    var edited = {};
    rows.filter(function (r) { return r.action === 'edited'; }).forEach(function (r) { edited[r.pageId] = r.version; });
    return { adopted: adopted, foreignImages: named(s.images, 'foreign'), edited: edited };
  }
  function unmet(needs, confirm) {
    confirm = confirm || {};
    var out = [];
    if ((needs.adopted.length || needs.foreignImages.length) && confirm.adopted !== true) out.push('adopted');
    Object.keys(needs.edited).forEach(function (id) { if (!confirm.edited || confirm.edited[id] !== needs.edited[id]) out.push('edited:' + id); });
    return out;
  }
  function planOf(s) {
    var count = function (a) { return s.pages.filter(function (r) { return r.action === a; }).length + (s.top.action === a ? 1 : 0); };
    var needs = needsOf(s);
    var strip = function (r) { return { id: r.id, pageId: r.pageId, version: r.version, action: r.action, rename: r.rename || undefined }; };
    return {
      ok: !s.stops.length,
      flavour: 'data-center',
      space: s.space,
      top: { pageId: s.top.pageId, version: s.top.version, action: s.top.action },
      pages: s.pages.map(strip),
      counts: { create: count('create'), update: count('update'), unchanged: count('skip'), adopted: count('adopted'), edited: count('edited') },
      images: { attach: named(s.images, 'attach'), replace: named(s.images, 'replace'), foreign: needs.foreignImages, unchanged: named(s.images, 'unchanged').length },
      needs: needs,
      stops: s.stops,
      message: s.stops.length
        ? 'Nothing can be published until the stops are settled.'
        : unmet(needs).length
          ? 'Ask the user before publishing: pages and images listed under needs were not made by this publisher, or were edited on the wiki since the last publish.'
          : 'Nothing needs confirming.',
    };
  }
  async function plan() {
    var no = await refused();
    if (no) return no;
    var s = await survey();
    return s.ok ? planOf(s) : s;
  }

  // ── writing ────────────────────────────────────────────────────────────────────────────
  async function sameBytes(file, img) {
    if (file.size !== img.bytes) return false;
    var subtle = typeof crypto !== 'undefined' && crypto.subtle;
    if (!subtle) return true; // a page served over plain http has no hashing: the size stands in
    var hex = Array.prototype.map.call(new Uint8Array(await subtle.digest('SHA-256', await file.arrayBuffer())), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    return 'sha256:' + hex === img.sha256;
  }
  /** Upload the given images to a page: new ones, and ones whose bytes changed. */
  async function upload(pageId, images, have, mayReplaceForeign) {
    var all = await files();
    var out = { attached: 0, replaced: 0, unchanged: 0, held: [], waiting: [], failed: [] };
    for (var i = 0; i < images.length; i++) {
      var img = images[i];
      var state = imageState(have, img);
      if (state === 'unchanged') { out.unchanged++; continue; }
      if (state === 'foreign' && !mayReplaceForeign) { out.held.push(img.name); continue; }
      var file = all.filter(function (f) { return f.name === img.name; })[0];
      if (!file) { out.waiting.push(img.name); continue; }
      if (!(await sameBytes(file, img))) { out.failed.push({ name: img.name, why: 'changed since the conversion: convert again' }); continue; }
      var form = new FormData();
      form.append('file', file, img.name);
      form.append('comment', img.sha256);
      form.append('minorEdit', 'true');
      var r = await call('POST', '/' + pageId + '/child/attachment' + (state === 'attach' ? '' : '/' + have[img.name].id + '/data'), form);
      if (!r.ok) { out.failed.push({ name: img.name, status: r.status, why: r.message }); continue; }
      have[img.name] = { id: have[img.name] ? have[img.name].id : null, comment: img.sha256 };
      if (state === 'attach') out.attached++;
      else out.replaced++;
    }
    out.ok = !out.failed.length && !out.held.length;
    return out;
  }
  /** Attach the images now in the input to the top page. Call once per upload batch. Like
   *  publish, it writes nothing until everything the plan lists under needs is confirmed. */
  async function attach(opts) {
    var no = await refused();
    if (no) return no;
    var s = await survey();
    if (!s.ok) return s;
    if (s.stops.length) return stop('stops', 'Nothing was attached: the plan has stops.', { stops: s.stops });
    var needs = needsOf(s);
    var missing = unmet(needs, opts && opts.confirm);
    if (missing.length) return stop('needs-confirmation', 'Nothing was attached. Ask the user, then pass the confirmation.', { needs: needs, unconfirmed: missing });
    var out = await upload(s.top.pageId, mem.input.images, s.have, true);
    if (out.waiting.length) out.message = 'Still to upload: the images listed under waiting. Put the next batch in the input and call attach again.';
    return out;
  }
  function pageBody(title, space, body, hash, version, parentId) {
    var j = { type: 'page', title: title, space: { key: space }, body: { storage: { value: body, representation: 'storage' } } };
    if (version) j.version = { number: version, message: messageFor(hash) };
    if (parentId) j.ancestors = [{ id: parentId }];
    return j;
  }
  async function publish(opts) {
    var no = await refused();
    if (no) return no;
    var s = await survey();
    if (!s.ok) return s;
    var inp = mem.input;
    if (s.stops.length) return stop('stops', 'Nothing was published: the plan has stops.', { stops: s.stops });
    var needs = needsOf(s);
    var missing = unmet(needs, opts && opts.confirm);
    if (missing.length) return stop('needs-confirmation', 'Nothing was published. Ask the user, then pass the confirmation.', { needs: needs, unconfirmed: missing });
    var notThere = s.images.filter(function (x) { return x.state !== 'unchanged'; }).map(function (x) { return x.name; });
    if (notThere.length) return stop('images', 'Nothing was published: attach these images first.', { images: notThere });

    var out = { ok: true, published: true, release: inp.release, space: s.space, top: null, pages: [], counts: { created: 0, updated: 0, unchanged: 0 } };
    var put = async function (pageId, title, src, row) {
      if (row.action === 'skip') { out.counts.unchanged++; return { pageId: pageId, version: row.version, hash: src.hash, action: 'unchanged' }; }
      var j = pageBody(title, s.space, src.body, src.hash, row.version + 1);
      j.id = pageId;
      var r = await call('PUT', '/' + pageId, j);
      if (!r.ok || !r.json || !r.json.version) return { failed: true, pageId: pageId, status: r.status, why: r.message };
      out.counts.updated++;
      return { pageId: pageId, version: r.json.version.number, hash: src.hash, action: 'updated' };
    };
    var fail = function (id, res) {
      out.ok = false;
      out.failed = { id: id, pageId: res.pageId || null, status: res.status, why: res.why };
      out.message = 'Stopped at ' + id + ': the pages before it were published, this one and the rest were not. Read the page again before trying again.';
      return out;
    };
    var top = await put(s.top.pageId, inp.top.title, inp.top, s.top);
    if (top.failed) return fail('top', top);
    out.top = top;
    if (inp.top.guide) out.top.guide = inp.top.guide;
    var made = {};
    for (var i = 0; i < inp.pages.length; i++) {
      var p = inp.pages[i];
      var row = s.pages[i];
      var res;
      if (row.action === 'create') {
        var parentId = p.parent ? made[p.parent] : s.top.pageId;
        var r = await call('POST', '', pageBody(p.title, s.space, p.body, p.hash, 0, parentId));
        if (!r.ok || !r.json || !r.json.id) return fail(p.id, { status: r.status, why: r.message });
        out.counts.created++;
        res = { pageId: String(r.json.id), version: r.json.version ? r.json.version.number : 1, hash: p.hash, action: 'created' };
      } else {
        res = await put(row.pageId, p.title, p, row);
        if (res.failed) return fail(p.id, res);
      }
      made[p.id] = res.pageId;
      out.pages.push(Object.assign({ id: p.id }, res));
    }
    return out;
  }

  // ── the test page: a child of the top page, with its own picture ───────────────────────
  async function testTarget() {
    var inp = mem.input;
    if (!inp) return stop('no-input', 'Load publish.json first.');
    if (!inp.test) return stop('no-test', 'publish.json holds no test page.');
    var t = await call('GET', '/' + inp.topPageId + '?expand=space,version');
    if (!t.ok || !t.json || !t.json.space) return stop('top-page', 'The top page could not be read (status ' + t.status + '). Is this browser signed in, and may this account see the page?');
    var f = await call('GET', '?spaceKey=' + encodeURIComponent(t.json.space.key) + '&title=' + encodeURIComponent(inp.test.title) + '&expand=version,ancestors');
    if (!f.ok || !f.json) return stop('lookup', 'The space could not be searched (status ' + f.status + ').');
    var hit = f.json.results[0] || null;
    var under = hit && hit.ancestors && hit.ancestors.length ? hit.ancestors[hit.ancestors.length - 1].id : null;
    if (hit && under !== String(inp.topPageId)) return stop('title-taken', 'A page titled "' + inp.test.title + '" exists elsewhere in this space: the test page was not made.', { pageId: hit.id });
    return { ok: true, space: t.json.space.key, hit: hit };
  }
  async function test() {
    var no = await refused();
    if (no) return no;
    var t = await testTarget();
    if (!t.ok) return t;
    var inp = mem.input;
    var j = pageBody(inp.test.title, t.space, inp.test.body, inp.test.hash, t.hit ? t.hit.version.number + 1 : 0, t.hit ? null : String(inp.topPageId));
    if (t.hit) j.id = t.hit.id;
    var r = await call(t.hit ? 'PUT' : 'POST', t.hit ? '/' + t.hit.id : '', j);
    if (!r.ok || !r.json || !r.json.id) return stop('test-page', 'The test page could not be written (status ' + r.status + '): ' + r.message);
    var pageId = String(r.json.id);
    var have = await attachmentsOf(pageId);
    var images = have ? await upload(pageId, inp.test.images, have, true) : { ok: false, failed: [{ why: 'its attachments could not be listed' }] };
    return { ok: images.ok && !images.waiting.length, test: { pageId: pageId, version: r.json.version ? r.json.version.number : null, action: t.hit ? 'updated' : 'created' }, images: images, message: 'Only the test page was written. Reload it, check it, and show the user.' };
  }
  /** Move the test page to the trash: only the page test() made, by its id. */
  async function removeTest(pageId) {
    var no = await refused();
    if (no) return no;
    var t = await testTarget();
    if (!t.ok) return t;
    if (!t.hit || String(t.hit.id) !== String(pageId)) return stop('not-the-test-page', 'Nothing was removed: that id is not the test page under the top page.');
    var kids = await call('GET', '/' + pageId + '/child/page?limit=1');
    if (!kids.ok || !kids.json || kids.json.results.length) return stop('has-children', 'Nothing was removed: the test page has child pages.');
    var r = await call('DELETE', '/' + pageId);
    return r.ok ? { ok: true, removed: String(pageId), message: "The test page is in the space's trash." } : stop('delete', 'The test page could not be removed (status ' + r.status + ').');
  }

  root.userGuides = {
    version: VERSION,
    configure: function (o) { Object.assign(host, o || {}); mem.found = null; return true; },
    input: input, load: load, detect: detect, plan: plan, attach: attach, publish: publish, test: test, removeTest: removeTest,
  };
  return 'user-guides publisher ' + VERSION + ' ready';
})(typeof globalThis !== 'undefined' ? globalThis : this);
