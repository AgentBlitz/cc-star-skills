---
name: autopilot
description: Set up an unattended loop that runs every remaining roadmap session back-to-back — one fresh claude process per session, each at its own model/effort profile — until the tracker is complete, a gate fails, a session needs a human, or an iteration cap is hit. Triggers on "run the whole roadmap", "autopilot", "loop the sessions", "run all remaining sessions unattended". Surfaces the exact terminal command; the loop itself runs outside Claude.
allowed-tools: [Read, Bash, Glob, Grep, AskUserQuestion]
argument-hint: "[plan-dir]"
---

# Autopilot — Run the Whole Roadmap Unattended

`/session` deliberately runs **one** session per invocation. Autopilot is the outer loop: a bash script (`${CLAUDE_PLUGIN_ROOT}/scripts/autopilot.sh`) the user runs **in their own terminal**, which repeatedly launches `claude -p "/planning:session <plan-dir>"` — a fresh context per session — until TRACKER.md has no ⬜/🟡 rows, a row goes ⛔, a session needs a human, or `--max` iterations run.

Each run uses **that session's runtime profile**: an explicit `--model` / `--effort` flag wins, else the `model:` / `effort:` frontmatter on its `prompts/session-N.md` (written by `/roadmap` and `/calibrate-roadmap`), else the user's Claude Code default. When a run makes no tracker progress the script **classifies it before retrying** — and only a genuine stall is escalated to more effort or a bigger model (see the table at the end).

A skill cannot outlive the `claude` process it runs in, so **never try to run the loop from inside this session**. Your job is to hand the user a ready-to-paste command.

## 1. Locate the roadmap

- `$ARGUMENTS` may give a plan-dir path — honour it.
- Otherwise Glob `.planning/*/TRACKER.md`; if several have pending (⬜/🟡) rows, use `AskUserQuestion` to pick one.
- If none exist, tell the user to run `/roadmap` first and stop.

## 2. Check readiness

The plugin ships `autopilot` as a `bin/` executable on the Bash tool's PATH, and a dry run is safe to execute **in this session** — it only reads the tracker and the next prompt. Run `autopilot --plan .planning/<slug> --dry-run` and relay: sessions done / pending / blocked, the next session, the **runtime it resolved** for that session (and whether it came from the frontmatter, a flag, or the default) and the **escalation ladder** it would climb on a stall.

- **A ⛔ row:** autopilot refuses to start. If the row says `Needs decision:`, relay the question — running `/session` answers it interactively (it asks the user, records the decision in PLAN.md, and carries on). Otherwise a gate failed and needs fixing first. Either way, stop here.
- **No profiles?** `grep -l '^model:' .planning/<slug>/prompts/session-*.md | wc -l` against the prompt count. If no session has one, mention that `/calibrate-roadmap` adds them — optional: without profiles every session simply runs at the flags / the default.

## 3. Ask about options interactively

Drive this with `AskUserQuestion` so the user picks options instead of reading flag docs. The tool takes at most 4 questions per call, so ask in **two batches**, skipping any question the user already pinned in `$ARGUMENTS` (if that empties a batch, skip the call):

**Batch 1 — how the sessions run:**

1. **Model** (`--model`) — options: *Per-session profiles* (recommended; omit the flag — each session uses the model in its own profile, or your Claude Code default where it has none), *sonnet*, *opus*, *fable*. A named model **overrides every session's profile** for this run; map it to `--model <x>`.
2. **Effort** (`--effort`) — options: *Per-session profiles* (recommended; omit the flag), *max* (deepest reasoning on every session), *high*, *low* (cheap mechanical runs). Map to `--effort <level>` (script validates `low|medium|high|xhigh|max`); like `--model`, it overrides every profile.
3. **Iteration cap** (`--max`) — options: *Unlimited* (recommended; run to completion, no flag), *3*, *5*, *10*. Map to `--max N`. Retries of a session (including escalated ones) count toward the cap; usage-limit waits don't.
4. **Branch** (`--branch`) — options: *Current branch* (default; no flag — commits land wherever the repo is now), *New autopilot branch* (recommended when the repo is on `main`/a shared branch — suggest something like `autopilot/<slug>` and pass `--branch <name>`, which autopilot checks out or creates from the current HEAD once before the loop). Check the current branch first via `git rev-parse --abbrev-ref HEAD`: if it's `main`/`master`, lead with the new-branch option; otherwise default to staying put. Unattended runs commit once per session, so a dedicated branch keeps them off `main`.

**Batch 2 — safety rails:**

