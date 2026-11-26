---
model: opus
effort: medium
rationale: "deadline-critical extraction that must keep the partner's names out of git; sets the skeleton and the genericity test every later session runs"
---
Paste everything below into a fresh Claude Code session in the `cc-star-skills` repo (`/Users/kstar/_PRJ/cc-star-skills`), started as `claude --add-dir /Users/kstar/_Dev/AgentPoker --add-dir /Users/kstar/.claude/projects/-Users-kstar--Dev-AgentPoker --add-dir /Users/kstar/.claude/plans` (read-only sources). It has a runtime profile in the frontmatter above — set it first with `/model opus` and `/effort medium` (autopilot applies it automatically). **Run it before about 14 Dec 2026.**

---

# platform-audit roadmap — Session 1 of 10: Sources and skeleton

> Prefer **`/planning:session .planning/platform-audit`**. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Read first
1. `.planning/platform-audit/PLAN.md`:
   - §1, including §1.1 (the sources) and §1.2 (the method);
   - §2.5 (the work folder) and §2.8 (the layout);
   - §3: D9, D13, C2, C4, C5, C7 and C9;
   - §5 Session 1.
2. `.planning/platform-audit/TRACKER.md`: this is the first session. Mark row 1 🟡.
3. P-2, the genericity test to adapt: `plugins/user-guides/test/genericity.mjs` and `plugins/user-guides/test/genericity.test.mjs`.
4. The fields the other plugins use: `plugins/user-guides/.claude-plugin/plugin.json` and `plugins/user-guides/package.json`.

## Objective
- Save the sources before Claude Code deletes the transcript they come from.
- Lay the `audit` plugin's skeleton.
- Put the genericity test in place before any skill text exists, and check the roadmap itself with it.

## Do
1. **Ignore first** (C7). Add these lines to `.gitignore` **before** copying anything, under a comment such as `# audit plugin: sources, test output, eval results, work folders`:
   - `.planning/platform-audit/sources/`
   - `plugins/audit/test/.out/`
   - `plugins/audit/evals/results/`
   - `**/.platform-audit/`

   Confirm each with `git check-ignore -v`.
2. **Copy the sources** into `.planning/platform-audit/sources/`. Extract from the transcript with a script (Node, or Python with `-I`, through `ctx_execute`), never with `Read`: it is 5.6 MB.
   - `plan-2026-11-13.md` ← `/Users/kstar/.claude/plans/i-have-been-asked-greedy-river.md`.
   - `reference-audit/` ← the two markdown files of the only folder ending in `-audit` under `/Users/kstar/_Dev/AgentPoker/docs/` (find it with `ls`).
   - `memory-note.md` ← the note on the platform audit that `~/.claude/projects/-Users-kstar--Dev-AgentPoker/memory/MEMORY.md` lists.
   - From `~/.claude/projects/-Users-kstar--Dev-AgentPoker/0c8feb2a-0aa8-4069-8103-bcae0567c975.jsonl`:
     - `interview.json`: the one AskUserQuestion call's input, and its result;
     - `scripts/`: the content of every Write call whose path is in that session's scratchpad folder, under its base name. These are the four parser scripts (`extract.js`, `gql_summary.js`, `labels.js`, `appendix.js`) and `audit-progress.md`;
     - `page-js/NN.js`: the `text` of every `mcp__claude-in-chrome__javascript_tool` call, numbered in order;
     - `browser-batch/NN.json`: the input of every `mcp__claude-in-chrome__browser_batch` call;
     - `bash/NN.sh`: every Bash command, headed by a comment with its description;
     - `final-message.md`: the last assistant text message.
   - `README.md`: an index with counts by kind, and which later session reads what:
     - S2: `scripts/`, `page-js/`, `bash/`;
     - S4: `page-js/`, `browser-batch/`;
     - S5: `reference-audit/`, `scripts/appendix.js`;
     - S6: everything.

   **Expected counts** (taken on 26 Nov 2026): 16 `javascript_tool` calls, 51 `browser_batch` calls, 81 Bash calls, and 10 Write calls, of which 5 are in the scratchpad.
3. **`sources/deny.txt`.** One term per line, distinctive terms only:
   - the partner's hosts and their domain;
   - its product name and short forms, both as words and in the forms they take in paths, such as kebab case;
   - its brand and platform codes;
   - the account's id, and fragments of its name and email;
   - group names peculiar to the platform.

   Leave out ordinary words, such as a display name that is a plain English word, because they would fail innocent text. A comment at the top describes the contents by kind, not by value. Gather candidates from the copies with `ctx_execute`, printing only counts and the terms you keep.
4. **The skeleton:**
   - `plugins/audit/.claude-plugin/plugin.json` at 0.1.0, with the same fields as the other plugins:
     - `name`: `audit`;
     - `version` and `license` (`MIT`);
     - `description`: one sentence on what `/audit:platform-audit` will do;
     - `author`, `homepage`, `repository` and `keywords`.
   - `plugins/audit/package.json`, dev only:
     - `"private": true` and `"type": "module"`;
     - a description saying that installed plugins carry no `node_modules`;
     - a `test` script, `node --test --test-concurrency=1 "test/*.test.mjs"`, and a `genericity` script, `node test/genericity.mjs`;
     - `engines`: Node ≥ 20;
     - no dependencies yet; S4 adds `playwright-core`.
   - `plugins/audit/skills/platform-audit/SKILL.md`: a stub with `name`, a one-line `description` and `disable-model-invocation: true`. S6 replaces it.
