---
model: opus
effort: medium
rationale: "supervises Kam's run and judges the findings; the log and the score are automated"
---
Paste everything below into a fresh Claude Code session in the `cc-star-skills` repo (`/Users/kstar/_PRJ/cc-star-skills`), started with `claude`. It has a runtime profile in the frontmatter above — set it first with `/model opus` and `/effort medium` (autopilot applies it automatically). **Run this session by hand**, with Kam present and Chrome open with Claude in Chrome connected: under autopilot it stops at once, by design.

---

# platform-audit roadmap — Session 8 of 10: Trial run in Kam's Chrome (by hand)

> Prefer **`/planning:session .planning/platform-audit`**. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Headless?
If this runs without AskUserQuestion (autopilot, `claude -p`):
1. Set row 8 to ⛔ `Needs decision: run Session 8 interactively — Kam starts it in cc-star-skills with Chrome connected, then runs the skill in a second terminal (D16)`.
2. Write the session summary.
3. Commit `SKILLZ-01: Stop at Session 8 for the by-hand run (platform-audit S8)`.
4. Stop.

## Read first
1. `.planning/platform-audit/PLAN.md`:
   - §2.2, §2.3 and §2.7;
   - §3: D12, D15, D16 and R4;
   - §4: the **checkpoint protocol** and the working directories;
   - §5 Session 8.
2. `.planning/platform-audit/TRACKER.md`: confirm row 7 is ✅, read its Notes and **Review notes**, and mark row 8 🟡.
3. `plugins/audit/fixtures/partner-portal/README.md`, and `node plugins/audit/test/score-report.mjs --help`.

## Objective
Prove the skill in its real setting, on the fixture: a **fresh** Claude session with nothing but the skill, Kam's signed-in Chrome, and Kam answering the interview (D16).

## Do
1. **Preflight.**
   - Ask Kam to confirm that Chrome is running with Claude in Chrome connected.
   - `npm test` is green in `plugins/audit`.
   - `plugin.json` is at 0.9.x.
2. **Set up.**
   - Make `/Users/kstar/_PRJ/platform-audit-trial` if it isn't there: `git init` and a one-line `README.md`. Approve the write outside this repo when asked.
   - Start the fixture in the background on port 0, with `--log plugins/audit/test/.out/trial/log.jsonl`.
   - Read its URL.
3. **Part A: Kam runs the trial in their own terminal.** Give Kam these steps, as one block they can follow:
   1. Open `<url>` in Chrome and click **Sign in as demo partner**.
   2. In a second terminal: `cd /Users/kstar/_PRJ/platform-audit-trial && claude --plugin-dir /Users/kstar/_PRJ/cc-star-skills/plugins/audit`.
   3. Type `/audit:platform-audit <url>`.
   4. Answer the interview as for a real platform, except the pace: 5 s is fine on the fixture. Suggested answers: no list · try one or two · open forms, never submit · download · about 5 s · the default folder.
   5. Let it finish, then come back here.
4. **Wait**, by asking with AskUserQuestion: "Has the trial run finished?" — Finished · It stopped early (say what happened) · Abandon this trial.
5. **Check** (run each for real):
   - `check-audit.mjs` on the trial report in `/Users/kstar/_PRJ/platform-audit-trial/docs/*-audit/`, with `--inventory` from its work folder and `--private` set to a file holding `truth.json`'s `privateTerms`;
   - `score-report.mjs` on the same report: routes 1.0, and items at least 0.9;
   - the fixture log:
     - 0 `mutation` and 0 `upload`;
     - `download` only if Kam allowed downloads;
     - after any 429, the next data request came at least `Retry-After` later;
   - the trial session's transcript, the newest `.jsonl` under `/Users/kstar/.claude/projects/-Users-kstar--PRJ-platform-audit-trial/`, read with a script through `ctx_execute`:
     - tool counts;
     - any `open()` refusal, or a click on a guarded control;
     - the number of screenshots;
     - the gaps between page loads;
     - whether the probe was re-pasted or reinstalled;
     - the elapsed time.
6. **Close.**
   - Stop the fixture.
   - Write the findings, numbered, under `TRACKER.md` › Review notes › Trial findings.
   - Give Kam the report's path, and ask them to add their own notes under › Kam's notes on the trial report, or to give them in Session 9.

## Boundaries
- Only the fixture is browsed. The trial repo is never committed, here or there.
- Skill fixes wait for Session 9. The exception is a blocker that stops the trial: fix it, note it in the findings, and re-run once.

## Verification gate
- The trial report exists and passes `check-audit`.
- The score meets both thresholds.
- The log shows a read-only, paced run.
- The findings are recorded under Review notes.

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
- **Shape-changing decisions** that PLAN.md doesn't settle: mark the row ⛔ `Needs decision: <question — options>` and stop.
- **If Kam abandons the trial,** record why under Review notes, mark the row ⛔ `Needs decision: re-run the trial — when / with what changed`, and stop.
- **Before committing**, run the genericity test over the plugin and over the lines this session adds under `.planning/` (`--added`). The findings describe the fixture only.

## Finish
1. **Gate:** run every check above for real. If any fails:
   - set row 8 in `TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit;
   - **stop**.
2. **Record:**
   - Write the session summary to `.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/platform-audit` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 8 to ✅;
     - fill in Key artifacts (the trial report's path, outside this repo), Verification (the check, the score, the log counts) and Notes (the number of findings, and the elapsed time);
     - tick the open items for Chrome and the trial repo;
     - append a session-log entry with `Runtime: opus/medium (by hand)`.
   - Make one commit: `SKILLZ-01: Record the trial run in Chrome (platform-audit S8)`.
3. **Hand off:** print the kickoff prompt from `.planning/platform-audit/prompts/session-9.md` as a copy-pasteable blockquote, without its frontmatter. Note its profile (`/model opus`, `/effort high`) and that it is run by hand.
