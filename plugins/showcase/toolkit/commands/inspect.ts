/** `showcase inspect <url>`: a page outlined by role and name, with suggested anchors (PLAN §2.2). */
import { inspect as run, outlineLines } from "../host/inspect.ts";
import { projectHere } from "../host/project.ts";
import { APP_OPTIONS } from "./rehearse.ts";
import { type Command, UsageError } from "./types.ts";

export const inspect: Command = {
  name: "inspect",
  summary: "Outline a page by role and name, with the anchor to use for each element",
  usage: [
    "Usage: showcase inspect <url|path> [--hidden] [--limit <n>] [--json]",
    "  A path (/settings) opens on the repo's app, brought up from showcase/config.json; a full URL",
    "  opens as it is. Each anchor shown resolves back to its element: role and name first, then",
    "  label, test id, text and CSS.",
    "  --hidden       include elements that aren't visible",
    "  --base <url>   use an app that is already running, for a path",
    "  --build        run app.build first",
  ].join("\n"),
  options: { hidden: { type: "boolean" }, limit: { type: "string" }, base: APP_OPTIONS.base, build: APP_OPTIONS.build },
  allowPositionals: true,
  async run({ positionals, values, log }) {
    if (positionals.length !== 1) throw new UsageError("name one URL or path");
    const limit = values.limit === undefined ? 400 : Number(values.limit);
    if (!Number.isInteger(limit) || limit < 1) throw new UsageError("--limit must be a positive whole number");
    const report = await run({
      project: projectHere(),
      target: positionals[0] as string,
      limit,
      ...(values.hidden ? { hidden: true } : {}),
      ...(typeof values.base === "string" ? { url: values.base } : {}),
      ...(values.build ? { build: true } : {}),
      say: (line) => log.info(line),
    });
    log.result(report, () => outlineLines(report));
    return 0;
  },
};
