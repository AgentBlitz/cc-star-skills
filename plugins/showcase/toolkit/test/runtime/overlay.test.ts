/**
 * The overlay, the voice and the host's browser options in real Chromium on the fixture app
 * (PLAN §5 Session 5): the overlay drawn over a modal dialog with its controls clickable in Watch,
 * the controls inside an app's auto popover, the viewer's keys, a viewer's click, re-attaching,
 * never taking focus, voice clips through the binding, and the config's browser settings.
 */
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { after, before, test } from "node:test";
import { type FixtureServer, serveFixture } from "../../fixtures/serve.ts";
import { type Host, type HostOptions, launchHost } from "../../host/launch.ts";
import type { VoiceManifest } from "../../runtime/src/narration.ts";
import type { Snapshot } from "../../runtime/src/protocol.ts";
import type { Step, Tour } from "../../runtime/src/schema.ts";

const ASSETS = resolve(import.meta.dirname, "..", "..", "fixtures", "assets");
const VOICE = resolve(import.meta.dirname, "..", "..", "fixtures", "showcase", "voice");
const tour = (id: string, steps: Step[]): Tour => ({
  showcase: 1,
  id,
  title: id,
  meta: { kind: "walkthrough", audience: "team", afterwards: "try", language: "en-GB", length: { targetSec: 60 } },
  anchors: {},
  steps,
});

let server: FixtureServer;
before(async () => {
  server = await serveFixture();
});
after(() => {
  server.server.closeAllConnections();
  return server.close();
});
const hosts: Host[] = [];
after(async () => {
  for (const h of hosts) await h.close().catch(() => {});
});

async function launch(options: Omit<HostOptions, "url"> & { url?: string }): Promise<Host> {
  const host = await launchHost({ url: `${server.url}/index.html`, assetsDir: ASSETS, ...options });
  hosts.push(host);
  return host;
}

/** The control's centre, in viewport CSS pixels. */
async function controlAt(host: Host, c: string): Promise<{ x: number; y: number }> {
  return (await host.page.evaluate(`(() => {
    const ctl = document.querySelector("showcase-controls") ?? document.querySelector("showcase-overlay").shadowRoot.querySelector("showcase-controls");
    const r = ctl.shadowRoot.querySelector('[data-c="${c}"]').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`)) as { x: number; y: number };
}

const paused = (s: Snapshot) => s.paused;
const playing = (s: Snapshot) => !s.paused && s.status === "playing";

