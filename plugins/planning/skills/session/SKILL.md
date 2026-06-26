---
name: session
description: Execute the next pending session of a roadmap (a .planning/<slug>/ plan produced by /roadmap), with all housekeeping built in — re-establish context, do the work, run the verification gate, write the session summary, update the tracker, commit, and surface the next session's kickoff prompt. Triggers on "run the next session", "do the next phase", "continue the roadmap", "run /session".
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep, Agent]
user-invocable: true
---

# Session — Run the Next Roadmap Session

When the user invokes `/session`, execute **exactly one** pending session of a roadmap and do all the housekeeping around it. **One session per invocation — never auto-chain into the next one.**

> **See also:** `/roadmap` scaffolds the multi-session plan this runs; `/wrapup` and `/next` handle ad-hoc single-session housekeeping. All share one session-summary format (defined in the `wrapup` skill).

## 1. Locate the build dir + TRACKER

- `$ARGUMENTS` may give a plan-dir path or a session number — honour it if present.
- Otherwise auto-detect via Glob on `.planning/*/TRACKER.md`.
  - If exactly one has pending rows, use it.
  - If several have pending (⬜/🟡) rows, use `AskUserQuestion` to ask which roadmap to advance.
- Pick the **first ⬜ (Not started) or 🟡 (In progress) row** as this session.

## 2. Re-establish context

Read, in this order:
1. `PLAN.md` in the build dir (the authoritative plan + cross-cutting decisions).
2. The **source/spec docs** it references.
3. `prompts/session-N.md` for the chosen session — **this file is the single source of that session's instructions** (Objective / Do / Boundaries / Verification gate).

Mark the row 🟡 in TRACKER.md if it isn't already.

## 3. Do the work

Carry out the session's **Do** list, strictly respecting its **Boundaries** ("do not" items). Reuse existing code and patterns surfaced in PLAN.md. Stay within this session's scope — do not pull work forward from later sessions.

## 4. Run the verification gate

Run the session's **Verification gate** for real (tests, builds, curl checks, dry-runs — whatever it specifies).

### On FAIL
1. Mark the TRACKER row **⛔ Blocked** with a one-line blocker description.
2. Write the session summary (step 5 format) noting what was attempted and the blocker.
3. Commit what exists.
4. **STOP.** Surface the blocker to the user. **Do not advance** to the next session.

### On PASS — self-contained housekeeping (no need to also call `/wrapup`)

a. **Write the session summary** to `.planning/sessions/YYYY-MM-DD-<slug>.md` using the **exact format defined in the `wrapup` skill** (read that skill's `SKILL.md` and follow its summary template — do not redefine it here, to avoid drift). `<slug>` is a 2–4 word kebab-case description; append `-2` etc. if the name collides. Note: session logs live in the shared `.planning/sessions/` dir (not under the build dir), so `/wrapup`, `/next`, and `/session` all use one location and format.

b. **Update TRACKER.md:** set the row to ✅, append a session-log entry (what landed, any deviations from PLAN.md), and tick any open-items the session resolved.

c. **Commit** all changes — including the session summary and the updated tracker — in **one** commit, following the repo's commit conventions (check `git log --oneline -5`). Report the short hash. Do not amend afterward.

d. **Output the next session's kickoff prompt** from `prompts/session-(N+1).md` as a copy-pasteable markdown blockquote, ready to paste into a fresh session (or tell the user to just run `/session` again). If the session just completed was the **final** one, declare the roadmap complete instead and summarise what was built.

## 5. Report

Print to the user:
- Which session ran and the gate result (PASS / ⛔ blocked).
- The commit short hash.
- The next session's kickoff prompt as a blockquote — or, on failure, the blocker; or, if finished, a roadmap-complete note.

## Rules

- **One session per invocation. Never auto-chain.** Surfacing the next prompt is the hand-off; running it is the user's call.
- **Keep PLAN.md and TRACKER.md authoritative.** If reality deviated from the plan, update PLAN.md / TRACKER.md to match *before* finishing — the docs must reflect what actually happened.
- **Reference the wrapup summary format** rather than duplicating it, so the family never drifts.
- A failed gate is a full stop, not a warning — mark ⛔ and stop.
