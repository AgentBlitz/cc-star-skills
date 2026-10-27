/**
 * Branded cards in real Chromium on the fixture app (showcase 1.1): with `film.cards: true` the
 * card is 1.0's (its gradient, its colours, a title and lines, no mark); with a brand it takes the
 * brand's colours, its inlined face on the kicker and its sanitised mark above the title, and
 * nothing is fetched. Each card is saved to `test/.out/cards/` for a person to look at.
 */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { type FixtureServer, serveFixture } from "../../fixtures/serve.ts";
import { type Host, type HostOptions, launchHost } from "../../host/launch.ts";
import { resolveCards } from "../../lib/cards.ts";
import type { Tour } from "../../runtime/src/schema.ts";

const TOOLKIT = resolve(import.meta.dirname, "..", "..");
const ASSETS = join(TOOLKIT, "fixtures", "assets");
const OUT = join(TOOLKIT, "test", ".out", "cards");

const tour: Tour = {
  showcase: 1,
  id: "cards",
  title: "cards",
  meta: { kind: "walkthrough", audience: "team", afterwards: "try", language: "en-GB", length: { targetSec: 60 } },
  anchors: {},
  steps: [
    {
      id: "open",
      path: "/index.html",
      beats: [
        {
          id: "title",
          card: { title: "Ledgerly", kicker: "Revenue reports", lines: ["Every report in one place", "Shared with the right people"] },
          narration: ["Ledgerly keeps every report in one place, shared with the right people."],
          actions: [{ id: "wait", kind: "hold", ms: 60_000 }],
        },
      ],
    },
  ],
};

let server: FixtureServer;
const hosts: Host[] = [];
before(async () => {
  server = await serveFixture();
  mkdirSync(OUT, { recursive: true });
});
after(async () => {
  for (const h of hosts) await h.close().catch(() => {});
  server.server.closeAllConnections();
  await server.close();
});

interface Drawn {
  children: string[];
  background: string;
  backgroundImage: string;
  title: { color: string; family: string };
  kicker: { color: string; family: string; transform: string } | null;
  line: { color: string };
  mark: { color: string; tags: string[]; stroke: string; markup: string } | null;
  faceLoaded: boolean;
}

/** Opens the tour, waits for its card and reads what the overlay drew; saves the card as `<name>.png`. */
async function drawCard(name: string, options: Partial<HostOptions>): Promise<{ drawn: Drawn; requests: string[] }> {
  const host = await launchHost({ url: `${server.url}/index.html`, assetsDir: ASSETS, tour, mode: "watch", speed: 1, headless: true, ...options });
  hosts.push(host);
  const requests: string[] = [];
  host.page.on("request", (r) => void requests.push(r.url()));
  await host.page.waitForFunction("(() => { const c = document.querySelector('showcase-overlay')?.shadowRoot?.querySelector('.card'); return c && !c.hidden && c.querySelector('h1'); })()", null, { timeout: 30_000 });
  await host.page.evaluate("document.fonts.ready");
  await host.page.evaluate("for (const c of document.querySelectorAll('showcase-controls')) c.style.visibility = 'hidden'");
  const drawn = (await host.page.evaluate(`(async () => {
    const root = document.querySelector('showcase-overlay').shadowRoot;
    const card = root.querySelector('.card');
    const cs = (el) => getComputedStyle(el);
    const h1 = card.querySelector('h1');
    const kicker = card.querySelector('.kicker');
    const li = card.querySelector('li');
    const mark = card.querySelector('.mark');
    const svg = mark && mark.querySelector('svg');
    const stroked = svg && svg.querySelector('path');
    return {
      children: [...card.children].map((c) => c.tagName.toLowerCase() + (c.className ? '.' + c.className : '')),
      background: cs(card).backgroundColor,
      backgroundImage: cs(card).backgroundImage,
      title: { color: cs(h1).color, family: cs(h1).fontFamily },
      kicker: kicker ? { color: cs(kicker).color, family: cs(kicker).fontFamily, transform: cs(kicker).textTransform } : null,
      line: { color: cs(li).color },
      mark: svg ? { color: cs(mark).color, tags: [...svg.querySelectorAll('*')].map((e) => e.tagName), stroke: stroked ? cs(stroked).stroke : '', markup: svg.outerHTML } : null,
      faceLoaded: document.fonts.check('16px "Showcase Card Kicker"') && [...document.fonts].some((f) => f.family.includes('Showcase Card Kicker') && f.status === 'loaded'),
    };
  })()`)) as Drawn;
  await host.page.screenshot({ path: join(OUT, `${name}.png`) });
  return { drawn, requests };
}

