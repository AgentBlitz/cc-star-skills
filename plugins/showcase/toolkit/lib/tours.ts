/**
 * Finding a tour, reading it, and its storyboard (PLAN §2.2, §2.10): `showcase/storyboard/<id>.md`
 * is generated from the tour, deterministically, and carries a hash `check` compares.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import {
  beatPlanMs,
  budgetFor,
  narrationMs,
  spokenNumbers,
  tourNarrationMs,
  tourWords,
  wordCount,
} from "../runtime/src/narrative.ts";
import { type Action, type AnchorRef, beatsOf, type Issue, sentenceText, type Tour, validateTour } from "../runtime/src/schema.ts";
import { repoRoot } from "./paths.ts";

export interface TourFile {
  file: string;
  /** The `showcase/` dir holding `tours/`, or null for a tour elsewhere (a template). */
  showcaseDir: string | null;
}

/** A path to a tour file, or a tour id under the repo's `showcase/tours/`. */
export function resolveTour(arg: string, cwd: string = process.cwd()): TourFile {
  const asPath = resolve(cwd, arg);
  const file =
    arg.endsWith(".json") || existsSync(asPath) ? asPath : join(repoRoot(cwd) ?? cwd, "showcase", "tours", `${arg}.json`);
  const dir = dirname(file);
  return { file, showcaseDir: basename(dir) === "tours" ? dirname(dir) : null };
}

export interface LoadedTour extends TourFile {
  tour: Tour | null;
  issues: Issue[];
}

/** Reads and validates (T001–T007). A file that isn't JSON is a T001. */
export function loadTour(tf: TourFile): LoadedTour {
  if (!existsSync(tf.file)) throw new Error(`no tour at ${tf.file}`);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(tf.file, "utf8"));
  } catch (e) {
    return { ...tf, tour: null, issues: [{ rule: "T001", level: "error", path: "/", message: `not JSON: ${(e as Error).message}` }] };
  }
  return { ...tf, ...validateTour(raw) };
}

// ——— The storyboard ———

export const STORYBOARD_VERSION = 1;
const MARK = /<!-- showcase:storyboard v(\d+) sha256:([0-9a-f]{64}) -->/;

function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.keys(v)
        .filter((k) => k !== "$schema")
        .sort()
        .map((k) => [k, canonical((v as Record<string, unknown>)[k])]),
    );
  return v;
}

/** The tour's content hash: key order, whitespace and `$schema` don't count. */
export function tourHash(tour: Tour): string {
  return createHash("sha256").update(`v${STORYBOARD_VERSION}\n${JSON.stringify(canonical(tour))}`).digest("hex");
}

export function storyboardFile(showcaseDir: string, id: string): string {
  return join(showcaseDir, "storyboard", `${id}.md`);
}

export type StoryboardState = "fresh" | "stale" | "missing" | "n/a";

