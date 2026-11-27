---
model: opus
effort: high
rationale: "sets the contract and fixture every later session builds on; the spike's gate only checks that verdicts exist"
---
Paste everything below into a fresh Claude Code session in the `cc-star-skills` repo, started with `claude --add-dir /Users/kstar/_Dev/campaign-brief` (a read-only reference). It has a runtime profile in the frontmatter above — set it first with `/model opus` and `/effort high` (autopilot applies it automatically). **Run it before about 14 Dec 2026.**

---

# user-guides plugin roadmap — Session 1 of 12: Foundations: scaffold, contract, placeholder, fixture app, eval-sandbox spike

> Prefer **`/planning:session .planning/user-guides`**. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Read first
1. `.planning/user-guides/PLAN.md`:
   - §1, including §1.1, the sources;
   - §2.3 (the contract) and §2.4 (the layout);
   - §3: D1–D3, D9–D12, R7–R17, C5–C8 and the **Spike verdicts** table;
   - §5 Session 1.
2. `.planning/user-guides/TRACKER.md`: this is the first session. Mark row 1 🟡.
3. For the spike's case format: `plugins/showcase/evals/` (each case's `case.yaml`, `prompt.md` and `graders/`, and `run.sh`).
4. For fixture and test patterns: `plugins/showcase/package.json` and `plugins/showcase/toolkit/fixtures/`.

## Objective
- Lay the plugin's skeleton and its contract.
- Build a fixture app that exercises every hard case.
- Learn the sandbox facts that later evals depend on.
- First of all, save the campaign-brief code that exists only in transcripts, before Claude Code deletes them.

## Do
1. **First, the transcripts.** They are deleted about 30 days after their last change, which was 17 Nov 2026.
   1. Add these lines to `.gitignore` **before** copying anything (C7): `.planning/user-guides/sources/`, `plugins/user-guides/test/.out/` and `plugins/user-guides/evals/results/`.
   2. From `~/.claude/projects/-Users-kstar--Dev-campaign-brief/`, copy into `.planning/user-guides/sources/`:
      - the 23 `javascript_tool` texts and the 9 `file_upload` calls of session 45 (`cb52d554-9eb1-4c54-87fc-1f1554bb6d43.jsonl`, 40 MB);
      - session 42's `walk/lib.mjs` and `w1`–`w3` (`deda8cee-dcd6-409e-878d-1d6d7a1da396.jsonl`, 6 MB).

      Extract them with a script (Node or `jq` over the JSONL, run through `ctx_execute`), never with `Read`. Leave out any token value. Name the files so that a later session can find them (e.g. `s45-js-01.js`, `s45-upload-01.json`, `s42-walk-lib.mjs`, `s42-w1.mjs`), and add a `README.md` index in `sources/`.
   3. Write `sources/deny.txt`, one per line: the hosts, space keys, page ids and people's names that those calls contain. The genericity test reads it (R17).

   These files hold internal hosts and page ids, so they never enter git. S2, S8 and S9 generalise from them.
2. **The skeleton.**
   - `plugins/user-guides/.claude-plugin/plugin.json` at 0.1.0, with no `dependencies` (D1), and the author and licence as in the other plugins.
   - The dev-only `package.json`: `node --test`, `playwright-core@1.63.0` (C5), and `engines` Node ≥ 20.
3. **The contract** (§2.3, R7, R8): `scripts/guide-set.mjs` and `reference/guide-set.md` in **both** skills, identical, with the sync test.
   - Load, validate and save, with the status transitions and their owners (R7).
   - Every field in §2.3, R8's included:
     - `publish.confluence.pages` and `topGuide`;
     - `leftOut[]` and `checks.patterns[]`;
     - the settings for each of D9's five sign-in kinds, and `app.accounts`;
     - the locator syntax for `shots[].target`;
     - repo-relative `file` and `path` values.
   - `reference/guide-set.md` fixes the exact key names, the owners and the transitions.
4. **`placeholder.mjs`** (write-guides): the SVG card (caption, role, screen) at `images/<id>.svg`, its markdown link, and alt text in the form "Screen: what to notice" (D3).
5. **`fixtures/leave-app`**, in dependency-free Node, server-rendered:
   - employee, manager and admin roles, with invented people;
   - a sign-in helper that refuses to run without an `EVAL_…` env flag (R16), and a reset;
   - a sticky header, a dialog, cards, an inbox, settings and people;
   - `--variant v2` changes two screens: on one a button is renamed, on the other a control is removed. A change table in the fixture's README lists each change and the shots it must retake (R14);
   - it listens on port 0 and prints its URL (C6);
   - a CLAUDE.md that forbids a folder, and a git-ignored `private/` folder holding a canary string, for the privacy eval. Staging generates the canary; it is never committed.
