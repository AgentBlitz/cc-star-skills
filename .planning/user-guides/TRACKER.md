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
- [ ] **Review notes** for Sessions 4, 10 and 11. (S4 ✓ 20 Nov 2026: notes applied.)

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
