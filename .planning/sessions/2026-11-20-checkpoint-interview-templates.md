# Session: user-guides S4 — Checkpoint 1 · interview and templates

**Date:** 2026-11-20
**Branch:** main
**Roadmap:** `.planning/user-guides`
**Runtime:** opus/high (interactive, by hand)

## Summary

This was the first checkpoint of the user-guides roadmap, run by hand. Kam answered write-guides'
interview through AskUserQuestion, as a user would. The rounds were 1, 2, 2a and 3, in wording v1,
filled with the Leave Planner fixture's detected values. Kam then reviewed the samples
(`.planning/user-guides/samples/`) and the four templates.

Asking the rounds exposed six gaps in the wording and rules. Kam answered them with notes and
follow-ups, and approved the templates and samples otherwise. All six notes were applied to the
skill's reference files, and the interview wording moved to version 2. A new eval grader enforces
the lean-picture rule. The gate passed: `npm test`, 4/4 format evals and 2/2 scripted evals.

## Changes

- `plugins/user-guides/skills/write-guides/reference/interview.md`:
  - wording v2;
  - the detected language is named in words, and is not repeated when it is UK or US English;
  - the folder question always has a second option, "Another folder in this repo";
  - a running URL is Recommended only when its data holds the synthetic accounts, otherwise "start it" is;
  - Round 2a confirms what recon found, and its skip rule now depends on what `guides.json` or the arguments hold.
- `.../reference/recon.md`: Round 2a is asked to confirm what recon found, and to settle the rest.
- `.../reference/walking.md` § Preflight, a new bullet: a role that can't sign in at a running app gets the offer of a seeded local copy, or the code path. Headless runs take the code path.
- `.../reference/guide-types.md`: a kind's id is the kind itself (`admin-operations`), so it never collides with an admin role guide's `admin`.
- `.../reference/style.md` › Pictures, "Keep the set lean": each screen or region pictured at most once across the set; at most five pictures a guide; none in the index.
- `plugins/user-guides/evals/scripted/write-guides-first-guides/graders/pictures.mjs` (new): the `lean-pictures` grader, registered in that `case.json`.
- `plugins/user-guides/evals/lib/scaffold.mjs`: the presets record `wordingVersion: '2'`.
- `.planning/user-guides/PLAN.md`: the interview reconciliation now names wording `2`, and §3 › Review notes has the Checkpoint 1 summary.
- `.planning/user-guides/TRACKER.md`:
  - row 4 ✅;
  - Kam's answers, verdict and follow-ups under Review notes › Interview and templates;
  - the S5 pointer: Clarity's running app has no synthetic data, so the walk uses a local, seeded copy;
  - the open item annotated;
  - the session-log entry, with the six-item checklist and its evidence.

## Decisions & Rationale

- **Interview wording bumped to version 2**, because the doc's own rule is that the wording is fixed and versioned. Sets that recorded "1" still validate, since the version is any string, and the test fixtures keep "1".
- **Picture balance is a rule plus a grader.** Kam picked "one per screen, plus a cap per guide" over either alone. The grader gives a passing case as evidence, and it guards future tuning runs.
- **Kam also asked for fixes to gaps 4 and 5**, beyond the notes he first wrote, so they are in scope.
- **Two additions were dropped as out of scope:** skipping Round 2a when `facts` is "From the code only", and asking it only "when the walk is chosen".

## Remaining Work

- S5: write-guides on Clarity, run by hand from Clarity. It must walk a local, seeded copy, because the running app holds no synthetic data. It asks before any start or seed.
- The open items still stand: Kam's availability, Clarity's local stack, the wiki parent page, and the go to push.

## Resumption Context

Key files to review when picking this up:
- `.planning/user-guides/PLAN.md` (§3 › Review notes, §5 Session 5)
- `.planning/user-guides/TRACKER.md` (Review notes, the S4 log)
- `plugins/user-guides/skills/write-guides/reference/interview.md`, `style.md`, `walking.md`

Suggested opening prompt for next session:
> "From Clarity: /planning:session /Users/kstar/_PRJ/cc-star-skills/.planning/user-guides (Session 5, write-guides on Clarity)"
