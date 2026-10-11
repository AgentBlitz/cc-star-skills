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
| 6 | V1 · Voice | ✅ | `toolkit/voice/` (`tts/{openrouter,say,fake}`, `pool`, `keys`, `lexicon`, `audio`, `manifest`, `setup`, `pipeline`, `audition`, `catalogue`), commands `voice` · `voices`, `reference/voice.md`, `<tour>.manifest.json`, 35 new tests, 192 in all | npm test 192/192, typecheck (4 projects), plugin validate ✔; fake provider through real ffmpeg: 10 draft clips mono 24 kHz, −16 ± 1 LUFS; mocked fetch: format memory, 429 + `Retry-After`, network-error retry, 401/402 neither retried nor echoed, canary absent from every output and file; edit → `--check` missing; post setting → stale, re-processed from cache; max 3 requests in flight | audition **skipped, pending the key** (`keys status`: unset); the page was written with the draft voice only (nothing sent); manifest is per tour (`<tour>.manifest.json`) |
| 7 | F3 · Film I: capture and video | ✅ | `toolkit/film/` (`record`, `capture`, `capture-worker`, `frames`, `cfr`, `timeline`, `encode`), command `film --video-only [--detach] [--capture]`, `runtime/src/film-aids.ts` (probe, heartbeat, page frame rate), `out/<id>/{video.mp4,timeline.json,progress.json}`, 13 new tests, 205 in all | npm test 205/205, typecheck (4 projects), plugin validate ✔; fixture tour: ffprobe 1920×1080, r/avg 30/1, H.264 High, yuv420p, BT.709 matrix/transfer/primaries, range tv; duration 40.300 s vs timeline 40.289 s; no app, Chromium, ffmpeg or lock left | capture median 60 fps (p5 59), page 60 fps; largest motion gap 22.3 ms (20–27 ms over 5 takes; 1 page-load hold of 34 ms exempt); sync probe 19.7 ms (18–21); event-loop p99 11.7 ms, main thread throughout; ANGLE Metal |
| 8 | F4 · Film II: sound, captions, outputs and verify | ✅ | `toolkit/film/{mix,captions,script,post,verify}.ts`, master encode in `encode.ts`, `film [--strict]` (`--video-only` now optional), `toolkit/fonts/` (Atkinson Hyperlegible Bold + OFL), fixture `sync.html` + `sync-tour`, `reference/film.md`, 224 tests in all (205 before) | npm test 224/224, typecheck (4 projects), plugin validate ✔; `film --strict` green on fixture-tour and sync-tour with the fake voice and with `say`; SRT = sentences; beep beat caption↔sound −26.7 ms (fake) / +3.3 ms (say), flash +27/+30 ms after the sound; fixture master −16.0/−16.1 LUFS, TP −13.6/−4.3 dBTP; contact sheet + 8 stills read back | **The fixture film for Session 9:** `plugins/showcase/toolkit/test/.out/s8-fixture/showcase/out/fixture-tour/fixture-tour-draft.mp4` (say voice, 36.8 s; contact sheet, stills, script and report beside it; ignored, regenerate per the session log) |
| 9 | R1 · Checkpoint: look and feel (by hand) | ✅ | No code changes (approved as-is); PLAN §3 "Review notes — look and feel"; re-rendered fixture film `plugins/showcase/toolkit/test/.out/s8-fixture/showcase/out/fixture-tour/fixture-tour-draft.mp4` (ignored) | `film --strict` green on fixture-tour (largest motion gap 21.3 ms, A/V sync 16.7 ms, −16.1 LUFS, 1105/1105 frames), after two runs failed only motion-gap (235.6 ms, 147.4 ms) under host load from endpoint-security scanning; npm test 224/224; typecheck (4 projects) exit 0 | **Approved as-is** by the user after watching the fixture film and live `watch` and reading interview.md: checklist empty, nothing to close. Session 8's soft points (cookies still, "the trend" over a spinner, DRAFT over "Account") not raised, left as is |
| 10 | I1 · The in-app path | ✅ | `runtime/src/in-app.ts` + `startInApp` (index.ts), `runtime/adapters/{next,react,html}`, `lib/vendor.ts` + `runtime vendor`, `film --in-app`, `rehearse --synthetic` gaps, `fixtures/next/` + `fixtures/next-fixture.ts`, `test/{in-app,runtime/in-app}.test.ts`, `test/next/next.e2e.ts` (`npm run test:next`), `reference/in-app.md` | HTML adapter plays fixture-tour from `?showcase=` (synthetic, sessionStorage, 3 page loads); reload mid-tour resumes, each write once; vendoring twice no diff (next/react/html); vendored types compile strict + EOPT + NUIA, skipLibCheck off; Next fixture `next build` ✔, plays on 1 document load; `film --in-app --strict` green (18.9 s, motion gap 21.2 ms, −16.1 LUFS, A/V 30 ms, navs spa only); npm test 233/233; typecheck (4 projects) | Fixed a host bug: SPA `nav` events took seqs the page reused (injected films of SPA apps too); declarations vendored as `.d.mts` + `types/`; tours published to `<public>/showcase/tours/`; Next e2e kept out of `npm test` |
| 11 | S1 · The skill and integration | ✅ | `skills/showcase/SKILL.md` (158 lines, `disable-model-invocation`), `reference/{determinism,roadmap-brief}.md` + `interview.md` finished, `voice.md` keys + cost, `templates/BRIEF.md`, `brief [--check]` (`lib/brief.ts`, `commands/brief.ts`, `test/brief.test.ts`), `evals/` (4 cases + `run.sh`), marketplace entry + plugin 0.9.0, README section, runtime rebuilt at 0.9.0 | validate ✔ (plugin, marketplace); `bash evals/run.sh --max-cost-usd 2` green: with 1.00 on all 4 cases, baseline 0.00–0.67, mean Δ +0.75, $0.50; headless `/showcase:showcase doctor` from a fixture copy ✔ with `Base directory …/plugins/showcase/skills/showcase`; npm test 237/237, typecheck ✔ | `plugin details` shows ~132 tok but ignores the flag (A/B); direct check: not in the model's listing. Eval via wrapper (dependency + PATH) |
| 12 | P1 · Star I: the film and live demo (by hand) | ✅ | Star `showcase/` (config, `star-pitch` tour, storyboard, 14 Charon clips + manifest, schemas) + ignore lines, Star commit `e171968`; plugin fixes: `host/{app,project,inspect,auth}.ts` (snapshot kept), `runtime/src/anchors.ts` (names join text), `runtime/src/index.ts` (heartbeat re-arms after a page load), `lib/tours.ts` `playHash` + `host/rehearse.ts` + `film/verify.ts` (approval ≠ stale), `voice/{audio,keys}.ts` (RMS trim, 20 ms pre-roll, chain 3), `runtime/src/narrative.ts` + `commands/check.ts` (T008 times voiced sentences by their clips), 6 new tests, 243 in all | rehearse 5/5 clean (6/6 beats, deny clean); `film --strict` green: `star-pitch.mp4` 58.6 s, 1757 frames, 60 fps capture, motion gap 24 ms, A/V 26.7 ms, −16.1 LUFS, 14 cues; renders A/B/final: same 14 cue texts, timecodes within 31 ms (A–B), 34 ms, 6 ms; user approved Round 5 and watched the live demo; npm test 243/243, typecheck (4 projects), plugin validate ✔ | 1:00 pitch for executives (champion); narrator Gemini 3.8 Flash TTS "Charon" (gods-eye's), saved as the default; 1,129 characters voiced; friction: 6 plugin bugs found on Star and fixed (see log) |
| 13 | P2 · Star II: the in-app tour, then the release (by hand) | ✅ | Star's in-app tour (in Star's working tree, not committed): vendored `src/showcase/` (runtime + `ShowcaseTour.tsx`), `public/showcase/{tours,voice}/`, the "Take the tour" `<Link>` in the Overview hero, the copilot hidden during a tour; plugin fixes: `runtime/src/capture-inject.ts` + `dist/showcase-capture.iife.js`, `host/launch.ts`, `runtime/adapters/{next,react,html}`, `runtime/src/{anchors,inspect}.ts`, `reference/{in-app,tour-format}.md`, 2 new tests + 1 Next e2e; release: plugin 1.0.0 with `defaultEnabled: false`, README, `.gitignore`, tags `showcase--v1.0.0` (`ec249e8`) and `planning--v1.8.0` (`15887b3`) | npm test 245/245; typecheck (4 projects); `npm run test:next` 4/4, with `film --in-app --strict` green on the Next fixture; `claude plugin validate` ✔ (plugin, marketplace); both tags exist; installed from GitHub here: 1.0.0, user scope, switched off; the user confirmed the Star in-app tour approved (2026-10-11) | Pushed to `origin` (main + both tags). **Not pushed to `GITLAB`**: its hostname didn't resolve from this network (see open items). Star's own gates and Star's `film --in-app --strict` were not re-run in the release session, and Star's in-app work is uncommitted, by the user's choice |

