/**
 * The Next fixture end to end (PLAN §5 Session 10's gate), `npm run test:next`. Kept out of
 * `npm test` because it installs Next into the cache on first use and builds a real app, which
 * would load the machine under the film tests' frame-timing checks.
 *
 * In a work dir in the cache (`fixtures/next-fixture.ts`): vendored for Next twice with no diff;
 * voiced with the draft voice; `next build` passes under `exactOptionalPropertyTypes` and
 * `noUncheckedIndexedAccess`; the deep link plays the tour with in-app navigation on a single
 * document load; and `film --in-app --strict` is green, its SPA routes in one rising sequence.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { after, test } from "node:test";
import { prepareNext } from "../../fixtures/next-fixture.ts";
import type { FilmResult, TimelineFile } from "../../film/record.ts";
import { startApp, type App } from "../../host/app.ts";
import { playwright } from "../../host/launch.ts";
import { loadConfig } from "../../lib/config.ts";
import type { Snapshot } from "../../runtime/src/protocol.ts";
import { cli } from "../helpers.ts";

const dir = prepareNext({ say: (l) => process.stderr.write(`${l}\n`) });
const TOUR = join(dir, "showcase", "tours", "next-tour.json");
const env = () => ({ HOME: process.env.HOME ?? "", SHOWCASE_RUN_MARKER: `next-${process.pid}` });

function tree(root: string, sub: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    for (const name of readdirSync(d).sort()) {
      const f = join(d, name);
      if (statSync(f).isDirectory()) walk(f);
      else out[relative(root, f)] = createHash("sha256").update(readFileSync(f)).digest("hex");
    }
  };
  for (const s of sub) walk(join(root, s));
  return out;
}

let app: App | null = null;
after(async () => {
  await app?.stop();
});

test("vendored for Next twice with no diff, voiced, and `next build` passes under the strict flags", async () => {
  const first = await cli(["runtime", "vendor", "--framework", "next", "--json"], { cwd: dir, env: env() });
  assert.equal(first.code, 0, first.stderr);
  const watched = ["components", "public", "showcase/config.json", "showcase/tours"];
  const before = tree(dir, ["components", "public", "showcase/tours"]);
  const config = readFileSync(join(dir, "showcase", "config.json"));
  const second = await cli(["runtime", "vendor", "--framework", "next", "--json"], { cwd: dir, env: env() });
  assert.equal(second.code, 0, second.stderr);
  assert.equal((JSON.parse(second.stdout) as { changed: boolean }).changed, false, watched.join(", "));
  assert.deepEqual(tree(dir, ["components", "public", "showcase/tours"]), before);
  assert.deepEqual(readFileSync(join(dir, "showcase", "config.json")), config);
  assert.equal(loadConfig(join(dir, "showcase")).voice.dir, "public/showcase/voice");

  const v = await cli(["voice", TOUR, "--draft"], { cwd: dir, env: env() });
  assert.equal(v.code, 0, v.stdout + v.stderr);
  const tsconfig = JSON.parse(readFileSync(join(dir, "tsconfig.json"), "utf8")) as { compilerOptions: Record<string, unknown> };
  assert.equal(tsconfig.compilerOptions.exactOptionalPropertyTypes, true);
  assert.equal(tsconfig.compilerOptions.noUncheckedIndexedAccess, true);
  const out = execFileSync(join(dir, "node_modules", ".bin", "next"), ["build"], { cwd: dir, encoding: "utf8", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" }, timeout: 300_000 });
  assert.match(out, /Finished TypeScript/);
});

test("the deep link plays the tour with in-app navigation on a single document load", async () => {
  const cfg = loadConfig(join(dir, "showcase"));
  app = await startApp(cfg.app, { root: dir, logFile: join(dir, "showcase", "app.log") });
  const pw = await playwright();
  const browser = await pw.chromium.launch({ channel: "chromium", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const missing: string[] = [];
    page.on("response", (r) => {
      if (r.status() >= 400 && !r.url().endsWith("/favicon.ico")) missing.push(`${r.status()} ${r.url()}`);
    });
    let loads = 0;
    page.on("load", () => (loads += 1));
    await page.goto(`${app.url}/?showcase=next-tour`);
    await page.evaluate("window.__sameDocument = true");
    const t0 = Date.now();
    let s: Snapshot | null = null;
    while (Date.now() - t0 < 90_000) {
      s = (await page.evaluate("window.__showcase ? window.__showcase.snapshot() : null")) as Snapshot | null;
      if (s && (s.status === "done" || s.status === "blocked")) break;
      await page.waitForTimeout(100);
    }
    assert.equal(s?.status, "done", JSON.stringify(s?.blocked));
    assert.equal(s?.ended?.reason, "finished");
    assert.deepEqual(s?.journal, ["projects/add/add-it", "settings/digest/digest-on"]);
    assert.deepEqual(s?.notes, []);
    assert.equal(new URL(page.url()).pathname, "/settings", "the router took the tour to its last step");
    assert.equal(await page.evaluate("window.__sameDocument"), true, "one document from start to end");
    assert.equal(loads, 1);
    assert.deepEqual(JSON.parse(String(await page.evaluate("localStorage.getItem('orbit:projects')"))), ["Website refresh", "Quarterly review", "Launch plan"]);
    assert.deepEqual(missing, [], "the tour, the manifest and the clips are all served");
  } finally {
    await browser.close();
    await app.stop();
    app = null;
  }
});

test("film --in-app --strict is green on the Next fixture", async () => {
  const r = await cli(["rehearse", TOUR, "--synthetic"], { cwd: dir, env: env() });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const f = await cli(["film", TOUR, "--in-app", "--strict", "--json"], { cwd: dir, env: env() });
  const result = JSON.parse(f.stdout) as FilmResult & { out: string };
  assert.equal(f.code, 0, `${f.stderr}\n${JSON.stringify(result.report?.checks?.filter((c) => c.level !== "ok"))}\n${result.error ?? ""}`);
  assert.ok(result.ok);
  const t = JSON.parse(readFileSync(join(result.out, "timeline.json"), "utf8")) as TimelineFile;
  assert.deepEqual(t.orderProblems, []);
  assert.deepEqual(
    t.navs.map((n) => `${n.kind} ${new URL(n.url).pathname}`),
    ["spa /projects", "spa /settings"],
    "in-app navigation only: no page load mid-take",
  );
});
