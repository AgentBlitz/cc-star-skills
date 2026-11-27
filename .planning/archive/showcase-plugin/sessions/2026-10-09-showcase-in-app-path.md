# Session: showcase S10 — the in-app path (vendor, adapters, deep links)

**Date:** 2026-10-09
**Branch:** main
**Roadmap:** `.planning/showcase-plugin`
**Runtime:** `opus/medium (autopilot attempt 1)`

## Summary

Ran Session 10 of the showcase roadmap: the same tour now ships inside an app. The runtime gained an in-app boot (`startInApp`) that reads `?showcase=<id>&showcaseStep=&showcaseMode=`, loads the tour and voice manifest from the app's static paths, and plays with synthetic input and sessionStorage run state through an adapter (`navigate`, `reset`, `beforeStart`, `actions`). `showcase runtime vendor` copies the stamped runtime and its types into an app, writes a Next, React or HTML adapter, publishes the tours and points `voice.dir` at `public/showcase/voice/`, idempotently. `film --in-app` records the app's own vendored tour with nothing injected, and `rehearse --synthetic` lists what synthetic input can't do. A minimal Next 16 fixture, installed on demand into the cache, proves it: `next build` passes under the strict flags, the deep link plays on one document load, and `film --in-app --strict` is green. Along the way a host bug was fixed: SPA `nav` events stole sequence numbers the page reused, which would have broken any film of an SPA app. Every gate check passed.

## Changes

- `plugins/showcase/toolkit/runtime/src/in-app.ts` — new: deep-link parsing and building, `wantsShowcase`, `servedPaths`, `routeTo` (router push with re-push and timeout), `syntheticGaps`.
- `plugins/showcase/toolkit/runtime/src/index.ts` — `Adapter` type and `startInApp` (fresh start from a link, resume from saved state, once per document); `bootDirector` takes an in-app env (router navigate, clip and asset URLs, exit); in-app Esc/close end the tour and remove the overlay.
- `plugins/showcase/toolkit/runtime/src/audio.ts` — `clipUrl` option: in-app clips play from the app's static path.
- `plugins/showcase/toolkit/runtime/dist/*` — rebuilt (new `types/in-app.d.ts`, fresh STAMP).
- `plugins/showcase/toolkit/runtime/adapters/{next/ShowcaseTour.tsx,next/showcase-adapter.ts,react/ShowcaseTour.tsx,html/snippet.html}` — new adapter templates.
- `plugins/showcase/toolkit/lib/vendor.ts`, `toolkit/commands/runtime.ts`, `toolkit/cli.ts` — new `runtime vendor` command; `publishedTourProblem` for `film --in-app`.
- `plugins/showcase/toolkit/host/launch.ts` — `inject: false` option; per-document seq shift so host `nav` events never collide with the page's.
- `plugins/showcase/toolkit/film/record.ts`, `toolkit/commands/film.ts` — `film --in-app` (deep-link URL, no injection, stale-tour check, clearer never-armed message).
- `plugins/showcase/toolkit/host/rehearse.ts`, `toolkit/commands/rehearse.ts` — `--synthetic` reports `synthetic` gaps; a `cannot` is a problem.
- `plugins/showcase/toolkit/fixtures/serve.ts` — `root` option; serves `.mjs`, `.json`, `.mp3`.
- `plugins/showcase/toolkit/fixtures/next/` — new Next 16 app-router fixture with `showcase/` config, `next-tour` and its storyboard.
- `plugins/showcase/toolkit/fixtures/next-fixture.ts` — new: copies the fixture into `~/.cache/showcase/fixtures/next-<hash>/` and installs its deps there.
- `plugins/showcase/toolkit/test/in-app.test.ts`, `toolkit/test/runtime/in-app.test.ts`, `toolkit/test/next/next.e2e.ts`, `toolkit/test/runtime/engine.test.ts` — new tests (233 in `npm test`; Next e2e under `npm run test:next`).
- `plugins/showcase/package.json` — `test:next` script.
- `plugins/showcase/tsconfig.json` — excludes the adapter templates and the Next fixture.
- `plugins/showcase/skills/showcase/reference/in-app.md` — new reference doc.
- `.planning/showcase-plugin/TRACKER.md`, `.planning/showcase-plugin/PLAN.md` — row 10 ✅, session log, status line, §2.6 "as built" notes.

## Decisions & Rationale

- Declarations vendored as `showcase-runtime.d.mts` + `types/` → TypeScript ignores a `.d.ts` beside an `.mjs`; one file would need a bundler for declarations.
- Tours published byte for byte to `<public>/showcase/tours/` by `runtime vendor` → the runtime needs them on a static path, and `film --in-app` can detect a stale copy by comparing bytes.
- A deep link strips its parameters with `history.replaceState` → a reload resumes from sessionStorage instead of restarting; a new link restarts.
- The Next app's own code lives in `showcase-adapter.ts`, written once → Next's layout is a server component and can't pass functions to `ShowcaseTour`; re-vendoring must not lose the app's edits.
- Host-side seq shift for `nav` events rather than a contract change → keeps the film contract and `filmOrderProblems` as they are and fixes injected SPA films too.
- Next e2e outside `npm test` → it installs and builds a real app, which loads the machine under the film tests' motion-gap checks.

## Remaining Work

- Session 11 (S1): the skill (`SKILL.md`), the remaining references (make `in-app.md` consistent with the wizard), templates, evals, marketplace/README integration.
- The motion-gap check stays load-sensitive (one full `npm test` run failed only there; re-runs were green).
- `OPENROUTER_API_KEY` in the user key file is still open (the draft voice covers everything so far).

## Resumption Context

Key files to review when picking this up:
- `plugins/showcase/toolkit/runtime/src/index.ts` (`startInApp`)
- `plugins/showcase/toolkit/lib/vendor.ts`
- `plugins/showcase/skills/showcase/reference/in-app.md`
- `.planning/showcase-plugin/prompts/session-11.md`

Suggested opening prompt for next session:
> "Run /session .planning/showcase-plugin (Session 11: the skill and integration)."
