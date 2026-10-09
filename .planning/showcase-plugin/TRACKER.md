# showcase plugin roadmap — TRACKER

> The last action of every session is to (1) confirm its verification gate passed, (2) update the row below, and (3) surface the next session's kickoff prompt. If a gate fails, mark the row ⛔, record the blocker here, and **stop** — do not start the next session. If you need a decision the plan doesn't settle and cannot ask for it, mark the row ⛔ with `Needs decision: <question — options>` and **stop**.

`PLAN.md` is authoritative. Sessions 9, 12 and 13 are run by hand: under autopilot each one sets ⛔ `Needs decision: run Session N interactively …` at once (PLAN §4, D14).

## Status board

| # | Session | Status | Key artifacts | Verification | Notes |
|---|---|---|---|---|---|
| 1 | F1 · Foundation: plugin skeleton, CLI, keys, doctor | ✅ | `plugins/showcase/` manifest 0.1.0, `bin/showcase`, `toolkit/{cli,commands,lib}`, `hooks/guard-keys.sh`, `env.template`, 53 tests | npm test 53/53, typecheck, doctor --json all ok, keys status (gods-eye: repo .env.local; scratch: user file missing), plugin validate ✔ | key not yet in user file; esbuild postinstall skipped (Session 4) |
| 2 | F2 · Spikes and the fixture app | ✅ | `toolkit/fixtures/{serve.ts,app/}` (5 pages, every hard case, no test ids), `toolkit/spikes/` (4 spikes, prototype overlay, `results/*.json`), `fixtures.test.ts` | fixture check: 6 pages, 0 console problems; S-D1…S-D4 measured and recorded in PLAN §3; Spike 2 20/20, menu never closed; Spike 3 screenshots + `elementFromPoint` for 20 cells, contact sheet read back; npm test 60/60, typecheck | default scale 1.5 (needs `--force-device-scale-factor`), JPEG q90; overlay: the hybrid (popover draws, controls move into modal/fullscreen/auto popover); Playwright defaults for page loads |
| 3 | T1 · Tour format and narrative rules | ✅ | `toolkit/schema/{tour,config}.schema.json`, `runtime/src/{schema,narrative}.ts`, `lib/{config,tours}.ts`, `check` · `storyboard` · `init`, 4 spine templates + config, Compass golden, 20 negative fixtures, `reference/{tour-format,narrative,interview}.md` | npm test 112/112, typecheck; golden 100.8 s / 248 words / 9 beats, no issues; `check` clean on all 4 templates; `docs tour-format` prints; plugin validate ✔ | rule ids T001–T015; `readingMs` rounds (as gods-eye); `interview.md` is a draft |
| 4 | R1 · Runtime I: the engine | ✅ | `toolkit/runtime/src/` (capture, clock, anchors, ready, dom-events, narration, film-events, timeline, state, bridge, overlay-port + pointer stub, executor, director, index/inject), `runtime/{build,stamp}.ts`, committed `runtime/dist/` (IIFE, ESM, `.d.ts`, `STAMP`), `toolkit/host/launch.ts`, `test/runtime/{bundle,director,engine}.test.ts` (22 tests), 134 tests in all | npm test 134/134, typecheck (4 projects), stamp fresh; in Chromium on the fixture: 18 action kinds, 14 input-bearing ones trusted, 0 synthetic fallbacks; covered targets 6/6 trusted (header, banner, scroller, iframe, dialog); a 3-document film resumed from host state (4 sentences once, 3 writes once, 2 `nav`, armed once); `film:error` names beat and anchor; Back writes nothing; a deep link fast-forwards 2 writes before arming; director on a fake clock 12/12 | one binding `__showcaseHost` carries events (PLAN §2.1 updated); `navigates` is a persisted stage; re-show rule reads the journal only; `scroll until` means on screen; viewer click pauses (keys and controls in S5) |
| 5 | R2 · Runtime II: overlay, host, Watch, rehearse and inspect | ✅ | `runtime/src/overlay/` (hybrid popover + moving controls, pointer, spotlight, callout, captions, cards, end card), `runtime/src/{audio,inspect,protocol}.ts`, `host/{app,project,rehearse,watch,inspect,auth}.ts` + full `launch.ts`, `lib/screen-checks.ts`, commands `rehearse` · `watch` · `inspect` · `auth` · `storyboard --stills --html`, `fixtures/showcase/` (config, `fixture-tour`, manifest, clip), 23 new tests, 157 in all | npm test 157/157, typecheck (4 projects), stamp fresh, plugin validate ✔; overlay over a modal (pixels + `elementFromPoint`), controls clickable in the dialog and in an auto popover, the app never sees the click; planted deny string → `invite`, unspoken number → `revenue`; `rehearse` clean 3× at ×10 (+1 via `storyboard --stills`); `inspect` role-and-name anchors; headed `watch --detach` exits cleanly on SIGTERM; no app group, Chromium or lock left; 8 stills read back | Session 4 fix: resume after a step's own load re-ran nothing (nav was skipped); still of a navigating beat taken before it leaves; card hides spotlight and pointer; `auth` not run headed (writer unit-tested) |
| 6 | V1 · Voice | ⬜ | | | |
| 7 | F3 · Film I: capture and video | ⬜ | | | |
| 8 | F4 · Film II: sound, captions, outputs and verify | ⬜ | | | |
| 9 | R1 · Checkpoint: look and feel (by hand) | ⬜ | | | |
| 10 | I1 · The in-app path | ⬜ | | | |
| 11 | S1 · The skill and integration | ⬜ | | | |
| 12 | P1 · Star I: the film and live demo (by hand) | ⬜ | | | |
| 13 | P2 · Star II: the in-app tour, then the release (by hand) | ⬜ | | | |

