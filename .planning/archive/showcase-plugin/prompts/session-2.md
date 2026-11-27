---
model: opus
effort: high
rationale: "four measured spikes decide the runtime's design; the gate only checks that verdicts exist"
---
Paste everything below into a fresh Claude Code session in the `cc-star-skills` repo, started with `claude --add-dir ~/_PRJ/gods-eye`. It has a runtime profile in the frontmatter above. Set it first with `/model opus` and `/effort high` (autopilot applies it automatically).

---

# showcase plugin roadmap — Session 2 of 13: F2 · Spikes and the fixture app

> Prefer **`/session`**. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Read first
1. `.planning/showcase-plugin/PLAN.md`: §1–§4, especially D7, D16, D19 and the **Spike verdicts** table in §3, then §2.1 (overlay, executor, film contract), §2.5 (capture) and §5 Session 2.
2. `.planning/showcase-plugin/TRACKER.md`: confirm Session 1 is ✅, then mark row 2 🟡.
3. The gods-eye reference, **read-only**:
   - `~/_PRJ/gods-eye/src/ui/tour/overlay/host.tsx` (the dialog lessons);
   - `src/ui/tour/engine/dom-events.ts`;
   - `.planning/showcase/PLAN.md` §5 Session 4's "As built" notes and Session 10 (the recorder spec).
4. `plugins/showcase/toolkit/lib/playwright.ts` (from Session 1): use it to load playwright-core.

## Objective
Settle the four riskiest technical questions by measurement, on a purpose-built fixture app, and record the verdicts, so Sessions 4–8 build on facts.

## Do
1. **The fixture app, `plugins/showcase/toolkit/fixtures/app/`:**
   - Zero dependencies, served by `toolkit/fixtures/serve.ts` (`node:http`, its own port).
   - Pages: `index.html`, `list.html` and `detail.html` (three linked pages, for full page loads), and `spa.html` with a History-API route.
   - Elements:
     - a sticky header and a dismissable cookie banner;
     - a Radix-like menu that closes on an outside click;
     - a modal `<dialog>` (`showModal`);
     - a nested scroll container and a same-origin iframe;
     - a form with text, select, checkbox and contenteditable fields;
     - a hover-only menu, a drag with a drop zone, an animated canvas and a spinner;
     - a file input and a `window.open` link.
   - Realistic roles and labels, and **no test ids**, as in Star.
2. **The spike harness, `toolkit/spikes/`**, using playwright-core. It's committed as evidence, not shipped behaviour.
   - **Spike 1, capture:**
     - CDP `Page.startScreencast` over a scripted motion sequence: a smooth scroll, ten pointer trips, the spinner and the canvas.
     - At scale 1, 1.5 and 2 (the viewport is 1920×1080 divided by the scale, at DPR equal to the scale), with JPEG at q80 and q90.
     - Measure the 5th-percentile and median fps, the largest gap, the event-loop p99 (`monitorEventLoopDelay`), MB/s, and the page's own rAF rate.
   - **Spike 2, trusted clicks:**
     - 20 clicks on targets under the sticky header, behind the banner, in the scroller, in the iframe and in the open dialog, with a `pointer-events:none` overlay present.
     - Prove all 20 land.
     - Prove a click on overlay controls never closes the app's menu (propagation stopped at the host).
   - **Spike 3, the top layer:**
     - Test `<showcase-overlay popover="manual">` (a shadow root, attached to `<html>`) against `showModal()`, `popover=auto` and `requestFullscreen()`.
     - For each: is it drawn on top (screenshots plus `elementFromPoint`), and are its controls clickable (inertness)?
     - Compare with Compass's portal into the topmost dialog.
   - **Spike 4, page-load continuity:**
     - A three-page tour by link clicks, while capturing.
     - Count white-flash frames with Playwright's default arguments, and with `PaintHolding` re-enabled (`ignoreDefaultArgs`, removing it from `--disable-features`).
     - Prove the init script re-arms on each load, and a host-held sequence number carries on.
3. **Record the verdicts:**
   - Fill in PLAN.md §3 **Spike verdicts** (S-D1…S-D4) with the numbers, the chosen defaults (default scale, JPEG quality, overlay design, page-load handling) and the fallbacks.
   - If a verdict changes something §2 says, update §2 to match and note it in the session log.
   - Put the measurements table in the session-log entry.

## Boundaries
- No production runtime or host code. The harness is evidence-quality, under `toolkit/spikes/`.
- Don't change Session 1's CLI behaviour.
- gods-eye is read-only.

## Verification gate
- The fixture serves, and every page loads without console errors.
- Every spike has measured numbers and a verdict in PLAN.md §3.
- Spike 2: 20 of 20 clicks land, and the controls never close the app's menu.
- Spike 3: a screenshot and `elementFromPoint` evidence for each top-layer case. Read the screenshots back.
- `npm test` still passes.

## Working rules
- PLAN.md is authoritative. If it and this file disagree, PLAN.md wins; log the discrepancy.
- Small choices: decide them and record them in the session-log entry.
- **If a spike fails outright** (for example, no workable capture rate even at scale 1), mark the row ⛔ `Needs decision: <the finding — the options in PLAN's fallback column>` and stop.

## Finish
1. **Gate:** run every check above for real. If any fails:
   - set row 2 in `TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit;
   - **stop**.
2. **Record:**
   - Write the session summary to `.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/showcase-plugin` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 2 to ✅;
     - fill in Key artifacts, Verification and Notes (the default scale and the overlay design chosen);
     - append a session-log entry with the measurements and `Runtime: opus/high`.
   - Make one commit: `SKILLZ-01: Add the fixture app and four measured spikes (showcase S2)`.
3. **Hand off:** print the kickoff prompt from `.planning/showcase-plugin/prompts/session-3.md` as a copy-pasteable blockquote, without its frontmatter. Note its profile (`/model opus`, `/effort medium`), or tell the user to run `/session`.
