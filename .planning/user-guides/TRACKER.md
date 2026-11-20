# user-guides plugin roadmap — TRACKER

> The last action of every session is to (1) confirm its verification gate passed, (2) update the row below, and (3) surface the next session's kickoff prompt. If a gate fails, mark the row ⛔, record the blocker here, and **stop** — do not start the next session. If you need a decision the plan doesn't settle and cannot ask for it, mark the row ⛔ with `Needs decision: <question — options>` and **stop**.

`PLAN.md` is authoritative.

> **By hand:** Sessions 4, 5, 10, 11 and 12. Under autopilot, each sets ⛔ `Needs decision: run Session N interactively …` at once (PLAN §4, D14). Sessions 5 and 10 are started from Clarity, and Session 12 from campaign-brief.
>
> **Deadline:** run Session 1 **before about 14 Dec 2026**. Its first step copies code that exists only in two campaign-brief transcripts, which Claude Code deletes about 30 days after their last change.
>
> In the table below, the status emoji appear only in the Status column: autopilot counts any row containing one (PLAN R6).

## Status board

| # | Session | Status | Key artifacts | Verification | Notes |
|---|---|---|---|---|---|
| 1 | Foundations: scaffold, contract, placeholder, fixture app, eval-sandbox spike | ✅ | `plugins/user-guides/` at 0.1.0; the contract (`guide-set.mjs` and `reference/guide-set.md`, identical in both skills); `placeholder.mjs`; `fixtures/leave-app` (v1/v2, change table in its README); `test/stage.mjs`; `test/genericity.mjs`; `sources/` (git-ignored): 23 js + 9 uploads + 4 walk files + README + deny.txt (12 terms) | `npm test` 40 tests (38 pass, 2 skipped: kit-core/md.mjs not built); `claude plugin validate` passes (icon warning); genericity clean over the plugin and the added `.planning/` lines; `sources/` ignored, `git ls-files` empty | Spike: SP1 no (EPERM listen/connect), SP2 no (Chromium dies), SP3 yes (with git caveats), SP4 yes; the scripted `claude -p --plugin-dir` fallback works. S2: read R26 and the contract reference |
| 2 | write-guides: the skill | ⬜ | — | — | |
| 3 | write-guides: evals, tuning, samples for review | ⬜ | — | — | |
| 4 | Checkpoint 1 · interview and templates | ⬜ | — | — | by hand |
| 5 | write-guides on Clarity | ⬜ | — | — | by hand, from Clarity |
| 6 | wiki-guides: screenshots | ⬜ | — | — | |
| 7 | wiki-guides: converter (Confluence and HTML) | ⬜ | — | — | |
| 8 | wiki-guides: mock Confluence and the publisher | ⬜ | — | — | |
| 9 | wiki-guides: the skill, evals, tuning (0.9.0) | ⬜ | — | — | |
| 10 | Checkpoint 2 · Clarity on the wiki | ⬜ | — | — | by hand, from Clarity |
| 11 | Checkpoint 3 · release (1.0.0) | ⬜ | — | — | by hand; Kam pushes |
| 12 | campaign-brief on the plugin: adopt, refresh, republish | ⬜ | — | — | by hand, from campaign-brief |

Legend: ⬜ Not started · 🟡 In progress · ✅ Done · ⛔ Blocked

## Open items / blockers

- [x] **Run Session 1 before about 14 Dec 2026.** Done 20 Nov 2026: `sources/` holds the copies. Its first step copies session 45's Chrome publishing calls and session 42's walk library from campaign-brief transcripts. Both transcripts were last changed on 17 Nov 2026, and Claude Code deletes transcripts after about 30 days.
- [ ] **Kam's availability** for the by-hand Sessions 4, 5, 10, 11 and 12.
- [ ] **Clarity's local stack** on `localhost:3000` (compose project `action-tracker`), seeded with `pnpm seed:e2e` and `seed:film`, for Sessions 5 and 10. The sessions ask before any start, seed or reset, and never stop or reconfigure the stack.
- [ ] **The wiki page to publish Clarity's guides under**: Kam names it in Session 10. It becomes the top page (PLAN R10).
- [ ] **campaign-brief's local stack and its e2e seed**, for Session 12.
- [ ] **The go to push** `main` and `user-guides--v1.0.0` (Session 11), and the patch tag if Session 12 makes one, to `origin` and `GITLAB`.
- [ ] **Review notes** for Sessions 4, 10 and 11.

