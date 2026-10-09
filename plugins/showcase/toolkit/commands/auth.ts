/**
 * `showcase auth [path]`: record a sign-in for tours that need one (PLAN §2.2). The state is a
 * secret: it goes to showcase/.auth/state.json (mode 600, ignored) and is never printed.
 */
import { relative } from "node:path";
import { auth as run } from "../host/auth.ts";
import { projectHere } from "../host/project.ts";
import { APP_OPTIONS } from "./rehearse.ts";
import { type Command, UsageError } from "./types.ts";

export const auth: Command = {
  name: "auth",
  summary: "Sign in once in a headed browser; saved to showcase/.auth/ for tours to use",
  usage: [
    "Usage: showcase auth [<path>] [--base <url>] [--json]",
    "  Opens the app (at <path>) in a browser window. Sign in, then close the window (or press",
    "  Enter here). The session is saved to showcase/.auth/state.json (mode 600, git-ignored);",
    '  set browser.storageState to ".auth/state.json" in showcase/config.json to use it.',
    "  --base <url>   use an app that is already running instead of app.start",
  ].join("\n"),
  options: { base: APP_OPTIONS.base },
  allowPositionals: true,
  async run({ positionals, values, log }) {
    if (positionals.length > 1) throw new UsageError("name at most one path");
    // Enter ends it in a terminal; without one, closing the window does.
    const done = process.stdin.isTTY
      ? new Promise<void>((resolve) => {
          process.stdin.once("data", () => resolve());
          process.stdin.resume();
        })
      : undefined;
    const project = projectHere();
    const result = await run({
      project,
      ...(positionals[0] ? { path: positionals[0] } : {}),
      ...(typeof values.base === "string" ? { url: values.base } : {}),
      ...(done ? { done } : {}),
      say: (line) => log.info(line),
    });
    if (process.stdin.isTTY) process.stdin.pause();
    const shown = relative(process.cwd(), result.file) || result.file;
    log.result({ file: result.file, cookies: result.cookies, origins: result.origins }, () => [
      `saved the sign-in to ${shown} (mode 600): ${result.cookies} cookies, ${result.origins} origins`,
      project.config.browser.storageState ? "" : 'set browser.storageState to ".auth/state.json" in showcase/config.json to use it',
    ]);
    return 0;
  },
};
