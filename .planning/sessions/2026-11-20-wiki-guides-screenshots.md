# Session: wiki-guides: screenshots (user-guides S6)

**Date:** 2026-11-20
**Branch:** main
**Roadmap:** `.planning/user-guides`
**Runtime:** `opus` (interactive `/planning:session`; the session's profile is opus/high)

## Summary

This session built wiki-guides' screenshot half. `shots-kit.mjs install` gives a project a `scripts/user-guides/shots.mjs` made from the bundled template, with one block per shot of `guides.json`, and a stamped copy of `guides-kit.mjs`: the shot helpers with `kit-core.mjs` embedded byte for byte. `shots-kit.mjs check` flags a stale or hand-edited copy, and any shot the script lacks. The script has a `--check` preflight (Playwright, the base URL, every role signed in). It can retake by name or take `--pending` shots. Each shot is taken at 1280×800, scale 2, light palette and reduced motion, with a half-size review copy, and its region's fingerprint goes to a manifest in `.user-guides/out/`. A shot that fails is reported and the rest carry on. `swap-shots.mjs` then writes each PNG beside its card, rewrites the links, deletes the card and moves the shot to `taken` (or `blocked`, or `needs-text`) through `guide-set.mjs`. It also refreshes the README index. `reference/screenshots.md` explains how to make, run, retake and keep the script. The gate passed: `npm test` takes all 5 fixture shots of the frozen set. The fetch walk, the browser walk and the shot give the same fingerprint for every shot, including a signed-out one. After v2, the shots' own fingerprints flag exactly `settings` (R28's oracle over R14's table), and swap-shots retakes only that shot; the other four pictures and entries are byte-identical. One check-guides bug surfaced and was fixed: a `blocked` shot may keep its card.

## Changes

- `plugins/user-guides/skills/wiki-guides/templates/guides-kit.mjs` (new): `kit-core.mjs` embedded between markers, then `startShots()` → `as(role, { signedOut })`, `open`, `settle`, `step`, `shot(id, target, { pad, maxHeight, clip })`, `check`, `done`; the manifest helpers and `pngSize`.
- `plugins/user-guides/skills/wiki-guides/templates/shots.template.mjs` (new): the project's script, with `{{SET_FILE}}` and a `{{SHOTS}}` region that `shots-kit.mjs install` fills.
- `plugins/user-guides/skills/wiki-guides/scripts/shots-kit.mjs` (new): `install` (stamped kit; never overwrites the project's `shots.mjs`), `check` (current / stale / edited / unstamped / missing, and shots the script lacks or invents) and `blocks` (blocks to paste in).
- `plugins/user-guides/skills/wiki-guides/scripts/swap-shots.mjs` (new): manifest → PNGs, links, cards deleted, `taken`/`blocked`/`needs-text`, README index; `--release`, `--only`, `--needs-text`, `--dry-run`, `--json`.
- `plugins/user-guides/skills/wiki-guides/reference/screenshots.md` (new, R20).
- `plugins/user-guides/skills/write-guides/scripts/check-guides.mjs`: a `blocked` shot may still show its `.svg` card.
- `plugins/user-guides/test/shots.test.mjs` (new, 6 tests): kit install and stamp, stale/edited/missing flags, swap-shots' rules, link rewriting, the gate test (v1 → swap → v2 → refresh → retake → swap) with the sign-in secrecy check, and retake-by-name / failure / signed-out / wrong-role.
- `plugins/user-guides/test/embed-kit.mjs` (new, dev only): re-embeds `kit-core.mjs` in the kit template.
- `plugins/user-guides/test/sync.test.mjs`: the embedded kit-core must equal `scripts/kit-core.mjs`.
- `.planning/user-guides/PLAN.md`: `shots-kit.mjs` added to §2.4's layout; new R29 (the screenshots as built).
- `.planning/user-guides/TRACKER.md`: row 6 ✅ and the S6 session log.

## Decisions & Rationale

- **A third script, `shots-kit.mjs`**, which the layout lacked. The plan asks for a version stamp and a stale-copy check, and the copy needs an installer. Putting both in `swap-shots.mjs` would have mixed two jobs. Recorded in §2.4 and R29.
- **The kit template carries kit-core pre-embedded**, with a sync test and a re-embed script. The alternative was embedding at install time, but then the committed template could not be imported or tested on its own.
- **shots.mjs writes to `.user-guides/out/`, and swap-shots writes into the guides.** Pictures can be looked at (and retaken) before anything in git changes, and only wiki-guides' script moves shot status, through `guide-set.mjs`.
- **The fingerprint comes from `shots[].target.locator`, never from the crop**, and is read before the page is touched. That makes walk-and-shot agreement hold by construction (R12 and R27), and a project can crop differently without breaking refresh.
- **Freshness.** A `retake` needs a manifest entry newer than its `takenAt`, so an old image is never swapped in as the retake.
- **Whole screens end where the content ends** (plus padding, capped at 1600 CSS px). The first sample left a large empty band under short pages, which goes against the lean-pictures rule.
- **Preflight's signed-in test:** a role whose `/` lands where a signed-out page lands is not signed in (sign-in kind `none` excepted). This is generic, with no stack assumptions.
- **No evals rerun.** The only write-guides change relaxes a rule for `blocked` shots, a status that write-guides' evals never produce.

## Remaining Work

- S7: the converter (Confluence storage format and HTML), `md.mjs` shared, `templates/test-page.md`.
- S9 writes wiki-guides' SKILL.md around `shots-kit.mjs`, `shots.mjs` and `swap-shots.mjs`, including the wiki-guides label fix (D5) that sets a `checked` guide back to `written`. swap-shots doesn't do that.
- S10 takes Clarity's 12 shots with this script. Its People shots crop to the forms (TRACKER › Review notes), and Getting started has signed-out shots.
- Seen, not changed: with only a fetch crawl (no kept walk scripts), check-guides reports "Back to Home" as unwalked on the frozen set. The refresh scaffold runs the kept walk scripts and doesn't hit this.

## Resumption Context

Key files to review when picking this up:
- `plugins/user-guides/skills/wiki-guides/reference/screenshots.md`
- `plugins/user-guides/skills/wiki-guides/templates/guides-kit.mjs` (after the kit-core end marker)
- `plugins/user-guides/skills/wiki-guides/scripts/swap-shots.mjs`
- `plugins/user-guides/test/shots.test.mjs`
- `.planning/user-guides/PLAN.md` › R29

Suggested opening prompt for next session:
> "/planning:session .planning/user-guides (Session 7: the converter, Confluence and HTML)"