test("the overlay draws over a modal dialog, and its controls are clickable in Watch without the app seeing the click", async () => {
  const t = tour("modal", [
    {
      id: "dash",
      path: "/index.html",
      beats: [
        {
          id: "m-1",
          narration: ["Open the invite dialog, and look at the roles while we wait here."],
          actions: [
            { id: "cookies", kind: "click", target: { role: "button", name: "Accept cookies" }, effect: "write", done: { kind: "absent", anchor: { role: "region", name: "Cookie consent" } } },
            { id: "invite", kind: "click", target: { role: "button", name: "Invite people" }, effect: "write", done: { kind: "visible", anchor: { role: "dialog", name: "Invite people" } } },
            { id: "roles", kind: "spotlight", target: { role: "button", name: "Add as editor" }, callout: { title: "Roles", body: "Editors change reports." } },
            { id: "wait", kind: "hold", ms: 60_000 },
          ],
        },
      ],
    },
  ]);
  const host = await launch({ tour: t, mode: "watch", speed: 2 });
  await host.page.waitForFunction("document.querySelector('dialog')?.open && document.querySelector('showcase-controls')?.parentElement?.tagName === 'DIALOG'", null, { timeout: 30_000 });
  await host.waitForSnapshot((s) => s.at.action === 3, { timeoutMs: 30_000 });

  // The drawing is on top: the overlay popover was re-shown after showModal, and the pointer shows.
  const top = (await host.page.evaluate(`(() => {
    const o = document.querySelector("showcase-overlay");
    const spot = o.shadowRoot.querySelector(".spot");
    return { open: o.matches(":popover-open"), last: o === document.documentElement.lastElementChild, spot: !spot.hidden, callout: !o.shadowRoot.querySelector(".callout").hidden, pointer: __showcase.overlay.pointer() };
  })()`)) as { open: boolean; spot: boolean; callout: boolean; pointer: { x: number; y: number } };
  assert.ok(top.open, "the overlay popover is open");
  assert.ok(top.spot && top.callout, "the spotlight and its callout are drawn");
  const clip = { x: top.pointer.x + 2, y: top.pointer.y + 6, width: 8, height: 10 };
  const withPointer = await host.page.screenshot({ clip });
  await host.page.evaluate(`document.querySelector("showcase-overlay").shadowRoot.querySelector(".pointer").style.opacity = "0"`);
  const without = await host.page.screenshot({ clip });
  await host.page.evaluate(`document.querySelector("showcase-overlay").shadowRoot.querySelector(".pointer").style.opacity = ""`);
  assert.notDeepEqual(withPointer, without, "the pointer is drawn over the modal dialog");

  // The controls: on top at their own point (elementFromPoint), inside the dialog, so not inert.
  const pause = await controlAt(host, "toggle");
  const hit = (await host.page.evaluate(`(() => {
    const ctl = document.querySelector("showcase-controls");
    const el = document.elementFromPoint(${pause.x}, ${pause.y});
    const inner = ctl.shadowRoot.elementFromPoint(${pause.x}, ${pause.y});
    return { host: el === ctl, button: inner?.closest("[data-c]")?.dataset.c ?? null, inert: !!ctl.closest("[inert]") };
  })()`)) as { host: boolean; button: string | null; inert: boolean };
  assert.deepEqual(hit, { host: true, button: "toggle", inert: false });

  const before = (await host.page.evaluate("window.fixtureEvents.length")) as number;
  const focus = await host.page.evaluate("document.activeElement?.tagName ?? null");
  await host.page.mouse.click(pause.x, pause.y);
  await host.waitForSnapshot(paused, { timeoutMs: 5_000 });
  assert.equal(await host.page.evaluate("document.querySelector('dialog').open"), true, "the dialog stayed open");
  assert.equal(await host.page.evaluate("window.fixtureEvents.length"), before, "the app never saw the click");
  assert.equal(await host.page.evaluate("document.activeElement?.tagName ?? null"), focus, "the controls never took focus");
  await host.page.mouse.click(pause.x, pause.y);
  await host.waitForSnapshot(playing, { timeoutMs: 5_000 });
});

test("in an app's auto popover the controls move inside it, so a click on them doesn't light-dismiss it", async () => {
  const t = tour("auto", [
    {
      id: "dash",
      path: "/index.html",
      beats: [
        {
          id: "a-1",
          narration: ["The notifications panel stays open while you use the controls."],
          actions: [
            { id: "open", kind: "click", target: { role: "button", name: "Notifications" }, effect: "write", done: { kind: "visible", anchor: { role: "heading", name: "Notifications" } } },
            { id: "wait", kind: "hold", ms: 60_000 },
          ],
        },
      ],
    },
  ]);
  const host = await launch({ tour: t, mode: "watch", speed: 2 });
  await host.page.waitForFunction("document.querySelector('showcase-controls')?.parentElement?.id === 'notifications'", null, { timeout: 30_000 });
  const pause = await controlAt(host, "toggle");
  await host.page.mouse.click(pause.x, pause.y);
  await host.waitForSnapshot(paused, { timeoutMs: 5_000 });
  assert.equal(await host.page.evaluate("document.getElementById('notifications').matches(':popover-open')"), true);
  assert.equal(await host.page.evaluate("document.querySelector('showcase-overlay').matches(':popover-open')"), true);
  // Dismissed: the controls go back into the overlay.
  await host.page.evaluate("document.getElementById('notifications').hidePopover()");
  await host.page.waitForFunction("!document.querySelector('showcase-controls')", null, { timeout: 5_000 });
});

const MANIFEST: VoiceManifest = {
  v: 1,
  id: "keys-voice",
  tour: "keys",
  clips: [{ beat: "k-1", text: "This sentence has a voice clip.", hash: "clip-k1", file: "open-0.mp3", durationMs: 3000 }],
};

