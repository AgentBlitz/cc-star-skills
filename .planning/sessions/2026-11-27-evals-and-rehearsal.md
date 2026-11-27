# Session: platform-audit S7, evals and a rehearsal

**Date:** 2026-11-27
**Branch:** main
**Roadmap:** `.planning/platform-audit`
**Runtime:** `opus/medium (autopilot attempt 1)`

## Summary

Session 7 of the platform-audit roadmap wrote the plugin's evals without running them (D17): three
headless eval-format cases (`platform-audit-headless-round-1`, `platform-audit-no-chrome`,
`platform-audit-check`) with scaffolds, a 20-query trigger set and a `run.sh` that stages a copy without
`node_modules` and never publishes. A new `test/evals-lint.test.mjs` (14 tests) lints them, matches the
headless graders against `interview.md`'s Round 1 block, and runs the check scaffold against its graders.
The skill was then rehearsed on the Partner Portal fixture through the Playwright MCP tools, with
`checklist=none hidden=try-two interact=open-forms code=download pace=5`. The run wrote a report that
`check-audit.mjs` passed first time, scored routes 1.0 and items 0.971, and left a fixture log with 0
mutations, uploads and downloads and no 429. The rehearsal turned up six problems, all fixed in
`probe.js` and the skill text. The worst was that the probe returned a customer's name as a detail page's
heading. The gate passed: `npm test` 102/102, and genericity is clean over the plugin and the added
planning lines.

## Changes

- `plugins/audit/evals/platform-audit-headless-round-1/{case.yaml,scaffold.sh}`: new. With no answers, the run prints Round 1, the pace note and the command, and stops. It writes nothing and makes no Chrome, download or fetch call.
- `plugins/audit/evals/platform-audit-no-chrome/{case.yaml,scaffold.sh}`: new. With every answer given, the run says Claude in Chrome isn't connected, uses no other browser and writes nothing.
- `plugins/audit/evals/platform-audit-check/{case.yaml,scaffold.sh}`: new. Four defects are planted, the graders name each check and the skipped ones, and the run changes nothing.
- `plugins/audit/evals/lib/scaffold.mjs`: new. `repo` and `check-sample`, which reuses `test/samples/plant-defects.mjs`. It uses no git.
- `plugins/audit/evals/triggers/platform-audit.json`: new. 10 queries that should trigger and 10 near-misses.
- `plugins/audit/evals/run.sh`: new. Its header says the runs are billed, and it runs `claude plugin eval` with `--no-publish --scaffold --trust-plugin`.
- `plugins/audit/test/evals-lint.test.mjs`: new, 14 tests.
- `plugins/audit/skills/platform-audit/scripts/probe.js`: on a detail page, a heading that is the record's name now comes back as `(record title)`. `peek().hidden` leaves out sign-in and log-out routes. The file is now 10,903 bytes.
- `plugins/audit/test/probe.test.mjs`: a new Customer details test, and the peek test now also asserts that `/login` is left out.
- `plugins/audit/skills/platform-audit/reference/ground-rules.md`: the row checkbox is ticked with `find` + `computer`, not with `open(i,{toggle:true})`.
- `plugins/audit/skills/platform-audit/reference/walking.md`: the same row-checkbox fix. Also: plain-text chips and the profile block are read from a screenshot, a blocked page's message comes from `access`, the `(record title)` behaviour is described, `open()`'s `blocked` key is corrected, and the `peek` hidden list's exclusions are stated.
- `.planning/platform-audit/PLAN.md`: §2.6's probe row records the two probe changes.
- `.planning/platform-audit/TRACKER.md`: row 7 is ✅, and the Session 7 log entry is added.

## Decisions & Rationale

- The eval scaffolds use no git. The skill never runs git, and user-guides found that git fails inside eval runs, so there was no reason to copy its `bin/git` wrapper.
- The command grader writes `app.example.com` unescaped, because the genericity test reads the escaped form as the host "app".
- The `(record title)` mask applies to a top heading on a path that contains a digit, when the heading has no digit and no mask of its own. That keeps "Order ##" and "Access denied" and drops a person's name. A slug-only record path would slip through, and S8/S9 should watch for one.
- The rehearsal injected the probe with `page.addScriptTag` instead of transcribing 10.9 KB into `browser_evaluate`. It also batched local opens, and the paced Reports tabs, in single `browser_run_code_unsafe` calls. These were harness shortcuts, not skill behaviour, and S8 tests the real paste and the one-load-per-batch rule.

## Remaining Work

- S8 (by hand): the trial run in Kam's Chrome. Things to watch: the real paste of the probe into `javascript_tool`, pacing one load per batch, `find` + `computer` for row links and checkboxes, and whether Chrome still prompts with this `allowed-tools`.
- S9 and S10, both by hand.
- The paid evals: none have run (D17). Kam may run `bash plugins/audit/evals/run.sh` after the release.

## Resumption Context

Key files to review when picking this up:
- `.planning/platform-audit/TRACKER.md` (row 7's notes, and the Session 7 log)
- `.planning/platform-audit/prompts/session-8.md`
- `plugins/audit/skills/platform-audit/reference/walking.md`
- `plugins/audit/evals/`

Suggested opening prompt for next session:
> "/planning:session .planning/platform-audit (Session 8, the trial run in Chrome, by hand)"
