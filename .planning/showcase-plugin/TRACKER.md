# showcase plugin roadmap — TRACKER

> The last action of every session is to (1) confirm its verification gate passed, (2) update the row below, and (3) surface the next session's kickoff prompt. If a gate fails, mark the row ⛔, record the blocker here, and **stop** — do not start the next session. If you need a decision the plan doesn't settle and cannot ask for it, mark the row ⛔ with `Needs decision: <question — options>` and **stop**.

`PLAN.md` is authoritative. Sessions 9, 12 and 13 are run by hand: under autopilot each one sets ⛔ `Needs decision: run Session N interactively …` at once (PLAN §4, D14).

## Status board

| # | Session | Status | Key artifacts | Verification | Notes |
|---|---|---|---|---|---|
| 1 | F1 · Foundation: plugin skeleton, CLI, keys, doctor | ✅ | `plugins/showcase/` manifest 0.1.0, `bin/showcase`, `toolkit/{cli,commands,lib}`, `hooks/guard-keys.sh`, `env.template`, 53 tests | npm test 53/53, typecheck, doctor --json all ok, keys status (gods-eye: repo .env.local; scratch: user file missing), plugin validate ✔ | key not yet in user file; esbuild postinstall skipped (Session 4) |
| 2 | F2 · Spikes and the fixture app | ✅ | `toolkit/fixtures/{serve.ts,app/}` (5 pages, every hard case, no test ids), `toolkit/spikes/` (4 spikes, prototype overlay, `results/*.json`), `fixtures.test.ts` | fixture check: 6 pages, 0 console problems; S-D1…S-D4 measured and recorded in PLAN §3; Spike 2 20/20, menu never closed; Spike 3 screenshots + `elementFromPoint` for 20 cells, contact sheet read back; npm test 60/60, typecheck | default scale 1.5 (needs `--force-device-scale-factor`), JPEG q90; overlay: the hybrid (popover draws, controls move into modal/fullscreen/auto popover); Playwright defaults for page loads |
| 3 | T1 · Tour format and narrative rules | ⬜ | | | |
| 4 | R1 · Runtime I: the engine | ⬜ | | | |
| 5 | R2 · Runtime II: overlay, host, Watch, rehearse and inspect | ⬜ | | | |
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
