# Session: showcase S12 — the Star film and live demo, by hand

**Date:** 2026-10-09
**Branch:** main
**Roadmap:** `.planning/showcase-plugin`

## Summary

Ran Session 12 (P1 · Star I) interactively from the Star repo, with the user, through the whole `/showcase` wizard. It began with preflight, Round 1 and three Explore agents, then `init` and `inspect`, Rounds 2 and 3, a 6-beat one-minute pitch tour (`star-pitch`), and rehearsals and stills for Round 4. The voice is gods-eye's Gemini "Charon", via a fresh OpenRouter key that the user set; the gods-eye key had expired. After the strict film came Round 5 (approved as final, Charon saved as the default) and then the live demo, which the user watched. Determinism is config only: the production build, a `.backup` snapshot copied fresh for every take and opened read-only, the copilot off, search pinned to keyword mode, and a fixed clock. Proving the plugin on a real app turned up six plugin bugs, each fixed with a test that fails without the fix:
1. The snapshot was skipped by `inspect` and `auth`.
2. Split React text broke accessible names.
3. The heartbeat died after a page load, which froze still screens.
4. Recording an approval made a rehearse stale.
5. Gemini's leading click and quiet put the speech behind its caption.
6. `check` ignored voiced durations.

The gate passed: rehearse 5/5, `film --strict` green (58.6 s), three renders' SRTs identical within 34 ms, Round 5 approval plus the live demo, and `npm test` at 243/243. Star's `showcase/` is committed there (`e171968`); nothing is pushed.

## Changes

- `plugins/showcase/toolkit/host/app.ts`, `host/project.ts`, `host/inspect.ts`, `host/auth.ts`: a `snapshot` option separate from `reset` (default: as `reset`); inspect and auth keep the snapshot and skip the reset.
- `plugins/showcase/toolkit/runtime/src/anchors.ts`: `textWithAlts` joins adjacent text as it is and sets block boxes (computed `display`), labels and alts apart, so "30 result" + "s" reads "30 results".
- `plugins/showcase/toolkit/runtime/src/index.ts`: the film heartbeat's re-arm check runs again on a native `setTimeout(0)`, after the host's init scripts have set `__showcaseConfig` and `__showcaseRolling`.
- `plugins/showcase/toolkit/lib/tours.ts` (`playHash`), `host/rehearse.ts` (`tourHash` in the report), `film/verify.ts` and `film/record.ts` (`denyState` compares hashes, with an mtime fallback): an approval date no longer makes a rehearse stale.
- `plugins/showcase/toolkit/voice/audio.ts`, `voice/keys.ts`: the trim is RMS over 20 ms, keeps 20 ms before the crossing, and `POST.chain` is 3.
- `plugins/showcase/toolkit/runtime/src/narrative.ts` (`VoicedMs`), `commands/check.ts`: T008 times voiced sentences by their manifest clips. The stats show "(voiced)" or "n/m voiced", and a tour with no config still checks.
- `plugins/showcase/toolkit/runtime/dist/*`: rebuilt (0.9.0, stamp fresh).
- `plugins/showcase/toolkit/test/host.test.ts`, `test/runtime/engine.test.ts` (2 tests), `test/film.test.ts`, `test/voice/pipeline.test.ts`, `test/tour-cli.test.ts`: one regression test per fix (6 new, 243 in all).
- `plugins/showcase/skills/showcase/reference/determinism.md`: inspect and auth restore the snapshot but skip the reset.
- `plugins/showcase/skills/showcase/reference/tour-format.md`: T008's wording.
- `.planning/showcase-plugin/PLAN.md`: §3 "Review notes — Star film and live demo" (approval, the empty deny-list by choice, T008, chain 3).
- `.planning/showcase-plugin/TRACKER.md`: row 12 ✅; the key open item ticked; Review notes › Star film and live demo; the Session 12 log entry with the friction log and `Runtime: opus/high`.
- `.planning/sessions/2026-10-09-showcase-star-film.md`: this summary.
- In Star (committed there, `e171968`): `.gitignore` lines, `showcase/config.json`, `showcase/.schema/`, `showcase/tours/star-pitch.json`, `showcase/storyboard/star-pitch.md`, `showcase/voice/` (14 clips + manifest).

## Decisions & Rationale

- **Gods-eye's narrator, with no audition:** the user asked for "the same voice we decided on for gods-eye", which is `film/voice.json` there (`google/gemini-3.8-flash-tts`, `Charon`).
- **`privacy.deny` empty, by the user's choice** ("Nothing sensitive"), though the prompt asked for names and hostnames:
  - Star redacts its DB at write time.
  - A committed list of names would itself break Star's rule against naming people.
- **Search pinned in the step path (`?mode=keyword`), not a fake `EMBED_URL`.** The URL carries the mode, so this needs no stub server.
- **Fixes over workarounds:** each bug Star exposed was fixed in the plugin, not routed around in Star's tour:
  - The trim keeps the 50 ms A/V gate and changes the chain, rather than loosening the gate.
  - `check` follows C5, rather than the text being padded to fit the estimate.
- **Chain bumped to 3, not reused as 2:** the file keys change, so Star's chain-2 clips went stale on their own, and nothing had to be deleted by hand.
- **Three sentences left at 185–187 wpm:** a hair over the line once 30 ms of dead air left each clip. Re-takes swing by ±10 wpm, so this was named to the user in Round 5, who approved as final.

## Remaining Work

- **Session 13** (P2 · Star II: the in-app tour, then the release), by hand, from Star.
- The plan dir's `autopilot/` run logs are still uncommitted, as in earlier sessions.
- **Star housekeeping, outside this roadmap:** `data/star.db` reported `PRAGMA freelist_count` 231 when it was snapshotted. Star's CLAUDE.md asks for a VACUUM through better-sqlite3 after redaction, because free pages can hold old text that `push:db` would ship.

## Resumption Context

Key files to review when picking this up:
- `.planning/showcase-plugin/PLAN.md` (§3 review notes, §5 Session 13)
- `.planning/showcase-plugin/prompts/session-13.md`
- `.planning/showcase-plugin/TRACKER.md` (the Session 12 log's friction list)
- `~/_PRJ/star/showcase/` (`config.json`, `tours/star-pitch.json`)
- `plugins/showcase/skills/showcase/reference/in-app.md`

Suggested opening prompt for next session:
> "cd ~/_PRJ/star && claude --plugin-dir ~/_PRJ/cc-star-skills/plugins/showcase --add-dir ~/_PRJ/cc-star-skills, then /session ~/_PRJ/cc-star-skills/.planning/showcase-plugin — run Session 13 (the in-app tour in Star, then the v1.0.0 release) by hand."
