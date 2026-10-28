/**
 * The host's Node side (PLAN §5 Session 5): the app's lifecycle (port, health, the snapshot and
 * reset hooks, the child-environment policy, the process-group kill), the per-repo lock, the
 * on-screen checks, the sign-in file's permissions, candidate anchors and the storyboard page.
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { acquireLock, groupAlive, LockError, startApp } from "../host/app.ts";
import { writeSecret } from "../host/auth.ts";
import { candidatesFor } from "../host/rehearse.ts";
import { denyHits, missingNumbers, quantity } from "../lib/screen-checks.ts";
import { loadTour, renderStoryboardHtml, resolveTour } from "../lib/tours.ts";
import { CANARY, scratch } from "./helpers.ts";

const SERVE = resolve(import.meta.dirname, "..", "fixtures", "serve.ts");
const TOUR = resolve(import.meta.dirname, "..", "fixtures", "showcase", "tours", "fixture-tour.json");

test("the app comes up on its own port after its snapshot, is reset once healthy, sees no keys, and its whole group is stopped", async () => {
  const root = scratch("showcase-app-");
  const log = join(root, "order.log");
  process.env.OPENROUTER_API_KEY = CANARY;
  try {
    const app = await startApp(
      {
        // A grandchild keeps running under `sh`: the group kill must take it down too.
        start: `node --disable-warning=ExperimentalWarning ${JSON.stringify(SERVE)} --port {port} & sleep 600`,
        url: "http://127.0.0.1:{port}",
        health: "/index.html",
        env: { SHOWCASE_FIXTURE: "on {port}" },
        snapshot: `echo snapshot >> ${JSON.stringify(log)}`,
        reset: `echo "reset $PORT \${OPENROUTER_API_KEY:-none} $SHOWCASE_FIXTURE" >> ${JSON.stringify(log)}`,
      },
      { root, logFile: join(root, "app.log") },
    );
    assert.ok(app.port && app.port > 1024);
    assert.equal(app.url, `http://127.0.0.1:${app.port}`);
    const res = await fetch(`${app.url}/list.html`);
    assert.equal(res.status, 200);
    await res.arrayBuffer();
    assert.deepEqual(readFileSync(log, "utf8").trim().split("\n"), ["snapshot", `reset ${app.port} none on ${app.port}`]);
    assert.ok(app.pid && groupAlive(app.pid));
    await app.stop();
    assert.equal(groupAlive(app.pid), false, "the whole process group is gone");
    await assert.rejects(fetch(`${app.url}/index.html`, { signal: AbortSignal.timeout(2000) }));
  } finally {
    delete process.env.OPENROUTER_API_KEY;
  }
});

test("inspect and auth keep the snapshot but skip the reset; --no-reset skips both", async () => {
  const root = scratch("showcase-app-");
  const log = join(root, "order.log");
  const app = {
    start: `node --disable-warning=ExperimentalWarning ${JSON.stringify(SERVE)} --port {port}`,
    url: "http://127.0.0.1:{port}",
    health: "/index.html",
    snapshot: `echo snapshot >> ${JSON.stringify(log)}`,
    reset: `echo reset >> ${JSON.stringify(log)}`,
  };
  const lines = () => (existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : []);
  // What inspect and auth ask for: the snapshot creates the data a fresh checkout needs.
  const kept = await startApp(app, { root, reset: false, snapshot: true });
  await kept.stop();
  assert.deepEqual(lines(), ["snapshot"]);
  // --no-reset: neither.
  const none = await startApp(app, { root, reset: false });
  await none.stop();
  assert.deepEqual(lines(), ["snapshot"]);
});

test("an app that never gets healthy, or exits, is a clear failure and leaves nothing running", async () => {
  const root = scratch("showcase-app-");
  await assert.rejects(startApp({ start: "exit 3", url: "http://127.0.0.1:{port}" }, { root, healthTimeoutMs: 5_000 }), /exited \(code 3\)/);
  await assert.rejects(startApp({ url: "http://127.0.0.1:9/" }, { root, healthTimeoutMs: 1_000 }), /wasn't healthy/);
  await assert.rejects(startApp({ url: "http://127.0.0.1:{port}" }, { root }), /no app\.start/);
});

test("an app that stops answering after its reset, or whose start fails once healthy, fails before filming", async () => {
  const root = scratch("showcase-app-");
  const pid = join(root, "server.pid");
  const serve = `node --disable-warning=ExperimentalWarning ${JSON.stringify(SERVE)} --port {port}`;
  // Healthy, then the reset takes the server down (Session 7: `web` left created but not started).
  const t0 = Date.now();
  await assert.rejects(
    startApp({ start: `${serve} & echo $! > ${JSON.stringify(pid)}; wait`, url: "http://127.0.0.1:{port}", health: "/index.html", reset: `kill $(cat ${JSON.stringify(pid)})` }, { root, healthTimeoutMs: 3_000 }),
    /isn't answering at http:\/\/127\.0\.0\.1:\d+\/ after app\.reset/,
  );
  assert.ok(Date.now() - t0 < 15_000, "it fails within the wait, not when the tour opens");
  // Healthy, but the start command then fails: the app is up only by chance.
  await assert.rejects(
    startApp({ start: `${serve} & sleep 1; exit 4`, url: "http://127.0.0.1:{port}", health: "/index.html", reset: "sleep 2" }, { root, healthTimeoutMs: 5_000 }),
    /app\.start failed \(exit 4\) after the app answered/,
  );
});

test("the per-repo lock: one holder at a time, a dead holder's lock is taken over, and release removes it", () => {
  const dir = join(scratch("showcase-lock-"), "showcase");
  mkdirSync(dir);
  const lock = acquireLock(dir, "rehearse a");
  assert.ok(existsSync(lock.file));
  // This process holds it: a second taker (as another process would) is refused, naming the holder.
  writeFileSync(lock.file, JSON.stringify({ pid: process.ppid, what: "watch b" }));
  assert.throws(() => acquireLock(dir, "rehearse c"), (e) => e instanceof LockError && e.pid === process.ppid);
  writeFileSync(lock.file, JSON.stringify({ pid: 999_999, what: "a crashed run" }));
  const taken = acquireLock(dir, "rehearse d");
  assert.equal((JSON.parse(readFileSync(taken.file, "utf8")) as { pid: number }).pid, process.pid);
  taken.release();
  assert.equal(existsSync(taken.file), false);
});

test("spoken numbers are matched on screen by value: digits, words, percent and magnitudes", () => {
  assert.deepEqual(quantity("four per cent"), { value: 4, percent: true });
  assert.deepEqual(quantity("£4.2m"), { value: 4_200_000, percent: false });
  assert.deepEqual(quantity("two million"), { value: 2_000_000, percent: false });
  assert.equal(quantity("3:00"), null);
  const screen = "Revenue £4.2m, 4% ahead of plan. 1,200 seats. Kick-off 3:00";
  assert.deepEqual(missingNumbers(["Revenue is four per cent ahead, at £4.2m.", "Twelve hundred seats", "We start at 3:00."], screen), []);
  assert.deepEqual(missingNumbers(["Seven per cent.", "1,300 seats.", "At 4:00."], screen), ["Seven per cent", "1,300", "4:00"]);
  assert.deepEqual(missingNumbers(["It's 4 ahead."], screen), [], "a plain figure may match a percentage on screen");
  assert.deepEqual(missingNumbers(["Four per cent."], "4 ahead"), ["Four per cent"], "but a spoken percentage needs one on screen");
});

test("the deny-list matches strings without case and patterns as written", () => {
  const screen = "Invite sam@example.com · call 555-123-4567";
  assert.deepEqual(denyHits(screen, ["SAM@EXAMPLE.COM", "nobody@example.com", { pattern: "\\b\\d{3}-\\d{3}-\\d{4}\\b" }, { pattern: "(" }]), [
    { rule: "SAM@EXAMPLE.COM", match: "sam@example.com" },
    { rule: "/\\b\\d{3}-\\d{3}-\\d{4}\\b/", match: "555-123-4567" },
  ]);
});

test("the sign-in file is written owner-only, in an owner-only directory", () => {
  const file = join(scratch("showcase-auth-"), "showcase", ".auth", "state.json");
  writeSecret(file, '{"cookies":[],"origins":[]}');
  assert.equal(statSync(file).mode & 0o777, 0o600);
  assert.equal(statSync(join(file, "..")).mode & 0o777, 0o700);
  writeSecret(file, '{"cookies":[1],"origins":[]}');
  assert.equal(statSync(file).mode & 0o777, 0o600);
});

test("candidate anchors rank the outline against the anchor that couldn't be found", () => {
  const rows = [
    { role: "heading", name: "Cookies", depth: 0, anchor: { role: "heading", name: "Cookies" } },
    { role: "button", name: "Accept cookies", depth: 0, anchor: { role: "button", name: "Accept cookies" } },
    { role: "button", name: "Decline", depth: 0, anchor: { role: "button", name: "Decline" } },
    { role: "link", name: "Pipeline", depth: 0, anchor: null },
  ];
  const c = candidatesFor('button "Accept all cookies"', rows);
  assert.deepEqual(c[0]?.anchor, { role: "button", name: "Accept cookies" });
  assert.ok(!c.some((x) => x.name === "Pipeline"));
  assert.deepEqual(candidatesFor(null, rows), []);
});

test("the storyboard page shows each beat's still beside its narration", () => {
  const loaded = loadTour(resolveTour(TOUR));
  assert.ok(loaded.tour);
  const html = renderStoryboardHtml(loaded.tour, { invite: "rehearse/04-invite.png" }, "A note & more");
  assert.match(html, /<img src="rehearse\/04-invite.png" alt="invite"/);
  assert.equal((html.match(/<section class="beat">/g) ?? []).length, 8);
  assert.match(html, /no still yet/);
  assert.match(html, /A note &amp; more/);
  assert.match(html, /Choose what they can do, and they&#39;re in\.|Choose what they can do, and they're in\./);
});
