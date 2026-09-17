# Session: Per-session runtime profiles + evidence-based autopilot escalation (planning v1.6.0)

**Date:** 2026-09-17
**Branch:** main

## Summary

Made `/roadmap` rate every session's model and effort in a second pass (new `/calibrate-roadmap` skill, also runnable standalone to retrofit or re-rate a roadmap), stored as YAML frontmatter on `prompts/session-N.md` plus a `**Runtime:**` line in PLAN.md §5. `autopilot.sh` now resolves the runtime per session (flag > frontmatter > default) and, when a run makes no tracker progress, **classifies the run before acting** — needs-human → exit 4 with a `--resume` command; environment failure → identical retry, twice → exit 3; yielded early → identical retry with a reminder; genuine stall → escalate (same model at `max`, then the next model up). The classifier was built from the real pokeriment autopilot log (8 of 42 runs made no progress, all `exit=0 is_error=false`) and pinned to CLI behaviour by four live experiments on claude 2.1.269.

## Changes

- `plugins/planning/scripts/autopilot.sh` — per-iteration runtime resolution (`detect_num_field`, `session_num_from_row`, `frontmatter_field`, `resolve_runtime`), ladder (`next_model`, `escalation_rungs`, `rung_for_attempt`), `--escalate off|effort|model`; `parse_run` rewritten to emit `key=value` lines (adds `subtype turns stop term denials denied_tool models asks waits tail detail`) read by `read_run`; `classify_run`, `needs_human_report`, `diagnosis`, `blocked_reason`; headless note via `--append-system-prompt` (`build_note`); fresh `--session-id` per run; stdin closed on the claude call; run files now `run-<launch>-<n>.json`; exit code 4; `usage()` prints the header up to the first blank line (no hard-coded range); `die` no longer appends the exit code to its message.
- `plugins/planning/skills/calibrate-roadmap/SKILL.md` — new: evidence → rubric (model by kind of thinking, effort by stakes × gate strength, modifiers, consistency pass) → confirm → write PLAN.md `Runtime:` lines + prompt frontmatter.
- `plugins/planning/skills/roadmap/SKILL.md` — new step 4 "Calibrate runtime profiles" (references the calibrate skill, never forks the rubric); prompts open with the frontmatter block; THE RULE gains the `Needs decision:` clause; "leave no open decisions" rule; report prints the runtime table.
- `plugins/planning/skills/session/SKILL.md` — a ⛔ row now halts `/session` (previously it could skip past one); a `Needs decision:` row is answered interactively via AskUserQuestion and recorded in PLAN.md §3; frontmatter is metadata; new "Headless runs (autopilot)" section; `Runtime:` provenance in the summary and the tracker session log; next-prompt blockquote omits the frontmatter.
- `plugins/planning/skills/wrapup/SKILL.md` — optional `**Runtime:**` header line after `**Roadmap:**` + its rule.
- `plugins/planning/skills/autopilot/SKILL.md` — readiness dry run shows the resolved runtime + ladder; Model/Effort questions default to per-session profiles; new Escalation question (batch 2); exit codes 0/2/3/4; class table.
- `README.md` — `/calibrate-roadmap` rows; options table (`--model`/`--effort` semantics, `--escalate`); new "Runtime profiles, failure classes & escalation" subsection; exit codes; run-file naming.
- `plugins/planning/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` — 1.5.0 → 1.6.0; skill lists.

## Decisions & Rationale

- **Second pass, not inline rating** → difficulty is only visible relative to the whole set and is a different axis (reasoning density) from sizing (context volume). Standalone skill so old roadmaps can be retrofitted and re-rated from `Runtime:`/escalation history.
- **Frontmatter on the prompt, not a TRACKER column** → the tracker's `^|` emoji regex is a contract shared by `/session`, `autopilot.sh` and `/archive-roadmap`; prompt files are never edited by sessions, so profiles can't drift.
- **Classify before escalating** → the two real no-progress runs that survived were both non-model failures: a 283-turn/$110 run cut off at a tool call (`stop_reason=tool_use`, empty result) and an 18-second run that ended "I'll kick off the load rig once it finishes". Escalating either would only have cost more.
- **Experiments overturned two assumptions** (kept in `--help`/README): `AskUserQuestion` is *not offered* headless, so questions arrive as final-message text (detected by phrasing + a sentence-ending `?` in the last 300 chars — end-anchored `?` missed a real case); a hook `deny`/`ask` does **not** end a run (the model continues and reports it; the call is listed in `permission_denials`), while `continue:false` yields `terminal_reason=hook_stopped`. So needs-human keys on the final message / `hook_stopped`, and a run cut off at a tool call is a *yield*, not a denial.
- **⛔ stays a hard stop; no auto-retry** → THE RULE is the plugin's core discipline. New `Needs decision:` convention reuses ⛔ so no consumer's grep changes.
- **No automatic `--resume` yet** → printed as a hint (each run has a known `--session-id`); a stale-context policy is needed before automating it.
- **`--escalate off` still stops on needs-human/env** → those stops only save money; "off" means "never change the flags".

## Remaining Work

- Follow-ups noted in the plan: auto-resume of yielded/needs-human runs; `stream-json` + `compact_boundary` counting for an evidence-based "too big — split it" hint; `--max-budget-usd` passthrough.
- Retrofit the live roadmaps (collabmd `desktop-coordinator`, pokeriment) with `/calibrate-roadmap` after `/plugin update planning@cc-star-skills`.
- Push `main` + the `planning--v1.6.0` tag when ready (not pushed in this session).

## Resumption Context

Key files to review when picking this up:
- `plugins/planning/scripts/autopilot.sh` (header comment documents the classes and ladder; `classify_run` and the no-progress block at the end of the main loop)
- `plugins/planning/skills/calibrate-roadmap/SKILL.md`
- `plugins/planning/skills/session/SKILL.md` ("Headless runs" section)

Tests were scratch-only (a stub `claude` replaying scripted outcomes incl. the real run signatures): 51 unit + 78 end-to-end assertions, plus a parser regression over the 10 real pokeriment run files. They live outside the repo; recreate from the scenario list in `~/.claude/plans/i-want-to-make-sequential-blum.md` if needed.

Suggested opening prompt for next session:
> "Planning plugin v1.6.0 added per-session runtime profiles (/calibrate-roadmap) and a no-progress classifier in autopilot.sh. Read .planning/sessions/2026-09-17-per-session-runtime-profiles.md, then implement the auto-resume follow-up: on a `yielded` run, continue it with `claude -p --resume <sid>` instead of restarting."
