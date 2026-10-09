# Session: showcase S4 · the tour runtime engine and its bundle

**Date:** 2026-10-09
**Branch:** main
**Roadmap:** `.planning/showcase-plugin`
**Runtime:** `fable/high (autopilot attempt 1)`

## Summary

Session 4 of the showcase roadmap built the in-page engine: a port of Compass's director and executor without React, Zod, Present mode, the notes window or the server, plus everything the plugin's design adds on top. The runtime (`plugins/showcase/toolkit/runtime/src/`) captures the real timers before any app code, resolves anchors by role and name, label, test id, text and CSS (visible first, open shadow roots, same-origin frames, `@name`), waits on predicates with a MutationObserver and a wall-clock poll, performs every action kind of PLAN §2.1 with trusted CDP input through the host binding behind a Playwright-style clickability check (synthetic fallback, logged), runs each beat on two tracks with `after` gates, dwell, Next, Back re-show and deep-link fast-forward, keeps run state the host holds across full page loads, and emits the film contract (`v, seq, doc, t, wall`) with `filmOrderProblems` ported. esbuild bundles it into a committed, hash-stamped `dist/` (IIFE, ESM, `.d.ts`). A host skeleton launches Chromium, injects the bundle and answers the binding. The gate passed headless on the fixture app: 134 tests in all, 22 of them new, including a real-Chromium run of every action kind with trusted input, covered targets, a three-document film resumed from host state without repeating a write or a sentence, a missing anchor's `film:error`, Back without writing, and a deep link's silent fast-forward; the director also runs on a fake clock in 12 unit tests.

## Changes

- `plugins/showcase/toolkit/runtime/src/capture.ts` — captures `Date.now`, `performance.now`, timers, rAF and the input value/checked setters once per document; `isTopFrame`, `nextFrame`.
- `plugins/showcase/toolkit/runtime/src/clock.ts` — Compass's `Clock`, `RealClock` (on injected timers), `FakeClock`, `Aborted`; `createClocks` gives pace, wall and ticker.
- `plugins/showcase/toolkit/runtime/src/anchors.ts` — the resolver: implicit roles, a subset of accessible-name computation, `queryDeep` through open shadow roots, same-origin frames (top wins), visible-first ordering, `rectOf` with frame offsets, `describeAnchor`.
- `plugins/showcase/toolkit/runtime/src/ready.ts` — the ten predicates, `waitFor` (MutationObserver + 100 ms poll on the wall clock), 10 s anchor and 30 s readiness timeouts, `ReadyTimeout` carrying the anchor.
- `plugins/showcase/toolkit/runtime/src/dom-events.ts` — the realm-correct synthetic events, plus `beforeinput` typing for contenteditable, `DataTransfer` uploads, a drag sequence, select-all and caret helpers; setters use the captured natives in the top realm.
- `plugins/showcase/toolkit/runtime/src/narration.ts` — cues from `readingMs` or a manifest clip, `speak`, an `AudioPort` interface for Session 5, a draft `VoiceManifest` shape and an FNV-1a `narrationFingerprint`.
- `plugins/showcase/toolkit/runtime/src/film-events.ts` — the PLAN §2.1 contract as types, the binding names, and `filmOrderProblems` (also checks `v`, strictly increasing `seq`, non-decreasing `doc`, `t` within a document; `nav` allowed anywhere).
- `plugins/showcase/toolkit/runtime/src/timeline.ts` — stamps each event from the run state's `seq`/`doc` and the captured clocks; sends to the host, a `showcase:film` CustomEvent, `__showcaseFilmLog`, `html[data-showcase-film]`.
- `plugins/showcase/toolkit/runtime/src/state.ts` — `RunState` (position with stages begin/tracks/nav/ready/dwell and the sentence being spoken, `entered`, `target`, journal, `seq`, `doc`, `rolling`, pointer), `journalKey`, memory, sessionStorage and host-backed stores.
- `plugins/showcase/toolkit/runtime/src/bridge.ts` — `__showcaseHost(msg)` messages (input, state, asset, event, log, ready, snapshot), `InputRequest`, `waitForGo` (`__showcaseGo()`), the `Acting` window.
- `plugins/showcase/toolkit/runtime/src/overlay-port.ts`, `overlay-stub.ts` — the `OverlayPort` Session 5 implements, and the pointer stub (a `<showcase-overlay popover="manual">` on `<html>`, adopted styles, WAAPI pointer, `data-acting`).
- `plugins/showcase/toolkit/runtime/src/executor.ts` — all 18 action kinds, the clickability check (`elementsFromPoint` through frames, overlay ignored, inset points, stable rect), trusted input with synthetic fallback and notes, `isDone`, the journal, `scroll … until` as "in view".
- `plugins/showcase/toolkit/runtime/src/director.ts` — Watch and film: two tracks, gates, `navigates` as a persisted stage, dwell, Next, Back, jump, deep links, pause, blocked (retry/skip), the film handshake, resume after a load.
- `plugins/showcase/toolkit/runtime/src/index.ts`, `inject.ts` — the external boot (`window.__showcase` API, config from `window.__showcaseConfig`, store choice, viewer-click-pauses listener, no boot on `about:blank`) and the IIFE entry.
- `plugins/showcase/toolkit/runtime/build.ts`, `stamp.ts`, `tsconfig.json`, `tsconfig.dts.json` — esbuild IIFE + ESM, `tsc` declarations into `dist/types/`, `dist/STAMP` over `src/`, the schema and the build script.
- `plugins/showcase/toolkit/runtime/dist/` — the committed bundle (`showcase-runtime.iife.js`, `.mjs`, `.d.ts`, `types/`, `STAMP`).
- `plugins/showcase/toolkit/host/launch.ts`, `tsconfig.json` — the host skeleton: Chromium via playwright-core, init scripts, the binding (mouse, keyboard, `setInputFiles` uploads, state, assets, events, logs), CDP `nav` events, test helpers.
- `plugins/showcase/toolkit/test/runtime/{bundle,director,engine}.test.ts` — 22 new tests; `toolkit/fixtures/assets/upload.txt` for the upload.
- `plugins/showcase/package.json`, `tsconfig.json` — `build:runtime` is real; `typecheck` runs four projects; the root excludes the runtime, host and runtime tests.
- `.planning/showcase-plugin/PLAN.md`, `TRACKER.md` — status, the bridge name, the tsconfig convention, an as-built note, row 4 and the session log.

