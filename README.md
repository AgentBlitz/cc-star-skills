# cc-star-skills

A Claude Code plugin marketplace. Each plugin installs independently — adding the
marketplace only registers the catalogue; you enable the plugins you want.

| Plugin | What it gives you |
|--------|-------------------|
| `planning` | Multi-session build-planning skills (`/roadmap`, `/session`, `/wrapup`, `/handoff`, `/autopilot`). |
| `copilot` | A wizard (`/build-copilot`) that embeds a tool-calling AI copilot into a web app. |

## The `planning` plugin

| Skill       | What it does |
|-------------|--------------|
| `/roadmap`  | Turn a large goal (or spec docs, or an approved plan) into a phased, multi-session build plan where each session fits one fresh context window. Produces `.planning/<slug>/` with `PLAN.md`, `TRACKER.md`, and one kickoff prompt per session. |
| `/session`  | Execute the next pending session of a roadmap end to end — re-establish context, do the work, run the verification gate, write the session summary, update the tracker, commit, and surface the next kickoff prompt. |
| `/wrapup`   | Commit all changes and write a session summary to `.planning/sessions/` for context continuity across conversations. |
| `/handoff` | Like `/wrapup`, plus generate a ready-to-paste continuation prompt for a fresh Claude context (formerly `/next`). |
| `/autopilot` | Hand you the terminal command that runs every remaining roadmap session unattended — a fresh `claude` process per session — until the tracker is complete, a gate fails, or an iteration cap is hit. The loop itself is `scripts/autopilot.sh`, run outside Claude. |

The session-running skills share one session-summary format, defined in the `wrapup` skill.

**Which one?** `/wrapup` = save + commit · `/handoff` = same, plus a paste-ready
prompt to resume in a fresh chat · `/session` = advance a `/roadmap` plan by
exactly one phase (it includes its own wrapup) · `/autopilot` = loop `/session`
to the end of the roadmap without you.

### Autopilot

```bash
# from the target project root, in a normal terminal (not inside Claude):
bash <plugin-path>/scripts/autopilot.sh --plan .planning/<slug> [--model sonnet] [--max 5]
```

Run `/autopilot` inside Claude to get this command with the paths filled in —
the skill is interactive and walks you through the options below (model,
iteration cap, usage-check, permission mode, dry-run first) before printing the
final command. Each iteration launches `claude -p "/planning:session
<plan-dir>"` with a fresh context, then re-reads `TRACKER.md`: it stops cleanly
when no ⬜/🟡 rows remain, hard-stops on a ⛔ row (failed verification gate),
aborts after two consecutive runs that make no tracker progress, and honours
`--max N`.

#### All options

| Flag | Argument | Default | What it does |
|------|----------|---------|--------------|
| `--plan` | `.planning/<slug>` | auto-detect | Roadmap dir to run. If omitted, the script finds the single roadmap with pending rows; it errors if zero or several match, so pass this when you have more than one active roadmap. |
| `--max` | `N` | `0` (unlimited) | Stop after at most `N` iterations, even if sessions remain. Usage-limit waits don't count against `N`. |
| `--model` | `<model>` | session default | Model passed to each `claude` run (e.g. `sonnet` for mechanical roadmaps, `opus`/`fable` for hard ones). Omit to inherit your Claude Code default. |
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

**Subscription limits (always on, no flags).** If a run dies because the 5-hour
window is exhausted, the script sleeps until the reset time embedded in the
error (or `--backoff` if it can't be parsed) and retries the *same* session
without consuming an iteration. `--usage-check` layers a proactive check on top.

**Exit codes.** `0` = roadmap complete or `--max` reached · `2` = a ⛔ blocked
gate (autopilot refuses to start, or stops, on a failed verification gate) ·
`3` = stopped after two consecutive no-progress runs (a safety brake against
burning your subscription). Ctrl-C exits cleanly with a summary.

**Output.** Progress streams to stdout and `.planning/<slug>/autopilot/autopilot.log`;
per-run result JSON lands in `.planning/<slug>/autopilot/run-N.json`.

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

After installing `planning`, `/roadmap`, `/session`, `/wrapup`, `/handoff`, and
`/autopilot` are available in every project; installing `copilot` adds
`/build-copilot`.

## Updating

For the plugin you changed, bump `version` in **both** places that carry it —
its entry in `.claude-plugin/marketplace.json` and its own
`plugins/<plugin>/.claude-plugin/plugin.json` — keep them in sync, push, then
users run:

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
    │   ├── scripts/autopilot.sh
    │   └── skills/{roadmap,session,wrapup,handoff,autopilot}/SKILL.md
    └── copilot/
        ├── .claude-plugin/plugin.json
        └── skills/build-copilot/
            ├── SKILL.md
            └── reference/design-guide.md
```
