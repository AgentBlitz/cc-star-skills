# cc-star-skills

A Claude Code plugin marketplace. Each plugin installs independently — adding the
marketplace only registers the catalogue; you enable the plugins you want.

| Plugin | What it gives you |
|--------|-------------------|
| `planning` | Multi-session build-planning skills (`/roadmap`, `/calibrate-roadmap`, `/session`, `/wrapup`, `/handoff`, `/autopilot`, `/archive-roadmap`). |
| `copilot` | A wizard (`/build-copilot`) that embeds a tool-calling AI copilot into a web app. |

## The `planning` plugin

| Skill       | What it does |
|-------------|--------------|
| `/roadmap`  | Turn a large goal (or spec docs, or an approved plan) into a phased, multi-session build plan where each session fits one fresh context window. Produces `.planning/<slug>/` with `PLAN.md`, `TRACKER.md`, and one kickoff prompt per session. A second pass rates every session and records its model/effort runtime profile. |
| `/calibrate-roadmap` | Rate each pending session — which model (`sonnet`/`opus`/`fable`) and how much effort — and write that profile into `PLAN.md` and the kickoff prompts. Runs inside `/roadmap`; run it on its own to retrofit an older roadmap, or to re-rate one after sessions blocked or had to be escalated. |
| `/session`  | Execute the next pending session of a roadmap end to end — re-establish context, do the work, run the verification gate, write the session summary, update the tracker, commit, and surface the next kickoff prompt. |
| `/wrapup`   | Commit all changes and write a session summary to `.planning/sessions/` for context continuity across conversations. |
| `/handoff` | Like `/wrapup`, plus generate a ready-to-paste continuation prompt for a fresh Claude context (formerly `/next`). |
| `/autopilot` | Hand you the terminal command that runs every remaining roadmap session unattended — a fresh `claude` process per session, each at its own model/effort profile — until the tracker is complete, a gate fails, a session needs a human, or an iteration cap is hit. The loop itself is `scripts/autopilot.sh`, run outside Claude. |
| `/archive-roadmap` | Retire a finished roadmap — move `.planning/<slug>/` and its session logs into `.planning/archive/<slug>/`, write a one-page `DIGEST.md` of what was built, and commit the move. Archived roadmaps stop costing context in every later session. |

The session-running skills share one session-summary format, defined in the `wrapup` skill.

**Which one?** `/wrapup` = save + commit · `/handoff` = same, plus a paste-ready
prompt to resume in a fresh chat · `/session` = advance a `/roadmap` plan by
exactly one phase (it includes its own wrapup) · `/autopilot` = loop `/session`
to the end of the roadmap without you · `/calibrate-roadmap` = (re-)rate each
session's model and effort · `/archive-roadmap` = retire the roadmap
once it's done.

### Autopilot

```bash
# from the target project root, in a normal terminal (not inside Claude):
bash <plugin-path>/scripts/autopilot.sh --plan .planning/<slug> [--max 5] [--escalate effort]
# each session runs at its own model/effort profile; --model / --effort override them all
```

