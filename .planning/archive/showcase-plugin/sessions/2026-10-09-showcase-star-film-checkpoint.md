# Session: showcase S12 — Star film and live demo (stopped for the by-hand run)

**Date:** 2026-10-09
**Branch:** main
**Roadmap:** `.planning/showcase-plugin`
**Runtime:** `opus/high (autopilot attempt 1)`

## Summary

Autopilot picked up Session 12 (P1 · Star I: the film and live demo), the second by-hand session. Session 12 is run with the user in the Star repo, so PLAN §4's checkpoint protocol, decision D14 and the session prompt require a headless run to stop at once. Row 12 is now ⛔ `Needs decision: run Session 12 interactively …`, with the command to start it. Before stopping it confirmed three things: Session 11 is ✅, `~/_PRJ/star` exists, and the user key file `~/.config/showcase/.env` doesn't exist yet. No code changed and nothing in Star was touched.

## Changes

- `.planning/showcase-plugin/TRACKER.md`: row 12 set to ⛔ with the `Needs decision:` checkpoint note; Session 12 session-log entry added with the runtime line.
- `.planning/sessions/2026-10-09-showcase-star-film-checkpoint.md`: this summary.

## Decisions & Rationale

- Stopped without doing any of the session's work. The prompt's headless branch and D14 require it: the session runs `/showcase` in Star with the user (interview rounds, storyboard approval, narrator pick, Round 5, live demo), and commits in Star only with the user's go.

## Remaining Work

- Run Session 12 interactively: `cd ~/_PRJ/star && claude --plugin-dir ~/_PRJ/cc-star-skills/plugins/showcase --add-dir ~/_PRJ/cc-star-skills`, then `/session ~/_PRJ/cc-star-skills/.planning/showcase-plugin`.
- Before or during it, put `OPENROUTER_API_KEY` in `~/.config/showcase/.env` (`showcase keys init`, then edit the file, or `showcase keys import <file>`; check with `showcase keys test`). The audition and the final voice need it, and the file doesn't exist yet.
- Then Session 13 (P2 · Star II: the in-app tour and the release), also by hand.

## Resumption Context

Key files to review when picking this up:
- `.planning/showcase-plugin/PLAN.md` (§3 D8, D13, D14; §4 checkpoint protocol and working directories; §2.7–§2.8; §5 Session 12)
- `.planning/showcase-plugin/prompts/session-12.md`
- `.planning/showcase-plugin/TRACKER.md` (open items; Session 11 log)

Suggested opening prompt for next session:
> "From ~/_PRJ/star: /session ~/_PRJ/cc-star-skills/.planning/showcase-plugin — run the Session 12 Star film and live demo interactively."
