# platform-audit — Tracker

> The last action of every session is to (1) confirm its verification gate passed, (2) update the row below, and (3) surface the next session's kickoff prompt. If a gate fails, mark the row ⛔, record the blocker here, and **stop** — do not start the next session. If you need a decision the plan doesn't settle and cannot ask for it, mark the row ⛔ with `Needs decision: <question — options>` and **stop**.

`PLAN.md` is authoritative.

> **By hand:** Sessions 8, 9 and 10. Under autopilot, each sets ⛔ `Needs decision: run Session N interactively …` at once (PLAN §4, D12).
>
> **Deadline:** run Session 1 **before about 14 Dec 2026**. It copies a transcript that Claude Code deletes about 30 days after its last change, which was 15 Nov 2026.
>
> In the table below, the status emoji appear only in the Status column: autopilot counts any row containing one.

## Status board

| # | Session | Status | Key artifacts | Verification | Notes |
|---|---|---|---|---|---|
| 1 | Sources and skeleton | ✅ | `plugins/audit` at 0.1.0; stub `skills/platform-audit/SKILL.md`; `test/genericity.mjs` + test; 4 `.gitignore` lines | `npm test` 7/7; genericity clean (plugin 5 files, roadmap 12 files, 18-term deny-list); `sources/` untracked, 4 paths ignored; `claude plugin validate` passes (icon warning only) | `sources/`: 1 plan, 2 reference-audit files, 1 memory note, 1 interview call, 5 scratchpad files, 16 page-js, 51 browser-batch, 81 bash, final message, README, deny.txt. S2: genericity `--added` scans only `.planning/platform-audit/` |
| 2 | The bundle extractor | ✅ | `scripts/inventory-core.js` (classic script, no eval/Node APIs); `scripts/inventory.mjs` (CLI of §2.6); 8 style fixtures in `test/bundles/` with `expected.json`; `test/inventory.test.mjs` | `npm test` 24/24 (7 genericity + 17 inventory); every `expected.json` matched with exact route and label counts; `noise` 0 routes, 0 labels, 0 unkeyed; genericity clean (plugin 24 files, `--added`) | Found: vite-react 8 routes, 5 labels, 4 ops, 1 column set, 3 rules, 2 enums, 4 limits, key redacted; formatjs-compiled 7 labels (vars, placeholder, plural as ICU); webpack-i18next 8 labels, 7 endpoints, 3 chunks; vue 7 routes with names; angular 7 routes, 3 `$localize` labels; next 6 routes; gql-ast 5 ops (4 AST, 1 persisted). **For S3:** routes are found from route-constant objects (3+ `key:"/path"` in one object), `path:` props (relative ones joined through `children:`), `to`/`href`/`redirect` props and `navigate(`/`push(`/`navigateByUrl(` calls with a literal. A minified call such as `n("/x")` is *not* found, so put the fixture's hidden admin routes in the route object or in `path:` props. Chunk discovery can reuse `AuditInventory.build(files).chunks` (`{ref, file}`, webpack chunk maps included). **For S6:** `inventory-core.js` is 69 KB, heavy to paste in-page |
| 3 | The fixture and the downloader | ✅ | `fixtures/partner-portal/` (server, SPA in 3 hashed chunks, `config.js`, `truth.json`, README); `scripts/bundle.mjs`; `test/portal.mjs`, `fixture.test.mjs`, `bundle.test.mjs` | `npm test` 37/37 (8 fixture + 5 bundle new); inventory over the download = exactly the 13 `truth.json` routes (4 hidden), all 20 operations, German labels; genericity clean (plugin 37 files, `--added`) | **For S4:** the SPA has only been `node --check`ed and HTTP-tested, so expect small DOM bugs on first drive. A full load costs 2 data requests (Shell + screen), in-app nav 1. Roles: account `menu` with `menuitemradio`, status `listbox` multiselectable, date range popover `dialog`, columns popover `dialog`, column header `menu`. **For S5/S9:** the inventory finds 2 of 4 endpoints (misses `href:"/api/export/…"` GET links) |
| 4 | The in-page probe | ✅ | `scripts/probe.js` (10,759 bytes); `test/probe.test.mjs` (16 tests); `playwright-core@1.63.0` dev dependency; fixture Help link | `npm test` 53/53 with the cap at 12 KB (D18); privacy and guard tests pass; genericity clean (plugin 40 files, `--added`) | Blocked first on the 8 KB cap; Kam chose 12 KB, one file (D18) |
| 5 | Report tooling | ✅ | `templates/{audit,screen,progress}.md`; `scripts/appendix.mjs`, `check-audit.mjs`; `test/score-report.mjs`; `test/samples/partner-portal-audit/` (clean report, appendix, map, 9 defects) + `plant-defects.mjs`; `test/report-tools.test.mjs` | `npm test` 75/75 (22 new); all 9 defects caught, each under its own check only; clean sample clean with no check skipped; scorer 100%/100% on it; genericity clean (plugin 62 files, `--added`) | **For S6:** `label-map.json` is `{group: heading}`, `*` suffix = prefix, heading `"shared"` = shared library; `appendix.mjs --report <file>` links back; `check-audit --appendix` also checks the appendix. The template's `<!-- SECTION` comments must all go, or `markers` fails |
| 6 | The skill text | ✅ | `SKILL.md` (117 lines); `reference/{interview,ground-rules,code-inventory,walking,writing,checking}.md`; `test/skill-lint.test.mjs` (12 tests); `inventory.mjs join`; plugin 0.9.0 | `npm test` 87/87 (12 new); `claude plugin validate` passes (icon warning only); genericity clean (plugin 69 files, `--added`) | Contracts (Claude Code 2.1.332 docs): `argument-hint` and `allowed-tools` are honoured; `allowed-tools` grants for the invoking turn and restricts nothing; the docs don't say it takes MCP names, though `mcp__claude-in-chrome__*` fits the permission-rule form; `${CLAUDE_SKILL_DIR}` works in plugin skills. **For S7/S8 to watch:** (1) the in-page fallback has run only in a stand-in page (vm): run it once on the fixture with `--forbid-assets`, to see that `javascript_tool` takes the 69 KB core and an `await (async…)()` snippet; (2) whether Chrome calls still prompt with this `allowed-tools`; (3) the probe can't press a row link, so detail pages go through `find` + a `computer` click; (4) headless, `folder` and `role` take defaults, so the five-answer command is complete |
| 7 | Evals, triggers and a rehearsal | ✅ | `evals/platform-audit-{headless-round-1,no-chrome,check}/` (case.yaml + scaffold.sh); `evals/lib/scaffold.mjs`; `evals/triggers/platform-audit.json` (10 + 10); `evals/run.sh` (not run, D17); `test/evals-lint.test.mjs` (14 tests) | `npm test` 102/102; rehearsal report `check-audit` clean (inventory, private terms, appendix); score routes 1.0, items 0.971; fixture log 49 requests, 0 mutation / upload / download, no 429; genericity clean (plugin 79 files, `--added`) | 6 fixes: (1) probe returned a record's name as a detail page's heading → `(record title)`; (2) `peek().hidden` listed `/login` → sign-in routes left out; (3) row checkbox via `open(i,{toggle:true})` impossible (cells unlisted) → `find` + `computer`; (4) blocked page's message → from `access`; (5) chips / profile block are plain text → screenshot or `zoom`; (6) `open()` omits an empty `blocked`. **For S8 to watch:** a real paste of the 10.9 KB probe into `javascript_tool` (the rehearsal injected the file); one load per batch; whether `find` + `computer` reach the row link and checkbox; no paid evals run |
| 8 | Trial run in Kam's Chrome | ⛔ | | | Needs decision: run Session 8 interactively — Kam starts it in cc-star-skills with Chrome connected, then runs the skill in a second terminal (D16) |
| 9 | Review and fixes | ⬜ | | | By hand |
| 10 | Release 1.0.0 | ⬜ | | | By hand; push on Kam's go-ahead |