5. **Escalation** (`--escalate`) — what happens when a session genuinely stalls. Options: *Effort, then model* (recommended; no flag — retry at the same model on `max` effort, then once on the next model up: `sonnet→opus→fable`), *Effort only* (`--escalate effort` — never switches model), *Off* (`--escalate off` — one identical retry, then stop).
6. **Usage guard** (`--usage-check`) — options: *Reactive only* (recommended; no flag — a limit-reached run sleeps until the reset in the error, then retries), *Proactive check* (adds `--usage-check --threshold 20`: checks the 5-hour window before each run and waits when < 20% remains; reads the user's own Claude Code OAuth token from macOS Keychain / `~/.claude/.credentials.json` and calls an undocumented endpoint, degrading to a warning if unavailable).
7. **First run** (`--dry-run`) — options: *Run for real* (recommended — you already dry-ran in step 2 and will again in step 4), *Dry run first* (the user's own command carries `--dry-run`).

Keep these advanced; only surface them if the user asks or the situation calls for it:

- `--permission-mode` — defaults to `bypassPermissions` because unattended runs cannot answer prompts. The user should only autopilot roadmaps whose sessions they trust. Offer `acceptEdits` etc. only if they want a tighter mode. **Deny rules and `PreToolUse` hooks still apply in every mode** — if one of theirs refuses commands the sessions need, the run will stop asking for a human (exit 4).
- `--threshold PCT` — the `--usage-check` cutoff (default 20). Only relevant once proactive checking is on.
- `--backoff DURATION` — sleep length (default `30m`; accepts `45s`/`30m`/`2h`) used only when a limit is hit with no parseable reset time.

## 4. Dry-run with the chosen flags, then surface the command

Run the dry run again via Bash with the flags assembled from step 3, e.g. `autopilot --plan .planning/<slug> --escalate effort --dry-run`, and relay the verdict (the resolved runtime, the ladder, the command it would run).

Then resolve the script's absolute path (it ships at `${CLAUDE_PLUGIN_ROOT}/scripts/autopilot.sh` — echo that env var via Bash to resolve it) and print the fully-populated command for the user's own terminal as a copy-pasteable block, e.g.:

```bash
bash <resolved-path>/autopilot.sh --plan .planning/<slug> --max 5 --branch autopilot/<slug> --usage-check
```

Only include flags the user actually chose — a run with all defaults is just `bash <resolved-path>/autopilot.sh --plan .planning/<slug>`. The user's command normally omits `--dry-run`; include it only if they chose to dry-run again themselves first.

Tell the user: run it from the project root in a normal terminal (not inside Claude); progress goes to stdout and `.planning/<slug>/autopilot/autopilot.log` (each line records the model, effort, attempt, rung and session id of the run); per-run JSON lands in `.planning/<slug>/autopilot/run-<launch>-<n>.json`; Ctrl-C exits cleanly with a summary. Exit codes:

- `0` — roadmap complete, or `--max` reached
- `2` — a ⛔ row: a failed gate, or a `Needs decision:` row (answer it with `/session`)
- `3` — the brake: the same environment failure twice, or the escalation ladder exhausted; the diagnosis lists every attempt and what to do
- `4` — a session needs a human: its final message asked for a decision or approval, or a hook stopped it. The log shows what was asked and a `claude -p --resume <session-id> "<answer>"` command that continues that session with its context intact.

## How the loop treats a run that made no tracker progress

Most no-progress runs are not the model's fault, so the script classifies each one from its result JSON before acting:

| Class | Evidence | Action |
|---|---|---|
| **needs-human** | the final message asks for something (a decision, an approval, a refused tool call), or `terminal_reason=hook_stopped` | stop, exit 4 — a costlier model would hit the same wall |
| **env** | error subtype, non-zero exit, ≤2 turns, or an environment error in the message | identical retry; twice in a row → exit 3 |
| **yielded** | ended at a tool call with no final message, or ended early / "I'll continue once it finishes" | identical retry with a reminder; a second yield counts as a stall |
| **stalled** | a long, successful-looking run that moved nothing | escalate one rung; ladder exhausted → exit 3 |

## Rules

- **Never launch the real loop from this session** — only `--dry-run` is safe in-session; surfacing the command is the deliverable.
- Always dry-run in-session before surfacing the command (steps 2 and 4).
- Remind the user that a ⛔ row stops the loop by design (a failed gate is a full stop, per `/session`) — and so does a session that needs them (exit 4): autopilot never guesses a decision and never retries its way past a refusal.
- If sessions keep escalating (`attempt=2`/`rung=2` lines in the log, `Runtime: … (autopilot attempt 2)` in the tracker), the profiles are too light — suggest `/calibrate-roadmap`, which reads that history.
- **Never archive a roadmap that autopilot is currently looping** — and once the loop finishes with a complete tracker, that's exactly the precondition `/archive-roadmap` wants, so mention it as the optional next step.
