---
model: opus
effort: medium
rationale: "the schema's shape is specified in PLAN; a golden plus negative fixtures gate it"
---
Paste everything below into a fresh Claude Code session in the `cc-star-skills` repo, started with `claude --add-dir ~/_PRJ/gods-eye`. It has a runtime profile in the frontmatter above. Set it first with `/model opus` and `/effort medium` (autopilot applies it automatically).

---

# showcase plugin roadmap — Session 3 of 13: T1 · Tour format and narrative rules

> Prefer **`/session`**. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Read first
1. `.planning/showcase-plugin/PLAN.md`: §1–§4 (C3–C6), then §2.1 (the tour format and its example), §2.8 (the interview, length presets, spines and rules), §2.10 (the footprint) and §5 Session 3.
2. `.planning/showcase-plugin/TRACKER.md`: confirm Session 2 is ✅, then mark row 3 🟡. Read Session 2's spike verdicts in PLAN §3.
3. The gods-eye reference, **read-only**:
   - `~/_PRJ/gods-eye/src/ui/tour/engine/schema.ts`;
   - `src/ui/tour/tours/{pitch,build,fragments}.ts` and `src/ui/tour/tours/pitch.test.ts` (the length and caption rules);
   - `docs/blueprint/08-demo-script.md` §6;
   - `src/core/narration/manifest.ts` (`readingMs`).

## Objective
A validated tour format, with the narrative rules as code: the contract every later session and every target repo builds on.

## Do
1. **The schema.** `plugins/showcase/toolkit/schema/tour.schema.json` (a JSON Schema 2020-12 subset) is the single source.
   - `toolkit/runtime/src/schema.ts` is a small interpreter for the keywords used (about 250 lines), plus cross-field checks:
     - unique ids;
     - `after` naming an action in the same beat;
     - `write` needing `done`;
     - `navigates` last in its beat;
     - every `@anchor` resolving;
     - caption limits.
   - It also holds the TS types. It's browser-safe (no Node imports) and shared with the CLI.
2. **Config validation:** `toolkit/schema/config.schema.json` and `toolkit/lib/config.ts`, for `showcase/config.json` (PLAN §2.2).
3. **`toolkit/runtime/src/narrative.ts`** (shared, browser-safe):
   - `readingMs = max(1600, words × 60000 / 165 + 350)`;
   - the length presets, kind factors and beat counts from PLAN §2.8;
   - greedy caption wrapping (2 × 42);
   - the `firstToCut` rule (2:00 or more);
   - the last-card hold (2 s or more);
   - spoken-number detection.
4. **`check <tour>`:** static, no network. It covers schema, cross-field rules, budgets (the narration window by preset and kind), captions, the static spoken-number rule, `firstToCut`, card holds, `navigates`, and whether the storyboard is stale. It prints rule ids (`T001`…), with `--json`.
5. **`storyboard <tour>`:**
   - It writes `showcase/storyboard/<tour>.md`, deterministically.
   - Contents: a meta header; a beats table with planned starts, step path, an actions summary, narration, word counts and pacing against the preset; and a hash comment that `check` compares.
6. **`init`**, idempotent. It writes `showcase/config.json` (from the template), `showcase/.schema/` (copies of both schemas), `showcase/tours/`, and the repo-root `.gitignore` lines for `showcase/out/`, `showcase/.cache/` and `showcase/.auth/`.
7. **Templates:**
   - `skills/showcase/templates/tour.{pitch,walkthrough,spotlight,howto}.json`: the spines in PLAN §2.8, with placeholder narration that passes `check`;
   - `skills/showcase/templates/config.json`.
8. **The golden.**
   - Port gods-eye's `src/ui/tour/tours/pitch.ts` (narration, beats and cards; actions may be simplified to valid shapes, with placeholder anchors) to `toolkit/test/golden/compass-pitch.json`.
   - It must measure **100.8 s** of `readingMs` narration and pass every rule, as gods-eye's `pitch.test.ts` requires.
9. **Docs:** `skills/showcase/reference/tour-format.md`, `narrative.md`, and a draft `interview.md` (the rounds in PLAN §2.8).
10. **Tests:**
    - the golden at 100.8 s;
    - every template passes;
    - at least 12 negative fixtures, each failing with its expected rule id;
    - storyboard determinism (same input, same bytes);
    - `init` idempotence.

## Boundaries
- No engine (Session 4).
- `schema.ts` and `narrative.ts` stay browser-safe.
- gods-eye is read-only.

## Verification gate
- The tests above pass, along with `npm test` and `npm run typecheck`.
- `bin/showcase check` on each template is clean.
- `bin/showcase docs tour-format` prints the doc.

## Working rules
- PLAN.md is authoritative. If it and this file disagree, PLAN.md wins; log the discrepancy.
- Small choices, such as the rule-id numbering: decide them and record them in the session-log entry.
- A shape-changing decision that PLAN.md doesn't settle: mark the row ⛔ `Needs decision: <question — options>` and stop.

## Finish
1. **Gate:** run every check above for real. If any fails:
   - set row 3 in `TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit;
   - **stop**.
2. **Record:**
   - Write the session summary to `.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/showcase-plugin` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 3 to ✅;
     - fill in Key artifacts, Verification and Notes;
     - append a session-log entry with `Runtime: opus/medium`.
   - Make one commit: `SKILLZ-01: Add the tour format, narrative rules and the Compass golden (showcase S3)`.
3. **Hand off:** print the kickoff prompt from `.planning/showcase-plugin/prompts/session-4.md` as a copy-pasteable blockquote, without its frontmatter. Note its profile (`/model fable`, `/effort high`), or tell the user to run `/session`.