Legend: ⬜ Not started · 🟡 In progress · ✅ Done · ⛔ Blocked

## Open items / blockers

- [x] **Run Session 1 before about 14 Dec 2026** (done 27 Nov 2026), while the 13 Nov audit's transcript still exists.
- [x] **Needs decision (S4): the probe's size cap.** Settled 27 Nov: 12 KB, one file (PLAN D18).
- [ ] **Kam's time** for the by-hand Sessions 8, 9 and 10.
- [ ] **Chrome with Claude in Chrome connected** for Session 8, able to open the fixture on `http://127.0.0.1:<port>`.
- [ ] **The trial repo** `/Users/kstar/_PRJ/platform-audit-trial`, which Session 8 makes. It is outside this repo and can be deleted after the release.
- [ ] **The go-ahead to push** `main` and `audit--v1.0.0` to `origin` and `GITLAB` (Session 10).
- [ ] **The paid evals**: none run in this roadmap (D17). After the release, Kam may run `bash plugins/audit/evals/run.sh`.

## Review notes

### Trial findings (written by Session 8, read by Session 9)

(none yet)

### Kam's notes on the trial report (read by Session 9)

(none yet)

### After 1.0

(none yet)

## Session log

### Session 1 — Sources and skeleton (2026-11-27) ✅

