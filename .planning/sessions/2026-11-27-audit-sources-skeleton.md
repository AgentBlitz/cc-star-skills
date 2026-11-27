# Session: platform-audit S1 — sources and skeleton

**Date:** 2026-11-27
**Branch:** main
**Roadmap:** `.planning/platform-audit`
**Runtime:** `opus/medium (autopilot attempt 1)`

## Summary

Ran Session 1 of the platform-audit roadmap, ahead of the transcript-deletion deadline. Added the four
git-ignore lines first, then copied the 13 Nov audit's sources into the git-ignored
`.planning/platform-audit/sources/`: the approved plan, the two-file reference audit, the memory note, and
a script extraction of the audit transcript (1 interview call, 5 scratchpad Write files, 16 page scripts,
51 browser batches, 81 Bash commands, the final message), all counts matching the plan. Wrote a deny-list
of 18 distinctive terms and an index README there. Laid the `audit` plugin's skeleton at 0.1.0 (manifest,
dev-only package.json, stub skill) and adapted user-guides' genericity test into
`plugins/audit/test/genericity.mjs` with its own 7-test suite using made-up terms only. The roadmap's own
files were clean against the new deny-list, so nothing needed rephrasing. The gate passed.

## Changes

- `.gitignore` — four lines under an `# audit plugin: …` comment: `sources/`, `test/.out/`,
  `evals/results/`, `**/.platform-audit/`.
- `plugins/audit/.claude-plugin/plugin.json` — new, `audit` 0.1.0, same fields as the other plugins.
- `plugins/audit/package.json` — new, dev only: `test` and `genericity` scripts, Node ≥ 20, no deps.
- `plugins/audit/skills/platform-audit/SKILL.md` — new stub, `disable-model-invocation: true`.
- `plugins/audit/test/genericity.mjs` — adapted from P-2: platform-audit deny-list path; `--added` scoped
  to `.planning/platform-audit/`; `--paths` option besides positional paths; `.co` added to the bare-host
  endings; the XML-namespace host exception dropped (only the repo's address is allowed).
- `plugins/audit/test/genericity.test.mjs` — new: host rule, deny-list rule, absent deny-list, `--text`
  and stdin, paths/`--paths`, `--added`, default plugin mode.
- `.planning/platform-audit/TRACKER.md` — row 1 ✅, open item ticked, session log.
- (git-ignored, not committed) `.planning/platform-audit/sources/` — 11 top-level entries.

## Decisions & Rationale

- `.co` added to the host rule's bare-name endings → the sources' domain ends in it and P-2's list
  would have let such a bare host through; the deny-list also covers it.
- Dropped P-2's XML-namespace host allowance → PLAN D9 lists only localhost, 127.0.0.1, example.* and the repo;
  S3 can add it with a reason if the fixture needs an SVG namespace.
- PLAN §5 names a `--paths` mode while the prompt uses positional paths → both supported.
- Deny-list leaves out the account's display name (a plain English word), a code placeholder email in
  the bundle labels (a generic name at a generic domain), and generic tech and currency words.

## Remaining Work

- Session 2: the bundle extractor (`inventory-core.js`), reading `sources/scripts/`, `page-js/`, `bash/`.
- `claude plugin validate` warns about a missing icon (directory check only; validation passes).

## Resumption Context

Key files to review when picking this up:
- `.planning/platform-audit/PLAN.md` §2.6, §5 Session 2
- `.planning/platform-audit/sources/README.md` (local only)
- `plugins/audit/test/genericity.mjs`

Suggested opening prompt for next session:
> "/planning:session .planning/platform-audit"
