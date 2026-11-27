# Session: showcase S1 — plugin skeleton, CLI, keys, doctor

**Date:** 2026-10-09
**Branch:** main
**Roadmap:** `.planning/showcase-plugin`
**Runtime:** `opus/medium (autopilot attempt 1)`

## Summary

Ran Session 1 (F1, the foundation) of the showcase plugin roadmap. The new `plugins/showcase` plugin now exists with its manifest (0.1.0, `dependencies: ["planning"]`), a Node 24 TypeScript toolkit run natively by `bin/showcase`, and a `parseArgs` CLI router with `doctor`, `keys status|init|import|test|set`, `shim` and `docs`. Key handling follows PLAN §2.3. `toolkit/lib/env.ts` is the only key reader and writer. It resolves the process environment first, then a git-ignored `.env.local`, then the user file. It refuses loose file modes, and every value it loads is registered for redaction. A PreToolUse guard hook (plain bash and grep) denies any tool call that names the user key file or `showcase/.auth/`. The gate passed: 53 tests (including the canary and hook tests) and the typecheck, `doctor --json` all-green on this Mac, `keys status` from gods-eye and from a scratch dir, and `claude plugin validate`.

## Changes

- `plugins/showcase/.claude-plugin/plugin.json`: the manifest: showcase 0.1.0, author, homepage and repository, keywords, `dependencies: ["planning"]`.
- `plugins/showcase/package.json`, `package-lock.json`, `tsconfig.json`: a private ESM package with `test`, `typecheck` and a placeholder `build:runtime`. Dev dependencies are TypeScript 7.0.2, esbuild 0.28.2, playwright-core 1.63.0 (exact) and @types/node 24. The tsconfig follows C3.
- `plugins/showcase/bin/showcase`: a bash launcher that resolves symlinks, checks Node ≥ 24 and `process.features.typescript`, and execs `node --disable-warning=ExperimentalWarning toolkit/cli.ts`.
- `plugins/showcase/toolkit/cli.ts`: the router, with per-command `--help`, `--json`, exit codes 0/1/2, and redacted top-level error handlers.
- `plugins/showcase/toolkit/commands/{types,doctor,keys,shim,docs}.ts`: the commands.
- `plugins/showcase/toolkit/lib/names.ts`: the known key names, the secret names and the showcase-owned names.
- `plugins/showcase/toolkit/lib/env.ts`: resolution with sources, `git check-ignore -q`, `util.parseEnv`, mode checks via `PermissionError` with the fix, and the user-file writers (`initUserFile`, `writeUserKey`, `readKeyFrom`).
- `plugins/showcase/toolkit/lib/redact.ts`: a port of gods-eye's redactor, plus a registry of loaded values.
- `plugins/showcase/toolkit/lib/{child-env,log,paths,ffmpeg,playwright}.ts`: the child-environment policy, human and JSON output, XDG paths, ffmpeg discovery with a capability parser, and playwright-core resolution, install and Chromium checks.
- `plugins/showcase/hooks/hooks.json` and `hooks/guard-keys.sh`: the PreToolUse guard.
- `plugins/showcase/skills/showcase/templates/env.template`: the user key file template.
- `plugins/showcase/toolkit/test/*.test.ts` and `helpers.ts`: tests for env precedence, modes, `process.env` isolation, redaction and the canary, keys status/init/import/set, the guard, ffmpeg parsing, CLI routing and the shim.
- `.gitignore`: showcase's `out/`, `.cache/`, `.auth/` and test output.
- `.planning/showcase-plugin/` (PLAN.md, TRACKER.md, prompts): first commit of the roadmap. PLAN C2 now records `@types/node`, and the tracker records row 1 and the session log.

## Decisions & Rationale

- **The hook contract was checked against the live Claude Code hooks docs, not the `claude-code-guide` agent**, because no agent of that type was available in this run. The contract: stdin JSON with `tool_name` and `tool_input`; to deny, write `hookSpecificOutput.permissionDecision: "deny"` with a reason and exit 0; to allow, stay silent with exit 0.
- **The OpenRouter `GET /api/v1/key` shape was confirmed from openrouter.ai's OpenAPI spec**, plus a probe that sent only a canary key. `keys test` prints only `is_free_tier`, `limit`, `limit_remaining`, `limit_reset`, `usage`, `usage_monthly` and `expires_at`. It leaves out `label`, which holds part of the key, and the creator and workspace ids.
- **`SHOWCASE_OPENROUTER_BASE` is a test-only override.** It is honoured only for `http://127.0.0.1` or `localhost`, so the canary tests can run against a loopback echo server and the override can't send the key anywhere else.
- **Key-file writes live in `env.ts` as well**, so one module does all the key-file I/O. The commands never see the file text.
- **The guard also denies Grep and Glob on the `~/.config/showcase` directory itself**, and `~/.config/showcase/*` globs, because they would read the file without naming it. `ls ~/.config/showcase` is still allowed.
- **`@types/node` was added as a dev dependency** (C2 requires recording it); `tsc` can't check Node code without it.
- **esbuild's postinstall script didn't run** (npm's allowScripts warning). That doesn't matter until Session 4 builds the runtime; flagged for that session.
- **The `autopilot/` run artefacts under the plan dir were left uncommitted**: they are the live loop's logs, not plan content.
- **`doctor` marks `say` and the key as warnings, not failures**: drafts can fall back, and the draft voice works without a key.

## Remaining Work

- The user: put `OPENROUTER_API_KEY` in the user file. Either give the go for `showcase keys import ~/_PRJ/gods-eye/.env.local`, or run `showcase shim`, then `showcase keys set` in your own terminal.
- Session 2 (F2, spikes and the fixture app) is next.
- Session 4: check that esbuild works despite the skipped postinstall (`npm install-scripts approve esbuild` if not).

## Resumption Context

Key files to review when picking this up:
- `.planning/showcase-plugin/PLAN.md` (§2.2–§2.3, §3, §5 Session 2)
- `plugins/showcase/toolkit/cli.ts`, `toolkit/commands/types.ts` (how to add a command)
- `plugins/showcase/toolkit/lib/env.ts`, `lib/child-env.ts`, `lib/playwright.ts`

Suggested opening prompt for next session:
> "Run `/session .planning/showcase-plugin` — Session 2 (F2 · Spikes and the fixture app)."
