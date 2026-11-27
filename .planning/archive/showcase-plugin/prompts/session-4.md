---
model: fable
effort: high
rationale: "clocks, two-track timing and resume-without-rewrite invariants are subtle and system-wide"
---
Paste everything below into a fresh Claude Code session in the `cc-star-skills` repo, started with `claude --add-dir ~/_PRJ/gods-eye`. It has a runtime profile in the frontmatter above. Set it first with `/model fable` and `/effort high` (autopilot applies it automatically).

---

# showcase plugin roadmap — Session 4 of 13: R1 · Runtime I: the engine

> Prefer **`/session`**. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Read first
1. `.planning/showcase-plugin/PLAN.md`: §1–§4 (D7, D16, C3–C6), the **Spike verdicts** in §3, all of §2.1 (format, director, executor, film contract), and §5 Session 4.
2. `.planning/showcase-plugin/TRACKER.md`: confirm Session 3 is ✅, then mark row 4 🟡.
3. Sessions 2–3's code:
   - `toolkit/fixtures/app/`;
   - `toolkit/spikes/`, for the injection and binding patterns that worked;
   - `toolkit/runtime/src/{schema,narrative}.ts`.
4. The gods-eye reference, **read-only**:
   - `~/_PRJ/gods-eye/src/ui/tour/engine/{director,executor,dom-events,ready,clock,narration,persistence,timeline,anchors}.ts` and their tests;
   - `src/core/narration/film-events.ts` (`filmOrderProblems`);
   - `.planning/showcase/PLAN.md` §5 Session 3's "As built" notes (fast-forward and re-show; why speed lives in the clock).

## Objective
The in-page engine — director, executor, anchors, readiness, clocks, run state and film events — bundled, and proven headless on the fixture app.

## Do
1. **`plugins/showcase/toolkit/runtime/src/`:**
   - **`capture.ts`:** top frame only. It captures the real `Date.now`, `performance.now`, timers, rAF and input value setters before app code.
   - **`clock.ts`:** pace, wall and ticker, on the captured timers.
   - **`anchors.ts`:** role and name (a subset of accessible-name computation), label, test id, text and CSS; visible first; open shadow roots; same-origin frames; `@name`.
   - **`ready.ts`:** the predicates, on a MutationObserver plus a 100 ms poll on the wall clock. Anchors time out at 10 s and readiness at 30 s.
   - **`dom-events.ts`:** a port of gods-eye's, plus `beforeinput` typing for contenteditable and `DataTransfer` uploads.
   - **`executor.ts`:**
     - every action kind in PLAN §2.1, following Compass's rules;
     - Playwright-style clickability checks, and the acting window;
     - trusted input through the bridge, with synthetic fallback logged;
     - `done` predicates, and the journal.
   - **`director.ts`:** Watch and film only. Two tracks, `after` gates, dwell, Next and Back re-show, and fast-forward for deep links.
   - **`state.ts`:** run state, host-backed through the bridge or sessionStorage.
   - **`film-events.ts` and `timeline.ts`:** the PLAN §2.1 contract (`v, seq, doc, t, wall`), with `filmOrderProblems` ported.
   - **`bridge.ts`:** the host binding, `__showcaseHost(msg)` for input, state, assets and events, plus `__showcaseGo()`.
   - **`index.ts`:** the external boot, reading the config the host injects. The in-app boot is Session 10.
2. **Port, don't copy:**
   - erasable syntax only (C3): no constructor parameter properties, enums or namespaces;
   - drop Present mode, the notes window and Compass's server bits.
3. **`npm run build:runtime`** (esbuild) writes `toolkit/runtime/dist/showcase-runtime.iife.js`, `showcase-runtime.mjs` and `showcase-runtime.d.ts`, plus `dist/STAMP`, a hash of `src/`. A test fails if the stamp is stale.
4. **A `toolkit/host/` skeleton,** enough for tests: launch Chromium through playwright-core, `addInitScript` the IIFE (top frame), and expose the binding. The full host is Session 5.
5. **Tests,** in real Chromium on the fixture:
   - every action kind works with trusted input;
   - covered targets are handled;
   - a full page load mid-tour resumes, with host-held state, without repeating writes or sentences;
   - a missing anchor raises `film:error` naming the beat;
   - Back re-shows without writing;
   - fast-forward applies writes silently;
   - the director runs on a fake clock (a unit test);
   - the bundle is fresh;
   - the runtime imports nothing from Node or any framework (an import-graph test).

## Boundaries
- No overlay visuals beyond a pointer stub (Session 5).
- No audio (Sessions 5–6).
- No capture (Session 7).
- gods-eye is read-only.

## Verification gate
- Every test above passes headless.
- `npm test` and `npm run typecheck` pass.
- The bundle stamp is fresh.

## Working rules
- PLAN.md is authoritative. If it and this file disagree, PLAN.md wins; log the discrepancy.
- Small choices: decide them and record them in the session-log entry.
- A shape-changing decision that PLAN.md doesn't settle: mark the row ⛔ `Needs decision: <question — options>` and stop.

## Finish
1. **Gate:** run every check above for real. If any fails:
   - set row 4 in `TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit;
   - **stop**.
2. **Record:**
   - Write the session summary to `.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/showcase-plugin` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 4 to ✅;
     - fill in Key artifacts, Verification and Notes;
     - append a session-log entry with `Runtime: fable/high`.
   - Make one commit: `SKILLZ-01: Add the tour runtime engine and its bundle (showcase S4)`.
3. **Hand off:** print the kickoff prompt from `.planning/showcase-plugin/prompts/session-5.md` as a copy-pasteable blockquote, without its frontmatter. Note its profile (`/model opus`, `/effort high`), or tell the user to run `/session`.
