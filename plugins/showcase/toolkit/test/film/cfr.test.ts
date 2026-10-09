/** The film's frame arithmetic (`film/cfr.ts`), the timeline spans and the frame sink's queue. */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { cfrCount, cfrSchedule, fpsWindows, frameGaps, percentile } from "../../film/cfr.ts";
import { createFrameSink, jpegSize } from "../../film/frames.ts";
import { buildNotes } from "../../film/record.ts";
import { spans } from "../../film/timeline.ts";
import type { FilmEvent } from "../../runtime/src/film-events.ts";

test("the CFR schedule shows the latest frame at or before each output time", () => {
  // Frames at 0, 10, 50, 51 and 120 ms; 30 fps from 0 to 133.4 ms → 4 output frames.
  const ts = [1000, 1010, 1050, 1051, 1120];
  assert.equal(cfrCount(1000, 1133.4, 30), 4);
  assert.deepEqual(cfrSchedule(ts, 30, 1000, 1133.4), [0, 1, 3, 3]);
  // Before the first frame, the first frame is held.
  assert.deepEqual(cfrSchedule([1100, 1200], 30, 1000, 1100), [0, 0, 0]);
  assert.throws(() => cfrSchedule([], 30, 0, 100), /no frames/);
});

test("the schedule's length makes the video as long as the timeline, within half a frame", () => {
  for (const ms of [1000, 40_271, 59_999, 120_016.7]) {
    const n = cfrCount(0, ms, 30);
    assert.ok(Math.abs((n * 1000) / 30 - ms) <= 1000 / 60 + 1e-9, `${ms} ms → ${n} frames`);
  }
});

test("gaps are clipped to the take, longest first, and a page load's hold is marked", () => {
  const ts = [900, 1000, 1016, 1032, 1250, 1266, 1500];
  const gaps = frameGaps(ts, 1000, 1600, [1100]);
  assert.equal(gaps[0]?.ms, 234); // 1266 → 1500
  assert.equal(gaps[0]?.nav, false);
  const load = gaps.find((g) => g.from === 1032);
  assert.equal(load?.ms, 218);
  assert.equal(load?.nav, true);
  // The tail after the last frame counts too.
  assert.ok(gaps.some((g) => g.from === 1500 && g.to === 1600));
  // A gap that starts before the take is clipped to its start.
  assert.equal(frameGaps([500, 1100], 1000, 1100).find((g) => g.to === 1100)?.from, 1000);
});

test("frame rate windows and percentiles", () => {
  const ts = Array.from({ length: 120 }, (_, i) => 1000 + i * (1000 / 60));
  const w = fpsWindows(ts, 1000, 3000);
  assert.equal(w.length, 5);
  assert.equal(percentile(w, 50), 60);
  assert.equal(percentile([1, 2, 3, 4, 100], 5), 1);
  assert.ok(Number.isNaN(percentile([], 50)));
});

test("timeline spans pair beats and sentences, on the video's clock", () => {
  const base = { v: 1 as const, doc: 1, t: 0 };
  let seq = 0;
  const e = (wall: number, x: Record<string, unknown>) => ({ ...base, seq: ++seq, wall, ...x }) as unknown as FilmEvent;
  const events = [
    e(1000, { type: "film:armed", tour: "t", fingerprint: "f", manifestId: null, viewport: { w: 1280, h: 720, dpr: 1.5 }, runtime: "0" }),
    e(1800, { type: "film:start" }),
    e(1800, { type: "beat:start", beat: "a", index: 0, step: "s", kind: "card", title: "Hi" }),
    e(1800, { type: "sentence:start", beat: "a", index: 0, text: "Hello.", audio: null }),
    e(2600, { type: "sentence:end", beat: "a", index: 0 }),
    e(2700, { type: "nav", url: "http://x/b", kind: "load" }),
    e(3000, { type: "beat:end", beat: "a", index: 0, narrationMs: 800, waitedMs: 0 }),
    e(3100, { type: "film:end" }),
  ];
  const s = spans(events, 1050);
  assert.equal(s.startMs, 750);
  assert.equal(s.endMs, 2050);
  assert.deepEqual(s.beats, [{ beat: "a", index: 0, step: "s", kind: "card", title: "Hi", startMs: 750, endMs: 1950, narrationMs: 800, waitedMs: 0 }]);
  assert.deepEqual(s.sentences, [{ beat: "a", index: 0, text: "Hello.", audio: null, startMs: 750, endMs: 1550 }]);
  assert.deepEqual(s.navs, [{ url: "http://x/b", kind: "load", ms: 1650 }]);
  assert.equal(s.events[0]?.ms, -50);
});

// A 1×1 baseline JPEG: SOI, then a SOF0 saying 1×1 (height then width).
const TINY = Buffer.from("ffd8ffc0000b080001000101011100ffd9", "hex");

test("the frame sink holds acknowledgements back once its queue is full", async () => {
  assert.deepEqual(jpegSize(TINY), { w: 1, h: 1 });
  const dir = resolve(import.meta.dirname, "..", ".out", "sink");
  mkdirSync(dir, { recursive: true });
  const release: (() => void)[] = [];
  const written: string[] = [];
  const sink = createFrameSink({
    dir,
    prefix: "m",
    queueMax: 2,
    write: (file) =>
      new Promise<void>((r) => {
        written.push(file);
        release.push(r);
      }),
  });
  const data = TINY.toString("base64");
  let acked = 0;
  const takes = [1, 2, 3, 4].map((i) => sink.take(data, 1000 + i / 4).then((rec) => (acked++, rec)));
  await new Promise((r) => setTimeout(r, 20));
  // Two fit the queue and are acknowledged at once; the third and fourth wait for writes.
  assert.equal(acked, 2);
  assert.equal(sink.stats.delayedAcks, 2);
  release.shift()?.();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(acked, 3);
  for (const r of release.splice(0)) r();
  const recs = await Promise.all(takes);
  assert.deepEqual(
    recs.map((r) => [r.file, r.ts, r.w, r.h]),
    [
      ["m000000.jpg", 1000250, 1, 1],
      ["m000001.jpg", 1000500, 1, 1],
      ["m000002.jpg", 1000750, 1, 1],
      ["m000003.jpg", 1001000, 1, 1],
    ],
  );
  await sink.flush();
  assert.equal(sink.stats.maxQueue, 4);
  assert.deepEqual(written, recs.map((r) => join(dir, r.file)));
});

test("production-build guidance: a dev server or a missing build is noted", () => {
  assert.match(buildNotes({ url: "http://127.0.0.1:{port}", start: "next dev -p {port}" }).join("\n"), /dev server/);
  assert.match(buildNotes({ url: "http://127.0.0.1:{port}", start: "pnpm dev" }).join("\n"), /dev server/);
  assert.match(buildNotes({ url: "http://127.0.0.1:{port}", start: "npx vite --port {port}" }).join("\n"), /dev server/);
  assert.deepEqual(buildNotes({ url: "http://127.0.0.1:{port}", build: "next build", start: "next start -p {port}" }), []);
  assert.deepEqual(buildNotes({ url: "http://127.0.0.1:{port}", build: "vite build", start: "vite preview --port {port}" }), []);
  assert.match(buildNotes({ url: "http://127.0.0.1:{port}", start: "node server.js" }).join("\n"), /no app\.build/);
});
