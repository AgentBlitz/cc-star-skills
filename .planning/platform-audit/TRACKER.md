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
| 2 | The bundle extractor | ⬜ | | | |
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
