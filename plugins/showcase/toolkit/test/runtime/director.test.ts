/**
 * The director on a fake clock (PLAN §5 Session 4): two tracks with `after` gates, dwell,
 * pause, Next, Back, fast-forward, the film's events and a resume after a page load. No DOM:
 * the executor, the waits and the router are fakes.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { FakeClock, type RunClocks } from "../../runtime/src/clock.ts";
import { type Command, Director, type DirectorDeps, type Snapshot } from "../../runtime/src/director.ts";
import { type ActionPhase, type Executor, isCosmetic } from "../../runtime/src/executor.ts";
import { type FilmEvent, filmOrderProblems } from "../../runtime/src/film-events.ts";
import type { AudioPort, Cue, VoiceManifest } from "../../runtime/src/narration.ts";
import { readingMs } from "../../runtime/src/narrative.ts";
import type { Action, Ready, Tour } from "../../runtime/src/schema.ts";
import { journalKey, memoryStore, type RunState } from "../../runtime/src/state.ts";
import { createTimeline } from "../../runtime/src/timeline.ts";

const SAVED: Ready = { kind: "exists", anchor: { css: "[data-saved]" } };
const PUBLISHED: Ready = { kind: "exists", anchor: { css: "[data-published]" } };

const TOUR: Tour = {
  showcase: 1,
  id: "fx",
  title: "Fixture",
  meta: { kind: "walkthrough", audience: "team", afterwards: "try", language: "en-GB", length: { targetSec: 60 } },
  anchors: { spot: { css: "[data-spot]" } },
  steps: [
    {
      id: "fx-1",
      title: "One",
      path: "/one",
      beats: [
        {
          id: "fx-1-a",
          narration: ["One.", { text: "After the write.", after: "save" }],
          actions: [
            { id: "spot", kind: "spotlight", target: "@spot" },
            { id: "open", kind: "click", target: "@spot" },
            { id: "save", kind: "click", target: "@spot", effect: "write", done: SAVED },
          ],
          dwellMs: 500,
        },
        { id: "fx-1-b", narration: ["Two."], actions: [{ id: "spot", kind: "spotlight", target: "@spot" }], dwellMs: 0 },
      ],
    },
    {
      id: "fx-2",
      title: "Two",
      path: "/two",
      beats: [{ id: "fx-2-a", narration: ["Three."], actions: [{ id: "publish", kind: "click", target: "@spot", effect: "write", done: PUBLISHED, navigates: true }], dwellMs: 0 }],
    },
    {
      id: "fx-3",
      title: "Three",
      path: "/three",
      beats: [{ id: "fx-3-a", card: { title: "Done" }, narration: ["Four."], actions: [{ id: "spot", kind: "spotlight", target: "@spot" }], dwellMs: 2000 }],
    },
  ],
};

const SAVE = journalKey("fx-1", "fx-1-a", "save");
const PUBLISH = journalKey("fx-2", "fx-2-a", "publish");
const S = readingMs("One.");

interface Bench {
  director: Director;
  pace: FakeClock;
  wall: FakeClock;
  acted: string[];
  navigated: string[];
  screen: Set<string>;
  takes: Map<string, number>;
  snapshots: Snapshot[];
  stamps: number[];
  store: ReturnType<typeof memoryStore>;
  saved: RunState[];
  events: FilmEvent[];
  run(): Snapshot | null;
  tick(ms: number): Promise<void>;
  until(pred: (s: Snapshot | null) => boolean, limitMs?: number): Promise<void>;
  dispatch(c: Command): void;
}

function anchorCss(r: Ready | undefined): string | null {
  if (!r) return null;
  if (r.kind === "all" || r.kind === "any") return anchorCss(r.of[0]);
  if (!("anchor" in r)) return null;
  return typeof r.anchor === "string" ? r.anchor : (r.anchor.css ?? null);
}

function bench(options: { tour?: Tour; screen?: string[]; state?: RunState | null; speed?: number; doc?: number; audio?: AudioPort; manifest?: VoiceManifest; checkpoint?: DirectorDeps["checkpoint"] } = {}): Bench {
  const tour = options.tour ?? TOUR;
  const pace = new FakeClock(options.speed ?? 1);
  const wall = new FakeClock(1);
  const ticker = new FakeClock(1);
  const clocks: RunClocks = { pace, wall, ticker };
  const acted: string[] = [];
  const navigated: string[] = [];
  const screen = new Set(options.screen ?? []);
  const takes = new Map<string, number>();
  const snapshots: Snapshot[] = [];
  const stamps: number[] = [];
  const store = memoryStore(options.state ?? null);
  const saved: RunState[] = [];
  const realSave = store.save.bind(store);
  store.save = (s) => {
    saved.push(structuredClone(s));
    realSave(s);
  };
  const events: FilmEvent[] = [];

  const holds = (ready: Ready): boolean => {
    if (ready.kind === "all") return ready.of.every(holds);
    if (ready.kind === "any") return ready.of.some(holds);
    if (ready.kind === "url") return true;
    const css = anchorCss(ready);
    return css !== null && screen.has(css);
  };

  const executor = (env: { onPhase: (a: Action, p: ActionPhase, input?: "trusted" | "synthetic") => void }): Executor => ({
    isDone: (action, o = {}) => (action.effect === "write" && !!o.key && !!o.journal?.has(o.key)) || (!!action.done && holds(action.done)),
    async runAction(action, o = {}) {
      if (o.instant && isCosmetic(action)) {
        env.onPhase(action, "skipped");
        return "skipped";
      }
      if (this.isDone(action, o)) {
        if (action.effect === "write" && o.key) o.journal?.add(o.key);
        acted.push(`${action.id}~`);
        env.onPhase(action, "skipped");
        return "skipped";
      }
      env.onPhase(action, "start");
      const ms = takes.get(action.id) ?? 0;
      if (ms > 0 && !o.instant) await pace.sleep(ms, o.signal);
      acted.push(`${action.id}${o.instant ? "!" : ""}`);
      const css = anchorCss(action.done);
      if (css) screen.add(css);
      if (action.effect === "write" && o.key) o.journal?.add(o.key);
      env.onPhase(action, "done", "trusted");
      return "done";
    },
    clear() {},
  });

  const deps: DirectorDeps = {
    tour,
    clocks: () => clocks,
    executor: (env) => executor(env),
    waitFor: async (ready, o) => {
      const started = wall.now();
      while (!holds(ready)) {
        if (wall.now() - started >= o.timeoutMs) throw new Error(`Still waiting: ${JSON.stringify(ready)}`);
        await wall.sleep(100, o.signal);
      }
    },
    navigate: async (path) => {
      navigated.push(path);
    },
    store,
    timeline: (stamp) => createTimeline({ stamp, t: () => wall.now(), wall: () => 1_700_000_000_000 + wall.now(), send: (e) => events.push(e), window: null }),
    publish: (s) => {
      if (s) {
        snapshots.push(s);
        stamps.push(wall.now());
      }
    },
    now: () => 1_700_000_000_000 + wall.now(),
    viewport: () => ({ w: 1280, h: 720, dpr: 1.5 }),
    newRunId: () => "run-1",
    ...(options.doc !== undefined ? { doc: options.doc } : {}),
    ...(options.audio ? { audio: options.audio } : {}),
    ...(options.manifest ? { manifest: options.manifest } : {}),
    ...(options.checkpoint ? { checkpoint: options.checkpoint } : {}),
  };
  const director = new Director(deps);
  const b: Bench = {
    director,
    pace,
    wall,
    acted,
    navigated,
    screen,
    takes,
    snapshots,
    stamps,
    store,
    saved,
    events,
    run: () => director.snapshot,
    async tick(ms) {
      // The three clocks move together: pace registers `ms / speed` of real time per sleep.
      let left = ms;
      while (left > 0) {
        const step = Math.min(25, left);
        await pace.advance(step);
        await wall.advance(step);
        await ticker.advance(step);
        left -= step;
      }
    },
    async until(pred, limitMs = 120_000) {
      let spent = 0;
      while (!pred(director.snapshot)) {
        if (spent >= limitMs) throw new Error(`Never got there: ${JSON.stringify(director.snapshot)}`);
        await b.tick(25);
        spent += 25;
      }
    },
    dispatch: (c) => director.dispatch(c),
  };
  return b;
}

const atStep = (step: number, beat = 0) => (s: Snapshot | null) => s?.stepIndex === step && s.beatIndex === beat && s.status === "playing";
const firstStamp = (b: Bench, pred: (s: Snapshot) => boolean) => {
  const i = b.snapshots.findIndex(pred);
  if (i < 0) throw new Error("never reached");
  return b.stamps[i] as number;
};
const captions = (b: Bench) => b.snapshots.map((s) => s.caption?.text).filter((t, i, all) => t && t !== all[i - 1]);

test("Watch plays every step in order to the end, writing each write once", async () => {
  const b = bench();
  b.director.start({ mode: "watch" });
  await b.until((s) => s?.status === "done");
  assert.deepEqual(b.acted, ["spot", "open", "save", "spot", "publish", "spot"]);
  assert.deepEqual(b.navigated, ["/one", "/two", "/three"]);
  assert.deepEqual([...b.director.journal], [SAVE, PUBLISH]);
  assert.deepEqual(captions(b), ["One.", "After the write.", "Two.", "Three.", "Four."]);
  assert.deepEqual(b.run()?.ended, { reason: "finished" });
  assert.equal(b.store.current, null, "a finished run leaves no state to resume");
});

test("a beat holds for max(narration, actions, ready) + dwell, and a gated sentence waits for its action", async () => {
  const b = bench();
  b.takes.set("open", 5000);
  b.director.start({ mode: "watch" });
  await b.tick(S + 200);
  // "One." is over; "After the write." is held until the save, which waits on the slow open.
  assert.equal(b.run()?.caption, null);
  await b.until((s) => s?.caption?.text === "After the write.");
  assert.ok(b.wall.now() >= 5000, `gated sentence started at ${b.wall.now()}`);
  assert.deepEqual(b.acted, ["spot", "open", "save"]);
  await b.until(atStep(0, 1));
  const held = firstStamp(b, (s) => atStep(0, 1)(s)) - firstStamp(b, (s) => atStep(0, 0)(s));
  // Actions 5000 + the gated sentence S, then the 500 ms dwell.
  assert.ok(held >= 5000 + S + 500 - 50 && held <= 5000 + S + 500 + 200, `held ${held}`);
});

test("narration alone sets the beat's length when the actions are quick", async () => {
  const b = bench();
  b.director.start({ mode: "watch" });
  await b.until(atStep(0, 1));
  const held = firstStamp(b, (s) => atStep(0, 1)(s)) - firstStamp(b, (s) => atStep(0, 0)(s));
  assert.ok(held >= 2 * S + 500 - 50 && held <= 2 * S + 500 + 200, `held ${held}`);
});

test("a pause freezes the tour's timers, and resume picks them up where they were", async () => {
  const b = bench();
  b.takes.set("open", 1000);
  b.director.start({ mode: "watch" });
  await b.tick(800);
  assert.equal(b.run()?.status, "playing");
  assert.equal(b.run()?.caption?.text, "One.");
  b.dispatch({ type: "pause" });
  await b.tick(10_000);
  assert.equal(b.run()?.status, "paused");
  assert.equal(b.run()?.caption?.text, "One.");
  assert.deepEqual(b.acted, ["spot"], "the open in hand was frozen with it");
  b.dispatch({ type: "resume" });
  await b.tick(400);
  assert.deepEqual(b.acted, ["spot", "open", "save"]);
  assert.equal(b.run()?.status, "playing");
});

test("Next finishes the step at once: its writes are made, what is only for show is not", async () => {
  const b = bench();
  b.takes.set("open", 3000);
  b.director.start({ mode: "watch" });
  await b.tick(500);
  assert.deepEqual(b.acted, ["spot"]);
  b.dispatch({ type: "next" });
  await b.until((s) => s?.stepIndex === 1 && s.status === "playing");
  assert.deepEqual(b.acted.slice(0, 3), ["spot", "open!", "save!"]);
  assert.ok(!b.acted.includes("spot!"));
  assert.ok(b.director.journal.includes(SAVE));
  assert.ok(firstStamp(b, (s) => s.stepIndex === 1) < 1500, "well inside the 3 s the open would have taken");
});

test("Back re-shows the previous step and writes nothing", async () => {
  const b = bench();
  b.director.start({ mode: "watch" });
  await b.until((s) => s?.stepIndex === 1 && s.status === "playing");
  const before = b.acted.length;
  const journal = [...b.director.journal];
  b.dispatch({ type: "back" });
  await b.until((s) => s?.stepIndex === 0 && s.beatIndex === 1 && s.status === "playing");
  const again = b.acted.slice(before);
  // The spotlight shows again; the form is not opened (it would never be saved); the save is
  // shown as done, not done again.
  assert.deepEqual(again.slice(0, 2), ["spot", "save~"]);
  assert.ok(!again.includes("open") && !again.includes("save"));
  assert.deepEqual([...b.director.journal], journal);
  assert.equal(b.navigated.at(-1), "/one");
});

test("a deep link fast-forwards the skipped writes silently, then plays from the step", async () => {
  const b = bench();
  b.director.start({ mode: "watch", from: "fx-3" });
  await b.until((s) => s?.stepIndex === 2 && s.status === "playing");
  assert.deepEqual(b.acted.slice(0, 3), ["open!", "save!", "publish!"]);
  assert.ok(!b.acted.includes("spot!"), "nothing only for show ran on the way");
  assert.deepEqual([...b.director.journal], [SAVE, PUBLISH]);
  assert.deepEqual(b.navigated, ["/one", "/two", "/three"]);
  await b.until((s) => s?.status === "done");
  assert.deepEqual(captions(b), ["Four."], "nothing was spoken on the way");
});

test("runs at the tour's speed: ×2 halves every hold", async () => {
  const b = bench({ speed: 2 });
  b.director.start({ mode: "watch", speed: 2 });
  await b.until(atStep(0, 1));
  const held = firstStamp(b, (s) => atStep(0, 1)(s)) - firstStamp(b, (s) => atStep(0, 0)(s));
  const atOne = 2 * S + 500;
  assert.ok(held >= atOne / 2 - 50 && held <= atOne / 2 + 150, `held ${held}`);
});

test("film mode: armed, go, start, beats with their sentences and actions, end; the events are in order", async () => {
  const b = bench();
  b.director.start({ mode: "film" });
  await b.until((s) => s?.status === "armed");
  assert.equal(b.events.at(-1)?.type, "film:armed");
  await b.tick(500);
  assert.equal(b.events.length, 1, "nothing moves before the go");
  b.dispatch({ type: "go" });
  await b.until((s) => s?.status === "done");
  assert.deepEqual(filmOrderProblems(b.events), []);
  const types = b.events.map((e) => e.type);
  assert.equal(types[0], "film:armed");
  assert.equal(types[1], "film:start");
  assert.equal(types.at(-1), "film:end");
  assert.equal(types.filter((t) => t === "beat:start").length, 4);
  assert.equal(types.filter((t) => t === "sentence:start").length, 5);
  assert.equal(types.filter((t) => t === "sentence:end").length, 5);
  const actions = b.events.filter((e) => e.type === "action");
  assert.ok(actions.some((e) => e.type === "action" && e.id === "save" && e.phase === "done" && e.input === "trusted"));
  assert.ok(actions.some((e) => e.type === "action" && e.id === "publish" && e.phase === "done"));
  const seqs = b.events.map((e) => e.seq);
  assert.ok(seqs.every((s, i) => i === 0 || s > (seqs[i - 1] as number)));
  const first = b.events[0] as FilmEvent;
  assert.equal(first.v, 1);
  assert.equal(first.doc, 1);
  const armed = b.events.find((e) => e.type === "film:armed");
  assert.ok(armed && armed.type === "film:armed" && armed.tour === "fx" && /^[0-9a-f]{8}$/.test(armed.fingerprint));
  const card = b.events.find((e) => e.type === "beat:start" && e.beat === "fx-3-a");
  assert.ok(card && card.type === "beat:start" && card.kind === "card" && card.title === "Done");
  const ends = b.events.filter((e) => e.type === "beat:end");
  assert.ok(ends.every((e) => e.type === "beat:end" && e.narrationMs >= S));
});

test("a page load mid-beat resumes from the saved state: no write or sentence twice, same seq, next doc", async () => {
  // Run the film until the navigating publish has been dispatched in step 2.
  const a = bench();
  a.director.start({ mode: "film" });
  await a.until((s) => s?.status === "armed");
  a.dispatch({ type: "go" });
  await a.until((s) => s?.stepIndex === 2 && s.status === "playing");
  // The state the director saved just before the navigating action ran.
  const atNav = a.saved.find((s) => s.stepIndex === 1 && s.at.stage === "nav");
  assert.ok(atNav, "the state was saved with stage nav before the action");
  assert.ok(!atNav.journal.includes(PUBLISH), "the write is not journalled before it lands");
  assert.ok(atNav.rolling);
  const threeEnded = a.events.findIndex((e) => e.type === "sentence:end" && e.beat === "fx-2-a");
  const publishStarted = a.events.findIndex((e) => e.type === "action" && e.id === "publish" && e.phase === "start");
  assert.ok(threeEnded >= 0 && publishStarted > threeEnded, "the navigating action ran after the beat's narration");

  // "The page loads": a new director, the host-held state, the published screen.
  const b = bench({ state: atNav, screen: ["[data-published]"], doc: atNav.doc + 1 });
  // The log the host held when the page unloaded: everything up to the state's sequence number.
  b.events.push(...a.events.filter((e) => e.seq <= atNav.seq));
  b.director.resume(atNav);
  await b.until((s) => s?.status === "done");
  assert.ok(!b.acted.includes("publish") && !b.acted.includes("publish!"), `publish ran again: ${b.acted}`);
  assert.ok(b.director.journal.includes(PUBLISH), "the dispatched write was journalled once its done held");
  assert.deepEqual(filmOrderProblems(b.events), []);
  const texts = b.events.filter((e) => e.type === "sentence:start").map((e) => (e as { text: string }).text);
  assert.deepEqual(texts, ["One.", "After the write.", "Two.", "Three.", "Four."]);
  assert.equal(b.events.filter((e) => e.type === "film:armed").length, 1);
  assert.equal(b.events.filter((e) => e.type === "film:start").length, 1);
  const docs = new Set(b.events.map((e) => e.doc));
  assert.deepEqual([...docs], [1, 2]);
  assert.ok(b.events.some((e) => e.type === "action" && e.id === "publish" && e.phase === "done" && e.doc === 2));
});

test("a sentence cut by a load counts as spoken: it is ended, not repeated", async () => {
  const a = bench();
  a.director.start({ mode: "film" });
  await a.until((s) => s?.status === "armed");
  a.dispatch({ type: "go" });
  await a.until((s) => s?.caption?.text === "One.");
  const mid = a.saved.findLast((s) => s.at.speaking === 0 && s.stepIndex === 0);
  assert.ok(mid, "the state carries the sentence being spoken");
  const b = bench({ state: mid, doc: 2 });
  b.events.push(...a.events);
  b.director.resume(mid);
  await b.until((s) => s?.status === "done");
  assert.deepEqual(filmOrderProblems(b.events), []);
  const starts = b.events.filter((e) => e.type === "sentence:start").map((e) => (e as { text: string }).text);
  assert.deepEqual(starts, ["One.", "After the write.", "Two.", "Three.", "Four."]);
  const firstEnd = b.events.find((e) => e.type === "sentence:end");
  assert.equal(firstEnd?.doc, 2, "the cut sentence was ended in the new document");
});

test("a blocked action in film mode raises film:error naming the beat", async () => {
  const b = bench();
  b.takes.set("open", 0);
  const deps = (b.director as unknown as { deps: DirectorDeps }).deps;
  const real = deps.executor;
  deps.executor = (env) => {
    const ex = real(env);
    return {
      ...ex,
      async runAction(action, o) {
        if (action.id === "save") throw new Error("Couldn't find button \"Save\" within 10 s");
        return ex.runAction(action, o);
      },
    };
  };
  b.director.start({ mode: "film" });
  await b.until((s) => s?.status === "armed");
  b.dispatch({ type: "go" });
  await b.until((s) => s?.status === "done");
  const err = b.events.at(-1);
  assert.ok(err && err.type === "film:error" && err.beat === "fx-1-a" && /Save/.test(err.message));
  assert.deepEqual(b.run()?.ended, { reason: "error" });
  assert.deepEqual(filmOrderProblems(b.events), []);
});

/** A voice that records what it was asked to play: no element, no network. */
function fakeAudio(muted = false): AudioPort & { played: string[] } {
  let m = muted;
  const played: string[] = [];
  return {
    played,
    get muted() {
      return m;
    },
    setMuted(v) {
      m = v;
    },
    async play(cue: Cue) {
      if (cue.audio) played.push(cue.audio.hash);
    },
    preload() {},
    pause() {},
    resume() {},
    stop() {},
  };
}