test("the viewer's keys and the voice: Space pauses, M mutes, → moves on, Esc ends; clips play from Blob URLs", async () => {
  const hold = { id: "hold", kind: "hold" as const, ms: 60_000 };
  const t = tour("keys", [
    { id: "one", path: "/index.html", beats: [{ id: "k-1", narration: ["This sentence has a voice clip.", "And this one doesn't."], actions: [hold] }] },
    { id: "two", path: "/index.html", beats: [{ id: "k-2", narration: ["Step two."], actions: [hold] }] },
    { id: "three", path: "/index.html", beats: [{ id: "k-3", narration: ["Step three."], actions: [hold] }] },
  ]);
  const host = await launch({ tour: t, mode: "watch", speed: 1, manifest: MANIFEST, voiceDir: VOICE });
  await host.waitForSnapshot((s) => s.caption?.text === "This sentence has a voice clip.", { timeoutMs: 15_000 });
  await host.page.waitForFunction("__showcase.audio.played.includes('clip-k1')", null, { timeout: 5_000 });
  const audio = (await host.page.evaluate(`(() => { const a = __showcase.audio; return { failed: a.failed, muted: a.muted }; })()`)) as { failed: string[]; muted: boolean };
  assert.deepEqual(audio, { failed: [], muted: false });

  await host.page.keyboard.press("Space");
  await host.waitForSnapshot(paused, { timeoutMs: 5_000 });
  await host.page.keyboard.press("Space");
  await host.waitForSnapshot(playing, { timeoutMs: 5_000 });
  await host.page.keyboard.press("m");
  await host.waitForSnapshot((s) => s.muted, { timeoutMs: 5_000 });
  assert.equal(await host.page.evaluate("__showcase.audio.muted"), true);
  await host.page.keyboard.press("ArrowRight");
  await host.waitForSnapshot((s) => s.stepIndex === 1 && s.status === "playing", { timeoutMs: 10_000 });
  await host.page.keyboard.press("ArrowLeft");
  await host.waitForSnapshot((s) => s.stepIndex === 0 && s.status === "playing", { timeoutMs: 10_000 });
  await host.page.keyboard.press("Escape");
  const end = await host.waitForSnapshot((s) => s.status === "done", { timeoutMs: 10_000 });
  assert.deepEqual(end.ended, { reason: "left" });
});

test("a viewer's click on the page pauses; the overlay comes back if the app removes it", async () => {
  const t = tour("click", [{ id: "one", path: "/index.html", beats: [{ id: "c-1", narration: ["Click anywhere to pause."], actions: [{ id: "hold", kind: "hold", ms: 60_000 }] }] }]);
  const host = await launch({ tour: t, mode: "watch", speed: 1 });
  await host.waitForSnapshot((s) => s.status === "playing" && s.caption !== null, { timeoutMs: 15_000 });
  await host.page.mouse.click(40, 300);
  await host.waitForSnapshot(paused, { timeoutMs: 5_000 });
  await host.page.evaluate("document.querySelector('showcase-overlay').remove()");
  await host.page.waitForFunction("document.querySelector('showcase-overlay')?.matches(':popover-open')", null, { timeout: 5_000 });
});

test("the config's browser settings: a fixed clock after the runtime, hidden selectors, blocked URLs, dialogs and popups", async () => {
  const fixed = "2026-01-02T03:04:05.000Z";
  const host = await launch({
    tour: null,
    mode: "watch",
    browser: { clock: { fixed }, hide: [".cookie-banner"], block: ["*/list.html"], locale: "en-GB", timezone: "Europe/London", colorScheme: "dark" },
  });
  const r = (await host.page.evaluate(`(async () => {
    const blocked = await fetch("/list.html").then(() => false, () => true);
    const allowed = await fetch("/detail.html").then((x) => x.ok, () => false);
    return {
      now: new Date(Date.now()).toISOString(),
      real: __showcaseNatives.dateNow(),
      banner: getComputedStyle(document.querySelector(".cookie-banner")).display,
      blocked, allowed,
      dark: matchMedia("(prefers-color-scheme: dark)").matches,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      confirmed: confirm("Leave?"),
    };
  })()`)) as Record<string, unknown>;
  assert.equal(r.now, fixed, "the app sees the fixed clock");
  assert.ok(Math.abs((r.real as number) - Date.now()) < 60_000, "the runtime's captured clock is the real one");
  assert.equal(r.banner, "none");
  assert.equal(r.blocked, true);
  assert.equal(r.allowed, true);
  assert.equal(r.dark, true);
  assert.equal(r.tz, "Europe/London");
  assert.equal(r.confirmed, true, "dialogs are accepted");
  // window.open stays in the tab.
  await host.page.getByRole("link", { name: "Open help in a new window" }).click();
  await host.page.waitForURL(/detail\.html\?id=help$/, { timeout: 10_000 });
  assert.equal(host.context.pages().length, 1);
});
