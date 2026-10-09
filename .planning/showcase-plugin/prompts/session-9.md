---
model: opus
effort: high
rationale: "the scope of review feedback isn't known in advance"
---
Paste everything below into a fresh Claude Code session in the `cc-star-skills` repo, started with `claude --add-dir ~/_PRJ/gods-eye`. It has a runtime profile in the frontmatter above. Set it first with `/model opus` and `/effort high`. **Run this session by hand:** under autopilot it stops at once, by design.

---

# showcase plugin roadmap — Session 9 of 13: R1 · Checkpoint: look and feel (by hand)

> Prefer **`/session`**. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Read first
1. `.planning/showcase-plugin/PLAN.md`: §3 (D14), §4 (the **checkpoint protocol**), and §5 Session 9.
2. `.planning/showcase-plugin/TRACKER.md`: confirm Session 8 is ✅. Read **`## Review notes › Look and feel (read by Session 9)`**.
3. The work under review:
   - the fixture film and its report (paths in Session 8's tracker notes);
   - `bin/showcase watch` on the fixture tour;
   - `skills/showcase/reference/interview.md`;
   - `skills/showcase/reference/narrative.md`.

## Checkpoint protocol: do this first
- **Headless** (autopilot, or no way to ask the user):
  - Set row 9 to ⛔ with Notes starting: `Needs decision: run Session 9 interactively — watch the fixture film (<path>), run "showcase watch <fixture tour>", read skills/showcase/reference/interview.md, then approve as-is or add notes under TRACKER › Review notes › Look and feel`.
  - Write the session summary, commit, and **stop**.
- **Interactive, with no notes yet:**
  - Give the user the artifact paths, and start `bin/showcase watch <fixture tour> --detach` so they can see the live demo.
  - Then ask with AskUserQuestion: **Approve as-is** · **I have notes** (they type them) · **A different narrator style** · **A different caption style**.
- **"Approve as-is":** run the gate, then mark ✅ with no other changes.
- **Notes** (or a style choice): mark row 9 🟡 and continue.

## Objective
The user's review of the look and feel — pointer, spotlight, captions, pacing, voice defaults and the interview's wording — applied before the in-app path and the skill build on them.

## Do
1. Turn the notes into a numbered checklist, and record it in the session-log entry.
2. Implement each item within the boundaries. Re-render the fixture film with `film --strict`, and re-run `watch`.
3. For each item, capture before-and-after evidence: stills, numbers or a short note.

## Boundaries
- Only what the notes ask for.
- A note that changes the plan's shape (scope, sessions, a decision) becomes ⛔ `Needs decision: <the note — options>`.
- gods-eye is read-only.

## Verification gate
- Every checklist item is closed, with evidence.
- The fixture re-render passes `film --strict`.
- `npm test` and `npm run typecheck` pass.

## Working rules
- PLAN.md is authoritative. Record what the review changed as a "Review notes — look and feel" entry in PLAN §3.
- Small choices: decide them and record them in the session-log entry.

## Finish
1. **Gate:** run every check above for real. If any fails:
   - set row 9 in `TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit;
   - **stop**.
2. **Record:**
   - Write the session summary to `.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/showcase-plugin` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 9 to ✅;
     - fill in Key artifacts, Verification and Notes (the checklist, closed);
     - append a session-log entry with `Runtime: opus/high`;
     - tick the Session 9 open item.
   - Make one commit: `SKILLZ-01: Apply the look-and-feel review (showcase S9)`.
3. **Hand off:** print the kickoff prompt from `.planning/showcase-plugin/prompts/session-10.md` as a copy-pasteable blockquote, without its frontmatter. Note its profile (`/model opus`, `/effort medium`), or tell the user to run `/session`. Sessions 10–11 can run under `/autopilot`, which stops again at Session 12.
