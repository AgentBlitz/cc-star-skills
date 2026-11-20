# Session: user-guides S1: scaffold, contract, fixture app and eval spike

**Date:** 2026-11-20
**Branch:** main
**Roadmap:** `.planning/user-guides`
**Runtime:** `opus/high (autopilot attempt 1)`

## Summary

Session 1 of the user-guides roadmap ran unattended, and its gate passed.

- **Sources saved.** The campaign-brief code that existed only in two transcripts went into the git-ignored `.planning/user-guides/sources/`: 23 `javascript_tool` texts and 9 `file_upload` inputs from session 45, the final `walk/lib.mjs` and `w1`–`w3` from session 42, a `README.md` index and `deny.txt` (12 terms). It was copied by script, and no token value is in it. The transcripts are no longer needed.
- **Plugin skeleton.** `plugins/user-guides/` at 0.1.0, with a dev-only `package.json` (`node --test`, `playwright-core@1.63.0`, Node ≥ 20) and placeholder `SKILL.md` files.
- **The contract.** `guide-set.mjs` and `reference/guide-set.md`, identical in both skills, cover load, validate and save, every §2.3/R8 key, the five sign-in kinds, the locator syntax, the status transitions with their owners, and the README status block.
- **The rest.** `placeholder.mjs`, the Leave Planner fixture app, the staging helper, the genericity check, and 40 `node --test` tests.
- **The spike.** It answered SP1–SP4. Eval-format runs can't listen on or reach 127.0.0.1, and Chromium dies inside them. Scaffold scripts and the skill's base directory both work. A scripted `claude -p --plugin-dir` run does all three things the eval runs could not.

## Changes

