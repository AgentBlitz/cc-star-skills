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

## 3. Ask about options interactively

Drive this with `AskUserQuestion` so the user picks options instead of reading flag docs. Ask in **one** `AskUserQuestion` call with these questions (skip any the user already pinned in `$ARGUMENTS`):

1. **Model** (`--model`) — options: *Session default* (recommended; omit the flag), *sonnet* (mechanical roadmaps), *opus* (hard reasoning), *fable*. Map the choice to `--model <x>`; "Session default" adds no flag.
2. **Iteration cap** (`--max`) — options: *Unlimited* (recommended; run to completion, no flag), *3*, *5*, *10*. Map to `--max N`.
2b. **Branch** (`--branch`) — options: *Current branch* (default; no flag — commits land wherever the repo is now), *New autopilot branch* (recommended when the repo is on `main`/a shared branch — suggest something like `autopilot/<slug>` and pass `--branch <name>`, which autopilot checks out or creates from the current HEAD once before the loop). Check the current branch first via `git rev-parse --abbrev-ref HEAD`: if it's `main`/`master`, lead with the new-branch option; otherwise default to staying put. Unattended runs commit once per session, so a dedicated branch keeps them off `main`.
3. **Usage guard** (`--usage-check`) — options: *Reactive only* (recommended; no flag — a limit-reached run sleeps until the reset in the error, then retries), *Proactive check* (adds `--usage-check --threshold 20`: checks the 5-hour window before each run and waits when < 20% remains; reads the user's own Claude Code OAuth token from macOS Keychain / `~/.claude/.credentials.json` and calls an undocumented endpoint, degrading to a warning if unavailable).
4. **First run** (`--dry-run`) — options: *Dry run first* (recommended for a new roadmap; prints the verdict and exact command without running), *Run for real* (no flag).

Keep these advanced; only surface them if the user asks or the situation calls for it:

- `--permission-mode` — defaults to `bypassPermissions` because unattended runs cannot answer prompts. The user should only autopilot roadmaps whose sessions they trust. Offer `acceptEdits` etc. only if they want a tighter mode.
- `--threshold PCT` — the `--usage-check` cutoff (default 20). Only relevant once proactive checking is on.
- `--backoff DURATION` — sleep length (default `30m`; accepts `45s`/`30m`/`2h`) used only when a limit is hit with no parseable reset time.

## 4. Surface the command

Resolve the script's absolute path (it ships with this plugin at `${CLAUDE_PLUGIN_ROOT}/scripts/autopilot.sh` — echo that env var via Bash to resolve it). Assemble the flags from the answers in step 3 and print the fully-populated command as a copy-pasteable block, e.g.:

```bash
bash <resolved-path>/autopilot.sh --plan .planning/<slug> --model sonnet --max 5 --branch autopilot/<slug> --usage-check --dry-run
```

Only include flags the user actually chose — a run with all defaults is just `bash <resolved-path>/autopilot.sh --plan .planning/<slug>`. If the user chose a dry run, add a note that once the verdict looks right they re-run the same command **without** `--dry-run` to go live.

Tell the user: run it from the project root in a normal terminal (not inside Claude); progress goes to stdout and `.planning/<slug>/autopilot/autopilot.log`, per-run JSON to `.planning/<slug>/autopilot/run-N.json`; Ctrl-C exits cleanly with a summary; exit codes — 0 complete/cap reached, 2 blocked gate, 3 stopped after two no-progress runs.

## Rules

- **Never launch the loop from this session** — surfacing the command is the deliverable.
- Recommend `--dry-run` first for a new roadmap.
- Remind the user that a ⛔ row stops the loop by design (a failed gate is a full stop, per `/session`).