Legend: ⬜ Not started · 🟡 In progress · ✅ Done · ⛔ Blocked

## Open items / blockers

- [ ] **`OPENROUTER_API_KEY` in the user key file** (`~/.config/showcase/.env`).
  - Ready now (Session 1 ✅): give your go for `showcase keys import ~/_PRJ/gods-eye/.env.local`, or run `plugins/showcase/bin/showcase shim`, then `showcase keys set` in your own terminal. Check it with `showcase keys status` and `showcase keys test`.
  - Session 6's audition gate and Session 12's final voice need it. The draft voice covers everything else.
- [ ] **Review notes for Session 9** (look and feel), under Review notes below, or say "approve as-is" when it runs.
- [ ] **Your availability** for the by-hand Sessions 9, 12 and 13.
- [ ] **The go to push** `main` and the tag `showcase--v1.0.0` to `origin` and `GITLAB` (Session 13). Nothing is pushed before then.

## Review notes

### Look and feel (read by Session 9)

(none yet: watch the fixture film, run the live demo and read `skills/showcase/reference/interview.md` when Session 9 asks, then add bullets here or say "approve as-is")

### Star film and live demo (Session 12, gathered in the session)

(none yet)

### Star in-app tour and release (Session 13, gathered in the session)

(none yet)

## Session log

### Session 1 — F1 · Foundation (2026-10-09) ✅

Runtime: opus/medium (autopilot attempt 1)

- **Landed:**
  - the `showcase` plugin at 0.1.0;
  - `bin/showcase` (Node ≥ 24 and TS-stripping check);
  - the `parseArgs` router with `doctor`, `keys status|init|import|test|set`, `shim` and `docs`;
  - `toolkit/lib/{names,env,redact,child-env,log,paths,ffmpeg,playwright}.ts`;
  - the PreToolUse guard `hooks/guard-keys.sh`;
  - `env.template`;
  - 53 committed tests.
