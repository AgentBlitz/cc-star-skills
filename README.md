# cc-star-skills

A Claude Code plugin marketplace bundling a set of multi-session build-planning
skills.

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

Run `/autopilot` inside Claude to get this command with the paths filled in.
Each iteration launches `claude -p "/planning:session <plan-dir>"` with a fresh
context, then re-reads `TRACKER.md`: it stops cleanly when no ⬜/🟡 rows remain,
hard-stops on a ⛔ row (failed verification gate), aborts after two consecutive
runs that make no tracker progress, and honours `--max N`. Runs use
`--permission-mode bypassPermissions` by default (unattended runs can't answer
prompts), so only autopilot roadmaps you trust.

Subscription limits: if a run dies because the 5-hour window is exhausted, the
script sleeps until the reset time in the error (or `--backoff`, default 30m)
and retries. Opt-in `--usage-check --threshold 20` also checks remaining window
*before* each run — it reads your own Claude Code OAuth token (Keychain /
`~/.claude/.credentials.json`) and calls an undocumented endpoint, degrading to
a warning if that ever breaks. Logs land in `.planning/<slug>/autopilot/`.

## Install

```text
/plugin marketplace add AgentBlitz/cc-star-skills
/plugin install planning@cc-star-skills
```

(For a private repo, use the full SSH/HTTPS URL or a local clone path instead of
the `owner/repo` shorthand, with git credentials configured via `gh auth login`
or `ssh-agent`.)

After installing, `/roadmap`, `/session`, `/wrapup`, `/handoff`, and `/autopilot`
are available in every project.

## Updating

Bump `version` in `.claude-plugin/marketplace.json` and
`plugins/planning/.claude-plugin/plugin.json`, push, then users run:

```text
/plugin update planning@cc-star-skills
```

## Layout

```
cc-star-skills/
├── .claude-plugin/marketplace.json
└── plugins/planning/
    ├── .claude-plugin/plugin.json
    ├── scripts/autopilot.sh
    └── skills/{roadmap,session,wrapup,handoff,autopilot}/SKILL.md
```
