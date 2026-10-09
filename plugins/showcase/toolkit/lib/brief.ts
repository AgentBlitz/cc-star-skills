/**
 * `showcase/BRIEF.md` (PLAN §2.7 P5, §2.9): the hand-off to `/planning:roadmap`. The file is
 * `templates/BRIEF.md` with two generated blocks — the tours and the app — between
 * `<!-- showcase:begin <name> -->` and `<!-- showcase:end <name> -->`. `showcase brief` rewrites
 * only those blocks from the repo's files; everything else (the answers verbatim, the frozen
 * code, the open items, the session cut) is the skill's to write, and is kept. Same state, same
 * bytes: nothing here is dated.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { budgetFor, narrativeIssues, tourNarrationMs, tourWords } from "../runtime/src/narrative.ts";
import { beatsOf, type Tour } from "../runtime/src/schema.ts";
import { plan } from "../voice/pipeline.ts";
import { loadSetup, type VoiceSetup } from "../voice/setup.ts";
import { type Config, ConfigError, loadConfig } from "./config.ts";
import { pluginRoot } from "./paths.ts";
import { loadTour, storyboardState } from "./tours.ts";

export const BLOCKS = ["tours", "app"] as const;
export type BlockName = (typeof BLOCKS)[number];

export const templateFile = (): string => join(pluginRoot, "skills", "showcase", "templates", "BRIEF.md");

const begin = (name: string) => `<!-- showcase:begin ${name} -->`;
const end = (name: string) => `<!-- showcase:end ${name} -->`;

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
const num = (n: number) => String(Number(n.toFixed(1)));
const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

export interface TourState {
  id: string;
  file: string;
  title?: string;
  ok: boolean;
  lines: string[];
}

function readJson(file: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function renderSummary(showcaseDir: string, id: string): string {
  const report = readJson(join(showcaseDir, "out", id, "report.json"));
  if (!report) return "none yet";
  const checks = Array.isArray(report.checks) ? (report.checks as { id: string; level: string }[]) : [];
  const failed = checks.filter((c) => c.level === "fail").map((c) => c.id);
  const warned = checks.filter((c) => c.level === "warn").map((c) => c.id);
  const kind = report.draft ? "draft" : "final";
  const verdict = failed.length ? `✗ ${failed.join(", ")}` : warned.length ? `⚠ ${warned.join(", ")}` : "✓ every check";
  return `${kind}, ${report.strict ? "--strict, " : ""}${verdict} (\`showcase/out/${id}/report.md\`)`;
}

function rehearseSummary(showcaseDir: string, id: string): string {
  const r = readJson(join(showcaseDir, "out", id, "rehearse.json"));
  if (!r) return "none yet";
  const problems = Array.isArray(r.problems) ? r.problems.length : 0;
  const input = r.input === "synthetic" ? " (synthetic input)" : "";
  return r.ok ? `✓ clean${input}` : `✗ ${plural(problems, "problem")}${input}`;
}

function voiceSummary(tour: Tour, config: Config, setup: VoiceSetup, root: string, showcaseDir: string): string {
  const p = plan({ tour, lexicon: config.voice.lexicon, setup, mode: "auto", check: true, voiceDir: resolve(root, config.voice.dir), cacheDir: join(showcaseDir, ".cache", "tts") });
  const count = (s: string) => p.items.filter((i) => i.status === s).length;
  const parts = (["fresh", "draft", "stale", "missing"] as const).filter((s) => count(s)).map((s) => `${count(s)} ${s}`);
  return `${plural(p.items.length, "sentence")}: ${parts.join(" · ") || "none"}`;
}

function narratorSummary(config: Config): string {
  const n = config.voice.narrator;
  if (!n) return `none chosen; the draft voice (${config.voice.draft.provider}) speaks`;
  return `${n.model} · ${n.voice}${n.approved ? ` · approved ${n.approved}` : " · not approved yet"}`;
}

function tourState(file: string, showcaseDir: string, root: string, config: Config | null, setup: VoiceSetup | null): TourState {
  const fallback = basename(file, ".json");
  const loaded = loadTour({ file, showcaseDir });
  const rel = `showcase/tours/${basename(file)}`;
  if (!loaded.tour) {
    const first = loaded.issues.find((i) => i.level === "error");
    return { id: fallback, file: rel, ok: false, lines: [`### \`${fallback}\``, "", `\`${rel}\` doesn't match the schema${first ? ` (${first.rule} ${first.path}: ${first.message})` : ""}: run \`showcase check ${fallback}\`.`] };
  }
  const t = loaded.tour;
  const m = t.meta;
  const b = budgetFor(m);
  const issues = [...loaded.issues, ...narrativeIssues(t)];
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.length - errors.length;
  const story = storyboardState(loaded, t);
  const approved = m.approved ?? {};
  const rows: [string, string][] = [
    ["File", `\`${rel}\``],
    ["Kind", `${m.kind} · for ${m.audience} · afterwards: ${m.afterwards} · ${m.language}`],
    ["Takeaway", m.takeaway ?? "—"],
    ["Budget", `${mmss(b.targetSec)} · narration ${num(b.narration.min)}–${num(b.narration.max)} s · ${b.words.min}–${b.words.max} words · ${b.beats.min}–${b.beats.max} beats (${b.source})`],
    ["Now", `narration ${num(tourNarrationMs(t) / 1000)} s by reading time · ${tourWords(t)} words · ${beatsOf(t).length} beats`],
    ["Rules", `spoken numbers ${m.rules?.spokenNumbers ?? "on-screen-only"}${m.rules?.firstToCut ? ` · first to cut: \`${m.rules.firstToCut}\`` : ""}`],
    ["`check`", errors.length ? `✗ ${errors.map((i) => i.rule).filter((r, i, all) => all.indexOf(r) === i).join(", ")}` : `✓${warnings ? ` (${plural(warnings, "warning")})` : ""}`],
    ["Storyboard", `${story} · \`showcase/storyboard/${t.id}.md\` · ${approved.storyboard ? `approved ${approved.storyboard}` : "not approved"}`],
    ["Rehearse", rehearseSummary(showcaseDir, t.id)],
  ];
  if (config && setup) {
    rows.push(["Narrator", `${narratorSummary(config)}${approved.narrator ? ` (tour: approved ${approved.narrator})` : ""}`]);
    rows.push(["Voice", voiceSummary(t, config, setup, root, showcaseDir)]);
  }
  rows.push(["Film", renderSummary(showcaseDir, t.id)]);
  rows.push(["Final cut", approved.final ? `approved ${approved.final}` : "not approved"]);
  return {
    id: t.id,
    file: rel,
    title: t.title,
    ok: errors.length === 0,
    lines: [`### \`${t.id}\`: ${t.title}`, "", "| | |", "|---|---|", ...rows.map(([k, v]) => `| ${k} | ${cell(v)} |`)],
  };
}

export interface BriefState {
  root: string;
  showcaseDir: string;
  configProblems: string[];
  tours: TourState[];
  blocks: Record<BlockName, string>;
}

function appBlock(config: Config | null, problems: string[], showcaseDir: string): string {
  if (!config) return [`No usable \`showcase/config.json\`:`, ...problems.map((p) => `- ${p}`)].join("\n");
  const a = config.app;
  const br = config.browser;
  const code = (v: string | undefined) => (v ? `\`${cell(v)}\`` : "—");
  const cmd = (v: Config["app"]["reset"]) => (v === undefined ? "—" : typeof v === "string" ? code(v) : `${v.method ?? "POST"} ${code(v.url)}`);
  const env = Object.keys(a.env ?? {});
  const auth = br.storageState ? `\`storageState\` ${br.storageState}${existsSync(resolve(showcaseDir, br.storageState)) ? " (recorded)" : " (not recorded yet: `showcase auth`)"}` : "none";
  const levers: [boolean, string][] = [
    [Boolean(a.snapshot || a.reset), "data pinned (`app.snapshot` / `app.reset`)"],
    [Boolean(br.clock), "clock fixed (`browser.clock`)"],
    [br.block.length > 0, "third parties blocked (`browser.block`)"],
    [br.hide.length > 0, "overlays hidden (`browser.hide`)"],
    [config.privacy.deny.length > 0, "deny-list set (`privacy.deny`)"],
  ];
  return [
    "| | |",
    "|---|---|",
    `| Build | ${code(a.build)} |`,
    `| Start | ${code(a.start)} |`,
    `| URL · health | ${code(a.url)} · ${code(a.health)} |`,
    `| Env (names only) | ${env.length ? env.map((k) => `\`${k}\``).join(", ") : "—"} |`,
    `| Snapshot · reset | ${cmd(a.snapshot)} · ${cmd(a.reset)} |`,
    `| Clock | ${br.clock ? `fixed at ${br.clock.fixed}` : "not fixed"} |`,
    `| Browser | scale ${br.scale} · ${br.colorScheme} · ${br.locale} · ${br.timezone} · GPU ${br.gpu} |`,
    `| Blocked · hidden | ${plural(br.block.length, "URL pattern")} · ${plural(br.hide.length, "selector")} |`,
    `| Never on screen | ${plural(config.privacy.deny.length, "entry", "entries")} in \`privacy.deny\` |`,
    `| Sign-in | ${auth} |`,
    `| Voice folder | \`${config.voice.dir}\` |`,
    "",
    "Determinism levers set: " + levers.map(([on, what]) => `${on ? "✓" : "✗"} ${what}`).join(" · ") + ".",
  ].join("\n");
}

/** Everything `brief` knows from the files. Reads the key's presence (for the voice status), never prints it. */
export function briefState(root: string): BriefState {
  const showcaseDir = join(root, "showcase");
  let config: Config | null = null;
  let configProblems: string[] = [];
  try {
    config = loadConfig(showcaseDir);
  } catch (e) {
    configProblems = e instanceof ConfigError ? e.problems : [(e as Error).message];
  }
  const setup = config ? loadSetup(config) : null;
  const toursDir = join(showcaseDir, "tours");
  const files = existsSync(toursDir) ? readdirSync(toursDir).filter((f) => f.endsWith(".json")).sort() : [];
  const tours = files.map((f) => tourState(join(toursDir, f), showcaseDir, root, config, setup));
  const toursBlock = tours.length
    ? tours.map((t) => t.lines.join("\n")).join("\n\n")
    : "No tours yet. The roadmap's first session drafts one from `templates/tour.<kind>.json` (`showcase docs tour-format`).";
  return { root, showcaseDir, configProblems, tours, blocks: { tours: toursBlock, app: appBlock(config, configProblems, showcaseDir) } };
}

/** Replaces each block's body; reports the blocks whose markers are missing (left as they are). */
export function applyBlocks(text: string, blocks: Record<BlockName, string>): { text: string; missing: BlockName[] } {
  const missing: BlockName[] = [];
  let out = text;
  for (const name of BLOCKS) {
    const a = out.indexOf(begin(name));
    const z = out.indexOf(end(name));
    if (a < 0 || z < a) {
      missing.push(name);
      continue;
    }
    out = `${out.slice(0, a + begin(name).length)}\n${blocks[name]}\n${out.slice(z)}`;
  }
  return { text: out, missing };
}
