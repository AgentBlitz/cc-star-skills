# Session: showcase S5 — overlay, host, Watch, rehearse and inspect

**Date:** 2026-10-09
**Branch:** main
**Roadmap:** `.planning/showcase-plugin`
**Runtime:** `opus/high (autopilot attempt 1)`

## Summary

Ran Session 5 of the showcase plugin roadmap: the tour became visible and playable. The runtime gained the S-D3 hybrid overlay (a popover that draws the pointer, spotlight, callout, captions, cards and end card on top of everything, plus Watch controls that move into the fullscreen element, modal dialog or auto popover), the top-layer patches and control guard installed before any app code, viewer keys, voice playback through the host binding, and in-page anchor discovery. The host became complete: the app lifecycle (build, snapshot, start on its own port, health, reset, per-repo lock, process-group stop) and every browser option in `config.browser`. Four commands landed: `rehearse` (headless ×10, a still per beat, spoken-number and deny-list checks, a failure kit), `watch` (headed, maximised, with `--detach`), `inspect` and `auth`, plus `storyboard --stills --html`. A committed fixture project drives them. Reading the stills back caught two problems, both fixed: a navigating beat's still showed the next page, and a card was drawn under the last spotlight. Building the fixture tour also exposed a Session 4 director bug, now fixed: the first navigating action after a step's own page load was skipped. The gate passed: 157/157 tests, typecheck over four projects, rehearse clean 3× at ×10, a headed `watch --detach` that exits cleanly, nothing left running.

## Changes

- `plugins/showcase/toolkit/runtime/src/overlay/index.ts` — new: `createOverlay` (the hybrid overlay, every piece, `view()` for controls/end card, `clearCaption`, `raise`), built with `createElement` only.
- `plugins/showcase/toolkit/runtime/src/overlay/top-layer.ts` — new: `installTopLayer` (showModal/showPopover/togglePopover/requestFullscreen patches, toggle/close/fullscreenchange watches, the window-capture control guard), `topmostModal`, `topmostAutoPopover`.
- `plugins/showcase/toolkit/runtime/src/overlay/place.ts` — new: `placeCallout`, ported from Compass.
- `plugins/showcase/toolkit/runtime/src/overlay/styles.ts` — new: overlay, controls and document-level font CSS.
- `plugins/showcase/toolkit/runtime/src/overlay-stub.ts` — deleted (replaced by the overlay).
- `plugins/showcase/toolkit/runtime/src/audio.ts` — new: `createBridgeAudio` (manifest clips via the binding, Blob URLs, 300 ms grace, mute without timing change, sessionStorage).
- `plugins/showcase/toolkit/runtime/src/inspect.ts` — new: `outline`, `suggestAnchor`, `visibleText`.
- `plugins/showcase/toolkit/runtime/src/protocol.ts` — new: DOM-free host/page types (HostMessage, InputRequest, Checkpoint, Snapshot, Command, VoiceManifest, OutlineItem…).
- `plugins/showcase/toolkit/runtime/src/bridge.ts` — `asset` kind, `checkpoint` and `exit` messages; types re-exported from `protocol.ts`.
- `plugins/showcase/toolkit/runtime/src/director.ts` — `checkpoint` dep (before a navigating action, else after ready), `muted` in the snapshot, the resume fix (`navDispatched`).
- `plugins/showcase/toolkit/runtime/src/executor.ts` — spotlights pass their element so the overlay follows it.
- `plugins/showcase/toolkit/runtime/src/overlay-port.ts`, `narration.ts` — port doc, `element` on spotlight; manifest types moved to `protocol.ts`.
- `plugins/showcase/toolkit/runtime/src/index.ts` — boot installs the top layer and keys; creates the overlay and audio per UI; rehearse checkpoints; `__showcase.{overlay,audio,inspect,visibleText}`.
- `plugins/showcase/toolkit/runtime/dist/*` — rebuilt bundle, types and STAMP.
- `plugins/showcase/toolkit/host/launch.ts` — the full host (browser settings, init-script order, fixed clock, block/hide, choosers, dialogs, popups, clipboard, gpu check, checkpoint/exit, voice assets, tourless pages, marker).
- `plugins/showcase/toolkit/host/{app,project,rehearse,watch,inspect,auth}.ts` — new: lifecycle and lock; project/config/session plumbing; the four host flows.
- `plugins/showcase/toolkit/lib/screen-checks.ts` — new: `quantity`, `missingNumbers`, `denyHits`.
- `plugins/showcase/toolkit/lib/tours.ts` — `renderStoryboardHtml`.
- `plugins/showcase/toolkit/commands/{rehearse,watch,inspect,auth}.ts` — new commands; `storyboard.ts` gains `--stills`, `--html`, `--out-dir`; `cli.ts` registers them.
- `plugins/showcase/toolkit/fixtures/showcase/` — new fixture project: `config.json`, `tours/fixture-tour.json`, `storyboard/fixture-tour.md`, `voice/manifest.json`, `voice/open-0.mp3` (2.8 kB).
- `plugins/showcase/toolkit/test/runtime/overlay.test.ts` — new (5 Chromium tests).
- `plugins/showcase/toolkit/test/runtime/director.test.ts` — 4 new tests (mute timing, mute command, checkpoints, resume fix).
- `plugins/showcase/toolkit/test/host.test.ts` — new (8 tests: lifecycle, failures, lock, numbers, deny, secret file, candidates, storyboard page).
- `plugins/showcase/toolkit/test/rehearse.test.ts` — new (6 CLI tests incl. the headed watch smoke).
- `.planning/showcase-plugin/PLAN.md` — status, §2.2 flags and app-command rules, C3 note on `protocol.ts`, Session 5 "As built".
- `.planning/showcase-plugin/TRACKER.md` — row 5 ✅ and the session-log entry.

