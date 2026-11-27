---
model: opus
effort: high
rationale: "first recorder session: backpressured capture and frame-to-timeline sync, gated by ffprobe"
---
Paste everything below into a fresh Claude Code session in the `cc-star-skills` repo, started with `claude --add-dir ~/_PRJ/gods-eye`. It has a runtime profile in the frontmatter above. Set it first with `/model opus` and `/effort high` (autopilot applies it automatically).

---

# showcase plugin roadmap — Session 7 of 13: F3 · Film I: capture and video

> Prefer **`/session`**. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Read first
1. `.planning/showcase-plugin/PLAN.md`: §1–§4 (D16, D19, C7), the **Spike verdicts** (S-D1 sets the default scale and JPEG quality, S-D4 the page-load handling), §2.1 (the film contract), §2.5 (the recorder) and §5 Session 7.
2. `.planning/showcase-plugin/TRACKER.md`: confirm Session 6 is ✅, then mark row 7 🟡.
3. This plugin's `toolkit/host/*`, `toolkit/runtime/src/{director,timeline,film-events,bridge}.ts` and `toolkit/spikes/` (Spike 1's capture code and numbers).
4. The gods-eye reference, **read-only**:
   - `~/_PRJ/gods-eye/.planning/showcase/PLAN.md` §5 Sessions 10–11 (the recorder spec);
   - `e2e/film-contract.spec.ts`;
   - `src/ui/tour/engine/index.ts` (arming);
   - `src/core/narration/film-events.ts`.

## Objective
The recorder captures a tour from the real app and produces a constant-frame-rate H.264 video aligned to the tour's timeline.

## Do
1. **`film <tour> --video-only [--detach]`, the take:**
   - production-build guidance;
   - its own port, then snapshot, reset and health;
   - headless at S-D1's default scale;
   - a fixed clock, `reducedMotion: 'no-preference'` and `--force-color-profile=srgb`;
   - the SwiftShader check when `browser.gpu` is `required`, reading the WebGL renderer string.
2. **Film mode in the runtime:**
   - arming: `document.fonts.ready`, then 400 ms with no new screencast frames;
   - `film:armed`, then `__showcaseGo()`;
   - events over the binding, with the host keeping the log across reloads;
   - `nav` events emitted by the host on `framenavigated`.
3. **Capture:**
   - CDP `Page.startScreencast`: JPEG at S-D1's quality, every frame, acknowledged at once;
   - a bounded write queue whose delayed acknowledgements make Chrome drop frames instead of Node's memory growing;
   - a worker fallback on a raw CDP WebSocket if event-loop p99 exceeds 20 ms;
   - a clock-sync probe (a flash at a known timeline time), a 750 ms pre-roll, a watchdog, a 1.2 s tail;
   - the page's own frame rate, logged.
4. **Encode:**
   - the 30 fps constant-frame-rate schedule;
   - an explicit conversion from BT.601 full range to BT.709 limited, with the output tagged;
   - x264 at CRF 17, preset slow, High profile, yuv420p, with keyframes at beat starts.
5. **Outputs:** `showcase/out/<tour>/timeline.json`, and `progress.json` for `--detach`.

## Boundaries
- No audio or captions (Session 8).
- Camera events are recorded but not rendered (D19).
- gods-eye is read-only.

## Verification gate
- On the fixture tour, ffprobe shows 1920×1080, constant 30 fps, H.264 High, yuv420p, tagged BT.709.
- The largest motion gap is ≤ 100 ms.
- The sync probe is within 0–100 ms.
- The duration equals the timeline to within one frame.
- No app, Chromium or ffmpeg process is left behind.
- `npm test` and `npm run typecheck` pass.

## Working rules
- PLAN.md is authoritative. If it and this file disagree, PLAN.md wins; log the discrepancy.
- Small choices: decide them and record them in the session-log entry.
- **If capture can't hold the gate at any scale:** mark the row ⛔ `Needs decision: capture misses frames — worker capture / lower scale / beginFrame virtual time (headless shell)` and stop.

## Finish
1. **Gate:** run every check above for real. If any fails:
   - set row 7 in `TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit;
   - **stop**.
2. **Record:**
   - Write the session summary to `.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/showcase-plugin` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 7 to ✅;
     - fill in Key artifacts, Verification and Notes (measured fps, largest gap, sync offset);
     - append a session-log entry with `Runtime: opus/high`.
   - Make one commit: `SKILLZ-01: Add the film recorder: capture and video (showcase S7)`.
3. **Hand off:** print the kickoff prompt from `.planning/showcase-plugin/prompts/session-8.md` as a copy-pasteable blockquote, without its frontmatter. Note its profile (`/model opus`, `/effort medium`), or tell the user to run `/session`.
