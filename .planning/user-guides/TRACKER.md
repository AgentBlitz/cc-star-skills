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
| 2 | write-guides: the skill | ✅ | `SKILL.md` (85 lines, model-invocable); reference `interview.md` `recon.md` `walking.md` `guide-types.md` `style.md` `refresh.md`; 4 templates; `kit-core.mjs` (identical in both skills), `walk-lib.mjs`, `check-guides.mjs`, `set-edit.mjs` (new, R27); 4 test files | `npm test` 68 tests (67 pass, 1 skipped: `md.mjs` not built); sync test includes `kit-core.mjs`; two walks of the staged fixture byte-identical (40,498-byte outline); `check-guides` passes on the dry run; `claude plugin validate` passes; genericity clean | Dry run: 4 guides and 8 placeholders, all `checked`; v2 refresh and an adopt both passed. A browser walk equals a fetch walk. Known limit for S3: a label renamed in one place but kept in another passes the label check (R27) |
| 3 | write-guides: evals, tuning, samples for review | ✅ | `evals/run.sh` (format / scripted / all), `evals/scripted.mjs`, `evals/lib/scaffold.mjs`, the `claude` shim and git wrapper; 4 eval-format cases (`write-guides-headless-round-1`, `-code-path`, `-non-local`, `-adopt`) and 2 scripted (`-first-guides`, `-refresh-v2`); `evals/triggers/write-guides.json` (20 queries); `fixtures/leave-app-guides/` (frozen set); `.planning/user-guides/samples/` for S4; `test/cli-symlink.test.mjs` | Final pass, every case 2/2 with the skill, score 1.00. Baseline (no plugin): headless 0.625, code-path 0.30, non-local 0.60, adopt 0.375, first-guides 0.29, refresh 0.25 (Δ +0.525 mean on the format cases, +0.71 and +0.75 scripted). Trigger: held-out 7/8 queries (21/24 runs, precision 100%, recall 75%), then 20/20 on the full set after adding "check" to the description. `npm test` 69 (68 pass, 1 skipped); validate passes; no `.claude/` left behind | Cost ≈ $15 of eval runs (format ≈ $6.7, scripted ≈ $8.2), plus the trigger loops (not metered). Skill changes the evals asked for: picture rules in `style.md`, portable walk scripts (`walking.md`, `refresh.md`), a symlink-safe main guard in every script, "check" in the description. Samples for S4: `.planning/user-guides/samples/` |
| 4 | Checkpoint 1 · interview and templates | ✅ | Kam's answers and notes (TRACKER › Review notes); `interview.md` wording v2; `style.md` lean-set rule; `guide-types.md` kind ids; `walking.md` preflight bullet; grader `lean-pictures` | npm test 68 pass; format 4/4 (Δ +0.47); scripted 2/2 + 2/2 | by hand; verdict: notes, 6 closed (language, folder, URL, Round 2a, ids, pictures) |
| 5 | write-guides on Clarity | ✅ | Clarity: `docs/user-guides/` (6 guides, README index, `guides.json`, 12 placeholder cards; Clarity commit, by go-ahead) and its git-ignored `.user-guides/walk/states.mjs`. Plugin: `kit.screenNames`, `walk.open(role, { signedOut })`, a readable `outline.md`, `summary` with the answers and app, wording fixes in SKILL.md, `interview.md`, `walking.md`; 4 new tests | `check-guides`: 6 guides, 12 shots, walked; all checks pass, all 6 `checked`. Allowlist (R23): every person and quoted line in the guides and shot states is in the tracked seed sources; no address; no mention of `docs/feedback/`. `npm test` 72 (71 pass, 1 skip). Format 4/4 (every run 1.00, Δ +0.47); scripted 2/2 + 2/2 (1.00). `claude plugin validate` passes | by hand, from Clarity. Pictures 4/5/2/1/1/1, notChecked 23, leftOut 0. Friction: 13 items, 9 fixed (S5 log). Plan change: S6 takes signed-out shots |
| 6 | wiki-guides: screenshots | ✅ | wiki-guides `templates/guides-kit.mjs` (kit-core embedded, sync-tested) and `templates/shots.template.mjs`; `scripts/shots-kit.mjs` (install / check / blocks, new, R29) and `scripts/swap-shots.mjs`; `reference/screenshots.md`; `test/shots.test.mjs` (6), `test/embed-kit.mjs`; check-guides lets a `blocked` shot keep its card | `npm test` 79 (78 pass, 1 skip: `md.mjs`); all 5 fixture shots taken, review copies half size; fetch walk = browser walk = shot for all 5 (and a signed-out shot); v2: fingerprints flag exactly `settings` (R28's oracle), swap-shots retakes only it, the other 4 PNGs and entries unchanged; no sign-in value printed or stored; `claude plugin validate` passes; genericity clean | Shots 5 (frozen set). v2 flagged: 1 (`settings`). Walk-and-shot agreement: 5/5. Plan change: `shots-kit.mjs` joins the layout (R29) |
| 7 | wiki-guides: converter (Confluence and HTML) | ✅ | `md.mjs` (both skills, sync-tested); wiki-guides `scripts/to-confluence.mjs`, `to-html.mjs`, `bundle.mjs`; `templates/test-page.md` + `test-page.png`; `reference/confluence.md`, `reference/html.md`; check-guides' `subset` rule; `test/convert.test.mjs` (13), `test/xml.mjs`, `test/golden/` | Goldens pass: storage format (4 files) and HTML (3 pages) of a synthetic two-folder set; every page well-formed (own check and xmllint). `npm test` 93/93, the `md.mjs` sync test included (no skip). Clarity: 6 guides, 0 unsupported-construct errors; a strict run stops on the 14 placeholder references; with `--allow-placeholders`, 8 storage files and 7 HTML pages, all well-formed, 1 upload batch. `claude plugin validate` passes; genericity clean | Constructs: every one in §2.5, all six heading levels, the five alerts, a duplicate heading's `-1`, cross-folder guide links, the README as the top page, and a repo file shown as text. Plan change: R30; `test-page.png` joins the layout |
| 8 | wiki-guides: mock Confluence and the publisher | ✅ | `fixtures/mock-confluence/` (`server.mjs`, README); wiki-guides `scripts/publish-core.js`, `publish-node.mjs`, `check-page.js`, `publish-kit.mjs` (target / input / record, new, R31); `reference/chrome-publishing.md`; `bundle.mjs --only`; `pageXhtml`'s `ownImages`; `test/publish.test.mjs` (14) | All six scenarios pass (first publish, republish after v2, an edit on the wiki since, adopted pages, Cloud refused, unknown refused), plus a title used elsewhere and three other stops. In headless Chromium against the mock: inject, `setInputFiles`, test page, attach in two batches, publish, reload and inject again (nothing left to send). `check-page` catches 900 px in a 656 px column and passes at 640. `npm test` 107/107, genericity clean over 118 files; `claude plugin validate` passes | Mock learnt: the version check (409), unique titles (400), the trash frees a title, the attachment token (403), a same-named attachment (400), `/data` replaces, title-prefixed anchor ids, a context path. Plan change: `publish-kit.mjs` joins the layout (R31). Contract unchanged |
| 9 | wiki-guides: the skill, evals, tuning (0.9.0) | ✅ | wiki-guides `SKILL.md` (139 lines, model-invocable; Round 1, adopt round, three fixed stops); `reference/recording.md` (record, README section, report, adopt); `set-edit.mjs` shared (R32); `summary` gains `publish`; touch-ups to `chrome-publishing.md` and `screenshots.md`; 9 eval cases (3 format, 6 scripted) and `evals/scripted/lib/wiki.mjs`; `evals/triggers/wiki-guides.json` (20); `plugin.json` 0.9.0 | Second pass, every case 2/2 with the skill, score 1.00. Baselines: format headless-round-1 0.60, html 0.25, no-token 0.40 (mean Δ +0.58); scripted first-publish 0.50, republish-v2 0.50, adopt-pages 0.67, label-and-needs-text 0.60, cloud-refused 0.25, no-go-ahead 0.25. Trigger: held-out 8/8 queries (24/24 runs), train 12/12, precision and recall 100%. `claude plugin details`: ~455 tok always-on (wiki-guides ~250, ~3.3k on invoke). Rehearsal of `chrome-publishing.md` with Playwright MCP against the mock: PASS end to end. `npm test` 110/110; `claude plugin validate` passes; genericity clean | First pass 4 of 6 scripted cases at 1/2 (go-ahead scope, a missed removed control, a republish read as unpublished); fixed in SKILL.md and `summary`. Eval runs ≈ $8. Plan change: R32 (`set-edit.mjs` shared). Contract unchanged |
| 10 | Checkpoint 2 · Clarity on the wiki | ✅ | Clarity (commit by go-ahead): `scripts/user-guides/shots.mjs` + `guides-kit.mjs`, 12 PNGs for the 12 cards, `guides.json` (shots taken, publish record), a `.prettierignore` line. Plugin: images fit the column (R33); no banner on wiki pages (R34); scripts loaded by upload, short tool answers, `record` checks hashes (R35); plain SHA-256 in `kit-core.mjs`, browser globals declared in the kit; the mock sizes images as Data Center; README section opt-in; graders on the version message; 4 new tests | Real wiki (DC 9.2.13): test page made, checked, removed; 6 pages created and the top page updated, 12 images in one batch; `check-page` ok on all 7 pages, twice (first publish, then the banner's removal); final plan every page `skip`; second publish 0 created, 0 updated, 7 unchanged. Rehearsal in Chrome against the mock passed first. `npm test` 114/114; validate passes; genericity clean. Evals (partial, stopped to hand over): format `-headless-round-1`, `-html`, `-no-token`, `write-guides-adopt` 1.00 each (Δ +0.40, +0.75, +0.60, +0.63), `-code-path` run 1 1.00 (run 2 interrupted); the scripted cases run first in S11 | by hand, from Clarity; verdict: approved. Kam's choices: pictures fit the column, no banner, no README section. Mock fix: image sizing. Known limit: the page tree sorts children alphabetically |
| 11 | Checkpoint 3 · release (1.0.0) | ⬜ | — | — | by hand; Kam pushes |
| 12 | campaign-brief on the plugin: adopt, refresh, republish | ⬜ | — | — | by hand, from campaign-brief |

Legend: ⬜ Not started · 🟡 In progress · ✅ Done · ⛔ Blocked

## Open items / blockers

- [x] **Run Session 1 before about 14 Dec 2026.** Done 20 Nov 2026: `sources/` holds the copies. Its first step copies session 45's Chrome publishing calls and session 42's walk library from campaign-brief transcripts. Both transcripts were last changed on 17 Nov 2026, and Claude Code deletes transcripts after about 30 days.
- [ ] **Kam's availability** for the by-hand Sessions 4, 5, 10, 11 and 12.
- [ ] **Clarity's local stack** on `localhost:3000` (compose project `action-tracker`), seeded with `pnpm seed:e2e` and `seed:film`, for Sessions 5 and 10. The sessions ask before any start, seed or reset, and never stop or reconfigure the stack. (S5 ✓ 20 Nov 2026: up and seeded; nothing was started, seeded or reset.) (S10 ✓ 21 Nov 2026: up and seeded; nothing was started, seeded or reset.)
- [x] **The wiki page to publish Clarity's guides under**: Kam names it in Session 10. It becomes the top page (PLAN R10). (S10 ✓ 21 Nov 2026: a new empty page titled CLARITY, which Kam made; its address lives only in Clarity's `guides.json`, R24.)
- [ ] **campaign-brief's local stack and its e2e seed**, for Session 12.
- [ ] **The go to push** `main` and `user-guides--v1.0.0` (Session 11), and the patch tag if Session 12 makes one, to `origin` and `GITLAB`.
- [ ] **Review notes** for Sessions 4, 10 and 11. (S4 ✓ 20 Nov 2026: notes applied. S10 ✓ 21 Nov 2026: approved, three choices recorded.)

## Review notes

### Interview and templates (read by Session 4)

- S3: the samples are `.planning/user-guides/samples/` (3 guides, 5 placeholders). Worth a look: the guides are lean (≈ 350–600 words each), and S3 added two picture rules to `style.md` (picture each task's first unseen screen; crop to the region the alt text names). Both come from eval runs, not from Kam.
- **S4 (20 Nov 2026): Kam's interview answers** (wording v1, the fixture's detected values, AskUserQuestion):
  - `readers`: Every role: employee, manager, admin
  - `kinds`: Getting started, Features and value, Admin and operations, Role guides, one per role, by task
  - `depth`: A short tour of each screen
  - `whereRead`: In the repo and on a wiki
  - `languageTone`: en-GB, plain and direct
  - `pictures`: Placeholders now, screenshots later
  - `facts`: Walk the local app as each role
  - `folder`: docs/user-guides/
  - `appBaseUrl`: It isn't running: you may start it with npm start
  - `appSignIn`: A helper that prints a session cookie
  - `appReset`: No, walk the data as it is
  - `approval`: Approve as proposed (6 guides)
- **S4: Kam's verdict: notes**, word for word. He answered the six gaps raised while asking the rounds:
  > picking up on the roles - 1. UK english plain and direct is fine. 2. the folder should be in the repo of the application. 3. well yes the app might need running - we have for clarity a running app if needed but it doesn't have synthetic data in it, so the local will be fine. 6. fine, I just don't want a really unweildy manual will a million images - so try and strike a balance
- **S4: Kam's follow-ups:**
  - Folder: "Root docs/user-guides/ is right; fix 2nd option".
  - Pictures: "One per screen + cap per guide".
  - App URL: "Recommend starting it + data check".
  - Gaps 4 and 5: "Fix 5: id collision, Fix 4: Round 2a wording".
  - The templates and samples were approved otherwise.
  - The checklist and its evidence are in the S4 session log.

### Clarity's guides (Session 5, gathered in the session)

Only decisions that change the plan, plus a pointer. The interview answers live word for word in Clarity's `guides.json`.

- From S4 (Kam): Clarity has a running app, but it holds no synthetic data. Walk a local, seeded copy instead (walking.md › Preflight). Ask before any start or seed, as the standing rules say.
- **S5 (20 Nov 2026):** the interview answers and the approval ("Approve as proposed", six guides) are word for word in Clarity's `docs/user-guides/guides.json`. No start, seed or reset was run: the local stack was up and seeded, and every role signed in.
- **Changes the plan:** S6's `shots.template.mjs` takes signed-out shots, `as(role, { signedOut: true })`, because Getting started pictures the sign-in screen (PLAN §5 Session 6, §3 Review notes).
- **For S10:** the local account table holds test residue (accounts made by e2e runs), so the People shots crop to its forms, never the table.

### Clarity on the wiki (read by Session 10)

(none before the session; gathered in it, 21 Nov 2026)

- **The page:** Kam made a new empty page titled CLARITY and pasted its address mid-session. Its host, space and id live only in Clarity's `guides.json` (R24).
- **The release:** "1.12.0 (Recommended)": the last tag was 1.11.0, but the guides show four later changes.
- **Pictures:** "Fit the column (Recommended)", over "Fixed, smaller width" and "Fit, at real size". The real wiki turns off the fit for any image with a width, and Kam's column was 470 px (a wide page tree). PLAN R33.
- **The banner,** word for word: "on every page published on the wiki we have a standard text at the top - this can be either a) at the bottom or b) probably better just not put there at all since nobody is suppose to edit those pages outside this loop - this may have an impact on the feedbac to provide the skill roadmap". Done as b): no banner on wiki pages, the release in each update's version message. PLAN R34.
- **The README:** "No README section" for Clarity's guides. The skill now asks before adding it, and never re-adds it once declined (`recording.md` § 2).
- **The Clarity commit:** "Yes, commit (Recommended)", with lint, typecheck, `check:log-fields` and `check:connector-surface` first; `pnpm test` not run (it needs the worker stopped, and the stack is never touched).
- **Verdict:** "Approve as-is".

