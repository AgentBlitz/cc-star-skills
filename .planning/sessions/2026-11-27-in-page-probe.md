# Session: The in-page probe (platform-audit S4) — needs a decision on the size cap

**Date:** 2026-11-27
**Branch:** main
**Roadmap:** `.planning/platform-audit`
**Runtime:** `opus/high (autopilot attempt 1)`

## Summary

Wrote `probe.js`, the helper Claude pastes into a page to read screens as text. It has every method in
the Do list: `recon`, `nav`, `screen`, `overlays`, `requests`, async `peek`, and `open`, the guarded
click. Every output goes through one `safe()` pass. Also added `playwright-core@1.63.0` as the plugin's
only dev dependency, and a 16-test Playwright suite against the Partner Portal fixture. Every behaviour,
privacy and guard test passes. The one failure is the size limit: the probe is 10,759 bytes against an
8 KB cap. It was already hand-compacted from 13 KB, and without `peek()` it is still 9.4 KB. The session
prompt says a too-small cap needs a decision, so the tracker row is ⛔ `Needs decision`, and nothing was
cut to fit.

## Changes

- `plugins/audit/skills/platform-audit/scripts/probe.js` — new: the probe (version 1.0.0). It saves its
  own source in sessionStorage and documents the `reinstall` one-liner in its header.
- `plugins/audit/test/probe.test.mjs` — new: 16 tests in headless Chromium. They cover each method on
  Orders, Payouts, Customers, Order details and Profile, and with the column menu, status listbox,
  Columns chooser, date picker, Account menu, Request payout dialog and Import wizard open. They also
  check the guard's refusals and allowances, privacy against the page's own data, `peek()`'s hidden
  routes, pasting twice, a 429, reinstall and its failures, and the 8 KB limit (failing).
- `plugins/audit/package.json`, `plugins/audit/package-lock.json` — `playwright-core@1.63.0` dev
  dependency (C5).
- `plugins/audit/fixtures/partner-portal/public/assets/index-3f9c2a71.js` — a top-bar Help link to
  `help.example.com` that opens in a new tab, with a `shell.help` descriptor.
- `plugins/audit/fixtures/partner-portal/public/assets/de-c27f5a94.js` — German `shell.help`.
- `plugins/audit/fixtures/partner-portal/truth.json` — `shell.external`.
- `plugins/audit/fixtures/partner-portal/README.md` — mentions the Help link.
- `.planning/platform-audit/PLAN.md` — §2.7 lists the Help link.
- `.planning/platform-audit/TRACKER.md` — row 4 ⛔ with the decision, an open item, and the session log
  with the guard rules for S6.

## Decisions & Rationale

- **Opener vs submitter:** form verbs (send, import, create, add, invite, finish, done) are allowed
  outside a dialog or form, where they open one, and refused inside one. Submit words (save, submit,
  confirm, ok, yes, apply changes, update) and danger words are refused anywhere. This lets Send voucher
  and Import customers open their forms, while Send and Import inside them stay refused.
- **Toggles are refused by default** (`toggle` opts in to checkboxes and radios). Switches and
  `menuitemradio`/`menuitemcheckbox` are always refused, because they change settings or language.
- **Row data:** controls in table cells and in `dd` are never listed. They are counted under
  `rowControls` only when a label repeats, because data differs from row to row.
- **Masking beyond the spec:** emails and digit runs of 4+ characters (ids, dates, amounts) are masked,
  except in the `version` and `host` fields.
- **No fetch/XHR wrapper:** `requests()` uses only Resource Timing's `responseStatus` (Chrome ≥ 109). The
  probe stays read-only. The catch: a fetch whose body is never read isn't listed.
- **Fixture change:** the Help link was added because the guard test needs an external link and the
  fixture had none.
- **Did not cut features to fit 8 KB.** The prompt makes an undersized cap a decision.

## Remaining Work

- **Needs decision: the probe's size cap.**
  - (a) Raise it to 12 KB and keep one file. This is recommended: it's one paste per tab, and reinstall
    from sessionStorage works even under a CSP, because DevTools-evaluated code is exempt from it.
  - (b) Keep 8 KB: move `peek()` into a paste-once `peek.js`, and cut about 1.3 KB more (row-control
    counts, the alert/confirm/open stub, German danger words, the framework long tail).
- Once decided: change the size test (or split the file), make `npm test` green, update PLAN §2.6/R7 and
  §3, then set row 4 ✅ and commit.
- For S8: check whether `javascript_tool` also exempts eval from the page's CSP.

## Resumption Context

Key files to review when picking this up:
- `plugins/audit/skills/platform-audit/scripts/probe.js`
- `plugins/audit/test/probe.test.mjs`
- `.planning/platform-audit/TRACKER.md` (row 4 and the Session 4 log)

Suggested opening prompt for next session:
> "Run `/planning:session .planning/platform-audit`. Row 4 is ⛔ Needs decision on the probe's size
> cap; ask me, apply the answer, get `npm test` green in `plugins/audit`, and close Session 4."