- **Gate:** all checks passed:
  - `npm test` 53/53 and the typecheck;
  - `doctor --json` all ok (ffmpeg 8.0.1 with every capability, playwright-core 1.63.0 from the plugin's node_modules, Chromium 1243, 9 en-GB `say` voices);
  - `keys status`: gods-eye shows `OPENROUTER_API_KEY set (repo .env.local)`, and a scratch dir shows the user file missing, with no values printed;
  - `claude plugin validate` ✔.
- **Deviations and small choices:**
  - The hook contract was confirmed from the live hooks docs, because no `claude-code-guide` agent was available.
  - The OpenRouter `/api/v1/key` shape was confirmed from its OpenAPI spec; `keys test` prints only the non-secret usage and limit fields, never `label`.
  - Added the dev dependency `@types/node`, recorded in PLAN C2.
  - Added a loopback-only `SHOWCASE_OPENROUTER_BASE` override, for the canary tests.
  - The key-file writers live in `env.ts`.
  - The guard also blocks Grep and Glob on the config directory.
  - The plan dir's `autopilot/` run logs were left uncommitted.
- **For Session 4:** npm skipped esbuild's postinstall (allowScripts); approve it if the build needs it.

### Session 2 — F2 · Spikes and the fixture app (2026-10-09) ✅

Runtime: opus/high (autopilot attempt 1)

- **Landed:**
  - the fixture app: `toolkit/fixtures/serve.ts` (`node:http`, its own port, `/spa/*` fallback, optional latency) and `app/` (`index`, `list`, `detail`, `spa`, `frame`), with every hard case Session 2 lists, found by role and label, and no test ids;
  - the spike harness `toolkit/spikes/`: `check-fixture.ts`, `spike1-capture.ts` … `spike4-pageload.ts`, `run-all.ts` (`npm run spikes`), `lib.ts`, the prototype overlay `overlay-proto.js`, and `results/*.json` (small, committed);
  - `toolkit/test/fixtures.test.ts` (7 tests): 60 tests in all.
- **Gate:** all checks passed:
  - the fixture check: 6 pages, 0 console errors or warnings, failed requests or 4xx;
  - all four spikes measured, with verdicts in PLAN §3;
  - Spike 2: 20/20 trusted clicks landed, and the controls never closed the menu;
  - Spike 3: a screenshot, pixel checks and `elementFromPoint` for every case; the contact sheet and one full frame read back;
  - `npm test` 60/60 and the typecheck.
- **Measurements** (M4 Max, new headless `channel: "chromium"`, ANGLE Metal):

  | Spike | Configuration | Result |
  |---|---|---|
  | 1 capture | scale 1 / 1.5 / 2 × q80 / q90, 2 reps, 300 ms settle | every config: p5 60 fps, median 60, largest gap 21–35 ms, event-loop p99 11.7 ms, page rAF 60 |
  | 1 capture | MB/s and kB/frame, q80 → q90 | scale 1: 4.9 → 6.1 MB/s (81 → 102 kB); 1.5: 4.8 → 6.1 (80 → 101 kB); 2: 5.4 → 6.9 (90 → 116 kB); queue ≤ 2, no delayed acks |
  | 1 capture | scroll burst, no settle | p5 43 fps, one 267 ms gap at every scale (the page's rAF never stalls) |
  | 1 capture | emulated DPR only | frames come at CSS size: 1280×720 at 1.5, 960×540 at 2 |
  | 2 clicks | 20 trusted clicks, overlay present | 20/20 landed and logged as trusted; 16 covered or clipped before the check; 0 synthetic |
  | 2 menu | 5 control clicks: host-stop / window-stop / none | menu open 5/5 / 5/5 / closed at once; a capture-phase listener saw 5 / 0 / 1 |
  | 3 top layer | popover re-shown / never re-shown / portal / hybrid / hybrid+popover | drawn 4·1·2·4·4 of 4; clickable 2·1·2·4·4; app element kept 3·4·4·3·4 |
  | 4 page loads | PaintHolding off/on × 120/400 ms latency | 0 white frames (max luma 31, base 26); load = held frame of 149 ms / about 420 ms; re-armed 4/4; `seq` strictly increasing |

- **Deviations and small choices:**
  - **§2 updated to the verdicts:**
    - §2.1 Overlay is now the hybrid: the popover draws everything, and only the controls move, into the fullscreen element, else the topmost modal dialog, else the app's open auto popover. Events are consumed by a window capture listener instead of stopping at the host.
    - §2.2: `browser.scale` defaults to 1.5, and page loads keep Playwright's defaults.
    - §2.5: `--force-device-scale-factor`, q90, the 300 ms scroll settle, and verify's `nav` exemption.
    - C3 gains the spikes' tsconfig.
    - Matching edits went into PLAN §5 Sessions 5 and 8 and `prompts/session-{5,8}.md`.
  - **Findings the plan didn't expect:**
    - The screencast drops the emulated DPR unless the real one is forced.
    - In Chromium a fullscreen element makes the rest of the page inert.
    - A click on a manual popover's controls light-dismisses an app's `popover=auto`.
    - New headless shows no white flash even with PaintHolding off.
  - **For Session 5:** the overlay re-arms at the viewport centre after a load, so the host must hold the pointer's position.
  - `toolkit/spikes/` has its own `tsconfig.json` (adds the DOM lib), and `npm run typecheck` runs both. The root tsconfig excludes it.
  - Spike outputs (screenshots, sample frames, contact sheet) go to the ignored `toolkit/test/.out/spikes/`; only the small JSON results are committed.
  - The plan dir's `autopilot/` run logs were again left uncommitted.

### Session 3 — T1 · Tour format and narrative rules (2026-10-09) ✅

Runtime: opus/medium (autopilot attempt 1)

- **Landed:**
  - `toolkit/schema/tour.schema.json` (the single source: 18 action kinds, 10 predicates, anchors, meta) and `config.schema.json`;
  - `toolkit/runtime/src/schema.ts`: the types, a JSON Schema subset interpreter (refuses unknown keywords; discriminated-union errors) and the cross-field checks; `narrative.ts`: `readingMs`, presets, kind factors, caption wrapping, spoken numbers, the static rules. Both browser-safe (a test checks their imports);
  - `toolkit/lib/config.ts` (validation plus defaults) and `lib/tours.ts` (resolve by path or id, storyboard render and hash);
  - the commands `check`, `storyboard` and `init`;
  - `skills/showcase/templates/tour.{pitch,walkthrough,spotlight,howto}.json` and `config.json`;
  - `toolkit/test/golden/compass-pitch.json`;
  - `toolkit/fixtures/tours/valid-base.json` and 20 negative fixtures in `invalid/`, named for their rule;
  - `skills/showcase/reference/{tour-format,narrative,interview}.md`;
  - 52 new tests (112 in all).
- **Gate:** all checks passed:
  - `npm test` 112/112 and the typecheck;
  - the golden: 100 808 ms of `readingMs` narration (100.8 s), 248 words, 9 beats, no issues;
  - every negative fixture fails with exactly its rule id;
  - `bin/showcase check` on each template: ok, no issues (pitch 105.1 s, walkthrough 138.1 s, spotlight 51.1 s, how-to 84.1 s, all inside their windows);
  - storyboard determinism (same bytes, whatever the key order) and staleness (T015 until regenerated); `init` run twice changes nothing;
  - `bin/showcase docs tour-format` prints the doc; `claude plugin validate` ✔.
- **Small choices:**
  - **Rule ids:** T001 schema · T002 duplicate ids · T003 `after` · T004 write without `done` · T005 `navigates` (not last, or a sentence waits for it) · T006 unknown `@anchor` · T007 caption · T008 narration window · T009 beat count (warning) · T010 spoken number under `none` · T011 `firstToCut` · T012 last-card hold · T013 pitch callout (warning) · T014 empty beat (warning) · T015 stale storyboard. Errors exit 1, warnings exit 0.
  - "Spoken number": a digit, or a spelt-out quantity with a magnitude or percent; plain counts are words (keeps Compass's `none` pitch clean, as its `/\d/` test did).
  - Between presets: narration 80–90 % of the target, beats interpolated.
  - `press` is a long press; `key` is the keyboard.
  - The storyboard hash ignores key order, whitespace and `$schema`. A tour outside `showcase/tours/` has storyboard state `n/a`, and `storyboard` needs `--out` for it.
  - `init` never overwrites `config.json`; it keeps the `.schema/` copies current.
  - `meta.approved {storyboard, narrator, final}` added to the schema for P11's approval dates.
  - The schema JSON was produced once by a throwaway generator, for consistent action branches, and is maintained by hand from now on.
- **Discrepancy logged:** PLAN §2.8's `readingMs` formula has no rounding; gods-eye's rounds to the millisecond, and the 100.8 s golden needs it. The code follows gods-eye.
- The plan dir's `autopilot/` run logs were again left uncommitted.

### Session 4 — R1 · Runtime I: the engine (2026-10-09) ✅

Runtime: fable/high (autopilot attempt 1)

- **Landed:**
  - `toolkit/runtime/src/`: `capture.ts` (the real timers and setters, once per document, top frame), `clock.ts` (pace, wall, ticker on the captured timers; `FakeClock`), `anchors.ts` (role and name with a subset of accessible-name computation, label, test id, text, CSS; visible first; open shadow roots; same-origin frames, top wins; `@name`), `ready.ts` (the ten predicates; MutationObserver plus a 100 ms wall-clock poll; 10 s / 30 s), `dom-events.ts` (the port plus `beforeinput` typing, `DataTransfer` uploads, a drag sequence), `narration.ts` (cues, `speak`, `AudioPort`, a draft manifest shape, `narrationFingerprint`), `film-events.ts` (the contract and `filmOrderProblems`), `timeline.ts`, `state.ts`, `bridge.ts`, `overlay-port.ts` and the pointer stub, `executor.ts` (all 18 kinds), `director.ts`, `index.ts` and `inject.ts`;
  - `npm run build:runtime`: esbuild IIFE and ESM, `tsc` declarations, `dist/STAMP` over `src/`, the schema and the build script; `dist/` committed;
  - `toolkit/host/launch.ts`: Chromium via playwright-core, config and IIFE init scripts, the `__showcaseHost` binding (mouse, keyboard, `setInputFiles`, state, assets, events, logs), CDP `nav` events, test helpers;
  - `toolkit/test/runtime/`: `bundle` (4), `director` on a fake clock (12), `engine` in Chromium (6); `fixtures/assets/upload.txt`.
- **Gate:** all checks passed:
  - `npm test` 134/134 (25 s) and `npm run typecheck` over four projects; the stamp is fresh;
  - every action kind with trusted input, 0 synthetic fallbacks; covered targets 6/6 trusted and logged trusted by the fixture; the three-document film resumed with host-held state (sentences and writes once each, `seq` increasing, docs 1–3, `film:armed` once); `film:error` names the beat and the anchor; Back re-shows without a click; the deep link fast-forwards two writes, trusted, before arming.
- **Deviations and small choices:**
  - **PLAN §2.1 updated:** the one binding `__showcaseHost(msg)` carries input, state, assets, events, logs, `ready` and snapshots (it said `__showcaseFilm` for events); the host starts a film with `__showcaseGo()`; the page API is `window.__showcase`; events also go out as a `showcase:film` CustomEvent and into `__showcaseFilmLog`, with `html[data-showcase-film]`.
  - **Run state:** `{v, runId, tourId, mode, speed, stepIndex, beatIndex, at{action, sentence, speaking, stage}, entered, target, journal, seq, doc, rolling, filmBeats, paused, pointer, startedAt}`; stages `begin → tracks → nav → ready → dwell`. The runtime stamps `seq` from it; the host bumps `seq` for its `nav` events; `doc` goes up at each boot.
  - A `navigates` action runs after both tracks, with stage `nav` persisted first. The next document waits for its `done`, journals it and emits its `done` phase, so nothing is repeated. A sentence cut by an unmarked load counts as spoken (ended in the new document, not repeated).
  - The "reads before an already-done write are left out" rule (re-show) now reads only the journal: a `done` that holds before the write (an absence) had dropped the reads in front of it on first play.
  - `scroll … until` runs until the named element is on screen, not merely rendered, and brings the scroller on screen first; `isVisible` is Playwright's, `inView` adds scroll-container clipping.
  - `select` moves the real mouse then sets the value as Playwright's `selectOption` does; `upload` (trusted) is `setInputFiles` on the stashed element; `type` (trusted) clicks to focus, select-all + Backspace, then types per character; `key` uses Playwright's spelling; cosmetic kinds are spotlight, hover, focus, camera, card, hold and `wait` without `until`.
  - The runtime never boots on `about:blank`. A viewer's trusted `pointerdown` outside the acting window pauses a Watch run (keys and controls are Session 5).
  - **C3:** `toolkit/runtime/` and `toolkit/host/` have their own tsconfigs (DOM lib; the host's also takes `toolkit/test/runtime/`), and the root excludes them, so Node code still sees no DOM globals.
  - The IIFE is 177 KB unminified because the tour schema is bundled; `dist/showcase-runtime.d.ts` re-exports `dist/types/` emitted with `rewriteRelativeImportExtensions`.
  - The plugin's schema has no `grew` predicate and no step `requires`; fast-forward takes every earlier step's writes.
  - **For Session 5:** implement `OverlayPort` (`pointerTo, press, spotlight, card, caption, acting, owns, pointer, movePointer, destroy`); the host's `nav` events stamp `t` with `Date.now()`; `HostOptions.initScripts` and `host.inputs` are test aids.
  - The plan dir's `autopilot/` run logs were again left uncommitted.

### Session 5 — R2 · Runtime II: overlay, host, Watch, rehearse and inspect (2026-10-09) ✅

Runtime: opus/high (autopilot attempt 1)

- **Landed:**
  - the overlay, `runtime/src/overlay/`: the S-D3 hybrid (`<showcase-overlay popover="manual">` on `<html>`, re-shown at every top-layer change; `<showcase-controls>` moved into the fullscreen element, the topmost modal or the app's topmost auto popover); a WAAPI pointer with a click ripple, a spotlight that follows its element, callouts placed by Compass's `placeCallout`, 2 × 42 captions, title and closing cards, controls (back, play/pause, next, step count, mute, exit, and Retry/Skip when stuck) and an end card; `:host{all:initial}`, adopted stylesheets only, fonts at document level, re-attached when removed, never focused, reduced motion honoured;
  - `top-layer.ts`: the patches and the control guard, installed by the bootstrap before any app code; Watch keys (Space, ←, →, M, Esc) in a capture listener;
  - `audio.ts`: manifest clips through the binding, Blob URLs, mute without timing change; `inspect.ts` (outline + checked anchor suggestions, `visibleText`); `protocol.ts` (DOM-free host/page types);
  - the full host: `app.ts` (build, snapshot, start on `{port}`, health, reset, `appEnv`, the per-repo lock, process-group stop), `launch.ts` (headless or headed maximised, scale, locale, timezone, colour scheme, `storageState`, `setFixedTime` after the runtime, `bypassCSP`, service workers blocked, `Network.setBlockedURLs`, `hide`, file choosers, dialogs, same-tab popups, clipboard, `gpu: required`, gone-context tolerance), `project.ts`, `rehearse.ts`, `watch.ts`, `inspect.ts`, `auth.ts`;
  - commands `rehearse`, `watch` (with `--detach`), `inspect`, `auth`, and `storyboard --stills --html`; `lib/screen-checks.ts`; `renderStoryboardHtml`;
  - the fixture project `toolkit/fixtures/showcase/` and tests: `test/runtime/overlay.test.ts` (5), 4 more director tests, `test/host.test.ts` (8), `test/rehearse.test.ts` (6).
- **Gate:** all checks passed:
  - `npm test` 157/157 (60 s) and `npm run typecheck` over four projects; the stamp is fresh; `claude plugin validate` ✔; no `context.route` anywhere;
  - the overlay over a modal: the pointer's pixels change when it's hidden, the popover is open on top, `elementFromPoint` at the pause control is the controls host inside the dialog (not inert); a trusted click pauses and resumes, the dialog stays open, the app's click log is unchanged, focus doesn't move; in an auto popover the click doesn't light-dismiss it;
  - a planted deny-list string fails naming `invite`; a spoken "seven per cent" against "4%" fails naming `revenue`; a missing anchor saves a screenshot, a DOM excerpt, the outline and `{role: button, name: Accept cookies}` as the first candidate;
  - `rehearse` clean three times at ×10 (8/8 beats, 8 stills, about 6 s each), and once more through `storyboard --stills --html`; after each, the app's process group, Chromium (by marker) and the lock are gone;
  - `inspect` suggests role-and-name anchors (over 80 % of items), frames named for iframe content; a path works with `--base`;
  - a headed `watch --detach` at ×10 reaches its end card, then exits on SIGTERM leaving nothing behind;
  - stills read back: the title card with its caption, the spotlit paragraph with its callout, the dialog with the spotlit "Add as editor" and its callout over the modal, the pointer at each click, 2-line balanced captions, the closing card.
- **Deviations and small choices:**
  - **A Session 4 director bug, fixed:** a run resumed after a step's own page load (the step's `path` entered with `location.assign`) skipped the first beat's navigating action, as if dispatched before the load; only a resume at stage `nav` counts as dispatched now. A director test covers it.
  - **Read-back fixes:** a navigating beat's still is taken after its tracks and before its navigating action (it showed the next page); a card hides the previous spotlight and the pointer (both were drawn over the closing card).
  - `stop()` waits for the app's whole process group, not just its shell (a host test caught a grandchild outliving it).
  - Host commands take `--base`, `--build` (off by default before `film`) and `--no-reset`; `rehearse` defaults to ×10; `storyboard --stills` rehearses and `--out-dir` moves the stills and page; the storyboard markdown never depends on the stills.
  - The Watch manifest is `--manifest`, else `<voice.dir>/manifest.json` if its `tour` matches; Session 6 owns the format.
  - Spoken numbers match by value; a spoken percentage needs a percentage on screen; times (`3:00`) and codes (`W39`) match as text. Deny strings match without case; the report names the rule and the beat.
  - Deny and number checks run at each beat's checkpoint, not mid-beat.
  - `auth` wasn't run headed (it needs a person); its secret writer (dir 700, file 600, atomic) is unit-tested. Its commands never print the state.
  - `SHOWCASE_RUN_MARKER` is a test aid that marks Chromium's command line.
  - `watch --detach` drops `--json` for the child, so its log has the progress lines.
  - The plan dir's `autopilot/` run logs were again left uncommitted.
- **PLAN.md updated:** status line, §2.2 (flags, app-command rules), C3 (`protocol.ts`), §5 Session 5 "As built".

