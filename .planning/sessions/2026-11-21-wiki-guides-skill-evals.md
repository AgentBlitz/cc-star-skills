# Session: user-guides S9: wiki-guides skill, evals, tuning (0.9.0)

**Date:** 2026-11-21
**Branch:** main
**Roadmap:** `.planning/user-guides`
**Runtime:** `opus/high (autopilot attempt 1)`

## Summary

Session 9 of the user-guides roadmap ran headless, and its gate passed. `/user-guides:wiki-guides` is now a real skill. It is model-invocable and orchestrates the scripts from Sessions 6–8. A round asks first (destination, guides, the page to publish under, the release). It takes the shots, then reads each PNG back and compares it with the guide's text before the swap. It converts the guides and publishes them: through Claude in Chrome for a real wiki, or through the Node host for a wiki on this machine. It records where the pages are. It also adopts guides that have no `guides.json`.

There are nine eval cases: three eval-format and six scripted, the scripted ones on the fixture and the mock. The first pass found three things to fix in the skill:

- `go-ahead=yes` was not read as covering adopted pages;
- one run missed a removed checkbox;
- the summary showed nothing about past publishes.

In the second pass every case passed 2 of 2 runs with the skill, scoring 1.00. Without the skill they scored 0.25–0.67, and the model published straight to the "Cloud" mock and without a go-ahead.

Trigger tuning kept the description: 8/8 held-out queries (24/24 runs) and 12/12 train. `claude plugin details` puts the plugin at about 455 tokens always-on: wiki-guides about 250, plus about 3.3k when invoked.

A subagent rehearsed `chrome-publishing.md` with the Playwright MCP tools against the mock. It passed end to end, and its wording fixes went into the reference. The plugin is at 0.9.0, `npm test` passes 110/110, and `claude plugin validate` passes. Eval runs cost about $8.

## Changes

- `plugins/user-guides/skills/wiki-guides/SKILL.md`: rewritten from S1's stub. It has the routes, the `key=value` answers, the Never list, Round 1 with its headless form, steps 0–8, and the three stops worded in full.
- `plugins/user-guides/skills/wiki-guides/reference/recording.md`: new. It covers the record, the README's published section, the report, and the standalone adopt round.
- `plugins/user-guides/skills/wiki-guides/reference/chrome-publishing.md`:
  - the Node-host sequence, with the input made again before the final `plan` check;
  - the rehearsal's fixes: absolute upload paths, section 3 again before `removeTest`, the test page checked at `test.version`, the report saved as `JSON.stringify` text, the final check in Chrome, the 404 from the Cloud check being normal, the function wrapper, and the input appearing as a button.
- `plugins/user-guides/skills/wiki-guides/reference/screenshots.md`: compare each picture with every control the text names, and say what makes a shot `needs-text`.
- `plugins/user-guides/skills/{write-guides,wiki-guides}/scripts/set-edit.mjs`: now shared and byte-identical, and the actor is taken from the copy's folder (R32).
- `plugins/user-guides/skills/{write-guides,wiki-guides}/scripts/guide-set.mjs`: `summary` reports `publish`.
- `plugins/user-guides/.claude-plugin/plugin.json`: 0.9.0.
- `plugins/user-guides/evals/run.sh`: exports `USER_GUIDES_PLAYWRIGHT_CORE` (this repo's dev copy) when it is unset.
- `plugins/user-guides/evals/lib/scaffold.mjs`: `png`, `copyFrozenSet`, `takeAll`, and a `guides [--taken]` command.
- `plugins/user-guides/evals/scripted/lib/wiki.mjs`: new. It serves the fixture, runs the mock in-process, makes an async operator publish, captures the mock's state, and holds the grader helpers.
- `plugins/user-guides/evals/scripted/wiki-guides-{first-publish,republish-v2,adopt-pages,label-and-needs-text,cloud-refused,no-go-ahead}/`: new scripted cases, each with its scaffold and script graders.
- `plugins/user-guides/evals/wiki-guides-{headless-round-1,html,no-token}/`: new eval-format cases.
- `plugins/user-guides/evals/triggers/wiki-guides.json`: new. 20 queries: 10 that should trigger the skill and 10 near-misses from D1.
- `plugins/user-guides/test/sync.test.mjs`: `set-edit.mjs` added to the shared files.
- `plugins/user-guides/test/check-guides.test.mjs`: tests set-edit acting as wiki-guides (adopt, the label fix, a refused write-guides move).
- `plugins/user-guides/test/guide-set.test.mjs`: tests `summary` › `publish`.
- `.planning/user-guides/PLAN.md`: the layout now lists `set-edit.mjs` for wiki-guides, and R32 records wiki-guides as built.
- `.planning/user-guides/TRACKER.md`: row 9 ✅, and the session log.

## Decisions & Rationale

- **Share `set-edit.mjs` rather than write a second editor.** Adopt and the label fix need validated edits. One file whose actor comes from its folder keeps every move under the contract's owner checks, and the sync test keeps the copies equal.
- **`go-ahead=yes` covers `needs.adopted`, but not `needs.edited`.** A first publish always lists the top page as adopted, so a go-ahead that did not cover it would never let a first publish through. Overwriting a colleague's edit always needs its own answer.
- **The wiki's location chooses the host.** The Node host refuses anything off this machine anyway, and a real wiki is reached only through Chrome (D7).
- **The stops are fixed text.** This keeps the "never asks for a token" graders robust, and gives the user a predictable message.
- **`summary` › `publish` is a script change** made because an eval showed the gap (the boundary allows that). The contract is unchanged.
- **The rehearsal was delegated to a subagent** to keep the 25 KB script pastes out of the main context. I checked its result against the mock's own state and a screenshot.

## Remaining Work

- Session 10 (by hand, from Clarity) is Checkpoint 2: Clarity's guides on the real wiki, through Kam's Chrome. It has these unknowns:
  - whether Claude in Chrome's `file_upload` reads the project's `.user-guides/` (Playwright MCP needed files under its allowed roots);
  - whether a batch of 9 MB is too big for it (the fallback is `--limit 6000000`);
  - whether the version message on a real wiki is reliable (R31's `topVersion` alternative).
- The `.playwright-mcp/` scratch folder that Playwright MCP creates in the repo root is not git-ignored. The rehearsal deleted it, but a future rehearsal should do the same.

## Resumption Context

Key files to review when picking this up:
- `.planning/user-guides/PLAN.md` (R31, R32)
- `plugins/user-guides/skills/wiki-guides/SKILL.md`
- `plugins/user-guides/skills/wiki-guides/reference/chrome-publishing.md`
- `plugins/user-guides/evals/scripted/lib/wiki.mjs`

Suggested opening prompt for next session:
> "From Clarity, run /planning:session /Users/kstar/_PRJ/cc-star-skills/.planning/user-guides for Session 10 (Checkpoint 2): Clarity's guides on the wiki."
