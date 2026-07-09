# Session: Add autopilot — unattended roadmap runner

**Date:** 2026-07-09
**Branch:** main

## Summary

Added an "autopilot" capability to the planning plugin (v1.1.0 → v1.2.0): an external bash loop that runs every remaining roadmap session unattended by repeatedly launching `claude -p "/planning:session <plan-dir>"` — one fresh context per session — until TRACKER.md has no pending (⬜/🟡) rows, a row goes ⛔ (failed verification gate), or a `--max N` cap is reached. Includes model selection (`--model`, passed through to the CLI), subscription-limit handling (reactive by default: parse the reset epoch from a limit-reached error and sleep until the window reopens; opt-in `--usage-check --threshold 20` proactively queries the undocumented OAuth usage endpoint with the user's own Keychain token), a two-strike no-progress abort, per-run JSON + log artifacts under `.planning/<slug>/autopilot/`, and a companion `/autopilot` skill that surfaces the ready-to-paste terminal command. Verified with 24 fixture/loop tests (stubbed `claude`), a headless smoke test proving plugin slash commands run under `claude -p` (undocumented), and a real end-to-end run: a toy 2-session roadmap executed unattended on haiku to all-✅ (~$0.15, 90s).

## Changes

- `plugins/planning/scripts/autopilot.sh` — new; the loop runner. Tracker emoji parsing (table rows only, so the legend never miscounts), plan-dir auto-detection mirroring `/session`, dry-run mode, limit-hit sleep/retry that doesn't consume an iteration, exit codes 0 complete / 2 blocked / 3 no-progress.
- `plugins/planning/skills/autopilot/SKILL.md` — new; docs/setup skill. Locates the script via `${CLAUDE_PLUGIN_ROOT}`, checks tracker readiness, asks only about model/cap, prints the command. Never runs the loop in-session (a skill can't outlive its claude process).
- `plugins/planning/.claude-plugin/plugin.json` — version 1.2.0, description mentions autopilot.
- `.claude-plugin/marketplace.json` — version 1.2.0, description mentions autopilot.
- `README.md` — `/autopilot` row in the skills table, "Which one?" line, a dedicated Autopilot section (usage, stop conditions, permission-mode caveat, subscription-limit behavior), updated install list and layout tree (also fixed stale `next` → `handoff` in the tree).

## Decisions & Rationale

- **Outer bash loop, not an in-Claude loop** → `/session` is deliberately one-session-per-invocation and a skill cannot outlive its process; a fresh `claude -p` per session also gives each session a clean context window, which is the whole point of the roadmap format.
- **Tracker emoji column as the only loop signal** → the session skill guarantees no stdout sentinel or special exit code; ⬜/🟡 = pending, ✅ = done, ⛔ = hard stop. Parsed with `grep -E '^\|.*(⬜|🟡)'` (alternation, not bracket expressions — BSD grep multibyte safety).
- **Reactive limit handling always on, proactive check opt-in** → Pro/Max subscriptions have no official usage API. Reactive (parse `Claude AI usage limit reached|<epoch>` from the error, sleep, retry without consuming an iteration) is robust; the proactive `--usage-check` path reads the user's own OAuth token (Keychain `Claude Code-credentials`, fallback `~/.claude/.credentials.json`) and calls the undocumented `api.anthropic.com/api/oauth/usage`, so it's off by default and degrades to a warning.
- **`--permission-mode bypassPermissions` default** → unattended runs cannot answer prompts; documented as "only autopilot roadmaps you trust".
- **Two-strike no-progress abort** → protects the subscription from a wedged skill silently burning the window.
- Bugs found by tests and fixed: auto-detect erroring on an all-complete roadmap instead of reporting success; `die` inside `$(duration_seconds …)` only killing the subshell so bad `--backoff` didn't halt; bash swallowing multibyte `→` into a variable name (`$var→` must be `${var}→`).

## Remaining Work

- The exact limit-reached error text is validated against the known `…|<epoch>` shape but only fully confirmable on a real limit hit; `--backoff` (default 30m) covers drift. Worth confirming the first time autopilot rides through a real window reset.
- Optional future: per-session model column in TRACKER.md (user chose CLI-flag-only for now); `--fallback-model` passthrough.
- Test scripts live in the session scratchpad only (`test_autopilot.sh`, `test_autopilot_loop.sh`) — consider committing them under a `tests/` dir if the plugin grows.

## Resumption Context

Key files to review when picking this up:
- `plugins/planning/scripts/autopilot.sh`
- `plugins/planning/skills/autopilot/SKILL.md`
- `plugins/planning/skills/session/SKILL.md` (the one-session-per-invocation contract autopilot depends on)
- `README.md` (Autopilot section)

Suggested opening prompt for next session:
> "In cc-star-skills, the planning plugin v1.2.0 ships scripts/autopilot.sh (loops `claude -p /planning:session` until TRACKER.md is all ✅, with subscription-limit sleep/retry) plus an /autopilot docs skill. Read plugins/planning/scripts/autopilot.sh and the session summary .planning/sessions/2026-07-09-add-autopilot.md, then <next task — e.g. add a per-session model column to TRACKER.md, or commit fixture tests under tests/>."
