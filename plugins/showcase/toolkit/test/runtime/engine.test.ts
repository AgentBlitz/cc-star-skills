/**
 * The engine in real Chromium on the fixture app (PLAN §5 Session 4): every action kind with
 * trusted input, covered targets, a full page load mid-tour, a missing anchor, Back, and a
 * deep link's fast-forward. The host skeleton injects the built bundle, so `npm run
 * build:runtime` must have run.
 */
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { after, before, test } from "node:test";
import { type FixtureServer, serveFixture } from "../../fixtures/serve.ts";
import { type Host, launchHost, type HostOptions } from "../../host/launch.ts";
import { filmOrderProblems } from "../../runtime/src/film-events.ts";
import type { Action, Ready, Step, Tour } from "../../runtime/src/schema.ts";

const ASSETS = resolve(import.meta.dirname, "..", "..", "fixtures", "assets");
const status = (contains: string): Ready => ({ kind: "text", anchor: { role: "status" }, contains });
const tour = (id: string, steps: Step[], anchors: Tour["anchors"] = {}): Tour => ({
  showcase: 1,
  id,
  title: id,
  meta: { kind: "walkthrough", audience: "team", afterwards: "try", language: "en-GB", length: { targetSec: 60 } },
  anchors,
  steps,
});
const say = (...lines: string[]) => lines;

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
  const host = await launchHost({ url: `${server.url}/index.html`, speed: 8, assetsDir: ASSETS, ...options });
  hosts.push(host);
  return host;
}

const KINDS_TOUR = tour("kinds", [
  {
    id: "dash",
    path: "/index.html",
    beats: [
      {
        id: "k-click",
        narration: say("Clicking."),
        actions: [{ id: "cookies", kind: "click", target: { role: "button", name: "Accept cookies" }, effect: "write", done: { kind: "absent", anchor: { role: "region", name: "Cookie consent" } } }],
        dwellMs: 0,
      },
      {
        id: "k-form",
        narration: say("Typing, selecting and checking."),
        actions: [
          { id: "name", kind: "type", target: { label: "Workspace name" }, text: "Acme", effect: "write", done: { kind: "attr", anchor: { label: "Workspace name" }, name: "value", prop: true, equals: "Acme" } },
          { id: "region", kind: "select", target: { label: "Region" }, option: "Ireland", effect: "write", done: { kind: "attr", anchor: { label: "Region" }, name: "value", prop: true, equals: "Ireland" } },
          { id: "weekly", kind: "check", target: { label: "Email me weekly" }, effect: "write", done: { kind: "attr", anchor: { label: "Email me weekly" }, name: "checked", prop: true, equals: "true" } },
          { id: "notes", kind: "type", target: { role: "textbox", name: "Notes" }, text: "Soon.", effect: "write", done: { kind: "text", anchor: { role: "textbox", name: "Notes" }, equals: "Soon." } },
          { id: "focus", kind: "focus", target: { label: "Workspace name" } },
        ],
        dwellMs: 0,
      },
      {
        id: "k-menu",
        narration: say("Hovering, keys and a long press."),
        actions: [
          { id: "hover", kind: "hover", target: { role: "link", name: "Resources" } },
          { id: "revealed", kind: "wait", until: { kind: "visible", anchor: { role: "link", name: "API reference" } } },
          { id: "account", kind: "click", target: { role: "button", name: "Account" }, effect: "write", done: { kind: "visible", anchor: { role: "menuitem", name: "Profile" } } },
          { id: "escape", kind: "key", key: "Escape", effect: "write", done: { kind: "absent", anchor: { role: "menuitem", name: "Profile" } } },
          { id: "press", kind: "press", target: { role: "button", name: "Open Q3 revenue" }, ms: 150, effect: "write", done: status("Open Q3 revenue") },
        ],
        dwellMs: 0,
      },
      {
        id: "k-drag",
        narration: say("Dragging, uploading and scrolling."),
        actions: [
          { id: "drag", kind: "drag", target: { role: "listitem", name: "Stale report: Q1 forecast" }, to: { role: "region", name: "Archive" }, effect: "write", done: status("Archived by drag") },
          { id: "upload", kind: "upload", target: { label: "Attach a file" }, files: ["upload.txt"], effect: "write", done: status("Attached upload.txt") },
          { id: "scroll", kind: "scroll", target: { role: "region", name: "Activity feed" }, until: { kind: "visible", anchor: { role: "button", name: "Acknowledge entry 40" } } },
          { id: "ack", kind: "click", target: { role: "button", name: "Acknowledge entry 40" }, effect: "write", done: status("Acknowledge entry 40") },
        ],
        dwellMs: 0,
      },
      {
        id: "k-show",
        narration: say("Showing."),
        actions: [
          { id: "spot", kind: "spotlight", target: { role: "heading", name: "Release notes" }, callout: { title: "Notes", body: "What changed." } },
          { id: "camera", kind: "camera", target: { role: "heading", name: "Release notes" }, scale: 1.5 },
          { id: "wait", kind: "wait", ms: 50 },
          { id: "hold", kind: "hold", ms: 50 },
          { id: "card", kind: "card", title: "A card", lines: ["one", "two"], ms: 50 },
          { id: "noop", kind: "invoke", name: "noop", effect: "write", done: { kind: "attr", anchor: { css: "html" }, name: "data-noop", equals: "1" } },
          { id: "frame", kind: "click", target: { role: "button", name: "Approve claim C" }, effect: "write", done: { kind: "text", anchor: { role: "status", frame: "iframe" }, contains: "Approve claim C" } },
        ],
        dwellMs: 0,
      },
      {
        id: "k-goto",
        narration: say("And a page load."),
        actions: [{ id: "goto", kind: "goto", url: "/list.html", navigates: true, effect: "write", done: { kind: "url", path: "/list.html" } }],
        dwellMs: 0,
      },
    ],
  },
  {
    id: "reports",
    path: "/list.html",
    ready: { kind: "visible", anchor: { role: "heading", name: "Reports" } },
    beats: [{ id: "k-done", narration: say("Done."), actions: [{ id: "spot2", kind: "spotlight", target: { role: "link", name: "Pipeline" } }], dwellMs: 0 }],
  },
]);