## Decisions & Rationale

- One binding, `__showcaseHost`, carries the film's events too → the session prompt names it for "input, state, assets and events"; PLAN §2.1's `__showcaseFilm` is updated (the newer decision wins).
- The runtime stamps `seq` itself from the host-held state, and the host bumps it for its own `nav` events → one strictly increasing sequence across documents without an async round trip per event.
- A `navigates` action runs after both tracks with the stage persisted first; the next document waits for its `done`, journals it and emits its `done` phase → no sentence is cut, no write repeats, and the film log stays in order across a load.
- The "reads before an already-done write are left out" rule now looks only at the journal → an absence-style `done` (Escape closes a menu) held before the write and silently dropped the reads in front of it on first play.
- `scroll … until` keeps going until the named element is on screen, not merely rendered → Playwright's "visible" counts a row clipped by its scroller, which is never what a tour means.
- `select` moves the real mouse, then sets the value as Playwright's `selectOption` does → a trusted click would open the native popup over the film.
- Trusted `upload` is Playwright's `setInputFiles` on the stashed element → it serves hidden inputs too and fires a trusted `change`; the synthetic path builds a `DataTransfer` from bridge assets.
- Separate tsconfigs for `toolkit/runtime/` (DOM) and `toolkit/host/` (DOM + Node, also the runtime tests) → Node code elsewhere still sees no DOM globals (C3), as the spikes already did.
- The runtime doesn't boot on `about:blank` → the context's first document ran a start flow against an invalid base URL and left a stray `film:error`.

## Remaining Work

- Session 5 (R2): the hybrid overlay (S-D3), audio in the runtime, the full host (app lifecycle, options, page-load handling), `watch`, `rehearse`, `inspect`, `auth`, `storyboard --stills --html`.
- Session 6 firms up the voice manifest shape drafted in `narration.ts`.
- Session 10 wires `window.__showcase.actions.register` into the in-app adapters and the sessionStorage path.
- The IIFE is 177 KB unminified because the tour schema JSON is bundled; minify or trim before vendoring if size matters (Session 10).
- The plan dir's `autopilot/` run logs are still uncommitted, as in Sessions 1–3.

## Resumption Context

Key files to review when picking this up:
- `.planning/showcase-plugin/PLAN.md` §2.1 and §5 Session 5
- `plugins/showcase/toolkit/runtime/src/{director,executor,overlay-port,bridge,index}.ts`
- `plugins/showcase/toolkit/host/launch.ts`
- `plugins/showcase/toolkit/test/runtime/engine.test.ts`

Suggested opening prompt for next session:
> "Run `/session .planning/showcase-plugin` for Session 5 (R2 · Runtime II). The engine, bundle and host skeleton from Session 4 are in; build the overlay against `OverlayPort`, the full host, Watch, rehearse and inspect."
