// check-page.js: check one published page, in the page. Pass this whole text to the browser's
// JavaScript tool on the page's own view (after a reload), then call
//   userGuidesCheck({ version: <the version the publish reported> })
// It answers: does the page show that version yet, did every image load, does the widest image
// fit the content column, and does every in-page link have its target. Names and counts only.
(function (root) {
  'use strict';
  root.userGuidesCheck = async function (expect) {
    expect = expect || {};
    var meta = function (name) {
      var e = document.querySelector('meta[name="ajs-' + name + '"]');
      return e ? e.getAttribute('content') || '' : '';
    };
    var main = document.querySelector('#main-content');
    if (!main) return { ok: false, problem: 'no-content', message: 'No #main-content here: open the page itself (its view, not the editor), then check again.' };
    var shown = Number(meta('page-version')) || null;
    var page = { id: meta('page-id') || null, version: shown };
    if (expect.version && shown && shown !== expect.version) return { ok: false, stale: true, page: page, expected: expect.version, message: 'This is still version ' + shown + ' of the page: reload, pass this script again, and check again.' };

    var fileOf = function (img) {
      var src = (img.getAttribute('src') || '').split('?')[0];
      try { return decodeURIComponent(src.split('/').pop()); } catch (e) { return src.split('/').pop(); }
    };
    var imgs = Array.prototype.slice.call(main.querySelectorAll('img.confluence-embedded-image'));
    await Promise.all(imgs.map(function (img) {
      if (img.complete) return null;
      return new Promise(function (done) {
        img.addEventListener('load', done);
        img.addEventListener('error', done);
        setTimeout(done, 8000);
      });
    }));
    var column = main.getBoundingClientRect().width;
    var notLoaded = imgs.filter(function (i) { return !(i.complete && i.naturalWidth > 0); }).map(fileOf);
    var widest = 0;
    var tooWide = [];
    imgs.forEach(function (i) {
      var w = i.getBoundingClientRect().width;
      if (w > widest) widest = w;
      if (w > column + 0.5) tooWide.push(fileOf(i));
    });
    var links = Array.prototype.slice.call(main.querySelectorAll('a[href^="#"]')).filter(function (a) { return a.getAttribute('href').length > 1; });
    var broken = links.filter(function (a) {
      var id = a.getAttribute('href').slice(1);
      try { id = decodeURIComponent(id); } catch (e) { /* keep it as written */ }
      return !document.getElementById(id) && !document.getElementsByName(id).length;
    }).map(function (a) { return a.textContent.trim().slice(0, 60); });
    var unresolved = main.querySelectorAll('a.unresolved, a.createlink').length;

    var out = {
      ok: !notLoaded.length && !tooWide.length && !broken.length && !unresolved,
      page: page,
      versionSeen: !!shown,
      images: imgs.length,
      loaded: imgs.length - notLoaded.length,
      notLoaded: notLoaded,
      column: Math.round(column),
      widest: Math.round(widest),
      tooWide: tooWide,
      anchors: links.length,
      brokenAnchors: broken,
      unresolvedPageLinks: unresolved,
    };
    if (tooWide.length) out.message = 'An image is wider than the page column (' + out.column + 'px): lower publish.confluence.imageCap below it, convert, and publish again.';
    else if (notLoaded.length) out.message = 'An image did not load: is it attached to the top page under that name?';
    else if (broken.length || unresolved) out.message = 'A link has no target on the wiki.';
    return out;
  };
  return 'user-guides page check ready: call userGuidesCheck({ version: N })';
})(typeof globalThis !== 'undefined' ? globalThis : this);
