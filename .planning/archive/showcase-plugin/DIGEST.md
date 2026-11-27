> **Archived:** 2026-11-27 · **Sessions:** 13/13 ✅ · **Outcome:** showcase 1.0.0 shipped opt-in: films, live demos and in-app tours, proven on Star.

# Showcase plugin roadmap — digest

## What was built

A new marketplace plugin, **`showcase`**, that turns any web app into a narrated product film. It grew out of gods-eye's Compass tour work, which was React/Next- and Compass-specific and had never produced a recording. In any web-app repo, `/showcase` interviews the user (outcomes, kind and length of video, narrator), then writes a tour file and works through check, rehearse, storyboard, voice and film to a verified 1080p MP4 with burned-in captions, an SRT, a timecoded script, a still per beat and a verification report. The user decides at three checkpoints: the storyboard, the narrator and the final cut. The same tour file also plays as a self-playing live demo, injected from outside so the app doesn't change, and ships inside a product as an in-app guided tour through a vendored runtime with Next, React and HTML adapters.

**Status: complete, 13 of 13 sessions.** It was proven on built-in fixtures and then on the user's Star dashboard (Next 16): first a no-code-change 58.6 s executive pitch and live demo (Session 12), then the tour embedded in Star (Session 13). showcase 1.0.0 was released with `defaultEnabled: false` and tagged `showcase--v1.0.0`, and `planning--v1.8.0` was tagged retroactively. Both were pushed to `origin`; `GITLAB` was unreachable. Star's in-app work is uncommitted, by the user's choice.

## Key decisions

- **One plugin, one skill, no always-on cost (D1, D18).** `/showcase` has subcommands and `disable-model-invocation: true`. Versions stayed 0.x until the 1.0.0 release, which installs switched off (`defaultEnabled: false`) and is enabled per scope.
- **Every run makes a film (D3, D4, D19).** The live demo (Watch only) and the in-app tour are optional extras. The v1 film is 1080p, 16:9 and 30 fps, with no camera zoom or music. `browser.scale` (smaller CSS viewport, matching DPR) provides legibility instead.
- **One framework-agnostic runtime (D7, D16).** The director runs in the page and Node is the host. The runtime is TypeScript bundled by esbuild into a committed, hash-stamped `runtime/dist/` (IIFE for injection, ESM plus types for vendoring). It is injected with `addInitScript`, with no network interception, and one binding, `__showcaseHost`, carries input, state, assets and events.
- **Voice through OpenRouter only (D5, D6, D11).** macOS `say` covers drafts and a fake covers tests. The key lives in one user-level file under the XDG config directory (mode 600), overridable only by a git-ignored `.env.local`. Plugin `userConfig` was rejected because it doesn't reach Bash. A PreToolUse hook guards the key paths, and only `env.ts` reads and `openrouter.ts` sends the key.
- **Node ≥ 24 runs TypeScript natively (D10).** `playwright-core@1.63.0` is the only runtime dependency, installed to the XDG cache on first use. Tests are committed, unlike the rest of the repo.
- **Checkpoints are ⛔ `Needs decision:` rows (D14).** An autopilot run of a by-hand session stops at once. This worked as designed at Sessions 9 and 12.
- **Spike verdicts (S-D1 to S-D4).** Scale 1.5 with a forced `--force-device-scale-factor`, JPEG q90 and a 300 ms settle after scrolls. A hybrid overlay: the popover draws everything, and only the controls move into the modal, fullscreen element or auto popover. A window capture listener consumes control events. Page loads keep Playwright's defaults (no white flash), and verify exempts `nav` holds.
- **Film measurement (Sessions 7–8).** A 1 px heartbeat makes every capture gap a real miss. The probe flash runs before the pre-roll. The master is encoded from the frames (captions burned in by ffmpeg from ASS in Atkinson Hyperlegible, D15), not re-encoded from `video.mp4`. A draft writes only `<tour>-draft.mp4`. Structural checks always fail, and quality checks fail only under `--strict`.
- **Voice pipeline (Session 6).** The manifest is per tour. A clip is fresh only when both its synth key and its file name (which carries the post chain) match, so a changed setting re-processes from the raw cache at no cost. `--max-chars` caps a whole run, and a 401, 402 or 403 stops the queue.
- **In-app path (Session 10).** Deep links are namespaced (`?showcase=`), and types are vendored as `.d.mts` plus `types/`. `runtime vendor` publishes tours byte for byte to `<public>/showcase/tours/`. The app's own `showcase-adapter.ts` is written once and never overwritten. The Next e2e stays outside `npm test` to keep the machine quiet under the motion-gap checks.
- **Fix the plugin, not the tour (Session 12).** Every bug Star exposed was fixed in the plugin with a regression test. For example, T008 now times voiced sentences by their clips (C5), and the voice chain was bumped to 3 rather than the A/V gate being loosened.
- **Star privacy and narrator.** `privacy.deny` is empty by the user's choice, since Star redacts at write time and a list of names would break its no-names rule. gods-eye's Gemini "Charon" voice was reused without an audition and saved as the default (D17).
- **Release housekeeping (Session 13).** `planning--v1.8.0` was tagged at its own release commit because showcase depends on planning (D12). Autopilot run logs are now git-ignored, since they hold costs and session ids and the repo is public.