const MANIFEST: VoiceManifest = {
  v: 1,
  id: "fx-voice",
  tour: "fx",
  clips: [
    { beat: "fx-1-a", text: "One.", hash: "h-one", file: "one.mp3", durationMs: 2400 },
    { beat: "fx-2-a", text: "Three.", hash: "h-three", file: "three.mp3", durationMs: 1900 },
  ],
};

test("muting never changes timing: the same sentences start at the same times, and the clips still play", async () => {
  const timings = async (muted: boolean) => {
    const audio = fakeAudio(muted);
    const b = bench({ audio, manifest: MANIFEST });
    b.director.start({ mode: "watch" });
    await b.until((s) => s?.status === "done");
    const starts = b.snapshots.map((s, i) => [s.caption?.text ?? null, b.stamps[i]] as const).filter(([t], i, all) => t && t !== all[i - 1]?.[0]);
    return { starts, played: audio.played, muted: b.run()?.muted };
  };
  const loud = await timings(false);
  const quiet = await timings(true);
  assert.deepEqual(quiet.starts, loud.starts);
  assert.deepEqual(loud.played, ["h-one", "h-three"]);
  assert.deepEqual(quiet.played, loud.played, "a muted tour still plays its clips, silently");
  assert.equal(quiet.muted, true);
  // A clip's duration, not the reading estimate, sets its sentence's length.
  const one = loud.starts.findIndex(([t]) => t === "One.");
  const held = (loud.starts[one + 1]?.[1] ?? 0) - (loud.starts[one]?.[1] ?? 0);
  assert.ok(Math.abs(held - 2400) <= 50, `"One." held ${held} ms for its 2400 ms clip`);
});