6. **Staging** (R13): a helper under `test/` that copies the fixture (v1 or v2) to a temp dir, runs `git init` with the fixture's own `.gitignore`, generates the canary into `private/` and commits. Nothing ever runs on `fixtures/leave-app` in place.
7. **The spike:** throwaway `claude plugin eval` cases under `plugins/user-guides/test/.out/spike/`, never committed. They answer:
   - SP1: can a run start and reach a server on 127.0.0.1 (the fixture; the mock comes in S8)?
   - SP2: can it start headless Chromium?
   - SP3: can it run a scaffold script such as `git init`?
   - SP4: is the skill's base directory given?

   Record each verdict and its evidence in PLAN §3's **Spike verdicts** table; a "no" takes the fallback written there (R16). Always pass `--no-publish`, and `--scaffold` where a case places files. Run anything headless as `claude -p … < /dev/null`.
8. **The genericity test** (R17).
   - It runs over the plugin's tracked files and the new files that aren't ignored.
   - It allows no host but `localhost`, `127.0.0.1` and `example.*`, and no term from `sources/deny.txt`. When that file is absent, the deny-list part is skipped, with a note.
   - It also takes lines or paths on its command line, so that a session can check what it adds under `.planning/`.

## Boundaries
- No skill text yet. If `claude plugin validate` needs a skill, write a minimal `SKILL.md` per skill with `disable-model-invocation: true`; S2 and S9 replace them.
- Nothing from `sources/` goes into a tracked file. campaign-brief and its transcripts are read-only.
- No stack is started or stopped, except the fixture's own on port 0.

## Verification gate
- `npm test` passes in `plugins/user-guides`.
- `claude plugin validate plugins/user-guides` passes.
- The spike's four verdicts are recorded in PLAN §3, and the genericity test passes.
- `sources/` is ignored: its `.gitignore` line is in, and `git ls-files .planning/user-guides/sources` prints nothing.
- `sources/` holds the 23 `javascript_tool` texts, the 9 `file_upload` calls, session 42's four files and `deny.txt`.

## Standing rules
- Never open, list, read or search `/Users/kstar/_Dev/campaign-brief/briefs/`. In campaign-brief and Clarity, name the folders each search covers (`rg … <folders>`), with no recursive search from a repo root. Afterwards, say whether any search started at a root.
- campaign-brief and its transcripts are read-only. Copy structure and code patterns from them, never text, host names, space keys, page ids, people's names or tokens. The one exception is S12, which writes campaign-brief's own guides and `guides.json` under its CLAUDE.md.
- Clarity: synthetic mail only; never `docs/feedback/`; its CLAUDE.md hard rules apply; commit there only with Kam's go-ahead.
- Never stop or reconfigure any local stack (Clarity's, campaign-brief's, the source app's, k3d).
- Never publish to a real wiki without Kam's go-ahead given in that session, never handle a token or password, never push, and never create claude.ai artifacts or cloud docs. That includes eval reports: `claude plugin eval` always runs with `--no-publish`.
- Read at most 150 lines per call, and search first: this machine cuts off large reads.

## Working rules
- **PLAN.md is authoritative.** If it and this file disagree, PLAN.md wins; log the discrepancy.
- **Small choices:** decide them, and record them in the session-log entry.
- **Shape-changing decisions:** a decision that changes the plan's shape and that PLAN.md doesn't settle (a contract field, a dependency, deleting data) means you mark the row ⛔ `Needs decision: <question — options>` and stop.
- **Before committing**, run the genericity test, which you build here, over the lines this session adds under `.planning/` (R17), including the spike-verdict rows. Describe `sources/` by counts and kinds only; nothing from it goes into the summary or the tracker.
- **If the transcripts are gone, or the counts don't match:** copy what exists, record exactly what was found, and mark the row ⛔ `Needs decision: <what is missing> — continue without it / recover it another way`.
- **Unattended:** wait for every long command (tests, eval runs) in the foreground, or in the background with Monitor. Never end the turn to wait: a headless run that ends its turn exits (D12).

## Finish
1. **Gate:** run every check above for real. If any fails:
   - set row 1 in `TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit;
   - **stop**.
2. **Record:**
   - Write the session summary to `.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/user-guides` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 1 to ✅;
     - fill in Key artifacts, Verification and Notes: the plugin at 0.1.0, the contract, the fixture, staging, the genericity test, the `sources/` counts, the spike verdicts in a line, and anything Session 2 must know;
     - tick the open item "Run Session 1 before about 14 Dec 2026";
     - append a session-log entry (what landed, any deviation from PLAN.md) with the `Runtime:` it ran at, e.g. `Runtime: opus/high (autopilot attempt 1)`.
   - Make one commit: `SKILLZ-01: Scaffold user-guides: contract, fixture app and eval spike (user-guides S1)`.
3. **Hand off:** print the kickoff prompt from `.planning/user-guides/prompts/session-2.md` as a copy-pasteable blockquote, without its frontmatter. Note its profile (`/model opus`, `/effort high`), or tell the user to run `/planning:session .planning/user-guides`.
