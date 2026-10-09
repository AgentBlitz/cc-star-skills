/**
 * `showcase shim`: a launcher on `~/.local/bin` for the user's own terminal (PLAN D11). It runs
 * the newest installed plugin version, else the checkout that wrote it.
 */
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { pluginRoot } from "../lib/paths.ts";
import type { Command } from "./types.ts";

export function shimScript(devBin: string): string {
  const q = devBin.replaceAll("'", `'\\''`);
  return `#!/usr/bin/env bash
# showcase launcher, written by \`showcase shim\`. Runs the newest installed plugin version,
# else the checkout that wrote this file.
newest="$(ls -d "$HOME"/.claude/plugins/cache/*/showcase/*/bin/showcase 2>/dev/null \\
  | awk -F/ '{ print $(NF-2) "\\t" $0 }' | sort -t "$(printf '\\t')" -k1,1V | tail -n 1 | cut -f2-)"
if [ -n "$newest" ] && [ -x "$newest" ]; then exec "$newest" "$@"; fi
dev='${q}'
if [ -x "$dev" ]; then exec "$dev" "$@"; fi
echo "showcase: no installed plugin found, and the dev checkout ($dev) is gone." >&2
exit 1
`;
}

export const shim: Command = {
  name: "shim",
  summary: "Write ~/.local/bin/showcase for use in your own terminal",
  usage: "Usage: showcase shim [--to <dir>] [--json]\n  Writes <dir>/showcase (default ~/.local/bin), which runs the newest installed version.",
  options: { to: { type: "string" } },
  async run({ values, log }) {
    const dir = resolve(typeof values.to === "string" ? values.to : join(process.env.HOME || homedir(), ".local", "bin"));
    const path = join(dir, "showcase");
    const devBin = join(pluginRoot, "bin", "showcase");
    mkdirSync(dir, { recursive: true });
    const existed = existsSync(path);
    writeFileSync(path, shimScript(devBin));
    chmodSync(path, 0o755);
    const onPath = (process.env.PATH ?? "").split(delimiter).some((p) => p && resolve(p) === dir);
    log.result({ path, replaced: existed, onPath, devCheckout: devBin }, () => [
      `${existed ? "Updated" : "Wrote"} ${path}`,
      ...(onPath ? [] : [`warning: ${dir} is not on PATH. Add it to your shell profile, e.g. export PATH="${dir}:$PATH"`]),
    ]);
    return 0;
  },
};