export function storyboardState(tf: TourFile, tour: Tour): StoryboardState {
  if (!tf.showcaseDir) return "n/a";
  const file = storyboardFile(tf.showcaseDir, tour.id);
  if (!existsSync(file)) return "missing";
  const m = MARK.exec(readFileSync(file, "utf8"));
  return m && Number(m[1]) === STORYBOARD_VERSION && m[2] === tourHash(tour) ? "fresh" : "stale";
}

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
const clock = (ms: number) => {
  const s = Math.round(ms / 100) / 10;
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, "0")}`;
};
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
const range = (r: { min: number; max: number }, unit = "") => `${Number(r.min.toFixed(1))}–${Number(r.max.toFixed(1))}${unit}`;
const within = (v: number, r: { min: number; max: number }) => (v >= r.min - 1e-9 && v <= r.max + 1e-9 ? "✓" : "✗ outside");

function ref(a: AnchorRef | undefined): string {
  if (a === undefined) return "";
  if (typeof a === "string") return ` ${a}`;
  const name = a.role ? `${a.role}${a.name ? ` "${typeof a.name === "string" ? a.name : `/${a.name.pattern}/`}"` : ""}` : a.label ? `label "${typeof a.label === "string" ? a.label : a.label.pattern}"` : a.testId ? `testid ${a.testId}` : a.css ?? "text";
  return ` [${name}]`;
}

function actionSummary(a: Action): string {
  const w = a.effect === "write" ? " ✎" : "";
  const nav = a.navigates ? " ↪" : "";
  switch (a.kind) {
    case "hold":
      return `hold ${a.ms / 1000} s`;
    case "wait":
      return a.ms ? `wait ${a.ms / 1000} s` : `wait ${a.until?.kind ?? ""}`;
    case "goto":
      return `goto ${a.url}${nav}`;
    case "type":
      return `type${ref(a.target)} "${a.text}"${w}${nav}`;
    case "key":
      return `key ${a.key}${w}${nav}`;
    case "camera":
      return a.end ? "camera end" : `camera${ref(a.target)} ×${a.scale ?? 1.5}`;
    case "card":
      return `card "${a.title}"`;
    case "invoke":
      return `invoke ${a.name}${w}${nav}`;
    default:
      return `${a.kind}${"target" in a ? ref(a.target) : ""}${w}${nav}`;
  }
}

/** The storyboard markdown. Same tour, same bytes. */
export function renderStoryboard(tour: Tour): string {
  const m = tour.meta;
  const budget = budgetFor(m);
  const beats = beatsOf(tour);
  const narr = tourNarrationMs(tour) / 1000;
  const words = tourWords(tour);
  const planned = beats.reduce((ms, { beat }) => ms + beatPlanMs(beat), 0);
  const ap = m.approved ?? {};
  const out: string[] = [
    `<!-- Generated by \`showcase storyboard\` from the tour '${tour.id}'. Don't edit: change the tour and regenerate. -->`,
    `<!-- showcase:storyboard v${STORYBOARD_VERSION} sha256:${tourHash(tour)} -->`,
    "",
    `# ${tour.title}`,
    "",
    "| | |",
    "|---|---|",
    `| Tour | \`${tour.id}\` |`,
    `| Kind | ${m.kind} · for ${m.audience} · afterwards: ${m.afterwards} |`,
    ...(m.takeaway ? [`| Takeaway | ${cell(m.takeaway)} |`] : []),
    `| Language | ${m.language} |`,
    `| Target | ${mmss(m.length.targetSec)}: narration ${range(budget.narration, " s")}, ${range(budget.words)} words, ${range(budget.beats)} beats (${budget.source}) |`,
    `| Planned | narration ${narr.toFixed(1)} s · ${words} words · ${beats.length} beats · about ${mmss(planned / 1000)} in all |`,
    `| Spoken numbers | ${m.rules?.spokenNumbers ?? "on-screen-only"} |`,
    `| First to cut | ${m.rules?.firstToCut ? `\`${m.rules.firstToCut}\`` : "—"} |`,
    `| Approved | storyboard ${ap.storyboard ?? "—"} · narrator ${ap.narrator ?? "—"} · final ${ap.final ?? "—"} |`,
    "",
    "## Beats",
    "",
    "Starts are planned from the reading estimate (165 wpm); the voice and the run set the real ones. ✎ a write, ↪ a page load.",
    "",
    "| # | Start | Step · path | Beat | Actions | Narration | Words | Secs |",
    "|---|---|---|---|---|---|---|---|",
  ];
  let t = 0;
  beats.forEach(({ step, beat }, i) => {
    const sentences = (beat.narration ?? []).map((s) => {
      const text = sentenceText(s);
      const nums = spokenNumbers(text);
      return `${typeof s === "string" ? "" : `⟨${s.after}⟩ `}${text}${nums.length ? ` [numbers: ${nums.join(", ")}]` : ""}`;
    });
    const where = `${step.id}${step.path ? ` · \`${step.path}\`` : ""}`;
    const what = beat.card ? `**card** “${beat.card.title}”${beat.card.lines?.length ? ` (${beat.card.lines.length} lines)` : ""}` : "";
    const actions = [what, ...(beat.actions ?? []).map(actionSummary)].filter(Boolean).join("; ");
    const w = (beat.narration ?? []).reduce((n, s) => n + wordCount(sentenceText(s)), 0);
    const cut = beat.id === m.rules?.firstToCut ? " ✂" : "";
    out.push(
      `| ${i + 1} | ${clock(t)} | ${cell(where)} | \`${beat.id}\`${cut} | ${cell(actions)} | ${cell(sentences.join(" "))} | ${w} | ${(narrationMs(beat) / 1000).toFixed(1)}${beat.dwellMs ? ` +${beat.dwellMs / 1000}` : ""} |`,
    );
    t += beatPlanMs(beat);
  });
  out.push(
    "",
    "## Pacing",
    "",
    `- Narration: ${narr.toFixed(1)} s against ${range(budget.narration, " s")} ${within(narr, budget.narration)}`,
    `- Words: ${words} against ${range(budget.words)} ${within(words, budget.words)}`,
    `- Beats: ${beats.length} against ${range(budget.beats)} ${within(beats.length, budget.beats)}`,
    `- Planned length: about ${mmss(planned / 1000)} for a ${mmss(m.length.targetSec)} target`,
    "",
  );
  return out.join("\n");
}

