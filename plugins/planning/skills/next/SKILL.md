---
name: next
description: Wrap up the current session (commit + session summary) and generate a ready-to-paste continuation prompt for a fresh context.
allowed-tools: [Bash, Write, Read, Glob, Grep, Edit]
user-invocable: true
---

# Next — Wrap Up & Generate Continuation Prompt

When the user invokes `/next`, perform all the steps of a wrapup **plus** generate a continuation prompt optimised for a fresh Claude context.

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
**Commit:** <short hash> (or "no new commit" if nothing was committed)

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
```

## 3. Commit

- Stage all relevant changed files **including the session summary file** (avoid secrets like `.env`, credentials, etc.).
- If there are **no changes at all** (neither code changes nor the new session summary), skip this step.
- Write a clear, descriptive commit message summarising the work done in this session.
- Create the commit.

## 4. Generate continuation prompt

This is the critical addition over `/wrapup`. After committing, craft a **continuation prompt** — a message the user can paste into a brand-new Claude conversation to seamlessly pick up where this session left off.

### How to write the prompt

1. **Analyse the direction of travel.** Look at:
   - The user's most recent messages and requests (especially the last 2-3)
   - Work that was in-progress but not yet finished
   - Any explicit "next steps" the user mentioned
   - The logical next action given what was just completed

2. **Structure the prompt** so it:
   - Opens with a 1-2 sentence orientation (what was just done, on which branch)
   - States the specific task to do next — be concrete and actionable, not vague
   - References the session summary file path so the new context can read it for full details
   - Mentions key files that will need to be touched
   - Includes any constraints, decisions, or context that would be non-obvious to a fresh session

3. **Keep it concise** — aim for 3-8 lines. The prompt should be dense with context but not a wall of text. It should read like a message from one developer to another during a handoff.

4. **Tone**: Write it as a direct instruction/request, not a description. It should be ready to paste as-is.

### Example

```
I've just finished implementing the Keycloak OIDC provider routes (authorize, callback, logout) on the `plutified` branch — see `.planning/sessions/2026-03-18-keycloak-oidc-routes.md` for full details.

Next: wire up the client-side auth flow. The `useAuth` hook in `packages/client/src/hooks/use-auth.ts` needs to detect when Keycloak mode is active (check `AUTH_MODE` from the `/api/auth/config` endpoint) and redirect to `/api/auth/oidc/authorize` instead of showing the login form. The conditional rendering is already stubbed in `LoginPage.tsx`. Start by reading the session summary and the auth config hook at `packages/client/src/hooks/use-auth-config.ts`.
```

## 5. Report

Print to the user:

1. Commit hash (if a commit was made)
2. Path to the session summary file
3. The continuation prompt, formatted clearly so it's easy to copy. Present it inside a single markdown blockquote (`>`) so it stands out visually.

## Rules

- Review the full conversation history to write an accurate, comprehensive summary — don't just look at the git diff.
- Be specific: include file paths, function names, and concrete details — not vague descriptions.
- The session summary should give a *future Claude in a new chat* enough context to continue the work seamlessly.
- The session summary file MUST be included in the commit so the commit is a complete record of the session.
- The continuation prompt is the **primary deliverable** — spend real effort making it specific and actionable. A vague prompt like "continue working on auth" is useless. A good prompt names files, functions, and the exact next step.
- If `$ARGUMENTS` contains "no-commit" or "summary-only", skip the commit step and only write the summary + prompt.
- If the work is fully complete with no obvious next step, say so and suggest what the user might want to tackle next based on TODOs, remaining work items, or the broader project context.