Legend: ⬜ Not started · 🟡 In progress · ✅ Done · ⛔ Blocked

## Open items / blockers

- [x] **`OPENROUTER_API_KEY` in the user key file**: set by the user with `showcase keys set --force` in Session 12 (the gods-eye key had expired); `keys test` ok. Was: (`~/.config/showcase/.env`).
  - Ready now (Session 1 ✅): give your go for `showcase keys import ~/_PRJ/gods-eye/.env.local`, or run `plugins/showcase/bin/showcase shim`, then `showcase keys set` in your own terminal. Check it with `showcase keys status` and `showcase keys test`.
  - Session 6's live audition was skipped for want of it (the page and pipeline were proved with the fake and mocked fetch); run `showcase voice <tour> --audition --yes` once it is set. Session 12's final voice needs it too. The draft voice covers everything else.
- [x] **Review notes for Session 9** (look and feel): approved as-is (2026-10-09).
- [x] **Your availability** for the by-hand Sessions 9, 12 and 13: all three run.
- [x] **The go to push** `main` and the tag `showcase--v1.0.0` to `origin` and `GITLAB` (Session 13): given 2026-10-11. `origin` is pushed.
- [ ] **Push to `GITLAB`**: `gitlab.devopstools.tech` didn't resolve on 2026-10-11 (off the VPN, most likely). Once it is reachable: `git push GITLAB main --tags`. `GITLAB/main` is still at planning v1.7.0 (`b3729b1`).
- [ ] **Star's in-app tour is uncommitted** in `~/_PRJ/star` (and Star is ahead of its three remotes). Left as it is by the user's choice; run Star's lint, typecheck and build before committing it.

## Review notes

### Look and feel (read by Session 9)

**Approved as-is** (2026-10-09, Session 9): no notes. See PLAN §3 "Review notes — look and feel".

### Star film and live demo (Session 12, gathered in the session)

The user's answers and approvals (2026-10-09):