- `.gitignore`: C7's three lines (`.planning/user-guides/sources/`, `plugins/user-guides/test/.out/`, `plugins/user-guides/evals/results/`), added before anything was copied.
- `.planning/user-guides/PLAN.md`: the Spike verdicts table filled in, and the new R26 (what the spike means for S3's harness).
- `.planning/user-guides/TRACKER.md`: row 1 set to ✅, the deadline open item ticked, a session-log entry added.
- `plugins/user-guides/.claude-plugin/plugin.json`: 0.1.0, MIT, the same author and repository as the other plugins, no `dependencies`, enabled by default (D1). Not in `marketplace.json` yet: that comes at S11.
- `plugins/user-guides/package.json`, `package-lock.json`: dev only. `npm test` runs `node --test --test-concurrency=1 "test/*.test.mjs"`; `npm run genericity` runs the check.
- `plugins/user-guides/skills/{write-guides,wiki-guides}/SKILL.md`: minimal placeholders with `disable-model-invocation: true` (S2 and S9 replace them).
- `plugins/user-guides/skills/*/scripts/guide-set.mjs`: the contract module.
  - Exports `createGuideSet`, `loadGuideSet`, `saveGuideSet`, `validateGuideSet` (`{errors, warnings}`), `addGuide`, `moveGuide`, `markGuideEdited`, `addShot`, `moveShot`, `markRetakeIfChanged`, `statusBlock`, `updateIndex`, `summary`, `checkLocator` and `isRepoRelative`, plus the constant tables `GUIDE_TRANSITIONS`, `SHOT_TRANSITIONS`, `FIELD_OWNERS` and `CONFLUENCE_DEFAULTS`.
  - CLI: `validate`, `summary`, `index`.
- `plugins/user-guides/skills/*/reference/guide-set.md`: the exact key names, the owners, the sign-in kinds table, the locator syntax and both transition tables.
- `plugins/user-guides/skills/write-guides/scripts/placeholder.mjs`:
  - `altText`, `parseAlt`, `placeholderSvg` (an 800×450 card showing the screen, an "as <role>" badge and the caption, with `role="img"`, `<title>` and `data-user-guides-placeholder`), `placeholderPath`, `imageMarkdown` (relative links across folders) and `writePlaceholder`;
  - a CLI that prints the markdown link.
- `plugins/user-guides/fixtures/leave-app/` (`server.mjs`, `lib.mjs`, `sign-in.mjs`, `reset.mjs`, `package.json`, `release.json`, `.gitignore`, `CLAUDE.md`, `README.md`): Leave Planner, server-rendered and dependency-free.
  - Three roles with invented people; seven more people fill the directory.
  - A sticky header, a `<dialog>` (server-rendered `open`, made modal by its script), cards, the manager's inbox, the people directory, settings panels and the admin screen, plus 403 and 404 pages.
  - `--variant v2` (or `release.json`) renames the Requests toolbar button and removes the calendar-sync checkbox from the Notifications panel. The README's change table lists both changes and the shots they retake.
  - It listens on port 0 and prints its URL.
  - The `cookie-command` helper refuses without `EVAL_LEAVE_APP=1`; the form sign-in is offered only when `EVAL_LEAVE_APP_PASSWORD` is set.
  - `CLAUDE.md` forbids the git-ignored `private/` folder.
- `plugins/user-guides/test/stage.mjs`: R13 staging.
  - `stageFixture({variant, into, canaryFile})` copies the fixture to a temp dir, runs `git init`, writes `private/hr-notes.md` holding a fresh `LEAVEAPP-CANARY-<hex>` and commits; `releaseV2(dir)` adds a "Release 1.1" commit.
  - The CLI takes `--variant`, `--into` and `--canary-file`.
- `plugins/user-guides/test/genericity.mjs`: R17.
  - The host rule (localhost, 127.0.0.1, `example.*`, plus `www.w3.org` namespaces and this repo's own GitHub URL) and the deny-list rule (it reports where, never the term).
  - Modes: the plugin's files (the default), given paths, `--added` (the deny-list rule over lines added under `.planning/`), `--text` and stdin.
- `plugins/user-guides/test/*.test.mjs`: `guide-set`, `placeholder`, `sync` (the shared files are byte-identical; `kit-core.mjs` and `md.mjs` are skipped until they exist), `leave-app`, `stage` and `genericity`. 40 tests: 38 pass, 2 skipped.
- `plugins/user-guides/test/.out/spike/` (git-ignored, never committed): the four spike cases, the probes, `run-spike.sh` and the results.

## Decisions & Rationale

- **Contract key names**:
  - top level: `schemaVersion: 1`;
  - `app`: `baseUrl`, `start`, `reset`, `playwrightFrom`, `signIn` and `accounts`. `signIn` is `{kind, …}`, and each account takes `{id?, label?, usernameEnv?, passwordEnv?}`;
  - `shots[].target`: `{what, locator}`, where `locator` may be `null`;
  - shot fields: `takenAt`, `release`, `fingerprint` (`sha256:<64 hex>`), and an optional `note`;
  - `interview`: `{wordingVersion, answers}`;
  - `publish`: `{release, html: {outDir}, confluence: {baseUrl, space, topPageId, topGuide, pages: {id: {pageId, version|null}}, imageCap, deviceScale}}`. The defaults are 640 and 2.

  Unknown keys are errors, so a typo or a secret field (such as `password` or `token`) is rejected.
- **Validation severity**: a non-local `baseUrl`, or a role missing from `accounts`, is a warning, not an error. The user may confirm a non-local base URL, and adopted sets may name roles before their accounts exist.
- **Taking a shot** (`moveShot` to `taken`) needs `takenAt`, `release` and `fingerprint`. Adopted images are `taken` with none of them, so the first refresh retakes them (R7).
- **Exceptions to the genericity host rule**:
  - `plugin.json`'s `author`, `homepage` and `repository` are left out of the scan;
  - `package-lock.json` is skipped (it names the public npm registry);
  - bare host names are matched only on a short list of endings, so that code such as `set.app` passes;
  - a full URL is always checked.
- **The canary file is opt-in.** The first spike run showed that `--into` wrote `app.canary` into the eval workspace, where a run could read it. Evals match the fixed prefix instead.
- **Fixture start on port 0** (C6), even in its `npm start`.
- **Spike scope.** It went beyond the four yes/no answers to check the settled fallback, a scripted `claude -p --plugin-dir` run, on a staged copy. That run reached the fixture, launched Chromium and ran git, so S3 can rely on it (R26).

## Remaining Work

- Session 2: write-guides, the skill itself. It reads `kit-core.mjs` (R12), the walk library generalised from `sources/s42-*.mjs`, the interview, recon, walking, refresh and adopt references, and the templates.
- For S3 (R26):
  - only walk-free cases go in eval format; walk, shot and mock cases run as scripted `claude -p --plugin-dir` runs;
  - `run.sh` needs a `git` wrapper on PATH (the in-run `/usr/bin/git` fails);
  - graders see only files the run wrote;
  - a server a scaffold starts must be stopped afterwards.
- `claude plugin validate` warns that the plugin has no icon (`ICON_MISSING`). This is not blocking; decide by S11.

## Resumption Context

Key files to review when picking this up:
- `.planning/user-guides/PLAN.md`: §2.3, §3 (the Spike verdicts, R26), §5 Session 2
- `plugins/user-guides/skills/write-guides/reference/guide-set.md`
- `plugins/user-guides/skills/write-guides/scripts/guide-set.mjs`
- `plugins/user-guides/fixtures/leave-app/README.md`
- `plugins/user-guides/test/stage.mjs`, `test/genericity.mjs`
- `.planning/user-guides/sources/README.md` (git-ignored)

Suggested opening prompt for next session:
> "/planning:session .planning/user-guides"
