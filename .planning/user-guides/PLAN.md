# user-guides plugin: write a product's user guides from a walk of the app, then illustrate and publish them

> **Status:** Roadmap scaffolded on 20 Nov 2026 from an approved plan; 12 sessions. Sessions 1 and 2 done (20 Nov 2026). **Session 1 must run before about 14 Dec 2026**: its first step copies code that exists only in two campaign-brief transcripts, which Claude Code deletes about 30 days after their last change (17 Nov 2026).

## 1. Context

**Why.** Campaign-brief's guides were written, photographed and published to Confluence by hand (its sessions 42 and 45). Session 45 ended with a prompt for a `wiki-guides` skill that illustrates guides and publishes them. Kam wants a second skill **before** it, one that writes the guides in the first place by interviewing its user about the kind of guide. Both skills are built as one public plugin, `user-guides`, in this marketplace repo (`plugins/user-guides/`). Each skill works without the other.

**Outcome.** `/user-guides:write-guides` and `/user-guides:wiki-guides` released together at 1.0.0 in the marketplace (S11). They are proven on Clarity: guides written in S5 and published in S10. Then campaign-brief's own guides come under the released plugin (S12).

**Source.** This roadmap was scaffolded from the approved plan `~/.claude/plans/below-you-ll-find-the-crystalline-bird.md` (20 Nov 2026), whose decisions are settled. This PLAN.md carries all of that plan's substance and is now **authoritative**. Where it adds to or corrects that plan, §3 "Reconciliations" says so (R1–R25).

**Superseded.** The `wiki-guides` prompt at the end of campaign-brief's session 45 (`.planning/archive/campaign-brief-v1/sessions/2026-11-16-illustrated-wiki-guides.md`, lines 55–78) asked for a user-level skill in `~/.claude/skills/`. The skill now lives in the plugin (R1). Its eight steps, bundles and must-nevers carry over (§2.2).

**Frozen / signed off (do not change):**
- `plugins/planning/**`, `plugins/copilot/**` and `plugins/showcase/**`: read-only pattern sources.
- campaign-brief (`/Users/kstar/_Dev/campaign-brief`) and its transcripts: read-only. The one exception is S12, which writes campaign-brief's own guides and `guides.json` under its CLAUDE.md.
- Clarity (`/Users/kstar/_Dev/action-tracker`): its app code never changes. S5 and S10 add only the guides folder, `scripts/user-guides/`, the `.user-guides/` ignore line and one line in its docs README, each with Kam's go-ahead.
- `/Users/kstar/_Dev/auto-conf/`: a read-only reference.

**To be built:**
- `plugins/user-guides/**` (§2.4).
- In cc-star-skills: the `.gitignore` lines (S1); the marketplace entry and the README section (S11).

### 1.1 Sources to reuse (read-only)

- **campaign-brief:**
  - `scripts/wiki/screenshots.mjs` and `scripts/wiki/to-confluence.mjs`;
  - `.planning/archive/campaign-brief-v1/sessions/2026-11-16-illustrated-wiki-guides.md` (the gotchas, the superseded prompt) and `.planning/archive/campaign-brief-v1/sessions/2026-11-15-wiki-documents-guides.md` (how the guides were walked and checked) (R2);
  - `docs/product/guides/*.md` and `docs/wiki/*.md`, for structure only;
  - the transcripts in `~/.claude/projects/-Users-kstar--Dev-campaign-brief/`: `cb52d554-9eb1-4c54-87fc-1f1554bb6d43.jsonl` (session 45, the Chrome publishing calls; 40 MB) and `deda8cee-dcd6-409e-878d-1d6d7a1da396.jsonl` (session 42, the walk library; 6 MB). S1 copies what is needed into the git-ignored `.planning/user-guides/sources/`.
- **cc-star-skills showcase:**
  - `plugins/showcase/skills/showcase/SKILL.md` and `reference/interview.md` (rounds, skip rules, the headless rule, Explore briefs);
  - `reference/determinism.md` and `toolkit/host/auth.ts` (sign-in, storageState);
  - `toolkit/lib/playwright.ts` (finding Playwright);
  - `evals/*` and `evals/run.sh` (staging for `claude plugin eval`).
- **copilot:** `plugins/copilot/skills/build-copilot/reference/design-guide.md` (its spec-and-orchestration split) (R3).
- **skill-creator** (`~/.claude/skills/synced/*/skill-creator/`): the eval loop, `scripts/quick_validate.py` and `scripts/run_loop.py`.
- **`/Users/kstar/_Dev/auto-conf/`:** a reference for tables, code and quotes in storage format. Its sign-in model, a username and password, is not reused.

## 2. Target architecture

### 2.1 Overview

```
target repo (any web app)
┌──────────────────────────────────────────────────────────────────────────┐
│ /user-guides:write-guides                                                │
│   recon (3 Explore agents, git-tracked files in named folders only)      │
│   → interview (3 rounds, or the answers already in guides.json)          │
│   → walk the LOCAL app as each role (Playwright, or a fetch walk)        │
│   → write each guide from its template, one SVG card per picture         │
│   → check-guides → report, point to wiki-guides                          │
│        │ writes                                                          │
│        ▼                                                                 │
│   <guides>/guides.json   <guides>/*.md   <guides>/images/<id>.svg        │
│   <guides>/README.md (index)            .user-guides/walk/ (ignored)     │
│        │ reads                                                           │
│        ▼                                                                 │
│ /user-guides:wiki-guides                                                 │
│   ask (destination, guides, the page to publish under, the release)      │
│   → shots (scripts/user-guides/shots.mjs + guides-kit.mjs, kept in repo) │
│   → swap SVG → PNG → convert (Confluence storage format | HTML files)    │
│   → publish through the user's signed-in Chrome (Data Center only)       │
│   → check every page → record where the pages are                        │
└──────────────────────────────────────────────────────────────────────────┘
after a release: write-guides refresh → walk again, update the text, mark
`retake` each shot whose region fingerprint changed → wiki-guides retakes them
```

### 2.2 The two skills

**`/user-guides:write-guides`** writes guides. In order:
1. **Recon**, read-only: three Explore agents with fixed report shapes (screens and routes; roles, permissions and data; running, sign-in, seed and existing docs). They read only git-tracked files (`git ls-files`), in named folders, and never a folder the project's CLAUDE.md forbids. Both example repos keep their forbidden folders git-ignored (campaign-brief's `briefs/`, Clarity's `docs/feedback/`). Summarise in ≤ 15 lines.
2. **Interview** with AskUserQuestion, its fixed wording kept in `reference/interview.md`, recommended option first, at most four questions a round.
   - Round 1: who reads (the detected roles), which kinds of guide, how deep, where they will be read.
   - Round 2: language and tone (detected), pictures (placeholders, recommended), how facts are checked (walk the local app, recommended), where to write.
   - Round 3: the proposed guide set and each guide's outline (approve, or notes, at most three loops).
   - Skip rules: arguments, and answers already in `guides.json`. Headless with no answers: print the round in its fixed form and stop; never guess. Round 3 accepts a recorded `approve as proposed` (R9).
3. **Walk the local app** as each role with synthetic accounts (Playwright from the project, or a fetch of server-rendered pages when no browser is available). Walk outlines go to the project's git-ignored `.user-guides/walk/`, so a later session can resume from them. If the app can't run, use the code, and record each claim that was not checked in `notChecked[]` in `guides.json`, never in a guide.
4. **Write** each guide from its template, in the screens' own words, with one placeholder per picture and its shot-list entry.
5. **Check** (`check-guides`), then report and point to `wiki-guides`.
6. **Refresh mode** (after a release): walk again, update the text, mark `retake` each shot whose region's fingerprint changed (D3), and report what changed.
7. **Adopt mode** (for S12): take guides it did not write and that have no `guides.json`.
   - In one round, ask which files, their roles and types, and the images folder.
   - Then register each guide as `written`, its existing images as shots `taken` with no fingerprint yet (so the first refresh retakes them all), and any wiki pages it is told of (R8).
   - Then continue in refresh mode.
   - It never rewrites a guide it has only adopted until it has walked it.

It is resumable. Each guide's status in `guides.json` (`outlined → written → checked`) lets a large set be written over several sessions; an approved outline is the guide file's heading skeleton at `outlined` (R9). The guides folder gets a `README.md` index, whose status block between markers `guide-set.mjs` regenerates.

Guide types in v1: role guides (one per role, by task), features and value, getting started, admin and operations. Anything else gets the closest template, and the skill says so.

**`/user-guides:wiki-guides`** illustrates and publishes. Its eight steps come from the session-45 prompt:
1. **Ask first**, in one round: the destination (Confluence pages, recommended; HTML files; both), which guides, the page to publish under (it becomes the top page, R10), and the release for the banner.
2. **Read `guides.json`**, or adopt guides it did not write (the standalone path). Adopting takes one round: which files, their titles, and the page tree. Existing images are registered as `taken`; no shot is invented.
3. **Take screenshots** with a script the project keeps, made from the bundled template.
   - First a preflight: Playwright found, the base URL reachable, every role signed in.
   - Look at every image.
   - Correct only a wrong label seen on screen. A bigger difference sets the shot to `needs-text` and hands it back to `write-guides`.
4. **Swap** each placeholder for its PNG.
5. **Convert** to Confluence storage format or to self-contained HTML.
6. **Publish** through the user's signed-in Chrome.
   - Detect the wiki's flavour first: nothing is published to a Cloud wiki, or to one that can't be identified.
   - A test page comes first.
   - Ask before the real pages, and before deleting the test page.
7. **Check** every published page.
8. **Record** where the pages are and how they are made.

### 2.3 The contract: `guides.json`

It sits in the guides folder chosen in the interview (proposed default `docs/user-guides/`) and holds no secrets. S1 fixes the exact key names in `reference/guide-set.md`.