## Review notes

### Interview and templates (read by Session 4)

(none yet)

### Clarity's guides (Session 5, gathered in the session)

Only decisions that change the plan, plus a pointer. The interview answers live word for word in Clarity's `guides.json`.

(none yet)

### Clarity on the wiki (read by Session 10)

(none yet)

### Release (read by Session 11)

(none yet)

### campaign-brief on the plugin (Session 12, gathered in the session)

Only decisions that change the plan, plus a pointer. The answers, hosts and page ids live in campaign-brief's `guides.json` (PLAN R24).

(none yet)

## Session log

### Session 1: Foundations (20 Nov 2026) ✅

Runtime: opus/high (autopilot attempt 1)

- **Sources.** The C7 ignore lines went in first. A script then copied, from the two campaign-brief transcripts into `.planning/user-guides/sources/`:
  - 23 `javascript_tool` texts and 9 `file_upload` inputs (session 45);
  - the final `walk/lib.mjs` and `w1`–`w3` (session 42; each Write was logged twice under one id, with identical content);
  - plus a `README.md` index and `deny.txt` (12 terms: hosts, a space key, page ids and seed text; the calls contain no people's names).

  The counts matched the plan, and no token value was copied.
- **Plugin.** `plugin.json` 0.1.0 (no `dependencies`, not yet in the marketplace) and the dev `package.json`. Placeholder `SKILL.md` files with `disable-model-invocation: true`.
- **Contract.** `guide-set.mjs` and `guide-set.md`, identical in both skills under the sync test:
  - every §2.3 and R8 key;
  - the five sign-in kinds;
  - the locator syntax, with `target: {what, locator}`;
  - R7's transitions with their owners;
  - the README status block.

  Unknown keys are errors.
- **Placeholder, fixture, staging, genericity.**
  - `placeholder.mjs` writes the SVG card, the link and the alt text.
  - Leave Planner has three roles. Its v2 makes two changes: a renamed button, and a checkbox removed.
  - The `EVAL_LEAVE_APP=1` sign-in helper, the form sign-in, the reset, port 0, and a `CLAUDE.md` that forbids `private/`.
  - `stage.mjs` (with `releaseV2`).
  - `genericity.mjs`: the host rule plus the deny-list; modes for the plugin, given paths, `--added` and `--text`.
- **Spike.** Recorded in PLAN §3, with the consequences in the new R26.
  - SP1 no: listen and connect to 127.0.0.1 both fail with EPERM.
  - SP2 no: Chromium starts and then dies.
  - SP3 yes. Caveats: the in-run `/usr/bin/git` fails while CommandLineTools' git works; `file_exists` graders see only files the run writes.
  - SP4 yes.
  - A scripted `claude -p --plugin-dir` run reached the fixture, launched Chromium and ran git.
  - Four spike rounds cost about $0.70.
- **Deviations from PLAN.md.**
  - R26 was added.
  - Staging writes the canary file only when asked. The first spike run showed that `--into` put it inside the eval workspace.
  - The fixture's `npm start` uses port 0 (C6).
  - The genericity check skips `plugin.json`'s author, homepage and repository and `package-lock.json`, and allows `www.w3.org` namespaces and this repo's GitHub URL.
- **Small choices** (logged per the working rules):
  - `schemaVersion: 1`;
  - `deviceScale` defaults to 2;
  - a non-local `baseUrl` or an unknown role is a warning, not an error;
  - a placeholder's `path` must be the `.svg`.
- **Searches.** None started at a repo root. campaign-brief was read only through its two transcript files (by script), and `briefs/` was never touched.