// ——— The storyboard page ———

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The storyboard as a page (`storyboard --html`): each beat's narration and actions beside its
 * still from the last rehearsal. `stills` maps a beat id to an image path relative to the page.
 */
export function renderStoryboardHtml(tour: Tour, stills: Record<string, string>, note = ""): string {
  const m = tour.meta;
  const budget = budgetFor(m);
  const beats = beatsOf(tour);
  const narr = tourNarrationMs(tour) / 1000;
  let t = 0;
  const rows = beats.map(({ step, beat }, i) => {
    const start = clock(t);
    t += beatPlanMs(beat);
    const still = stills[beat.id];
    const sentences = (beat.narration ?? []).map((s) => `<p>${esc(sentenceText(s))}</p>`).join("");
    const actions = [beat.card ? `card “${beat.card.title}”` : "", ...(beat.actions ?? []).map(actionSummary)].filter(Boolean);
    return `<section class="beat">
  <div class="still">${still ? `<a href="${esc(still)}"><img src="${esc(still)}" alt="${esc(beat.id)}" loading="lazy"></a>` : `<div class="none">no still yet: run <code>showcase storyboard ${esc(tour.id)} --stills</code></div>`}</div>
  <div class="text">
    <h2><span>${i + 1}</span> ${esc(beat.id)}${beat.id === m.rules?.firstToCut ? " ✂" : ""} <small>${esc(start)} · ${esc(step.id)}${step.path ? ` · ${esc(step.path)}` : ""}</small></h2>
    ${sentences || "<p class=\"quiet\">(no narration)</p>"}
    ${actions.length ? `<ul>${actions.map((a) => `<li><code>${esc(a)}</code></li>`).join("")}</ul>` : ""}
  </div>
</section>`;
  });
  return `<!doctype html>
<html lang="${esc(m.language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(tour.title)} · storyboard</title>
<style>
  body { margin: 0; font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: #0f172a; background: #f8fafc; }
  header { padding: 28px 32px 8px; }
  header h1 { margin: 0 0 6px; font-size: 26px; }
  header p { margin: 2px 0; color: #475569; }
  main { padding: 8px 32px 40px; display: grid; gap: 18px; }
  .beat { display: grid; grid-template-columns: minmax(320px, 46%) 1fr; gap: 20px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; }
  .still img { width: 100%; border-radius: 8px; border: 1px solid #e2e8f0; display: block; }
  .none { aspect-ratio: 16 / 9; display: grid; place-items: center; background: #f1f5f9; border-radius: 8px; color: #64748b; padding: 12px; text-align: center; }
  h2 { margin: 0 0 8px; font-size: 17px; }
  h2 span { display: inline-block; min-width: 1.6em; color: #2563eb; }
  h2 small { font-weight: 400; color: #64748b; font-size: 13px; margin-left: 6px; }
  .text p { margin: 0 0 6px; }
  .quiet { color: #94a3b8; }
  ul { margin: 8px 0 0; padding-left: 18px; color: #475569; font-size: 13px; }
  @media (max-width: 800px) { .beat { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<header>
  <h1>${esc(tour.title)}</h1>
  <p>${esc(m.kind)} · for ${esc(m.audience)} · afterwards: ${esc(m.afterwards)}${m.takeaway ? ` · ${esc(m.takeaway)}` : ""}</p>
  <p>${beats.length} beats · narration ${narr.toFixed(1)} s (target ${Number(budget.narration.min.toFixed(1))}–${Number(budget.narration.max.toFixed(1))} s) · ${tourWords(tour)} words</p>
  ${note ? `<p>${esc(note)}</p>` : ""}
</header>
<main>
${rows.join("\n")}
</main>
</body>
</html>
`;
}
