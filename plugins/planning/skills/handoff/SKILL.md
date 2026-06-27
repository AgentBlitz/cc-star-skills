---
name: handoff
description: Hand off the current session to a fresh Claude context — do everything `/wrapup` does (commit + session summary), then surface a ready-to-paste continuation prompt. Triggers on "hand off", "continuation prompt", "resume in a fresh chat", "/handoff" (formerly /next). Not for advancing a roadmap — that's /session.
allowed-tools: [Read, Bash, Write]
user-invocable: true
---

# Handoff — Wrap Up & Surface a Continuation Prompt

When the user invokes `/handoff`, do **everything `/wrapup` does**, then surface a continuation prompt optimised for a fresh Claude context. (This command was formerly `/next`.)

> **See also:** `/wrapup` is the shared base — audit → session summary → commit. `/handoff` adds nothing to the summary *format* (it reuses wrapup's exactly) and instead surfaces a richer paste-ready prompt. `/session` advances a `/roadmap` plan by one phase and runs its own wrapup. The whole family shares one session-summary format, defined in the `wrapup` skill.

## 1. Do a full wrapup

Perform **all** steps of the `/wrapup` skill — read its `SKILL.md` and follow it exactly (audit changes → write the session summary in wrapup's template → commit once, including the summary, without amending). Honour wrapup's `no-commit` / `summary-only` `$ARGUMENTS` handling.

**Do not** redefine or fork the summary format here — wrapup's is the single shared format, so there is no template in this file by design. The one field `/handoff` cares about specially is the summary's **"Suggested opening prompt for next session"** line: fill it per step 2, because that prompt is this skill's entire reason for existing.

## 2. Make the continuation prompt excellent

The "Suggested opening prompt for next session" you write into the summary (step 1) is the deliverable. A vague prompt like "continue working on auth" is useless; a good one names files, functions, and the exact next step.

1. **Analyse the direction of travel.** Look at:
   - The user's most recent messages and requests (especially the last 2-3)
   - Work that was in-progress but not yet finished
   - Any explicit "next steps" the user mentioned
   - The logical next action given what was just completed

2. **Structure the prompt** so it:
   - Opens with a 1-2 sentence orientation (what was just done, on which branch)
   - States the specific task to do next — concrete and actionable, not vague
   - References the session summary file path so the new context can read it for full details
   - Mentions key files that will need to be touched
   - Includes any constraints or decisions that would be non-obvious to a fresh session

3. **Keep it concise** — aim for 3-8 lines. Dense with context but not a wall of text; it should read like a handoff note from one developer to another.

4. **Tone**: write it as a direct instruction/request, ready to paste as-is.

### Example

```
I've just finished implementing the Keycloak OIDC provider routes (authorize, callback, logout) on the `plutified` branch — see `.planning/sessions/2026-03-18-keycloak-oidc-routes.md` for full details.

Next: wire up the client-side auth flow. The `useAuth` hook in `packages/client/src/hooks/use-auth.ts` needs to detect when Keycloak mode is active (check `AUTH_MODE` from the `/api/auth/config` endpoint) and redirect to `/api/auth/oidc/authorize` instead of showing the login form. The conditional rendering is already stubbed in `LoginPage.tsx`. Start by reading the session summary and the auth config hook at `packages/client/src/hooks/use-auth-config.ts`.
```

## 3. Report

Print to the user:

1. Commit hash (if a commit was made).
2. Path to the session summary file.
3. The continuation prompt, re-surfaced from the summary as a single copy-paste markdown blockquote (`>`) so it stands out — this is the primary deliverable.

## Rules

- **Don't fork the summary format.** Read and reuse wrapup's; `/handoff`'s only additions are the quality of the continuation prompt and re-surfacing it to the user. This keeps the family's "one shared format" promise true.
- Review the full conversation history to write an accurate, comprehensive summary — don't just look at the git diff.
- Be specific: include file paths, function names, and concrete details — not vague descriptions.
- The continuation prompt is the **primary deliverable** — spend real effort making it specific and actionable. A good prompt names files, functions, and the exact next step.
- If the work is fully complete with no obvious next step, say so and suggest what the user might tackle next based on TODOs, remaining-work items, or the broader project context.
- If `$ARGUMENTS` contains "no-commit" or "summary-only", skip the commit (per wrapup) and only write the summary + surface the prompt.
