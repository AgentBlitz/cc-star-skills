# Session: showcase S3: the tour format, narrative rules and the Compass golden

**Date:** 2026-10-09
**Branch:** main
**Roadmap:** `.planning/showcase-plugin`
**Runtime:** `opus/medium (autopilot attempt 1)`

## Summary

Ran Session 3 (T1) of the showcase roadmap. The tour format now exists as a JSON Schema 2020-12 subset (`toolkit/schema/tour.schema.json`) read by a small browser-safe interpreter in `toolkit/runtime/src/schema.ts`, which also holds the TS types and the cross-field checks (T002–T007). `toolkit/runtime/src/narrative.ts` holds the narrative rules as code: `readingMs`, the length presets, kind factors and beat counts, greedy 2 × 42 caption wrapping, spoken-number detection, `firstToCut`, the last-card hold (T008–T014). Three new CLI commands: `check` (static, rule ids T001–T015, `--json`), `storyboard` (deterministic markdown with a content hash `check` compares, T015 when stale) and `init` (idempotent scaffold). `showcase/config.json` is validated by the same interpreter against `config.schema.json` (`toolkit/lib/config.ts`). Four spine templates and a config template ship under `skills/showcase/templates/`, each clean under `check`. gods-eye's Compass pitch is ported to `toolkit/test/golden/compass-pitch.json` and measures 100.8 s (100 808 ms) of `readingMs` narration over 248 words and nine beats, with no issues. Reference docs `tour-format.md`, `narrative.md` and a draft `interview.md` print through `showcase docs`. Gate: `npm test` 112/112, typecheck clean, `check` clean on every template, `docs tour-format` prints, `claude plugin validate` passes.

## Changes

- `plugins/showcase/toolkit/schema/tour.schema.json`: the tour format, the single source (tour, meta, anchors, steps, beats, sentences, cards, 18 action kinds, 10 readiness predicates).
- `plugins/showcase/toolkit/schema/config.schema.json`: `showcase/config.json` (app, browser, voice, film, privacy).
- `plugins/showcase/toolkit/runtime/src/schema.ts`: TS types; `SchemaValidator` (the keyword subset, refuses unknown keywords, discriminated-union errors); `validateTour`, `crossFieldIssues` (T002–T007), `wrapCaption`, `captionFits`, `beatsOf`.
- `plugins/showcase/toolkit/runtime/src/narrative.ts`: `readingMs`, `PRESETS`, `KIND_FACTOR`, `presetFor`, `budgetFor`, `spokenNumbers`, `beatPlanMs`, `RULES`, `narrativeIssues` (T008–T014).
- `plugins/showcase/toolkit/lib/config.ts`: `configProblems`, `withDefaults`, `loadConfig`.
- `plugins/showcase/toolkit/lib/tours.ts`: `resolveTour` (path or id), `loadTour`, `tourHash`, `storyboardState`, `renderStoryboard`.
- `plugins/showcase/toolkit/commands/{check,storyboard,init}.ts`; `toolkit/cli.ts` registers them.
- `plugins/showcase/skills/showcase/templates/tour.{pitch,walkthrough,spotlight,howto}.json`, `config.json`.
- `plugins/showcase/skills/showcase/reference/{tour-format,narrative,interview}.md`.
- `plugins/showcase/toolkit/test/golden/compass-pitch.json`: the Compass golden.
- `plugins/showcase/toolkit/fixtures/tours/valid-base.json` and `invalid/` (20 negative fixtures, T001–T014, each named for its rule).
- `plugins/showcase/toolkit/test/{tour-format,narrative,tour-cli}.test.ts`: 52 new tests.
- `.planning/showcase-plugin/{TRACKER,PLAN}.md`: row 3 ✅, session log, status line.

## Decisions & Rationale

- **Rule ids:** T001 schema; T002 duplicate ids; T003 `after`; T004 write without `done`; T005 `navigates` (not last, or a sentence waits for it); T006 unknown `@anchor`; T007 caption; T008 narration window; T009 beat count (warning); T010 spoken number under `none`; T011 `firstToCut`; T012 last-card hold; T013 pitch callout (warning); T014 empty beat (warning); T015 stale storyboard. Errors exit 1; warnings print and exit 0.
- **`readingMs` rounds to the millisecond**, as gods-eye's does (PLAN's formula omits the rounding); the 100.8 s golden relies on it.
- **"Spoken number"** = anything with a digit, or a spelt-out quantity with a magnitude or percent; plain counts ("four questions") are words. That keeps Compass's `none` pitch clean, as its own `/\d/` test did.
- **Between presets**, narration is 80–90 % of the target and beats interpolate; every preset sits on those lines.
- **The schema JSON was produced once by a throwaway generator** (to keep 18 action branches consistent) and is now hand-maintained; it uses `additionalProperties: false` per branch, so no `unevaluatedProperties` is needed.
- **`press`** is a long press (`ms`), distinct from `key`.
- **The storyboard hash** ignores key order, whitespace and `$schema`, so reformatting a tour doesn't make it stale.
- **A tour outside `showcase/tours/`** (a template, the golden) has storyboard state `n/a`; `storyboard` needs `--out` for it.
- **`init` never overwrites `config.json`** but keeps `.schema/` copies current.

## Remaining Work

- Session 4 (R1, the engine): build the runtime on these types; `build:runtime` and the C4 dist stamp test.
- `rehearse` will apply `on-screen-only` spoken numbers against the DOM (Session 5).
- `interview.md` is a draft: Session 9 reviews its wording, Session 11 finishes it.
- Open items unchanged: the OpenRouter key in the user file, review notes for Session 9, availability for the by-hand sessions, the go to push.

## Resumption Context

Key files to review when picking this up:
- `plugins/showcase/toolkit/runtime/src/schema.ts`
- `plugins/showcase/toolkit/runtime/src/narrative.ts`
- `plugins/showcase/toolkit/schema/tour.schema.json`
- `plugins/showcase/skills/showcase/reference/tour-format.md`
- `.planning/showcase-plugin/prompts/session-4.md`

Suggested opening prompt for next session:
> "Run /session .planning/showcase-plugin (Session 4, R1: the runtime engine)."