test("a mute command toggles the voice and shows in the snapshot", async () => {
  const audio = fakeAudio();
  const b = bench({ audio, manifest: MANIFEST });
  b.director.start({ mode: "watch" });
  await b.until((s) => s?.caption?.text === "One.");
  b.dispatch({ type: "mute" });
  assert.equal(audio.muted, true);
  assert.equal(b.run()?.muted, true);
  b.dispatch({ type: "mute" });
  assert.equal(b.run()?.muted, false);
});

test("rehearse checkpoints: one per beat, after its ready, and before a navigating action leaves the page", async () => {
  const seen: { beat: string; acted: string[] }[] = [];
  let b: Bench | null = null;
  b = bench({
    checkpoint: async ({ beat }) => {
      seen.push({ beat: beat.id, acted: [...(b as Bench).acted] });
    },
  });
  b.director.start({ mode: "watch" });
  await b.until((s) => s?.status === "done");
  assert.deepEqual(
    seen.map((x) => x.beat),
    ["fx-1-a", "fx-1-b", "fx-2-a", "fx-3-a"],
  );
  const nav = seen.find((x) => x.beat === "fx-2-a");
  assert.ok(nav && !nav.acted.includes("publish"), `the navigating beat's still comes before its page load: ${JSON.stringify(nav)}`);
  assert.ok(seen.find((x) => x.beat === "fx-1-a")?.acted.includes("save"), "an ordinary beat's still comes after its actions");
});

test("a resume that entered the step afresh still runs the beat's navigating action", async () => {
  // The step's own page load (entering /two) resumes at stage "begin": nothing was dispatched yet.
  const b = bench({
    doc: 2,
    state: {
      v: 1, runId: "run-1", tourId: "fx", mode: "watch", speed: 1, stepIndex: 1, beatIndex: 0,
      at: { action: 0, sentence: 0, speaking: null, stage: "begin" }, entered: false, target: null,
      journal: [SAVE], seq: 0, doc: 1, rolling: false, filmBeats: 0, paused: false, pointer: null, startedAt: 1_700_000_000_000,
    },
  });
  b.director.resume(b.store.current as RunState);
  await b.until((s) => s?.status === "done");
  assert.ok(b.acted.includes("publish"), `publish ran: ${JSON.stringify(b.acted)}`);
  assert.deepEqual([...b.director.journal], [SAVE, PUBLISH]);
});
