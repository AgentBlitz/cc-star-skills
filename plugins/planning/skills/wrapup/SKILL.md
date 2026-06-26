---
name: wrapup
description: Commit all changes and write a session summary to .planning/sessions/ for context continuity across conversations.
allowed-tools: [Bash, Write, Read, Glob, Grep, Edit]
user-invocable: true
---

# Wrap Up Session

When the user invokes `/wrapup`, perform these steps in order:

## 1. Audit changes

- Run `git status` (no `-uall` flag) and `git diff` (staged + unstaged) to understand everything that changed.
- Run `git log --oneline -5` to see recent commit style.

## 2. Write session summary

Create the directory `.planning/sessions/` if it doesn't exist.

Create a file named `.planning/sessions/YYYY-MM-DD-<short-slug>.md` where:
- `YYYY-MM-DD` is today's date
- `<short-slug>` is a 2-4 word kebab-case description of the work (e.g. `add-travel-wizard`, `fix-auth-bugs`)

If a file with the same name already exists, append a numeric suffix (e.g. `-2`).

The file must contain these sections:

```markdown
# Session: <Title>

**Date:** YYYY-MM-DD
**Branch:** <current branch>

> Do **not** include a "Commit:" field. The session file *is* the commit it ships in — `git log <session-file>` recovers the hash. Embedding the hash creates an amend loop because the file references its own commit.

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
- If `$ARGUMENTS` contains "no-commit" or "summary-only", skip the commit step and only write the summary.
