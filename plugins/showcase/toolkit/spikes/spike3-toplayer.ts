/**
 * Spike 3 — the top layer (PLAN §5 Session 2, S-D3). Is the overlay drawn on top, and are its
 * controls clickable, when the app puts something in the top layer?
 *
 * Designs:  popover        <showcase-overlay popover="manual">, re-shown on every top-layer change
 *           popover-static the same, never re-shown (shows why re-showing matters)
 *           portal         Compass's design: a plain layer moved into the topmost open modal dialog
 *           hybrid         the popover, re-shown, with only the control bar moved into the topmost
 *                          modal dialog or the fullscreen element (where the rest is inert)
 *           hybrid+popover the hybrid, also moving the bar into the app's open auto popover
 * Cases:    baseline · showModal() · popover=auto · requestFullscreen()
 *
 * Each case opens its top-layer element with a trusted click, puts the overlay's pointer and
 * control bar over it, then records: a screenshot; the pixel colour under the pointer (magenta)
 * and the bar (yellow); `elementFromPoint` at the Next button; whether a trusted click on Next
 * registers (inertness); and whether that click closed the app's element.
 *
 *   node toolkit/spikes/spike3-toplayer.ts [--scale 1.5]
 */
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { parseArgs } from "node:util";
import type { Page } from "playwright-core";
import { findFfmpeg } from "../lib/ffmpeg.ts";
import { serveFixture } from "../fixtures/serve.ts";
import { launch, outDir, pixel, withOverlay, writeResult, type OverlayOpts } from "./lib.ts";

const { values } = parseArgs({ options: { scale: { type: "string", default: "1.5" } } });
const scale = Number(values.scale);
const out = outDir("s3");

const DESIGNS: Record<string, OverlayOpts> = {
  popover: { mode: "popover", stop: "window", raise: true },
  "popover-static": { mode: "popover", stop: "window", raise: false },
  portal: { mode: "portal", stop: "window", raise: false },
  hybrid: { mode: "popover", stop: "window", raise: true, controls: "portal" },
  "hybrid+popover": { mode: "popover", stop: "window", raise: true, controls: "portal+popover" },
};
const CASES = ["baseline", "modal", "popover-auto", "fullscreen"] as const;
type Case = (typeof CASES)[number];

const TRIGGER: Record<Case, string | null> = { baseline: null, modal: "Invite people", "popover-auto": "Notifications", fullscreen: "Present chart" };

const server = await serveFixture();
const { browser } = await launch({ args: [`--force-device-scale-factor=${scale}`] });

type Spike = {
  __showcaseSpike: {
    pointTo(x: number, y: number, ms: number): Promise<void>;
    placeBar(x: number, y: number): void;
    barRect(): DOMRect;
    buttonRect(c: string): DOMRect;
    counts: Record<string, number>;
    host: HTMLElement;
    ctlHost: HTMLElement;
  };
};

async function state(page: Page) {
  return page.evaluate(() => ({
    dialogOpen: !!document.querySelector("dialog")?.open,
    popoverOpen: !!document.getElementById("notifications")?.matches(":popover-open"),
    fullscreen: !!document.fullscreenElement,
  }));
}

