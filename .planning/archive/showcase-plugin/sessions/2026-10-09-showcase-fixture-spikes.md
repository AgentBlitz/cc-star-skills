# Session: showcase S2 — the fixture app and four measured spikes

**Date:** 2026-10-09
**Branch:** main
**Roadmap:** `.planning/showcase-plugin`
**Runtime:** `opus/high (autopilot attempt 1)`

## Summary

Ran Session 2 (F2) of the showcase plugin roadmap, headless under autopilot. It built a zero-dependency fixture app ("Ledgerly": five pages with a sticky header, cookie banner, Radix-like menu, modal dialog, `popover=auto`, full screen, nested scroller, same-origin iframe, form, hover menu, drag and drop, canvas, spinner, file input, `window.open`, and a History-API route; no test ids). It then ran four spikes on it with playwright-core 1.63 and new-headless Chromium 1243 on the M4 Max.

The verdicts are recorded in PLAN §3, and §2 was updated where they changed the design:
- **S-D1 capture:** CDP screencast holds 60 fps (p5) at scale 1, 1.5 and 2. This needs the DPR to be real (`--force-device-scale-factor`); otherwise frames arrive at CSS size. Default scale 1.5, JPEG q90, with a 300 ms settle after scrolls.
- **S-D2 clicks:** 20/20 trusted clicks land under every kind of cover. Control events are best consumed by a window capture listener.
- **S-D3 top layer:** a hybrid overlay. A re-shown manual popover draws everything; only the controls move into the fullscreen element, modal dialog or the app's auto popover, because the popover is inert or light-dismisses there.
- **S-D4 page loads:** no white flash with Playwright's defaults; a load is a held frame. The init script re-arms per load, and the host-held `seq` carries on.

The gate passed in full.

## Changes

- `plugins/showcase/toolkit/fixtures/serve.ts` — new: the fixture server (`node:http`, port 0 or `--port`, `/spa/*` → `spa.html`, `--latency` for documents and CSS, path-traversal guard, `PAGES` list).
- `plugins/showcase/toolkit/fixtures/app/{index,list,detail,spa,frame}.html`, `app.css`, `app.js` — new: the fixture app. It's dark, so white flashes are measurable. `app.js` records every activation, with `isTrusted`, in `window.fixtureEvents`.
- `plugins/showcase/toolkit/spikes/lib.ts` — new: loads playwright-core via `lib/playwright.ts`. It also provides `launch()` (new headless, optional PaintHolding re-enable via the exact `--disable-features` read from `chrome://version`), overlay injection, results/out dirs, JPEG size, and ffmpeg luma and pixel helpers.
- `plugins/showcase/toolkit/spikes/overlay-proto.js` — new: the prototype overlay. Modes: popover, portal, hybrid; event stopping: host, window or none; raise on top-layer changes.
- `plugins/showcase/toolkit/spikes/check-fixture.ts`, `spike1-capture.ts`, `spike2-clicks.ts`, `spike3-toplayer.ts`, `spike4-pageload.ts`, `run-all.ts`, `README.md`, `tsconfig.json` — new: the harness, with a DOM-lib tsconfig.
- `plugins/showcase/toolkit/spikes/results/*.json` — new: the measured numbers (64 kB in all).
- `plugins/showcase/toolkit/test/fixtures.test.ts` — new: 7 tests (pages, SPA fallback, assets, traversal, latency, no test ids, overlay option templating).
- `plugins/showcase/package.json` — `typecheck` also checks `toolkit/spikes`; new `spikes` script.
- `plugins/showcase/tsconfig.json` — excludes `toolkit/spikes` (it has its own config).
- `.planning/showcase-plugin/PLAN.md` — status line, §3 Spike verdicts filled, and updates to §2.1 (overlay), §2.2 (scale default, page loads), §2.5 (forced DSF, q90, scroll settle, the `nav` gap exemption), C3 and §5 Sessions 5 and 8.
- `.planning/showcase-plugin/prompts/session-5.md`, `session-8.md` — synced with the hybrid overlay, window-capture events, the forced DSF and the `nav` exemption.
- `.planning/showcase-plugin/TRACKER.md` — row 2 ✅, a session-log entry with the measurements table.

## Decisions & Rationale

- **Default `browser.scale` 1.5 and JPEG q90.** Every scale holds 60 fps once the DPR is forced, and q90 costs about 6 MB/s. Scale 1.5 keeps a 1280×720 desktop layout; at scale 2 (960×540) many apps switch to tablet breakpoints.
- **`--force-device-scale-factor=<scale>` plus `deviceScaleFactor`.** With emulation alone, the screencast frames are CSS-size, and upscaling them is visibly soft (compared by eye).
- **The hybrid overlay, not the pure popover or Compass's portal.** Spike 3:
  - the re-shown popover is the only design drawn on top in every case, but its controls are inert under modals and full screen, and light-dismiss auto popovers;
  - the portal isn't drawn over auto popovers or full screen;
  - moving only the controls fixes all of these (4/4 on every measure).
- **Window capture listener for control events.** Stopping at the host leaves capture-phase listeners seeing every click (5/5); window capture hides them (0/5), and the bootstrap's listener runs before any app code.
- **Keep Playwright's defaults for page loads.** No white frames, with or without PaintHolding, at 120 or 400 ms latency. Verify must exempt the held frame at a `nav` load instead.
- **A 300 ms settle after scrolls.** Back-to-back long scrolls produce one ~267 ms screencast stall (the page itself doesn't stall). Neither GPU flags, headless shell, rAF-driven scrolling nor removing the iframe or canvas changed it, and a settle removes it.

## Remaining Work

- Session 3 (T1, the tour format and narrative rules) is next.
- For Session 5: the host must hold the pointer position across page loads, and should build the overlay from `overlay-proto.js`'s measured design.
- For Session 7: launch with `--force-device-scale-factor`, and keep `maxWidth`/`maxHeight` at 1920×1080.
- Open items are unchanged: `OPENROUTER_API_KEY` in the user file, the Session 9 review notes, availability for the by-hand sessions, and the go to push.
- The plan dir's `autopilot/` run logs remain uncommitted (deliberately).

## Resumption Context

Key files to review when picking this up:
- `.planning/showcase-plugin/PLAN.md` §3 (Spike verdicts) and §2.1/§2.5
- `plugins/showcase/toolkit/spikes/README.md` and `overlay-proto.js`
- `plugins/showcase/toolkit/fixtures/app/index.html`

Suggested opening prompt for next session:
> "Run `/session .planning/showcase-plugin` — Session 3, the tour format and narrative rules."
