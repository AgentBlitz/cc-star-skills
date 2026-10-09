/** `showcase rehearse <tour>`: a fast headless run with no capture, stills and checks (PLAN §2.2). */
import { outDir, loadValidTour, projectOf } from "../host/project.ts";
import { REHEARSE_SPEED, rehearse as run, reportLines } from "../host/rehearse.ts";
import { type Command, UsageError } from "./types.ts";

/** The options every command that brings the app up takes. */
export const APP_OPTIONS = {
  base: { type: "string" },
  build: { type: "boolean" },
  "no-reset": { type: "boolean" },
} as const;

export const APP_USAGE = [
  "  --base <url>   use an app that is already running instead of app.start",
  "  --build        run app.build first",
  "  --no-reset     skip app.snapshot and app.reset",
];

export function speedOf(v: string | boolean | undefined, fallback: number): number {
  if (v === undefined) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 50) throw new UsageError(`--speed must be a number between 0 and 50, not ${String(v)}`);
  return n;
}

export const rehearse: Command = {
  name: "rehearse",
  summary: "Run a tour headless and fast: anchors, on-screen numbers, deny-list, a still per beat",
  usage: [
    "Usage: showcase rehearse <tour> [--speed <×>] [--synthetic] [--out <dir>] [--json]",
    `  Plays the tour headless at ×${REHEARSE_SPEED} (no capture). At each beat it saves a still to`,
    "  showcase/out/<id>/rehearse/, checks every spoken number is on screen and that nothing on",
    "  privacy.deny is. A failure saves a screenshot, a DOM excerpt and candidate anchors.",
    "  --synthetic    synthetic input only, as an in-app tour plays; lists the actions it can't do",
    ...APP_USAGE,
  ].join("\n"),
  options: { speed: { type: "string" }, synthetic: { type: "boolean" }, out: { type: "string" }, ...APP_OPTIONS },
  allowPositionals: true,
  async run({ positionals, values, log }) {
    if (positionals.length !== 1) throw new UsageError("name one tour");
    const speed = speedOf(values.speed, REHEARSE_SPEED);
    const { tf, tour } = loadValidTour(positionals[0] as string);
    const project = projectOf(tf);
    const out = outDir(project, tour.id, typeof values.out === "string" ? values.out : undefined);
    const report = await run({
      project,
      tour,
      out,
      speed,
      ...(values.synthetic ? { synthetic: true } : {}),
      ...(typeof values.base === "string" ? { url: values.base } : {}),
      ...(values.build ? { build: true } : {}),
      ...(values["no-reset"] ? { reset: false } : {}),
      say: (line) => log.info(line),
    });
    log.result({ ...report, out }, () => [...reportLines(report), `report: ${out}/rehearse.json`]);
    return report.ok ? 0 : 1;
  },
};
