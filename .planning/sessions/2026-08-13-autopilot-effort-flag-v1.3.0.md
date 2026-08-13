# Session: Autopilot `--effort` flag + planning plugin v1.3.0

**Date:** 2026-08-13
**Branch:** main

## Summary

Added an `--effort <level>` flag to autopilot so unattended roadmap runs can pin the reasoning effort of every looped `claude` session (the CLI supports `--effort low|medium|high|xhigh|max`, but autopilot had no passthrough — the immediate need was "run this roadmap with opus at max effort", which previously required a PATH-shimmed `claude` wrapper). Bumped the planning plugin to **v1.3.0**, which also ships the previously unreleased `--branch` work from 2026-07-14 (its summary had flagged the deferred version bump; this closes it).

## Changes

- `plugins/planning/scripts/autopilot.sh` — New `EFFORT` variable, `--effort` arg-parsing case, and an up-front validation `case` that dies on anything outside `low|medium|high|xhigh|max` (before any tracker/branch work, so a typo can't start a run). `[ -n "$EFFORT" ] && CMD+=(--effort "$EFFORT")` appends it to the looped command after `--model`. Usage header gained the flag (and `usage()`'s `sed` range moved `2,29p` → `2,30p` to match).
- `plugins/planning/skills/autopilot/SKILL.md` — Step 3 gains question **1b. Effort** (Model default recommended / max / high / low, mapped to `--effort <level>`); the "one AskUserQuestion call" phrasing became "as few calls as possible (the tool takes at most 4 questions per call)" since the list now holds 6 questions. Step 4's example command shows `--effort high`.
- `README.md` — `--effort` row in the All-options table; the quick-start example shows `[--effort high]`; the interactive-options parenthetical now matches the skill's actual question list (model, effort, iteration cap, branch, usage-check, dry-run first — it had stale pre-`--branch` wording).
- `plugins/planning/.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json` — planning `version` 1.2.0 → **1.3.0** (both places, per the README "Updating" convention).

## Decisions & Rationale

- **Validate effort values in the script** rather than letting `claude` fail N iterations in → an unattended loop should refuse bad input before it starts.
- **Empty default, no flag emitted** → inherits the model's default effort, preserving existing behaviour exactly when the flag is unused.
- **1.3.0 not 1.2.1** → two user-facing feature additions (`--branch`, `--effort`) since 1.2.0; minor bump per convention.

## Remaining Work

- None for this feature. Users pick up v1.3.0 via `/plugin update` (the installed cache at `~/.claude/plugins/cache/.../1.2.0` predates both flags).

## Resumption Context

The `--effort` flag mirrors `--model` exactly (parse → validate → conditional `CMD+=`); any future passthrough flag should follow the same three-touch pattern plus the usage-header/`sed`-range pair in `usage()`.
