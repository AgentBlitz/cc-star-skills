/**
 * Spike 2 — trusted clicks (PLAN §5 Session 2, S-D2). 20 trusted CDP clicks (Playwright's mouse)
 * on targets under the sticky header, behind the cookie banner, in a nested scroller, in a
 * same-origin iframe and in an open modal dialog, with the prototype overlay present (a
 * `pointer-events:none` layer, its pointer moved onto each target first). Before each click,
 * the Playwright-style check from §2.1: scroll to centre, the rect stable across two frames,
 * and `elementsFromPoint` (ignoring the overlay) finding the target on top, trying inset
 * points if covered. A click counts as landed when the app's own log records it, trusted.
 *
 * Then the controls: with the Radix-like menu open, trusted clicks on the overlay's Pause and
 * Next must never close it, for each way of stopping events (host, window capture, none).
 *
 *   node toolkit/spikes/spike2-clicks.ts [--scale 1.5]
 */
import type { Frame, Page } from "playwright-core";
import { parseArgs } from "node:util";
import { serveFixture } from "../fixtures/serve.ts";
import { launch, withOverlay, writeResult, type OverlayOpts } from "./lib.ts";

const { values } = parseArgs({ options: { scale: { type: "string", default: "1.5" } } });
const scale = Number(values.scale);

// The page-side check, injected into every frame (harness only).
const PROBE = `
  window.__probe = async (sel, text, prep) => {
    const host = document.querySelector("showcase-overlay");
    const el = [...document.querySelectorAll(sel)].find((n) => (n.getAttribute("aria-label") || n.textContent).trim() === text);
    if (!el) return { ok: false, error: "not found" };
    const raf = () => new Promise((r) => requestAnimationFrame(() => r()));
    const describe = (n) => n ? (n.closest("header") ? "header" : n.closest(".cookie-banner") ? "banner" : n.tagName.toLowerCase() + (n.className ? "." + String(n.className).split(" ")[0] : "")) : "nothing";
    const topAt = (x, y) => document.elementsFromPoint(x, y).find((n) => n !== host && !(host && host.contains(n)));
    // Put the target where a naive click would miss it.
    let r = el.getBoundingClientRect();
    if (prep === "header") scrollBy(0, r.top - 20);
    if (prep === "banner") scrollBy(0, r.top - (innerHeight - 60));
    if (prep === "scroller") { const sc = el.closest(".scroller"); sc.scrollTop = 0; sc.scrollIntoView({ block: "center" }); }
    if (prep === "frame") scrollTo(0, 0);
    await raf();
    r = el.getBoundingClientRect();
    const naive = topAt(r.left + r.width / 2, r.top + r.height / 2);
    const coveredBefore = naive === el || el.contains(naive) ? null : describe(naive);
    // The executor's check.
    el.scrollIntoView({ block: "center", inline: "center" });
    await raf(); await raf();
    const a = el.getBoundingClientRect(); await raf(); await raf();
    const b = el.getBoundingClientRect();
    const stable = a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
    for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.5], [0.75, 0.5], [0.5, 0.25], [0.5, 0.75]]) {
      const x = b.left + b.width * fx, y = b.top + b.height * fy;
      const top = topAt(x, y);
      if (top === el || el.contains(top)) return { ok: true, x, y, inset: fx !== 0.5 || fy !== 0.5, stable, coveredBefore };
    }
    return { ok: false, stable, coveredBefore, coveredBy: describe(topAt(b.left + b.width / 2, b.top + b.height / 2)) };
  };
`;

interface Target {
  where: "header" | "banner" | "scroller" | "iframe" | "dialog";
  sel: string;
  text: string;
}
const T = (where: Target["where"], sel: string, ...texts: string[]): Target[] => texts.map((text) => ({ where, sel, text }));
const TARGETS: Target[] = [
  ...T("header", "button", "Open Q3 revenue", "Open churn by region", "Open pipeline", "Open support load"),
  ...T("banner", "button", "Open hiring plan", "Open cloud spend", "Schedule weekly summary", "Schedule finance close"),
  ...T("scroller", ".scroller button", "Acknowledge entry 31", "Acknowledge entry 35", "Acknowledge entry 38", "Acknowledge entry 40"),
  ...T("iframe", "button", "Approve claim E", "Approve claim F", "Approve claim G", "Approve claim H"),
  ...T("dialog", "dialog button", "Add as viewer", "Add as editor", "Add as admin", "Copy invite link"),
];