## Gate results

| # | Session | Status | Gate result |
|---|---|---|---|
| 1 | F1 · Foundation | ✅ | 53/53 tests, doctor all ok, validate ✔ |
| 2 | F2 · Spikes and fixture app | ✅ | 60/60; four spikes measured, verdicts recorded |
| 3 | T1 · Tour format and narrative rules | ✅ | 112/112; golden 100.8 s, templates clean |
| 4 | R1 · Runtime I: the engine | ✅ | 134/134; 18 kinds, 0 synthetic fallbacks |
| 5 | R2 · Overlay, host, Watch, rehearse, inspect | ✅ | 157/157; overlay works over a modal, rehearse clean 3× |
| 6 | V1 · Voice | ✅ | 192/192; −16 LUFS clips; live audition skipped (no key) |
| 7 | F3 · Film I: capture and video | ✅ | 205/205; 1080p30 BT.709, motion gap 22.3 ms |
| 8 | F4 · Film II: sound, captions, verify | ✅ | 224/224; `film --strict` green on two tours |
| 9 | Checkpoint: look and feel (by hand) | ✅ | Approved as-is, after an autopilot ⛔ stop; strict film green on the third run |
| 10 | I1 · The in-app path | ✅ | 233/233; `film --in-app --strict` green on Next fixture |
| 11 | S1 · The skill and integration | ✅ | 237/237; evals mean Δ +0.75; D18 shown by substitute evidence |
| 12 | P1 · Star I: film and live demo (by hand) | ✅ | Final cut approved, after an autopilot ⛔ stop; 243/243; 6 bugs fixed |
| 13 | P2 · Star II: in-app tour, release (by hand) | ✅ | 245/245, test:next 4/4; tagged and pushed; Star gates not re-run |

## Deviations from PLAN.md

- **S1:** The hook contract and OpenRouter's key endpoint were checked against live docs and the OpenAPI spec, because no `claude-code-guide` agent was available. `@types/node` was added (C2), and a loopback-only `SHOWCASE_OPENROUTER_BASE` override was added for canary tests.
- **S2:** §2.1, §2.2, §2.5, C3 and the Session 5 and 8 prompts were rewritten to the spike verdicts. The plan hadn't expected four findings: the emulated DPR is dropped unless forced, fullscreen makes the rest of the page inert, a popover's controls light-dismiss an app's auto popover, and there are no white flashes even without PaintHolding.
- **S3:** `readingMs` rounds to the millisecond, as gods-eye's does, although PLAN's formula doesn't, and `meta.approved` was added to the schema.
- **S4:** The binding is `__showcaseHost`, not `__showcaseFilm`, and `navigates` is a persisted stage. The re-show rule reads only the journal, separate tsconfigs exist for runtime and host, and the schema has no `grew` predicate and no step `requires`.
- **S5:** A Session 4 resume-after-load director bug was fixed. Host↔page types moved to a DOM-free `protocol.ts`. `auth` wasn't run headed; its writer is unit-tested.
- **S6:** The manifest became per tour (`<tour>.manifest.json`, §2.10 updated), and `--max-chars` caps a run rather than a sentence. The live audition was skipped because no key was set.
- **S7:** The heartbeat, probe-before-pre-roll, `setparams` colour tagging and a DevTools port for the worker fallback were all unplanned.
- **S8:** The master is encoded from the frames, not muxed from `video.mp4`. Captions carry a 30 ms clip lead, and the fixture tour's target moved from 60 s to 40 s. No `nav` crossfades were needed.
- **S9:** Two strict films failed on motion gap under endpoint-security host load. The cause was judged to be load, and the advice is to render on a quiet machine.
- **S10:** A host `nav`-seq collision affecting all SPA films was fixed, and the Next e2e was kept out of `npm test`.
- **S11:** Evals run through `evals/run.sh`, because eval runs have a sealed HOME that breaks D12 and PATH. `plugin details` ignores `disable-model-invocation`, so a listing check stood in for it.
- **S12:** `privacy.deny` is empty, against the prompt. Six plugin bugs were fixed: `inspect` and `auth` skipped the snapshot, accessible names split React text, the heartbeat didn't re-arm after a load, an approval made the rehearse stale, the Gemini click defeated the trim (chain 3), and T008 ignored voiced clips.
- **S13:** It ran in two parts, and the Star part wrote no log. Four in-app fixes followed: the recorder holds the run state, a capture-only bundle takes the real clocks, the Next adapter handles a `<Link>`, and `data-showcase` resolves as a test id. The work also added `defaultEnabled: false`, the retroactive planning tag and ignored autopilot logs. `GITLAB` was not pushed.
- **Throughout:** Autopilot run logs were left uncommitted until Session 13 ignored them.

## Final file map