Runtime: opus/medium (autopilot attempt 1)

- Ignore lines added and confirmed with `git check-ignore` before any copy.
- `sources/` filled by script; every count matched the plan (16 `javascript_tool`, 51 `browser_batch`,
  81 Bash, 10 Write of which 5 in the scratchpad; 1 AskUserQuestion with its result).
- `deny.txt`: 18 terms (domain, product name and short forms, brand names and platform codes, account
  id, network-group names). Display name left out as a plain word; no account email in the sources.
- Plugin skeleton at 0.1.0 and the genericity test (7 tests, made-up terms only).
- Scaffold check: the deny-list and host rules were clean over all 12 roadmap files; nothing rephrased.
- Deviations / small choices: `--paths` (PLAN §5) and positional paths (prompt) both supported; `.co`
  added to the host rule's bare-name endings; P-2's XML-namespace host allowance dropped to match D9.

### Session 2 — The bundle extractor (2026-11-27) ✅

Runtime: opus/high (autopilot attempt 1)

- `inventory-core.js` is written fresh (R2). It has a tolerant scanner (strings, templates with nested
  `${}`, regex literals, comments), a bracket tree for "which object is this in", and an object-literal
  reader (no eval) that every extractor shares. `inventory.mjs` implements every §2.6 subcommand.
- Eight synthetic styles, each with an `expected.json`; the tests build each from a copy without it,
  because `build` reads every `.json` file in the folder.
- Checked against real minified code on this machine (playwright-core: 6.5 MB of bundles in 0.7 s, and
  its Vite + React trace viewer): no errors, no false routes, and the JSX text was found.
- **Shape refined, PLAN §2.6 updated in this commit:** `labelSources`; `on` on fragments; `file` on
  rules, enums and config; `{file,url}` source maps; `{ref,file}` chunks; optional `errors`; `variables`
  as `"$name: Type"` strings; `method` `null` when the code doesn't show it. Why: the prompt asks that
  each item record its file, and S3 resolves chunks relative to the file that names them.
