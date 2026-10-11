/**
 * The HTML adapter in real Chromium (PLAN §5 Session 10's gate): the fixture app, vendored with
 * `runtime vendor --framework html` into a scratch copy and given the snippet on every page,
 * plays the fixture tour from a deep link with nothing injected and no host bound: synthetic
 * input, sessionStorage run state across its full page loads. A reload mid-tour resumes it
 * without writing twice, and a page with neither a link nor a saved run never loads the runtime.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";
import type { Browser, Page } from "playwright-core";
import { APP_DIR, type FixtureServer, serveFixture } from "../../fixtures/serve.ts";
import { launchHost, playwright } from "../../host/launch.ts";
import { filmOrderProblems } from "../../runtime/src/film-events.ts";
import type { Snapshot } from "../../runtime/src/protocol.ts";
import type { Tour } from "../../runtime/src/schema.ts";
import { cli, scratch } from "../helpers.ts";

const FIXTURES = resolve(import.meta.dirname, "..", "..", "fixtures");

let server: FixtureServer;
let browser: Browser;
let site: string;

before(async () => {
  const root = realpathSync(scratch("showcase-html-"));
  execFileSync("git", ["init", "-q"], { cwd: root });
  cpSync(join(FIXTURES, "showcase"), join(root, "showcase"), { recursive: true });
  site = join(root, "site");
  cpSync(APP_DIR, site, { recursive: true });
  const v = await cli(["runtime", "vendor", "--framework", "html", "--public", "site", "--json"], { cwd: root, env: { HOME: process.env.HOME ?? "" } });
  assert.equal(v.code, 0, v.stderr);
  // The snippet as vendored, at ×6 so the test is quick.
  const snippet = (JSON.parse(v.stdout) as { snippet: string }).snippet.replace('startInApp({ base: "/showcase" })', 'startInApp({ base: "/showcase", speed: 6 })');
  assert.match(snippet, /speed: 6/);
  for (const name of readdirSync(site)) {
    if (!name.endsWith(".html")) continue;
    const file = join(site, name);
    writeFileSync(file, readFileSync(file, "utf8").replace("</head>", `${snippet}</head>`));
  }
  server = await serveFixture({ root: site });
  const pw = await playwright();
  browser = await pw.chromium.launch({ channel: "chromium", headless: true });
});

after(async () => {
  await browser?.close();
  server?.server.closeAllConnections();
  await server?.close();
});

/** Counts the app's own clicks, by button text, and lists the documents loaded, across page loads (the tab's sessionStorage). */
const COUNT_CLICKS = `
  addEventListener("click", (e) => {
    const b = e.target instanceof Element ? e.target.closest("button, a") : null;
    if (!b) return;
    const k = "test:clicks";
    const c = JSON.parse(sessionStorage.getItem(k) || "{}");
    const name = (b.textContent || "").trim();
    c[name] = (c[name] || 0) + 1;
    sessionStorage.setItem(k, JSON.stringify(c));
  }, true);
  if (window.top === window) {
    const k = "test:loads";
    sessionStorage.setItem(k, (sessionStorage.getItem(k) || "") + location.pathname + location.search + " ");
  }
`;

async function newPage(): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.addInitScript({ content: COUNT_CLICKS });
  return context.newPage();
}

async function snapshot(page: Page): Promise<Snapshot | null> {
  return (await page.evaluate("window.__showcase ? window.__showcase.snapshot() : null").catch(() => null)) as Snapshot | null;
}

async function until<T>(what: string, fn: () => Promise<T | null | undefined | false>, ms = 60_000): Promise<T> {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > ms) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

const finished = (page: Page) => until("the tour to finish", async () => {
  const s = await snapshot(page);
  if (s?.status === "blocked") throw new Error(`blocked: ${s.blocked?.message}`);
  return s?.status === "done" ? s : null;
});

test("the HTML adapter plays the fixture tour from a deep link: synthetic input, sessionStorage state across page loads", async () => {
  const page = await newPage();
  await page.goto(`${server.url}/index.html?showcase=fixture-tour`);
  await until("the run to start", async () => (await snapshot(page))?.status === "playing" || null);
  assert.equal(new URL(page.url()).search, "", "the deep link's parameters come off the URL");
  assert.equal(await page.evaluate("typeof window.__showcaseHost"), "undefined", "no host is bound");
  const end = await finished(page);
  assert.equal(end.ended?.reason, "finished");
  assert.equal(end.stepId, "detail");
  assert.equal(new URL(page.url()).pathname, "/detail.html");
  assert.ok(end.doc >= 2, `the run crossed full page loads (doc ${end.doc})`);
  assert.deepEqual(end.notes, [], "no synthetic fallbacks: everything was synthetic from the start");
  assert.equal(await page.evaluate("sessionStorage.getItem('showcase:run')"), null, "a finished run leaves no state behind");
  const clicks = JSON.parse(String(await page.evaluate("sessionStorage.getItem('test:clicks')"))) as Record<string, number>;
  assert.equal(clicks["Accept cookies"], 1);
  await page.context().close();
});

