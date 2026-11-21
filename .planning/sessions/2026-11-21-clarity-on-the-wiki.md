# Session: Clarity's guides on the real wiki (user-guides S10, checkpoint 2)

**Date:** 2026-11-21
**Branch:** main
**Roadmap:** `.planning/user-guides`
**Runtime:** opus/high (interactive `/planning:session`, run from Clarity)

## Summary

Ran Session 10 by hand from the Clarity repo with the plugin loaded by `--plugin-dir`. First a rehearsal in Kam's Chrome against the bundled mock, which passed end to end. Then Clarity's 12 screenshots: script installed, set-up steps added, every picture read against its text, swapped in at release 1.12.0. The guides were then published through Claude in Chrome to the real wiki (Confluence Data Center 9.2.13), under a new page titled CLARITY that Kam made: test page first, then 6 pages and 12 images, then the test page's removal. All 7 pages pass `check-page`, the final plan is all `skip`, and a second publish sends nothing (0 created, 0 updated, 7 unchanged). The real wiki showed two things the mock had not. Data Center never shrinks an image that has a width, so pictures now carry no fixed width. And Kam asked for the banner to go, so wiki pages have none and the release lives in the version message. Both are fixed in the plugin, the mock and the evals, with tests. Further fixes from the friction log: scripts load into the page by upload, `record` checks the hashes of a hand-copied report, the copied kit no longer imports `node:crypto` (a plain SHA-256 gives the same fingerprints) and declares its browser globals, and the README section is asked first. Kam approved the checkpoint. Clarity's own changes were committed there with his go-ahead.

## Changes

- `plugins/user-guides/skills/{write-guides,wiki-guides}/scripts/guide-set.mjs`: `CONFLUENCE_DEFAULTS.imageCap` is `null` (no fixed width; R33)
- `plugins/user-guides/skills/wiki-guides/scripts/to-confluence.mjs`: `ac:width` only with an `imageCap` (`fixed` per image); no banner on wiki pages (R34)
- `plugins/user-guides/skills/wiki-guides/scripts/to-html.mjs`: width attribute only when known (the HTML keeps its banner)
- `plugins/user-guides/skills/wiki-guides/scripts/publish-kit.mjs`: `--image-cap <px>|fit` (validated); the test page follows the same width rule; `record` fills missing hashes from `publish.json` and refuses a report whose hash differs
- `plugins/user-guides/skills/wiki-guides/scripts/check-page.js`: `tooWide` advice now says to remove or lower the cap
- `plugins/user-guides/skills/{write-guides,wiki-guides}/scripts/kit-core.mjs`: `sha256Hex` in plain JavaScript in place of `node:crypto`
- `plugins/user-guides/skills/wiki-guides/templates/guides-kit.mjs`: re-embedded kit-core; `/* global document, window, getComputedStyle, requestAnimationFrame */`
- `plugins/user-guides/fixtures/mock-confluence/server.mjs`: the view page wraps images as Data Center does and copies its sizing rules
- `plugins/user-guides/skills/wiki-guides/reference/chrome-publishing.md`: load scripts by upload (snippet, `find`, `file_upload`, `eval`), keep answers short, save the report without hashes, check pages one `browser_batch` each, the page-tree order, image sizing
- `plugins/user-guides/skills/wiki-guides/reference/{confluence,guide-set,recording}.md`, `skills/write-guides/reference/guide-set.md`, `skills/wiki-guides/SKILL.md`: no banner, image fit, the release in the version message, the README section asked first and never re-added once declined
- `plugins/user-guides/test/{convert,publish,kit-core}.test.mjs`: the fit default in a 470 px mock column, the cap and `fit`, no banner, a release alone changes no page, `record`'s hash check, SHA-256 equal to `node:crypto`, the kit has no crypto import; goldens regenerated (`test/golden/expected/confluence/*.xhtml`)
- `plugins/user-guides/evals/scripted/lib/wiki.mjs`, `wiki-guides-{first-publish,adopt-pages,republish-v2}/graders/*.mjs`, `wiki-guides-republish-v2/{scaffold.mjs,case.json}`: version message instead of banner; the v2 scaffold works out `expectChanged`
- `.planning/user-guides/PLAN.md`: R33, R34, R35; §3 Review notes › Checkpoint 2
- `.planning/user-guides/TRACKER.md`: row 10 ✅, Review notes (Clarity on the wiki; Release, for S11), open items, the session log
- Clarity (its own commit, by go-ahead, not pushed): `scripts/user-guides/shots.mjs` and `guides-kit.mjs`, 12 PNGs for the 12 cards, the guides' links, `guides.json`, the README status block, one `.prettierignore` line

## Decisions & Rationale

- Pictures fit the page column (Kam, over a smaller fixed width or half-resolution copies) → Data Center sets `max-width: none` on any image with a width, and a reader's column depends on their window and page tree.
- No banner on wiki pages (Kam) → the pages are edited only through this loop; as a bonus a release alone no longer resends every page.
- Scripts loaded by upload instead of pasted → 25 KB of script text per page load was slow and error-prone; the wiki allowed `eval`, and pasting stays the fallback.
- `record` takes hashes from `publish.json` → the report is copied by hand out of a tool that cuts answers short; a mistyped hash now records nothing.
- A plain SHA-256 in the kit → a project may forbid crypto imports outside one module (Clarity does); a checksum need not use one.
- No README section for Clarity (Kam) → the skill now asks before adding it.
- Evals stopped part-way when Kam asked to wrap up → S11 reruns every eval as its gate; a parallel run would double the cost.

## Remaining Work

- S11 (release 1.0.0): its full eval run is the first run of the scripted cases since S10 changed three graders and the publisher (TRACKER › Review notes › Release).
- Known limit: Confluence sorts the guide pages alphabetically in the page tree; the publisher does not reorder them.
- Kam pushes Clarity's commit when he wishes.

## Resumption Context

Key files to review when picking this up:
- `.planning/user-guides/PLAN.md` (R33–R35)
- `.planning/user-guides/TRACKER.md` (row 10, Review notes › Release)
- `plugins/user-guides/skills/wiki-guides/reference/chrome-publishing.md`

Suggested opening prompt for next session:
> "/planning:session .planning/user-guides"
