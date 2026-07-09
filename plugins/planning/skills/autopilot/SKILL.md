---
name: autopilot
description: Set up an unattended loop that runs every remaining roadmap session back-to-back — one fresh claude process per session — until the tracker is complete, a gate fails, or an iteration cap is hit. Triggers on "run the whole roadmap", "autopilot", "loop the sessions", "run all remaining sessions unattended". Surfaces the exact terminal command; the loop itself runs outside Claude.
allowed-tools: [Read, Bash, Glob, Grep, AskUserQuestion]
user-invocable: true
---

# Autopilot — Run the Whole Roadmap Unattended

`/session` deliberately runs **one** session per invocation. Autopilot is the outer loop: a bash script (`${CLAUDE_PLUGIN_ROOT}/scripts/autopilot.sh`) the user runs **in their own terminal**, which repeatedly launches `claude -p "/planning:session <plan-dir>"` — a fresh context per session — until TRACKER.md has no ⬜/🟡 rows, a row goes ⛔, or `--max` iterations run.

A skill cannot outlive the `claude` process it runs in, so **never try to run the loop from inside this session**. Your job is to hand the user a ready-to-paste command.

## 1. Locate the roadmap

- `$ARGUMENTS` may give a plan-dir path — honour it.
- Otherwise Glob `.planning/*/TRACKER.md`; if several have pending (⬜/🟡) rows, use `AskUserQuestion` to pick one.
- If none exist, tell the user to run `/roadmap` first and stop.

## 2. Check readiness

Read the TRACKER and report: sessions done / pending / blocked. If a row is ⛔, say autopilot will refuse to start until the blocker is resolved, and stop.

## 3. Ask about options (only what's ambiguous)

Use `AskUserQuestion` for at most: **model** (e.g. sonnet for mechanical roadmaps, opus/fable for hard ones; default = user's session default) and **iteration cap** (default: unlimited — run to completion). Mention but don't ask about:

- `--usage-check --threshold 20` — opt-in proactive check of the 5-hour subscription window before each session, sleeping until reset when low. Reads the user's own Claude Code OAuth token (macOS Keychain / `~/.claude/.credentials.json`) and calls an undocumented endpoint; degrades to a warning if unavailable. Without it, autopilot still handles limits reactively: a limit-reached run sleeps until the reset time in the error, then retries.
- `--permission-mode` — defaults to `bypassPermissions` because unattended runs cannot answer prompts. The user should only autopilot roadmaps whose sessions they trust.
- `--dry-run` — prints the tracker verdict and the exact claude command without running anything.

## 4. Surface the command

Resolve the script's absolute path (it ships with this plugin at `${CLAUDE_PLUGIN_ROOT}/scripts/autopilot.sh` — echo that env var via Bash to resolve it). Then print, as a copy-pasteable block:

```bash
bash <resolved-path>/autopilot.sh --plan .planning/<slug> [--model <model>] [--max N]
```

Tell the user: run it from the project root in a normal terminal (not inside Claude); progress goes to stdout and `.planning/<slug>/autopilot/autopilot.log`, per-run JSON to `.planning/<slug>/autopilot/run-N.json`; Ctrl-C exits cleanly with a summary; exit codes — 0 complete/cap reached, 2 blocked gate, 3 stopped after two no-progress runs.

## Rules

- **Never launch the loop from this session** — surfacing the command is the deliverable.
- Recommend `--dry-run` first for a new roadmap.
- Remind the user that a ⛔ row stops the loop by design (a failed gate is a full stop, per `/session`).
