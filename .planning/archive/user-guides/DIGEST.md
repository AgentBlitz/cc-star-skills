> **Archived:** 2026-11-27 · **Sessions:** 12/12 ✅ · **Outcome:** Two skills released at 1.0.0, proven on Clarity's real wiki, adopted by campaign-brief; 1.0.1 patch.

# User-guides plugin roadmap — digest

## What was built

A public Claude Code plugin, `user-guides`, in this marketplace (`plugins/user-guides/`), with two skills that work alone or together. `/user-guides:write-guides` interviews its user, walks the running local app as each role (or falls back to the code), and writes end-user guides as markdown with SVG picture placeholders and a `guides.json` contract. It also refreshes them after a release and adopts guides written by hand. `/user-guides:wiki-guides` takes the screenshots with a script the project keeps, swaps them in for the placeholders, and publishes the guides to Confluence Data Center through the user's signed-in Chrome, or as self-contained HTML. Republishing is idempotent. The plugin ships with a dependency-free fixture app (Leave Planner), a mock Confluence DC, `node --test` suites and `claude plugin eval` cases.

Status: all 12 sessions done (20–21 Nov 2026). Both skills were released together at 1.0.0 (S11, tag `user-guides--v1.0.0`). They were proven on Clarity: guides written in S5 and published to a real DC 9.2.13 wiki in S10. In S12 campaign-brief's own guides were adopted, refreshed and republished on the released plugin, which led to the 1.0.1 patch (`e3d47b1`, tag `user-guides--v1.0.1`).

## Key decisions