### Release (read by Session 11)

- From S10: the eval run after S10's fixes was stopped part-way so S11 could start (format: 4 cases 1.00, `write-guides-code-path` 1 of 2 runs). **The scripted cases have not run since S10 changed three of their graders** (`-first-publish`, `-adopt-pages`, `-republish-v2`, now on the version message, R34) and the publisher: S11's full eval run is their first. A failure there is an S10 regression, to fix before the release.
- From S10: `SKILL.md` step 8 and `recording.md` § 2 (README section asked first, never re-added once declined) changed after the eval copy was staged; no eval has seen them.

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

### Session 2: write-guides: the skill (20 Nov 2026) ✅

Runtime: opus/high (autopilot attempt 1)

- **Skill.** `SKILL.md` (85 lines) is orchestration only: it routes by argument (`refresh`, `adopt`, `check`, answers), lists the never-dos and gives seven steps, each naming its reference file. Its frontmatter has `argument-hint` and `allowed-tools`, with no `disable-model-invocation`; `claude plugin validate` passes.
- **References and templates.** `interview.md` is wording version 1: three rounds plus Round 2a (running the app, only for what recon left open), adopt's round, skip rules with `id=value` arguments, the answer → file map, and the headless print-and-stop form. The other references are `recon.md` (three briefs, report shapes, ≤ 15 lines), `walking.md`, `guide-types.md`, `style.md` and `refresh.md` (refresh and adopt), plus four templates.
- **Scripts.**
  - `kit-core.mjs` (identical in both skills; the sync test now requires it): the D10 Playwright lookup, sign-in for D9's five kinds, and one dependency-free HTML reader with D3's fingerprint. A browser walk passes it `page.content()`, so a browser walk and a fetch walk agree, and a test holds this.
  - `walk-lib.mjs`: generalised from session 42's `open`/`go`/`dump`/`api`, plus a crawl, deterministic outlines, `diff` and `refresh`.
  - `check-guides.mjs`: every check in §5, plus `template` and `index`.
  - `set-edit.mjs`: new (R27). Every change to `guides.json` goes through the contract. `guide-set.mjs` and `guide-set.md` are unchanged.
