# Session: user-guides S3: write-guides evals, tuning, samples for review

**Date:** 2026-11-20
**Branch:** main
**Roadmap:** `.planning/user-guides`
**Runtime:** `opus/medium (autopilot attempt 1)`

## Summary

Session 3 of the user-guides roadmap ran headless, and its gate passed. write-guides now has an eval harness and six cases. `bash evals/run.sh` stages the plugin without `node_modules`. Four eval-format cases run through `claude plugin eval`, with its no-plugin baseline arm. Two cases need the live fixture, so they run as scripted `claude -p --plugin-dir` runs, graded the same way.

In the final pass every case passed 2 of 2 runs with the skill, scoring 1.00. Without the plugin they scored:

| Case | Baseline | Δ |
|---|---|---|
| headless Round 1 | 0.625 | |
| code path | 0.30 | |
| non-local refused | 0.60 | |
| adopt | 0.375 | |
| first guides | 0.29 | +0.71 |
| refresh after v2 | 0.25 | +0.75 |

The four eval-format cases average Δ +0.525.

Trigger tuning with skill-creator's `run_loop.py` kept Session 2's description. It scored 7 of 8 held-out queries (21 of 24 runs, precision 100%, recall 75%). The one miss was the `check` route, so "check" was added, and the full set of 20 then scored 20 of 20, no longer held out.

The evals found four things to fix in the skill:

- the picture rules;
- portable walk scripts;
- the scripts' main-module guard, which did nothing when called through a symlink;
- the description.

The best first-guides run is frozen as `fixtures/leave-app-guides/` and copied to `.planning/user-guides/samples/` for Session 4. Eval runs cost about $15 in total.

## Changes

- `plugins/user-guides/evals/run.sh`: new. Stages the plugin and runs `format`, `scripted` or `all`. It copies the git wrapper to the stage's `.eval-bin/`, first on PATH.
- `plugins/user-guides/evals/scripted.mjs`: new. The scripted runner: scaffold, `claude -p` with and without the plugin, the `regex` / `tool_used` / `file_exists` / `script` graders, `arm: with-only` indicators, a cost ceiling, and results in `evals/results/scripted-<time>/`.
- `plugins/user-guides/evals/shim/claude`: new. The `claude` shim, which adds `--plugin-dir "$USER_GUIDES_PLUGIN_DIR"`.
- `plugins/user-guides/evals/bin/git`: new. The git wrapper for eval runs (Command Line Tools' git).
- `plugins/user-guides/evals/lib/scaffold.mjs`: new. Stages into a workspace, writes the answer presets (`walk`, `code`, `nonlocal`), the hand-written guides for adopt, and the commit.
- `plugins/user-guides/evals/write-guides-{headless-round-1,code-path,non-local,adopt}/`: new eval-format cases (`case.yaml` + `scaffold.sh`).
- `plugins/user-guides/evals/scripted/write-guides-first-guides/`, `…/write-guides-refresh-v2/`, `…/lib/set-grader.mjs`: new scripted cases with their scaffolds and script graders. The refresh oracle applies R14's table to the set's own shots.
- `plugins/user-guides/evals/triggers/write-guides.json`: new. 20 trigger queries, 10 should and 10 near-misses (D1).
- `plugins/user-guides/fixtures/leave-app-guides/`: new. The frozen guide set (R15), with a README that gives its provenance and its R14 count.
- `plugins/user-guides/skills/write-guides/SKILL.md`: the description now covers "check".
- `plugins/user-guides/skills/write-guides/reference/style.md`: the picture rules. Picture each task's first unseen screen; crop to the step's region; the region holds everything the alt text names.
- `plugins/user-guides/skills/write-guides/reference/walking.md`, `reference/refresh.md`: kept walk scripts import from `USER_GUIDES_SCRIPTS` and run with it set.
- `plugins/user-guides/skills/{write-guides,wiki-guides}/scripts/*.mjs`, `test/stage.mjs`: the main guard compares real paths (symlink-safe). The two `guide-set.mjs` copies stay byte-identical.
- `plugins/user-guides/test/cli-symlink.test.mjs`: new. Each script CLI answers through a symlinked path.
- `.planning/user-guides/samples/`: new. S4's review copy of the frozen set.
- `.planning/user-guides/PLAN.md`: R28 records the harness as built: runners, git, the proof of the edited copy, file graders, the frozen set's R14 count, and trigger tuning with one worker.
- `.planning/user-guides/TRACKER.md`: row 3 ✅, a review note for S4, and the session log.

## Decisions & Rationale

- **Scripted runs for walk and refresh**, with the same grader kinds. SP1 and SP2 said no, so an eval-format run can't reach the fixture (R26).
- **The edited copy is proven by the staged path in the run's tool calls.** Neither trace records the expanded slash command, so C8's `Base directory` line can't be graded.
- **The git wrapper goes in the stage's `.eval-bin/`.** Runs may not read the plugin's `evals/` folder, and only PATH reaches them; `DEVELOPER_DIR` does not.
- **The trigger loop runs with one worker.** With ten, the near-identical command files compete with each other: recall read 6% and then 100%.
- **The held-out score is recorded before the "check" edit.** The edit used a held-out query, so the 20/20 that followed is not a held-out score.
- **The frozen set is kept with one R14 retake** rather than tuning for two. The skill's crops are reasonable, the oracle follows the table, and S6 and S9 take their count from it (R28).
- **Sonnet for eval runs and the loop** keeps billed runs modest. The skill passes on it.

## Remaining Work

- Session 4 (by hand): Checkpoint 1. Kam reviews the interview, the templates and the samples. The review note in TRACKER points at the S3 picture rules.
- S6 and S9: use `fixtures/leave-app-guides/` and the R28 count (exactly one retake against v2). S9 reuses `run.sh` and the scripted runner, with its own trigger queries and one worker.
- Open: the guides are lean (about 350–600 words each). That is for S4 to judge.

## Resumption Context

Key files to review when picking this up:
- `.planning/user-guides/PLAN.md` (R26–R28)
- `plugins/user-guides/evals/run.sh`, `plugins/user-guides/evals/scripted.mjs`
- `.planning/user-guides/samples/docs/user-guides/`
- `plugins/user-guides/skills/write-guides/reference/style.md`

Suggested opening prompt for next session:
> "Run /planning:session .planning/user-guides for Session 4 (Checkpoint 1): review the interview, the templates and the S3 samples with me."