- **One plugin with two independent skills (D1, D2).** They share one contract, `guides.json`, in the target project's guides folder. Each skill owns its own fields and status moves (R7). Unknown keys are errors, so a stray `password` or `token` field is rejected. Every edit goes through `set-edit.mjs`, which is byte-identical in both skills and takes its actor from its own folder (R27, R32).
- **Facts come from walking the local app as each role, never from the live app or real data (D4).** Any claim the walk couldn't check goes into `notChecked[]`. Proof on Clarity used only seeded synthetic accounts, and S5's privacy gate was an allowlist against the tracked seed sources (D13, R23).
- **Pictures are placeholders first (D3).** Each one starts as an SVG card. Once taken it becomes a PNG with a region fingerprint, and refresh compares fingerprints to decide what to retake. A single dependency-free HTML reader in `kit-core.mjs` feeds both browser walks and fetch walks, so walks and shots agree by construction (R12, R27).
- **Refresh belongs to write-guides (D5).** wiki-guides fixes only a wrong label it sees while photographing, and hands anything else back as `needs-text`.
- **Real wikis are reached only through the user's signed-in Chrome, never with a token (D7).** The publisher is one script that runs both in the page and in Node, and the Node host refuses any address but localhost. Confluence Cloud and wikis of unknown flavour are detected and refused before any write (D6).
- **Republishing is idempotent and safe (D8, R31).** Each image carries `sha256:` in its comment and each page carries a body hash in its version message. A page edited on the wiki since the last publish is never overwritten without that page's id and the version the user saw. Nothing is written, images included, until every confirmation is given.
- **No `topVersion` contract field (S8).** A page also counts as untouched when its latest version carries the publisher's own message. S10 showed this is reliable on a real wiki (R35).
- **No corporate data in the plugin (D9, R17).** A genericity test allows no host but localhost, `127.0.0.1` and `example.*`, and checks against a git-ignored deny-list. Scripts use only Node ≥ 20 built-ins. Playwright is found in the project, then an env var, then a user cache, and is never installed without asking (D10).
- **Eval sandbox limits shaped the harness (SP1–SP4, R26, R28).** Eval-format runs can't reach 127.0.0.1 or keep Chromium alive. So walk, shot and publish cases run as scripted `claude -p --plugin-dir` runs with the same graders. Trigger tuning runs with one worker, and the edited copy is proven by the staged path showing in the run's tool calls.
- **The interview wording is versioned (v2 since S4).** Headless runs print Round 1 and stop. `go-ahead=yes` covers the adopted-pages confirmation but never a colleague's edit (S9).
- **Checkpoint 1 added a lean picture set (S4).** Each screen is pictured at most once across the set, with at most five pictures a guide, enforced by the `lean-pictures` grader.
- **Images fit the page column and wiki pages carry no banner (S10, Kam's choices; R33, R34).** As a result, a new release alone changes no page.
- **Publishing in Chrome loads scripts by upload (R35).** The scripts are uploaded and run with `eval` rather than pasted. Because tool answers are cut off at about 1,000 characters, `record` takes the hashes from `publish.json` and refuses a mistyped one.
- **`kit-core.mjs` hashes with plain SHA-256 instead of `node:crypto` (S10).** Clarity forbids crypto imports outside one module. The fingerprints are unchanged.

## Gate results

| # | Session | Status | Gate result |
|---|---|---|---|
| 1 | Foundations: scaffold, contract, fixture, spike | ✅ | `npm test` 38/40 (2 skipped); validate and genericity pass; spike SP1/SP2 no, SP3/SP4 yes |
| 2 | write-guides: the skill | ✅ | 67/68 tests; two walks byte-identical; dry run, v2 refresh and adopt pass |
| 3 | write-guides: evals, tuning, samples | ✅ | Every case 1.00 (mean Δ +0.525 format, +0.71 / +0.75 scripted); trigger 20/20 |
| 4 | Checkpoint 1 · interview and templates | ✅ | By hand, approved with notes (6 gaps closed); format 4/4, scripted 2/2 |
| 5 | write-guides on Clarity | ✅ | 6 guides and 12 shots, all `checked`; allowlist clean; evals 1.00 |
| 6 | wiki-guides: screenshots | ✅ | 5/5 shots, walk = shot fingerprints; v2 retakes only `settings`; 78/79 tests |
| 7 | wiki-guides: converter | ✅ | Goldens match and are well-formed; Clarity converts with 0 errors; 93/93 tests |
| 8 | wiki-guides: mock and publisher | ✅ | All six mock scenarios and the stops pass; in-page run OK; 107/107 tests |
| 9 | wiki-guides: skill, evals, tuning (0.9.0) | ✅ | Pass 2 every case 1.00 (format mean Δ +0.58); trigger 100%; rehearsal passes |
| 10 | Checkpoint 2 · Clarity on the wiki | ✅ | Headless stop (⛔), then by hand and approved: 7 pages on real DC, republish 7 unchanged |
| 11 | Checkpoint 3 · release (1.0.0) | ✅ | 114/114 tests; format 7 cases and scripted 8 cases at 1.00; tagged, pushed, installed |
| 12 | campaign-brief on the plugin | ✅ | 7 pages checked, second publish sends nothing; 1.0.1 patch at 115/115 tests |

## Deviations from PLAN.md

- **S1:** R26 was added (what the spike means for the harness). The canary file is opt-in. The fixture's `npm start` uses port 0. The genericity check skips `plugin.json`'s metadata and `package-lock.json`.
- **S2:** `set-edit.mjs` joined the layout (R27), so the contract file stayed unchanged.
- **S3:** The edited copy was proven by its staged path, since the `Base directory` line can't be graded. The git wrapper went in the stage's `.eval-bin/`. Trigger tuning ran with one worker. The frozen set retakes one shot on v2, not two (R28).
- **S5:** S6 also takes signed-out shots, recorded in §5 and Review notes.
- **S6:** `shots-kit.mjs` joined the layout (R29). check-guides now lets a `blocked` shot keep its card.
- **S7:** `templates/test-page.png` joined the layout. The shared converter code lives in `to-confluence.mjs`'s exports rather than a new module (R30).
- **S8:** `publish-kit.mjs` joined the layout (R31). `bundle.mjs` gained `--only` and `pageXhtml` gained `ownImages`. Session 9's prompt reading was extended.
- **S9:** `set-edit.mjs` became shared between the skills (R32). `guide-set.mjs summary` gained `publish`, prompted by an eval failure (the contract is unchanged).
- **S10:** The first, headless autopilot run stopped at once by design, and the session was then run by hand from Clarity. R33–R35 were added. Clarity's docs-README line was not added (Kam declined). The evals were stopped part-way and rerun in full in S11.
- **S11:** The session pushed `main` and the tag itself, against "Kam pushes", because Kam said "you can tag and push".
- **S12:** The 1.0.1 patch was released. Deleting `sources/` also removed `deny.txt`, so the genericity deny-list rule now skips. The added lines were checked by hand.

## Final file map

**cc-star-skills**
- `plugins/user-guides/`:
  - `.claude-plugin/plugin.json` (0.1.0 → 0.9.0 → 1.0.0 → 1.0.1) and the dev-only `package.json` and `package-lock.json`.
  - `skills/write-guides/`: `SKILL.md`; `reference/` (interview, recon, walking, guide-types, style, refresh, guide-set); `templates/` (four heading skeletons); `scripts/` (guide-set, set-edit, kit-core, md, placeholder, walk-lib, check-guides).
  - `skills/wiki-guides/`: `SKILL.md`; `reference/` (screenshots, confluence, html, chrome-publishing, recording, guide-set); `templates/` (`guides-kit.mjs`, `shots.template.mjs`, `test-page.md` and `.png`); `scripts/` (the shared guide-set, set-edit, kit-core and md, plus shots-kit, swap-shots, to-confluence, to-html, bundle, publish-core.js, publish-node, publish-kit, check-page.js).
  - `fixtures/`: `leave-app/` (v1/v2), `leave-app-guides/` (the frozen set), `mock-confluence/` (`server.mjs`, README).
  - `test/`: the `*.test.mjs` suites, `stage.mjs`, `genericity.mjs`, `embed-kit.mjs`, `xml.mjs`, `helpers.mjs`, `golden/{src,expected}/`. The git-ignored `.out/` holds the spike and the Clarity conversion.
  - `evals/`: `run.sh`, `scripted.mjs`, `lib/scaffold.mjs`, `shim/claude`, `bin/git`, `triggers/{write,wiki}-guides.json`; 7 eval-format cases (`write-guides-*` ×4, `wiki-guides-*` ×3); 8 scripted cases plus `scripted/lib/{set-grader,wiki}.mjs`.
- `.claude-plugin/marketplace.json`: the `user-guides` entry (1.0.0, then 1.0.1) and the marketplace description.
- `README.md`: an overview row, the section "The `user-guides` plugin", and lines in Install, Updating and Layout.
- `.gitignore`: C7's three lines.
- `.planning/user-guides/`: PLAN.md (spike verdicts, R26–R35, Review notes), TRACKER.md, `prompts/session-9.md`, and `samples/` (committed). `sources/` was created in S1 (git-ignored) and deleted in S12.
- `.planning/sessions/2026-11-2{0,1}-*.md`: 13 session summaries.
- Tags `user-guides--v1.0.0` and `user-guides--v1.0.1`.

**Clarity** (`/Users/kstar/_Dev/action-tracker`, two commits by go-ahead, not pushed)
- `docs/user-guides/`: 6 guides, the README index and status block, `guides.json` (with the shots taken and the publish record), and 12 PNGs replacing the 12 cards.
- `scripts/user-guides/shots.mjs` and `guides-kit.mjs`; the `.user-guides/` line in `.gitignore`; one `.prettierignore` line.

**campaign-brief** (`/Users/kstar/_Dev/campaign-brief`, CB-077)
- `docs/product/guides/`: `guides.json` (7 guides, 38 shots, the wiki page ids), a README index with its published section, the refreshed guides and features page, and 38 pictures.
- `scripts/user-guides/shots.mjs` and `guides-kit.mjs`. `scripts/wiki/` was retired. The walk scripts `scene.mjs`, `states.mjs` and `follow.mjs` are git-ignored.

### Drift from PLAN.md §6

**Planned in §6 but not touched by any log:**
- Clarity: the line in its docs README (S10). Kam declined it.
- campaign-brief: the `.user-guides/` ignore line. No `## Changes` bullet records it. (The S12 log does record the "two tracker ticks".)

**Touched by the logs but not planned in §6:**
- Clarity: `.prettierignore`, because the stamped kit must be kept away from the formatter (R35).
- cc-star-skills: `package-lock.json` beside the planned `package.json`.
- cc-star-skills: the `.planning/user-guides/sources/` deletion (S12) and the session-9 prompt edit (S8).
- cc-star-skills: the 1.0.1 bump in `plugin.json` (§6 named only `marketplace.json`'s patch).
- Files added to §2.4's layout during the build, all inside §6's `plugins/user-guides/**`: `set-edit.mjs` (both skills), `shots-kit.mjs`, `publish-kit.mjs` and `templates/test-page.png`.

## Where everything went

- `.planning/user-guides/` → `.planning/archive/user-guides/` (moved as one directory with `git mv`)
- 13 session logs, `.planning/sessions/` → `.planning/archive/user-guides/sessions/`:
  - `2026-11-20-checkpoint-interview-templates.md`
  - `2026-11-20-user-guides-evals.md`
  - `2026-11-20-user-guides-foundations.md`
  - `2026-11-20-user-guides-write-guides.md`
  - `2026-11-20-wiki-guides-converter.md`
  - `2026-11-20-wiki-guides-publisher.md`
  - `2026-11-20-wiki-guides-screenshots.md`
  - `2026-11-20-write-guides-on-clarity.md`
  - `2026-11-21-campaign-brief-on-plugin.md`
  - `2026-11-21-clarity-on-the-wiki.md`
  - `2026-11-21-clarity-wiki-checkpoint.md`
  - `2026-11-21-user-guides-release.md`
  - `2026-11-21-wiki-guides-skill-evals.md`
- Autopilot: 8 runs, log at `autopilot/autopilot.log`. Git ignores it through `.planning/archive/*/autopilot/`, so git has no copy.
- Archive commit: see `git log -- .planning/archive/user-guides`.

`git log --follow <path>` recovers a moved file's history. To reverse the archive, `git mv` each path back. Never `rm -rf` this directory: the ignored `autopilot/` folder would be lost for good.