const server = await serveFixture();
const { browser } = await launch({ args: [`--force-device-scale-factor=${scale}`] });

async function newPage(overlay: OverlayOpts): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: Math.round(1920 / scale), height: Math.round(1080 / scale) },
    deviceScaleFactor: scale,
  });
  await withOverlay(context, overlay);
  await context.addInitScript({ content: PROBE });
  const page = await context.newPage();
  await page.goto(`${server.url}/index.html`);
  return page;
}

type Probe = { ok: boolean; x?: number; y?: number; inset?: boolean; stable?: boolean; coveredBefore?: string | null; coveredBy?: string; error?: string };

async function trustedClick(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(([px, py]) => (window as unknown as { __showcaseSpike: { pointTo(x: number, y: number, ms: number): Promise<void> } }).__showcaseSpike.pointTo(px ?? 0, py ?? 0, 250), [x, y]);
  await page.mouse.move(x, y, { steps: 8 });
  await page.mouse.down();
  await page.mouse.up();
}

const lastEvent = (f: Page | Frame) =>
  f.evaluate(() => (window as unknown as { fixtureEvents: { label: string; trusted: boolean }[] }).fixtureEvents.at(-1) ?? null);

// --- 20 clicks -------------------------------------------------------------------------------
const page = await newPage({ mode: "popover", stop: "host", raise: true });
const clicks: Record<string, unknown>[] = [];
for (const t of TARGETS) {
  if (t.where === "dialog" && !(await page.evaluate(() => document.querySelector("dialog")?.open))) {
    const opener = (await page.evaluate(`__probe("button", "Invite people", null)`)) as Probe;
    await trustedClick(page, opener.x ?? 0, opener.y ?? 0);
    await page.waitForTimeout(150);
  }
  let probe: Probe;
  let frame: Page | Frame = page;
  let x = 0;
  let y = 0;
  if (t.where === "iframe") {
    const iframe = page.locator("iframe");
    await iframe.scrollIntoViewIfNeeded();
    frame = page.frames().find((f) => f.url().endsWith("/frame.html")) ?? page;
    probe = (await frame.evaluate(`__probe(${JSON.stringify(t.sel)}, ${JSON.stringify(t.text)}, "frame")`)) as Probe;
    // Into top-level coordinates, then confirm the iframe is on top there.
    const off = await iframe.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + el.clientLeft, y: r.top + el.clientTop };
    });
    x = (probe.x ?? 0) + off.x;
    y = (probe.y ?? 0) + off.y;
    const onTop = await page.evaluate(([px, py]) => {
      const host = document.querySelector("showcase-overlay");
      const top = document.elementsFromPoint(px ?? 0, py ?? 0).find((n) => n !== host);
      return top?.tagName === "IFRAME";
    }, [x, y]);
    probe.ok = probe.ok && onTop;
  } else {
    probe = (await page.evaluate(`__probe(${JSON.stringify(t.sel)}, ${JSON.stringify(t.text)}, ${JSON.stringify(t.where)})`)) as Probe;
    x = probe.x ?? 0;
    y = probe.y ?? 0;
  }
  let input: "trusted" | "none" = "none";
  if (probe.ok) {
    await trustedClick(page, x, y);
    input = "trusted";
    await page.waitForTimeout(80);
  }
  const ev = await lastEvent(frame);
  const landed = !!ev && ev.label === t.text && ev.trusted === true;
  clicks.push({ where: t.where, target: t.text, coveredBefore: probe.coveredBefore ?? null, stable: probe.stable, inset: probe.inset ?? false, input, landed, logged: ev });
  console.log(`${landed ? "✔" : "✘"} ${t.where.padEnd(8)} ${t.text.padEnd(24)} covered before: ${probe.coveredBefore ?? "-"}${probe.ok ? "" : ` (check failed: ${probe.coveredBy ?? probe.error})`}`);
}
const overlayStillUp = await page.evaluate(() => document.querySelector("showcase-overlay")?.matches(":popover-open") ?? false);
await page.context().close();

