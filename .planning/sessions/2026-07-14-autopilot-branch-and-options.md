# Session: Autopilot `--branch` flag + full options docs & interactive skill

**Date:** 2026-07-14
**Branch:** main

## Summary

Enhanced the planning plugin's autopilot feature in three ways. First, documented **every** autopilot CLI option in the README — previously only `--model`/`--max` were shown — with a full options table, exit-code reference, and output-location notes. Second, made the `/autopilot` skill genuinely interactive: instead of asking about only model and iteration cap and merely mentioning the rest, it now drives a single `AskUserQuestion` covering model, iteration cap, branch, usage guard, and dry-run-first, keeping `--permission-mode`/`--threshold`/`--backoff` as advanced/on-request. Third — the substantive code change — added a new `--branch <name>` flag to `autopilot.sh` so an unattended multi-session run can land its commits on a dedicated branch instead of piling straight onto `main`.

## Changes

- `plugins/planning/scripts/autopilot.sh` — Added `--branch <name>` support: new `BRANCH` variable, arg-parsing case, a "Branch:" section in the usage/`--help` header (and bumped the `usage()` `sed` range from `2,24p` to `2,29p` to include it). New `ensure_branch()` helper checks out the branch once before the main loop — no-op if already on it, `git checkout` if it exists, `git checkout -b` (from current HEAD) if not; a conflicting switch dies with the git error (exit 1). Dry-run now reports `would check out branch: <name> (currently on <x>)`; real runs call `ensure_branch "$BRANCH"` before `mkdir -p "$RUN_DIR"`.
- `plugins/planning/skills/autopilot/SKILL.md` — Rewrote step 3 ("Ask about options") into an interactive `AskUserQuestion`-driven flow with 5 questions (model, iteration cap, branch, usage guard, first-run dry-run) plus an advanced/on-request set. Branch question checks current branch via `git rev-parse --abbrev-ref HEAD` and leads with a new `autopilot/<slug>` branch when on `main`/`master`. Step 4 now assembles chosen flags into a fully-populated command and notes the dry-run→live re-run.
- `README.md` — Replaced the terse autopilot prose with: a full **All options** table (every flag: `--plan`, `--max`, `--model`, `--branch`, `--usage-check`, `--threshold`, `--backoff`, `--permission-mode`, `--dry-run`, `-h/--help`), a **Branch behaviour** subsection (default = current branch, nothing pushed; `--branch` opt-in), an **Exit codes** note (0/2/3), and an **Output** note (log + per-run JSON locations).

## Decisions & Rationale

- **`--branch` opt-in, default stays on current branch** → preserves existing behaviour for anyone already relying on it; only unattended runs that want isolation pay for it.
- **Let git decide on conflicts rather than a hard clean-tree pre-check** → untracked files (e.g. a fresh `.planning/`) don't block a checkout, so requiring a fully clean tree would be needlessly annoying. `ensure_branch()` only fails on genuinely conflicting *tracked* changes, surfacing git's own error.
- **`checkout -b` (create) vs `checkout` (switch), never `-B`** → `-B` would reset an existing branch's tip and risk losing work; the conditional create/switch is safe.
- **No auto-push** → a network/auth failure mid-loop is a bad unattended failure mode; pushing stays manual.
- **Version bump deferred** → this is a user-facing feature addition that per repo convention warrants a plugin version bump, but that wasn't explicitly requested this session (see Remaining Work).

## Remaining Work

- **Version bump not done.** Per the README "Updating" section, a user-facing plugin change should bump `version` in `.claude-plugin/marketplace.json` and `plugins/planning/.claude-plugin/plugin.json` (currently 1.2.0 → suggest 1.3.0). The feature is complete and committed, but users won't get it via `/plugin update` until the version is bumped and pushed.
- Optional future: a heavier `--worktree` isolation mode was discussed and deliberately skipped (overkill for serial sessions).

## Resumption Context

Key files to review when picking this up:
- `plugins/planning/scripts/autopilot.sh` — the `ensure_branch()` helper and arg parsing
- `plugins/planning/skills/autopilot/SKILL.md` — the interactive step 3
- `.claude-plugin/marketplace.json` and `plugins/planning/.claude-plugin/plugin.json` — where the version bump goes
- `README.md` — the Autopilot section (options table + Branch behaviour)

Suggested opening prompt for next session:
> "Bump the planning plugin version to 1.3.0 in marketplace.json and plugin.json for the new autopilot --branch feature, then commit and push."