test("a reload mid-tour resumes from the tab's state without writing twice, and a later page with no link stays inert", async () => {
  const page = await newPage();
  await page.goto(`${server.url}/index.html?showcase=fixture-tour&showcaseStep=dashboard`);
  // Reload once the cookie notice has been accepted (a write), mid-step.
  await until("the cookie write", async () => {
    const raw = (await page.evaluate("sessionStorage.getItem('showcase:run')").catch(() => null)) as string | null;
    return raw && (JSON.parse(raw) as { journal: string[] }).journal.includes("dashboard/cookies/accept") ? true : null;
  });
  const journalBefore = (JSON.parse(String(await page.evaluate("sessionStorage.getItem('showcase:run')"))) as { journal: string[] }).journal;
  await page.reload();
  const resumed = await until("the resumed run", async () => {
    const s = await snapshot(page);
    return s && s.status !== "idle" ? s : null;
  });
  assert.equal(resumed.tourId, "fixture-tour");
  const end = await finished(page);
  assert.equal(end.ended?.reason, "finished");
  for (const k of journalBefore) assert.ok(end.journal.includes(k));
  const clicks = JSON.parse(String(await page.evaluate("sessionStorage.getItem('test:clicks')"))) as Record<string, number>;
  assert.equal(clicks["Accept cookies"], 1, "the cookie write isn't made again");
  assert.equal(clicks["Invite people"], 1, `the invite opened once (${JSON.stringify(clicks)})`);
  const loads = String(await page.evaluate("sessionStorage.getItem('test:loads')")).trim().split(" ");
  assert.deepEqual(loads, ["/index.html?showcase=fixture-tour&showcaseStep=dashboard", "/index.html", "/list.html", "/detail.html?id=3"], "the deep link, the reload (the link gone), then the two pages the tour loads");

  // The run is over: a plain page load finds no link and no state, and loads nothing.
  await page.goto(`${server.url}/list.html`);
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate("typeof window.__showcase"), "undefined");
  await page.context().close();
});

test("film --in-app: a page load mid-film brings the vendored runtime back from the recorder's state, on the real clock", async () => {
  // As `film --in-app` launches (film/record.ts): the binding and nothing injected. The recorder
  // holds the run, so the tab's sessionStorage has nothing for the snippet to find after a load.
  const tour = JSON.parse(readFileSync(join(site, "showcase", "tours", "fixture-tour.json"), "utf8")) as Tour;
  // A fixed clock too, as a real project sets (`browser.clock.fixed`): the vendored runtime boots
  // after the clock script, and its events must still carry the real time.
  const host = await launchHost({ url: `${server.url}/index.html?showcase=fixture-tour&showcaseMode=film`, tour, mode: "film", headless: true, inject: false, assetsDir: join(FIXTURES, "showcase"), browser: { clock: { fixed: "2020-02-02T10:00:00Z" } } });
  const began = Date.now();
  try {
    await host.waitForEvent("film:armed", { timeoutMs: 30_000 });
    await host.go();
    await host.waitForEvent("film:end", { timeoutMs: 120_000 });
    assert.equal(host.events.find((e) => e.type === "film:error"), undefined);
    assert.deepEqual([...new Set(host.events.map((e) => e.doc))], [1, 2, 3], "the film crossed its two page loads");
    assert.deepEqual(filmOrderProblems(host.events), []);
    assert.equal(new Date(Number(await host.page.evaluate("Date.now()"))).getUTCFullYear(), 2020, "the app sees the fixed clock");
    const stamps = host.events.flatMap((e) => [e.t, e.wall]);
    assert.ok(stamps.every((t) => t >= began - 1000 && t <= Date.now() + 1000), "every event carries the real time, on the host's clock");
    assert.equal(host.events.filter((e) => e.type === "film:armed").length, 1);
    assert.equal(await host.page.evaluate("sessionStorage.getItem('showcase:run')"), null, "the run was the recorder's, never the tab's");
    assert.match(host.page.url(), /\/detail\.html/);
  } finally {
    await host.close();
  }
});
