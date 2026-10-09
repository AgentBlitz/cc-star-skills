/**
 * Gate check: the fixture serves, and every page loads in Chromium without console errors,
 * page errors or failed requests. Also confirms the elements Session 2 asks for are present,
 * found by role and label (no test ids).
 *
 *   node toolkit/spikes/check-fixture.ts
 */
import { PAGES, serveFixture } from "../fixtures/serve.ts";
import { launch, writeResult } from "./lib.ts";

const server = await serveFixture();
const { browser } = await launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const problems: string[] = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") problems.push(`${page.url()} console.${m.type()}: ${m.text()}`);
});
page.on("pageerror", (e) => problems.push(`${page.url()} pageerror: ${e.message}`));
page.on("requestfailed", (r) => problems.push(`${r.url()} requestfailed: ${r.failure()?.errorText}`));
page.on("response", (r) => {
  if (r.status() >= 400) problems.push(`${r.url()} HTTP ${r.status()}`);
});

const pages: Record<string, string> = {};
for (const p of PAGES) {
  await page.goto(`${server.url}/${p}`, { waitUntil: "load" });
  await page.waitForTimeout(300);
  pages[p] = await page.title();
}

// The elements Session 2 asks for, on index.html.
await page.goto(`${server.url}/index.html`);
const r = (role: Parameters<typeof page.getByRole>[0], name: string) => page.getByRole(role, { name }).count();
const elements = {
  stickyHeader: await page.locator("header").evaluate((h) => getComputedStyle(h).position),
  cookieBanner: await r("region", "Cookie consent"),
  menuTrigger: await page.getByRole("button", { name: "Account" }).getAttribute("aria-haspopup"),
  dialogOpener: await r("button", "Invite people"),
  popover: await page.locator("#notifications").getAttribute("popover"),
  fullscreen: await r("button", "Present chart"),
  scroller: await r("region", "Activity feed"),
  iframe: await page.frameLocator("iframe[title='Approvals preview']").getByRole("button", { name: "Approve claim A" }).count(),
  text: await page.getByLabel("Workspace name").count(),
  select: await page.getByLabel("Region").count(),
  checkbox: await page.getByLabel("Email me weekly").count(),
  contenteditable: await r("textbox", "Notes"),
  hoverMenu: await r("link", "Resources"),
  drag: await page.getByRole("listitem", { name: "Stale report: Q1 forecast" }).getAttribute("draggable"),
  dropZone: await r("region", "Archive"),
  canvas: await page.locator("canvas").count(),
  spinner: await r("progressbar", "Loading forecast"),
  fileInput: await page.getByLabel("Attach a file").count(),
  windowOpen: await r("link", "Open help in a new window"),
  testIds: await page.locator("[data-testid], [data-test-id], [data-test]").count(),
};

// The SPA route changes the URL without a page load.
await page.goto(`${server.url}/spa`);
const before = await page.evaluate(() => performance.timeOrigin);
await page.getByRole("link", { name: "Settings" }).click();
const spa = {
  url: new URL(page.url()).pathname,
  heading: await page.getByRole("heading", { level: 1 }).textContent(),
  sameDocument: (await page.evaluate(() => performance.timeOrigin)) === before,
};

await browser.close();
await server.close();

const result = { pages, elements, spa, problems };
writeResult("fixture-check", result);
console.log(JSON.stringify(result, null, 2));
const ok = problems.length === 0 && elements.testIds === 0 && spa.sameDocument && spa.url === "/spa/settings";
console.log(ok ? "fixture check: PASS" : "fixture check: FAIL");
process.exit(ok ? 0 : 1);
