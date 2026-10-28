/**
 * The film contract's `order` check (`filmOrderProblems`), on hand-written timelines. The host
 * stamps its `nav` events when Chrome's message reaches it, so they can trail the page's own
 * events of the same moment by a few ms (showcase 1.1.2, from a real run's #72 and #73).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { type FilmEvent, type FilmEventInput, filmOrderProblems, HOST_SKEW_MS } from "../../runtime/src/film-events.ts";

const T = 1_793_186_540_000;

/** A run: armed and started in doc 1, then the given events, stamped in list order. */
function run(rest: readonly [FilmEventInput, number, number][]): FilmEvent[] {
  const head: [FilmEventInput, number, number][] = [
    [{ type: "film:armed", tour: "t", fingerprint: "f", manifestId: null, viewport: { w: 1920, h: 1080, dpr: 1 }, runtime: "r" }, 1, T],
    [{ type: "film:start" }, 1, T + 1],
  ];
  return [...head, ...rest].map(([input, doc, t], i) => ({ ...input, v: 1, seq: i + 1, doc, t, wall: Math.floor(t) }) as FilmEvent);
}

const beat = (index: number): FilmEventInput => ({ type: "beat:start", beat: `b${index}`, index, step: `s${index}`, kind: "screen" });
const end = (index: number): FilmEventInput => ({ type: "beat:end", beat: `b${index}`, index, narrationMs: 0, waitedMs: 0 });
const act = (index: number): FilmEventInput => ({ type: "action", beat: `b${index}`, id: "a", kind: "click", phase: "done" });
const nav = (kind: "load" | "spa"): FilmEventInput => ({ type: "nav", url: "http://localhost/review", kind });

test("order: a page event stamped just before the host's nav for it is not time going back", () => {
  // Run B, 28 October: the host heard of the SPA navigation 1.3 ms after the page began the beat.
  const events = run([
    [beat(0), 1, T + 100],
    [end(0), 1, T + 338.1],
    [nav("load"), 1, T + 353],
    [nav("spa"), 1, T + 366],
    [nav("spa"), 2, T + 425],
    [beat(1), 2, T + 423.7],
    [act(1), 2, T + 423.9],
    [nav("spa"), 2, T + 427],
    [act(1), 2, T + 444.1],
    [end(1), 2, T + 500],
    [{ type: "film:end" }, 2, T + 501],
  ]);
  assert.deepEqual(filmOrderProblems(events), []);
});

test("order: a host stamp a fraction of a ms behind the page event before it is not time going back", () => {
  // The page's `t` is fractional; the host's `Date.now()` is a whole ms.
  const events = run([
    [beat(0), 1, T + 100.7],
    [nav("spa"), 1, T + 100],
    [end(0), 1, T + 200],
    [{ type: "film:end" }, 1, T + 201],
  ]);
  assert.deepEqual(filmOrderProblems(events), []);
});

test("order: real reordering is still caught", () => {
  // Two page events out of order: no skew is allowed between the page's own stamps.
  const page = run([
    [beat(0), 1, T + 100],
    [act(0), 1, T + 150],
    [act(0), 1, T + 149.9],
    [end(0), 1, T + 200],
    [{ type: "film:end" }, 1, T + 201],
  ]);
  assert.deepEqual(filmOrderProblems(page), ["#4 action: time went back 0.1 ms"]);
  // A page event further before the host's nav than the skew allows.
  const host = run([
    [beat(0), 1, T + 100],
    [nav("spa"), 1, T + 200],
    [act(0), 1, T + 200 - HOST_SKEW_MS - 1],
    [end(0), 1, T + 300],
    [{ type: "film:end" }, 1, T + 301],
  ]);
  assert.deepEqual(filmOrderProblems(host), [`#4 action: time went back ${HOST_SKEW_MS + 1} ms across host and page stamps (at most ${HOST_SKEW_MS})`]);
  // Two host stamps out of order.
  const navs = run([
    [beat(0), 1, T + 100],
    [nav("spa"), 1, T + 200],
    [nav("spa"), 1, T + 199],
    [end(0), 1, T + 300],
    [{ type: "film:end" }, 1, T + 301],
  ]);
  assert.deepEqual(filmOrderProblems(navs), ["#4 nav: time went back 1 ms"]);
  // A new document starts its own clock.
  const docs = run([
    [beat(0), 1, T + 100],
    [end(0), 1, T + 200],
    [beat(1), 2, T + 50],
    [end(1), 2, T + 300],
    [{ type: "film:end" }, 2, T + 301],
  ]);
  assert.deepEqual(filmOrderProblems(docs), []);
});

test("the skew allowed between host and page stamps is under a frame", () => {
  assert.ok(HOST_SKEW_MS > 0 && HOST_SKEW_MS < 1000 / 60, String(HOST_SKEW_MS));
});
