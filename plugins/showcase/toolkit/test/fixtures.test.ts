/** The fixture app's server (Session 2): pages, the SPA fallback, path safety, latency, no test ids. */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { APP_DIR, PAGES, serveFixture, type FixtureServer } from "../fixtures/serve.ts";
import { overlayScript } from "../spikes/lib.ts";

let server: FixtureServer;
before(async () => {
  server = await serveFixture();
});
after(() => server.close());

test("every page is served as HTML", async () => {
  for (const p of PAGES) {
    const res = await fetch(`${server.url}/${p}`);
    assert.equal(res.status, 200, p);
    assert.match(res.headers.get("content-type") ?? "", /^text\/html/, p);
  }
});

test("the History-API route falls back to spa.html", async () => {
  const spa = await (await fetch(`${server.url}/spa.html`)).text();
  assert.equal(await (await fetch(`${server.url}/spa/members`)).text(), spa);
  assert.equal(await (await fetch(`${server.url}/spa`)).text(), spa);
});

test("assets and the favicon resolve; unknown files 404", async () => {
  assert.equal((await fetch(`${server.url}/app.css`)).headers.get("content-type"), "text/css; charset=utf-8");
  assert.equal((await fetch(`${server.url}/app.js`)).status, 200);
  assert.equal((await fetch(`${server.url}/favicon.ico`)).status, 204);
  assert.equal((await fetch(`${server.url}/nope.html`)).status, 404);
});

test("paths outside the app are refused", async () => {
  const res = await fetch(`${server.url}/%2e%2e/serve.ts`);
  assert.notEqual(res.status, 200);
});

test("latency delays documents", async () => {
  const slow = await serveFixture({ latencyMs: 150 });
  try {
    const t = performance.now();
    await (await fetch(`${slow.url}/list.html`)).text();
    assert.ok(performance.now() - t >= 140);
  } finally {
    await slow.close();
  }
});

test("no test ids anywhere, as in Star", () => {
  for (const f of readdirSync(APP_DIR)) {
    assert.doesNotMatch(readFileSync(join(APP_DIR, f), "utf8"), /data-test(id|-id)?\b/, f);
  }
});

test("the spike overlay script takes its options", () => {
  const js = overlayScript({ mode: "popover", stop: "window", raise: true });
  assert.match(js, /const opts = \{"mode":"popover","stop":"window","raise":true\};/);
  assert.doesNotMatch(js, /const opts = __OPTS__/);
});