- **Round 1:** film + live demo (set by the roadmap; the in-app tour is Session 13); afterwards *champion it*; kind *pitch*; about 1 minute.
- **Round 2:** audience *executives*; takeaway "Every working session becomes a visible, searchable record of value delivered, at no extra effort"; moments *portfolio at a glance* and *search across everything*; data *a frozen snapshot*.
- **Round 3:** narrator "the same voice that we decided on for gods-eye" (gods-eye `film/voice.json`: `google/gemini-3.8-flash-tts`, voice `Charon`), so no audition; UK English; **never on screen: nothing sensitive**, so `privacy.deny` is empty (Star's DB is redacted at write time). This departs from the prompt's "privacy.deny for names and hostnames", by the user's choice; `rehearse` still scans and reports clean; built here, now.
- **Round 4:** storyboard approved, voice and film it.
- **Round 5:** approved as final, no notes; Charon + en-GB saved as the default for every repo (`defaults.json`).
- **Live demo:** watched, all good. **Star commit:** given (`e171968`, not pushed).

### Star in-app tour and release (Session 13, gathered in the session)

The user's decisions (2026-10-11, the release session):

- **The in-app tour on Star: approved.** The entry point is the "Take the tour" `<Link>` in the Overview hero (`/?showcase=star-pitch`), as Star's working tree has it.
- **Release scope:** cc-star-skills only. Star stays as it is: nothing committed or pushed there.
- **Showcase installs switched off** (`defaultEnabled: false`) and is turned on per project; planning keeps loading everywhere.
- **The go to push** to `origin` and `GITLAB`: given.

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

### Session 6 — V1 · Voice (2026-10-09) ✅

Runtime: sonnet/high (autopilot attempt 1)

- **Landed:**
  - `toolkit/voice/`: `tts/{openrouter,say,fake}.ts`, `types.ts`, `pool.ts`, `keys.ts`, `lexicon.ts`, `audio.ts`, `manifest.ts`, `setup.ts`, `pipeline.ts`, `audition.ts`, `catalogue.ts`;
  - the commands `voice` (`--draft --final --check --yes --max-chars --redo --prune --dry-run --audition`) and `voices --list [--model]`;
  - `skills/showcase/reference/voice.md`;
  - `host/project.ts › voiceFor` now looks for `<voice.dir>/<tour>.manifest.json` first, then a hand-made `manifest.json`;
  - 35 new tests (192 in all): provider (mocked fetch), lexicon, catalogue, pipeline (real ffmpeg, fake provider), audition, and the CLI.
- **Gate:** all checks passed except the live audition:
  - `npm test` 192/192, `npm run typecheck` over four projects, `claude plugin validate` ✔; the runtime is untouched, so `dist/` and its stamp are unchanged;
  - the fake provider runs through real ffmpeg: every draft clip measures mono, 24 kHz, −16 ± 1 LUFS (ebur128);
  - mocked fetch: format memory (per model, wav → mp3 → pcm), 429 with `Retry-After` and then 1/3/9 s, a thrown-fetch and a timeout retry, 401/403/402 neither retried nor echoed (body never read), a 400 body that echoes the key is redacted, and the canary key is in no output, report, file or request body;
  - editing a sentence flips `--check` to missing (exit 1); changing a post setting makes every clip stale and re-processes from the raw cache with no new synthesis; `--prune` then removes exactly the orphans;
  - at most three requests are ever in flight (a peak of exactly 3 in the test);
  - **The live audition was skipped: `keys status` shows `OPENROUTER_API_KEY` unset.** The audition path itself is tested with a mocked fetch (nine voices, 1,500-character budget, `--yes` required, cached rerun costs nothing, voices the catalogue lacks skipped unspent), and `voice --audition` without the key wrote the page with the draft voice, nothing sent.
- **Auditioned voices:** none yet (no key). The shortlist is in `audition.ts`, checked against the live catalogue on 2026-10-09 (`voices --list`: all nine offered): `elevenlabs/eleven-v3` george, daniel, alice, lily; `microsoft/mai-voice-2.1` en-GB-Harry and en-GB-Emily (the catalogue's names carry a `:MAI-Voice-2.1` suffix); `google/gemini-3.8-flash-tts` Charon, Orus, Kore.
- **Deviations and small choices:**
  - **The manifest is per tour: `<voice.dir>/<tour>.manifest.json`.** The runtime's draft shape (`{v, id, tour, clips[]}`) holds one tour, and tours share a clips directory. It is extended with `narrationMs`, `voices`, `post` and, per clip, `n`, `take`, `synth`, `voice` and `spoken`; the runtime reads only the fields it had. PLAN §2.10, §5 Session 5 and the fixture lookup follow. `protocol.ts`'s comment still says "a draft"; I left it so the runtime stamp stays fresh.
  - **`--max-chars` caps characters sent in a run**, not per sentence (the Compass check was per sentence). The default is 20,000 (or `voice.maxChars`); `--audition` defaults to 1,500.
  - **Staleness has two halves:** the synth key and the expected file name (which carries the post settings). `POST.chain` is bumped whenever the ffmpeg chain itself changes.
  - **Modes:** a plain `voice` keeps clips that are already current, even narrator clips with no key, and voices only what is missing as a draft (with a warning). `--check` accepts either voice unless `--final`.
  - **A rejected key (401/403) or no credits (402) stops the queue**, so nothing more is spent; sentences already done stay cached.
  - **The raw cache** is `showcase/.cache/tts/` (already ignored by `init`), else `~/.cache/showcase/tts/`; it includes `formats.json`.
  - **No narrator by default:** `voice.narrator` is chosen from the audition and written to the config by the user (or by the skill in Round 5). `--final` says so when it is missing.
  - **Pacing:** sentences under four words aren't judged for wpm. The `say` draft runs fast (up to ~250 wpm on short lines), so the table's warnings on a draft are a guide only; `voice.md` says so.
  - Added no dependencies. `voice` doesn't touch `check`'s rules; the storyboard/voice currency line in `check` (PLAN §2.2) is left for Session 8's verify.
- The plan dir's `autopilot/` run logs were again left uncommitted.

### Session 7 — F3 · Film I: capture and video (2026-10-09) ✅

Runtime: opus/high (autopilot attempt 1)

- **Landed:**
  - `toolkit/film/`: `record.ts` (the take: lifecycle, arming, probe, pre-roll, watchdog, tail, measuring, encoding, the checks), `capture.ts` (main-thread screencast, event-loop monitor, quiet detection, hand-off to the worker), `capture-worker.ts` (a raw CDP WebSocket in a worker thread), `frames.ts` (the bounded queue), `cfr.ts` (schedule, gaps, frame rate), `timeline.ts` (spans on the video's clock), `encode.ts` (hard-linked CFR sequence → x264, ffprobe, patch colours);
  - the command `film <tour> --video-only [--detach] [--capture auto|main|worker] [--keep-frames] [--out] [--base] [--no-build] [--no-reset]`;
  - `runtime/src/film-aids.ts` and `__showcase.film` (`probe`, `heartbeat`, `frameRate`), with `dist/` rebuilt and restamped;
  - `host/launch.ts`: an `args` option, and `rendererOf` and `isSoftwareRenderer` exported (the `gpu: "required"` check uses them);
  - 13 new tests (205 in all): `test/film/cfr.test.ts` (schedule, gaps with the nav exemption, frame rate, spans, the sink's delayed acks, build guidance), `test/film/encode.test.ts` (real ffmpeg: tags, CFR, keyframes, a colour round trip, probe colours) and `test/film.test.ts` (end to end: the fixture tour with `--detach` through `progress.json`, a short tour with `--capture worker`, the usage error).
- **Gate:** every check passed.
  - The fixture tour, filmed from `toolkit/fixtures/showcase/`: ffprobe 1920×1080, `r_frame_rate` = `avg_frame_rate` = 30/1, H.264 High, yuv420p, `color_space`/`color_transfer`/`color_primaries` bt709, `color_range` tv, 1,209 frames.
  - Largest motion gap 22.3 ms (one page-load hold of 33.8 ms exempt, S-D4); sync probe 19.7 ms; video 40.300 s against a timeline of 40.289 s (within one frame).
  - After the run, `pgrep` found no Chromium (by marker), no ffmpeg and no fixture server, and the lock was gone. The end-to-end test checks the same.
  - `npm test` 205/205, `npm run typecheck` (4 projects), `claude plugin validate` ✔.
- **Measured** (five clean takes on the fixture tour, M4 Max, ANGLE Metal): capture median 60 fps, p5 59–60; the page's own rate 60 fps with no stalls; largest motion gap 20–27 ms; sync probe 18–21 ms; event-loop p99 11.6–11.7 ms (worst one-second window 11.9 ms), so the worker never took over in auto mode; the queue never went above 1, with no delayed acks; about 4.9 MB/s of JPEG (≈250 MB of frames per 40 s take, deleted after the encode); `video.mp4` about 2 MB.
- **Deviations and small choices:**
  - **The heartbeat.** The screencast only sends a frame when something changes, so on a still screen "the largest gap" would mean nothing. From the pre-roll, a 1 px element flips between opacity 0 and 0.01 every animation frame, so Chrome makes a frame on every vsync and any gap is a missed frame. Nobody can see it (checked on a contact sheet). Later documents pick it up at boot from `window.__showcaseRolling`, an init script the host adds at the pre-roll. It also gives the page's own frame rate and its stalls (animation frames more than 50 ms late), which are in `timeline.json` to tell a page that froze from a capture that dropped frames.
  - **The probe runs before the pre-roll**, so its full-screen magenta flash is never in the video. It's found by the mean colour of a 32×32 patch near the top-left corner, clear of the pointer.
  - **Time 0 of the video is the start of the pre-roll** (the host's `Date.now()`); the video ends 1.2 s after `film:end`; the CFR schedule has `round(duration × 30)` frames, so the duration matches by construction, and ffprobe confirms it.
  - **Arming:** the host's 400 ms with no new frames is capped at 5 s (3 s after the probe). The fixture's spinner and canvas never stop, so the fixture always hits the cap, and the film notes it.
  - **The nav exemption** covers a gap that contains a `nav` load, counting from up to 100 ms before the gap starts. `navGaps` lists only holds longer than one video frame.
  - **The worker fallback** needs `--remote-debugging-port`, so the film adds it on a free loopback port unless `--capture main`. In auto mode a one-second window with event-loop p99 > 20 ms hands capture to the worker; the main screencast stops once the worker has a frame, and frames from both are merged by timestamp. `--capture worker` forces it, which is how it's tested.
  - **Colour:** the `-color_*` output options alone tagged the matrix and range but left transfer and primaries unset, so the filter ends with `setparams`. A test round-trips saturated colours through a BT.601 full-range JPEG and back through the BT.709 limited video (within 4 levels; reading it as BT.601 is visibly off).
  - **Names:** the picture is `out/<id>/video.mp4`; Session 8 muxes it into `<id>.mp4`. `film` without `--video-only` exits 2 until Session 8. The film runs `app.build` by default (PLAN §2.2) and notes a `start` that looks like a dev server, or a missing `app.build`.
  - `timeline.json` also carries `checks` (size, cfr, codec, colour, frames, duration, motion-gap, sync-probe, order, keyframes), and `film` exits 1 if any fails, as a start on Session 8's verify. x264 adds scene-cut keyframes beyond the beat starts; the check only asks that every beat start has one.
  - The end-to-end tests film a scratch copy of the fixture project, so they never meet the rehearse tests over the fixture project's lock (`node --test` runs files in parallel).
  - **Two one-offs, not reproduced:** the session's very first take had one 193 ms gap at the first click (before the stall diagnostics existed). In the first full `npm test` run, the worker test also failed, at the same time as the other film test failed on a sentence count I had wrong in the test. That failure's message wasn't kept. Five later takes and three later full runs were clean. If either comes back, `capture.pageStalls` will say whether the page or the capture stalled.
  - Added no dependencies (Node's own `WebSocket` and `worker_threads`).
- The plan dir's `autopilot/` run logs were again left uncommitted.

### Session 8 — F4 · Film II: sound, captions, outputs and verify (2026-10-09) ✅

Runtime: opus/medium (autopilot attempt 1)

- **Landed:**
  - `toolkit/film/mix.ts`: the Node mixdown (each clip decoded once to f32 48 kHz, placed at `sentence:start − t0`, summed into a float WAV exactly the video's length), two-pass loudnorm (−16 LUFS, TP −1.5, LRA 11) then `aresample=48000` to stereo, ebur128 measuring, 10 ms levels, inner-silence and onset finders;
  - `toolkit/film/captions.ts`: ASS (bundled font via `fontsdir`, pre-wrapped with `wrapCaption`, DRAFT watermark on drafts) and SRT from the same cues, `parseSrt`, `srtProblems`;
  - `toolkit/film/script.ts`: ffmetadata chapters (one per beat, tiling the film) and the timecoded `script.md`;
  - `toolkit/film/post.ts`: draft-or-final (`voiceInfo`), the caption cues, `.post/` (mix, audio, ASS, chapters, font), the SRT;
  - `toolkit/film/verify.ts`: the §2.5 checks (ok / warn / fail), caption-against-sound measurement, faststart, master probe, stills + `contact-sheet.png` (ffmpeg `tile`), `report.json` + `report.md`, the rehearse deny-list state;
  - `encode.ts`: `runTool` gains `stderrToo` and `cwd`; `masterArgs` (captions burned in after scaling, AAC 192k 48 kHz stereo, chapters, faststart); the picture and the master encode side by side from the same CFR links;
  - `record.ts`/`commands/film.ts`: `film <tour> [--strict]` makes the finished film; `--video-only` keeps Session 7's behaviour; `--strict` with `--video-only` is a usage error; progress phases add `mixing` and `verifying`;
  - `toolkit/fonts/AtkinsonHyperlegible-Bold.ttf` + `OFL.txt` (SIL OFL 1.1, from google/fonts);
  - fixtures: `app/sync.html` (one click turns the page green) and `showcase/tours/sync-tour.json` (an intro sentence, then a click and "Flash, and beep." after it), with its storyboard; `serve.ts` lists the page;
  - `skills/showcase/reference/film.md`;
  - tests (224 in all, 205 before): `test/film/{captions,mix,verify}.test.ts` (pure parts plus real-ffmpeg loudnorm and WAV round trip) and `test/film.test.ts` (both tours, voiced and rehearsed, filmed `--strict` with the fake voice and with `say`; SRT, loudness, sync, flash, outputs, nothing left behind).
- **Gate:** every check passed.
  - `film --strict` green (no warning, no failure) on `fixture-tour` and `sync-tour`, with the fake voice and with `say` (in `npm test`, and by hand in scratch copies).
  - The SRT cues equal the tour's sentences (10 and 2), checked by verify and by the test.
  - Caption and sound on the beep beat: fake −26.7 ms, `say` +3.3 ms (sound minus caption); every measured sentence within 50 ms on every film. The page's flash came 26.7 ms (fake) and 30 ms (`say`) after the sound's onset.
  - Loudness of the master: −16.0 (fake) / −16.1 (`say`) LUFS integrated, true peak −13.6 / −4.3 dBTP; sync-tour −15.8 LUFS.
  - Read back `contact-sheet.png` and the 8 stills of the `say` fixture film against `report.md`: open (title card + its sentence), revenue (spotlight on "Revenue is tracking 4% ahead" + "On plan" callout), invite (dialog, "Add as editor" spotlit with the Roles callout), close-invite (dialog gone), list (the report list spotlit), detail (the Pipeline heading spotlit, owner shown) and close (end card) all show what the sentence says. Two soft ones for Session 9: **cookies** — the still (taken just before the sentence ends) shows the notice already accepted, because the click runs at the beat's start; **detail** says "the trend" while the fixture's chart is a spinner. The DRAFT watermark sits over the fixture header's "Account" link.
  - `npm test` 224/224 (4 min 10 s), `npm run typecheck` (4 projects), `claude plugin validate` ✔; no Chromium, fixture server or ffmpeg left.
- **Deviations and small choices:**
  - **The master is encoded from the frames, not re-encoded from `video.mp4`** (Session 7's note said Session 8 would mux `video.mp4`): burning captions in needs a video encode anyway, and one generation keeps text sharp. Both encodes run side by side from the same hard-linked CFR sequence; `video.mp4` stays as the clean picture, which the sync check compares the master's caption band against.
  - **A voiced caption starts at its sentence's start plus the clip's lead** (`post.leadMs`, 30 ms of silence at each clip's head; 0 for a hand-made manifest). With the caption at the bare sentence start, `say`'s beep measured 46.7 ms, too close to the limit; with the lead it's 3.3 ms. The SRT uses the same cues.
  - **Draft or final:** draft unless every sentence has a narrator clip and `voice.narrator.approved` is set. A draft writes only `<tour>-draft.mp4` (watermarked) and removes any `<tour>.mp4`, and vice versa, so a draft can't be mistaken for the final cut. Being a draft is reported, not a warning, so `--strict` can pass on a draft voice.
  - **Levels:** failures (exit 1 always): Session 7's picture checks, `srt`, `audio` (AAC 48 kHz stereo), `faststart`, `chapters`, and a deny-list hit. Warnings (exit 1 only with `--strict`): `duration-target`, `loudness`, `true-peak`, `silence`, `av-sync`, `voiced`, and a missing or stale rehearse.
  - **Duration tolerance:** within `meta.length.targetSec` ± max(5 s, 10 %). The fixture tour's target moved from 60 to 40 s (its films run 36.8 s with `say`, 39.0 s with the fake), and its storyboard was regenerated.
  - **Silence** counts only between the first sound and the last (the pre-roll lead-in and the end card's hold aren't gaps), at −45 dBFS over 10 ms windows.
  - **Caption-against-sound:** measured in the master for each caption that follows a blank: the first frame whose caption band (1600×200 at the bottom, downscaled) differs from `video.mp4`'s by more than 3 levels, against the first non-silent 10 ms of the master's own decoded audio from 50 ms before the sentence. Back-to-back captions aren't measurable that way and are skipped.
  - **Stills** come from the master (so the caption and watermark show) just before each beat's last sentence ends; the contact sheet is 4 across at 480 px.
  - **Caption style:** Atkinson Hyperlegible Bold (chosen for legibility; OFL), 46 px on 1080 lines, white on a 60 %-opaque dark box (`BorderStyle 3`, so each line gets its own box), bottom centre, 64 px up; `WrapStyle 2`, so only `wrapCaption` breaks lines. Watermark: "DRAFT", 64 px, half transparent, top right.
  - Loudnorm's second pass asks for linear mode; ffmpeg fell back to dynamic on the fixture mixes and still landed within 0.2 LU of −16.
  - **Crossfades at `nav`** were not needed: no flash on the fixture's two page loads (S-D4 holds); the motion-gap exemption from Session 7 stays.
  - **The fixture film for Session 9** is in `plugins/showcase/toolkit/test/.out/s8-fixture/` (ignored): a copy of the fixture project with `voice.draft.provider: "say"` and an absolute `app.start`, plus a `git init` so tour ids resolve. Regenerate with `showcase voice fixture-tour --draft && showcase rehearse fixture-tour && showcase film fixture-tour --strict` from that directory.
  - Added no npm dependencies; the font is a bundled asset (64 kB).
- The plan dir's `autopilot/` run logs were again left uncommitted.

### Session 9 — R1 · Checkpoint: look and feel (2026-10-09) ⛔

Runtime: opus/high (autopilot attempt 1)

- **Stopped at once, by design** (PLAN §4 checkpoint protocol, D14): Session 9 is run by hand, and this was a headless autopilot run with no way to ask. Row 9 set to ⛔ `Needs decision: run Session 9 interactively …`; no code changed.
- Checked before stopping: Session 8 is ✅; the fixture film exists (`plugins/showcase/toolkit/test/.out/s8-fixture/showcase/out/fixture-tour/fixture-tour-draft.mp4`, 2.6 MB, with contact sheet, SRT and rehearse output beside it); `Review notes › Look and feel` is still empty.
- **To resume:** run `/session .planning/showcase-plugin` interactively (started with `claude --add-dir ~/_PRJ/gods-eye`). It asks the checkpoint question (Approve as-is · I have notes · A different narrator style · A different caption style), sets row 9 to 🟡 and carries on. Session 8's two soft points are worth a look in the review: the **cookies** still shows the notice already accepted, and **detail** says "the trend" over a spinner; the DRAFT watermark covers the fixture header's "Account" link.
- The plan dir's `autopilot/` run logs were again left uncommitted.

### Session 9 — R1 · Checkpoint: look and feel, by hand (2026-10-09) ✅

Runtime: opus/high (interactive)

- **Checkpoint resolved interactively.** `/session` turned row 9's ⛔ `Needs decision:` into the question. Ran `showcase watch fixture-tour --detach` from `toolkit/test/.out/s8-fixture/` (it played to the end card, `ended: finished`), and pointed the user to the fixture film, contact sheet, report, `reference/interview.md` and `reference/narrative.md`. The user chose **Approve as-is**, so there are no notes, no change of narrator or caption style, and **an empty checklist**. Recorded in PLAN §3 "Review notes — look and feel" and under Review notes › Look and feel.
- **No code changed.** Session 8's soft points (the cookies still, "the trend" spoken over the fixture's spinner, the DRAFT watermark over "Account") were not raised, so they are left as they are.
- **Gate:**
  - Re-rendered with `showcase voice fixture-tour --draft && showcase rehearse fixture-tour && showcase film fixture-tour --strict` (say voice).
  - The first run failed only `motion-gap`, at 235.6 ms against the 100 ms limit (`MAX_MOTION_GAP_MS`, `toolkit/film/record.ts`). It ran alongside `npm run typecheck`, with load average about 9 and the endpoint-security agents (Traps `pmd`, ManageEngine) busy.
  - A second run on its own also failed, at 147.4 ms, at a different point in the film.
  - A third run on its own passed every check: largest gap 21.3 ms, sync probe within limits, A/V sync 16.7 ms over 8 sentences, −16.1 LUFS, 1105/1105 frames, SRT 10 = 10 sentences.
  - Judged a host capture stall, not a regression: no code changed, the stall moved between runs, and the clean run matches Session 8's numbers.
  - `npm test` 224/224 (run alone); `npm run typecheck` exit 0.
- **Watch for this:** the motion-gap check is sensitive to host load from the endpoint-security scanners, and `film.test.ts` runs `film --strict` too. Sessions 12 and 13 should render on a quiet machine and not alongside typecheck or tests. A failing motion-gap whose position moves between runs is load, not the tour.
- The plan dir's `autopilot/` run logs were again left uncommitted.

### Session 10 — I1 · The in-app path (2026-10-09) ✅

Runtime: opus/medium (autopilot attempt 1)

- **Landed:**
  - `toolkit/runtime/src/in-app.ts`: the namespaced deep link (`readDeepLink`, `deepLink`, `withoutShowcaseParams`, `wantsShowcase`), the served paths under `base` (`tours/`, `voice/`, `assets/`), the router hop (`routeTo`: pushes again every 2 s until the URL is the step's, fails after 10 s, as Compass's runtime does) and `syntheticGaps` (what synthetic input can't do, or may not);
  - `runtime/src/index.ts`: `startInApp(adapter)` and the `Adapter` type (`navigate`, `reset`, `beforeStart`, `actions`, `base`, `speed`, `onExit`). A deep link starts afresh (from `showcaseStep` if given) and takes its parameters off the URL; with no link it resumes the tab's saved run, else does nothing. Synthetic input only, sessionStorage state (the host's when `film --in-app` binds), muted voice played from `<base>/voice/`, uploads fetched from `<base>/assets/`, Esc and close end the tour and remove the overlay. Once per document (React strict mode calls it twice). `audio.ts` takes a `clipUrl`;
  - `runtime/adapters/`: Next `ShowcaseTour.tsx` (`"use client"`, `next/navigation`, dynamic `import()` only when `?showcase=` or a saved run) plus `showcase-adapter.ts` (the app's part, written once, never overwritten); React `ShowcaseTour.tsx` with a `navigate` prop; HTML `snippet.html` (`<script type="module">`);
  - `toolkit/lib/vendor.ts` + `commands/runtime.ts`: `showcase runtime vendor [--framework next|react|html] [--to] [--public] [--json]`. Copies `showcase-runtime.mjs` (first line stamps version and source hash), `showcase-runtime.d.mts` and `types/`; writes the adapter; publishes every valid tour byte for byte to `<public>/showcase/tours/`; sets `voice.dir` to `<public>/showcase/voice` (copying clips already voiced). Writes only what changed;
  - `film --in-app`: opens `?showcase=<id>&showcaseMode=film` on the first step's path with nothing injected (`launchHost({ inject: false })`), and refuses a tour the app serves a stale copy of (`publishedTourProblem`);
  - `rehearse --synthetic`: the report gains `synthetic` (each gap, `cannot` or `check`); a `cannot` is a problem, `check`s are listed;
  - `toolkit/fixtures/next/`: a minimal app-router app (Next 16.4.0, React 19.3.0, TypeScript 5.9.3 pinned; strict + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`) with the `next-tour` tour (home → projects via a `Link` click → settings via the router), its config and storyboard. `fixtures/next-fixture.ts` copies it into `~/.cache/showcase/fixtures/next-<hash>/`, installs there once, `git init`s it;
  - `fixtures/serve.ts` takes a `root` and serves `.mjs`, `.json` and `.mp3`;
  - `skills/showcase/reference/in-app.md`;
  - tests (233 in all, 224 before): `test/in-app.test.ts` (deep link, router hop, gaps, vendor for all three frameworks twice with no diff, strict compile of the vendored types), `test/runtime/in-app.test.ts` (the HTML adapter in Chromium), `engine.test.ts` (an SPA route mid-film keeps one rising seq); `test/next/next.e2e.ts` under `npm run test:next`.
- **Gate:** every check passed.
  - The HTML adapter, vendored into a scratch copy of the fixture app with the snippet on every page, plays `fixture-tour` from `/index.html?showcase=fixture-tour` with no host bound: ends `finished` on `/detail.html` across 3 documents, no fallbacks, the params gone from the URL, no state left.
  - A reload mid-tour (after the cookie write) resumes from sessionStorage: "Accept cookies" and "Invite people" each clicked once; the loads were the link, the reload (link gone), `/list.html`, `/detail.html?id=3`; a later plain page load leaves the runtime unloaded.
  - Vendoring twice gives no diff (Next, React, HTML; the app's edited `showcase-adapter.ts` kept), and the vendored `.d.mts` + types compile under `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `skipLibCheck: false`.
  - Next fixture: `next build` passes (TypeScript checked under both flags); the deep link plays to `/settings` with `router.push` and a `Link` click on **one document load** (1 `load` event, a window marker survives), journal `projects/add/add-it`, `settings/digest/digest-on`, no 4xx.
  - `film next-tour --in-app --strict` green: 18.9 s for a 20 s target, 568 frames, largest motion gap 21.2 ms, −16.1 LUFS / −4.4 dBTP, A/V sync 30 ms, SRT 5 = 5, `nav` events `spa /projects`, `spa /settings` only, order clean. Read back `contact-sheet.png`: welcome (nav spotlit), the menu sentence, "It joins the list" with Launch plan in the list, the digest checked with "every Monday" — each still shows its sentence.
  - `npm test` 233/233 (one earlier full run failed only `film.test.ts`'s motion gap under load; that file alone, then the whole suite again, passed), `npm run typecheck` (4 projects), `npm run test:next` 3/3 (55 s with the install cached).
- **Deviations and small choices:**
  - **A host bug fixed:** host-emitted `nav` events (SPA routes) took sequence numbers the page then reused, so `filmOrderProblems` failed on any film with an SPA route — injected films too, which Session 12 (Star, Next) would have hit. The host now shifts the page's events past its own until the page next loads its state.
  - **Declarations are `.d.mts` plus a `types/` folder**, not one `.d.ts`: TypeScript reads an `.mjs` file's types only from a `.d.mts` beside it, and `tsc` emits one declaration per module.
  - **Tours are published** to `<public>/showcase/tours/` by `runtime vendor` (byte copies; run it again after editing a tour); the runtime fetches `<base>/tours/<id>.json` and `<base>/voice/<id>.manifest.json` (else `manifest.json` naming the tour). `base` defaults to `/showcase`.
  - **Defaults for `--to`:** `src/showcase`, else `components/showcase`; for HTML `<public>/showcase`. `--public` defaults to `public` (HTML without one: the repo root). The Next adapter is a default export; React exports both.
  - **Reload vs new link:** a deep link removes its parameters with `history.replaceState`, so a reload resumes and a fresh link restarts. `reset` runs only on a fresh start; `beforeStart` on both.
  - **In-app voice starts muted** on every start and resume (the browser needs the viewer's click for sound).
  - **The Next end-to-end stays out of `npm test`** (`npm run test:next`): it installs Next on first use and builds a real app, which would load the machine under the film tests' motion-gap checks. The HTML adapter test is in `npm test`.
  - `next-tour` has narration/beat overrides in `meta.length` like the other fixtures, and `targetSec` 20 (its films run 18.9 s). `say`'s pacing warnings on two short sentences were left (warnings only).
  - Added no runtime or dev npm dependencies to the plugin (C2); the Next fixture's own pinned dependencies live only in the cache.
- The plan dir's `autopilot/` run logs were again left uncommitted.

### Session 11 — S1 · The skill and integration (2026-10-09) ✅

Runtime: opus/high (autopilot attempt 1)

- **Landed:**
  - `skills/showcase/SKILL.md`: frontmatter (`name: showcase`, a 322-character description, the `argument-hint`, `allowed-tools`, `disable-model-invocation: true`); routing by `$ARGUMENTS` (keys, watch, film, review, brief, in-app, doctor); phases P0–P11, each naming its reference doc ("pull the exact contract from the reference"); the headless rule (print the round, stop, before any preflight); the Rules from PLAN §2.9.
  - `reference/interview.md` finished: the rounds kept word for word (approved in Session 9), the three explorer briefs as quotable prompts with fixed report shapes, the 15-line summary, the answer → file map (with "What else" and "Where"), `defaults.json`, skip rules, and the headless print format.
  - `reference/determinism.md` (the take lifecycle, the levers table, data, randomness and time, live AI, fonts, sign-in, what the host handles, privacy, a checklist) and `reference/roadmap-brief.md` (when P5 goes to a roadmap, `showcase brief`, what each BRIEF section holds, the checkpoint protocol, roadmap sessions using the CLI and `showcase docs`).
  - Consistency: `voice.md` gains Keys (file, precedence, commands, Claude's rules) and Cost; `film.md` gains `--in-app`, the determinism prerequisite and the foreground polling note; `tour-format.md` the storyboard's `--stills`/`--html`. Checked: every schema kind and predicate is in `tour-format.md`, and T001–T015 match `check --help`.
  - `templates/BRIEF.md` and `showcase brief [--check]` (`lib/brief.ts`, `commands/brief.ts`): the template with two generated blocks (`tours`: kind, takeaway, budget, now, rules, `check`, storyboard, rehearse, narrator, voice status via `plan()`, film report, final cut; `app`: commands, env names only, snapshot/reset, clock, browser, counts, sign-in, determinism levers ✓/✗). Hand-written sections are kept; same state, same bytes. `test/brief.test.ts` (4 tests, canary included).
  - `evals/`: `keys-status-canary`, `headless-round-1`, `storyboard-file`, `brief-file`, plus `evals/run.sh`.
  - Integration: `marketplace.json` showcase entry (0.9.0, MIT) and top-level description; `plugin.json` 0.9.0 with the final description; README overview row, `## The showcase plugin` (subcommands, Which one?, requirements, key, CLI and shim, footprint, roadmap and checkpoints, cost), install/update lines, Layout tree, "Developing the showcase plugin"; `.gitignore` keeps Session 1's lines and adds `plugins/showcase/evals/results/`. `runtime/dist` rebuilt (it stamps the version; `bundle.test.ts` caught the bump).
- **Gate:** every check passed, one by substitute evidence (below).
  - `claude plugin validate plugins/showcase` ✔ and `claude plugin validate .` ✔.
  - Evals: `bash evals/run.sh --max-cost-usd 2` exit 0 — with-plugin 1.00 on all four cases; without 0.00 (brief, storyboard), 0.33 (Round 1, 2 runs), 0.67 (keys: only the "set from environment" line fails); mean Δ +0.75, $0.50, 63 s. The Round 1 output listed all four questions with options, the settled answers, and `/showcase pitch 2min film+demo decide`; no Agent call, nothing written.
  - Headless `claude -p --plugin-dir <abs>/plugins/showcase "/showcase:showcase doctor"` from a scratch git copy of the fixture app (`/tmp/showcase-s11-*`): success, the doctor table explained, the session transcript shows `Base directory for this skill: /Users/kstar/_PRJ/cc-star-skills/plugins/showcase/skills/showcase` (run before and after the last SKILL.md edit).
  - `claude --plugin-dir plugins/showcase plugin details showcase`: **reports ~132 always-on tokens**, but the tool doesn't model `disable-model-invocation`: a control skill reports ~73/~74 tok with and without the flag. Substitute evidence for D18: a headless session asked to list its invocable skills prints NONE for `/showcase` and for the flagged control, and lists the unflagged control with its description. Judged the gate's intent met; noted here and in PLAN §2.9.
  - `npm test` 237/237 (233 before; run alone, 4 min 9 s), `npm run typecheck` (4 projects).
- **Deviations and small choices:**
  - **Evals run through `evals/run.sh`, not bare `claude plugin eval plugins/showcase`** (claude 2.1.285): eval runs have a sealed HOME, so the plugin's `dependencies: ["planning"]` (D12) is unsatisfiable and the plugin isn't loaded at all; the plugin's `bin/` isn't on the runs' PATH; a case's `env` may only set `EVAL_*`; macOS `/usr/bin/git` fails in the sandbox. The wrapper stages a copy without the dependency line, prepends its `bin/`, and passes `--no-publish` (the report would otherwise be published to claude.ai), `--trust-plugin` and `--allow-tools Bash`. D12 stays as it is.
  - The `claude-code-guide` agent isn't available in this environment; the case and grader format came from `claude plugin eval --help`, `eval init --bare`, and the schema in the installed CLI.
  - Cases use `model: sonnet` and 1 run (Round 1: 2 runs) to stay well inside $2 with the baseline arm.
  - `brief`'s answers come from the skill, not the CLI: the interview's answers aren't stored anywhere the CLI can read (no new footprint file), so BRIEF §1, §3, §4 (prose), §7 and §8 are the skill's to write; `brief` keeps them across runs.
  - The interview also takes "afterwards" as an argument, so arguments can settle the whole of Round 1.
  - `SKILL.md` names `${CLAUDE_PLUGIN_ROOT}/bin/showcase` as a fallback when a shell can't find `showcase`.
  - No npm dependencies added (C2).
- The plan dir's `autopilot/` run logs were again left uncommitted.

### Session 12 — P1 · Star I: the film and live demo (2026-10-09) ⛔

Runtime: opus/high (autopilot attempt 1)

- **Stopped at once, by design** (PLAN §4 checkpoint protocol, D14; `prompts/session-12.md` "Checkpoint protocol"): Session 12 is run by hand in the Star repo with the user, and this was a headless autopilot run started in cc-star-skills. Row 12 set to ⛔ `Needs decision: run Session 12 interactively …`; no code changed, nothing touched in Star.
- Checked before stopping: Session 11 is ✅ (showcase v0.9.0, commit `7ac7fb8`); `~/_PRJ/star` exists; `~/.config/showcase/.env` does not exist yet, so `OPENROUTER_API_KEY` is still unset in the user key file (open item) — the audition and the final voice in step 4 need it.
- **To resume:** `cd ~/_PRJ/star && claude --plugin-dir ~/_PRJ/cc-star-skills/plugins/showcase --add-dir ~/_PRJ/cc-star-skills`, then `/session ~/_PRJ/cc-star-skills/.planning/showcase-plugin`. It turns row 12's ⛔ `Needs decision:` into the question, sets the row to 🟡 and runs `/showcase` in Star with the user.
- The plan dir's `autopilot/` run logs were again left uncommitted.

### Session 12 — P1 · Star I: the film and live demo, by hand (2026-10-09) ✅

Runtime: opus/high

- **Run interactively from Star** (`claude --plugin-dir … --add-dir ~/_PRJ/cc-star-skills`), as the ⛔ `Needs decision:` asked: the row went to 🟡, then ✅.
- **The wizard on Star:**
  - Preflight: doctor ok. The gods-eye key imported with `keys import` had expired (401), so the user set a new one.
  - Round 1, then three Explore agents (screens, story and data, running and anchors), `init`, and `inspect` on `/` and `/search`.
  - Rounds 2 and 3, then the `star-pitch` tour from the pitch template, in 6 beats: the problem card, the overview's hero and tiles, the contribution graph, the keyword search, the top hit as value, and the one-line-story card.
  - `check`, `rehearse` ×3, `storyboard --stills --html`, Round 4, voice, film, Round 5, `watch`.
- **Determinism, config only:**
  - Build and start: `next build`, then `npx next start --port {port}`. Not standalone, because `next start` run from the repo root is what reads `config/`. Health is `/api/copilot/config`.
  - Data: `app.snapshot` copies `showcase/.cache/snapshot.db` (a `.backup` of `data/star.db`, journal DELETE) to `take.db` for every take.
  - `app.env`: `STAR_DB_PATH`, `STAR_READONLY=1` and `COPILOT_ENABLED=0`. `next start` loads Star's `.env.local`, so the copilot is pinned off.
  - Search is pinned by the step path `/search?mode=keyword`, so there's no embedding call.
  - Browser: `clock.fixed` 2026-10-09T10:00+01:00, `colorScheme: dark`.
  - Known drift: the project-card sparklines use the server's "now", which the browser clock can't reach. Only a sliver of them is on camera, and they hold steady within a day.
- **Pacing:**
  - Charon reads about 10 % faster than the reading estimate, and slows sharply at commas (two commas took one sentence to 102 wpm).
  - Five rewrites brought the voiced narration to 49.5 s, inside the 48–54 s window.
  - One sentence moved from the search beat to the results beat, so the screen shows what it says.
  - Three sentences sit at 185–187 wpm, a hair over the 185 line, after chain 3 removed 30 ms of dead air per clip. They were left as they are, because re-takes swing by ±10 wpm, and named to the user in Round 5.
- **The friction log.** Each bug was fixed in the plugin with a test that fails without the fix.
  1. **`inspect` and `auth` skipped `app.snapshot`.** They pass `reset: false`, which also dropped the snapshot. On a fresh checkout the take DB didn't exist, so the first `inspect` showed Next's "This page couldn't load" (`SQLITE_CANTOPEN`). `snapshot` is now its own option, defaulting to `reset`, and inspect and auth keep it (`determinism.md` notes this).
  2. **Accessible names split React text.** `textWithAlts` joined every text node with a space, so `{n} result{s}` read "30 result s" and a text anchor never matched. Text now joins as it is; block boxes (by computed `display`), `aria-label`s and alts are set apart.
  3. **The heartbeat never came back after a full page load.** The runtime's init script runs before the host's (`__showcaseConfig`, `__showcaseRolling`), so the boot check saw neither flag, and a still screen after any load sent no frames. The first Star film had a 10.1 s motion gap over the closing card (median 8 fps). The runtime now checks again on a native `setTimeout(0)`. The fixture films never held a still screen for long after a load, which is why this went unseen.
  4. **Recording an approval made the rehearse stale.** Verify compared the tour file's mtime. `rehearse.json` now records `tourHash` = `playHash` (the content hash without `meta.approved`), and `denyState` compares that, falling back to mtime for older reports.
  5. **Gemini clips start with a ~5 ms click, then ~240 ms of quiet.** The peak trim stopped at the click, so ask/0 spoke 220 ms after its caption (an av-sync warning).
     - Chain 2: the trim is now RMS over 20 ms.
     - Chain 3: it keeps 20 ms before the crossing, not 50. Before this, every Gemini sentence landed about 50 ms after its caption, at the edge of the gate.
     - Worst A/V went from 220 ms to 50, then to 20–27. The re-processing came from the raw cache, with no spend.
  6. **`check` T008 judged narration by the reading estimate even once voiced.** With a fast voice, the text couldn't satisfy `check` (≤ 54 s estimated) and the voice step (≥ 48 s real) at once. Voiced sentences now count by their clip (C5), and `check` shows "(voiced)" or "n/m voiced". A tour with no config still checks. `tour-format.md`'s T008 row is updated.
  - **Observations, not bugs:**
    - The `say` draft (175 wpm) reads about 15 % faster than the estimate, so draft pacing undershoots.
    - `film.log` appends across runs: read the last block.
    - `film --detach` with a `progress.json` poll reads the previous run's `failed` before the new run writes, so wait on the pid instead.
    - The plugin's guard hook matches the protected paths anywhere in a Bash command's text: an exclusion, or a heredoc writing docs that mention them. List what to include, and edit such docs with the Edit tool.
- **Gate:**
  - Rehearse 5/5 clean (8–9 s each).
  - `film --strict` green on the final cut: 58.6 s, 1757/1757 frames, motion gap 24 ms, sync probe 4.4 ms, A/V 26.7 ms, −16.1 LUFS, −4.2 dBTP, 14 cues, 6 chapters, deny-list clean, no DRAFT watermark.
  - SRTs of renders A, B and the final cut: identical cue texts, with timecodes within 31, 34 and 6 ms of each other.
  - The user approved Round 5 and watched the live demo.
  - `npm test` 243/243 (237 + 6), typecheck (4 projects), `claude plugin validate plugins/showcase` ✔; `runtime/dist` rebuilt (0.9.0, stamp fresh).
- **Star:**
  - One commit, `e171968`: the `.gitignore` lines, and `showcase/` (config, schemas, tour, storyboard, 14 clips + manifest; `voice --prune` removed 46 superseded clips).
  - `npm run redact -- --people-files` on the staged text files: 0 listed names, 0 candidates.
  - Nothing pushed. The renders, the cache (with the 155 MB snapshot) and the sign-in directory stay ignored.
- **Spend:** 1,129 characters through OpenRouter (Gemini TTS), across the first voicing and the rewrites.
- The plan dir's `autopilot/` run logs were again left uncommitted.

### Session 13 — P2 · Star II: the in-app tour, then the release (2026-10-11) ✅

Runtime: opus (the release part; the Star part ran in an earlier interactive session that wrote no log)

- **In two parts.** The in-app tour was built on Star in an interactive session that left row 13 at 🟡, with its plugin fixes uncommitted here. The release part ran on 2026-10-11 from cc-star-skills, and this entry is written from it: the Star part's steps are read from the two working trees, not from a log.
- **Plugin fixes from the Star part** (commit `75b7667`), each with a test:
  1. **`film --in-app` lost the run at a full page load.** The tab held the run state, and the recorder's fresh document had none. The recorder now holds it, and the Next, React and HTML adapters load the runtime when they see the recorder and no injected runtime. Star's search step is a plain GET form, so its tour crosses one page load.
  2. **`film --in-app` ran on the fixed clock.** The app's vendored runtime boots after the clock script. A capture-only bundle (`showcase-capture.iife.js`, from `capture-inject.ts`) now takes the real clocks first, where the injected runtime would have been.
  3. **A Next `<Link>` to the tour did nothing.** It is a soft navigation, with no document load. The Next adapter watches the URL: the first tour in a document starts in place, and a later one reloads the page first.
  4. **A `testId` anchor didn't find `data-showcase`.** It now resolves `data-showcase` first, then `data-testid`, `data-test-id` and `data-test`; `inspect` reports it too.
  - `reference/in-app.md` and `tour-format.md` say the same; the README names the entry point and what `public/showcase/` holds.
- **The release** (commit `ec249e8`):
  - 1.0.0 in `plugin.json` and the marketplace entry (0.9.0 was never pushed).
  - `defaultEnabled: false`: showcase installs switched off, and `claude plugin enable showcase@cc-star-skills --scope local` turns it on in a project. The README's install section says how.
  - `.gitignore` now keeps `.planning/*/autopilot/` local, so the run logs are no longer left hanging.
  - Tags: `showcase--v1.0.0` at `ec249e8`, and `planning--v1.8.0` at `15887b3`, which had been pushed untagged. Showcase depends on planning, so planning's releases want tags.
- **Gate:**
  - `npm test` 245/245 (243 + 2), typecheck (4 projects), `npm run test:next` 4/4, `claude plugin validate plugins/showcase` and `claude plugin validate .` ✔.
  - The user confirmed the Star in-app tour approved. **Not re-run here:** Star's lint, typecheck and build, and `film --in-app --strict` on Star; no figures for them are recorded.
- **Pushed:** `origin` has `main` and both tags. `GITLAB` does not: its hostname didn't resolve (open item).
- **Installed here** from GitHub: showcase 1.0.0, user scope, switched off; planning 1.8.0 still on.
- **The roadmap is complete.** `/archive-roadmap` retires `.planning/showcase-plugin/` when the user is ready.
