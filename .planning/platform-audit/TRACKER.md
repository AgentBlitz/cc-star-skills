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
| 3 | The fixture and the downloader | ⬜ | | | |
| 4 | The in-page probe | ⬜ | | | |
| 5 | Report tooling | ⬜ | | | |
| 6 | The skill text | ⬜ | | | Version 0.9.0 |
| 7 | Evals, triggers and a rehearsal | ⬜ | | | No paid runs (D17) |
| 8 | Trial run in Kam's Chrome | ⬜ | | | By hand |
| 9 | Review and fixes | ⬜ | | | By hand |
| 10 | Release 1.0.0 | ⬜ | | | By hand; push on Kam's go-ahead |

Legend: ⬜ Not started · 🟡 In progress · ✅ Done · ⛔ Blocked

## Open items / blockers

- [x] **Run Session 1 before about 14 Dec 2026** (done 27 Nov 2026), while the 13 Nov audit's transcript still exists.
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