// --- Controls vs the app's menu --------------------------------------------------------------
async function menuTest(stop: OverlayOpts["stop"]) {
  const p = await newPage({ mode: "popover", stop, raise: true });
  await p.getByRole("button", { name: "Accept cookies" }).click();
  // A capture-phase "click outside" listener, as some libraries use, to test each design.
  await p.evaluate(() => {
    const menu = document.getElementById("account-menu");
    const w = window as unknown as { __captureOutside: number };
    w.__captureOutside = 0;
    document.addEventListener("pointerdown", (e) => {
      if (menu && !menu.hidden && !menu.contains(e.target as Node)) w.__captureOutside++;
    }, true);
  });
  const account = p.getByRole("button", { name: "Account" });
  const box = await account.boundingBox();
  await trustedClick(p, (box?.x ?? 0) + (box?.width ?? 0) / 2, (box?.y ?? 0) + (box?.height ?? 0) / 2);
  await p.waitForTimeout(50);
  const steps: { control: string; menuOpen: boolean; focusInMenu: boolean; hostFocused: boolean; hitHost: boolean }[] = [];
  for (const c of ["pause", "next", "pause", "next", "pause"]) {
    const r = (await p.evaluate((c) => (window as unknown as { __showcaseSpike: { buttonRect(c: string): DOMRect } }).__showcaseSpike.buttonRect(c), c)) as DOMRect;
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    const hitHost = await p.evaluate(([x, y]) => document.elementFromPoint(x ?? 0, y ?? 0)?.tagName === "SHOWCASE-OVERLAY", [cx, cy]);
    await p.mouse.move(cx, cy, { steps: 5 });
    await p.mouse.down();
    await p.mouse.up();
    await p.waitForTimeout(60);
    steps.push({
      control: c,
      hitHost,
      ...(await p.evaluate(() => ({
        menuOpen: document.querySelector('button[aria-haspopup="menu"]')?.getAttribute("aria-expanded") === "true",
        focusInMenu: !!document.activeElement?.closest('[role="menu"]'),
        hostFocused: document.activeElement?.tagName === "SHOWCASE-OVERLAY",
      }))),
    });
  }
  const counts = await p.evaluate(() => ({ ...(window as unknown as { __showcaseSpike: { counts: Record<string, number> } }).__showcaseSpike.counts }));
  const captureOutside = await p.evaluate(() => (window as unknown as { __captureOutside: number }).__captureOutside);
  // Sanity: a real click outside does close it.
  await trustedClick(p, 40, 200);
  await p.waitForTimeout(50);
  const closesOnRealOutsideClick = (await account.getAttribute("aria-expanded")) === "false";
  await p.context().close();
  const neverClosed = steps.every((s) => s.menuOpen);
  return {
    stop,
    controlClicks: steps.length,
    controlsRegistered: (counts.pause ?? 0) + (counts.next ?? 0),
    menuNeverClosed: neverClosed,
    focusStayedInMenu: steps.every((s) => s.focusInMenu && !s.hostFocused),
    hitTestFindsHost: steps.every((s) => s.hitHost),
    captureListenerSawOutside: captureOutside,
    closesOnRealOutsideClick,
  };
}
const menu = [];
for (const stop of ["host", "window", "none"] as const) {
  const m = await menuTest(stop);
  menu.push(m);
  console.log(JSON.stringify(m));
}

await browser.close();
await server.close();

const landed = clicks.filter((c) => c.landed).length;
const result = {
  when: new Date().toISOString(),
  scale,
  landed: `${landed}/${clicks.length}`,
  syntheticFallbacks: clicks.filter((c) => c.input !== "trusted").length,
  coveredBeforeCheck: clicks.filter((c) => c.coveredBefore).length,
  overlayStillUp,
  clicks,
  menu,
};
writeResult("spike2-clicks", result);
const host = menu.find((m) => m.stop === "host");
const ok = landed === 20 && clicks.length === 20 && !!host?.menuNeverClosed && host.controlsRegistered === host.controlClicks;
console.log(`landed ${landed}/${clicks.length}; host-stop menu never closed: ${host?.menuNeverClosed}`);
console.log(ok ? "spike 2: PASS" : "spike 2: FAIL");
process.exit(ok ? 0 : 1);