- **Dry run** (R13), on staged copies, with every answer in `guides.json`:
  - recon read the tracked files only, never `private/`; the canary is nowhere in the output;
  - preflight and a browser crawl: employee 5 screens, manager 6, admin 6;
  - a second crawl gave a byte-identical outline;
  - two walk scripts: a request sent and approved, and the refusal pages;
  - four guides (getting started, employee, manager, admin) and eight placeholders;
  - `check-guides` first found two real problems. The employee guide bolded **Inbox**, which employees never see, and the admin's refusal message had not been walked. Both were fixed, and then it passed and `--mark-checked` set every guide to `checked`.
  - **Refresh:** after `releaseV2`, `diff` named the renamed button and the removed checkbox, and the check flagged the removed label. The text was updated and the two edited guides were checked again.
  - **Adopt:** a hand-written guide with a PNG was registered as `written` and the image as `taken`; the refresh marked it `retake`, and the guide passed once its alt text and left-out screens were fixed.
- **Headless smoke run** (`claude -p "/user-guides:write-guides" --plugin-dir …`, sonnet, about $0.10): it printed Round 1 in the fixed form and stopped, with nothing written.
- **Small choices.**
  - Headless printing happens before recon, with generic role options.
  - A shot's `state` starts with its screen's path.
  - The label check is per audience.
  - Named dumps are separate outline entries (found in the dry run).
  - `updateShot` changes the spec fields only.
