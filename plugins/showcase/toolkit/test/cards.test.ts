/**
 * Branded cards (showcase 1.1) without a browser: the mark read and sanitised (a script, an href,
 * a reference and every event handler dropped), the fonts inlined as data URIs, the brand's CSS,
 * `true` left exactly as 1.0 drew it (a snapshot of 1.0's stylesheets), and both card shapes, the
 * card's `kicker` and a 1.0 config validated by the schemas.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";
import { CardsError, loadMark, parseSvg, resolveCards } from "../lib/cards.ts";
import { configProblems, withDefaults } from "../lib/config.ts";
import { BRAND_FAMILY, brandCss, brandFontCss, sanitiseMark } from "../runtime/src/overlay/brand.ts";
import { FONT, FONT_CSS, OVERLAY_CSS } from "../runtime/src/overlay/styles.ts";
import { validateTour } from "../runtime/src/schema.ts";

const TOOLKIT = resolve(import.meta.dirname, "..");
const BRAND = "fixtures/brand";
const brandConfig = {
  background: "#F6F7F9",
  foreground: "#1C2333",
  muted: "#5B6472",
  accent: "#4A5D7A",
  mark: `${BRAND}/mark.svg`,
  fonts: { kicker: { family: "IBM Plex Mono", file: `${BRAND}/IBMPlexMono-Medium.woff2` } },
};

describe("the mark", () => {
  it("keeps only svg, g, path, circle, line and polyline, with presentation attributes", () => {
    const mark = loadMark(TOOLKIT, `${BRAND}/hostile.svg`);
    assert.deepEqual(mark, {
      tag: "svg",
      attrs: { viewBox: "0 0 24 24" },
      children: [
        {
          tag: "g",
          attrs: { transform: "translate(1 1)" },
          children: [
            { tag: "path", attrs: { d: "M4 4h16", stroke: "currentColor" }, children: [] },
            { tag: "polyline", attrs: { points: "2 2 4 4" }, children: [] },
          ],
        },
        { tag: "line", attrs: { x1: "1", y1: "1", x2: "23", y2: "23", stroke: "none" }, children: [] },
      ],
    });
    const text = JSON.stringify(mark);
    for (const gone of ["script", "alert", "href", "onload", "onclick", "style", "url(", "javascript", "foreignObject", "use", "image", "tracker.example", "phish"]) assert.equal(text.includes(gone), false, gone);
  });

  it("takes the accent: a paint other than none becomes currentColor", () => {
    const mark = loadMark(TOOLKIT, `${BRAND}/mark.svg`);
    assert.equal(mark.attrs.stroke, "currentColor");
    assert.equal(mark.attrs.fill, "none");
    assert.deepEqual(mark.children.map((c) => c.tag), ["circle", "path"]);
  });

  it("refuses a root that isn't <svg>, and markup it can't read", () => {
    assert.equal(sanitiseMark({ tag: "script", attrs: {}, children: [] }), null);
    assert.equal(sanitiseMark(parseSvg(`<g><path d="M0 0"/></g>`)), null);
    assert.throws(() => parseSvg(`<svg><![CDATA[x]]></svg>`), CardsError);
    assert.throws(() => parseSvg(`<!DOCTYPE svg [<!ENTITY x "y">]><svg/>`), CardsError);
    assert.throws(() => parseSvg(`<svg><path d=M0></svg>`), CardsError);
    assert.throws(() => parseSvg(`<svg><g></svg>`), CardsError);
  });

  it("stays inside the repo and names a missing file", () => {
    assert.throws(() => loadMark(TOOLKIT, "../../../etc/hosts.svg"), /outside the repo/);
    assert.throws(() => loadMark(TOOLKIT, `${BRAND}/absent.svg`), /absent\.svg doesn't exist/);
  });
});

describe("resolveCards", () => {
  it("is null for true and false: showcase's own look", () => {
    assert.equal(resolveCards(true, TOOLKIT), null);
    assert.equal(resolveCards(false, TOOLKIT), null);
  });

  it("inlines the fonts as woff2 data URIs and the mark as a sanitised tree", () => {
    const brand = resolveCards(brandConfig, TOOLKIT);
    assert.ok(brand);
    const font = readFileSync(join(TOOLKIT, BRAND, "IBMPlexMono-Medium.woff2"));
    assert.equal(brand.fonts?.kicker?.src, `data:font/woff2;base64,${font.toString("base64")}`);
    assert.equal(brand.fonts?.kicker?.family, "IBM Plex Mono");
    assert.equal(brand.fonts?.title, undefined);
    assert.equal(brand.mark?.tag, "svg");
    assert.throws(() => resolveCards({ ...brandConfig, fonts: { title: { family: "Not a font", file: `${BRAND}/mark.svg` } } }, TOOLKIT), /isn't a woff2 font/);
  });

  it("writes CSS that applies the brand and declares only valid faces", () => {
    const brand = resolveCards(brandConfig, TOOLKIT);
    assert.ok(brand);
    const css = brandCss(brand, FONT) ?? "";
    assert.match(css, /\.card, \.end \{ background: #F6F7F9; color: #1C2333; \}/);
    assert.match(css, /\.mark \{ color: #4A5D7A; \}/);
    assert.ok(css.includes(`.card .kicker, .end .kicker { font-family: "${BRAND_FAMILY.kicker}", ${FONT};`));
    assert.ok(css.includes(`.card h1, .end h1 { font-family: ${FONT};`), "no title face: the overlay's own");
    const faces = brandFontCss(brand);
    assert.equal(faces.match(/@font-face/g)?.length, 1);
    assert.ok(faces.startsWith(`@font-face { font-family: "${BRAND_FAMILY.kicker}"; src: url("data:font/woff2;base64,`));
    assert.equal(brandCss({ ...brand, background: "red; } body { display: none" }, FONT), null, "a colour that isn't #rrggbb is refused");
    assert.equal(brandFontCss({ ...brand, fonts: { title: { family: "x", src: "https://fonts.example/x.woff2" } } }), "", "nothing is fetched");
  });
});

describe("true keeps 1.0's look exactly", () => {
  it("the overlay's card styles are 1.0's, byte for byte (snapshot)", () => {
    const golden = readFileSync(join(TOOLKIT, "test", "golden", "cards-1.0.css"), "utf8");
    assert.equal(`${FONT_CSS}\n/* ---- OVERLAY_CSS ---- */\n${OVERLAY_CSS}`, golden);
  });
});

describe("the schemas", () => {
  const config = JSON.parse(readFileSync(join(TOOLKIT, "fixtures", "showcase", "config.json"), "utf8")) as Record<string, unknown>;
  const withFilm = (cards: unknown) => ({ ...config, film: { cards } });

  it("accept a 1.0 config unchanged, with cards defaulting to true and the narrator to OpenRouter", () => {
    assert.deepEqual(configProblems(config), []);
    assert.equal(withDefaults(config).film.cards, true);
    assert.deepEqual(configProblems({ ...config, voice: { narrator: { model: "elevenlabs/eleven-v3", voice: "george" } } }), []);
  });

  it("accept both card shapes, and refuse a bad brand", () => {
    assert.deepEqual(configProblems(withFilm(true)), []);
    assert.deepEqual(configProblems(withFilm(false)), []);
    assert.deepEqual(configProblems(withFilm(brandConfig)), []);
    assert.notDeepEqual(configProblems(withFilm({ ...brandConfig, background: "white" })), []);
    assert.notDeepEqual(configProblems(withFilm({ ...brandConfig, mark: "/etc/mark.svg" })), []);
    assert.notDeepEqual(configProblems(withFilm({ ...brandConfig, fonts: { title: { family: "Fraunces", file: "f.ttf" } } })), []);
    assert.notDeepEqual(configProblems(withFilm({ ...brandConfig, extra: 1 })), []);
    const { accent: _, ...noAccent } = brandConfig;
    assert.notDeepEqual(configProblems(withFilm(noAccent)), []);
  });

  it("accept a Requesty narrator and an audition list with instructions variants", () => {
    const voice = {
      narrator: { provider: "requesty", model: "openai/gpt-4o-mini-tts", voice: "fable", instructions: "Warm." },
      audition: [
        { id: "fable-warm", provider: "requesty", model: "openai/gpt-4o-mini-tts", voice: "fable", instructions: "Warm." },
        { id: "fable-brisk", provider: "requesty", model: "openai/gpt-4o-mini-tts", voice: "fable", instructions: "Brisk." },
      ],
    };
    assert.deepEqual(configProblems({ ...config, voice }), []);
    assert.notDeepEqual(configProblems({ ...config, voice: { narrator: { ...voice.narrator, provider: "openai" } } }), []);
    assert.notDeepEqual(configProblems({ ...config, voice: { audition: [{ id: "Bad Id", model: "m", voice: "v" }] } }), []);
  });

  it("accept a card's kicker on a beat and on a card action", () => {
    const tour = JSON.parse(readFileSync(join(TOOLKIT, "fixtures", "showcase", "tours", "fixture-tour.json"), "utf8")) as { steps: { beats: { card?: Record<string, unknown>; actions?: unknown[] }[] }[] };
    const beat = tour.steps[0]?.beats[0] as { card?: Record<string, unknown>; actions?: unknown[] };
    beat.card = { ...beat.card, kicker: "Action Tracker" };
    beat.actions = [...(beat.actions ?? []), { id: "brand-card", kind: "card", title: "Clarity", kicker: "Action Tracker", lines: ["One list"] }];
    const errors = (t: unknown) => validateTour(t).issues.filter((i) => i.level === "error");
    assert.deepEqual(errors(tour), []);
    beat.card = { ...beat.card, kicker: "" };
    assert.ok(errors(tour).some((i) => i.rule === "T001"));
  });
});
