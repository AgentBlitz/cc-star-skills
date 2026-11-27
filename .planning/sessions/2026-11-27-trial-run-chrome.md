# Session: platform-audit S8 — trial run in Chrome

**Date:** 2026-11-27
**Branch:** main
**Roadmap:** `.planning/platform-audit`

## Summary

Ran Session 8 by hand, after the user answered its `Needs decision` (D19). After preflight (`npm test` 102/102, plugin 0.9.0), the throwaway trial repo was made and the fixture started with a request log. The user signed in to the fixture in Chrome and ran `/audit:platform-audit` in a fresh session loaded with `--plugin-dir`, and the skill completed its report.

The report passed `check-audit`, and the fixture log showed a read-only, paced run. The transcript showed one probe paste, no refusals and no errors. The score was below both thresholds as scored (routes 92.3%, items 84.1%). The cause was the scorer's exact heading-name match (98.6% of items once matched), plus `/login` marked 🔒 because the user signed in by hand. The user ruled the gate a pass (D20), and Session 9 fixes the scorer, the status key and truth. Twelve findings are under TRACKER › Review notes › Trial findings. Runtime: opus/medium (by hand).

## Changes

- `.planning/platform-audit/PLAN.md`: D19 (run S8 by hand now) and D20 (the score gate passes on review).
- `.planning/platform-audit/TRACKER.md`:
  - row 8 is ✅, with the artifacts, verification and notes;
  - the Chrome and trial-repo open items are ticked;
  - the 12 trial findings are recorded;
  - the S8 session-log entry is added.
- `.planning/sessions/2026-11-27-trial-run-chrome.md`: this summary.
- Outside the repo, not committed:
  - `/Users/kstar/_PRJ/platform-audit-trial` (the trial repo and its report);
  - `plugins/audit/test/.out/trial/log.jsonl` (git-ignored).

## Decisions & Rationale

- D20: pass the score gate on review rather than ⛔. The misses come from measurement, not from coverage. A ⛔ would also have stalled S9, the session meant to fix them.

## Remaining Work

- S9: fix Trial findings 1–3 (scorer aliases, a status for an unopened sign-in page, truth), then review findings 9–10. Collect the user's notes on the trial report.
- S10: release 1.0.0, pushing only on the user's go-ahead.
