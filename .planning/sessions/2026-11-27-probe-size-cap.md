# Session: Probe size cap settled at 12 KB (platform-audit S4, resumed)

**Date:** 2026-11-27
**Branch:** main
**Roadmap:** `.planning/platform-audit`

## Summary

Resumed Session 4, which had stopped on a `Needs decision` blocker: `probe.js` has every method and guard
the session asked for, but it is 10,759 bytes and the cap was 8 KB. The user chose to raise the cap to
12 KB and keep the probe as one file. The decision is recorded as D18 in PLAN §3. The cap is now 12 KB
everywhere it was stated, and the size test checks it. The probe itself did not change. The gate was run
again and passed: `npm test` 53/53, and genericity clean over the plugin and the added planning lines.
Session 4 is ✅.

## Changes

- `.planning/platform-audit/PLAN.md`: new decision D18 (12 KB, one file, and why the split was rejected);
  the cap changed from 8 KB to 12 KB in §2.6 (the `probe.js` row), R7, and §5 Session 4 (Do and gate).
- `.planning/platform-audit/prompts/session-4.md`: the cap is 12 KB in the Do list, the test list and
  the gate; the working rule now says the size question was settled by D18.
- `.planning/platform-audit/prompts/session-9.md`: the fix rule says the probe stays at most 12 KB.
- `plugins/audit/test/probe.test.mjs`: the size test checks `<= 12288` bytes and is renamed to match.
- `.planning/platform-audit/TRACKER.md`: row 4 is ✅; the open item is ticked; a resume note is added to
  the Session 4 log entry.

## Decisions & Rationale

- **The probe's cap is 12 KB, in one file (D18)** → one paste per tab. Reinstalling from sessionStorage
  worked even under a CSP, because code evaluated from DevTools is exempt, so a bigger file costs little.
  The rejected option split `peek()` into a paste-once `peek.js` and cut about 1.3 KB of features (the
  row-control counts, the alert/confirm/open stub, the German danger words, the framework long tail).

## Remaining Work

- Session 5 (report tooling) is next.
- The probe has about 1.5 KB of room left under the cap for S9's fixes.
- Whether `javascript_tool` ignores the page's CSP the way DevTools does is still for S8 to check.

## Resumption Context

Key files to review when picking this up:
- `.planning/platform-audit/PLAN.md` (§3 D18, §5 Session 5)
- `.planning/platform-audit/prompts/session-5.md`
- `plugins/audit/skills/platform-audit/scripts/probe.js`

Suggested opening prompt for next session:
> "Run /session to start platform-audit Session 5, the report tooling."