- Small choices: label precedence (descriptors, then English or no-language resources and `$localize`,
  then compiled locales, then other languages); i18next `{{x}}` written as `{x}` (so the appendix never
  trips `check-audit`'s `{{` marker); compiled plurals rendered as ICU; redaction in the core, so the
  in-page fallback redacts too; relative `path:` values only in route-like objects or `children` arrays;
  ids with `_` (no dot) count as "without text" only in a namespace that already has labels.
- Limits recorded for S3/S6: minified `navigate` aliases and `createTextVNode` aliases aren't
  recognised; i18n calls inside UI props aren't text; the 69 KB core is heavy to paste in-page.
- Discrepancy: none between the prompt and PLAN §5.

### Session 3 — The fixture and the downloader (2026-11-27) ✅

- The fixture is a real plain-JS SPA (no React) in Vite + React shapes; the server reads its route
  table from `truth.json`, so the two can't drift. Hidden routes answer 200 with the permission screen
  prerendered into `<main>` (the SPA renders the same), so the browser-less tests can see it.
- Scripts, `app.css` and `config.js` are public; pages and `/api/` need the cookie. The downloader sends
  no cookies (D6), so a gated bundle would be unreadable, as on a real site it isn't.
- `truth.json` adds `shell`, `operations` and `endpoints`, and per-screen `panels` / `dialogs` / `tabs`,
  beyond the §2.7 shape; `/login` is a route (it is in the route object), `/` and `/logout` are not.
- The admin chunk uses absolute `path:` props: a `path:"/admin"` parent made the inventory report
  `/admin`, which is no screen. API URLs are inlined literals, as a minifier leaves them.
- `bundle.mjs`: `--delay` counts from the end of the previous file (from its start the server saw 238 ms
  for 250). Exit 0 done (refusals under `skipped`), 1 some failed, 2 usage, 3 stopped; a 3xx is a stop.
  Manifest shape recorded in PLAN §2.6.
- Deviation: none from the session's Do list. Gap found, not fixed (S2 code, out of scope): GET links
  written as `href:"/api/export/…"` aren't listed as endpoints.

### Session 4 — The in-page probe (2026-11-27) ✅ (after a decision)

Runtime: opus/high (autopilot attempt 1)

- `probe.js` written and tested against the fixture in headless Chromium. Every method of the Do list
  works: `recon()`, `nav()`, `screen(sel?)`, `overlays()`, `requests()`, `peek()` and `open()`, with one
  `safe()` pass over every output. **Blocked on size:** 10,759 bytes against the 8 KB cap. By part:
  shared helpers and selectors about 3.4 KB, the guard and its word lists 1.9 KB, `screen()` 1.4 KB,
  `peek()` 1.35 KB, framework hints 0.55 KB, `requests()` 0.55 KB, `recon()` + `nav()` 0.57 KB,
  `overlays()` 0.48 KB, header 0.36 KB. Already hand-compacted from 13 KB. The prompt makes this a
  decision, so the row is ⛔ and nothing was cut to fit.
- Tests (16): every method on Orders, Payouts (empty), Customers, Order details and Profile; the column
  menu, status listbox, Columns chooser, date picker, Account menu, Request payout dialog and Import
  wizard open; `open()` refuses Submit, Log out, Export CSV, the file input and drop zone, Download
  template, Copy, the language switch, a column checkbox, Select all, the Profile save and the external
  Help link, and allows the Status filter, Columns, Date range, Request payout and Import customers. The
  privacy check compares every output with the page's own cell text, `dd` values and field values, the
  private terms and query strings. The server log shows no mutation, upload or download.
- **Guard rules (for S6 to document):**
  - refused anywhere: disabled; a file input, or a control holding one or next to one; another host;
    `target=_blank`; log out / sign out (by name or `href`); downloads (`export*`, `download*`, `a[download]`,
    file-like or `/export/` paths) unless `allowDownloads`; the danger words *delete, remove, destroy,
    erase, purge, transfer, pay, refund, withdraw, approve, reject, decline, revoke, ban, suspend,
    deactivate, archive, reset, publish, upload, copy, clipboard, duplicate, cancel <something>* (plus
    German forms); the submit words *save, submit, confirm, ok, yes, apply changes, update* (plus German);
    switches and `menuitemradio`/`menuitemcheckbox` (settings and language); checkboxes and radios unless
    `toggle`;
  - **opener vs submitter:** the form verbs *send, import, create, add, invite, finish, done* are allowed
    outside a dialog or form (they open one: Send voucher, Import customers) and refused inside one, as
    is `type=submit` in a dialog and any submit button of a form. Plain *Cancel*, *Next*, *Apply* (a
    filter) are allowed. During the click `alert`, `confirm`, `prompt` and `window.open` are stubbed and
    reported under `blocked`.
- Small choices: words are matched on the accessible name with Unicode word edges; controls in table
  cells and `dd` are never listed, only counted under `rowControls` when a label repeats (data differs
  per row); `safe()` also masks emails and digit runs of 4+ characters (ids, dates, amounts), except in
  `version` and `host`; `requests()` groups by host; `peek()` excludes log-out routes from `hidden` and
  lists lazy chunks it saw named but didn't read; `screen(sel)` takes an optional scope for the shell.
- Findings: Resource Timing lists a fetch only once its body is read (the app reads them, so its 429s
  show; an unread one doesn't), so no fetch wrapper was added. DevTools-evaluated code ignores the page's
  CSP, so the eval-blocked path of `reinstall` is simulated in the test; whether `javascript_tool`
  behaves the same is for S8 to see.
- Deviation: the fixture had no external link, so it gained a top-bar **Help** link to
  `help.example.com` (new tab), with a `shell.help` label, its German form, `truth.json` `shell.external`
  and a README line. PLAN §2.7 updated. The S3 tests still pass.

**Resumed interactively (2026-11-27):** Kam settled the blocker: the cap is 12 KB and the probe stays one
file (PLAN §3 D18; the split `peek.js` was rejected). The cap is updated in PLAN §2.6, R7 and §5 S4, in
prompts 4 and 9, and in the size test (`<= 12288`). `probe.js` is unchanged at 10,759 bytes, so about
1.5 KB is left for S9's fixes. Gate re-run: `npm test` 53/53, genericity clean over the plugin (40 files)
and `--added`.

### Session 5 — Report tooling (2026-11-27) ✅

Runtime: sonnet/medium (autopilot attempt 1)

- Landed: the three templates, `appendix.mjs`, `check-audit.mjs` (routes, private, markers, tables, xref,
  screens, keys, links, summary; `--json`; exit 0/1/2), the dev scorer, a hand-written clean audit of the
  fixture with its generated appendix, nine planted-defect copies (written by `test/samples/plant-defects.mjs`),
  and `test/report-tools.test.mjs` (22 tests).
- Gate: `npm test` 75/75; each defect is caught under its own check and no other; the clean sample is clean with
  every check run; genericity clean over 62 plugin files and `--added`.
- Small choices: `label-map.json` is flat `{group: heading}` with `*` prefix keys and a `"shared"` heading;
  sections follow map order, then Other, shared library, ids without text; groups and labels sorted. The
  `private` finding prints only a term's first two characters and length. `In progress`, TODO, TBD and FIXME
  match case-sensitively. The sample's appendix is built from `fixtures/partner-portal/public/`, so the test
  needs no server; tests also fail if the committed appendix or defect copies go stale.
- Deviation: `appendix.mjs` gained an optional `--report <file>` (a link back to the report), and
  `check-audit --appendix` also checks the appendix with private, markers, tables and links. PLAN §2.6 updated.

### Session 6 — The skill text (2026-11-27) ✅

Runtime: fable/high (autopilot attempt 1)

- Landed: `SKILL.md` (frontmatter, the `$S` line, the route table, the Never list word for word, steps 0–7,
  the headless rule) and the six reference files; `test/skill-lint.test.mjs` (12 tests); plugin 0.9.0.
- **Contracts.** The `claude-code-guide` agent isn't offered in this run, so the current Claude Code docs
  (the skills, plugins-reference and permissions pages) were read through a fetch agent instead, with
  Claude Code 2.1.332 installed. Answers:
  - frontmatter: `name`, `description`, `when_to_use`, `argument-hint`, `arguments`,
    `disable-model-invocation`, `user-invocable`, `allowed-tools`, `disallowed-tools`, `model`, `effort`,
    `context`, `agent`, `background`, `hooks`, `paths`, `shell`, `metadata`; unknown fields are ignored. The
    listing cuts a description at 1,536 characters (ours is about 1,000);
  - `allowed-tools` (a space- or comma-separated string, or a YAML list) grants the listed tools without a
    prompt during the turn that invokes the skill, and restricts nothing. The docs don't say whether it takes
    MCP tool names; `mcp__<server>__*` is the documented permission-rule form, so `mcp__claude-in-chrome__*`
    is listed, and an entry that isn't honoured only means a prompt. Untested until S8;
  - the base directory: `${CLAUDE_SKILL_DIR}` is filled in in the skill's body, for plugin skills too, with
    the skill's own folder. SKILL.md uses it, and still says "the base directory you were given".
- Small choices:
  - Bash is allowed by pattern (`node`, `mkdir`, `ls`, `date`), not whole as in user-guides, so a `curl`
    (the way round a refused download) still asks.
  - Headless, `folder` and `role` take their defaults and are said aloud; the other five are never filled
    in. PLAN §2.3's example command gives exactly those five, and S7's eval and rehearsal use them.
  - A headless Round 1 stop also says what Round 2 needs (`pace`), so one command settles both.
  - After a first 429 the walk goes on one pace slower (5 → 10 → 20 → 30 s). A 429 to the downloader counts
    as the first.
  - `hidden=try-two`: two routes from different menu groups, read-only kinds first; both blocked ends it.
  - `interact=look` moves by menu, tabs and row links and opens nothing else. With `downloads`, each export
    is pressed once and the file is never opened.
  - `{toggle: true}` is for one thing, the first row's selection checkbox. Next in a wizard is not pressed,
    though the guard allows it.
  - `code=skip`: no inventory, no appendix, `check-audit` without `--inventory`.
  - Another role gets its own slug (`<slug>-<role>`), work folder and report (D14).
  - `private-terms.txt` is filled by reading the profile block once (the probe never returns values).
- **Script change** (the text exposed a gap): `inventory.mjs join <parts-dir> --sums '<list>' --out <file>`.
  The in-page fallback had no way to turn the paged slices back into `inventory.json`, and a wrongly copied
  slice can still read as JSON. `join` checks each part's length and sum against the list the page prints
  and writes nothing unless all match. The fallback's three page snippets live in `code-inventory.md`; the
  lint test runs them in a vm stand-in page over the fixture's scripts and compares the joined inventory
  with the CLI's. PLAN §2.6 and D6 updated.
- Other PLAN updates: the status line; §2.2 (the frontmatter as written); §2.3 (headless `folder` and
  `role`); D4 (one pace slower after a 429).
- Deviations: the `claude-code-guide` step, as above. No browser was opened and no eval written.
- Gate: `npm test` 87/87; `claude plugin validate plugins/audit` passes (the icon warning only); genericity
  clean over 69 plugin files and `--added`.

### Session 7 — Evals, triggers and a rehearsal (2026-11-27) ✅

Runtime: opus/medium (autopilot attempt 1)

- **Evals (not run, D17).** Three eval-format cases on user-guides' pattern, each with a `scaffold.sh` over a
  shared `evals/lib/scaffold.mjs`: `platform-audit-headless-round-1` (Round 1 printed word for word, the pace
  note and the answering command; no Write/Edit, no Chrome ToolSearch, no `bundle.mjs`, no work folder),
  `platform-audit-no-chrome` (says Claude in Chrome isn't connected; no other browser, fetch or file) and
  `platform-audit-check` (the clean sample with the markers, tables, xref and summary defects planted; graders
  name each check and the skipped ones). A 20-query trigger set (10 + 10, the near-misses as listed) and
  `run.sh` (staged copy without `node_modules`, `--no-publish --scaffold --trust-plugin`, results to
  `evals/results/`, a BILLED header naming D17).
- **Evals lint** (`test/evals-lint.test.mjs`, 14 tests) goes beyond the brief in two places: it matches the
  headless graders against the Round 1 block in `interview.md`, so the two can't drift; and it runs the check
  scaffold and compares `check-audit`'s findings with the graders' `names-*`.
- **Small choices.** The scaffolds use no git: the skill never runs git, and user-guides found git fails
  inside eval runs, so no `bin/git` wrapper is needed. The command grader's host is written unescaped
  (`app.example.com`), because the genericity test reads `app\.example\.com` as host "app".
- **Rehearsal** (D15) at `test/.out/rehearsal/` on the fixture (port 0), with the Playwright MCP tools:
  demo sign-in, recon, `peek()`, download (4 files) and inventory (13 routes, 154 labels, 20 operations), the
  shell, all six menu screens and both detail pages, every filter, chooser and dialog opened and cancelled,
  Export CSV refused by the guard, then `hidden=try-two` on `/reports/finance` and `/admin/audit-log` (both
  "Access denied", so the other two stayed 🔒). Report, label map and appendix written; `check-audit` clean
  on the first run; tab's sessionStorage entry removed and the browser closed; fixture stopped.
- **Deviations in the stand-in** (harness, not skill): the probe was injected with `page.addScriptTag` from
  the file rather than transcribed into `browser_evaluate` (same text, the sessionStorage copy still worked
  after full loads); several local opens, and the Reports tabs, ran in one `browser_run_code_unsafe` call with
  the pace's 5 s waits between loads, which a Claude in Chrome run must not do (one load per batch). S8 tests
  the real paste and pacing.
- **What broke, and what changed:**
  1. `screen()` on Customer details returned the customer's name as the `h1`. → `probe.js`: on a page whose
     path holds a digit, a top heading with no digit or mask becomes `(record title)`; new probe test on
     Customer details; `walking.md` › Detail pages says so.
  2. `peek().hidden` listed `/login`, so Round 1's count and names (and a `try-*` pick) would include the
     sign-in page. → `probe.js` leaves out sign-in and log-out routes; the peek test asserts it; the probe
     table in `walking.md` says so.
  3. `ground-rules.md` and `walking.md` said to tick a row's checkbox with `open(i, {toggle: true})`, but
     the probe never lists controls in table cells. → Both now say `find` + a `computer` click, as for row
     links; `{toggle: true}` is kept for a listed checkbox.
  4. On a blocked page `screen()` gives only the heading. → `walking.md` › Hidden routes: take the message
     from `inventory.mjs access` › denied messages, or a zoomed screenshot.
  5. Balance chips, the profile block and "Referral link" are plain text the probe doesn't return. →
     `walking.md` › The global shell: read their labels from the screenshot or `zoom`, matched to
     `labels show`, kind of value only.
  6. `open()` answers `{"ok":1,"t":…}` with no `blocked` key when nothing fired. → the probe table says so.
- Probe now 10,903 bytes (cap 12 KB, D18). `npm test` 102/102.

### Session 8 — Trial run in Kam's Chrome (2026-11-27) ⛔

Runtime: opus/medium (autopilot attempt 1)

- Started under autopilot, so it stopped at once by design (D12): the trial needs Kam present and Chrome
  with Claude in Chrome connected. Row 8 set to ⛔ `Needs decision: run Session 8 interactively`.
  No work was done; nothing else changed.