- **Deviation from PLAN:** `set-edit.mjs` was added to §2.4's layout (R27). Nothing else changed shape.
- **Searches.** None started at a repo root. In campaign-brief, the session read one session summary and listed the headings of three guides, all named files, and never touched `briefs/`. Sources were read from `.planning/user-guides/sources/`.
- **Caution.** One `pkill -f "node server.mjs"`, used to stop the dry-run fixture, was broader than needed. Later servers were stopped by PID. No other stack is known to have been affected.

### Session 3: write-guides: evals, tuning, samples for review (20 Nov 2026) ✅

Runtime: opus/medium (autopilot attempt 1)

- **Harness (R16, R26, R28).** `bash evals/run.sh [format|scripted|all]` stages the plugin without `node_modules`. `format` runs `claude plugin eval` with `--no-publish --scaffold --trust-plugin` and its own no-plugin baseline arm. `scripted` runs `evals/scripted.mjs`: a scaffold, then `claude -p` through the shim (`--plugin-dir`) and plain `claude` for the baseline, with the same grader kinds plus `script` graders. Walk and refresh cases are scripted (SP1/SP2: a format run can't reach 127.0.0.1).
- **Cases.** Every one checks that the canary prefix never appears in the trace.
  - Format: `write-guides-headless-round-1` (prints Round 1, stops, writes nothing); `-code-path` (answers given, facts from the code: 3 guides, cards and entries, `notChecked[]` non-empty, `check-guides` passes "no walk"); `-non-local` (`https://leave.example.com` is never walked, preflighted or fetched); `-adopt` (two hand-written guides `written`, two images `taken` with no fingerprint, guide files not edited).
  - Scripted: `-first-guides` (walks v1, 3 guides `checked`, every picture a placeholder linked from its guides, the index, the ignore line) and `-refresh-v2` (from the frozen set with pictures taken at v1: exactly the R14 shots `retake`, the button now **New request**, the checkbox gone, the dialog's name kept).
- **Results (final pass, 2 runs each with the skill, all passing).** Baselines: 0.625 / 0.30 / 0.60 / 0.375 (format, mean Δ +0.525), first-guides 0.29 (Δ +0.71), refresh 0.25 (Δ +0.75). Trigger tuning: `run_loop.py` kept S2's description (held-out 7/8 queries, 21/24 runs; train 12/12). The one miss was the `check` route, so "check" went into the description; the full 20 then scored 20/20 (no longer held out).
- **Skill changes the evals asked for.**
  - `style.md`: picture each task's first unseen screen. Crop to the region a step is about, and only to a region that holds everything the alt text names. The runs made no Requests or Settings shots, then cropped a table while naming the toolbar's filter.
  - `walking.md`, `refresh.md`: kept walk scripts import from `USER_GUIDES_SCRIPTS`. The first run's script imported an absolute temp path.
  - Every script's main guard compares real paths. Called through `/var/folders` (a symlink to `/private/var`), the CLIs exited 0 having done nothing. A run found and worked around this; the refresh scaffold failed on it. `guide-set.mjs` changed byte-identically in both skills; the contract is unchanged. Regression test: `test/cli-symlink.test.mjs`.
  - `SKILL.md` description: "write, update, refresh or check … from or against the app itself".
- **Frozen set.** `fixtures/leave-app-guides/` is run 0 of the third first-guides pass (3 guides, 5 placeholders). Its walk script's import was rewritten to the new convention. Against v2 exactly **one** shot retakes (`settings`), not the two R14's one-shot-per-screen assumption gives (R28). It is copied to `.planning/user-guides/samples/` for S4.
- **Deviations from PLAN.**
  - C8's "prove it by the `Base directory` line" can't be done from either trace, so the indicator matches the staged path in the run's tool calls (R28).
  - The git wrapper goes in the stage's `.eval-bin/`, not `evals/bin/`, because runs can't read `evals/` (R28).
  - Trigger tuning ran with one worker (R28).
  - The walk preset answers depth "Every task, step by step", so the set covers both changed screens. The code preset keeps "The main tasks only".
- **Small choices.** Eval models are sonnet. Scripted runs use `--setting-sources project,local --strict-mcp-config`. One baseline run per scripted case. The trigger loop ran on sonnet: 3 runs a query, at most 3 iterations, a 45 s timeout.
- **Searches.** None touched campaign-brief or Clarity, and none started at a repo root.

### Session 4: Checkpoint 1 · interview and templates (20 Nov 2026) ✅

Runtime: opus/high (interactive, by hand)

- **Interview.** Kam answered Rounds 1, 2, 2a and 3 through AskUserQuestion. The wording was v1, word for word, with the fixture's detected values: roles employee, manager, admin; language en-GB from `<html lang>`; no docs folder; no running URL; the cookie helper; `npm run reset`. Kam's answers are under Review notes › Interview and templates.
- **Verdict: notes.** Asking the rounds raised six gaps. Kam answered them, and approved the templates and samples otherwise. The checklist, each item closed with evidence:
  1. **Language: no repeated option** (`interview.md` Round 2). Before: `<detected language>, plain and direct` sat beside "UK English, plain and direct", so en-GB gave two of the same. After: the detected language is named in words, and when it is UK or US English that option is first and Recommended, with no repeat.
  2. **Folder: a second option** (`interview.md` Round 2). Before: with no docs folder and no guides found, `docs/user-guides/` was the only option, and AskUserQuestion needs two. After: every folder is in the app's own repo, from its root, and the second option is "Another folder in this repo".
  3. **App URL: recommend starting a local copy** (`interview.md` Round 2a, `walking.md` § Preflight).
     - Before: `<URL recon found> (Recommended)` dropped out when no URL was found, leaving nothing Recommended.
     - After: a running URL is Recommended only when recon found the synthetic accounts in its data; otherwise "start it with `<start command>`" comes first and is Recommended.
     - New preflight bullet: when a role can't sign in at a running app, an interactive run offers a seeded local copy (seed only with a yes) or the code path; a headless run takes the code path.
     - Kam's Clarity fact is recorded for S5.
  4. **Round 2a: confirm what recon found** (`interview.md`, `recon.md`). Before: "Asked only when recon could not settle it" contradicted the Recommended option "the sign-in kind recon found". After: a value recon found is asked once, as the Recommended option. The round is skipped only when `guides.json` or the arguments already hold the base URL, sign-in, accounts and reset.
  5. **Ids** (`guide-types.md`). Before: "else the kind (`getting-started`, `admin`)", so an admin role guide and Admin and operations were both `admin` and both `admin.md` (`addGuide` throws on the second). After: a kind's id is the kind itself (`admin-operations`).
  6. **A lean set** (`style.md` › Pictures). New rules: each screen or region is pictured at most once across the set, reused through `guides`; at most five pictures a guide; none in the index.
     - The new grader `evals/scripted/write-guides-first-guides/graders/pictures.mjs` (`lean-pictures`) checks both.
     - Frozen set: pass (1/3/1, 5 shots).
     - A copy with a duplicate shot and 6 images in employee.md: fail, with both problems named.
     - Eval runs: pass (1/3/2 with 6 shots, and 1/3/1 with 5).
- **Wording version 2.** Set in `interview.md`, `evals/lib/scaffold.mjs` and PLAN (the interview reconciliation). PLAN §3 › Review notes has the summary. Old sets with "1" still validate.
- **Gate.**
  - `npm test`: 68 pass, 1 skip (`md.mjs`, not built until S7).
  - `bash evals/run.sh format --case 'write-guides-*'`: 4/4, every case 1.00 with the skill.
    - Baselines: adopt 0.38, code-path 0.30, headless-round-1 0.63, non-local 0.80. Mean Δ +0.47, $2.45.
  - `bash evals/run.sh scripted`: first-guides 2/2 1.00 (baseline 0.38), refresh-v2 2/2 1.00 (baseline 0.25), $2.11.
  - Results: `evals/results/scripted-2026-11-20T16-02-14-477Z/`.
- **Deviations.** None from PLAN. The plan-mode questions to Kam followed the checkpoint protocol.
  - AskUserQuestion needs two options, so the v1 folder question got a filler second option. That is exactly gap 2, now fixed.
  - The baseline passes `lean-pictures` trivially (0 shots), so the grader adds no Δ. It is a guard, not a discriminator.
- **Searches.** None touched campaign-brief or Clarity, and none started at a repo root.

### Session 5: write-guides on Clarity (20 Nov 2026) ✅

Runtime: opus/high (interactive, by hand, from Clarity)

- **The run.** `/user-guides:write-guides` in Clarity, from no `guides.json`:
  - **Recon:** three Explore agents in one message, each on named, git-tracked folders, never `docs/feedback/`. Roles user, admin (a user with People) and operator; en-GB; cookie-command sign-in; Playwright in `apps/web`; no end-user guides yet.
  - **Interview:** Kam answered Rounds 1, 2 and 2a live (wording v2) and approved the outline as proposed. The answers are word for word in Clarity's `docs/user-guides/guides.json`.
  - **Walk:** a browser walk of the local stack, which was already up and seeded. Nothing was started, seeded or reset. The crawl covered 19 screens for user, 2 for admin and 1 for operator in 20 s. Then `.user-guides/walk/states.mjs` added 17 named states: panels and dialogs, a forwarded email opened, a sign-up link's confirmation (asked, then cancelled), the not-found page, and 4 signed-out screens. It opens things only; nothing was submitted.
  - **Write:** six guides: getting-started, user, admin, operator, features-and-value, admin-operations. 12 placeholder shots (4/5/2/1/1/1 a guide, each screen once), 23 `notChecked[]` claims (states the local data can't show: an open registration, a sign-up link, a locked account, a proposed rule), and no `leftOut[]`.
  - **Check:** 72 problems at first (51 labels, 20 coverage, 1 index), then 40 after the coverage fix, then 0. Every guide is now `checked`.
- **Friction log** (13 items, 9 fixed in the plugin, with tests where the code changed):
  1. **Fixed.** `$S` read as the skill's base folder, so the first `set-edit` call failed. SKILL.md now says `S=<base directory>/scripts`.
  2. **Fixed.** Round 1 is recorded before Round 2 asks the folder. `interview.md` now says: record at the default folder, and move the file if the answer differs.
  3. **Fixed.** The third folder option has no value when recon found no guides. `interview.md` leaves it out.
  4. **Fixed.** There was no place to choose between several synthetic accounts for one role. The `appSignIn` option's description now names the account for each role (`interview.md`).
  5. **Fixed.** A page title carrying an unread count ("(1) Today") never matched guide text, so all 20 coverage failures came from this. `kit.screenNames` strips the count, and check-guides and walk-lib both use it (+ kit-core test).
  6. **Not fixed.** The crawl records each id variant as its own screen (a task, an email or a focus position each), about half of one role's screens. Coverage passes by name, so it is harmless. A candidate for S9 tuning.
  7. **Fixed.** `outline.md` was 55 KB, with lines up to 5.9 KB, and per-row buttons repeated dozens of times. Repeats are now listed once as `×N`, names are cut at 80 characters, and named states are labelled in the heading (+ walk-lib test). The longest line is now 2.9 KB.
  8. **Fixed.** No way to walk the screens before sign-in. `walk.open(role, { signedOut: true })` and `walking.md` provide one (+ walk-lib test). S6 takes such shots (PLAN).
  9. **Not fixed.** The text dumps leave out form field values, so a proposed action's Title reads empty.
  10. **Not fixed, by design.** Claims about states the walk can't reach went into `notChecked[]` by hand (23). `--record` stays code-path only, so a walked set never excuses a label silently.
  11. **Writer error.** Bold used for emphasis (pseudo-headings, bullet leads: 12 labels). The label check caught it, and `style.md` already forbids it.
  12. **Fixed (eval).** `write-guides-code-path` failed 1 run in 2, twice. `summary` printed counts only, so a headless run read a fully answered set as unanswered and stopped at Round 1. `summary` now prints the answers, the wording version and the app (+ guide-set test), and SKILL.md step 0 says an answered id is settled. The case then passed 4/4 and 2/2.
  13. **Environment.** This machine cut tool output at about 4–5 KB, well under 150 lines, so the dumps were read in pieces.
- **Gate.**
  - `check-guides` passes on Clarity's guides, and all 12 shots are in the ledger, one card each.
  - Allowlist (R23): each person, quoted line, subject and task in the guides and shot states was found in the tracked seed sources (`git grep` over the seed fixtures and seed scripts). There are no addresses. The authenticator names come from the app's own wording. Nothing mentions `docs/feedback/`.
  - `npm test`: 72 (71 pass, 1 skip).
  - `bash evals/run.sh format`: 4/4, every run 1.00, mean Δ +0.47.
  - `bash evals/run.sh scripted --baseline-runs 0`: first-guides 2/2, refresh-v2 2/2, 1.00. No baseline: this is a regression check.
  - `claude plugin validate`: passes.
  - Eval spend ≈ $10.64 (the first pass, two diagnosis re-runs with `--keep-temp`, the 4-run check and the final pass). The kept sandboxes were removed afterwards.
- **Commits.** Clarity: the guides folder and the `.user-guides/` ignore line, one commit, with Kam's go-ahead. cc-star-skills: the plugin fixes, PLAN, the tracker and the summary. Nothing pushed.
- **Deviations.** None from PLAN. PLAN §5 Session 6 gains `as(role, { signedOut: true })`, and §3 › Review notes records why.
- **Searches.** In Clarity, every search named its folders: recon's agents and the seed allowlist. Recon's `git ls-files | cut -d/ -f1` at Clarity's root listed the top-level folders, as `recon.md` prescribes. It was a listing, not a search. No search started at a root. campaign-brief was not touched.

### Session 6: wiki-guides: screenshots (20 Nov 2026) ✅

Runtime: opus/high (interactive `/planning:session`)

- **Built.**
  - `shots-kit.mjs install` copies the stamped `guides-kit.mjs` and writes `shots.mjs`, one block per shot (a page per role, signed in or out; `open` the state's path; `shot`).
  - `shots.mjs` has `--check`, all shots, names, or `--pending`. Its shots go to `.user-guides/out/` (full size, half-size review copy, manifest with fingerprints).
  - `swap-shots.mjs` moves them into the guides and `guides.json`.
  - The API and rules are in `reference/screenshots.md` and PLAN R29.
- **Gate.**
  - **Every fixture shot:** `npm test` takes all 5 shots of the frozen set on a staged v1. The whole screens are 2560 px wide; the crops are smaller. Each review copy is half size.
  - **R14 after v2:** the shots' own fingerprints differ from v1 for `settings` only, which matches R28's oracle (`mustRetake`). Refresh marks only `settings` retake, and swap-shots retakes only it. The other four PNGs are byte-identical, and so are their `guides.json` entries.
  - **R12:** the fetch walk's and the browser walk's `shotFingerprint` equal the shot's for all 5. A signed-out shot of `/sign-in` agrees with a signed-out walk dump.
  - **Secrecy:** the fixture's two cookie values appear in no output and in no file under `.user-guides/out/`, `scripts/` or `docs/`.
  - **Also:** `npm test` 79 (78 pass, 1 skip); `claude plugin validate` passes; genericity is clean over 88 plugin files and this session's `.planning/` lines.
- **Looked at.** The review copies of all 5 shots. The first pass showed an empty band under short whole screens, so whole screens now end at their content.
- **Deviations.**
  - `shots-kit.mjs` was added to the layout (§2.4, R29).
  - check-guides' rule "a card is shown only for `placeholder` / `needs-text`" now includes `blocked`: blocked from placeholder there is no PNG yet (R7).
  - `kit-core.mjs` is unchanged, and so is the fingerprint's definition.
- **Not run.** The write-guides evals: the only write-guides change concerns `blocked` shots, which no write-guides eval produces.
- **Searches.** In campaign-brief: `scripts/wiki/screenshots.mjs` was read for structure, and the archived session summary was grepped by its path. No search started at a repo root. Clarity was not touched.

### Session 7: wiki-guides: converter (Confluence and HTML) (20 Nov 2026) ✅

Runtime: opus/medium (autopilot attempt 1)

- **Built.**
  - `md.mjs` is the subset's parser, the same file in both skills. A construct outside the subset fails with `file:line`, or, with `--escape-unsupported` (only with the user's go-ahead), shows as escaped text.
  - `to-confluence.mjs` writes storage format: the banner, the top page (R10), anchor macros, the code macro and the alert macros, images at `min(cap, px / scale)` attached to the top page, and cross-folder links. Its `pages.json` lists pages and images. A placeholder card stops it unless `--allow-placeholders`.
  - `to-html.mjs` writes self-contained pages with data-URI images, plus `index.html`. `bundle.mjs` makes upload batches under 9 MB.
  - check-guides gained a `subset` rule and now takes its slugs and anchors from `md.mjs`. `style.md` names what the subset leaves out.
  - Facts for S8–S10 are in PLAN R30.
- **Gate.**
  - **Goldens:** `test/golden/expected/` (storage format: top, two guides, `pages.json`; HTML: index and two pages) match. Every page is well-formed under `test/xml.mjs` and `xmllint`.
  - **Clarity:** read-only conversion into `plugins/user-guides/test/.out/clarity/`. 0 unsupported-construct errors in its 6 guides, so the converter needed no fix. A strict run lists the 14 placeholder references (12 cards) and writes nothing. With `--allow-placeholders` it writes 8 storage files and 7 HTML pages, all well-formed, and 1 upload batch. Clarity's `git status` for its guides folder is clean.
  - **Also:** `npm test` 93/93, with the `md.mjs` sync test no longer skipped. The frozen fixture guides keep to the subset. `claude plugin validate` passes, and genericity is clean over 110 plugin files and this session's `.planning/` lines.
- **Small choices.**
  - The top page's title is an argument (`--top-title`), because guide pages reach the top page by title. Its default is the README's title. S8 passes the real title.
  - The README intro is its opening paragraphs only. The README's own list supplies each guide's description in the generated list.
  - "On this page" appears only when the top page has headings.
  - The alert mapping: NOTE and TIP → `info`, IMPORTANT and WARNING → `note`, CAUTION → `warning`.
  - Upload batches count raw bytes below 9,000,000.
  - Bare `https://` addresses become links, as on GitHub.
  - A hard line break is outside the subset.
  - The fixed words (the banner, "On this page", the alert titles) are English in v1.
- **Deviations.** `templates/test-page.png` (a 480×240 sample picture) joins the layout, so the test page has a picture of its own. The shared converter code lives in `to-confluence.mjs`'s exports (`prepare`, `pageParts`, `resolveLink`), and `to-html.mjs` imports them, so no new module joins the layout. `test/cli-symlink.test.mjs` now covers the three new CLIs.
- **Not run.** The write-guides evals. The frozen fixture guides pass check-guides' new rule, but guides the evals write afresh were not run through it. S9 runs the evals with wiki-guides.
- **Searches.** campaign-brief: `scripts/wiki/to-confluence.mjs` only, read by its path for structure. Clarity: only `docs/user-guides/` (listed, read and converted), plus `git status` on that folder. auto-conf: one `grep -rn` for the storage-format macros **started at auto-conf's root** (outside the campaign-brief/Clarity rule, but noted), then `src/auto_conf/converter.py` was read. No other search started at a repo root.

### Session 8: wiki-guides: mock Confluence and the publisher (20 Nov 2026) ✅

Runtime: fable/high (autopilot attempt 1)

- **Built.**
  - `fixtures/mock-confluence/server.mjs`: an in-memory stand-in for Data Center on port 0 (the REST subset, the view page, `cloud` and `unknown` modes, a context path, seeds `empty` and `adopted`, control paths for graders and for a colleague's edit). Its README lists every path.
  - `publish-core.js`: the publisher, one script for the page and for Node. It installs `userGuides` (`input`, `load`, `detect`, `plan`, `attach`, `publish`, `test`, `removeTest`).
  - `publish-node.mjs` evaluates that text in Node and refuses any host but localhost. `check-page.js` checks a published page. `publish-kit.mjs` records the target, makes `publish.json` and records a report.
  - `reference/chrome-publishing.md` gives the Chrome procedure in eight steps. The facts for S9–S12 are in PLAN R31.
- **Gate.**
  - **Scenarios** (each against the mock, through the `publish-node.mjs` CLI):
    - *First publish.* Without the confirmation there is no write request at all. With it: 3 pages made under the top page, the top page at its next version with the message, 5 images with `sha256:` comments. A second run sends no write.
    - *Republish after v2.* One image replaced (`settings.png`, version 2), the other four not sent; all four pages at their next version with the new banner; no confirmation asked.
    - *An edit on the wiki since.* Refused with no confirmation, with the adopted one, and with the wrong version; nothing written, the colleague's text intact. Overwritten only with that page's id and the version seen. A save that lands between the read and the write gets the wiki's 409: the publisher stops there and reports the pages already out.
    - *Adopted pages.* One confirmation covers the top page, three hand-made pages (two by recorded id, one found by title under the top page) and a picture uploaded by hand. All are updated in place: same ids, no new page.
    - *Cloud* and *unknown.* Every call refuses, and the mock sees no write and no read of its content.
  - **In a page** (headless Chromium, the mock under a context path): the script is passed as text, the input is filled with `setInputFiles`, the test page is written, checked and removed, the images go in two batches, the pages are published; after a reload the script and the input are gone, and a second injection finds nothing to send.
  - **check-page:** 1800 px pictures at a cap of 900 run past the 656 px column and are named; at 640 the page passes. It also names a stale view and a link with no target.
  - **Also:** `npm test` 107/107 (14 new); genericity clean over 118 plugin files and this session's `.planning/` lines; `claude plugin validate` passes; the mock and the Node host were also run as two processes.
- **Looked at.** Pictures of the mock's top page and a guide page after the publish (`USER_GUIDES_TEST_SHOTS=<folder>` keeps them): banner, guide list, pictures at 640 px, tables and links all render.
- **Small choices.**
  - **The top page's version** has no field in the contract unless a `topGuide` is set. Rather than add one, a page also counts as untouched when its latest version carries the publisher's own message. The contract is unchanged; R31 names `topVersion` as the alternative if S10 shows the message to be unreliable.
  - **Nothing is written before the confirmation**, images included: `attach` refuses as `publish` does.
  - **A create sends no version**, as the worked example's request did, so a new page has no message. `record` writes `last-publish.json` so the next publish can still skip it.
  - **Hashes are computed in Node**, since a page served over plain http cannot hash. In a page, an image is checked by size, and by hash where the browser allows.
  - **Hard stops** (no confirmation lifts them): a title used elsewhere in the space, a recorded page that is gone, a top title that differs from the wiki's.
  - **The test page's title** is `<top title>: publishing test`, and its picture is attached to itself.
  - **The 9 MB batch limit stays.** Nothing in the worked example shows whether Chrome counts raw or base64 size; the reference gives `--limit 6000000` as the fallback.
  - **Alert for S9:** `publish-core.js` is about 25 KB as tool text.
- **Deviations.** `publish-kit.mjs` joins the layout (§2.4, R31): the input and the record needed a home that never talks to a wiki. `bundle.mjs` gained `--only`, and `to-confluence.mjs`'s `pageXhtml` an `ownImages` option. Session 9's prompt now lists R28–R31 and the mock's README in its reading.
- **Not run.** The write-guides evals (no write-guides file changed). No real wiki, no Chrome.
- **Searches.** `sources/`: the 23 script texts and four of the upload inputs, read by name. campaign-brief: the one archived session summary, read by its path. No search started at a repo root; Clarity was not touched.

### Session 9: wiki-guides: the skill, evals, tuning (21 Nov 2026) ✅

Runtime: opus/high (autopilot attempt 1)

- **Landed.**
  - `skills/wiki-guides/SKILL.md` replaces S1's stub. It orchestrates only: the routes (`adopt`, `shots`), the `key=value` answers, the Never list, Round 1 with its headless form, the steps 0–8, and the three stops worded in full (No Chrome, Not Data Center, No go-ahead).
  - `reference/recording.md` covers the record, the README's "Where these guides are published" section, the report, and the standalone adopt round (which files, their titles, the page tree).
  - `set-edit.mjs` is now shared, and each copy acts as its own skill (R32). `guide-set.mjs summary` reports `publish`.
  - `chrome-publishing.md` gets a full Node-host sequence and the rehearsal's wording fixes. `screenshots.md` now says to compare each picture with every control its text names.
  - `plugin.json` is at 0.9.0.
- **Evals** (sonnet; `bash evals/run.sh`):
  - **format:** `wiki-guides-headless-round-1`, `-html` and `-no-token`, 1.00 in both passes.
  - **scripted:** `wiki-guides-first-publish` (shots from placeholders, a Read of each PNG before the swap, the test page made and removed, then 3 pages and 5 images under the mock's top page, recorded), `-republish-v2` (exactly `settings.png` replaced, R28's count; the top page and every guide page at their next version with the 1.1 banner), `-adopt-pages` (R21: registered as they are, hand-made pages 1010–1012 updated in place), `-label-and-needs-text` (against v2: **New request** fixed in the guide, which goes back to `written`; `settings` becomes `needs-text`, keeps its card, and its text is left alone), `-cloud-refused` and `-no-go-ahead` (no write request reaches the mock).
  - **Pass 1:** 4 of 6 scripted cases passed only 1 of 2 runs. In two runs `go-ahead=yes` was not read as covering `needs.adopted`. One run missed the removed checkbox. One read the summary as "never published". Fixes: SKILL.md's go-ahead scope, a per-control check, the resume rule, and `summary` › `publish`.
  - **Pass 2:** every case 2 of 2 with the skill. Without it, the model wrote straight to the "Cloud" mock and published without asking.
- **Trigger tuning.** `run_loop.py` ran with one worker, 3 runs a query and a 0.4 holdout, through a temporary command in the repo root, with the plugin not installed and the shim off PATH. Held-out 8/8 queries (24/24 runs), train 12/12, so the description was kept. Afterwards `git status` showed nothing left behind.
- **Rehearsal** (a subagent with the Playwright MCP tools, against the mock). The first attempt stopped when the mock process died (not the agent's doing). The second passed end to end:
  - detect gave `data-center`;
  - the test page was made, checked ok and removed;
  - plan, attach (one batch of 5) and publish all worked;
  - `record` succeeded;
  - `check-page` answered ok on all four pages (column 656, widest image 640);
  - after a fresh input, the final `plan` showed everything `skip`.

  The whole `publish-core.js` (24,583 bytes) went through `browser_evaluate` intact (verified by hash on the first attempt). I checked the mock's `/__mock/state` and a page screenshot myself.
- **Small choices.**
  - **`go-ahead=yes`** gives all three go-aheads, `needs.adopted` included, but only when the user typed it. It never covers `needs.edited`.
  - **The Node host** serves any wiki on this machine. Every other wiki goes through Chrome only, and a `-p` run stops there.
  - **Eval stops are fixed text,** so the no-token graders can safely require that the final message names no credential.
  - **`run.sh` exports `USER_GUIDES_PLAYWRIGHT_CORE`** (the dev copy), because the user cache is empty and a headless run never installs Playwright.
  - **The mock runs in the runner's process,** so its scripts are called asynchronously.
- **Deviations.** `set-edit.mjs` joins wiki-guides' layout (§2.4, R32). `guide-set.mjs`'s `summary` gained `publish`: an eval showed the gap, and the contract is unchanged.
- **Not run.** No real wiki and no Chrome. The write-guides evals were not rerun: only `set-edit.mjs`'s actor line and `summary` changed for write-guides, and `npm test` covers both.
- **Searches.** None outside this repo; campaign-brief and Clarity were not touched.


### Session 10: Checkpoint 2 · Clarity on the wiki (21 Nov 2026) ⛔

Runtime: opus/high (autopilot attempt 1)

- **Stopped at once, by design** (PLAN §4 checkpoint protocol, D14; `prompts/session-10.md` "Checkpoint protocol"). Session 10 runs by hand, from Clarity, through Kam's signed-in Chrome and with his go-aheads. This was a headless autopilot run started in cc-star-skills. Row 10 is set to ⛔ `Needs decision: run Session 10 interactively …`. No code changed, nothing was published, and Clarity was not touched.
- **Checked before stopping:** Session 9 is ✅ (wiki-guides 0.9.0). The Clarity repo exists at its path. Review notes › Clarity on the wiki has none yet.
- **To resume:** `cd /Users/kstar/_Dev/action-tracker && claude --plugin-dir /Users/kstar/_PRJ/cc-star-skills/plugins/user-guides --add-dir /Users/kstar/_PRJ/cc-star-skills`, then `/planning:session /Users/kstar/_PRJ/cc-star-skills/.planning/user-guides`. That run asks the row's question, sets row 10 to 🟡 and does the session with Kam.
- **Searches.** None outside this repo. campaign-brief and Clarity were not searched (only a `test -d` on Clarity's root).
- The plan dir's `autopilot/` run logs were left uncommitted.

### Session 10: Checkpoint 2 · Clarity on the wiki (21 Nov 2026) ✅

Runtime: opus/high (interactive `/planning:session`, from Clarity)

- **Run interactively** from Clarity with the plugin loaded by `--plugin-dir`, which settles the ⛔ `Needs decision:` row (run it by hand). No notes waited under Review notes; Kam's choices are there now.
- **Rehearsal** in Kam's Chrome against the mock (a staged copy of the fixture's guides, pictures taken): detect, test page made, checked and removed, 3 pages and 5 images published, `check-page` ok on all 4, final plan all `skip`. Passing 25 KB of script text was replaced on the spot by uploading the script into the page and running it there.
- **Shots:** `shots-kit.mjs install`, four `step()`s added (Add mailbox form, the forwarded NDA email, a task's details, the New action panel), preflight ok (Playwright from `apps/web`), 12 shots taken, every review copy read and compared with the controls its text names: no label differed, nothing handed back. `swap-shots --release 1.12.0`: 12 taken, all 6 guides still `checked`.
- **The real wiki** (Confluence DC 9.2.13, the page CLARITY that Kam made): detect `data-center`; the test page showed every construct correctly, but its picture exposed the sizing difference (R33). After Kam's choice and the fix (with tests), the test page was updated, checked again (picture 466 px in a 470 px column) and, after the real publish, removed. Publish: 12 images in one upload batch, 6 pages created, the top page updated; all 7 checked; final plan all `skip`.
- **Kam's banner note** (mid-session, word for word in Review notes): banner removed (R34), then a republish of 7 pages (no images), all 7 checked again with no banner, final plan all `skip`, and a second publish: 0 created, 0 updated, 7 unchanged.
- **Plugin fixes from the friction log** (each with tests): F1 the image fit (`guide-set.mjs` defaults, `to-confluence.mjs`, `to-html.mjs`, `publish-kit.mjs --image-cap fit`, the mock's view, `check-page.js` advice); F2 no banner (converter, tests, three graders, the v2 scaffold's `expectChanged`); F3 scripts loaded by upload (`chrome-publishing.md` §§ 1, 3, 7); F4 tool answers cut at about 1,000 characters (`record` fills and checks hashes from `publish.json`; doc); F5 the kit failed Clarity's lint (plain SHA-256 in `kit-core.mjs`, equal to `node:crypto`; `/* global */` line in the kit; the kit belongs in a formatter's ignore list); F6 the README section is asked first; F7 the page tree's alphabetical order (documented, not fixed).
- **Clarity commit** (by go-ahead), after lint, typecheck, `check:log-fields` and `check:connector-surface`. No push. No README line (Kam declined).
- **Deviations from PLAN.** R33–R35 added. Do-step 6 (the README line) not done, by Kam's choice. The evals were stopped part-way when Kam asked to wrap up for S11, my call since S11 reruns them all (Verification column); S11's full run covers the rest (Review notes › Release).
- **Searches.** In Clarity, every search named its folders (`docs`, `scripts`, `helm`, `planning`, the guides folder); none started at a repo root. campaign-brief was not touched. Nothing under `docs/feedback/`.

