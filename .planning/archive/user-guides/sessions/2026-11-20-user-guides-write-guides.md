# Session: user-guides S2: the write-guides skill

**Date:** 2026-11-20
**Branch:** main
**Roadmap:** `.planning/user-guides`
**Runtime:** `opus/high (autopilot attempt 1)`

## Summary

Session 2 of the user-guides roadmap ran headless, and its gate passed. `/user-guides:write-guides` now exists as a model-invocable skill: an 85-line orchestration `SKILL.md`, six reference files (interview, recon, walking, guide types, style, refresh and adopt), four templates and four new scripts. The scripts are `kit-core.mjs` (the Playwright lookup, sign-in for the five kinds, and a dependency-free HTML reader with D3's fingerprint), `walk-lib.mjs` (preflight, crawl, walk scripts, outline, diff, refresh), `check-guides.mjs` and `set-edit.mjs`. `kit-core.mjs` is byte-identical in both skills, and the sync test now requires that. A browser walk and a fetch walk read screens through the same code, so on the fixture they give identical outlines. The dry run used staged fixture copies with the answers in `guides.json`. A first walk produced four guides with eight placeholders, which `check-guides` passed and marked `checked`; two walks gave byte-identical outlines. A v2 refresh updated the text, and an adopt of a hand-written guide passed after its refresh. A headless `claude -p` run of the skill printed Round 1 and stopped. `npm test`: 67 pass, 1 skipped (`md.mjs`, due in S7). `claude plugin validate` passes.

## Changes

- `plugins/user-guides/skills/write-guides/SKILL.md`: replaces the placeholder. Model-invocable; its description is tuned against D1's near-misses; it routes by `$ARGUMENTS` (`refresh`, `adopt`, `check`, answers), lists the never-dos, and gives seven steps, each pointing to its reference file.
- `plugins/user-guides/skills/write-guides/reference/interview.md` (new): wording version 1. Rounds 1–3 with answer ids, Round 2a (running the app, asked only for what recon left open), adopt's round, the skip rules and argument forms, how answers map to files, and the headless print-and-stop form, including the recorded `approve as proposed`.
- `…/reference/recon.md` (new): the three Explore briefs and report shapes, limited to git-tracked files in named folders and never a forbidden folder; the ≤ 15-line summary.
- `…/reference/walking.md` (new): preflight, the Playwright lookup, crawling, walk scripts (named dumps), locators and screens for shots, the code path, coverage.
- `…/reference/guide-types.md` (new): the four kinds, closest-template rules, how the set and outlines are proposed, saving an approved outline as a heading skeleton, and the README index.
- `…/reference/style.md` (new): the screens' own words, bold only for on-screen labels, no internal references, the converter's subset, placeholders and `addShot`.
- `…/reference/refresh.md` (new): refresh (walk, diff, retakes, text, `needs-text`, claims, check, report) and adopt (one round, register as written or taken, never rewrite before a walk, then refresh).
- `…/templates/role-guide.md`, `features-and-value.md`, `getting-started.md`, `admin-operations.md` (new): heading skeletons with guidance comments.
- `…/scripts/kit-core.mjs` (new) and `skills/wiki-guides/scripts/kit-core.mjs` (identical copy): the Playwright lookup in D10's order (install only after asking, never headless); sign-in for `cookie-command`, `storage-state` (mode 600), `form`, `module` and `none`, for browser contexts and fetch cookie jars, with values never logged; the HTML reader (roles, accessible names, Playwright-style locators, visibility); `normaliseText` and `fingerprint`.
- `…/scripts/walk-lib.mjs` (new): `createWalk` (`open`, `go`, `dump`, `api`, `crawl`, `save`), deterministic outlines with aliases and named entries, `outline.previous.json` and `diff`, `refreshShots`; a CLI with `preflight`, `crawl`, `diff`, `refresh`, `sign-in` and `install-playwright`; adds `.user-guides/` to `.gitignore`.
- `…/scripts/check-guides.mjs` (new): refs, template, image, shots, links and anchors (GitHub slugs), labels (read a paragraph at a time; `--record` on the code path), coverage, walk, index; `--mark-checked`.
- `…/scripts/set-edit.mjs` (new): operations on `guides.json` through the contract, all or nothing.
- `plugins/user-guides/test/sync.test.mjs`: `kit-core.mjs` moved into the required shared files.
- `plugins/user-guides/test/helpers.mjs`, `kit-core.test.mjs`, `walk-lib.test.mjs`, `check-guides.test.mjs` (new): 28 tests, including two identical fetch walks, browser = fetch, the five sign-in paths, headless refusals, and v1 → v2 retaking exactly the two change-table shots.
- `.planning/user-guides/PLAN.md`: the §2.4 layout gains `set-edit.mjs`; R27 records the as-built facts for S3, S6 and S9; the status line.
- `.planning/user-guides/TRACKER.md`: row 2 ✅ and the session-log entry.

## Decisions & Rationale

- **One HTML reader for both walk modes**, rather than a DOM script for the browser and a parser for fetch. A browser walk passes `page.content()` to the same code, so the outlines and fingerprints agree by construction (tested), and S6's shots can use the same function.
- **`set-edit.mjs` added** (not in §2.4) rather than CLI commands in `guide-set.mjs`: the session's boundary keeps the contract file unchanged unless the skill can't work without it. Hand-edited JSON would skip the owner and transition checks.
- **Round 2a** for the app's base URL, sign-in and reset, asked only when recon leaves them open. Round 2's four questions are full, and these settings need the user's say (D9, R9).
- **Headless printing happens before recon.** Round 1's role options are written generically ("Every role", "Name the roles"), so a headless run spends nothing before it stops.
- **A shot's screen is named in its `state`** (`On /path: …`). The contract has no screen field, and this lets refresh find the region without a contract change.
- **The label check is per audience.** A guide may bold only labels its own roles see; this caught the employee guide naming **Inbox**. The admin's refusal message was walked (an admin opening `/inbox`) rather than dropped.
- **Named dumps are their own outline entries** after the dry run showed that a walk script's dump of a dialog replaced the crawled screen at the same URL.
- **Recon in the dry run** was done by reading the fixture's tracked files directly, not by launching three Explore agents; S3's evals exercise the skill end to end.

## Remaining Work

- Session 3: the evals (eval-format cases for the headless, code-path and privacy runs; scripted `claude -p --plugin-dir` runs for walks, R26), tuning the description and wording, and the frozen fixture guide set.
- A known limit for S3 (PLAN R27): the label check asks only whether the words appear on a walked screen for the guide's roles, so a label renamed in one place but kept in another passes. The refresh eval should grade the text.
- The headless smoke run read the fixture's tracked README before printing Round 1, to mention the start and reset commands. That is harmless, but S3 can tighten "before recon" if the evals care.
- During the dry run a `pkill -f "node server.mjs"` (for my own staged fixture) was broader than needed; later servers were stopped by PID. No other stack was meant to be touched, and none is known to have been affected.

## Resumption Context

Key files to review when picking this up:
- `plugins/user-guides/skills/write-guides/SKILL.md` and `reference/interview.md`
- `plugins/user-guides/skills/write-guides/scripts/walk-lib.mjs`, `check-guides.mjs`, `kit-core.mjs`
- `plugins/user-guides/test/walk-lib.test.mjs` (the v2 refresh test)
- `.planning/user-guides/PLAN.md` R26 and R27; `.planning/user-guides/prompts/session-3.md`

Suggested opening prompt for next session:
> "Run `/planning:session .planning/user-guides` for Session 3: write-guides' evals, tuning and samples for review."