const NOOP = `window.__showcase && window.__showcase.actions.register("noop", () => { document.documentElement.setAttribute("data-noop", "1"); });`;

test("every action kind works, with trusted input where input is involved", async () => {
  const host = await launch({ tour: KINDS_TOUR, mode: "film", initScripts: [NOOP] });
  await host.waitForEvent("film:armed");
  await host.go();
  const end = await host.waitForEvent("film:end", { timeoutMs: 90_000 }).catch(() => null);
  const error = host.events.find((e) => e.type === "film:error");
  assert.ok(!error, `film:error: ${JSON.stringify(error)}\nlogs: ${JSON.stringify(host.logs)}`);
  assert.ok(end, `no film:end: ${JSON.stringify(host.events.slice(-5))}`);
  assert.deepEqual(filmOrderProblems(host.events), []);
  const done = host.events.filter((e) => e.type === "action" && e.phase === "done") as Extract<(typeof host.events)[number], { type: "action" }>[];
  const byId = new Map(done.map((e) => [e.id, e]));
  for (const id of ["cookies", "name", "region", "weekly", "notes", "hover", "account", "escape", "press", "drag", "upload", "scroll", "ack", "frame"]) {
    assert.equal(byId.get(id)?.input, "trusted", `${id}: ${JSON.stringify(byId.get(id))} notes=${JSON.stringify(host.logs)}`);
  }
  for (const id of ["focus", "revealed", "spot", "camera", "wait", "hold", "card", "noop", "goto", "spot2"]) assert.ok(byId.has(id), `${id} ran`);
  assert.deepEqual(host.logs.filter((l) => /synthetic/.test(l.message)), [], "no synthetic fallbacks");
  const kinds = new Set(host.inputs.map((i) => i.kind));
  for (const k of ["click", "type", "key", "move", "down", "up", "wheel", "upload"]) assert.ok(kinds.has(k as never), `host saw ${k}`);
  assert.ok(host.events.some((e) => e.type === "camera" && e.rect !== null && e.scale === 1.5));
  assert.ok(host.events.some((e) => e.type === "nav" && e.kind === "load" && e.url.endsWith("/list.html")));
  assert.equal(host.readies.length, 2);
  assert.ok(host.readies[1]?.resumed);
});

