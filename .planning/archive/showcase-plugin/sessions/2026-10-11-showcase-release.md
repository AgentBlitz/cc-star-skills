# Session: showcase S13 — the release of showcase 1.0.0

**Date:** 2026-10-11
**Branch:** main
**Roadmap:** `.planning/showcase-plugin`

## Summary

Closed Session 13 (P2 · Star II) and the showcase roadmap. The in-app tour had been built on Star in an earlier interactive session that left row 13 in progress and its plugin fixes uncommitted here, with no session log. This session committed those fixes, released showcase 1.0.0, tagged it, and pushed `main` and the tags to GitHub. Showcase now ships with `defaultEnabled: false`, so it installs switched off and is turned on per project, while planning keeps loading everywhere. The push to `GITLAB` did not happen: its hostname didn't resolve from this network. Star was left exactly as it is, by the user's choice.

## Changes

Commit `75b7667`, the plugin fixes from the Star part:

- `plugins/showcase/toolkit/runtime/src/capture-inject.ts` (new) — the capture-only IIFE entry: takes the real clocks in the top frame before any clock script.
- `plugins/showcase/toolkit/runtime/dist/showcase-capture.iife.js` (new) — its bundle.
- `plugins/showcase/toolkit/runtime/build.ts` — builds the third bundle.
- `plugins/showcase/toolkit/host/launch.ts` — `CAPTURE_IIFE`; `launchHost` injects it when `inject` is false (`film --in-app`).
- `plugins/showcase/toolkit/runtime/adapters/next/ShowcaseTour.tsx` — watches `useSearchParams` inside a `Suspense`, so a `<Link>` starts the tour in place and a later one reloads first; loads the runtime when the recorder is there and no runtime was injected.
- `plugins/showcase/toolkit/runtime/adapters/react/ShowcaseTour.tsx`, `adapters/html/snippet.html` — the same recorder check.
- `plugins/showcase/toolkit/runtime/src/anchors.ts` — a `testId` anchor resolves `data-showcase` first (not the overlay's own controls), then the three test-id attributes.
- `plugins/showcase/toolkit/runtime/src/inspect.ts` — `testIdOf` reports `data-showcase` first.
- `plugins/showcase/toolkit/runtime/dist/{STAMP,showcase-runtime.iife.js,showcase-runtime.mjs}` — rebuilt.
- `plugins/showcase/toolkit/test/runtime/{engine,in-app,bundle}.test.ts`, `test/next/next.e2e.ts` — two new tests and one new Next e2e.
- `plugins/showcase/skills/showcase/reference/in-app.md`, `tour-format.md` — the `data-showcase` contract, the entry point per framework, and what the recorder does for an in-app film.

Commit `ec249e8`, the release:

- `plugins/showcase/.claude-plugin/plugin.json` — 1.0.0, and `defaultEnabled: false`.
- `.claude-plugin/marketplace.json` — the showcase entry at 1.0.0.
- `README.md` — showcase installs switched off and how to turn it on per scope; the in-app entry point and what `public/showcase/` holds.
- `.gitignore` — `.planning/*/autopilot/` stays local.

This commit:

- `.planning/showcase-plugin/TRACKER.md` — row 13 done, open items, review notes, the Session 13 log entry.
- `.planning/sessions/2026-10-11-showcase-release.md` — this file.

Tags: `showcase--v1.0.0` at `ec249e8`; `planning--v1.8.0` at `15887b3`.

## Decisions & Rationale

- **`defaultEnabled: false` on showcase, not a user-settings switch** → the plugin is opt-in for everyone who installs it, with no per-machine setup. Enablement is then per scope: local overrides project, which overrides user.
- **Planning stays on everywhere** → the user's choice. Showcase depends on planning, so a project that turns showcase on needs planning on too, which it is.
- **Planning and copilot not bumped** → neither changed since its published version. Showcase's 0.9.0 was never pushed, so 1.0.0 is its first published version.
- **`planning--v1.8.0` tagged at its own release commit (`15887b3`), by `git tag`** → 1.8.0 was pushed untagged; `claude plugin tag` only tags HEAD. Its dry run confirmed the two versions agree.
- **The tracker and this log are a third commit, after the push** → they record where the release was actually pushed, which wasn't known until then. The tag sits on the release commit.
- **Autopilot run logs ignored, not committed** → they hold costs and session ids, the repo is public on GitHub, and no earlier roadmap tracked them.
- **Row 13 marked done on the user's word** → the user confirmed the Star in-app tour approved. Star's gates and Star's `film --in-app --strict` were not re-run here, and the tracker says so.

## Remaining Work

- **Push to `GITLAB`** once `gitlab.devopstools.tech` is reachable: `git push GITLAB main --tags`. It is still at planning v1.7.0.
- **Star's in-app tour is uncommitted** in `~/_PRJ/star`, and Star is ahead of its three remotes. Run Star's lint, typecheck and build before committing it.
- `/archive-roadmap` for `.planning/showcase-plugin/` when the user is ready.

## Resumption Context

Key files to review when picking this up:
- `.planning/showcase-plugin/TRACKER.md` — the status board, open items and the Session 13 log entry.
- `plugins/showcase/.claude-plugin/plugin.json` — the version and `defaultEnabled`.
- `README.md` — the Install and Updating sections.

Suggested opening prompt for next session:
> "Showcase 1.0.0 is released and on GitHub. Check `git push GITLAB main --tags` has gone through, then run `/archive-roadmap` for `.planning/showcase-plugin`."
