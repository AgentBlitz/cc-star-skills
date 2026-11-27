---
model: opus
effort: high
rationale: "Kam's notes are unknown now and may reach the safety rules"
---
Paste everything below into a fresh Claude Code session in the `cc-star-skills` repo (`/Users/kstar/_PRJ/cc-star-skills`), started with `claude --add-dir /Users/kstar/_PRJ/platform-audit-trial` (the trial report). It has a runtime profile in the frontmatter above — set it first with `/model opus` and `/effort high` (autopilot applies it automatically). **Run this session by hand**, with Kam present: under autopilot it stops at once, by design.

---

# platform-audit roadmap — Session 9 of 10: Review and fixes (by hand)

> Prefer **`/planning:session .planning/platform-audit`**. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Headless?
If this runs without AskUserQuestion (autopilot, `claude -p`):
1. Set row 9 to ⛔ `Needs decision: run Session 9 interactively — Kam reviews the trial report and gives notes`.
2. Write the session summary.
3. Commit `SKILLZ-01: Stop at Session 9 for the by-hand run (platform-audit S9)`.
4. Stop.

## Read first
1. `.planning/platform-audit/PLAN.md`:
   - §2 as the notes need it;
   - §3 (every decision);
   - §4: the **checkpoint protocol**;
   - §5 Session 9.
2. `.planning/platform-audit/TRACKER.md`: confirm row 8 is ✅, read **Review notes** › Trial findings and › Kam's notes on the trial report, and mark row 9 🟡.
3. The trial report under `/Users/kstar/_PRJ/platform-audit-trial/docs/*-audit/`: its headings first, then slices.
4. The headings of `sources/reference-audit/` (`grep -n "^#"`), to compare structure and depth.

## Objective
Kam's verdict on the trial report, measured against the reference audit, and every note dealt with.

## Do
1. **Gather the notes.** If Kam's notes are empty:
   - give Kam the trial report's path, the trial findings, and the reference audit's section list next to the trial report's;
   - ask with AskUserQuestion: Approve as-is · I have notes · Re-run the trial after the fixes.
2. **Make one numbered checklist** in the session log, from the trial findings and Kam's notes.
3. **Fix each item** in the skill text, scripts or templates, within the earlier sessions' rules:
   - the probe stays at most 12 KB (D18);
   - SKILL.md stays at most about 200 lines;
   - the interview's wording changes only with a version bump in `interview.md`.
4. **Re-run** what the fixes touch:
   - `npm test`;
   - `check-audit` and `score-report` on the trial report, where the checker or the templates changed;
   - a short rehearsal, as in Session 7 (one screen plus the hidden routes), where the walking or ground rules changed.
5. **If Kam chose a re-run,** repeat Session 8's steps 2–6 once, record that, and then close the notes.

## Boundaries
- Nothing beyond the notes. Anything bigger goes under Review notes › After 1.0, with Kam's agreement.
- No push.

## Verification gate
- Every checklist item is closed, or moved to After 1.0 with Kam's say-so.
- `npm test` is green in `plugins/audit`.
- `claude plugin validate plugins/audit` passes.
- `node plugins/audit/test/genericity.mjs` and `--added` are clean.

## Standing rules
- AgentPoker (`/Users/kstar/_Dev/AgentPoker`) and its transcripts are read-only. Copy structure and method from them, never text, product or brand names, hosts, account ids or people's names, into a tracked file.
- This repo is public: tracked files, `.planning/` included, name no host but `localhost`, `127.0.0.1`, `example.*` and the repo's own GitHub address, and no term from `sources/deny.txt` (D9). Run the genericity test over what you add before committing.
- During the build, browse nothing but the fixture on 127.0.0.1, and never contact the platform the sources describe.
- No paid runs: never run `claude plugin eval`, `evals/run.sh` or skill-creator's description loop (D17).
- Never push (the one exception: S10, on Kam's go-ahead given in that session, D13), never handle a password, token or cookie value, and never create claude.ai artifacts or cloud docs.
- Stop only the processes you started (the fixture), and touch no other stack.
- Read at most 150 lines per call, and search first: this machine cuts off large reads. Read transcripts and bundles only with scripts (`ctx_execute`), never with `Read`.

## Working rules
- **PLAN.md is authoritative.** If it and this file disagree, PLAN.md wins; log the discrepancy. A note that changes a decision in §3 is recorded there, dated, with Kam's words.
- **Small choices:** decide them, and record them in the session-log entry.
- **Before committing**, run the genericity test over the plugin and over the lines this session adds under `.planning/` (`--added`).

## Finish
1. **Gate:** run every check above for real. If any fails:
   - set row 9 in `TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit;
   - **stop**.
2. **Record:**
   - Write the session summary to `.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/platform-audit` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 9 to ✅;
     - fill in Key artifacts (the files changed), Verification and Notes (items closed and moved, and Kam's verdict in a line);
     - append a session-log entry with `Runtime: opus/high (by hand)`.
   - Make one commit: `SKILLZ-01: Apply the trial review (platform-audit S9)`.
3. **Hand off:** print the kickoff prompt from `.planning/platform-audit/prompts/session-10.md` as a copy-pasteable blockquote, without its frontmatter. Note its profile (`/model sonnet`, `/effort high`) and that it is run by hand.