**cc-star-skills, new: `plugins/showcase/`**
- `.claude-plugin/plugin.json` (0.1.0, then 0.9.0, then 1.0.0, `dependencies: ["planning"]`, `defaultEnabled: false`), `bin/showcase`, `hooks/{hooks.json,guard-keys.sh}`
- `package.json`, `package-lock.json`, `tsconfig.json`; `evals/` (4 cases plus `run.sh`)
- `skills/showcase/`: `SKILL.md`; `reference/{tour-format,narrative,interview,voice,film,in-app,determinism,roadmap-brief}.md`; `templates/` (4 tour templates, `config.json`, `env.template`, `BRIEF.md`)
- `toolkit/cli.ts`, `commands/` (doctor, keys, shim, docs, check, storyboard, init, rehearse, watch, inspect, auth, voice, voices, film, runtime, brief), `lib/`, `schema/{tour,config}.schema.json`, `fonts/` (Atkinson Hyperlegible Bold plus OFL)
- `toolkit/runtime/`: `src/` (engine, `overlay/`, `in-app.ts`, `film-aids.ts`, `capture-inject.ts`, `protocol.ts`; `overlay-stub.ts` was created, then deleted), `adapters/{next,react,html}/`, `build.ts`, `stamp.ts`, tsconfigs, committed `dist/` (runtime IIFE and ESM, capture IIFE, `.d.mts`, `types/`, `STAMP`)
- `toolkit/host/` (`launch`, `app`, `project`, `rehearse`, `watch`, `inspect`, `auth`), `toolkit/voice/` (`tts/`, pipeline, audition, catalogue, keys), `toolkit/film/` (record, capture, worker, cfr, encode, mix, captions, script, post, verify)
- `toolkit/fixtures/` (`serve.ts`, `app/`, `showcase/` fixture project, `tours/` with 20 invalid, `next/` plus `next-fixture.ts`, `assets/`), `toolkit/spikes/` (harness plus `results/*.json`), `toolkit/test/` (245 tests, `golden/`, `next/next.e2e.ts`)

**cc-star-skills, modified:** `.claude-plugin/marketplace.json` (S11, S13), `README.md` (S11, S13), `.gitignore` (S1, S11, S13), `.planning/showcase-plugin/` (PLAN, TRACKER, `prompts/session-{5,8}.md`), `.planning/sessions/` (15 logs, including the two checkpoint stops).

**Star:** committed `e171968` with the `.gitignore` lines and `showcase/` (config, `.schema/`, `star-pitch` tour, storyboard, 14 clips plus manifest). Left uncommitted (S13): the vendored `src/showcase/`, `public/showcase/{tours,voice}/`, the "Take the tour" link and the copilot hidden during a tour.

### Drift from PLAN.md §6

**Planned, but no log touched it:**
- Star Session 13 items (vendored runtime, `ShowcaseTour.tsx`, entry-point edit, `data-showcase` anchors, a contract test, `public/showcase/voice/`). The Star part wrote no log. The tracker records most of them in Star's working tree, but **no contract test** is mentioned anywhere.

**Touched, but not in §6:**
- `toolkit/runtime/adapters/` and the runtime's root build files (`build.ts`, `stamp.ts`, `tsconfig.dts.json`); §6 lists only `runtime/{src,dist}`.
- `package-lock.json`.
- `.gitignore` in Sessions 11 and 13, beyond §6's Session 1.
- `.planning/showcase-plugin/prompts/session-{5,8}.md`, rewritten mid-roadmap after the spikes.
- A third `dist/` bundle, `showcase-capture.iife.js`.
- The `planning--v1.8.0` tag on `plugins/planning`. This is a tag, not a file change, so §6's "unchanged" still holds for its files.

## Where everything went

- `.planning/showcase-plugin/` → `.planning/archive/showcase-plugin/` (moved as one directory with `git mv`)
- 15 session logs, `.planning/sessions/` → `.planning/archive/showcase-plugin/sessions/`:
  - `2026-10-09-showcase-cli-foundation.md`
  - `2026-10-09-showcase-film-capture.md`
  - `2026-10-09-showcase-film-sound-captions.md`
  - `2026-10-09-showcase-fixture-spikes.md`
  - `2026-10-09-showcase-in-app-path.md`
  - `2026-10-09-showcase-look-and-feel-checkpoint.md`
  - `2026-10-09-showcase-look-feel-approved.md`
  - `2026-10-09-showcase-overlay-host.md`
  - `2026-10-09-showcase-runtime-engine.md`
  - `2026-10-09-showcase-skill-integration.md`
  - `2026-10-09-showcase-star-film-checkpoint.md`
  - `2026-10-09-showcase-star-film.md`
  - `2026-10-09-showcase-tour-format.md`
  - `2026-10-09-showcase-voice-pipeline.md`
  - `2026-10-11-showcase-release.md`
- Autopilot: 12 runs, log at `autopilot/autopilot.log`. Git ignores it through `.planning/archive/*/autopilot/`, so git has no copy.
- Archive commit: see `git log -- .planning/archive/showcase-plugin`.

`git log --follow <path>` recovers a moved file's history. To reverse the archive, `git mv` each path back. Never `rm -rf` this directory: the ignored `autopilot/` folder would be lost for good.
