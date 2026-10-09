---
model: opus
effort: high
rationale: "top-layer, trusted-input and process-lifecycle quirks; part of the gate is reading screens back"
---
Paste everything below into a fresh Claude Code session in the `cc-star-skills` repo, started with `claude --add-dir ~/_PRJ/gods-eye`. It has a runtime profile in the frontmatter above. Set it first with `/model opus` and `/effort high` (autopilot applies it automatically).

---

# showcase plugin roadmap — Session 5 of 13: R2 · Runtime II: overlay, host, Watch, rehearse and inspect

> Prefer **`/session`**. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Read first
1. `.planning/showcase-plugin/PLAN.md`: §1–§4, the **Spike verdicts** (S-D2, S-D3, S-D4), §2.1 (overlay, audio), §2.2 (the toolkit and the host's duties), §2.3 (the child-environment policy) and §5 Session 5.
2. `.planning/showcase-plugin/TRACKER.md`: confirm Session 4 is ✅, then mark row 5 🟡.
3. Session 4's code: `toolkit/runtime/src/*`, `toolkit/host/` (the skeleton) and its tests.
4. The gods-eye reference, **read-only**:
   - `~/_PRJ/gods-eye/src/ui/tour/overlay/*` (especially `host.tsx`, `pointer.tsx`, `spotlight.tsx`, `captions.tsx`, `cards.tsx`, `place.ts`);
   - `src/ui/tour/{provider,runtime}.tsx`, `engine/html-audio.ts`, `audio-element.ts`;
   - `.planning/showcase/PLAN.md` §5 Sessions 4–5 "As built" (the dialog portal, `hold`, router re-push, page pausers).

## Objective
The tour becomes visible and playable: the overlay, the full host, the live demo, the rehearsal loop and anchor discovery.

## Do
1. **The overlay** (`toolkit/runtime/src/overlay/`), per S-D3:
   - **The host:** the hybrid S-D3 chose. `<showcase-overlay popover="manual">` on `<html>` with a shadow root draws everything and re-shows itself on top-layer changes. In Watch, only the controls (their own `<showcase-controls>` shadow host) move: into the fullscreen element, else the topmost modal dialog, else the app's topmost open auto popover, else back into the overlay. `toolkit/spikes/overlay-proto.js` is the measured prototype.
   - **The pieces:**
     - a pointer with a click ripple (WAAPI, awaited through `finished`);
     - a spotlight that follows its element, holds for its sentence and clears when the pointer moves on;
     - an optional callout;
     - Watch captions (2 × 42);
     - title and closing cards;
     - controls (play/pause, back, next, mute, exit);
     - an end card.
   - **The hygiene:**
     - `:host{all:initial}`;
     - adopted stylesheets only;
     - fonts declared at document level;
     - re-attached when the app re-renders it away;
     - it never takes focus;
     - events from the controls are consumed by a window capture listener the bootstrap registers before any app code (S-D2), and the controls `preventDefault` on `mousedown`;
     - reduced motion honoured.
2. **Audio in the runtime:** manifest lookup by tour, beat and exact text; `HTMLAudio` from Blob URLs delivered through the bridge; muting never changes timing.
3. **The full host** (`toolkit/host/`):
   - **App lifecycle:** `app.build`, `start`, `url`, `health` and `env` (the child-environment policy); port allocation; a per-repo lock; process-group kill on exit; the `snapshot` and `reset` hooks.
   - **Launch:** playwright-core, new headless or headed; scale (with `--force-device-scale-factor`, S-D1); locale, timezone and colour scheme.
   - **The clock:** `setFixedTime`, registered **after** the runtime's init script.
   - **Browser options:**
     - `bypassCSP` and `serviceWorkers: 'block'`;
     - `block` through `Network.setBlockedURLs`, and `hide` through an injected style;
     - file-chooser fixtures, `beforeunload` accepted, popups kept in the same tab, clipboard permissions;
     - page-load handling per S-D4.
   - **The binding:** trusted input through `page.mouse` and `page.keyboard`, state, asset delivery and events, with "context destroyed" errors tolerated.
   - **No `context.route` anywhere** (D16).
4. **Commands** (PLAN §2.2):
   - `watch <tour> [--speed] [--muted] [--from <step>] [--detach]`: headed, `viewport: null`, maximised, with `--autoplay-policy=no-user-gesture-required`. Space, ←, →, M and Esc work, and a viewer's click pauses.
   - `rehearse <tour> [--speed] [--synthetic]`: headless, with no capture.
     - It resolves every anchor, checks spoken numbers against each beat's DOM text, scans visible text for the deny-list, and saves a still per beat.
     - On failure it saves a screenshot, a DOM excerpt and candidate anchors.
   - `inspect <url>`: a role-and-name outline with suggested anchors.
   - `auth`: a headed sign-in written to `showcase/.auth/state.json`, mode 600.
   - `storyboard <tour> --stills --html`.
5. **Config:** `browser.*` and `privacy.deny` are supported in `showcase/config.json`.
6. **Tests** on the fixture:
   - the overlay over a modal (`elementFromPoint`), with the controls clickable in Watch;
   - a planted deny-list string fails and names its beat;
   - `rehearse` is clean three times at ×10;
   - `inspect` suggests role-and-name anchors;
   - a headed `watch --detach` smoke test exits cleanly;
   - no app or Chromium process is left behind.

## Boundaries
- No synthesis (Session 6). Use a small fixture manifest for audio.
- No capture (Session 7).
- gods-eye is read-only.

## Verification gate
- Every test above passes.
- **Read back** the stills from one `rehearse` of the fixture tour, checking the pointer, spotlight, captions and cards.
- `npm test` and `npm run typecheck` pass.

## Working rules
- PLAN.md is authoritative. If it and this file disagree, PLAN.md wins; log the discrepancy.
- Small choices: decide them and record them in the session-log entry.
- A shape-changing decision that PLAN.md doesn't settle: mark the row ⛔ `Needs decision: <question — options>` and stop.

## Finish
1. **Gate:** run every check above for real. If any fails:
   - set row 5 in `TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit;
   - **stop**.
2. **Record:**
   - Write the session summary to `.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/showcase-plugin` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 5 to ✅;
     - fill in Key artifacts, Verification and Notes;
     - append a session-log entry with `Runtime: opus/high`.
   - Make one commit: `SKILLZ-01: Add the overlay, host, watch, rehearse and inspect (showcase S5)`.
3. **Hand off:** print the kickoff prompt from `.planning/showcase-plugin/prompts/session-6.md` as a copy-pasteable blockquote, without its frontmatter. Note its profile (`/model sonnet`, `/effort high`), or tell the user to run `/session`. Remind the user that Session 6's audition gate needs `OPENROUTER_API_KEY` in the user key file (`showcase keys status`).