test("an SPA route mid-film: the host's nav event and the page's events keep one rising sequence", async () => {
  const t = tour("spa-film", [
    {
      id: "spa",
      path: "/spa",
      beats: [
        { id: "s-1", narration: say("The workspace."), actions: [{ id: "to-settings", kind: "click", target: { role: "link", name: "Settings" }, navigates: true }], dwellMs: 0 },
        { id: "s-2", narration: say("Its settings, on the same page."), actions: [{ id: "to-members", kind: "click", target: { role: "link", name: "Members" }, navigates: true }], dwellMs: 0 },
        { id: "s-3", narration: say("And its members."), dwellMs: 0 },
      ],
    },
  ]);
  const host = await launch({ tour: t, mode: "film", url: `${server.url}/spa` });
  await host.waitForEvent("film:armed");
  await host.go();
  await host.waitForEvent("film:end", { timeoutMs: 60_000 });
  const navs = host.events.filter((e) => e.type === "nav");
  assert.deepEqual(navs.map((e) => (e.type === "nav" ? `${e.kind} ${new URL(e.url).pathname}` : "")), ["spa /spa/settings", "spa /spa/members"]);
  assert.deepEqual(filmOrderProblems(host.events), []);
});

test("covered targets are handled: the sticky header, the cookie banner, a nested scroller, a frame, a modal dialog", async () => {
  const t = tour("covered", [
    {
      id: "dash",
      path: "/index.html",
      beats: [
        {
          id: "c-1",
          narration: say("Four covered targets."),
          actions: [
            { id: "header", kind: "click", target: { role: "button", name: "Open churn by region" }, effect: "write", done: status("Open churn by region") },
            { id: "banner", kind: "click", target: { role: "button", name: "Schedule finance close" }, effect: "write", done: status("Schedule finance close") },
            { id: "scroller", kind: "click", target: { role: "button", name: "Acknowledge entry 35" }, effect: "write", done: status("Acknowledge entry 35") },
            { id: "frame", kind: "click", target: { role: "button", name: "Approve claim F" }, effect: "write", done: { kind: "text", anchor: { role: "status", frame: "iframe" }, contains: "Approve claim F" } },
            { id: "invite", kind: "click", target: { role: "button", name: "Invite people" }, effect: "write", done: { kind: "visible", anchor: { role: "button", name: "Add as editor" } } },
            { id: "dialog", kind: "click", target: { role: "button", name: "Add as editor" }, effect: "write", done: status("Add as editor") },
          ],
          dwellMs: 0,
        },
      ],
    },
  ]);
  const host = await launch({ tour: t, mode: "film" });
  await host.waitForEvent("film:armed");
  await host.go();
  await host.waitForEvent("film:end", { timeoutMs: 60_000 });
  const done = host.events.filter((e) => e.type === "action" && e.phase === "done");
  assert.equal(done.length, 6, JSON.stringify(host.events.filter((e) => e.type === "film:error")));
  assert.ok(done.every((e) => e.type === "action" && e.input === "trusted"), JSON.stringify(host.logs));
  const events = (await host.page.evaluate("window.fixtureEvents")) as { label: string; trusted: boolean }[];
  for (const label of ["Open churn by region", "Schedule finance close", "Acknowledge entry 35", "Invite people", "Add as editor"]) {
    assert.ok(events.some((e) => e.label === label && e.trusted), `${label} landed trusted: ${JSON.stringify(events)}`);
  }
  const frame = host.page.frames().find((f) => f.url().endsWith("/frame.html"));
  const inFrame = (await frame?.evaluate("window.fixtureEvents")) as { label: string; trusted: boolean }[];
  assert.ok(inFrame.some((e) => e.label === "Approve claim F" && e.trusted));
});

