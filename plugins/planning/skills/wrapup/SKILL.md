---
name: wrapup
description: Commit all changes and write a session summary to .planning/sessions/ for context continuity across conversations.
allowed-tools: [Bash, Write]
argument-hint: "[no-commit | summary-only]"
context: fork
---

# Wrap Up Session

When the user invokes `/wrapup`, perform these steps in order:

## 1. Audit changes

- Run `git status` (no `-uall` flag) and `git diff` (staged + unstaged) to understand everything that changed.
- Run `git log --oneline -5` to see recent commit style.

## 2. Write session summary

Create the directory `.planning/sessions/` if it doesn't exist.

Create a file named `.planning/sessions/YYYY-MM-DD-<short-slug>.md` where:
- `YYYY-MM-DD` is today's date — get it by running `date +%F` via Bash; **do not guess it** (you have no reliable clock, and a wrong date silently misfiles the chronological session log).
- `<short-slug>` is a 2-4 word kebab-case description of the work (e.g. `add-travel-wizard`, `fix-auth-bugs`)

Before writing, check whether the path already exists (`test -e` via Bash). If it does, append a numeric suffix and re-check — `-2`, `-3`, … — until the name is free.

The file must contain these sections:

```markdown
# Session: <Title>

**Date:** YYYY-MM-DD
**Branch:** <current branch>
**Roadmap:** `.planning/<slug>` — *(include this line only when the work advanced a `/roadmap` plan; omit it entirely otherwise)*
**Runtime:** `<model>/<effort> (autopilot attempt K)` — *(include this line only when an autopilot run's system prompt supplies it; omit it entirely otherwise)*

> Do **not** include a "Commit:" field. The session file *is* the commit it ships in — `git log <session-file>` recovers the hash. Embedding the hash creates an amend loop because the file references its own commit.

> Refer to people by role, never by name, in every section — "the facilitator raised…", "a reviewer asked for…", not their name. The user is the one exception. See **Rules**.

## Summary

One paragraph describing what was accomplished in this conversation.

## Changes

- `path/to/file.ts` — brief description of what changed and why
- `path/to/other.ts` — ...
(list every file modified, added, or deleted)

## Decisions & Rationale

- Decision made → why it was chosen over alternatives
(skip this section if no non-obvious decisions were made)

## Remaining Work

- What's still left to do
- Known issues or blockers
- Suggested next steps in priority order
(write "None — work is complete." if nothing remains)

## Resumption Context

Key files to review when picking this up:
- `path/to/important-file.ts`
- ...

Suggested opening prompt for next session:
> "<a prompt the user could paste to quickly re-establish context>"
```

## 3. Commit

- Stage all relevant changed files **including the session summary file** (avoid secrets like `.env`, credentials, etc.).
- If there are **no changes at all** (neither code changes nor the new session summary), skip this step.
- Write a clear, descriptive commit message summarising the work done in this session.
- Create the commit **once** — do not amend afterward to backfill the hash into the session file. The session file deliberately omits its own commit hash.
- Report the short commit hash to the user.

## 4. Report

Print a short confirmation:
- Commit hash (if a commit was made)
- Path to the session summary file
- A one-line note about the most important next step (if any)

## Rules

- Review the full conversation history to write an accurate, comprehensive summary — don't just look at the git diff.
- Be specific: include file paths, function names, and concrete details — not vague descriptions.
- The session summary should give a *future Claude in a new chat* enough context to continue the work seamlessly.
- The session summary file MUST be included in the commit so the commit is a complete record of the session.
- **Never name an individual other than the user.** Refer to people by role ('the facilitator', 'a reviewer'), falling back to 'a colleague'. This covers colleagues, clients, reviewers, chat handles and personas alike, in the summary *and* the commit message. Session logs get indexed, searched and pushed to shared remotes, and a name written there is hard to recall.
- **`**Roadmap:**` is conditional.** Include it only when this session advanced a `/roadmap` plan, and give the real plan-dir path. It is what lets `/archive-roadmap` attribute this log to its roadmap later — but inventing a slug for unrelated work is worse than omitting the line.
- **`**Runtime:**` is conditional too**, and always sits *after* `**Roadmap:**` — `/archive-roadmap` looks for the roadmap field in the first few header lines. Only `/session` under `/autopilot` fills it, copying the runtime from the run's `Autopilot (headless) run` note; it is how `/calibrate-roadmap` learns which sessions needed escalating.
- If `$ARGUMENTS` contains "no-commit" or "summary-only", skip the commit step and only write the summary.