## Decisions & Rationale

- Host↔page types moved to a DOM-free `protocol.ts`, so the CLI (root tsconfig, no DOM lib) can import the host. Widening the root lib to DOM would have broken C3.
- The rehearse still comes from a director `checkpoint`, not from host polling. The page waits for the host, so the screenshot, text scan and number check see one settled screen. Captions linger in rehearse so the still shows the beat's last sentence.
- A navigating beat is checked before it leaves, so its still is of its own screen.
- A card hides the spotlight and pointer, because a card is a screen of its own.
- Host commands skip `app.build` unless `--build` is given, because rebuilding a real app for every rehearsal is slow. `film` (Session 7) will build.
- The storyboard markdown never depends on stills, so it stays deterministic and committable. The stills live in the HTML page under `out/`.
- Spoken numbers are matched by value rather than by string, so "four per cent" matches "4%". Times and codes are matched as text.
- `auth` saves the state when the window closes or Enter is pressed (only on a TTY), so that piped stdin never saves an empty sign-in.

## Remaining Work

- Session 6 (voice): owns the manifest format; `host/project.ts › voiceFor` may need to follow it. The fixture manifest is hand-made.
- `auth` has only been exercised through its secret writer. A real headed sign-in is for a person (Session 12 on Star, if needed).
- The deny-list and number checks run once per beat (at the checkpoint), not mid-beat.
- `OPENROUTER_API_KEY` in the user file is still open (needed by Session 6's audition gate).

## Resumption Context

Key files to review when picking this up:
- `plugins/showcase/toolkit/runtime/src/overlay/index.ts`, `overlay/top-layer.ts`
- `plugins/showcase/toolkit/runtime/src/director.ts` (checkpoint, `navDispatched`)
- `plugins/showcase/toolkit/host/launch.ts`, `host/app.ts`, `host/rehearse.ts`, `host/project.ts`
- `plugins/showcase/toolkit/fixtures/showcase/`
- `.planning/showcase-plugin/PLAN.md` §5 Session 5 "As built"

Suggested opening prompt for next session:
> "Run /session .planning/showcase-plugin — Session 6 (voice). The fixture tour is toolkit/fixtures/showcase/tours/fixture-tour.json; Watch reads <voice.dir>/manifest.json via host/project.ts voiceFor."
