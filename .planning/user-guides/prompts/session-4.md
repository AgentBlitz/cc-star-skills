---
model: opus
effort: high
rationale: "the scope of review notes isn't known in advance"
---
Paste everything below into a fresh Claude Code session in the `cc-star-skills` repo. It has a runtime profile in the frontmatter above — set it first with `/model opus` and `/effort high` (autopilot applies it automatically). **Run this session by hand:** under autopilot it stops at once, by design.

---

# user-guides plugin roadmap — Session 4 of 12: Checkpoint 1 · interview and templates (by hand)

> Prefer **`/planning:session .planning/user-guides`**. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Read first
1. `.planning/user-guides/PLAN.md`: §3 (D12, D14), §4 (the **checkpoint protocol**), and §5 Session 4.
2. `.planning/user-guides/TRACKER.md`: confirm Session 3 is ✅. Read **`## Review notes › Interview and templates (read by Session 4)`**.
3. The work under review:
   - `.planning/user-guides/samples/` (Session 3's best fixture run);
   - `plugins/user-guides/skills/write-guides/reference/interview.md`;
   - `plugins/user-guides/skills/write-guides/templates/`;
   - Session 3's eval results (paths in its tracker row).

## Checkpoint protocol: do this first
- **Headless** (autopilot, or no way to ask Kam):
  - Set row 4 to ⛔, with Notes starting: `Needs decision: run Session 4 interactively — /planning:session .planning/user-guides in cc-star-skills; Kam answers the interview rounds and reviews .planning/user-guides/samples/ and the templates, then approves as-is or adds notes under TRACKER › Review notes › Interview and templates`.
  - Write the session summary, commit (`SKILLZ-01: Stop at Session 4 for the by-hand run (user-guides S4)`), and **stop**.
- **Interactive, with notes already under the heading:** go straight to "Notes" below.
- **Interactive, with no notes yet:**
  1. Ask Kam the interview rounds **exactly as worded** in `reference/interview.md`, through AskUserQuestion, with the values detected for the fixture. He answers them as a user would.
  2. Give him the paths of the samples and the templates.
  3. Ask with AskUserQuestion: **Approve as-is** · **I have notes** (he types them) · **Change the interview** · **Change a template**.
- **"Approve as-is":** run the gate, then mark the row ✅ with no other changes.

## Objective
Kam answers the interview as a user would, and reviews the sample guides and templates. His notes are applied before Clarity sees the skill (Session 5).

## Do
1. **Record** Kam's interview answers and his verdict under TRACKER › Review notes › Interview and templates.
2. **Notes:** turn them into a numbered checklist in the session-log entry, then apply each one: the interview wording, a template, the style, or the skill's flow. Use skill-creator's viewer with Kam if it helps.
3. **Re-run the affected evals** (`bash evals/run.sh --case 'write-guides-*'`, or narrower), and `npm test`.

## Boundaries
- Only what the notes ask for. A change of scope becomes `Needs decision:`.
- No wiki-guides work.

## Verification gate
- Every note is closed with evidence: a before-and-after, or a passing case.
- The evals pass.
- `npm test` passes.

## Standing rules
- Never open, list, read or search `/Users/kstar/_Dev/campaign-brief/briefs/`. In campaign-brief and Clarity, name the folders each search covers (`rg … <folders>`), with no recursive search from a repo root. Afterwards, say whether any search started at a root.
- campaign-brief and its transcripts are read-only. Copy structure and code patterns from them, never text, host names, space keys, page ids, people's names or tokens. The one exception is S12, which writes campaign-brief's own guides and `guides.json` under its CLAUDE.md.
- Clarity: synthetic mail only; never `docs/feedback/`; its CLAUDE.md hard rules apply; commit there only with Kam's go-ahead.
- Never stop or reconfigure any local stack (Clarity's, campaign-brief's, the source app's, k3d).
- Never publish to a real wiki without Kam's go-ahead given in that session, never handle a token or password, never push, and never create claude.ai artifacts or cloud docs. That includes eval reports: `claude plugin eval` always runs with `--no-publish`.
- Read at most 150 lines per call, and search first: this machine cuts off large reads.

## Working rules
- **PLAN.md is authoritative.** If it and this file disagree, PLAN.md wins; log the discrepancy.
- **Plan-changing decisions:** if Kam decides something that changes PLAN.md, record it in PLAN §3 "Review notes" as well as in TRACKER.
- **Before committing**, run the genericity test over the lines this session adds under `.planning/` (R17).

## Finish
1. **Gate:** run every check above for real. If any fails:
   - set row 4 in `TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit;
   - **stop**.
2. **Record:**
   - Write the session summary to `.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/user-guides` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 4 to ✅;
     - fill in Key artifacts, Verification and Notes: the verdict, and the notes closed;
     - tick the open item for Session 4's review notes;
     - append a session-log entry with the `Runtime:` it ran at.
   - Make one commit: `SKILLZ-01: Close checkpoint 1: interview and templates (user-guides S4)`.
3. **Hand off:** print the kickoff prompt from `.planning/user-guides/prompts/session-5.md` as a copy-pasteable blockquote, without its frontmatter. Note its profile (`/model opus`, `/effort high`), and that it runs **by hand, from Clarity**, with the start command at the top of that prompt.
