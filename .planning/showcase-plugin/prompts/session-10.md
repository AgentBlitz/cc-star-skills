---
model: opus
effort: medium
rationale: "adapter API design, checked by a real `next build` and a play-through"
---
Paste everything below into a fresh Claude Code session in the `cc-star-skills` repo, started with `claude --add-dir ~/_PRJ/gods-eye`. It has a runtime profile in the frontmatter above. Set it first with `/model opus` and `/effort medium` (autopilot applies it automatically).

---

# showcase plugin roadmap — Session 10 of 13: I1 · The in-app path

> Prefer **`/session`**. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Read first
1. `.planning/showcase-plugin/PLAN.md`: §1–§4 (D3, D7, D16), §2.1 (adapters), §2.6 (the in-app path), §2.10 (the footprint) and §5 Session 10. Also read any "Review notes — look and feel" entry in §3.
2. `.planning/showcase-plugin/TRACKER.md`: confirm Session 9 is ✅, then mark row 10 🟡.
3. This plugin's `toolkit/runtime/src/*`, `toolkit/runtime/dist/*`, `toolkit/host/*` and `toolkit/film/*`.
4. The gods-eye reference, **read-only**:
   - `~/_PRJ/gods-eye/src/ui/tour/{router,registry,provider}.ts(x)`;
   - `src/ui/tour/engine/anchors.ts` with `engine/dom.test.ts` (the two-sided anchor contract);
   - `src/core/ai/request-source.ts` and `src/app/api/demo/tour/` (scripted AI per browser).
5. `node_modules/next/dist/docs/` in the Next fixture, once installed: Next 16 has breaking changes, so check the client-component and router APIs there.

## Objective
The same tour ships inside an app: a vendored runtime, framework adapters, deep links, and a film recorded from the in-app tour.

## Do
1. **The in-app boot,** in `toolkit/runtime/src/index.ts`:
   - it reads `?showcase=<id>&showcaseStep=<step>&showcaseMode=watch|film`;
   - it loads the tour JSON and the voice manifest from the app's static paths;
   - synthetic input only, with sessionStorage run state;
   - the adapter API: `navigate(url)`, `reset()`, `showcase.actions.register`, `beforeStart()`.
2. **`runtime vendor --framework next|react|html [--to <dir>]`:**
   - **What it copies:** `showcase-runtime.mjs` and `.d.ts`, version-stamped.
   - **What it writes:**
     - for Next, a lazy client component `ShowcaseTour.tsx` wired to `next/navigation`, loaded only when `?showcase=` is present;
     - for React, a `ShowcaseTour.tsx` that takes a navigate prop;
     - for HTML, a `<script type="module">` snippet.
   - **Rules:** idempotent, and it compiles cleanly under `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`.
3. **The voice folder:** vendoring sets `voice.dir` to `public/showcase/voice/`, and `voice` writes there.
4. **`film --in-app`** opens `?showcase=<id>&showcaseMode=film` and records through the same contract.
5. **`rehearse --synthetic`** reports which actions synthetic input can't do.
6. **A minimal Next fixture,** `toolkit/fixtures/next/`. Its dependencies are installed on demand into the cache; no `node_modules` are committed.
7. **`skills/showcase/reference/in-app.md`.**

## Boundaries
- No changes to Star (Session 13).
- No new runtime dependency (C2).
- gods-eye is read-only.

## Verification gate
- The HTML adapter plays the fixture tour from a deep link.
- The Next fixture passes `next build` and plays with in-app navigation on a single document load.
- A reload mid-tour resumes without writing twice.
- Vendoring twice gives no diff.
- `film --in-app --strict` is green on the Next fixture.
- `npm test` and `npm run typecheck` pass.

## Working rules
- PLAN.md is authoritative. If it and this file disagree, PLAN.md wins; log the discrepancy.
- Small choices: decide them and record them in the session-log entry.
- A shape-changing decision that PLAN.md doesn't settle: mark the row ⛔ `Needs decision: <question — options>` and stop.

## Finish
1. **Gate:** run every check above for real. If any fails:
   - set row 10 in `TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit;
   - **stop**.
2. **Record:**
   - Write the session summary to `.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/showcase-plugin` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 10 to ✅;
     - fill in Key artifacts, Verification and Notes;
     - append a session-log entry with `Runtime: opus/medium`.
   - Make one commit: `SKILLZ-01: Add the in-app path: vendor, adapters, deep links (showcase S10)`.
3. **Hand off:** print the kickoff prompt from `.planning/showcase-plugin/prompts/session-11.md` as a copy-pasteable blockquote, without its frontmatter. Note its profile (`/model opus`, `/effort high`), or tell the user to run `/session`.
