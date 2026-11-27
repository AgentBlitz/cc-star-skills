# Session: showcase S7 — Film I: capture and video

**Date:** 2026-10-09
**Branch:** main
**Roadmap:** `.planning/showcase-plugin`
**Runtime:** `opus/high (autopilot attempt 1)`

## Summary

Built the showcase plugin's recorder, up to a silent video. `showcase film <tour> --video-only` brings the app up on its own port (build, snapshot, reset, health) and plays the tour headless in film mode at scale 1.5 with a real DPR, an sRGB colour profile and a fixed clock. It captures every screencast frame through a bounded queue with delayed acks and can fall back to a worker on a raw CDP WebSocket. It runs a clock-sync probe, a 750 ms pre-roll, a watchdog and a 1.2 s tail, then schedules the frames at a constant 30 fps and encodes H.264 High with an explicit BT.601 full → BT.709 limited conversion, tagged, with keyframes at beat starts. It writes `video.mp4`, `timeline.json` and `progress.json` (`--detach`). Gate on the fixture tour: 1920×1080, CFR 30/1, H.264 High, yuv420p, BT.709 on all four tags; largest motion gap 22.3 ms; sync probe 19.7 ms; duration within one frame of the timeline; no process left; `npm test` 205/205; typecheck clean.

## Changes

- `plugins/showcase/toolkit/film/record.ts` — new: the take (lifecycle, arming, probe, pre-roll, watchdog, tail), measuring (gaps, frame rates, probe offset), the CFR encode, the checks, `timeline.json`, `progress.json`, `error.png` / `timeline.partial.json` on failure, `buildNotes` (production-build guidance), `filmLines`.
- `plugins/showcase/toolkit/film/capture.ts` — new: main-thread `Page.startScreencast` (JPEG q90, 1920×1080 max, every frame), quiet detection, a one-second-window event-loop monitor and the hand-off to the worker.
- `plugins/showcase/toolkit/film/capture-worker.ts` — new: the worker-thread capture on the page target's DevTools WebSocket.
- `plugins/showcase/toolkit/film/frames.ts` — new: the frame sink (bounded queue of 120, delayed acks when full) and `jpegSize`.
- `plugins/showcase/toolkit/film/cfr.ts` — new, pure: `cfrCount`, `cfrSchedule`, `frameGaps` (nav exemption), `fpsWindows`, `percentile`.
- `plugins/showcase/toolkit/film/timeline.ts` — new, pure: `spans()`, which turns events into beats, sentences and navs on the video's clock.
- `plugins/showcase/toolkit/film/encode.ts` — new: `encodeVideo` (hard-linked CFR sequence → x264 CRF 17, slow, High, yuv420p, BT.709 via `scale` + `setparams`, forced keyframes, faststart), `probeVideo`, `patchColours`, `runTool` and `killTools` (tracked children).
- `plugins/showcase/toolkit/commands/film.ts` — new: the `film` command, with `--detach` modelled on `watch`.
- `plugins/showcase/toolkit/cli.ts` — registers `film`.
- `plugins/showcase/toolkit/host/launch.ts` — an `args` option for extra Chromium switches; `rendererOf` and `isSoftwareRenderer` exported.
- `plugins/showcase/toolkit/runtime/src/film-aids.ts` — new: the probe flash, the heartbeat, the page's frame rate and stalls.
- `plugins/showcase/toolkit/runtime/src/index.ts` — `__showcase.film`; the heartbeat restarts at boot when `window.__showcaseRolling` is set in film mode.
- `plugins/showcase/toolkit/runtime/dist/*` — rebuilt and restamped (`film-aids.d.ts` added).
- `plugins/showcase/toolkit/test/film/cfr.test.ts`, `test/film/encode.test.ts`, `test/film.test.ts` — new (13 tests).
- `.planning/showcase-plugin/PLAN.md` — status line (7 of 13); Session 7 "As built".
- `.planning/showcase-plugin/TRACKER.md` — row 7 ✅, and the Session 7 log entry.

## Decisions & Rationale

- **A heartbeat pixel from the pre-roll** → the screencast only sends a frame when something changes, so "largest motion gap" is meaningless on a still screen. Flipping a 1 px element's opacity between 0 and 0.01 every frame makes every gap a real miss, gives the page's frame rate, and is invisible. Inferring motion windows from action events was rejected, because pauses inside actions would read as gaps.
- **The probe before the pre-roll** → the full-screen magenta flash never reaches the video; the offset it measures is between clocks, which doesn't change over a take.
- **Time 0 = the pre-roll's start; a frame count of `round(duration × 30)`** → the duration matches the timeline by construction; ffprobe confirms it.
- **`setparams` in the filter** → the `-color_*` output options alone left transfer and primaries untagged.
- **A DevTools port on every auto or worker take** → the worker fallback needs a raw WebSocket. Playwright's pipe isn't reachable from a worker, and the port is loopback-only for the take's life.
- **`video.mp4` as the picture's name** → Session 8 muxes it with the mixdown into `<id>.mp4`.
- **The e2e tests film a scratch copy of the fixture project** → `node --test` runs files in parallel, and the rehearse tests hold the fixture project's lock.

## Remaining Work

- Session 8 (F4 · Film II): the Node mixdown, loudnorm, AAC, chapters, ASS captions burned in, SRT, `script.md`, stills, contact sheet, `report.json` and `report.md`, `--strict`, `-draft.mp4`, and `reference/film.md`. It builds on `timeline.json` (`sentences[].startMs` and `audio`, `beats[]`, `navs[]`, `capture`, `checks`).
- Watch for two one-offs that didn't reproduce: one 193 ms gap in the session's first take, and one worker-test failure in the first full `npm test` run (its message wasn't kept). `capture.pageStalls` now tells a page stall from a capture drop.
- Still open from earlier sessions: `OPENROUTER_API_KEY` in the user file, and the notes for Session 9.

## Resumption Context

Key files to review when picking this up:
- `plugins/showcase/toolkit/film/record.ts`
- `plugins/showcase/toolkit/film/timeline.ts`
- `plugins/showcase/toolkit/film/encode.ts`
- `plugins/showcase/toolkit/runtime/src/film-aids.ts`
- `.planning/showcase-plugin/PLAN.md` §2.5 and §5 Sessions 7–8

Suggested opening prompt for next session:
> "Run /session .planning/showcase-plugin — Session 8 (F4 · Film II: sound, captions, outputs and verify), building on Session 7's `film --video-only` and its `timeline.json`."
