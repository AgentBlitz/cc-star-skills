# showcase plugin roadmap — TRACKER

> The last action of every session is to (1) confirm its verification gate passed, (2) update the row below, and (3) surface the next session's kickoff prompt. If a gate fails, mark the row ⛔, record the blocker here, and **stop** — do not start the next session. If you need a decision the plan doesn't settle and cannot ask for it, mark the row ⛔ with `Needs decision: <question — options>` and **stop**.

`PLAN.md` is authoritative. Sessions 9, 12 and 13 are run by hand: under autopilot each one sets ⛔ `Needs decision: run Session N interactively …` at once (PLAN §4, D14).

## Status board

| # | Session | Status | Key artifacts | Verification | Notes |
|---|---|---|---|---|---|
| 1 | F1 · Foundation: plugin skeleton, CLI, keys, doctor | ✅ | `plugins/showcase/` manifest 0.1.0, `bin/showcase`, `toolkit/{cli,commands,lib}`, `hooks/guard-keys.sh`, `env.template`, 53 tests | npm test 53/53, typecheck, doctor --json all ok, keys status (gods-eye: repo .env.local; scratch: user file missing), plugin validate ✔ | key not yet in user file; esbuild postinstall skipped (Session 4) |
| 2 | F2 · Spikes and the fixture app | ⬜ | | | |
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