| Key | Holds | Owner |
|---|---|---|
| `product` | name and language (e.g. `en-GB`), from recon, confirmed in round 2 | write-guides |
| `app` | the base URL: `localhost` or `127.0.0.1` unless the user confirms otherwise.<br>Optional `start` and `reset` commands: the skill asks before running either and warns that a reset wipes the synthetic accounts' data. A headless run never runs them (R9).<br>The sign-in kind with that kind's settings (R8), `accounts` per role, and `playwrightFrom`, the package folder to load Playwright from (e.g. `apps/web`) | shared |
| `interview` | the answers, word for word, and the version of the interview wording | write-guides |
| `notChecked[]` | each claim the walk could not confirm: its guide, the claim and the reason. A code-only run always leaves it non-empty; unconfirmed bold labels land here (R11) | write-guides |
| `leftOut[]` | each walked screen deliberately left out: screen, role, reason (R8) | write-guides |
| `checks.patterns[]` | the project's own internal-reference patterns, for `check-guides` (R8) | write-guides |
| `guides[]` | id, type, file (repo-relative, R8), title, audience, parent, order, status (`outlined \| written \| checked`) | write-guides; wiki-guides adds entries when they are absent |
| `shots[]` | id, alt, as (role), path (repo-relative), target (what to crop, in words, plus the best locator found, in R8's syntax), state (what must be true first), guides, status (`placeholder \| taken \| retake \| blocked \| needs-text`), and once taken: taken-at, release and fingerprint | the spec: write-guides; status, taken-at and fingerprint: wiki-guides, with R7's exceptions |
| `publish` | `confluence`: base URL, space, top page id, `topGuide`, `pages`, image cap, device scale (R8, R10).<br>`html`: the output folder.<br>The release | wiki-guides; adopt may seed `confluence` when it is absent (R8) |

**Status transitions** (R7). Guides go `outlined → written → checked`, all moved by write-guides. Any text edit to a `checked` guide makes it `written` again: a refresh, a `needs-text` fix, or wiki-guides' label fix. Adopt (either skill) registers a guide as `written`. wiki-guides publishes `written` and `checked` guides, and names the unchecked ones in its report.

| Shot status from | To | Who |
|---|---|---|
| (new) | `placeholder` | write-guides |
| (an adopted image) | `taken`, with no fingerprint | adopt (either skill) |
| `placeholder` | `taken`, `blocked` or `needs-text` | wiki-guides |
| `taken` | `retake`, when the fingerprint changed or none was recorded | write-guides' refresh |
| `retake` | `taken`, `blocked` or `needs-text` | wiki-guides |
| `needs-text` | `placeholder` (no PNG yet) or `retake`, once the text is fixed | write-guides |
| `blocked` | `taken`, on a later attempt | wiki-guides |

**The work folder** `.user-guides/` at the project root is git-ignored; the skill adds the line. It holds:
- `auth/`, for `storage-state` sign-ins;
- `walk/`, for walk outlines and dumps;
- `out/`, for converted pages, upload batches and half-size review copies of the shots.

It lives in the project, not in the scratchpad, so that a later session can resume from it and Chrome's `file_upload` can reach it.

**Validator:** `guide-set.mjs` (load, validate, save, status transitions). Both skills carry identical copies of it and of `reference/guide-set.md`, and of `kit-core.mjs` from S2 and `md.mjs` from S7. A plugin test keeps them byte-identical.

### 2.4 Layout

```
plugins/user-guides/
  .claude-plugin/plugin.json
  package.json                       dev only: node --test, playwright-core 1.63.0 for tests
  skills/write-guides/
    SKILL.md                         orchestration only, short
    reference/  interview.md recon.md walking.md guide-types.md style.md refresh.md guide-set.md
    templates/  role-guide.md features-and-value.md getting-started.md admin-operations.md
    scripts/    guide-set.mjs kit-core.mjs (S2) md.mjs (from S7) placeholder.mjs walk-lib.mjs
                check-guides.mjs set-edit.mjs (S2, R27)
  skills/wiki-guides/
    SKILL.md
    reference/  screenshots.md chrome-publishing.md confluence.md html.md recording.md guide-set.md
    templates/  shots.template.mjs (the project's shots) guides-kit.mjs (the helpers, kit-core
                embedded, copied in with a version stamp) test-page.md (every construct, for the
                test page) and its test-page.png (S7)
    scripts/    guide-set.mjs kit-core.mjs md.mjs to-confluence.mjs to-html.mjs swap-shots.mjs
                shots-kit.mjs (S6, R29) bundle.mjs publish-core.js (page or Node)
                publish-node.mjs (localhost only) check-page.js
  fixtures/leave-app/                server-rendered, dependency-free; 3 roles; v1 and v2 (the
                                     change table in its README, R14); a CLAUDE.md and a
                                     git-ignored private/ whose canary staging generates (R13)
  fixtures/leave-app-guides/         S3's frozen guide set for the fixture (R15)
  fixtures/mock-confluence/          Data Center REST subset + view page; cloud and unknown modes
  test/                              node --test for every script; the staging helper; the
                                     shared-file sync test; the genericity test
  evals/<case>/…  evals/run.sh       and the claude shim (S3, R16)
```

**What it adds to a target repo** (this becomes the README's table):
- in git: `<guides>/guides.json`, `<guides>/README.md` (the index), `<guides>/*.md` and `<guides>/images/`;
- in git, once pictures are taken: `scripts/user-guides/shots.mjs` and `guides-kit.mjs`;
- git-ignored: `.user-guides/` (the work folder).

No dependency and no app code. An adopted set may keep its files where they are, outside `<guides>/` (R8).

### 2.5 Converter scope

- **Input it accepts:**
  - headings: H1 is the title; the rest shift up one level, with anchor macros using exact GitHub slugs, including `-1` for duplicates;
  - paragraphs; bold, italic and code;
  - links: in-page, another guide in the set (in any folder, R8), external. A repo-only file becomes plain text;
  - nested lists with paragraphs inside items; `---`;
  - images alone on their line;
  - GFM tables; fenced code (the code macro);
  - blockquotes and GitHub alerts (the info, note and warning macros).
- **Anything else** fails with `file:line`, or, with the user's go-ahead, is shown as escaped text; nothing is silently dropped. From S7, `check-guides` uses the same parser, so a guide is held to the subset as it is written.
- **Placeholders:** a placeholder still in place (an `.svg` shot) stops the publish, unless the user chooses to publish it as it is.
- **Images** are attached once to the top page, at width `min(cap, px / scale)`; the cap defaults to 640. Files reach Chrome in batches under 9 MB.
- **Banner:** each page opens with one naming its source file and release, and saying that a wiki edit is overwritten by the next publish.
- **Top page** (R10): the page the user names. After the intro (`topGuide`, else the README index's intro) comes a list of the guides, then an "On this page" panel.

## 3. Cross-cutting decisions & reconciliations

### Decisions (settled in plan mode, 20 Nov 2026)

- **D1 Packaging.** One plugin `user-guides`, skills `write-guides` and `wiki-guides`; no plugin `dependencies`; enabled by default (no hook). Model-invocable, with descriptions tuned against near-misses: the synced `docs` skill's guides and how-tos, READMEs, API references, release notes, a product film.
- **D2 Contract.** One file, `guides.json`, in the guides folder of the target project (§2.3). Each skill owns its own parts of it and can create it if it is missing.
- **D3 Pictures.**
  - **Placeholder:** an SVG card (caption, role, screen) at `images/<id>.svg`, linked from the markdown, plus a shot entry with status `placeholder`.
  - **Taking it:** `wiki-guides` writes `images/<id>.png`, rewrites the link, deletes the SVG and sets status `taken`. It also records a fingerprint of the shot's region: a hash of its headings and control names, with numbers and dates normalised. Refresh compares fingerprints to decide what to retake.
  - **Other statuses:** a shot that cannot be taken is `blocked`; one whose text is wrong beyond a label is `needs-text`.
  - **Alt text** uses the form "Screen: what to notice".
- **D4 Facts.** Walk the local app as each role; fall back to code and record what was not checked in `notChecked[]`. Never the live app, never real people's data. Recon reads only git-tracked files, in named folders, and never a folder the project forbids.
- **D5 Refresh** belongs to `write-guides`. `wiki-guides` corrects only a wrong label it sees while photographing.
- **D6 Targets in v1.** Confluence Data Center and self-contained HTML files.
  - Confluence Cloud is detected from several signals, since it can sit on a custom domain, and stopped with a clear message.
  - Nothing is published to a wiki whose flavour can't be identified.
  - Out of scope: in-app help, other wikis, translations, films (showcase makes films).
- **D7 Publishing.** A real wiki is reached only through the user's signed-in Chrome (Claude in Chrome), never with a token or password. The bundled publisher script runs in the page; the same script runs in Node only against `localhost` (the mock), for tests and evals.
- **D8 Republishing is idempotent.**
  - Each image is uploaded with `sha256:<hash>` in its attachment comment, so an unchanged image is skipped.
  - Each page records its body hash in the version message, so an unchanged page is skipped.
  - A version is checked before every update: a page edited on the wiki since the last publish is not overwritten, and the user is asked.
- **D9 Public audience.** Nothing corporate goes in the plugin: no hosts, space keys, page ids, people's names or campaign-brief text. Read the worked example for structure and code patterns only. Make no stack assumptions. The sign-in kinds are:
  - `cookie-command`: a helper prints the value, which is never logged;
  - `storage-state`: a headed sign-in by hand, saved to a git-ignored file with mode 600;
  - `form`: synthetic credentials from environment variables named in the config;
  - `module`: a small module in the project that signs a role in, for anything else;
  - `none`.
- **D10 Runtime.** Scripts are dependency-free Node ≥ 20, because installed plugins carry no `node_modules`.
  - Playwright is found in this order: the project's own dependency (resolved from the package folder in `app.playwrightFrom`, e.g. `apps/web` in a workspace), then a path in an environment variable, then a user-level cache (names in R12).
  - It is never added to a project without asking.
  - The plugin's dev-only `package.json` pins `playwright-core` for its own tests.
- **D11 Testing.** A bundled fixture app and a bundled mock Confluence DC, both dependency-free, serve `node --test` and the skill evals. One real test page in Kam's Chrome comes before any shared page.
- **D12 Evals.** Use the `claude plugin eval` folder format (`evals/<case>/prompt.md`, `case.yaml`, `graders/`, `files/` + `place-files.sh`), staged by `evals/run.sh` as in showcase, and iterate with skill-creator's loop against a no-skill baseline. Interview-led runs are tested through the headless print-and-stop rule and through answers given in `guides.json`.
  - Claude Code 2.1.322 adds the baseline arm itself.
  - Every run passes `--no-publish`, because the eval report otherwise goes to claude.ai by default, and `--scaffold` for cases that place files.
  - Runs are billed, so give each case a modest `runs` and use `--max-cost-usd` on wide runs.
  - Unattended sessions run `bash evals/run.sh` and skill-creator's `run_loop.py` as commands they wait for (foreground, or in the background with Monitor). They never wait on background subagents by ending the turn, because a headless run that ends its turn exits.
  - The `claude` shim with `--plugin-dir` tests the edited copy. skill-creator's viewer and Kam's feedback belong to the checkpoints (S4, S10).
  - Trigger tuning (`run_loop.py`) tests a description through a temporary `.claude/commands/<name>.md` in the project root. Run it with the plugin not loaded, and check afterwards that `git status` shows nothing left behind.
- **D13 Proof** on Clarity (`/Users/kstar/_Dev/action-tracker`) only.
  - Use seeded synthetic mail: `pnpm seed:e2e` for the role accounts, and `seed:film` for the film account's tidy mailboxes, which suit screenshots.
  - Never read `docs/feedback/`: its `.gitignore` entry says it is pilot users' real mail with real names, never committed or copied.
  - Sign in through `scripts/e2e-session.mjs`.
  - Commit in Clarity only with Kam's go-ahead, in Clarity's style.
  - Its web runs on `localhost:3000` (compose project `action-tracker`), which clashes with none of campaign-brief's ports.
  - Exception: S12, after the release, uses the plugin on campaign-brief itself. That is campaign-brief's own use of a released plugin, so its text, hosts and page ids stay in campaign-brief and never enter the plugin (D9).
- **D14 Checkpoints** (by hand; ⛔ `Needs decision:` rows when run headless): (1) Interview and templates (S4); (2) Clarity on the wiki (S10); (3) Release (S11).
  - Kam answers Clarity's interview live in S5, and the outline approval with it; there is no review stop after S5.
  - 12 sessions, one release: both skills reach 1.0.0 together at S11; S12 uses the release on campaign-brief.
- **D15 Repo conventions.**
  - UK English.
  - Commit subject `SKILLZ-01: <Imperative summary> (user-guides S<n>)`; one commit per session in each repo touched (S11 and S12 excepted, R22).
  - Skills use `reference/`, `templates/` and `scripts/`.
  - Version 0.1.0 at S1, and 0.9.0 when both skills pass their evals. The marketplace entry and 1.0.0 come only at release (the marketplace is public and auto-updates).
  - Kam pushes.

### Spike verdicts (Session 1 fills these in)

| # | Question | Verdict | Evidence | Fallback if "no" (settled, R16) |
|---|---|---|---|---|
| SP1 | Can an eval run start and reach a server on 127.0.0.1 (the fixture, the mock)? | **No** (S1, 20 Nov 2026, Claude Code 2.1.322) | The run's own `node server.mjs` fails with `listen EPERM: operation not permitted 127.0.0.1`. A fixture the scaffold started outside the run is unreachable too: `fetch` fails with `EPERM`. The same probe in a scripted `claude -p --plugin-dir … --allowedTools Bash` run on a staged copy listened and got `200 ok v1 1.0`. | the same cases as scripted `claude -p --plugin-dir` runs, with the same graders |
| SP2 | Can it start headless Chromium? | **No** (S1) | The run's HOME is sealed (`<temp>/home`), so the default browsers path is missing. With `PLAYWRIGHT_BROWSERS_PATH` set to the user cache, or to a headless shell the scaffold cloned into the workspace, Chromium starts and then dies at once ("Target page, context or browser has been closed"). The same probe in a scripted `claude -p --plugin-dir` run launched Chromium 153 from every path. | the fetch walk (the fixture is server-rendered); shot cases stay in `npm test`. Because SP1 is also no, a walk can't run inside an eval-format run: walk and shot cases go to scripted `claude -p --plugin-dir` runs (SP1's fallback). |
| SP3 | Can it run a scaffold script such as `git init`? | **Yes** (S1) | `--scaffold` ran `context.scaffold_script` as the operator, with cwd set to the run's workspace (`<temp>/home/cwd`). `test/stage.mjs --into "$PWD/app"` ran `git init` and committed, and the run saw the commit. Caveats for S3: (1) in the run, `/usr/bin/git` (macOS's xcrun shim) fails ("couldn't create cache file … Operation not permitted"), while `/Library/Developer/CommandLineTools/usr/bin/git` works; (2) `file_exists` graders see only files the run itself wrote, not scaffolded ones; (3) a server the scaffold starts outlives the run and must be stopped. | scripted `claude -p --plugin-dir` runs |
| SP4 | Is the skill's base directory given? | **Yes** (S1) | `/user-guides:write-guides` on the staged copy (no `node_modules`) gave `Base directory for this skill: <stage>/plugin/skills/write-guides`. The run listed its `scripts/` (`guide-set.mjs`, `placeholder.mjs`) with Bash. The run cannot read paths outside the stage, its workspace and the system, for example this repo's `node_modules`. | `run.sh` exports the path |

### Reconciliations

**Facts found while scaffolding**
- **R1.** The session-45 prompt is superseded. It asked for a user-level skill in `~/.claude/skills/`; the skills live in the plugin. Its eight steps, bundles and must-nevers carry over (§2.2).
- **R2.** campaign-brief's two session summaries have moved into `.planning/archive/campaign-brief-v1/sessions/` (`2026-11-15-wiki-documents-guides.md`, `2026-11-16-illustrated-wiki-guides.md`). §1.1 cites those paths.
- **R3.** copilot's design guide is `plugins/copilot/skills/build-copilot/reference/design-guide.md`; the approved plan says `reference/design-guide.md`.
- **R4.** `/session` writes its summary to `.planning/sessions/` and commits in the repo it runs from.
  - So the sessions run from Clarity (S5, S10) and campaign-brief (S12) give the summary's absolute path in cc-star-skills.
  - They commit the tracker, the summary and plugin fixes there with `git -C /Users/kstar/_PRJ/cc-star-skills`.
  - The other repo commits only its own files, with Kam's go-ahead.
- **R5.** The runtime profiles were calibrated inside the `/roadmap` run that scaffolded this plan, and accepted as rated. A separate `/calibrate-roadmap` (the approved plan's §10) is needed only to re-rate.
- **R6.** autopilot counts a TRACKER table row as blocked if it contains ⛔ anywhere, and as pending if it contains ⬜ or 🟡. So the sessions are named "Checkpoint 1 · …" (the approved plan wrote "⛔ Checkpoint 1"), and in TRACKER the status emoji appear only in the Status column.

**The contract, settled so that S1 codes it once** (in `guide-set.mjs` and `reference/guide-set.md`)
- **R7. Status transitions and their owners:** the two tables in §2.3. The approved plan gave shot status to wiki-guides alone, yet its refresh (write-guides, D5) sets `retake`; the table resolves that.
- **R8. Fields the approved plan's §4 lacked:**
  - `publish.confluence.pages`: guide id → `{ page id, version last published }`, owned by wiki-guides. Adopt (either skill) may seed the ids it is told of, with no version.
  - `publish.confluence.topGuide`: optional; the guide whose text opens the top page (R10).
  - `leftOut[]` (screen, role, reason) and `checks.patterns[]` (the project's own internal-reference patterns), both owned by write-guides; `check-guides` reads them.
  - The settings for each of D9's five sign-in kinds, and `app.accounts` per role. S2's walk and S6's shots read the same keys.
  - A fixed locator syntax for `shots[].target`: Playwright selector strings, e.g. `role=button[name="Save"]`. S2's walk writes it and S6's shots read it.
  - `file` and `path` values are repo-relative and may sit outside the guides folder: S12's guides are split across `docs/product/guides/` and `docs/wiki/`.
- **R9. Headless runs.**
  - Round 3 accepts a recorded `approve as proposed`.
  - An approved outline is the guide file's heading skeleton at status `outlined`; S5 resumes from it guide by guide.
  - A headless run never runs `app.start` or `app.reset`, and never installs Playwright: it prints the command instead. An unreachable base URL means the code path, with `notChecked[]`.
- **R10. The top page is the page the user names.**
  - The publisher replaces its body with `topGuide` (default: the README index's intro), followed by the list of guides and "On this page".
  - Guides with an empty `parent` go directly under it; images attach to it.
  - Every page id is recorded (R8), and D8's version check protects the top page like any other.
- **R11. The code path.** A bold UI label that no walk dump confirms goes into `notChecked[]`, rather than failing `check-guides`.

**Shared code and test scaffolding**
- **R12. `kit-core.mjs`.** One module, built in S2 and kept byte-identical in both skills by the sync test. S6 embeds it in `guides-kit.mjs`. It holds three things:
  - **The Playwright lookup** in D10's order: the project (`app.playwrightFrom`), then `USER_GUIDES_PLAYWRIGHT_CORE`, then `${XDG_CACHE_HOME:-~/.cache}/user-guides/pw-<version>`. The cache is filled with `npm install --prefix <cache> --ignore-scripts playwright-core@<version>` only after asking, as in showcase's `toolkit/lib/playwright.ts`.
  - **Sign-in by kind.** A sign-in value is never printed or stored, except a `storage-state` file, which is mode 600 under `.user-guides/auth/`.
  - **D3's fingerprint:** a pure function of a region's headings and control names, normalised and hashed.
    - A browser collects them from the live region.
    - A fetch walk collects them from the served HTML when it can find the region. When it can't, refresh marks the shot `retake`.

  It is built in S2, not S6, because write-guides' refresh needs it first (S3 evaluates it). S6 proves that a walk and a shot agree on every fixture shot.
- **R13. Staging.** S1's helper copies the fixture (v1 or v2) to a temp dir. It runs `git init` with the fixture's own `.gitignore`, generates the canary into `private/` (git-ignored, so never committed) and commits. Every dry run, test walk or shot, and eval scaffold uses it. Nothing runs on `fixtures/leave-app` in place: git would resolve to cc-star-skills, and the skill would write its guides, work folder and ignore line into this repo.
- **R14. The v2 change table.** v2 changes two screens: on one a button is renamed, on the other a control is removed. The fixture's README holds the table: per screen, the change and the shots it must retake. S3, S6 and S9 take their "exactly" counts from it; the approved plan's "exactly two images replaced" assumes one shot per changed screen.
- **R15. The frozen guide set.** S3 commits its best fixture run as `fixtures/leave-app-guides/` (synthetic), for S6–S9 to stage. `.planning/user-guides/samples/` is S4's review copy of the same run.
- **R16. The eval harness**, built in S3:
  - `evals/run.sh`, modelled on showcase's. It stages the plugin **without `node_modules`**, as an installed plugin has none, so D10's lookup is really exercised.
  - The `claude` shim, which adds `--plugin-dir`. It is kept off PATH while `run_loop.py` runs with the plugin not loaded.
  - The fixture's sign-in flag is named `EVAL_…`, because a `case.yaml` can set only `EVAL_*` variables.

  A spike "no" takes the fallback in the Spike verdicts table.
- **R17. The genericity test.**
  - Over the plugin's tracked files and the new files that aren't ignored, it allows no host but `localhost`, `127.0.0.1` and `example.*` (the host rule, which always runs), and no term from `.planning/user-guides/sources/deny.txt`.
  - That deny-list is git-ignored, so the test never holds the strings it forbids. S1 writes it while copying from the transcripts. With the file missing, that part is skipped and the test says so.
  - Before every commit, a session also runs the deny-list part over the lines it adds under `.planning/`.

- **R26. What the spike means for S3's harness** (S1; verdicts above).
  - Eval-format cases (`claude plugin eval`) suit only runs that need no live app: the headless print-and-stop rounds, answers given in `guides.json`, the code-only path (`notChecked[]`), and privacy.
  - Any case that walks the fixture, takes a shot or talks to the mock runs as a scripted `claude -p --plugin-dir` run, on a staged copy, with the same graders, as SP1's fallback says.
  - In eval-format runs, git is called through `/usr/bin/git`, which fails there. So `run.sh` should put a `git` wrapper first on PATH that calls CommandLineTools' git. Showcase's `run.sh` found that the operator's PATH reaches the runs; S3 verifies this.
  - Graders check only files the run writes.
  - Staging writes the canary file only when asked (`--canary-file`, outside the run's reach). Graders match the fixed prefix `LEAVEAPP-CANARY-`.

- **R27. write-guides as built** (S2). Facts S3, S6 and S9 build on:
  - **`set-edit.mjs`**, added to the layout: the skill's only way to change `guides.json`. It applies a JSON list of operations through `guide-set.mjs`'s exports, always as write-guides, all or nothing (`init`, `set`, `addGuide`, `moveGuide`, `edited`, `addShot`, `updateShot` for the spec fields, `moveShot`, `retakeIfChanged`, `push`, `drop`). The contract (`guide-set.mjs`, `guide-set.md`) is unchanged.
  - **One screen reader.** `kit-core.mjs` reads HTML without dependencies. A browser walk passes it the live DOM (`page.content()`) and a fetch walk the served HTML, so on the fixture both walks give the same outline (a test holds this). S6 should take each shot's fingerprint with `regionFingerprint(await page.content(), shot.target.locator)` (null means the whole screen), so a walk and a shot agree by construction.
  - **The walk outline** (`.user-guides/walk/outline.json`) has per role the screens sorted by path. Each has its title, h1, headings, controls, named regions (each with a locator and a fingerprint), its own fingerprint, aliases (`/` = `/home`) and its dump. It holds no host, port or time. A crawl starts a fresh walk and keeps the one before as `outline.previous.json` (`walk-lib.mjs diff`). A walk script adds to the outline, and its named dumps are entries of their own.
  - **A shot's screen.** A shot's `state` starts with its screen's path (`On /requests?new=1: …`). Refresh finds the screen from that path, and otherwise from the alt text's screen name.
  - **Interview.** Rounds 1–3 as §2.2 says, plus Round 2a ("running the app": base URL, sign-in, reset), which confirms what recon found and settles what it couldn't (S4). Answer ids and the wording version (`2` since S4) are in `interview.md`.
  - **`check-guides`** also checks two things §5 doesn't list: no template comments or `{{slots}}` left in a written guide, and a current README status block.
  - **Known limit, for S3.** The label check only asks whether the words appear on a walked screen for the guide's roles. A label renamed in one place but kept in another (v2's **Request leave**: the button is renamed, the dialog keeps the name) still passes. Refresh relies on `walk-lib.mjs diff` and `refresh.md` for that, so S3's refresh eval should grade the text.

- **R28. The eval harness as built** (S3). Facts S6–S9 build on:
  - **Two runners, one grader schema.** `bash evals/run.sh [format|scripted|all] [options]` stages the plugin without `node_modules` and runs either `claude plugin eval` (cases `evals/<case>/case.yaml`, its own no-plugin baseline arm) or `evals/scripted.mjs` (cases `evals/scripted/<case>/case.json`: a `scaffold.mjs` exporting `setup({ cwd, plugin })`, then `claude -p` through the shim with the plugin and plain `claude` without it). The scripted runner implements `regex`, `tool_used` and `file_exists` as `claude plugin eval` does (`input_match` is a regex, `min` defaults to 1, `arm: with-only` graders are indicators outside the score), plus `script` graders. Its runs pass `--setting-sources project,local --strict-mcp-config`, so the operator's own plugins, hooks and MCP servers stay out.
  - **Shared scaffolding** is `evals/lib/scaffold.mjs` (stage into a non-empty workspace, answer presets `walk` / `code` / `nonlocal`, hand-written guides for adopt, commit). Graders that load `guides.json` use `evals/scripted/lib/set-grader.mjs`.
  - **git in eval-format runs.** A run may not read its plugin's `evals/` folder, so `run.sh` copies the git wrapper (`evals/bin/git`, Command Line Tools' git) to a `.eval-bin/` that exists only in the stage, first on PATH. Only PATH reaches the runs: other variables the operator exports (e.g. `DEVELOPER_DIR`) do not.
  - **Proving the edited copy ran.** Neither trace (eval-format or stream-json) records the expanded slash command, so the `Base directory for this skill:` line can't be graded. The `edited-copy-ran` indicator matches the staged path (`user-guides-eval.<id>/plugin/skills/write-guides`) in the run's own tool calls instead.
  - **File graders** in eval-format runs read the run's sandbox directly (`{ source: file, path }`), scaffolded files included; `file_exists` sees only what the run wrote (SP3's caveat stands).
  - **The frozen set and R14.** `fixtures/leave-app-guides/` crops `my-requests` to the table and `request-dialog` to the dialog, so against v2 **exactly one** shot retakes (`settings`, the whole screen). The refresh eval's oracle applies R14's table to the set's own shots (`graders/refresh.mjs` › `mustRetake`), and the skill's fingerprints agree. S6 and S9 take their counts from that oracle, not from "two".
  - **Trigger tuning** (`run_loop.py`) must run with `--num-workers 1`. Parallel workers each write a near-identical `.claude/commands/write-guides-skill-<id>.md`, and a run that invokes another worker's copy counts as a miss (S3's first loop read recall 6% for that reason). The 20 queries are `evals/triggers/write-guides.json`; S9 writes its own for wiki-guides.
  - **Kept walk scripts** import the scripts folder from `USER_GUIDES_SCRIPTS` (`walking.md`), so a refresh can run them wherever the plugin is installed.

- **R29. wiki-guides' screenshots as built** (S6). Facts S7–S10 build on:
  - **Three parts.** `shots-kit.mjs` (added to the layout: `install`, `check`, `blocks`) copies `templates/guides-kit.mjs` into the project's `scripts/user-guides/` with a stamp line (the plugin version and the template's sha256) and writes `shots.mjs` from the template, one block per shot. The project's `shots.mjs` takes the pictures. `swap-shots.mjs` puts them in the guides and moves the shots in `guides.json`.
  - **The kit and kit-core.** `templates/guides-kit.mjs` holds `kit-core.mjs` byte for byte between markers, then the shot helpers (`startShots` → `as`, `open`, `settle`, `step`, `shot`, `check`, `done`). The sync test fails when the two differ, and `node test/embed-kit.mjs` re-embeds. So a change to `kit-core.mjs` now touches three files: both copies, then the embed.
  - **Stale or edited.** `shots-kit.mjs check` reports the project's copy as `current`, `stale` (stamped from a different template) or `edited` (its body no longer matches its own stamp). `install` replaces a stale copy and refuses an edited one without `--force`. It never overwrites the project's `shots.mjs`.
  - **The manifest.** `shots.mjs` writes each shot to `.user-guides/out/shots/<id>.png` (scale 2) and a half-size copy (`scale: 'css'`) to `out/review/`. `out/shots.json` records per shot its file, size, role, takenAt and fingerprint, or the error. A retake by name updates only those entries.
  - **The fingerprint** is `regionFingerprint(page.content(), shot.target.locator)`, read before the page is touched (sticky elements, mouse). A crop passed in changes the picture, not the fingerprint. On the fixture, the fetch walk, the browser walk and the shot agree for every shot, signed-out ones included.
  - **swap-shots' rules.** It takes `placeholder`, `retake` and `blocked` shots that have a manifest entry. A retake needs an entry newer than the shot's `takenAt`. A failed entry sets `blocked` with the error as its `note`. A `taken` shot is never touched; a changed fingerprint on one is reported, so refresh can run first (D5). `--needs-text id=note` hands a shot back. The release comes from `--release`, else `publish.release`. Swapping a link leaves the guide's status alone.
  - **check-guides fix.** A `blocked` shot may still show its card: blocked from `placeholder` there is no PNG yet (R7). Before S6, check-guides flagged it.

- **R30. The converters as built** (S7). Facts S8–S10 build on:
  - **One parser.** `md.mjs` (both skills, byte for byte) turns a guide into a small block and inline tree: `parse(md, { file, escapeUnsupported })` → `{ title, blocks, errors, escaped }`. Anchors come from the rendered heading text (GitHub's slug, `-1` for repeats, the title counted). `check-guides` now takes `slug` and `anchors` from it, and its new `subset` rule reports each error by line; an `outlined` guide is not held to it yet.
  - **The subset's edges.** Outside it, each with its line: raw HTML and comments, reference links and footnotes, indented code, underlined headings, an image inside text, strikethrough, task boxes, a heading inside a list or quote, a second title, a hard line break. `<https://…>` and bare `https://…` addresses are links, as on GitHub.
  - **`to-confluence.mjs`** writes `top.xhtml`, `<guide id>.xhtml` and `pages.json` into `.user-guides/out/confluence/`. `pages.json` holds the release, the top page (`title`, `source`, `guide`, `images`), the pages (`id`, `title`, `file`, `source`, `parent`: null means under the top page, `order`, `images`), and every image to attach (`name`, `path`, `bytes`, `sha256:`, `px`, `width`, `placeholder`, `shot`). It holds no time, so a rerun is byte-identical.
  - **`--top-title` matters to S8.** Guide pages reach the top page by title: its images are `<ri:attachment>` on `<ri:page ri:content-title>`, and a link to the README index points to it. The publisher must pass the top page's real title, read from the wiki; the default, the README's `#` title, is right only for the HTML index and the tests.
  - **The top page.** With no `topGuide`, the intro is the README's opening paragraphs; the rest of the README is not published (a note says so), and its status block never is. With a `topGuide`, the intro is that guide up to its first heading and the rest follows the panel. The guide is not also written as a page of its own, and its children go straight under the top page. The list of guides nests by `parent`; each item takes its description from the README's own list. "On this page" (a `toc`, `maxLevel` 2) appears only when the top page has headings.
  - **Macros.** Code goes in the `code` macro, its language mapped to a Data Center name (unknown: shown as text, with a note). A quote is `<blockquote>`. Alerts: NOTE and TIP → `info`, IMPORTANT and WARNING → `note`, CAUTION → `warning`, each titled with its kind. The banner is an `info` macro. Its words, "On this page" and the alert titles are fixed English in v1.
  - **Images** are named by file name on the top page, so two images with one name are a problem. An `.svg` card that is published as it is (`--allow-placeholders`) is shown at its own width, capped.
  - **`to-html.mjs`** writes `index.html` and `<guide id>.html` (out: `--out`, else `publish.html.outDir`, else `.user-guides/out/html/`). The pages are XHTML-clean, with data-URI images and inline CSS, and nothing loads from outside.
  - **`bundle.mjs`** splits `pages.json`'s images into `batches.json`: in order, each batch under 9,000,000 raw bytes. A file over the limit, missing, or changed since the conversion (its `sha256:`) stops it. S8 decides whether base64 overhead needs a lower `--limit`.
  - **Goldens.** `test/golden/src/` and the template test page make a synthetic two-folder set. Its outputs are `test/golden/expected/{confluence,html}/`, which `UPDATE_GOLDENS=1 npm test` regenerates. `test/xml.mjs` checks well-formedness without dependencies, and so does `xmllint` when it is installed.

**Session shape**
- **R18. Adopt mode** (write-guides, §2.2 step 7, amended into the approved plan for S12) had no session. S2 builds it: its round goes in `interview.md` and its steps in `refresh.md`. S3 evaluates it.
- **R19. `templates/test-page.md`** had no session. S7 builds it, with every construct of the subset; it doubles as a golden. S7 also resolves links across folders (R8).
- **R20. Each reference file is written with its scripts:** `screenshots.md` in S6; `confluence.md` and `html.md` in S7; `chrome-publishing.md` in S8. This keeps S9 to the same shape as S3: SKILL.md and `recording.md`, the evals, the loop and tuning, the Playwright-MCP rehearsal, and 0.9.0. S9 also gets a split valve like S5's.
- **R21. Adopted pages.** Hand-made wiki pages carry no body-hash message, so D8's check would fire on every one. S8 adds a scenario in which the mock is seeded with such pages. They are updated in place by id after one confirmation for the whole batch. S9's adopt eval reuses it.
- **R22. Releases.**
  - `claude plugin tag` refuses a dirty working tree, so S11 commits twice, as showcase's release did: the release commit, then the tag; then, after Kam's push and the install check, the closing commit.
  - S12's patch release follows the same steps: both JSON files, `npm test`, the affected evals, validate, commit, tag, the push commands, then the closing commit.
  - S12 starts with `--plugin-dir`, as the approved plan says. That copy wins over an installed one (seen with showcase), and it is the 1.0.0 release until a fix lands.

**Privacy** (cc-star-skills is public on GitHub, and `.planning/` is tracked)
- **R23.** S5's privacy gate is an **allowlist**: every person, address and subject line in Clarity's guides must appear in the tracked seed sources behind `seed:e2e` and `seed:film`. A search for real names would need the very data that must never be read.
- **R24.** In cc-star-skills' `.planning/`, wiki pages are named by title or role only, never by host, space key or page id; those live in the target repo's `guides.json`. Summaries name no Clarity or campaign-brief person.
- **R25.** S12's open features-and-value items are cited by file (campaign-brief's `.planning/links-website-creative/QUESTIONS.md`), not by their titles, and S12's role guides by folder, not by name.

### Conventions for this roadmap

- **C1.** UK English in docs, script messages and commit messages.
- **C2. Commits.**
  - D15's subject, a body wrapped at about 72 columns, and the `Co-Authored-By:` line the harness specifies.
  - Clarity's commits follow Clarity's style; campaign-brief's are `CB-0NN` and follow its CLAUDE.md. Both are made only with Kam's go-ahead.
  - S11 and S12 are exempt from one commit per session (R22).
  - A headless stop at a by-hand session commits `SKILLZ-01: Stop at Session N for the by-hand run (user-guides S<n>)`.
- **C3. Session summaries** go to cc-star-skills' `.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/user-guides`, never in Clarity's or campaign-brief's `.planning/`.
- **C4. Versions:** 0.1.0 (S1), 0.9.0 (S9), and 1.0.0 with the marketplace entry (S11). If S12 fixes anything, a patch (1.0.1). Every bump changes `plugin.json` and, from S11, `marketplace.json`, then `claude plugin tag plugins/user-guides`.
- **C5. Dependencies.**
  - The scripts use Node ≥ 20 built-ins only.
  - The single dev dependency is `playwright-core@1.63.0`, which matches the cached Chromium build 1243, as in showcase.
  - A new dependency needs a decision recorded here.
- **C6. Fixtures** (the leave app, the mock) listen on port 0 and print their URL, so they never clash with Clarity's 3000 or any other running stack.
- **C7. Ignored**, with the lines added in S1 before anything is copied: `.planning/user-guides/sources/`, `plugins/user-guides/test/.out/` and `plugins/user-guides/evals/results/`.
- **C8. Evals.**
  - Case names start `write-guides-` or `wiki-guides-`, so `--case` can pick one skill's cases.
  - Always `--no-publish`, plus `--scaffold` for cases that place files.
  - A modest `runs`, and `--max-cost-usd` on wide runs.
  - Runs go in the foreground, or in the background with Monitor; never wait by ending the turn.
  - Invoke as `claude -p … < /dev/null`.
  - Prove the edited copy ran by its `Base directory for this skill:` line.
- **C9. Committed synthetic sets:** `.planning/user-guides/samples/` and `fixtures/leave-app-guides/` (invented people only).
- **C10. Reads:** at most 150 lines per call, searching first. Large outputs (transcripts, test and eval logs) go through context-mode's `ctx_execute`, never a raw `Read`.

### Review notes

Checkpoint answers and approvals live in TRACKER › Review notes. A session that gathers one which changes this plan summarises it here.

- **Checkpoint 1 (S4, 20 Nov 2026): notes, applied.** Kam approved the templates and samples. His
  notes changed the skill's rules but not this plan's shape:
  - **The interview wording is now version `2`.** The detected language is named in words, and is not repeated when it matches UK or US English. The folder question always has a second option. Round 2a confirms what recon found.
  - **A running URL is recommended only when its data holds the synthetic accounts.** Otherwise starting a local copy is. When a role can't sign in at a running app, the walk offers a seeded local copy or the code path. For S5: Clarity's running app has no synthetic data, so the walk uses a local, seeded copy.
  - **Kind ids** are the kind itself (`admin-operations`), so they never clash with a role guide's id (`admin`).
  - **A lean set:** each screen or region is pictured at most once across the set, and a guide has at most five pictures. The first-guides eval's `lean-pictures` grader checks this.
- **The first real run (S5, 20 Nov 2026): Clarity's guides written, no plan change but one for S6.** Kam answered the interview live and approved the six-guide outline as proposed.
  - **S6 takes signed-out shots.** A getting-started guide pictures the sign-in screen, so `as(role, { signedOut: true })` joins S6's `shots.template.mjs` (§5 Session 6). The walk side (`walk.open(role, { signedOut: true })`) landed in S5.
  - **S10 crops People-like screens.** A local stack's account table carries test residue (accounts made by e2e runs), so S5's shots of it crop to the forms, never the table. S10 keeps that when it takes them.

## 4. How the sessions work

- **Instructions.** `prompts/session-N.md` is each session's single source of instructions. Running `/planning:session .planning/user-guides` does everything below. From Clarity or campaign-brief, run `/planning:session /Users/kstar/_PRJ/cc-star-skills/.planning/user-guides`.
- **Each session:**
  1. Reads this PLAN.md (authoritative) and `TRACKER.md`, confirms the previous row is ✅, then marks its row 🟡.
  2. Reads its reading list; every §1.1 source is read-only.
  3. Works within its **Boundaries** and the standing rules below.
  4. Runs its **Verification gate** for real. Sessions with screens or images read them back.
  5. Runs the genericity deny-list over the lines it adds under `.planning/` (R17). It then updates `TRACKER.md` (its row, plus a session-log entry with the `Runtime:` it ran at) and writes the session summary (C3).
  6. Commits once (C2; S11 and S12 twice, R22) and surfaces the next kickoff prompt.
- **When a session can't finish:**
  - A gate fails → mark ⛔, record the blocker, commit and **stop**.
  - It needs a decision this plan doesn't settle and it can't ask (a contract field, a dependency, deleting data) → mark ⛔ `Needs decision: <question — options>`, commit and **stop**.
- **Checkpoint protocol** (D14). S4, S10 and S11 are checkpoints; S5 and S12 are run by hand and use the protocol too.
  - **Headless (autopilot), or not started from where the session runs:** set the row to ⛔ `Needs decision: run Session N interactively — <how to start it and what to review>`. Write the summary, commit (in cc-star-skills, C2), and stop.
  - **Interactive:**
    1. Look for notes under `TRACKER.md › Review notes › <heading>`.
    2. If there are none, show the artifacts and ask with AskUserQuestion: Approve as-is · I have notes · (the session's own options).
    3. "Approve as-is": run the gate, and mark ✅. Notes: turn them into a numbered checklist in the session log, implement it, and run the gate.
  - Run interactively, `/session` turns a `Needs decision:` row into a question, records the answer in §3, and runs the session. Any other ⛔ counts as a failed gate.
- **Working directories:**
  - S1–S4, S6–S9 and S11 run in this repo. Interactive runs that read the references start with `--add-dir`:
    - `claude --add-dir /Users/kstar/_Dev/campaign-brief` for S1, S2, S6, S7 and S8;
    - S7 also adds `--add-dir /Users/kstar/_Dev/auto-conf --add-dir /Users/kstar/_Dev/action-tracker`.

    Autopilot's `bypassPermissions` covers reading them.
  - **S5 and S10 run from Clarity:** `cd /Users/kstar/_Dev/action-tracker && claude --plugin-dir /Users/kstar/_PRJ/cc-star-skills/plugins/user-guides --add-dir /Users/kstar/_PRJ/cc-star-skills`, then `/planning:session /Users/kstar/_PRJ/cc-star-skills/.planning/user-guides`.
  - **S12 runs from campaign-brief** the same way: `cd /Users/kstar/_Dev/campaign-brief && claude --plugin-dir /Users/kstar/_PRJ/cc-star-skills/plugins/user-guides --add-dir /Users/kstar/_PRJ/cc-star-skills`.
  - Clarity (`.planning/ux-opportunities/`) and campaign-brief have roadmaps of their own, so a bare `/session` there would pick theirs up. Always pass this plan's folder.
  - From another repo (R4):
    - the summary goes to `/Users/kstar/_PRJ/cc-star-skills/.planning/sessions/`, never that repo's `.planning/`;
    - the tracker, the summary and plugin fixes commit in cc-star-skills with `git -C /Users/kstar/_PRJ/cc-star-skills`;
    - that repo's own changes commit there only with Kam's go-ahead.
- **Branching.** Sessions commit to `main`, as this repo's history and `/session` do. `autopilot --branch user-guides-v1` keeps `main` clean until the release, if preferred. Nothing is pushed by a session; Kam pushes.
- **Autopilot** can run S1–S3 and S6–S9. It stops cleanly at S4, S5, S10, S11 and S12, each of which sets its ⛔ `Needs decision:` row at once. Run S1 before about 14 Dec 2026.
- **Open items** live in `TRACKER.md`:
  - the S1 deadline;
  - Kam's availability for the by-hand sessions;
  - Clarity's and campaign-brief's local stacks and seeds;
  - the wiki page to publish under;
  - the go to push;
  - the review notes.
- **Tools and skills:**
  - `run`, to launch apps and take screenshots;
  - the `claude-code-guide` agent, to check current Claude Code contracts (the plugin manifest, skill frontmatter, `claude plugin eval`) before relying on them;
  - skill-creator, for the eval loop and trigger tuning;
  - the Playwright MCP tools, for S9's rehearsal: `browser_evaluate` and `browser_file_upload` stand in for Chrome's `javascript_tool` and `file_upload`;
  - Claude in Chrome (`mcp__claude-in-chrome__*`), in S10 and S12 only, after reading the `chrome-browser` skill.
- **Standing rules** (from the approved plan's §7; every prompt carries them verbatim):
  - Never open, list, read or search `/Users/kstar/_Dev/campaign-brief/briefs/`. In campaign-brief and Clarity, name the folders each search covers (`rg … <folders>`), with no recursive search from a repo root. Afterwards, say whether any search started at a root.
  - campaign-brief and its transcripts are read-only. Copy structure and code patterns from them, never text, host names, space keys, page ids, people's names or tokens. The one exception is S12, which writes campaign-brief's own guides and `guides.json` under its CLAUDE.md.
  - Clarity: synthetic mail only; never `docs/feedback/`; its CLAUDE.md hard rules apply; commit there only with Kam's go-ahead.
  - Never stop or reconfigure any local stack (Clarity's, campaign-brief's, the source app's, k3d).
  - Never publish to a real wiki without Kam's go-ahead given in that session, never handle a token or password, never push, and never create claude.ai artifacts or cloud docs. That includes eval reports: `claude plugin eval` always runs with `--no-publish`.
  - Read at most 150 lines per call, and search first: this machine cuts off large reads.

> **Runtime profiles.** Each session carries a `Runtime:` line (model / effort) — advice for a human running it by hand (`/model`, `/effort`) and a contract for `/autopilot`, which applies it per session. When a run makes no tracker progress autopilot classifies it first — needs a human, environment failure, yielded early, or a genuine stall — and only a stall is escalated (same model at `max`, then the next model up). Each session's log entry records the `Runtime:` it actually ran at.

## 5. The 12 sessions

| # | Session | Runs from | Mode |
|---|---|---|---|
| 1 | Foundations: scaffold, contract, placeholder, fixture app, eval-sandbox spike | cc-star-skills | unattended |
| 2 | write-guides: the skill | cc-star-skills | unattended |
| 3 | write-guides: evals, tuning, samples for review | cc-star-skills | unattended |
| 4 | Checkpoint 1 · interview and templates | cc-star-skills | by hand |
| 5 | write-guides on Clarity (Kam answers the interview) | Clarity | by hand |
| 6 | wiki-guides: screenshots | cc-star-skills | unattended |
| 7 | wiki-guides: converter (Confluence and HTML) | cc-star-skills | unattended |
| 8 | wiki-guides: mock Confluence and the publisher | cc-star-skills | unattended |
| 9 | wiki-guides: the skill, evals, tuning (0.9.0) | cc-star-skills | unattended |
| 10 | Checkpoint 2 · Clarity on the wiki | Clarity | by hand |
| 11 | Checkpoint 3 · release (1.0.0) | cc-star-skills | by hand |
| 12 | campaign-brief on the plugin: adopt, refresh, republish | campaign-brief | by hand |

### Phase A — write-guides

#### Session 1 — Foundations: scaffold, contract, placeholder, fixture app, eval-sandbox spike

**Objective.** Lay the plugin's skeleton and its contract, and build a fixture app that exercises every hard case. Learn the sandbox facts that later evals depend on. And save the campaign-brief code that exists only in transcripts, before Claude Code deletes them.

**Do.**
1. **First, before the transcripts are deleted** (about 30 days after their last change, so around 14 Dec 2026):
   - add the C7 lines to `.gitignore` **before** anything is copied;
   - copy from the campaign-brief transcripts (§1.1) into `.planning/user-guides/sources/`:
     - the 23 `javascript_tool` texts and 9 `file_upload` calls of session 45 (`cb52d554…`);
     - session 42's `walk/lib.mjs` and `w1`–`w3` (`deda8cee…`);
   - extract them with a script (Node or `jq` over the JSONL, through `ctx_execute`), never with `Read`. Leave out any token value;
   - write `sources/deny.txt`: the hosts, space keys, page ids and people's names those calls contain, one per line, for the genericity test (R17).

   They hold internal hosts and page ids, so they never enter git. S2, S8 and S9 generalise from them.
2. `plugin.json` at 0.1.0, with no `dependencies` (D1), and the dev `package.json`: `node --test`, `playwright-core@1.63.0`, `engines` Node ≥ 20.
3. **The contract.** `guide-set.mjs` and `reference/guide-set.md`, in both skills, with the sync test:
   - load, validate and save;
   - every field in §2.3, R8's included;
   - the status transitions and their owners (R7);
   - the exact key names, documented in `guide-set.md`.
4. `placeholder.mjs`: the SVG card (caption, role, screen) at `images/<id>.svg`, its markdown link, and alt text in the form "Screen: what to notice" (D3).
5. `fixtures/leave-app`, in dependency-free Node, server-rendered:
   - employee, manager and admin roles, with invented people;
   - a sign-in helper that refuses to run without an `EVAL_…` env flag (R16), and a reset;
   - a sticky header, a dialog, cards, an inbox, settings and people;
   - `--variant v2` changes two screens: one renames a button, the other removes a control. The change table in the fixture's README lists each change and the shots it must retake (R14);
   - it listens on port 0 and prints its URL (C6);
   - a CLAUDE.md that forbids a folder, and a git-ignored `private/` folder whose canary string staging generates, for the privacy eval.
6. **Staging** (R13): the helper under `test/` that copies the fixture (v1 or v2) to a temp dir, runs `git init` with its own `.gitignore`, generates the canary and commits.
7. **A spike** of throwaway `claude plugin eval` cases, kept under `plugins/user-guides/test/.out/spike/` and never committed. It answers SP1–SP4 (§3): reaching 127.0.0.1, headless Chromium, a scaffold script such as `git init`, and the skill's base directory. Record the verdicts in §3's table; a "no" takes the fallback written there (R16). Use `--no-publish`, and `--scaffold` where a case places files.
8. **The genericity test** (R17). It runs over the plugin's tracked files and the new files that aren't ignored. It also takes a list of lines or paths, so that sessions can run it over what they add under `.planning/`.

**Boundaries.**
- No skill text yet. If `claude plugin validate` needs one, a minimal `SKILL.md` per skill with `disable-model-invocation: true`; S2 and S9 replace them.
- Nothing from `sources/` goes into a tracked file. campaign-brief and its transcripts are read-only.
- No stack is started or stopped except the fixture's own.

**Verification gate.**
- `npm test` passes in `plugins/user-guides`.
- `claude plugin validate plugins/user-guides` passes.
- The spike's four verdicts are recorded in §3, and the genericity test passes.
- `sources/` is ignored: its `.gitignore` line is in, and `git ls-files .planning/user-guides/sources` prints nothing.
- `sources/` holds the 23 `javascript_tool` texts, the 9 `file_upload` calls and session 42's four files, plus `deny.txt`.

**Runtime:** opus / high — sets the contract and fixture every later session builds on; the spike's gate only checks that verdicts exist

#### Session 2 — write-guides: the skill

**Objective.** `/user-guides:write-guides` works end to end on the staged fixture: recon, the interview, the walk, writing, checking, refresh and adopt.

**Do.**
- **SKILL.md**, orchestration only and short. Its frontmatter passes `claude plugin validate`; skill-creator's `quick_validate.py` is only advisory, since it rejects plugin keys such as `argument-hint`. It is model-invocable, with a description tuned against D1's near-misses.
- **The six other reference files** (§2.4) and the four templates:
  - `interview.md`: the rounds' fixed wording, the skip rules, the headless print-and-stop rule, the recorded Round-3 answer (R9) and adopt's round (R18);
  - `recon.md`: the three Explore briefs and their report shapes;
  - `refresh.md`: refresh and adopt modes.
- **`kit-core.mjs`** (R12), byte-identical in both skills: the Playwright lookup, sign-in for D9's five kinds from §2.3's keys, and D3's fingerprint.
- **`walk-lib.mjs`**, generalised from session 42's walk library in `sources/` (`open(account)`, `go`, `dump`, `api`) and built on `kit-core.mjs`. Walk outlines and dumps go to `.user-guides/walk/`. It has a fetch walk for when no browser is available.
- **`check-guides.mjs`:**
  - internal references: decision, ticket and session ids, file paths, code names, plus `checks.patterns[]`;
  - alt text present, each image on its own line;
  - placeholders matched to `shots[]` both ways;
  - links and anchors resolve;
  - every bold UI label is found in the walk dumps; with no dumps, unconfirmed labels go into `notChecked[]` (R11);
  - every walked screen is covered or listed in `leftOut[]`;
  - `notChecked[]` is non-empty whenever a walk was skipped.
- **The guides folder's `README.md` index**, with its status block regenerated by `guide-set.mjs`.
- **The headless rules** (R9): the recorded Round-3 answer; an approved outline saved as the guide file's heading skeleton at `outlined`; no start, reset or install when headless.
- **A dry run** on the staged fixture (R13), with answers in `guides.json`.

**Boundaries.**
- Copy structure and code patterns from `sources/` and campaign-brief, never their text, hosts or ids.
- No wiki-guides code (S6–S9) and no evals (S3).
- In `skills/wiki-guides/`, only the shared files' copies change.

**Verification gate.**
- `npm test` passes, the sync test included.
- Two walks of the staged fixture give identical outlines.
- `check-guides` passes on the dry run.
- `claude plugin validate plugins/user-guides` passes.

**Runtime:** opus / high — the skill's wording and flow are the product; its gate checks only the scripts

#### Session 3 — write-guides: evals, tuning, samples for review

**Objective.** Prove write-guides against a no-skill baseline, tune its description, and leave samples and a frozen guide set behind.

**Do.**
- **The eval harness** (R16): `evals/run.sh`, modelled on showcase's, staging the plugin without `node_modules`, and the `claude` shim with `--plugin-dir`. Case names start `write-guides-` (C8).
- **Cases**, each staging the fixture (R13):
  - headless round 1 prints and stops, and writes nothing;
  - first guides for the fixture, from answers in `guides.json`, with Round 3 recorded as `approve as proposed`;
  - refresh after v2, starting from taken shots with v1 fingerprints: the text is updated, and exactly the shots in R14's table are marked `retake`;
  - a non-local base URL is refused;
  - answers given and the walk skipped: every guide is written, each picture has a card and an entry, and `notChecked[]` is non-empty;
  - adopt (R18): guides with no `guides.json` are registered as `written` and their images as `taken` with no fingerprint, and the text is not rewritten before a walk;
  - the canary in the fixture's git-ignored `private/` never appears in any run's trace.
- **skill-creator's loop** with a baseline, iterating to green. Claude Code 2.1.322 adds the baseline arm itself.
- **Trigger tuning** (`run_loop.py`, 20 queries including D1's near-misses), through a temporary `.claude/commands/write-guides.md` in this repo's root. Run it with the plugin not loaded and the shim off PATH. Afterwards, `git status` must show nothing left behind.
- **The best fixture run:** commit it as `fixtures/leave-app-guides/` (R15), and copy it to `.planning/user-guides/samples/` for S4.

**Boundaries.**
- Runs are billed: a modest `runs` per case, `--max-cost-usd` on wide runs, and always `--no-publish`.
- Change the skill only as far as the evals demand. A change to the contract is a `Needs decision:`.

**Verification gate.**
- Every case passes with the skill in ≥ 2 runs.
- The difference from the baseline and the held-out trigger score are recorded.
- `npm test` passes, and `git status` shows no trigger-tuning leftovers.

**Runtime:** opus / medium — cases follow showcase's format and the evals are the gate; failures need diagnosis

#### Session 4 — Checkpoint 1 · interview and templates (by hand)

**Objective.** Kam answers the interview as a user would and reviews the sample guides and templates. His notes are applied before Clarity sees the skill.

**Do.**
1. **Checkpoint protocol first** (§4).
   - Headless: set ⛔ `Needs decision: run Session 4 interactively — /planning:session .planning/user-guides in cc-star-skills; Kam answers the interview rounds and reviews .planning/user-guides/samples/ and the templates, then approves as-is or adds notes under TRACKER › Review notes › Interview and templates`.
   - Then commit and stop.
2. **Interactive:**
   - Ask Kam the interview rounds exactly as worded in `reference/interview.md`, through AskUserQuestion with the values detected for the fixture. Kam answers them as a user would.
   - Give him the paths of the samples and the templates.
   - Ask: Approve as-is · I have notes · Change the interview · Change a template.
3. **Notes:** a numbered checklist in the session log. Apply each one, then re-run the affected evals (use skill-creator's viewer with Kam if it helps).
4. **Record:** Kam's answers go under TRACKER › Review notes › Interview and templates.

**Boundaries.** Only what the notes ask for. A change of scope becomes `Needs decision:`.

**Verification gate.**
- Every note is closed with evidence.
- The evals pass.
- `npm test` passes.

**Runtime:** opus / high — the scope of review notes isn't known in advance

#### Session 5 — write-guides on Clarity (by hand, from Clarity)

**Objective.** The first real run: Clarity's guides, written with the skill from a walk of Clarity's local stack with synthetic mail, and the skill fixed from what the run teaches.

**Do.**
1. **Checkpoint protocol first.**
   - Headless, or not started from Clarity: set ⛔ `Needs decision: run Session 5 interactively — cd /Users/kstar/_Dev/action-tracker && claude --plugin-dir /Users/kstar/_PRJ/cc-star-skills/plugins/user-guides --add-dir /Users/kstar/_PRJ/cc-star-skills, then /planning:session /Users/kstar/_PRJ/cc-star-skills/.planning/user-guides`.
   - Commit in cc-star-skills and stop.
2. **Read Clarity's CLAUDE.md**; its hard rules apply.
3. **Run `/user-guides:write-guides`** in Clarity:
   - recon (never `docs/feedback/`);
   - the interview, which Kam answers; then the outline, approved by Kam;
   - the local stack on `localhost:3000`. Ask Kam before any start, seed (`pnpm seed:e2e`, `seed:film`) or reset command;
   - walk as each role with seeded synthetic mail, signing in through `scripts/e2e-session.mjs`;
   - write the guides with placeholders, then run `check-guides`.
4. **Friction log:** keep one in the session-log entry, and fix the skill in cc-star-skills with tests.
5. **If the run won't fit one session:** set ⛔ `Needs decision: resume Session 5 guide by guide from Clarity's guides.json in a follow-up — yes / stop here`, and stop.
6. **Record:** the answers stay word for word in Clarity's `guides.json`. TRACKER › Review notes gets only decisions that change the plan, plus a pointer.
7. **Commits:**
   - Clarity's guides only with Kam's go-ahead, in Clarity's style;
   - in cc-star-skills (`git -C`), the skill fixes, the tracker and the summary.

**Boundaries.**
- No Clarity app code: only the guides folder and the `.user-guides/` ignore line.
- Synthetic mail only; never `docs/feedback/`. Never stop or reconfigure Clarity's stack.
- In cc-star-skills' `.planning/`: no Clarity mail, people or hosts (R24).

**Verification gate.**
- `check-guides` passes on Clarity's guides, and every shot is in the ledger.
- The allowlist (R23): every person, address and subject line in the guides appears in the tracked seed sources behind `seed:e2e` and `seed:film`, and no guide mentions `docs/feedback/`.
- The affected evals still pass.

**Runtime:** opus / high — a real app with unknowns and privacy rules, behind Kam's live answers

### Phase B — wiki-guides

#### Session 6 — wiki-guides: screenshots

**Objective.** A screenshot script that a project keeps, made from a template. It takes every shot in a guide set reproducibly and records the fingerprints that refresh compares.

**Do.**
- **`templates/shots.template.mjs`:**
  - `as(role)` with the five sign-in kinds (from `kit-core.mjs`), and `as(role, { signedOut: true })` for a shot whose `state` says `signed out` (the screens before sign-in; S5 found a real set needs one, and `walk.open` already takes the option);
  - a preflight (`--check`): Playwright found, the base URL reachable, every role signed in;
  - `shot(name, target, {pad, maxHeight, clip})` and `step(label, work)`;
  - wait until the page settles, make sticky elements static, move the mouse away;
  - viewport 1280×800, scale 2, light palette, reduced motion;
  - retake by name; failures are reported and the rest carry on;
  - it never prints or stores a sign-in value;
  - it writes a half-size review copy of each shot to `.user-guides/out/`, for looking at every image;
  - it records each region's fingerprint with `kit-core.mjs` (R12);
  - Playwright is found in D10's order.
- **`templates/guides-kit.mjs`:** the helpers, with `kit-core.mjs` embedded, copied into the project with a version stamp. A check flags a stale copy.
- **`scripts/swap-shots.mjs`:** for each placeholder, write the PNG link, delete the SVG, and set `taken` with taken-at, release and fingerprint.
- **`reference/screenshots.md`** (R20).
- **Tests** on fixture v1 and v2, staged (R13) with the frozen guide set (R15).

**Boundaries.**
- No converter or publisher (S7, S8).
- Patterns from showcase's `reference/determinism.md`, `toolkit/host/auth.ts` and `toolkit/lib/playwright.ts`, and from campaign-brief's `scripts/wiki/screenshots.mjs`, for structure only.

**Verification gate.**
- `npm test` takes every fixture shot.
- After v2, the fingerprints flag exactly the shots in R14's table, and `swap-shots` updates exactly those.
- A walk and a shot give the same fingerprint for every fixture shot (R12).

**Runtime:** opus / high — first wiki-guides session: the shots API projects keep, sign-in secrecy, exact fingerprints

#### Session 7 — wiki-guides: converter (Confluence and HTML)

**Objective.** Guides convert to Confluence storage format and to self-contained HTML within a stated Markdown subset, and write-guides holds new guides to that subset.

**Do.**
- **`scripts/md.mjs`:** the subset in §2.5.
- **`scripts/to-confluence.mjs`**, driven by `guides.json`, with the release as an argument. It writes:
  - the banner and the top page (R10);
  - anchor macros with exact GitHub slugs;
  - images at `min(cap, px / scale)`;
  - links across folders (R8).
- **`scripts/to-html.mjs`:** self-contained pages with images as data URIs, plus an index.
- **`scripts/bundle.mjs`:** groups the files for upload into batches under 9 MB.
- **`templates/test-page.md`** (R19): every construct in the subset; it is also a golden.
- **`reference/confluence.md` and `reference/html.md`** (R20).
- **`md.mjs` copied byte for byte into write-guides**, where `check-guides` gains the subset check. The sync test covers it.
- **Golden tests** on synthetic docs, and a well-formedness check on the XHTML.
- **A read-only conversion of S5's Clarity guides** into the ignored `plugins/user-guides/test/.out/clarity/`. Nothing is written in Clarity.

**Boundaries.**
- No publishing (S8).
- auto-conf is a reference for tables, code and quotes in storage format only.
- campaign-brief's `scripts/wiki/to-confluence.mjs` is for structure only.

**Verification gate.**
- The goldens pass, and the XHTML is well-formed.
- Clarity's guides convert with no unsupported-construct error, or the errors are listed and fixed in the converter.
- `npm test` passes, the sync test included.

**Runtime:** opus / medium — a specified Markdown subset, gated by goldens and an XHTML check

#### Session 8 — wiki-guides: mock Confluence and the publisher

**Objective.** A publisher that is safe against a real wiki: it detects the flavour first, checks versions and republishes idempotently. It is proven against a local mock of Confluence Data Center.

**Do.**
- **`fixtures/mock-confluence`** (dependency-free; port 0):
  - content by space and title, get with expands, create with ancestors;
  - PUT with a version check, DELETE to the trash;
  - attachment list, create and replace via `/data`, refused without `X-Atlassian-Token: no-check`;
  - the applinks manifest, `cloud` and `unknown` modes, and an optional context path (a Data Center site often lives under one, e.g. `/confluence`);
  - 400 on storage format that is not well-formed, and a hook that simulates someone else editing a page;
  - seeding with hand-made pages that carry no body-hash message (R21);
  - a view page with `#main-content` at a set width.
- **`scripts/publish-core.js`:**
  - **Detection:** detect the flavour, then plan; nothing goes to Cloud or to an unidentified wiki (D6).
  - **Images:** attach them to the top page, skipping unchanged ones (D8).
  - **Pages:** create or update them with version checks against `publish.confluence.pages` (R8).
    - A page whose current version differs from the recorded one, or that has none recorded, is not overwritten until the user confirms. An adopted batch needs one confirmation (R21).
    - Titles are unique per space, so a title used elsewhere in the space stops and asks.
  - **The top page** is the page the user names (R10).
  - **Unchanged pages:** each page records its body hash in the version message, so an unchanged page is skipped.
  - **A test-page mode.**
  - **Reports** carry ids and counts, never URLs (Chrome blocks query strings).
- **`scripts/publish-node.mjs`:** runs `publish-core.js` in Node, and refuses anything but localhost.
- **`scripts/check-page.js`:** images loaded, the widest image against the column, in-page anchors.
- **`reference/chrome-publishing.md`** (R20), generalised from `sources/` with no hosts, ids or tokens. It covers:
  - inject the input, then `file_upload` in batches under 9 MB;
  - reload, and re-inject;
  - pass `publish-core.js` as the `javascript_tool` text;
  - wait until the page shows the expected version before judging it;
  - the checks.
- **Scenario tests:**
  - first publish;
  - republish after v2;
  - an edit made on the wiki since;
  - adopted hand-made pages, updated in place by id after one confirmation;
  - Cloud refused;
  - an unknown wiki refused.

**Boundaries.**
- Never a real wiki: the mock and localhost only.
- No token or password anywhere, in code or in tests.

**Verification gate.**
- Every scenario passes.
- In headless Chromium against the mock, the in-page path works end to end: inject the script, fill the input with `setInputFiles`, publish, then reload and inject again.
- `check-page` catches a 900 px image and passes at 640 px.
- `npm test` passes, the genericity test included.

**Runtime:** fable / high — version checks, idempotent republish and the Cloud refusal guard a real wiki from overwrites

#### Session 9 — wiki-guides: the skill, evals, tuning (0.9.0)

**Objective.** `/user-guides:wiki-guides` orchestrates S6–S8's scripts and passes its evals against a baseline. The Chrome procedure is rehearsed without Kam's Chrome.

**Do.**
- **SKILL.md** (model-invocable, its description tuned against D1's near-misses) and **`reference/recording.md`**. The other reference files exist from S6–S8 and are only touched up.
- **Its first round:** the destination, which guides, the page to publish under, and the release.
- **The standalone adopt path:** one round asking which files, their titles and the page tree. Existing images are registered as `taken`; no shot is invented.
- **Evals** (`wiki-guides-…`, through `run.sh`):
  - first publish to an empty page (fixture plus mock, via the Node host);
  - republish after v2: exactly the images in R14's table are replaced, and every page reaches its next version with the new banner;
  - HTML output;
  - guides with no `guides.json` (adopt), reusing S8's adopted-pages scenario;
  - it reads every PNG back (a `Read` of each) before the swap;
  - a renamed label is fixed, while a removed feature is set to `needs-text`;
  - Cloud refused;
  - it never asks for a token;
  - it stops before a real wiki without a go-ahead. AskUserQuestion is not offered in `-p` runs, so a question arrives as plain text, and the grader checks that nothing was published.
- **The loop** with a baseline, and **trigger tuning**, as in S3.
- **A rehearsal** of `chrome-publishing.md` against the mock, with the Playwright MCP tools: `browser_evaluate` and `browser_file_upload` stand in for `javascript_tool` and `file_upload`. This proves the procedure without Kam's Chrome.
- **plugin.json 0.9.0.**
- **If the evals can't all go green this session:** set ⛔ `Needs decision: split Session 9's remaining eval work into a follow-up session — yes / no`, and stop (R20).

**Boundaries.**
- No real wiki and no Chrome: the mock and localhost only.
- Billed runs as in S3 (C8).

**Verification gate.**
- Every case passes with the skill in ≥ 2 runs.
- The rehearsal passes the checks.
- The trigger score and `claude plugin details`'s token cost are recorded.
- `claude plugin validate plugins/user-guides` passes, and so does `npm test`.

**Runtime:** opus / high — the skill's wording and the Chrome procedure are the product; evals reach only the Node and mock paths

### Phase C — Proof and release

#### Session 10 — Checkpoint 2 · Clarity on the wiki (by hand, from Clarity)

**Objective.** Clarity's guides are illustrated and published on the real wiki through Kam's Chrome. Every page is checked, and a republish changes nothing.

**Do.**
1. **Checkpoint protocol first.**
   - Headless, or not started from Clarity: set ⛔ `Needs decision: run Session 10 interactively — cd /Users/kstar/_Dev/action-tracker && claude --plugin-dir /Users/kstar/_PRJ/cc-star-skills/plugins/user-guides --add-dir /Users/kstar/_PRJ/cc-star-skills, then /planning:session /Users/kstar/_PRJ/cc-star-skills/.planning/user-guides`.
   - Commit in cc-star-skills and stop.
2. **Read the `chrome-browser` skill** before the first Claude in Chrome call.
3. **Rehearse the Chrome path against the mock first**, in Kam's Chrome, on localhost.
4. **The shots:**
   - write Clarity's screenshot script (`scripts/user-guides/shots.mjs` from the template, with `guides-kit.mjs`), using Clarity's own Playwright (`app.playwrightFrom`) and seeded synthetic mail;
   - take the shots and look at every image;
   - swap them in, then convert.
5. **Kam names the page to publish under** (R10).
6. **The test page** from `test-page.md` (every construct), then the checks. Any difference between the real wiki and the mock is fixed in the mock and the publisher, with tests, before a real page goes up.
7. **Then his go-ahead, then publish.**
   - Check every page.
   - Delete the test page, with his go-ahead.
8. **Record** a line in Clarity's docs README, with his go-ahead.
9. **Fix the plugin** from the friction log, with tests.
10. **Commits:** Clarity's with Kam's go-ahead; cc-star-skills' with `git -C`.

**Boundaries.**
- Only through Kam's signed-in Chrome; never a token or password; nothing to a Cloud or unidentified wiki.
- The wiki's host, space key and page ids live only in Clarity's `guides.json`. cc-star-skills' tracker and summary name pages by title or role (R24).
- No Clarity app code.

**Verification gate.**
- No placeholder is left, and every page passes `check-page`.
- A second publish with nothing changed reports nothing to update.
- The evals pass after the fixes.

**Runtime:** opus / high — the first real wiki: the mock's gaps surface here, behind Kam's go-aheads

#### Session 11 — Checkpoint 3 · release (1.0.0) (by hand)

**Objective.** Release user-guides 1.0.0 to the public marketplace, documented for strangers.

**Do.**
1. **Checkpoint protocol first.**
   - Headless: set ⛔ `Needs decision: run Session 11 interactively — /planning:session .planning/user-guides in cc-star-skills; Kam reviews the README section and gives the go to release`.
   - Commit and stop.
2. **The README, for strangers:**
   - an overview row;
   - a section "The `user-guides` plugin": Which one?, Requirements, and What it adds to your repo (§2.4's list as a table);
   - the Install, Updating and Layout sections.
3. **The marketplace entry** and its description; the plugin is enabled by default (D1).
4. **1.0.0** in `plugin.json` and `marketplace.json`.
5. **Every test and eval**, and `claude plugin validate` on the plugin and on `.`.
6. **Ask Kam:** Approve as-is · I have notes. Notes are applied first.
7. **Release** (R22):
   - the release commit `SKILLZ-01: Release user-guides 1.0.0 (user-guides S11)`;
   - then `claude plugin tag plugins/user-guides`, which makes `user-guides--v1.0.0`;
   - then print the exact push commands:
     - `git push origin main refs/tags/user-guides--v1.0.0`
     - `GIT_SSH_COMMAND='ssh -o ConnectTimeout=10' git push GITLAB main refs/tags/user-guides--v1.0.0` (that host is often unreachable, and a push to it can hang)

   Kam pushes.
8. **After the push**, with Kam's go-ahead: update the marketplace, install `user-guides@cc-star-skills` in a fresh session, and check that both skills are listed.
9. **The closing commit:** the summary and the ✅ row.

**Boundaries.**
- No push by the session.
- Nothing but the README, the marketplace entry, the versions and release fixes.

**Verification gate.**
- `claude plugin validate` passes on the plugin and on `.`.
- The tag `user-guides--v1.0.0` exists.
- After Kam's push, `/plugin install user-guides@cc-star-skills` in a fresh session lists both skills.
- Every test and eval passes.

**Runtime:** opus / medium — the README and release steps follow showcase's; tests, evals, validate and the tag gate it

#### Session 12 — campaign-brief on the plugin: adopt, refresh, republish (by hand, from campaign-brief)

**Objective.** campaign-brief's own guides come under the released plugin: adopted, brought up to the current release by a walk, and republished in place on its wiki.

**Do.**
1. **Checkpoint protocol first.**
   - Headless, or not started from campaign-brief: set ⛔ `Needs decision: run Session 12 interactively — cd /Users/kstar/_Dev/campaign-brief && claude --plugin-dir /Users/kstar/_PRJ/cc-star-skills/plugins/user-guides --add-dir /Users/kstar/_PRJ/cc-star-skills, then /planning:session /Users/kstar/_PRJ/cc-star-skills/.planning/user-guides`.
   - Commit in cc-star-skills and stop.
2. **Read campaign-brief's CLAUDE.md.** It binds: never `briefs/`, its standing checks, `CB-0NN` commits.
3. **`write-guides` in adopt mode:**
   - the six role guides in `docs/product/guides/` and `docs/wiki/features-and-value.md`, with the images in `docs/wiki/images/` (repo-relative paths, R8);
   - record the existing Confluence pages (the parent and five role pages, from campaign-brief's memory note) in campaign-brief's `guides.json`, never in the plugin or in cc-star-skills (D13, R24);
   - at the start, confirm with Kam which file feeds the parent page (R10's `topGuide`).
4. **Refresh:** walk each role on the local stack with the e2e seed's accounts, and bring the text up to the current release. That includes the open `features-and-value.md` items in campaign-brief's `.planning/links-website-creative/QUESTIONS.md` (R25).
5. **`wiki-guides`:**
   - retake every shot, then convert;
   - publish through Kam's Chrome: a test page first, then his go-ahead;
   - then update the existing pages in place (the five role pages, and the parent page if it carries `features-and-value.md`), and add a sixth child page for the approver guide;
   - then check every page.
6. **Close the loose ends with Kam:**
   - tick the republishing items in campaign-brief's `.planning/bonus-changes/TRACKER.md` and `.planning/links-website-creative/TRACKER.md`;
   - decide whether `scripts/wiki/` is retired;
   - decide whether `.planning/user-guides/sources/` is kept or deleted.
7. **Commit in campaign-brief** as `CB-0NN`, with Kam's go-ahead.
8. **Fix the plugin** from the friction log, as a patch release (R22):
   - both JSON files to 1.0.1;
   - `npm test`, the affected evals, and `claude plugin validate`;
   - commit, then `claude plugin tag plugins/user-guides`;
   - print the push commands; Kam pushes.

   Then the closing commit.

**Boundaries.**
- Never `briefs/`.
- campaign-brief's text, hosts, space key and page ids stay in campaign-brief (D9, D13). cc-star-skills names pages by title or role (R24).
- No campaign-brief app code. Never stop or reconfigure its stack.

**Verification gate.**
- Every page passes `check-page`.
- A second publish with nothing changed reports nothing to update.
- The approver page is under the parent.
- campaign-brief's standing checks pass, and `git ls-files briefs` prints nothing.
- If a patch was released, its tag exists and `npm test` passes.

**Runtime:** opus / high — updates live pages in place under campaign-brief's rules, behind Kam's go-aheads

## 6. File map

**New in cc-star-skills:**
- `plugins/user-guides/**` (§2.4):
  - `.claude-plugin/plugin.json` and `package.json`;
  - `skills/write-guides/{SKILL.md, reference/, templates/, scripts/}`;
  - `skills/wiki-guides/{SKILL.md, reference/, templates/, scripts/}`;
  - `fixtures/{leave-app, leave-app-guides, mock-confluence}/`;
  - `test/` and `evals/`.
- `.planning/user-guides/**`: this roadmap, plus `samples/` (S3, committed) and `sources/` (S1, git-ignored).
- `.planning/sessions/<date>-*.md`: one per session.

**Modified in cc-star-skills:**
- `.gitignore` (S1);
- `.claude-plugin/marketplace.json` (S11, and the patch version in S12);
- `README.md` (S11).

**Unchanged:** `plugins/planning/**`, `plugins/copilot/**` and `plugins/showcase/**`.

**Clarity** (`/Users/kstar/_Dev/action-tracker`), with Kam's go-ahead:
- S5: the guides folder (`guides.json`, `README.md`, the guides, `images/`) and the `.user-guides/` ignore line;
- S10: `scripts/user-guides/shots.mjs` and `guides-kit.mjs`, the PNGs, `guides.json`'s `publish`, and a line in its docs README.

**campaign-brief** (`/Users/kstar/_Dev/campaign-brief`), in S12 only, with Kam's go-ahead:
- its guides and images, its `guides.json`, `scripts/user-guides/` and the `.user-guides/` ignore line;
- ticks in two trackers;
- `scripts/wiki/`, if it is retired.

**auto-conf:** unchanged (a reference).

## 7. Verification

- **`npm test`** in `plugins/user-guides` covers:
  - every script;
  - the shared-file sync and the genericity test;
  - the fixture's shots;
  - the publish scenarios against the mock;
  - `check-page` in headless Chromium.
- **`bash evals/run.sh`:** every case passes for both skills, with deltas against the baseline, and the privacy canary never appears.
- **`claude plugin validate plugins/user-guides`** and **`claude plugin validate .`**.
- **Real proof on Clarity:**
  - the guides are written (S5) and published (S10);
  - every page passes `check-page`;
  - a republish with nothing changed changes nothing.
- **The release:** after Kam's push, installing from the marketplace in a fresh session lists both skills.
- **S12:** campaign-brief's six role guides and its features page are current on Confluence, the approver guide included, and a republish with nothing changed changes nothing.
