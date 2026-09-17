---
name: session
description: Execute the next pending session of a roadmap (a .planning/<slug>/ plan produced by /roadmap), with all housekeeping built in — re-establish context, do the work, run the verification gate, write the session summary, update the tracker, commit, and surface the next session's kickoff prompt. Triggers on "run the next session", "do the next phase", "continue the roadmap", "run /session".
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion]
argument-hint: "[plan-dir | session number]"
---

# Session — Run the Next Roadmap Session

When the user invokes `/session`, execute **exactly one** pending session of a roadmap and do all the housekeeping around it. **One session per invocation — never auto-chain into the next one.**

> **See also:** `/roadmap` scaffolds the multi-session plan this runs; `/calibrate-roadmap` rates each session's model/effort; `/archive-roadmap` retires the roadmap once it's done; `/wrapup` and `/handoff` handle ad-hoc single-session housekeeping. All share one session-summary format (defined in the `wrapup` skill).

## 1. Locate the build dir + TRACKER

- `$ARGUMENTS` may give a plan-dir path or a session number — honour it if present.
- Otherwise auto-detect via Glob on `.planning/*/TRACKER.md`.
  - If exactly one has pending rows, use it.
  - If several have pending (⬜/🟡) rows, use `AskUserQuestion` to ask which roadmap to advance.
- **A ⛔ row comes first.** THE RULE says not to start the next session past a blocker:
  - If its blocker text starts with **`Needs decision:`** and you are running interactively, ask the user that question with `AskUserQuestion` (offer the options it lists), record the answer in `PLAN.md` §3 (Cross-cutting decisions), set the row to 🟡, and run it as this session.
  - Any other ⛔ (a failed gate): report the blocker and stop — it needs fixing, not skipping.
- Otherwise pick the **first ⬜ (Not started) or 🟡 (In progress) row** as this session. A 🟡 row means an earlier attempt started it: check the working tree and `.planning/sessions/` for what already landed, and continue rather than redo.

## 2. Re-establish context

Read, in this order:
1. `PLAN.md` in the build dir (the authoritative plan + cross-cutting decisions).
2. The **source/spec docs** it references.
3. `prompts/session-N.md` for the chosen session — **this file is the single source of that session's instructions** (Objective / Do / Boundaries / Verification gate). It may open with a YAML frontmatter block (`model` / `effort` / `rationale`): that is the session's runtime profile, metadata for `/autopilot` — not an instruction to you.

Mark the row 🟡 in TRACKER.md if it isn't already.

## 3. Do the work

Carry out the session's **Do** list, strictly respecting its **Boundaries** ("do not" items). Reuse existing code and patterns surfaced in PLAN.md. Stay within this session's scope — do not pull work forward from later sessions.

## 4. Run the verification gate

Run the session's **Verification gate** for real (tests, builds, curl checks, dry-runs — whatever it specifies).

### On FAIL
1. Mark the TRACKER row **⛔ Blocked** with a one-line blocker description.
2. Write the session summary (step 5 format) noting what was attempted and the blocker.
3. Commit what exists — staging the ⛔ tracker row and the summary. (If nothing is staged at all, skip the commit and say so rather than running `git commit` on an empty index.)
4. **STOP.** Surface the blocker to the user. **Do not advance** to the next session.

### On PASS — self-contained housekeeping (no need to also call `/wrapup`)

a. **Write the session summary** to `.planning/sessions/YYYY-MM-DD-<slug>.md` using the **exact format defined in the `wrapup` skill** (read that skill's `SKILL.md` and follow its summary template — do not redefine it here, to avoid drift). `<slug>` is a 2–4 word kebab-case description; append `-2` etc. if the name collides. Get `YYYY-MM-DD` from `date +%F` — do not guess it. **Always include the template's `**Roadmap:**` header field** with this build dir's path — you know it with certainty, and it is what lets `/archive-roadmap` attribute the log later. If this is an autopilot run (see *Headless runs* below), also fill the template's optional `**Runtime:**` field from the autopilot note. Note: session logs live in the shared `.planning/sessions/` dir (not under the build dir), so `/wrapup`, `/handoff`, and `/session` all use one location and format.

b. **Update TRACKER.md:** set the row to ✅, append a session-log entry (what landed, any deviations from PLAN.md), and tick any open-items the session resolved. On an autopilot run, add the `Runtime: <model>/<effort> (autopilot attempt K)` line the note gives you to that entry — it is how `/calibrate-roadmap` later learns which profiles were too light.

c. **Commit** all changes — including the session summary and the updated tracker — in **one** commit, following the repo's commit conventions (check `git log --oneline -5`). Report the short hash. Do not amend afterward. (If, unexpectedly, nothing is staged, skip the commit and report that instead of erroring.)

d. **Output the next session's kickoff prompt** from `prompts/session-(N+1).md` as a copy-pasteable markdown blockquote, ready to paste into a fresh session (or tell the user to just run `/session` again) — leave out its YAML frontmatter, but mention the profile it names (`/model …`, `/effort …`). If the session just completed was the **final** one, declare the roadmap complete instead, summarise what was built, and mention that `/archive-roadmap` will retire it out of the active planning tree.

## 5. Report

Print to the user:
- Which session ran and the gate result (PASS / ⛔ blocked).
- The commit short hash.
- The next session's kickoff prompt as a blockquote — or, on failure, the blocker; or, if finished, a roadmap-complete note.

## Headless runs (autopilot)

When the system prompt carries a line starting **`Autopilot (headless) run`**, nobody is watching and nothing can wake you. Three things change:

1. **The process ends the moment you end your turn.** Never stop to "wait" for background work — a build, a test run, a load rig, a subagent. Wait for it *synchronously* (run it in the foreground, or poll in an until-loop) and only end your turn when the session is finished: ✅ or ⛔, summary written, committed. "I'll continue once it finishes" is how a headless session dies with nothing recorded.
2. **You cannot ask.** `AskUserQuestion` and permission prompts don't exist here, and a question left in your final message just strands the run. For small choices: decide, and record the choice in the session-log entry. For a decision that **changes the plan's shape** and that PLAN.md doesn't settle — a schema, an API contract, a dependency choice, deleting data, the scale a gate must hold at — mark the row ⛔ with `Needs decision: <question — options>`, write the summary, commit, and stop (the On-FAIL steps). The next interactive `/session` asks the user and carries on.
3. **A refused tool call is not a dead end.** Hooks and deny rules still apply in unattended mode. Try a different route once; if the session genuinely needs the refused command, stop with ⛔ `Needs decision:` naming the command and why.

Record the runtime the note gives you, per steps 4a and 4b.

## Rules

- **One session per invocation. Never auto-chain.** Surfacing the next prompt is the hand-off; running it is the user's call.
- **Keep PLAN.md and TRACKER.md authoritative.** If reality deviated from the plan, update PLAN.md / TRACKER.md to match *before* finishing — the docs must reflect what actually happened.
- **Reference the wrapup summary format** rather than duplicating it, so the family never drifts.
- A failed gate is a full stop, not a warning — mark ⛔ and stop. So is a decision you can't make: ⛔ `Needs decision:` and stop.
- **Never end a headless turn to wait** — see *Headless runs*.
