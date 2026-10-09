/**
 * `showcase watch <tour>`: the live demo in a headed, maximised browser (PLAN §2.2). `--detach`
 * starts it in the background and returns at once, with its pid and a progress file, because the
 * Bash tool stops a command after 10 minutes.
 */
import { spawn } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { join } from "node:path";
import { loadValidTour, outDir, projectOf } from "../host/project.ts";
import { watch as run } from "../host/watch.ts";
import { APP_OPTIONS, APP_USAGE, speedOf } from "./rehearse.ts";
import { type Command, UsageError } from "./types.ts";

export const watch: Command = {
  name: "watch",
  summary: "Play a tour live in a headed browser, with its voice (the live demo)",
  usage: [
    "Usage: showcase watch <tour> [--speed <×>] [--muted] [--from <step>] [--detach] [--json]",
    "  Opens the app maximised and plays the tour. Space pauses; ← and → step; M mutes; Esc exits;",
    "  a click on the page pauses. A finished tour holds its end card until you close it.",
    "  --from <step>      start at a step (earlier writes are made silently first)",
    "  --detach           run in the background; prints the pid, a log and a progress file",
    "  --manifest <file>  the voice manifest (default: <voice.dir>/manifest.json, if it's this tour's)",
    ...APP_USAGE,
  ].join("\n"),
  options: {
    speed: { type: "string" },
    muted: { type: "boolean" },
    from: { type: "string" },
    detach: { type: "boolean" },
    manifest: { type: "string" },
    progress: { type: "string" },
    out: { type: "string" },
    ...APP_OPTIONS,
  },
  allowPositionals: true,
  async run({ positionals, values, log }) {
    if (positionals.length !== 1) throw new UsageError("name one tour");
    const speed = speedOf(values.speed, 1);
    const { tf, tour } = loadValidTour(positionals[0] as string);
    if (typeof values.from === "string" && !tour.steps.some((s) => s.id === values.from)) throw new UsageError(`the tour has no step '${values.from}'`);
    const project = projectOf(tf);
    const out = outDir(project, tour.id, typeof values.out === "string" ? values.out : undefined);
    const progress = typeof values.progress === "string" ? values.progress : join(out, "watch.json");

    if (values.detach) {
      const logFile = join(out, "watch.log");
      const fd = openSync(logFile, "a", 0o600);
      const args = process.argv.slice(2).filter((a) => a !== "--detach" && a !== "--json");
      if (!args.includes("--progress")) args.push("--progress", progress);
      const child = spawn(process.execPath, [...process.execArgv, process.argv[1] as string, ...args], {
        cwd: process.cwd(),
        env: process.env,
        detached: true,
        stdio: ["ignore", fd, fd],
      });
      closeSync(fd);
      child.unref();
      log.result({ tour: tour.id, pid: child.pid, log: logFile, progress }, () => [
        `watching ${tour.id} in the background (pid ${child.pid})`,
        `  progress: ${progress}`,
        `  log: ${logFile}`,
        `  stop it with: kill ${child.pid}`,
      ]);
      return 0;
    }

    const result = await run({
      project,
      tour,
      out,
      speed,
      progress,
      ...(values.muted ? { muted: true } : {}),
      ...(typeof values.from === "string" ? { from: values.from } : {}),
      ...(typeof values.manifest === "string" ? { manifest: values.manifest } : {}),
      ...(typeof values.base === "string" ? { url: values.base } : {}),
      ...(values.build ? { build: true } : {}),
      ...(values["no-reset"] ? { reset: false } : {}),
      say: (line) => log.info(line),
    });
    log.result({ tour: tour.id, end: result.end, ended: result.last?.ended?.reason ?? null }, () => `closed (${result.end})`);
    return 0;
  },
};
