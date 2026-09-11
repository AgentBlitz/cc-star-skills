# Session: `/archive-roadmap` skill + planning plugin v1.5.0

**Date:** 2026-09-11
**Branch:** main

## Summary

Added a sixth skill to the `planning` plugin — `/archive-roadmap` — which retires a finished roadmap by moving `.planning/<slug>/` and its attributable session logs into `.planning/archive/<slug>/`, writing a one-page `DIGEST.md`, and committing the move with `git mv` so history follows the files. The design hinges on one existing invariant: roadmap discovery in `/session`, `/autopilot` and `autopilot.sh` is a **depth-1 glob** (`.planning/*/TRACKER.md`), so a roadmap one level deeper at `.planning/archive/<slug>/TRACKER.md` vanishes from all three at once with zero exclusion logic. To make session-log attribution reliable, a conditional `**Roadmap:**` header field was added to the shared session-summary template in the `wrapup` skill and made mandatory in `/session`. Cross-references were threaded through `roadmap`, `session` and `autopilot`, the README gained an "Archiving finished roadmaps" section, and both plugin JSONs were bumped to **v1.5.0**.

## Changes

- `plugins/planning/skills/archive-roadmap/SKILL.md` — **New** (263 lines). Seven-step skill: (1) locate the roadmap + run pre-move guards (refuse a plan dir named `archive`/`sessions`; refuse mid-merge/rebase; warn if autopilot looks live via `autopilot.log` mtime or `pgrep -f autopilot.sh`; stop if `<plan-dir>/sessions/` exists; detect ignored files; resolve a destination collision with the `wrapup` `-2`/`-3` convention; degrade to plain `mv` with no commit when `.planning` is gitignored or this isn't a repo). (2) Attribute session logs into Excluded / Certain / Likely / Shared tiers — `**Roadmap:**` field authoritative in both directions and checked **first**, `## Changes`-scoped grep, and a git date window (`git log --format=%ad --date=short` first/last touch) as the only signal that catches `/wrapup` logs. (3) Print the full manifest, then one `AskUserQuestion` (Certain only / Certain + Likely / plan dir only / adjust). (4) Gather digest material by `awk`/`grep` extraction only — **never `Read` a session log** — with a ~60 KB / 20-log fan-out threshold to `Agent` batches. (5) `mkdir -p <archive>` (parent only), `git mv` the plan dir **wholesale**, then create `sessions/` and move logs. (6) Write `DIGEST.md` opening with a fixed status blockquote, commit with an **explicit pathspec covering both old and new paths**. (7) Report.
- `plugins/planning/skills/wrapup/SKILL.md` — Session-summary template gains a conditional `**Roadmap:** \`.planning/<slug>\`` header line, plus a Rules entry explaining it is include-only-when-real (inventing a slug is worse than omitting it) and that it is what lets `/archive-roadmap` attribute the log.
- `plugins/planning/skills/session/SKILL.md` — Step 4a now requires the `**Roadmap:**` field (the plan dir is known with certainty there); step 4d mentions `/archive-roadmap` when the final session completes; "See also" cross-reference added.
- `plugins/planning/skills/roadmap/SKILL.md` — "See also" cross-reference to `/archive-roadmap`.
- `plugins/planning/skills/autopilot/SKILL.md` — Rule: never archive a roadmap autopilot is currently looping; mention `/archive-roadmap` as the optional next step once the loop finishes with a complete tracker.
- `README.md` — `/archive-roadmap` row in the skills table; "Which one?" line extended; new **Archiving finished roadmaps** section covering usage forms, the depth-1-glob rationale (with a "don't 'fix' that glob to recurse — it's load-bearing" warning), log-attribution signals, one-way-ness, and the path-anchored-`.gitignore` hazard; install and repo-layout blurbs updated.
- `plugins/planning/.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json` — planning `version` 1.4.0 → **1.5.0** in both places, descriptions extended with `archive-roadmap`.

## Decisions & Rationale

- **A separate `.planning/archive/` directory rather than a status flag or an exclusion list** → the depth-1 discovery glob already used by `/session`, `/autopilot` and `autopilot.sh` stops matching at that depth, so one move hides the roadmap from all three consumers with no code change in any of them.
- **Four-tier log attribution with Excluded checked first** → the git date window matches on filename alone, so without an authoritative negative signal it drags in every concurrent log from every other roadmap active in the same fortnight (noted in the skill as the single largest false-positive source when tested against a real repo).
- **`**Roadmap:**` is conditional in `wrapup` but mandatory in `session`** → `/session` knows the plan dir with certainty; `/wrapup` often runs on non-roadmap work, and a fabricated slug is worse than a missing line.
- **Digest file map derived from the union of session-log `## Changes` bullets, not `PLAN.md` §6** → §6 is the plan and drifts; the skill also records the drift between the two as a deliberately useful digest line.
- **Section-safe `awk '/^## Changes/{f=1;next} f&&/^## /{exit} f'` instead of a `/start/,/end/` range** → `## Changes` matches an `/^## [A-Z]/` end pattern too, collapsing the range to the heading line and silently matching nothing; and `## Decisions & Rationale` is optional, so a range would run to EOF when absent.
- **No restore flag; archiving is one-way** → reversal is a `git mv` back, spelled out in `DIGEST.md`'s "Where everything went". Coupled with an explicit prohibition on `rm -rf` of an archive path, because path-anchored `.gitignore` rules stop matching after the move and `git reset --hard` cannot restore files git never tracked.
- **Explicit-pathspec commit including the old paths** → omitting them leaves the staged deletions unrecorded, committing an archive copy while the original stays put.

## Remaining Work

- **Tag the release:** `claude plugin tag plugins/planning` (directory path, not plugin name). Existing tags stop at `planning--v1.4.0`; v1.5.0 is committed but untagged.
- The skill is written but has **not been exercised end-to-end** against a real finished roadmap. This repo's own `.planning/` holds only flat session logs and no `<slug>/TRACKER.md`, so there is nothing local to dry-run against.
- Consider whether `/handoff` should also carry the `**Roadmap:**` field — it shares the `wrapup` template, so it inherits the conditional line, but its SKILL.md was not touched this session.

## Resumption Context

Key files to review when picking this up:
- `/Users/kstar/_PRJ/cc-star-skills/plugins/planning/skills/archive-roadmap/SKILL.md`
- `/Users/kstar/_PRJ/cc-star-skills/plugins/planning/skills/wrapup/SKILL.md` (shared session-summary template + `**Roadmap:**` rule)
- `/Users/kstar/_PRJ/cc-star-skills/plugins/planning/skills/session/SKILL.md` (step 4a/4d)
- `/Users/kstar/_PRJ/cc-star-skills/README.md` ("Archiving finished roadmaps")
- `/Users/kstar/_PRJ/cc-star-skills/plugins/planning/scripts/autopilot.sh` (the depth-1 glob the design depends on)

Suggested opening prompt for next session:
> "In cc-star-skills, the `/archive-roadmap` skill shipped in planning v1.5.0 but was never tagged or exercised. Tag the release with `claude plugin tag plugins/planning`, then dry-run the skill against a real finished roadmap in another project to validate the session-log attribution tiers and the `git mv` + pathspec-commit sequence."
