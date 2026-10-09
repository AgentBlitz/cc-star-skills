import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const GUARD = resolve(import.meta.dirname, "..", "..", "hooks", "guard-keys.sh");

function guard(tool: string, input: Record<string, unknown>, env: Record<string, string> = {}): { code: number | null; denied: boolean; out: string } {
  const payload = JSON.stringify({ session_id: "s", hook_event_name: "PreToolUse", tool_name: tool, tool_input: input, cwd: "/tmp" });
  const r = spawnSync(GUARD, { input: payload, env: { PATH: process.env.PATH ?? "", ...env }, encoding: "utf8" });
  let denied = false;
  if (r.stdout.trim()) {
    const out = JSON.parse(r.stdout) as { hookSpecificOutput: { hookEventName: string; permissionDecision: string; permissionDecisionReason: string } };
    assert.equal(out.hookSpecificOutput.hookEventName, "PreToolUse");
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /showcase keys status/);
    denied = out.hookSpecificOutput.permissionDecision === "deny";
  }
  return { code: r.status, denied, out: r.stdout };
}

describe("guard-keys.sh", () => {
  const denied: [string, Record<string, unknown>, Record<string, string>?][] = [
    ["Read", { file_path: "/Users/someone/.config/showcase/.env" }],
    ["Bash", { command: "cat ~/.config/showcase/.env" }],
    ["Bash", { command: "cat $HOME/.config/showcase/.env | head" }],
    ["Bash", { command: 'grep KEY "${XDG_CONFIG_HOME}/showcase/.env"' }],
    ["Bash", { command: "cat $XDG_CONFIG_HOME/showcase/.env" }],
    ["Bash", { command: "cat $SHOWCASE_CONFIG_DIR/.env" }],
    ["Bash", { command: 'cat "${SHOWCASE_CONFIG_DIR:-x}/.env"' }],
    ["Bash", { command: "cat ~/.config/showcase/*" }],
    ["Read", { file_path: "/opt/cfg/sc/.env" }, { SHOWCASE_CONFIG_DIR: "/opt/cfg/sc" }],
    ["Read", { file_path: "/xdg/showcase/.env" }, { XDG_CONFIG_HOME: "/xdg" }],
    ["Grep", { pattern: "KEY", path: "/Users/someone/.config/showcase" }],
    ["Glob", { pattern: "*", path: "/Users/someone/.config/showcase/" }],
    ["Read", { file_path: "/repo/showcase/.auth/state.json" }],
    ["Bash", { command: "ls showcase/.auth" }],
    ["Edit", { file_path: "/Users/x/.config/showcase/.env", old_string: "a", new_string: "b" }],
  ];
  for (const [tool, input, env] of denied) {
    it(`denies ${tool} ${JSON.stringify(input)}`, () => {
      const r = guard(tool, input, env);
      assert.equal(r.code, 0);
      assert.ok(r.denied, r.out);
    });
  }

  const allowed: [string, Record<string, unknown>][] = [
    ["Bash", { command: "showcase keys status" }],
    ["Read", { file_path: "/repo/plugins/showcase/skills/showcase/templates/env.template" }],
    ["Read", { file_path: "/repo/showcase/tours/intro.json" }],
    ["Bash", { command: "ls ~/.config/showcase" }],
    ["Read", { file_path: "/repo/.env.example" }],
    ["Grep", { pattern: "showcase", path: "/repo/plugins/showcase" }],
  ];
  for (const [tool, input] of allowed) {
    it(`allows ${tool} ${JSON.stringify(input)}`, () => {
      const r = guard(tool, input);
      assert.equal(r.code, 0);
      assert.ok(!r.denied);
      assert.equal(r.out, "");
    });
  }
});
