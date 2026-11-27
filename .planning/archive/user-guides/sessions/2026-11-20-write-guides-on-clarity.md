# Session: write-guides on Clarity (user-guides S5)

**Date:** 2026-11-20
**Branch:** main
**Roadmap:** `.planning/user-guides`
**Runtime:** `opus/high` (by hand, from Clarity)

## Summary

The first real run of `/user-guides:write-guides`, from Clarity's repo against its local stack's synthetic mail. Recon (three Explore agents on named, git-tracked folders, never `docs/feedback/`) found three roles: user, admin and operator. Kam answered the interview live (wording v2) and approved the six-guide outline as proposed. A browser walk crawled 22 screens across the three roles, and a kept walk script added 17 states a crawl can't reach, four of them signed out. Six guides were written with 12 placeholder pictures and 23 claims recorded as not checked; `check-guides` passes and all six are `checked`. The privacy allowlist passes: every person and quoted line is in the tracked seed sources. The run's friction log has 13 items, and 9 were fixed in the plugin, with 4 new tests. One fix, `summary` printing the recorded answers, cured an eval flake in `write-guides-code-path`. All write-guides evals pass. Clarity's guides were committed there with Kam's go-ahead.

## Changes

- `plugins/user-guides/skills/write-guides/SKILL.md`: `$S` is `<base directory>/scripts`; step 0 says an answered id is settled.
- `plugins/user-guides/skills/write-guides/reference/interview.md`: Round 1 is recorded at the default folder and moved if Round 2 picks another; the third folder option only when guides were found; `appSignIn` names the account per role when there are several.
- `plugins/user-guides/skills/write-guides/reference/walking.md`: `walk.open(role, { signedOut: true })` for the screens before sign-in, and the `signed out` shot state.
- `plugins/user-guides/skills/write-guides/scripts/kit-core.mjs` (and the identical `skills/wiki-guides/scripts/kit-core.mjs`): `screenNames`, which drops a leading unread count from a page title.
- `plugins/user-guides/skills/write-guides/scripts/check-guides.mjs`: coverage uses `kit.screenNames`.
- `plugins/user-guides/skills/write-guides/scripts/walk-lib.mjs`: `open(role, { signedOut })`; `outline.md` counts repeated controls (×N), cuts long names at 80 characters and labels named states; screen names from `kit.screenNames`.
- `plugins/user-guides/skills/write-guides/scripts/guide-set.mjs` (and the identical `skills/wiki-guides/scripts/guide-set.mjs`): `summary` adds `leftOut`, the interview's wording and answers, and the app (URL, sign-in kind, roles).
- `plugins/user-guides/test/kit-core.test.mjs`, `test/walk-lib.test.mjs`, `test/guide-set.test.mjs`: tests for each of the above.
- `.planning/user-guides/PLAN.md`: Session 6 takes signed-out shots; §3 › Review notes records S5.
- `.planning/user-guides/TRACKER.md`: row 5 ✅, the open item for the local stack, Review notes › Clarity's guides, and the Session 5 log with the friction log.
- `.planning/sessions/2026-11-20-write-guides-on-clarity.md`: this summary.
- In Clarity, committed there separately: `docs/user-guides/` (six guides, the README index, `guides.json`, 12 cards) and the `.user-guides/` line in `.gitignore`.

## Decisions & Rationale

- The user role walks as the film account, not the e2e test user. Its mailboxes are tidier for pictures (PLAN D13). The admin and operator walk as the e2e accounts.
- The admin role guide covers People's tasks step by step, and Running Clarity is the shared reference and troubleshooting page for admins and operators. Kam chose both kinds, and this split keeps the overlap small.
- People's pictures crop to its forms, never its table, because the local account table holds test residue. Noted for S10.
- `--record` stays code-path only. On a walked set, labels from states the data can't show were recorded by hand with reasons, so a walk never excuses a label silently.
- The scripted evals ran without their baseline arm. This was a regression check, and S3 and S4 already measured the Δ.

## Remaining Work

- S6 (wiki-guides: screenshots), with `as(role, { signedOut: true })` for the sign-in shot.
- Not fixed, candidates for S9: the crawl records each id variant as its own screen, and the text dumps leave out form field values.
- S10 takes Clarity's 12 pictures and publishes. The People shots stay cropped to the forms.

## Resumption Context

Key files to review when picking this up:
- `.planning/user-guides/PLAN.md` (§5 Session 6, §3 › Review notes)
- `.planning/user-guides/TRACKER.md` (Session 5 log)
- `plugins/user-guides/skills/write-guides/scripts/walk-lib.mjs`
- `plugins/user-guides/skills/write-guides/scripts/guide-set.mjs`

Suggested opening prompt for next session:
> "/planning:session .planning/user-guides: run Session 6 (wiki-guides: screenshots) in cc-star-skills."
