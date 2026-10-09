/**
 * `showcase film <tour> --video-only` (PLAN §2.2, §2.5): one take of the tour from the real app,
 * as a constant-frame-rate H.264 video lined up with `timeline.json`. `--detach` starts it in the
 * background and returns at once with its pid and `progress.json`, because the Bash tool stops a
 * command after 10 minutes.
 */
import { spawn } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { join } from "node:path";
import type { CaptureMode } from "../film/capture.ts";
import { film as run, filmLines } from "../film/record.ts";
import { loadValidTour, outDir, projectOf } from "../host/project.ts";
import { type Command, UsageError } from "./types.ts";

const CAPTURE_MODES: readonly CaptureMode[] = ["auto", "main", "worker"];

export const film: Command = {
  name: "film",
  summary: "Film a tour from the real app: a 1080p, 30 fps H.264 video and its timeline",
  usage: [
    "Usage: showcase film <tour> --video-only [--detach] [--json]",
    "  Builds and starts the app on its own port (snapshot, reset, health), plays the tour headless",
    "  in film mode, captures every frame and encodes showcase/out/<id>/video.mp4 (1920×1080, CFR",
    "  30 fps, H.264 High, BT.709) with timeline.json beside it. Voice and captions come later.",
    "  --video-only       the picture only (required for now)",
    "  --detach           run in the background; prints the pid, a log and progress.json",
    "  --capture <mode>   auto (default: the main thread, a worker if the event loop lags), main, worker",
    "  --keep-frames      keep the captured frames in out/<id>/.capture/",
    "  --out <dir>        where the outputs go (default showcase/out/<id>/)",
    "  --base <url>       use an app that is already running instead of app.start",
    "  --no-build         skip app.build (the film builds by default)",
    "  --no-reset         skip app.snapshot and app.reset",
  ].join("\n"),
  options: {
    "video-only": { type: "boolean" },
    detach: { type: "boolean" },
    capture: { type: "string" },
    "keep-frames": { type: "boolean" },
    progress: { type: "string" },
    out: { type: "string" },
    base: { type: "string" },
    "no-build": { type: "boolean" },
    "no-reset": { type: "boolean" },
  },
  allowPositionals: true,
  async run({ positionals, values, log }) {
    if (positionals.length !== 1) throw new UsageError("name one tour");
    if (!values["video-only"]) throw new UsageError("only the picture can be filmed so far: add --video-only (voice and captions come next)");
    const capture = (values.capture ?? "auto") as CaptureMode;
    if (!CAPTURE_MODES.includes(capture)) throw new UsageError(`--capture must be one of ${CAPTURE_MODES.join(", ")}`);
    const { tf, tour } = loadValidTour(positionals[0] as string);
    const project = projectOf(tf);
    const out = outDir(project, tour.id, typeof values.out === "string" ? values.out : undefined);
    const progress = typeof values.progress === "string" ? values.progress : join(out, "progress.json");

    if (values.detach) {
      const logFile = join(out, "film.log");
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
        `filming ${tour.id} in the background (pid ${child.pid})`,
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
      progress,
      capture,
      ...(values["keep-frames"] ? { keepFrames: true } : {}),
      ...(typeof values.base === "string" ? { url: values.base } : {}),
      ...(values["no-build"] ? { build: false } : {}),
      ...(values["no-reset"] ? { reset: false } : {}),
      say: (line) => log.info(line),
    });
    log.result({ ...result, out }, () => [...filmLines(result), `outputs: ${out}`]);
    return result.ok ? 0 : 1;
  },
};
