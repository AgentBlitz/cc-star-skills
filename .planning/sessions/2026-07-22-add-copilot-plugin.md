# Session: Add the `copilot` plugin (`/build-copilot` wizard)

**Date:** 2026-07-22
**Branch:** main

> Do **not** include a "Commit:" field. The session file *is* the commit it ships in — `git log <session-file>` recovers the hash. Embedding the hash creates an amend loop because the file references its own commit.

## Summary

Added a second plugin to the `cc-star-skills` marketplace: **`copilot`**, containing one
interactive skill **`/build-copilot`**. The skill is a build wizard that embeds a
context-aware, tool-calling AI copilot (chat drawer, OpenAI-compatible LLM proxy,
READ/HELP/PROPOSE tools, help-corpus/BM25 search, SSE streaming) into an existing web
app. Its source of truth is a portable design guide (`/Users/kstar/_Dev/nexusos/docs/copilot-design-guide.md`)
copied verbatim into the skill as a bundled reference so the skill is self-contained. The
wizard reads the guide first, discovers the target app's stack, confirms per-app decisions
via AskUserQuestion, then scaffolds the guide's 9-step §12 adaptation checklist in order.
Also answered the user's toggling question: marketplace on/off granularity is the **plugin**,
not the individual skill — which is why this shipped as its own plugin rather than a 6th
skill inside `planning`, so it installs/disables independently.

## Changes

- `plugins/copilot/.claude-plugin/plugin.json` — new plugin manifest, `name: copilot`, `version: 1.0.0`, mirrors the `planning` plugin's field shape (author/homepage/repository/keywords).
- `plugins/copilot/skills/build-copilot/SKILL.md` — new wizard skill. Frontmatter (`name`, trigger-phrase-rich `description`, `allowed-tools: [Read, Write, Edit, Glob, Grep, Bash, Agent, AskUserQuestion]`, `user-invocable: true`). Body: phase 0 load guide + confirm target repo, phase 1 discover stack, phase 2 confirm decisions, phase 3 scaffold the 9 checklist steps (each citing guide §), phase 4 verify. References the bundled guide via `${CLAUDE_PLUGIN_ROOT}/skills/build-copilot/reference/design-guide.md`.
- `plugins/copilot/skills/build-copilot/reference/design-guide.md` — verbatim copy (375 lines) of the NexusOS copilot design guide; the skill's source of truth.
- `.claude-plugin/marketplace.json` — added a second `plugins[]` entry registering `copilot` (source `./plugins/copilot`, v1.0.0).
- `README.md` — new top-level plugin overview table; a `## The copilot plugin` section; added `/plugin install copilot@cc-star-skills` to Install with a note that plugins install independently; generalized the Updating section to cover both plugins and the two-place version sync; expanded the Layout tree to show `plugins/{planning,copilot}/`.

## Decisions & Rationale

- **New standalone plugin, not a 6th skill in `planning`** → user asked whether skills can be toggled individually. Marketplace toggle granularity is per-plugin (skills inside a plugin are a bundle), so an independent plugin is the only way to enable/disable the copilot skill on its own. User confirmed this choice.
- **Interactive build wizard, not a passive reference skill** → user confirmed. The skill actively drives implementation against a target repo rather than just surfacing the doc.
- **Bundle the design guide verbatim into the skill** → keeps the skill self-contained; it must not depend on the external `nexusos` repo at runtime. The guide is already written stack-agnostic ("treat concrete names as examples") so it ported as-is.
- **SKILL.md is orchestration only; specifics deferred to the guide by section number** → avoids duplicating 375 lines and keeps the load-bearing contracts (SSE parser §2.2, tool loop §6.3, persistence §11) in one place the wizard re-reads.

## Remaining Work

- **Not committed yet** — this `/wrapup` invocation performs the commit.
- The bundled `design-guide.md` is a point-in-time copy; if the source in `nexusos` changes, re-copy it (no automation links them).
- Untested in a live install: `/plugin install copilot@cc-star-skills` and `/build-copilot` invocation should be smoke-tested in an interactive Claude Code session against the marketplace.
- Optional future: a matching `session`-style test or a sample target-app walkthrough.

## Resumption Context

Key files to review when picking this up:
- `plugins/copilot/skills/build-copilot/SKILL.md` — the wizard logic.
- `plugins/copilot/skills/build-copilot/reference/design-guide.md` — the design spec it adapts.
- `.claude-plugin/marketplace.json` — plugin registration + version.
- `README.md` — user-facing install/usage docs.
- `plugins/planning/skills/*/SKILL.md` — the convention templates this skill followed.

Suggested opening prompt for next session:
> "Smoke-test the new copilot plugin: verify `/plugin install copilot@cc-star-skills` resolves and `/build-copilot` is invocable, then dry-run the wizard against a sample web-app repo to check the discovery → decisions → scaffold flow reads well."