test("a full page load mid-tour resumes with host-held state, without repeating writes or sentences", async () => {
  const t = tour("loads", [
    {
      id: "dash",
      path: "/index.html",
      beats: [
        {
          id: "l-1",
          narration: say("First the dashboard.", "Then the reports."),
          actions: [
            { id: "cookies", kind: "click", target: { role: "button", name: "Accept cookies" }, effect: "write", done: { kind: "absent", anchor: { role: "region", name: "Cookie consent" } } },
            { id: "reports", kind: "click", target: { role: "link", name: "Reports" }, navigates: true, effect: "write", done: { kind: "url", path: "/list.html" } },
          ],
          dwellMs: 100,
        },
      ],
    },
    {
      id: "list",
      path: "/list.html",
      beats: [
        {
          id: "l-2",
          narration: say("Open the pipeline report."),
          actions: [{ id: "pipeline", kind: "click", target: { role: "link", name: "Pipeline" }, navigates: true, effect: "write", done: { kind: "url", path: "/detail.html", params: { id: "3" } } }],
          dwellMs: 100,
        },
      ],
    },
    {
      id: "detail",
      path: "/detail.html",
      ready: { kind: "text", anchor: { role: "heading", name: "Pipeline" }, contains: "Pipeline" },
      beats: [{ id: "l-3", narration: say("Here it is."), actions: [{ id: "spot", kind: "spotlight", target: { role: "heading", name: "Pipeline" } }], dwellMs: 100 }],
    },
  ]);
  const host = await launch({ tour: t, mode: "film" });
  await host.waitForEvent("film:armed");
  await host.go();
  await host.waitForEvent("film:end", { timeoutMs: 60_000 });
  assert.deepEqual(filmOrderProblems(host.events), [], JSON.stringify(host.events.map((e) => [e.seq, e.doc, e.type])));
  const texts = host.events.filter((e) => e.type === "sentence:start").map((e) => (e as { text: string }).text);
  assert.deepEqual(texts, ["First the dashboard.", "Then the reports.", "Open the pipeline report.", "Here it is."]);
  const writes = host.events.filter((e) => e.type === "action" && e.phase === "done" && ["cookies", "reports", "pipeline"].includes((e as { id: string }).id));
  assert.equal(writes.length, 3, "each write landed exactly once");
  assert.equal(host.events.filter((e) => e.type === "action" && (e as { id: string }).id === "reports" && e.phase === "start").length, 1);
  const navs = host.events.filter((e) => e.type === "nav");
  assert.equal(navs.length, 2);
  assert.deepEqual([...new Set(host.events.map((e) => e.doc))], [1, 2, 3]);
  assert.deepEqual(host.readies.map((r) => [r.doc, r.resumed]), [[1, false], [2, true], [3, true]]);
  assert.equal(host.events.filter((e) => e.type === "film:armed").length, 1);
  assert.equal(host.state, null, "a finished run clears the host's state");
  assert.match(host.page.url(), /\/detail\.html\?id=3$/);
});

test("names join text as a browser does: split text nodes run together, block boxes are set apart", async () => {
  const host = await launch({ tour: null, mode: "watch" });
  await host.page.evaluate(() => {
    const link = (id: string, ...kids: (Node | string)[]) => {
      const a = document.createElement("a");
      a.href = `#${id}`;
      a.append(...kids);
      document.body.append(a);
    };
    const el = (tag: string, text: string) => Object.assign(document.createElement(tag), { textContent: text });
    // React's `{n} result{n === 1 ? "" : "s"}`: separate text nodes, one word.
    link("split", "30 result", "s", " · keyword");
    link("blocks", el("div", "Alpha"), el("div", "Beta"));
    link("inline", el("span", "Gam"), el("span", "ma"));
  });
  const items = (await host.page.evaluate(`__showcase.inspect({ limit: 400 })`)) as { role: string; name: string }[];
  const names = items.filter((i) => i.role === "link").map((i) => i.name);
  assert.ok(names.includes("30 results · keyword"), names.join(" | "));
  assert.ok(names.includes("Alpha Beta"), names.join(" | "));
  assert.ok(names.includes("Gamma"), names.join(" | "));
});

test("a test id anchor finds the app's data-showcase attribute, as the in-app contract says", async () => {
  const host = await launch({ tour: null, mode: "watch" });
  await host.page.evaluate(() => {
    // Two buttons a role and name can't tell apart: the second carries the app's anchor.
    const button = (mark?: [string, string]) => {
      const b = Object.assign(document.createElement("button"), { textContent: "Open twin" });
      if (mark) b.setAttribute(mark[0], mark[1]);
      document.body.append(b);
    };
    button();
    button(["data-showcase", "second-twin"]);
    button(["data-testid", "third-twin"]);
  });
  const items = (await host.page.evaluate(`__showcase.inspect({ limit: 400 })`)) as { name: string; by: string; anchor: { testId?: string } }[];
  const twins = items.filter((i) => i.name === "Open twin").map((i) => [i.by, i.anchor.testId ?? null]);
  // `inspect` only suggests an anchor that resolves back to its element.
  assert.deepEqual(twins, [["role", null], ["testId", "second-twin"], ["testId", "third-twin"]]);
});

test("a page load mid-film brings the heartbeat back, so a still screen keeps sending frames", async () => {
  const t = tour("rearm", [{ id: "dash", path: "/index.html", beats: [{ id: "r-1", narration: say("Still."), actions: [], dwellMs: 0 }] }]);
  const host = await launch({ tour: t, mode: "film" });
  await host.waitForEvent("film:armed");
  // As the recorder rolls (film/record.ts): later documents see the flag from an init script
  // that runs after the runtime's own.
  await host.context.addInitScript({ content: "window.__showcaseRolling = true;" });
  await host.page.evaluate("(window.__showcaseRolling = true, __showcase.film.heartbeat(true))");
  await host.page.goto(`${server.url}/list.html`);
  await host.page.waitForFunction("__showcase.film.frameRate().frames > 10", null, { timeout: 5_000 });
  assert.equal(await host.page.evaluate("!!document.querySelector('showcase-heartbeat')"), true);
});

