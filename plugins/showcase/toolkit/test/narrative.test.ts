import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { budgetFor, KIND_FACTOR, presetFor, PRESETS, readingMs, spokenNumbers } from "../runtime/src/narrative.ts";
import { captionFits, type TourMeta, wrapCaption } from "../runtime/src/schema.ts";

const meta = (kind: TourMeta["kind"], targetSec: number, extra: Partial<TourMeta["length"]> = {}): TourMeta => ({
  kind, audience: "team", afterwards: "try", language: "en-GB", length: { targetSec, ...extra },
});

describe("readingMs", () => {
  it("is 165 wpm plus 350 ms, never under 1.6 s, rounded", () => {
    assert.equal(readingMs("The story isn't."), 1600);
    assert.equal(readingMs("One screen, the whole business."), 2168);
    assert.equal(readingMs(" a  b\tc d e f g h i j "), Math.round((10 * 60000) / 165 + 350));
  });
});

describe("captions", () => {
  it("wrap greedily at 42 and fit two lines", () => {
    assert.deepEqual(wrapCaption("Before anyone leaves, the decisions and actions exist, with owners and dates."), [
      "Before anyone leaves, the decisions and",
      "actions exist, with owners and dates.",
    ]);
    assert.ok(captionFits("Short."));
    assert.ok(!captionFits("x".repeat(43)));
    assert.ok(!captionFits(Array.from({ length: 30 }, () => "word").join(" ")));
  });
});

describe("length presets and kind factors", () => {
  it("match PLAN §2.8", () => {
    assert.deepEqual(PRESETS.map((p) => [p.targetSec, p.narration.min, p.narration.max, p.beats.min, p.beats.max]), [
      [60, 48, 54, 5, 6],
      [90, 72, 81, 6, 8],
      [120, 96, 108, 8, 10],
      [180, 144, 162, 11, 13],
      [300, 240, 270, 18, 22],
    ]);
    assert.deepEqual(KIND_FACTOR, { pitch: 1, spotlight: 1, walkthrough: 0.94, howto: 0.85 });
  });

  it("scale narration by kind, and honour overrides", () => {
    assert.deepEqual(budgetFor(meta("howto", 120)).narration, { min: 96 * 0.85, max: 108 * 0.85 });
    assert.deepEqual(budgetFor(meta("pitch", 120, { narration: { min: 10, max: 20 } })).narration, { min: 10, max: 20 });
    assert.equal(budgetFor(meta("pitch", 120, { narration: { min: 10, max: 20 } })).source, "override");
  });

  it("derive a target between presets: narration 80–90 %, beats interpolated", () => {
    const p = presetFor(150);
    assert.deepEqual(p.narration, { min: 120, max: 135 });
    assert.deepEqual(p.beats, { min: 10, max: 12 });
    assert.equal(budgetFor(meta("spotlight", 150)).source, "derived");
  });
});

describe("spoken numbers", () => {
  it("finds digits and spelt-out quantities, not plain counts", () => {
    assert.deepEqual(spokenNumbers("Every Monday the exec team asks four questions."), []);
    assert.deepEqual(spokenNumbers("Three ways to run the business, one click apart."), []);
    assert.deepEqual(spokenNumbers("Revenue is up 12% to £1.2m in W39."), ["12%", "£1.2m", "39"]);
    assert.deepEqual(spokenNumbers("Two million players, forty per cent of them new."), ["Two million", "forty per cent"]);
  });
});
