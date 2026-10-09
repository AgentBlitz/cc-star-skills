import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";
import { configProblems, withDefaults } from "../lib/config.ts";
import { narrativeIssues, tourNarrationMs, tourWords } from "../runtime/src/narrative.ts";
import { beatsOf, SchemaValidator, type Tour, validateTour } from "../runtime/src/schema.ts";

const ROOT = resolve(import.meta.dirname, "..", "..");
const read = (p: string): unknown => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const allIssues = (raw: unknown) => {
  const { tour, issues } = validateTour(raw);
  return [...issues, ...(tour ? narrativeIssues(tour) : [])];
};

describe("the Compass golden", () => {
  const raw = read("toolkit/test/golden/compass-pitch.json");

  it("passes the schema and every rule", () => {
    assert.deepEqual(allIssues(raw), []);
  });

  it("measures 100.8 s of readingMs narration over 248 words and nine beats, as gods-eye's pitch.test.ts", () => {
    const tour = raw as Tour;
    assert.equal(Math.round(tourNarrationMs(tour) / 100) / 10, 100.8);
    assert.equal(tourWords(tour), 248);
    assert.deepEqual(beatsOf(tour).map(({ beat }) => beat.id), ["open", "where", "why", "asks", "promises", "minutes", "month", "three", "close"]);
  });

  it("keeps Compass's rules: no digits spoken, asks first to cut, cards only at either end", () => {
    const tour = raw as Tour;
    assert.equal(tour.meta.rules?.spokenNumbers, "none");
    assert.equal(tour.meta.rules?.firstToCut, "asks");
    assert.deepEqual(beatsOf(tour).filter(({ beat }) => beat.card).map(({ beat }) => beat.id), ["open", "close"]);
  });
});

describe("the templates", () => {
  for (const kind of ["pitch", "walkthrough", "spotlight", "howto"]) {
    it(`tour.${kind}.json is clean and is a ${kind}`, () => {
      const raw = read(`skills/showcase/templates/tour.${kind}.json`) as Tour;
      assert.deepEqual(allIssues(raw), []);
      assert.equal(raw.meta.kind, kind);
      assert.equal(raw.$schema, "../.schema/tour.schema.json");
      assert.ok(beatsOf(raw).at(-1)?.beat.card, "every spine closes on a card");
    });
  }

  it("config.json is a valid config", () => {
    assert.deepEqual(configProblems(read("skills/showcase/templates/config.json")), []);
  });
});

describe("negative fixtures", () => {
  const dir = join(ROOT, "toolkit/fixtures/tours/invalid");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();

  it("there are at least 12, covering T001–T014", () => {
    assert.ok(files.length >= 12, `${files.length}`);
    const rules = new Set(files.map((f) => f.slice(0, 4)));
    for (let n = 1; n <= 14; n++) assert.ok(rules.has(`T${String(n).padStart(3, "0")}`), `T${n}`);
  });

  it("their shared base is clean", () => {
    assert.deepEqual(allIssues(read("toolkit/fixtures/tours/valid-base.json")), []);
  });

  for (const f of files) {
    it(`${f} fails with ${f.slice(0, 4)} and nothing else`, () => {
      const got = allIssues(JSON.parse(readFileSync(join(dir, f), "utf8")));
      assert.ok(got.length > 0);
      assert.deepEqual([...new Set(got.map((i) => i.rule))], [f.slice(0, 4)], JSON.stringify(got));
    });
  }
});

describe("the schema interpreter", () => {
  it("refuses a schema keyword it doesn't know", () => {
    assert.throws(() => new SchemaValidator({ type: "object", unevaluatedProperties: false }), /unevaluatedProperties/);
  });

  it("reports only the matching branch of a discriminated union", () => {
    const { issues } = validateTour({ ...(read("toolkit/fixtures/tours/valid-base.json") as object), steps: [{ id: "s", beats: [{ id: "b", actions: [{ id: "a", kind: "click" }] }] }] });
    assert.deepEqual(issues.map((i) => `${i.path} ${i.message}`), ["/steps/0/beats/0/actions/0 needs 'target'"]);
  });

  it("checks anchors: at least one locator, name only with role", () => {
    const base = read("toolkit/fixtures/tours/valid-base.json") as Tour;
    const bad = { ...base, anchors: { empty: {}, named: { name: "Search" } } };
    const msgs = validateTour(bad).issues.map((i) => `${i.path} ${i.message}`);
    assert.ok(msgs.some((m) => m.startsWith("/anchors/empty must not be empty")), msgs.join("\n"));
    assert.ok(msgs.some((m) => m === "/anchors/named 'name' needs 'role'"), msgs.join("\n"));
  });
});

describe("config validation", () => {
  it("names each problem by pointer", () => {
    const problems = configProblems({ showcase: 1, app: { url: "x" }, browser: { scale: 3, colour: "dark" } });
    assert.deepEqual(problems, ["/browser/scale: must be ≤ 2", "/browser/colour: unknown property 'colour'"]);
    assert.deepEqual(configProblems({ showcase: 1 }), ["/: needs 'app'"]);
  });

  it("fills defaults without sharing arrays", () => {
    const a = withDefaults({ showcase: 1, app: { url: "http://127.0.0.1:{port}" }, browser: { colorScheme: "dark" } });
    const b = withDefaults({ showcase: 1, app: { url: "u" } });
    assert.equal(a.browser.scale, 1.5);
    assert.equal(a.browser.colorScheme, "dark");
    assert.equal(a.voice.draft.provider, "say");
    a.privacy.deny.push("secret");
    assert.deepEqual(b.privacy.deny, []);
  });
});

describe("browser safety (C4)", () => {
  it("schema.ts and narrative.ts import nothing from Node", () => {
    for (const f of ["schema.ts", "narrative.ts"]) {
      const src = readFileSync(join(ROOT, "toolkit/runtime/src", f), "utf8");
      const imports = [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1] as string);
      for (const i of imports) assert.ok(i.startsWith("./") || i.startsWith("../../schema/"), `${f} imports ${i}`);
    }
  });
});