const rows: Record<string, unknown>[] = [];
for (const [design, opts] of Object.entries(DESIGNS)) {
  const context = await browser.newContext({
    viewport: { width: Math.round(1920 / scale), height: Math.round(1080 / scale) },
    deviceScaleFactor: scale,
  });
  await withOverlay(context, opts);
  for (const c of CASES) {
    const page = await context.newPage();
    await page.goto(`${server.url}/index.html`);
    await page.getByRole("button", { name: "Accept cookies" }).click();
    const trigger = TRIGGER[c];
    if (trigger) {
      const b = page.getByRole("button", { name: trigger });
      await b.scrollIntoViewIfNeeded();
      const box = await b.boundingBox();
      await page.mouse.click((box?.x ?? 0) + (box?.width ?? 0) / 2, (box?.y ?? 0) + (box?.height ?? 0) / 2);
      await page.waitForTimeout(250);
    }
    const before = await state(page);
    // The top-layer element's rectangle; the pointer and the bar go over it.
    const rect = await page.evaluate((c) => {
      const el =
        c === "modal" ? document.querySelector("dialog") :
        c === "popover-auto" ? document.getElementById("notifications") :
        c === "fullscreen" ? document.fullscreenElement : document.querySelector("main section");
      return el ? el.getBoundingClientRect().toJSON() as DOMRect : null;
    }, c);
    const r = rect ?? { x: 0, y: 0, width: 400, height: 300 };
    const pointer = { x: r.x + r.width * 0.3, y: r.y + r.height * 0.35 };
    const barAt = { x: r.x + r.width * 0.6, y: r.y + r.height * 0.7 };
    await page.evaluate(([p, b]) => {
      const s = (window as unknown as Spike).__showcaseSpike;
      s.placeBar(b?.x ?? 0, b?.y ?? 0);
      return s.pointTo(p?.x ?? 0, p?.y ?? 0, 1);
    }, [pointer, barAt]);
    await page.waitForTimeout(200);
    const shot = join(out, `${design}-${c}.png`);
    await page.screenshot({ path: shot });
    const bar = await page.evaluate(() => (window as unknown as Spike).__showcaseSpike.barRect());
    const next = await page.evaluate(() => (window as unknown as Spike).__showcaseSpike.buttonRect("next"));
    const nx = next.x + next.width / 2;
    const ny = next.y + next.height / 2;
    const pointerRgb = pixel(shot, pointer.x * scale, pointer.y * scale);
    const barRgb = pixel(shot, (bar.x + 5) * scale, (bar.y + 5) * scale);
    const hit = await page.evaluate(([x, y]) => {
      const top = document.elementFromPoint(x ?? 0, y ?? 0);
      let n = top;
      while (n?.shadowRoot) {
        const m = n.shadowRoot.elementFromPoint(x ?? 0, y ?? 0);
        if (!m || m === n) break;
        n = m;
      }
      return { top: top?.tagName.toLowerCase() ?? null, inner: n && n !== top ? n.textContent?.trim() ?? null : null };
    }, [nx, ny]);
    const hostWhere = await page.evaluate(() => {
      const s = (window as unknown as Spike).__showcaseSpike;
      const h = s.host;
      const cp = s.ctlHost.parentNode;
      return {
        parent: h.parentElement?.tagName.toLowerCase() ?? null,
        popoverOpen: h.matches("[popover]") ? h.matches(":popover-open") : null,
        controlsIn: cp instanceof ShadowRoot ? "overlay" : cp instanceof Element ? cp.tagName.toLowerCase() : null,
      };
    });
    const nextBefore = await page.evaluate(() => (window as unknown as Spike).__showcaseSpike.counts.next ?? 0);
    await page.mouse.click(nx, ny);
    await page.waitForTimeout(150);
    const nextAfter = await page.evaluate(() => (window as unknown as Spike).__showcaseSpike.counts.next ?? 0);
    const after = await state(page);
    const isMagenta = (p: number[]) => (p[0] ?? 0) > 200 && (p[1] ?? 255) < 80 && (p[2] ?? 0) > 200;
    const isYellow = (p: number[]) => (p[0] ?? 0) > 200 && (p[1] ?? 0) > 180 && (p[2] ?? 255) < 80;
    const row = {
      design,
      case: c,
      opened: before,
      host: hostWhere,
      pointerDrawnOnTop: isMagenta(pointerRgb),
      barDrawnOnTop: isYellow(barRgb),
      pointerRgb,
      barRgb,
      elementFromPointAtNext: hit,
      controlsClickable: nextAfter > nextBefore,
      appElementSurvivedControlClick:
        c === "modal" ? after.dialogOpen : c === "popover-auto" ? after.popoverOpen : c === "fullscreen" ? after.fullscreen : true,
      screenshot: `test/.out/spikes/s3/${design}-${c}.png`,
    };
    rows.push(row);
    console.log(
      `${design.padEnd(15)} ${c.padEnd(13)} drawn: pointer ${row.pointerDrawnOnTop ? "✔" : "✘"} bar ${row.barDrawnOnTop ? "✔" : "✘"}  hit: ${hit.top}/${hit.inner ?? "-"}  clickable: ${row.controlsClickable ? "✔" : "✘"}  app element kept: ${row.appElementSurvivedControlClick ? "✔" : "✘"}`,
    );
    await page.close();
  }
  await context.close();
}
await browser.close();
await server.close();

// A contact sheet of the screenshots (4 cases across, one row per design), for reading back.
const { ffmpeg } = findFfmpeg();
if (ffmpeg) {
  const files = Object.keys(DESIGNS).flatMap((d) => CASES.map((c) => join(out, `${d}-${c}.png`)));
  execFileSync(ffmpeg, [
    "-hide_banner", "-loglevel", "error", "-y",
    ...files.flatMap((f) => ["-i", f]),
    "-filter_complex",
    files.map((_, i) => `[${i}:v]scale=640:-1[v${i}]`).join(";") + ";" + files.map((_, i) => `[v${i}]`).join("") + `xstack=inputs=${files.length}:layout=` +
      files.map((_, i) => `${(i % 4) * 640}_${Math.floor(i / 4) * 360}`).join("|"),
    join(out, "contact-sheet.png"),
  ]);
}

writeResult("spike3-toplayer", { when: new Date().toISOString(), scale, rows });
