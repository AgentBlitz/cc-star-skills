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
| 4 | The in-page probe | ⛔ | `scripts/probe.js` (10,759 bytes); `test/probe.test.mjs` (16 tests); `playwright-core@1.63.0` dev dependency; fixture Help link | `npm test` 52/53: every behaviour, privacy and guard test passes; **only the 8 KB size test fails**; genericity clean (plugin 40 files, `--added`) | **Needs decision: probe.js is 10.8 KB with every method and guard S4 specifies, and 8 KB cannot hold them (without `peek()` it is still 9.4 KB). Options: (a) raise the cap to 12 KB and keep one file (recommended: one paste per tab, and reinstall from sessionStorage worked even under a CSP, because DevTools-evaluated code is exempt); (b) keep 8 KB by moving `peek()` into a paste-once `peek.js` and cutting about 1.3 KB more (the row-control counts, the alert/confirm/open stub, the German danger words, the framework long tail).** |
| 5 | Report tooling | ⬜ | | | |
| 6 | The skill text | ⬜ | | | Version 0.9.0 |
| 7 | Evals, triggers and a rehearsal | ⬜ | | | No paid runs (D17) |
| 8 | Trial run in Kam's Chrome | ⬜ | | | By hand |
| 9 | Review and fixes | ⬜ | | | By hand |
| 10 | Release 1.0.0 | ⬜ | | | By hand; push on Kam's go-ahead |

Legend: ⬜ Not started · 🟡 In progress · ✅ Done · ⛔ Blocked

## Open items / blockers

- [x] **Run Session 1 before about 14 Dec 2026** (done 27 Nov 2026), while the 13 Nov audit's transcript still exists.
- [ ] **Needs decision (S4): the probe's size cap.** 8 KB, or 12 KB, or a split `peek.js`. See row 4.
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

### Session 4 — The in-page probe (2026-11-27) ⛔ Needs decision

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