test("cards: true draws 1.0's card, a kicker under the title and no mark", async () => {
  const { drawn } = await drawCard("default", {});
  assert.deepEqual(drawn.children, ["h1", "p.kicker", "ul"]);
  assert.match(drawn.backgroundImage, /radial-gradient\(.*rgb\(30, 58, 138\).*rgb\(15, 23, 42\).*rgb\(2, 6, 23\)/);
  assert.equal(drawn.title.color, "rgb(248, 250, 252)");
  assert.match(drawn.title.family, /^"Showcase UI"/);
  assert.equal(drawn.line.color, "rgb(203, 213, 225)");
  assert.equal(drawn.mark, null);
  assert.equal(drawn.kicker?.transform, "uppercase");
});

test("a brand draws its colours, its inlined face and its sanitised mark above the title, fetching nothing", async () => {
  const cards = resolveCards(
    {
      background: "#F6F7F9",
      foreground: "#1C2333",
      muted: "#5B6472",
      accent: "#4A5D7A",
      mark: "fixtures/brand/hostile.svg",
      fonts: { kicker: { family: "IBM Plex Mono", file: "fixtures/brand/IBMPlexMono-Medium.woff2" } },
    },
    TOOLKIT,
  );
  const hostile = await drawCard("brand-hostile-mark", { cards });
  assert.deepEqual(hostile.drawn.mark?.tags, ["g", "path", "polyline", "line"]);
  assert.doesNotMatch(hostile.drawn.mark?.markup ?? "", /script|href|onload|onclick|style=|url\(|foreignObject|<use|<image/i);
  hostile.requests.length = 0;

  const brand = resolveCards(
    {
      background: "#F6F7F9",
      foreground: "#1C2333",
      muted: "#5B6472",
      accent: "#4A5D7A",
      mark: "fixtures/brand/mark.svg",
      fonts: { kicker: { family: "IBM Plex Mono", file: "fixtures/brand/IBMPlexMono-Medium.woff2" } },
    },
    TOOLKIT,
  );
  const { drawn, requests } = await drawCard("brand", { cards: brand });
  assert.deepEqual(drawn.children, ["div.mark", "h1", "p.kicker", "ul"], "the mark, the title, the kicker, the lines");
  assert.equal(drawn.background, "rgb(246, 247, 249)");
  assert.equal(drawn.backgroundImage, "none");
  assert.equal(drawn.title.color, "rgb(28, 35, 51)");
  assert.equal(drawn.line.color, "rgb(91, 100, 114)");
  assert.equal(drawn.kicker?.color, "rgb(91, 100, 114)");
  assert.match(drawn.kicker?.family ?? "", /^"Showcase Card Kicker"/);
  assert.equal(drawn.faceLoaded, true, "the kicker's face loaded from its data URI");
  assert.equal(drawn.mark?.color, "rgb(74, 93, 122)");
  assert.equal(drawn.mark?.stroke, "rgb(74, 93, 122)", "the mark is drawn in the accent");
  assert.deepEqual(drawn.mark?.tags, ["circle", "path"]);
  assert.deepEqual(requests.filter((u) => !u.startsWith(server.url) && !u.startsWith("data:")), [], "nothing fetched beyond the app");
});
