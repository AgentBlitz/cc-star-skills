# Session: campaign-brief's guides on the user-guides plugin (S12), and 1.0.1

**Date:** 2026-11-21
**Branch:** main
**Roadmap:** `.planning/user-guides`

## Summary

The last session of the user-guides roadmap, run by hand from campaign-brief. Its six role guides
and its features page were adopted into a `guides.json`, walked on the local stack as each role,
brought up to the live release (1.11.0), illustrated with 38 retaken pictures and republished
through the user's Chrome: the top page and five role pages updated in place, a sixth (bonus
approvers) created, every page checked, and a second publish sent nothing. campaign-brief
committed it as CB-077. The friction found became the plugin's 1.0.1 patch: a Markdown parser
crash on a bare `https://`, a wrapped bold label that never matched its notChecked claim, a parse
failure that named no guide, `set-edit --help`, and documentation for data-only scene scripts.

## Changes

- `plugins/user-guides/skills/{write-guides,wiki-guides}/scripts/md.mjs`: a scheme with nothing
  after it stays text (it threw `null[0]` and stopped every parse).
- `plugins/user-guides/skills/write-guides/scripts/check-guides.mjs`: `labelsIn` collapses
  whitespace; a parser failure is reported against its guide.
- `plugins/user-guides/skills/{write-guides,wiki-guides}/scripts/set-edit.mjs`: `--help`.
- `plugins/user-guides/skills/write-guides/reference/walking.md`, `refresh.md`: `scene.mjs` runs
  before the crawl (a crawl is a fresh walk), dialog and state scripts after it.
- `plugins/user-guides/test/check-guides.test.mjs`: cases for the three fixes.
- `plugins/user-guides/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`: 1.0.1.
- `.planning/user-guides/TRACKER.md`: row 12 ✅, open items ticked, review notes, session log.
- `.planning/user-guides/sources/` (git-ignored): deleted, with the user's go-ahead.
- In campaign-brief (its own commit, CB-077): `guides.json` and a README index for the guides, the
  refreshed guides, 38 pictures, `scripts/user-guides/`, `scripts/wiki/` removed, two tracker ticks.

## Decisions & Rationale

- The features page stays the top page's text (R10's `topGuide`), and the wiki's page titles
  were kept rather than renamed to the files' headings: the user's answers.
- Reseeding the synthetic accounts was allowed, so pictures show the example brief at each stage.
- Bold used for emphasis became italics rather than plain text, which keeps the look of the
  features page's run-in lead-ins and satisfies "bold is only for words on screen".
- The patch fixes only what is safe without changing fingerprints; the crawl's query-variant cap,
  `--record` after a walk and stale `checked` status are recorded as known limits.

## Remaining Work

- The user pushes `main` and `user-guides--v1.0.1` (commands in the session's report), and
  campaign-brief's CB-077 with its own release flow.
- `/archive-roadmap` can retire `.planning/user-guides/`.
- For campaign-brief: the audit log shows one event type without its words (bonus approvals
  queued); app code, outside this roadmap.

## Resumption Context

Key files:
- `.planning/user-guides/TRACKER.md` (row 12 and the session log)
- `plugins/user-guides/skills/write-guides/reference/refresh.md`

Suggested opening prompt for next session:
> "Archive the finished user-guides roadmap with /archive-roadmap .planning/user-guides."
