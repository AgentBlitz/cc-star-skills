---
model: opus
effort: medium
rationale: "establishes the CLI's conventions and key handling; canary-key tests are a strong gate"
---
Paste everything below into a fresh Claude Code session in the `cc-star-skills` repo, started with `claude --add-dir ~/_PRJ/gods-eye`. It has a runtime profile in the frontmatter above. Set it first with `/model opus` and `/effort medium` (autopilot applies it automatically).

---

# showcase plugin roadmap — Session 1 of 13: F1 · Foundation: plugin skeleton, CLI, keys, doctor

> Prefer **`/session`**. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Read first
1. `.planning/showcase-plugin/PLAN.md`: §1–§4, especially D6, D10, D11, D12 and C1–C3, C7 and C10–C12, then §2.2–§2.3 and §5 Session 1.
2. `.planning/showcase-plugin/TRACKER.md`: this is the first session. Mark row 1 🟡.
3. This repo's conventions:
   - `README.md` (the layout and updating sections);
   - `plugins/copilot/.claude-plugin/plugin.json` (the manifest shape);
   - `plugins/planning/bin/autopilot` (the `bin/` wrapper pattern: plugin `bin/` directories are on the Bash tool's PATH).
4. The gods-eye reference, **read-only**:
   - `~/_PRJ/gods-eye/scripts/film/lib/env.ts` and `scripts/film/lib/ffmpeg.ts`;
   - `~/_PRJ/gods-eye/src/core/ai/redact.ts`;
   - `~/_PRJ/gods-eye/.planning/showcase/PLAN.md` §3 (C7 secrets, C8 toolchain).

## Objective
The `showcase` plugin exists, with a working CLI, key handling that travels between repos, and a prerequisites check: the base every later session builds on.

## Do
1. **Plugin metadata:**
   - `plugins/showcase/.claude-plugin/plugin.json`: name `showcase`, version `0.1.0`, the description, author (Kam Star, kam@kamstar.net), homepage and repository (`https://github.com/AgentBlitz/cc-star-skills`), keywords (video, demo, tour, narration, tts, playwright, film), and `"dependencies": ["planning"]`.
   - **No marketplace entry yet** (Session 11).
2. **`plugins/showcase/package.json`:**
   - `"private": true`, `"type": "module"`.
   - Scripts: `test` (`node --disable-warning=ExperimentalWarning --test "toolkit/test/**/*.test.ts"`), `typecheck` (`tsc --noEmit`), `build:runtime` (a placeholder until Session 4).
   - Dev dependencies: `typescript`, `esbuild`, and `playwright-core` pinned at exactly `1.63.0`.
   - `tsconfig.json` per C3: `erasableSyntaxOnly`, `verbatimModuleSyntax`, `allowImportingTsExtensions`, `noEmit`, `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, with an ESNext/nodenext module setup.
   - The root `.gitignore` gains `**/showcase/out/`, `**/showcase/.cache/`, `**/showcase/.auth/` and `plugins/showcase/toolkit/test/.out/`.
3. **`bin/showcase`** (bash, mode 755):
   - resolves its own directory through symlinks;
   - checks that `node` exists, that its major version is ≥ 24 and that `process.features.typescript` is set, else prints a one-line hint and exits 1;
   - then `exec node --disable-warning=ExperimentalWarning "$DIR/../toolkit/cli.ts" "$@"`.
   - Don't use `--no-warnings=…`: it silences every warning.
4. **`toolkit/cli.ts`:** a `node:util` `parseArgs` router with a subcommand registry, per-command `--help`, `--json`, and exit codes 0 (ok), 1 (failure) and 2 (usage).
5. **`toolkit/lib/`:**
   - **`log.ts`**: human output vs `--json`.
   - **`redact.ts`**: a port of gods-eye's, masking loaded key values (6+ characters), Bearer, `authorization:`, and `key=`/`token=`/`api_key=`.
   - **`env.ts`**, the **only** key reader (PLAN §2.3). Resolution order:
     1. the process environment;
     2. the repo's `.env.local`, only if `git check-ignore -q` says it's ignored, parsed with `util.parseEnv` and taking only the listed names;
     3. the user file `${SHOWCASE_CONFIG_DIR:-${XDG_CONFIG_HOME:-~/.config}/showcase}/.env`.

     It refuses a file looser than 600 or a directory looser than 700, printing the fix. It returns the value and its source, and never logs.
   - **`child-env.ts`**: the app server gets its normal environment minus showcase's key names; tools get an allowlist (`PATH`, `HOME`, `LANG`, `TMPDIR`, plus explicit additions).
   - **`ffmpeg.ts`**: a port of gods-eye's discovery (`FFMPEG_PATH`/`FFPROBE_PATH`, the Homebrew paths, `which`), plus a capability probe for these filters and encoders: ass/subtitles, aresample with soxr, perspective, loudnorm, ebur128, alimiter, silenceremove, libx264, aac, libmp3lame.
   - **`playwright.ts`**: resolves `SHOWCASE_PLAYWRIGHT_CORE`, then the plugin's own `node_modules` (dev), then the cache `${SHOWCASE_CACHE_DIR:-${XDG_CACHE_HOME:-~/.cache}/showcase}/pw-1.63.0/`.
     - `install()`: `npm install --prefix <cache>/pw-1.63.0 --ignore-scripts playwright-core@1.63.0`.
     - The Chromium check (the executable path exists), else `node <cache>/pw-1.63.0/node_modules/playwright-core/cli.js install chromium`, only with `--yes`.
   - **`paths.ts`**: config dir, cache dir, plugin root, and the repo root via `git rev-parse --show-toplevel`.
6. **Commands:**
   - **`doctor [--json] [--install]`**: the capability matrix (Node and TS stripping; ffmpeg and ffprobe plus each capability; playwright-core and where it was found; the Chromium executable; `say` and an en-GB voice; key status, names and source only; the planning plugin; platform notes). `--install` installs playwright-core into the cache (`--yes` to confirm).
   - **`keys status`**: each known variable, set or unset, with its source.
   - **`keys init`**: creates the directory (700) and file (600) from `skills/showcase/templates/env.template`. It never overwrites, and prints the path and an `open -e <path>` hint.
   - **`keys import <file>`**: copies only the `OPENROUTER_API_KEY` line into the user file without printing it, refusing to overwrite without `--force`.
   - **`keys test`**: a free call to `GET https://openrouter.ai/api/v1/key`. **Confirm the endpoint and its response shape in this session**, and print only non-secret fields, or the redacted status.
   - **`keys set`**: hidden input via `node:readline` with muted output. It refuses without a TTY, so Claude can't run it.
   - **`shim`**: writes `~/.local/bin/showcase`, which finds the newest `~/.claude/plugins/cache/*/showcase/*/bin/showcase`, else the dev checkout recorded when the shim was written. It warns if `~/.local/bin` isn't on PATH.
   - **`docs [topic]`**: lists or prints `skills/showcase/reference/<topic>.md`, and says so when there are none yet.
7. **`hooks/hooks.json`:**
   - **First** confirm the current PreToolUse hook input and output contract with the `claude-code-guide` agent.
   - A PreToolUse hook on `Read|Grep|Glob|Bash|Edit|Write|NotebookEdit` runs `${CLAUDE_PLUGIN_ROOT}/hooks/guard-keys.sh`.
   - The script is plain bash and grep, because it runs on every matching call in every session.
   - It denies a call whose input names the user key file, in its `~`, `$HOME`, `$XDG_CONFIG_HOME` and `$SHOWCASE_CONFIG_DIR` forms, or `showcase/.auth/`.
   - The deny reason points at `showcase keys status`. Everything else is allowed.
8. **`skills/showcase/templates/env.template`:**
   - `OPENROUTER_API_KEY=`;
   - the `SHOWCASE_TTS_MODEL`, `_VOICE`, `_INSTRUCTIONS` and `_SPEED` overrides;
   - `ELEVENLABS_API_KEY`, `OPENAI_API_KEY`, `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION`, commented out and marked as reserved.
9. **Tests** in `toolkit/test/`:
   - env precedence, using temp dirs and a scratch git repo with an ignored and an unignored `.env.local`;
   - mode refusal;
   - `process.env` left untouched by `util.parseEnv`;
   - redaction: a canary key in a thrown error or fetch body never reaches stdout or stderr;
   - `keys status` and `keys import` never print the value;
   - the guard script denies sample hook payloads that name the file, and allows others;
   - ffmpeg capability parsing;
   - CLI routing and exit codes.

## Boundaries
- No tour, runtime, voice or film code.
- Don't touch the other plugins, `.claude-plugin/marketplace.json` or `README.md` (Session 11).
- Never read or print a real key (C1). Tests use a canary only.
- gods-eye is read-only.

## Verification gate
- In `plugins/showcase`: `npm install`, then `npm test` and `npm run typecheck` pass.
- `bin/showcase doctor --json` on this Mac shows every capability present:
  - the ffmpeg 8.0.1 filters;
  - playwright-core found, or installed into the cache, with Chromium build 1243;
  - `say` with an en-GB voice.
- `bin/showcase keys status`:
  - run from `/Users/kstar/_PRJ/gods-eye`, it reports where `OPENROUTER_API_KEY` comes from, without the value;
  - run from a scratch directory, it reports the user file's state.
- The canary and hook tests pass.
- `claude plugin validate plugins/showcase` passes.

## Working rules
- PLAN.md is authoritative. If it and this file disagree, PLAN.md wins; log the discrepancy.
- Small choices: decide them and record them in the session-log entry.
- A shape-changing decision that PLAN.md doesn't settle: mark the row ⛔ `Needs decision: <question — options>` and stop.

## Finish
1. **Gate:** run every check above for real. If any fails:
   - set row 1 in `TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit;
   - **stop**.
2. **Record:**
   - Write the session summary to `.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format. Get the date from `date +%F`, and include `**Roadmap:** .planning/showcase-plugin` and the `Runtime:` this session ran at.
   - In `TRACKER.md`:
     - set row 1 to ✅;
     - fill in Key artifacts, Verification and Notes;
     - append a session-log entry: what landed, what deviated, and `Runtime: opus/medium`;
     - update the open items. Remind the user they can now run `showcase keys import ~/_PRJ/gods-eye/.env.local` (with their go), or `showcase keys set` in their own terminal after `showcase shim`.
   - Make one commit: `SKILLZ-01: Scaffold the showcase plugin: CLI, keys, doctor (showcase S1)`.
3. **Hand off:** print the kickoff prompt from `.planning/showcase-plugin/prompts/session-2.md` as a copy-pasteable blockquote, without its frontmatter. Note its profile (`/model opus`, `/effort high`), or tell the user to run `/session`.