5. **The genericity test**, `plugins/audit/test/genericity.mjs` and `plugins/audit/test/genericity.test.mjs`, adapted from P-2:
   - the host rule allows `localhost`, `127.0.0.1`, `0.0.0.0`, `example.*` and `github.com/AgentBlitz/cc-star-skills`;
   - the deny-list rule reads `.planning/platform-audit/sources/deny.txt`; when the file is absent, that rule is skipped, and the report says so;
   - the modes:
     - no arguments: the plugin's tracked files, and its new files that aren't ignored;
     - `<path>…`: those files;
     - `--added`: the lines added under `.planning/platform-audit/` since HEAD, and new files there that aren't ignored;
     - `--text "<line>"…`: those lines;
   - the test covers each rule and mode with made-up terms, never real ones.
6. **Check the scaffold once.** The roadmap was written before the deny-list existed, so run the deny-list rule over every file in `.planning/platform-audit/` except `sources/`. Fix any hit by rephrasing, never by weakening the list.

## Boundaries
- No skill text, scripts or fixture yet.
- Nothing from `sources/` goes into a tracked file. Describe the sources by counts and kinds only, in the summary and the tracker as well.
- AgentPoker, its transcripts and the plans folder are read-only.
- No network.

## Verification gate
- `git ls-files .planning/platform-audit/sources` prints nothing, and `git check-ignore -q` passes for each of the four ignored paths.
- `sources/` holds the expected counts, its `README.md` and `deny.txt`, or the ⛔ path in the working rules was taken.
- `npm test` passes in `plugins/audit`.
- These are clean, with the deny-list present:
  - `node plugins/audit/test/genericity.mjs`;
  - `node plugins/audit/test/genericity.mjs .planning/platform-audit/PLAN.md .planning/platform-audit/TRACKER.md .planning/platform-audit/prompts/*.md`.
- `claude plugin validate plugins/audit` passes.

## Standing rules
- AgentPoker (`/Users/kstar/_Dev/AgentPoker`) and its transcripts are read-only. Copy structure and method from them, never text, product or brand names, hosts, account ids or people's names, into a tracked file.
- This repo is public: tracked files, `.planning/` included, name no host but `localhost`, `127.0.0.1`, `example.*` and the repo's own GitHub address, and no term from `sources/deny.txt` (D9). Run the genericity test over what you add before committing.
- During the build, browse nothing but the fixture on 127.0.0.1, and never contact the platform the sources describe.
- No paid runs: never run `claude plugin eval`, `evals/run.sh` or skill-creator's description loop (D17).
- Never push (the one exception: S10, on Kam's go-ahead given in that session, D13), never handle a password, token or cookie value, and never create claude.ai artifacts or cloud docs.
- Stop only the processes you started (the fixture), and touch no other stack.
- Read at most 150 lines per call, and search first: this machine cuts off large reads. Read transcripts and bundles only with scripts (`ctx_execute`), never with `Read`.

## Working rules
- **PLAN.md is authoritative.** If it and this file disagree, PLAN.md wins; log the discrepancy.
- **Small choices:** decide them, and record them in the session-log entry.
- **Shape-changing decisions** that PLAN.md doesn't settle (a dependency, a contract change, deleting data): mark the row ⛔ `Needs decision: <question — options>` and stop.
- **If the transcript is gone, or the counts don't match:** copy what exists, record exactly what was found (as counts), and mark the row ⛔ `Needs decision: <what is missing> — continue without it / recover it another way`.
- **Before committing**, run the genericity test you build here over the plugin and over the lines this session adds under `.planning/` (`--added`).
- **Unattended:** wait for every long command in the foreground, or in the background with Monitor. Never end the turn to wait: a headless run that ends its turn exits.

## Finish
1. **Gate:** run every check above for real. If any fails:
   - set row 1 in `TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit;
   - **stop**.
2. **Record:**
   - Write the session summary to `.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/platform-audit` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 1 to ✅;
     - fill in Key artifacts (the plugin at 0.1.0, the stub skill, the genericity test, the `.gitignore` lines), Verification and Notes (the `sources/` counts by kind, and anything Session 2 must know);
     - tick the open item "Run Session 1 before about 14 Dec 2026";
     - append a session-log entry (what landed, any deviation from PLAN.md) with the `Runtime:` it ran at, e.g. `Runtime: opus/medium (autopilot attempt 1)`.
   - Make one commit: `SKILLZ-01: Scaffold the audit plugin and save its sources (platform-audit S1)`.
3. **Hand off:** print the kickoff prompt from `.planning/platform-audit/prompts/session-2.md` as a copy-pasteable blockquote, without its frontmatter. Note its profile (`/model opus`, `/effort high`), or tell the user to run `/planning:session .planning/platform-audit`.
