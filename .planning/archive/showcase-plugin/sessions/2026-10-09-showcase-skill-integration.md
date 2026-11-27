# Session: showcase S11 — the /showcase skill, references, evals and docs

**Date:** 2026-10-09
**Branch:** main
**Roadmap:** `.planning/showcase-plugin`
**Runtime:** `opus/high (autopilot attempt 1)`

## Summary

Ran Session 11 of the showcase roadmap headless under autopilot. Wrote the `/showcase` wizard (`SKILL.md`: routing by subcommand, phases P0–P11 each naming its reference doc, the headless "print the round and stop" rule, the Rules), finished `interview.md` (explorer briefs and report shapes, headless format), wrote `determinism.md` and `roadmap-brief.md`, reconciled `voice.md`, `film.md` and `tour-format.md` with what was built, and added `templates/BRIEF.md` with a new `showcase brief [--check]` command that regenerates two marked blocks (tours, app) and keeps everything else. Added four `claude plugin eval` cases and an `evals/run.sh` wrapper, wired the plugin into the marketplace (0.9.0) and README, and rebuilt the runtime bundle for the version bump. Every gate passed: validate (plugin and marketplace), evals green (with-plugin 1.00 on all four, $0.50), the headless `/showcase:showcase doctor` from a fixture copy with the skill's base directory in the transcript, `npm test` 237/237 and typecheck. `claude plugin details` reports ~132 always-on tokens, but an A/B shows it ignores `disable-model-invocation`; a direct listing check confirms the skill isn't in the model's listing.

## Changes

- `plugins/showcase/skills/showcase/SKILL.md` — new: the wizard (frontmatter with `disable-model-invocation: true`, `$ARGUMENTS` routing, P0–P11, Rules, `${CLAUDE_PLUGIN_ROOT}/bin/showcase` fallback).
- `plugins/showcase/skills/showcase/reference/interview.md` — finished: rounds unchanged, explorer briefs + report shapes, the 15-line summary, answer → file map, `defaults.json`, skip rules (afterwards as an argument), headless print format.
- `plugins/showcase/skills/showcase/reference/determinism.md` — new: take lifecycle, levers, data, randomness/time, live AI, fonts, sign-in, host behaviours, privacy, checklist.
- `plugins/showcase/skills/showcase/reference/roadmap-brief.md` — new: when P5 hands off, `showcase brief`, what each BRIEF section holds, checkpoint protocol, CLI + `showcase docs` in roadmap sessions.
- `plugins/showcase/skills/showcase/reference/voice.md` — Keys section (file, precedence, commands, Claude's rules) and Cost section.
- `plugins/showcase/skills/showcase/reference/film.md` — `--in-app`, determinism prerequisite, foreground polling of `--detach`.
- `plugins/showcase/skills/showcase/reference/tour-format.md` — storyboard `--stills` / `--html`.
- `plugins/showcase/skills/showcase/templates/BRIEF.md` — new: the roadmap brief template with `tours` and `app` generated blocks.
- `plugins/showcase/toolkit/lib/brief.ts` — new: brief state (tours, voice status via `plan()`, renders, config levers) and `applyBlocks`.
- `plugins/showcase/toolkit/commands/brief.ts` — new: `showcase brief [--check] [--json]`.
- `plugins/showcase/toolkit/cli.ts` — registers `brief`.
- `plugins/showcase/toolkit/test/brief.test.ts` — new: 4 tests (refusal, template + idempotence + canary, kept sections + refresh, missing markers).
- `plugins/showcase/toolkit/runtime/dist/showcase-runtime.{iife.js,mjs}` — rebuilt; they stamp the plugin version.
- `plugins/showcase/evals/{keys-status-canary,headless-round-1,storyboard-file,brief-file}/case.yaml` — new eval cases.
- `plugins/showcase/evals/run.sh` — new: stages a copy without the `planning` dependency, puts its `bin/` on PATH, runs `claude plugin eval` with `--no-publish --trust-plugin --allow-tools Bash`, copies results back.
- `plugins/showcase/.claude-plugin/plugin.json` — 0.9.0, final description.
- `.claude-plugin/marketplace.json` — showcase entry (0.9.0, MIT), top-level description extended.
- `README.md` — overview row, `## The showcase plugin` section, install/update lines, Layout tree, "Developing the showcase plugin".
- `.gitignore` — adds `plugins/showcase/evals/results/` (Session 1's lines unchanged).
- `.planning/showcase-plugin/PLAN.md` — status line; as-built notes on `brief`, evals, `plugin details` and the argument grammar.
- `.planning/showcase-plugin/TRACKER.md` — row 11 ✅, session-log entry.

## Decisions & Rationale

- Evals run through `evals/run.sh` → in claude 2.1.285 eval runs get a sealed HOME, so `dependencies: ["planning"]` (D12) is unsatisfiable and the plugin isn't loaded, and `bin/` isn't on PATH; staging a copy keeps D12 intact while still testing the same skill and CLI. `--no-publish` keeps the report from being published to claude.ai.
- The canary goes through `EVAL_CANARY_KEY` → case `env` only accepts `EVAL_*` names.
- `brief` regenerates only marked blocks → the interview's answers aren't stored where the CLI can read them, and adding a new footprint file would change §2.10; the skill writes the prose sections and `brief` preserves them.
- `plugin details` gate judged met by substitute evidence → the tool reports identical cost with and without the flag on a control skill, while a direct listing check shows the flagged skill absent.
- "Afterwards" accepted as an argument → otherwise no arguments could settle Round 1 and the headless hint would be misleading.

## Remaining Work

- Session 12 (P1, Star I: the film and live demo) is by hand, run from Star — it can't run under autopilot.
- `OPENROUTER_API_KEY` is still not in the user key file; Session 12's audition and final voice need it.
- Push and the v1.0.0 tag wait for Session 13 and the user's go.

## Resumption Context

Key files to review when picking this up:
- `.planning/showcase-plugin/PLAN.md` (§2.7–§2.10, §5 Session 12)
- `.planning/showcase-plugin/prompts/session-12.md`
- `plugins/showcase/skills/showcase/SKILL.md`
- `plugins/showcase/skills/showcase/reference/{interview,determinism,roadmap-brief}.md`

Suggested opening prompt for next session:
> "cd ~/_PRJ/star && claude --plugin-dir ~/_PRJ/cc-star-skills/plugins/showcase --add-dir ~/_PRJ/cc-star-skills, then run /session ~/_PRJ/cc-star-skills/.planning/showcase-plugin for Session 12 (Star I: the film and live demo, by hand)."