test("a missing anchor raises film:error naming the beat and the anchor", async () => {
  const t = tour("missing", [
    { id: "dash", path: "/index.html", beats: [{ id: "m-1", narration: say("Nothing here."), actions: [{ id: "nope", kind: "click", target: { role: "button", name: "No such button" }, timeoutMs: 1000 }], dwellMs: 0 }] },
  ]);
  const host = await launch({ tour: t, mode: "film", initScripts: [] });
  await host.waitForEvent("film:armed");
  await host.go();
  const err = await host.waitForEvent("film:error", { timeoutMs: 30_000 });
  assert.ok(err.type === "film:error");
  assert.equal(err.beat, "m-1");
  assert.match(err.anchor ?? "", /No such button/);
  assert.match(err.message, /Couldn't find/);
  const snap = await host.waitForSnapshot((s) => s.status === "done");
  assert.deepEqual(snap.ended, { reason: "error" });
  assert.deepEqual(filmOrderProblems(host.events), []);
});

const BACK_TOUR = tour("back", [
  {
    id: "one",
    path: "/index.html",
    beats: [
      {
        id: "b-1",
        narration: say("Open the revenue report."),
        actions: [
          { id: "cookies", kind: "click", target: { role: "button", name: "Accept cookies" }, effect: "write", done: { kind: "absent", anchor: { role: "region", name: "Cookie consent" } } },
          { id: "spot", kind: "spotlight", target: { role: "heading", name: "Recent reports" } },
          { id: "open", kind: "click", target: { role: "button", name: "Open Q3 revenue" }, effect: "write", done: status("Open Q3 revenue") },
        ],
        dwellMs: 0,
      },
    ],
  },
  {
    id: "two",
    path: "/index.html",
    beats: [{ id: "b-2", narration: say("Then the pipeline."), actions: [{ id: "pipe", kind: "click", target: { role: "button", name: "Open pipeline" }, effect: "write", done: status("Open pipeline") }], dwellMs: 0 }],
  },
]);

test("Back re-shows the previous step without writing again", async () => {
  const host = await launch({ tour: BACK_TOUR, mode: "watch" });
  await host.waitForSnapshot((s) => s.stepIndex === 1 && s.status === "playing", { timeoutMs: 30_000 });
  await host.waitForSnapshot((s) => s.journal.includes("two/b-2/pipe"), { timeoutMs: 30_000 });
  const before = (await host.page.evaluate("window.fixtureEvents.map(e => e.label)")) as string[];
  assert.deepEqual(before, ["Accept cookies", "Open Q3 revenue", "Open pipeline"]);
  await host.dispatch({ type: "back" });
  await host.waitForSnapshot((s) => s.stepIndex === 0 && s.status === "playing", { timeoutMs: 30_000 });
  await host.waitForSnapshot((s) => s.stepIndex === 1 && s.status === "playing", { timeoutMs: 30_000 });
  const after_ = (await host.page.evaluate("window.fixtureEvents.map(e => e.label)")) as string[];
  assert.deepEqual(after_, before, "the re-shown step clicked nothing: both writes were in the journal");
  const snap = host.latest();
  assert.deepEqual(snap?.journal, ["one/b-1/cookies", "one/b-1/open", "two/b-2/pipe"]);
});

test("a deep link fast-forwards the skipped writes silently", async () => {
  const host = await launch({ tour: BACK_TOUR, mode: "film", from: "two" });
  await host.waitForEvent("film:armed", { timeoutMs: 30_000 });
  // Step one's writes landed before the film was armed, with trusted input, and were not spoken.
  const labels = (await host.page.evaluate("window.fixtureEvents.map(e => e.label + (e.trusted ? '' : '?'))")) as string[];
  assert.deepEqual(labels, ["Accept cookies", "Open Q3 revenue"]);
  assert.equal(host.events.length, 1, "nothing was filmed on the way");
  await host.go();
  await host.waitForEvent("film:end", { timeoutMs: 30_000 });
  const texts = host.events.filter((e) => e.type === "sentence:start").map((e) => (e as { text: string }).text);
  assert.deepEqual(texts, ["Then the pipeline."]);
  const beats = host.events.filter((e) => e.type === "beat:start").map((e) => (e as { beat: string; index: number }).index);
  assert.deepEqual(beats, [0]);
  assert.deepEqual(filmOrderProblems(host.events), []);
});