Run `/autopilot` inside Claude to get this command with the paths filled in —
the skill is interactive and walks you through the options below (model,
effort, escalation, iteration cap, branch, usage-check, dry-run first), runs a safe
`--dry-run` in-session (the plugin ships `autopilot` as a `bin/` executable on
the Bash tool's PATH) to show you the verdict, then prints the final command. Each iteration launches `claude -p "/planning:session
<plan-dir>"` with a fresh context, then re-reads `TRACKER.md`: it stops cleanly
when no ⬜/🟡 rows remain, hard-stops on a ⛔ row (failed verification gate),
classifies any run that makes no tracker progress before retrying it — see
[Runtime profiles, failure classes & escalation](#runtime-profiles-failure-classes--escalation)
— and honours `--max N`.

#### All options

| Flag | Argument | Default | What it does |
|------|----------|---------|--------------|
| `--plan` | `.planning/<slug>` | auto-detect | Roadmap dir to run. If omitted, the script finds the single roadmap with pending rows; it errors if zero or several match, so pass this when you have more than one active roadmap. |
| `--max` | `N` | `0` (unlimited) | Stop after at most `N` iterations, even if sessions remain. Usage-limit waits don't count against `N`. |
| `--model` | `<model>` | per-session profile, else your default | Model for **every** `claude` run, overriding the sessions' own profiles (e.g. `sonnet` to force a cheap run). Omit it and each session uses the `model:` in its kickoff prompt's frontmatter, or your Claude Code default where it has none. |
| `--effort` | `low`\|`medium`\|`high`\|`xhigh`\|`max` | per-session profile, else the model's default | Reasoning effort for **every** run, overriding the sessions' own profiles. Omit it and each session uses the `effort:` in its frontmatter. Validated up front; an unknown level refuses to start. |
| `--escalate` | `off`\|`effort`\|`model` | `model` | What to do when a session **genuinely stalls** (a long run that moves nothing): `model` retries at the same model on `max` effort, then once on the next model up; `effort` stops after the effort rung; `off` retries identically once, as before. Other kinds of no-progress run are never escalated — see [below](#runtime-profiles-failure-classes--escalation). |
| `--branch` | `<name>` | current branch | Check out `<name>` (creating it from the current HEAD if it doesn't exist) **once** before the loop, so an unattended run's commits land there instead of piling onto whatever you're on. Omit to stay on the current branch. See [Branch behaviour](#branch-behaviour). |
| `--usage-check` | *(flag)* | off | Opt-in **proactive** check of the 5-hour subscription window *before* each run; sleeps until reset when low. Reads your own Claude Code OAuth token (macOS Keychain, then `~/.claude/.credentials.json`) and calls an undocumented endpoint. Degrades to a warning if unavailable. |
| `--threshold` | `PCT` | `20` | With `--usage-check`, the minimum % of the window that must remain before a run starts. Below it, autopilot waits for the reset (or backs off). No effect without `--usage-check`. |
| `--backoff` | `DURATION` | `30m` | Sleep length when a usage limit is hit but no reset time can be parsed from the error. Accepts `45s` / `30m` / `2h`, or a bare number meaning minutes. |
| `--permission-mode` | `MODE` | `bypassPermissions` | Permission mode for each `claude` run. Defaults to `bypassPermissions` because unattended runs can't answer prompts — so only autopilot roadmaps you trust. Pass e.g. `acceptEdits` for a more restrictive mode. |
| `--dry-run` | *(flag)* | off | Print the tracker verdict, the next pending row, and the exact `claude` command that *would* run — without running anything. Recommended for a first look at a new roadmap. |
| `-h`, `--help` | *(flag)* | — | Print usage and exit. |

#### Branch behaviour

By default autopilot performs **no branch management** — it never checks out,
creates, or pushes a branch. Each session ends with one local commit (session
summary + updated tracker + the work), landing on **whatever branch is checked
out when you launch autopilot**. Start it on `main` and the commits go to `main`;
start it on a feature branch and they go there. Nothing is pushed — commits stay
local until you push.

For an unattended multi-session run you usually don't want commits piling
straight onto `main`. Pass `--branch <name>` (e.g. `--branch autopilot/<slug>`)
and autopilot checks that branch out — creating it from the current HEAD if
needed — once, before the loop; every session then commits onto it. If the
branch already exists it's switched to; a switch that would conflict with
uncommitted changes stops the run with a clear error, so commit or stash first.
The `/autopilot` skill offers this as a choice and defaults to a new branch when
it sees you're on `main`.

#### Runtime profiles, failure classes & escalation

**Per-session runtime.** `/roadmap` rates every session in a second pass
(`/calibrate-roadmap` — also runnable on its own, to retrofit or re-rate a
roadmap) and records the result twice: a `**Runtime:** opus / high — why` line
in `PLAN.md` §5, and YAML frontmatter at the top of the session's kickoff prompt:

```markdown
---
model: opus
effort: high
rationale: cross-cutting refactor across three modules with a manual gate
---
Paste everything below into a fresh Claude Code session …
```

Autopilot resolves each run's runtime in this order: an explicit `--model` /
`--effort` flag → that frontmatter → your Claude Code default. So a plain
`autopilot.sh --plan …` runs the mechanical sessions on `sonnet` and the hard
ones on `opus`/`fable`, while `--model sonnet` still forces a whole run.
Roadmaps without frontmatter run exactly as before, and `TRACKER.md`'s table is
deliberately untouched — its status emoji are the machine contract.

**A run that makes no tracker progress is classified before anything is
retried**, because most such runs are not the model's fault and a costlier model
would hit the same wall. (In 42 logged runs of one real roadmap, 8 made no
progress — every one reported `exit=0 is_error=false`.) The class comes from the
run's own result JSON:

| Class | Evidence | What autopilot does |
|-------|----------|---------------------|
| **needs-human** | The final message asks you for something — a decision, an approval, or it reports a tool call refused by a hook or permission rule — or a hook stopped the run outright (`terminal_reason=hook_stopped`). | Stop, **exit 4**. Prints what was asked and a `claude -p --resume <session-id> "<answer>"` command that continues the session with its context intact. |
| **env** | Error subtype, non-zero exit, ≤2 turns, or an environment error in the final message (`command not found`, Docker down, auth…). | Identical retry; twice in a row → **exit 3** ("fix the environment, not the model"). |
| **yielded** | The run ended at a tool call with no final message, or ended early / saying it will continue "once X finishes" — it handed off to background work, which a headless process never wakes from. | Identical retry with a reminder; a second yield in a row counts as a stall. |
| **stalled** | A long, successful-looking run that moved nothing. | **Escalate one rung.** |

The ladder (`--escalate model`, the default): the session's own runtime → the
same model at `max` effort → the next model up (`haiku→sonnet→opus→fable`) at
`max` → exit 3 with a diagnosis — each attempt's runtime and class, a "started
but never finished: split it" hint when the row went ⬜→🟡, the uncommitted-file
count, and a `--resume` command. `--escalate effort` stops after the effort
rung; `--escalate off` never changes the flags. Escalation retries count toward
`--max`; usage-limit waits don't.

Two behaviours worth knowing, verified against claude 2.1.269. `AskUserQuestion`
is not offered to a headless run at all, so a question arrives as text in the
final message. And **deny rules and `PreToolUse` hooks still apply under
`bypassPermissions`**: a hook that answers `deny`/`ask` lets the run carry on
(the refusal is listed in the result's `permission_denials`), while
`continue:false` stops it cold. Every autopilot run therefore carries a short
headless note in its system prompt — never end your turn to wait for background
work; don't ask, mark the row ⛔ `Needs decision: <question — options>` and
stop; record the `Runtime:` you ran at — and `/session` answers a
`Needs decision:` row interactively: it asks you, records the decision in
`PLAN.md`, and carries on. Those `Runtime:` lines in the tracker are what
`/calibrate-roadmap` reads when it re-rates a roadmap.

**Subscription limits (always on, no flags).** If a run dies because the 5-hour
window is exhausted, the script sleeps until the reset time embedded in the
error (or `--backoff` if it can't be parsed) and retries the *same* session
without consuming an iteration. `--usage-check` layers a proactive check on top.

**Transient errors (always on, no flags).** Each `claude` run is launched with
`CLAUDE_CODE_RETRY_WATCHDOG=1`, Claude Code's unattended-session mode: transient
API failures (network blips, 5xx, overloaded) are retried with backoff inside
the run — up to 300 attempts — instead of dying at the default ~15-retry cap, so
an overnight run survives a bad patch of API weather. Only failed requests are
resent; completed work is never re-run, and usage-limit errors stay with the
sleep-until-reset handling above.

**Exit codes.** `0` = roadmap complete or `--max` reached · `2` = a ⛔ row
(autopilot refuses to start, or stops, on a failed verification gate or a
`Needs decision:` row) · `3` = the brake — the same environment failure twice,
or the escalation ladder exhausted (it never burns your subscription on blind
retries) · `4` = a session needs a human (it asked for a decision or approval,
or a hook stopped it). Ctrl-C exits cleanly with a summary.

**Output.** Progress streams to stdout and `.planning/<slug>/autopilot/autopilot.log`;
per-run result JSON lands in `.planning/<slug>/autopilot/run-<launch>-<n>.json`
(one set per launch, so an earlier launch's evidence is never overwritten). Each
log line records the run's model, effort, attempt, ladder rung, stop reason,
turn count, the model actually used and its session id.

### Archiving finished roadmaps

`.planning/` only grows. A finished roadmap's `PLAN.md`, `TRACKER.md` and 50-odd
kickoff prompts stay in the active tree forever, `.planning/sessions/` fills up
with flat session logs, and every `/session` and `/autopilot` run keeps
re-discovering dead roadmaps. `/archive-roadmap` retires one:

```text
/archive-roadmap                    # pick from the roadmaps it finds
/archive-roadmap .planning/<slug>   # or name one
/archive-roadmap .planning/<slug> force   # archive even with pending/blocked rows
```

It moves the plan dir to `.planning/archive/<slug>/`, sweeps that roadmap's
session logs into `.planning/archive/<slug>/sessions/`, writes a one-page
`DIGEST.md` (what was built, key decisions, gate results, the final file map,
and anything left unfinished), and commits the move with `git mv` so history
follows the files. It always prints the full manifest for you to confirm
*before* anything moves.

**Why `.planning/archive/` and not a flag.** Roadmap discovery is a **depth-1
glob** — `.planning/*/TRACKER.md`, in `/session`, `/autopilot` and
`autopilot.sh` alike. A roadmap at `.planning/archive/<slug>/TRACKER.md` sits
one level too deep to match, so it disappears from all three at once with no
exclusion logic anywhere. Don't "fix" that glob to recurse — it's load-bearing.

Session logs are attributed by their `**Roadmap:**` header field (written by
`/session`), by the plan-dir paths in their `## Changes` section, and by the
roadmap's git date window — the last of which is what catches `/wrapup` logs
that never name a tracker. Logs that also belong to a still-live roadmap are
left where they are.

Archiving is one-way: there's no restore flag, because reversing it is a
`git mv` back, and the digest's "Where everything went" section spells it out.

**One sharp edge worth knowing.** `.gitignore` rules are usually path-anchored
(`/.planning/<slug>/art/*/*.webp`), so anything deliberately ignored inside a
plan dir stops being ignored once the dir moves under `.planning/archive/`. The
skill reports those files and never stages them — but it also means an archive
directory can hold files git has no copy of. Reverse an archive with `git mv`,
never by deleting the archive directory: `git reset --hard` will not bring
ignored files back.

## The `copilot` plugin

| Skill | What it does |
|-------|--------------|
| `/build-copilot` | Interactive wizard that embeds a context-aware, tool-calling AI copilot into an existing web app — a chat drawer backed by an OpenAI-compatible LLM proxy, READ/HELP/PROPOSE tools, help-corpus search, and SSE streaming. It reads the target codebase, confirms the per-app decisions (which entities become tools, which draft-write actions to allow, help corpus, terminology), then scaffolds the implementation step by step. |

Run `/build-copilot` **inside the app repo you want the copilot to live in** (not
this marketplace). The skill bundles a portable [design guide](plugins/copilot/skills/build-copilot/reference/design-guide.md)
as its source of truth and adapts it to your stack — backend framework, frontend
router, ORM, auth, and settings UI are all discovered, not assumed. The LLM
endpoint (LM Studio / vLLM / cloud) is a runtime setting configured in the admin
panel the wizard builds, so no provider is hardcoded.

## Install

```text
/plugin marketplace add AgentBlitz/cc-star-skills
/plugin install planning@cc-star-skills
/plugin install copilot@cc-star-skills
```

Each plugin installs independently — take one, both, or neither. Adding the
marketplace by itself installs nothing.

(For a private repo, use the full SSH/HTTPS URL or a local clone path instead of
the `owner/repo` shorthand, with git credentials configured via `gh auth login`
or `ssh-agent`.)

After installing `planning`, `/roadmap`, `/calibrate-roadmap`, `/session`,
`/wrapup`, `/handoff`, `/autopilot`, and `/archive-roadmap` are available in every project; installing
`copilot` adds `/build-copilot`.

## Updating

For the plugin you changed, bump `version` in **both** places that carry it —
its entry in `.claude-plugin/marketplace.json` and its own
`plugins/<plugin>/.claude-plugin/plugin.json` — keep them in sync. Then run
`claude plugin tag` from the repo root to cut a release git tag (it validates
the version first), push, and users run:

```text
/plugin update planning@cc-star-skills
/plugin update copilot@cc-star-skills
```

## Layout

```
cc-star-skills/
├── .claude-plugin/marketplace.json
└── plugins/
    ├── planning/
    │   ├── .claude-plugin/plugin.json
    │   ├── bin/autopilot          # bare-command wrapper for the Bash tool
    │   ├── scripts/autopilot.sh
    │   └── skills/{roadmap,calibrate-roadmap,session,wrapup,handoff,autopilot,archive-roadmap}/SKILL.md
    └── copilot/
        ├── .claude-plugin/plugin.json
        └── skills/build-copilot/
            ├── SKILL.md
            └── reference/design-guide.md
```
