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

The four skills share one session-summary format, defined in the `wrapup` skill.

**Which one?** `/wrapup` = save + commit · `/handoff` = same, plus a paste-ready
prompt to resume in a fresh chat · `/session` = advance a `/roadmap` plan by
exactly one phase (it includes its own wrapup).

## Install

```text
/plugin marketplace add AgentBlitz/cc-star-skills
/plugin install planning@cc-star-skills
```

(For a private repo, use the full SSH/HTTPS URL or a local clone path instead of
the `owner/repo` shorthand, with git credentials configured via `gh auth login`
or `ssh-agent`.)

After installing, `/roadmap`, `/session`, `/wrapup`, and `/handoff` are available in
every project.

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
    └── skills/{roadmap,session,wrapup,next}/SKILL.md
```
