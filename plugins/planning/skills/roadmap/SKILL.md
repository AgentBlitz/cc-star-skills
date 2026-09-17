---
name: roadmap
description: Turn a large goal — or a set of existing planning/spec docs, or an already-approved plan — into a phased, multi-session build plan where each session fits one fresh context window and carries its own model/effort runtime profile. Triggers on "break this into sessions", "make a multi-session plan", "roadmap this", "scaffold a phased plan". Produces .planning/<slug>/ with PLAN.md, TRACKER.md, and one kickoff prompt per session.
allowed-tools: [Read, Write, Glob, Grep, Bash, Agent, AskUserQuestion]
argument-hint: "[goal | docs path | approved plan]"
effort: max
---

# Roadmap — Scaffold a Planned Multi-Session Build

When the user invokes `/roadmap`, turn a big goal into a phased plan that runs **one session per fresh context window**, then run each session with `/session`.

> **See also:** `/session` runs the next pending session of a roadmap; `/calibrate-roadmap` rates each session's model/effort (step 4 here, and re-runnable on its own); `/archive-roadmap` retires a finished one into `.planning/archive/`; `/wrapup` and `/handoff` handle single-session housekeeping. This family shares one session-summary format (defined in the `wrapup` skill).

## When to use this vs plan mode

The deciding question is: **will the work outlive one context window?**

- **Yes → use `/roadmap`.** Multi-day work, work that spans many fresh sessions, or work that starts from a pile of spec docs. `/roadmap` writes durable artifacts (`PLAN.md` + `TRACKER.md` + per-session prompts) into the repo so progress survives across conversations. Reach for it *up front* — don't run it inside plan mode, because it *is* the planning step.
- **No → use normal plan mode.** One-and-done tasks that fit a single context don't need a roadmap; an ephemeral plan is enough.
- **Surprised mid-plan?** If a plan-mode plan turned out unexpectedly large, that approved plan is excellent *input* — feed it straight into `/roadmap` (see step 1).

This is always **user-invoked**, never automatic. Most tasks never need it.

## 1. Ingest the goal

Take the goal from `$ARGUMENTS`. Valid input sources, in priority order:

1. **An already-approved plan-mode plan** — e.g. a `~/.claude/plans/*.md` file or a plan pasted into the prompt. This is a first-class input; treat its approved approach as the spine of the roadmap.
2. **Existing planning/spec docs** — paths or a glob the user points at.
3. **A bare goal string** — just a description of what to build.

If it points at docs or a prior plan, **read them and reconcile**: where they conflict, state the conflict explicitly and which one wins (and why). Capture these in PLAN.md's "Cross-cutting decisions & reconciliations" section.

Optionally launch up to **3 Explore agents in parallel** to ground the plan in the actual codebase — existing patterns, utilities to reuse, the current architecture. Record which existing code is **frozen / signed off** (do not change) vs. **to-be-built**.

## 2. Clarify — small and bounded

Use `AskUserQuestion` for a *short* set of questions only. Don't over-ask — skip anything the docs or `$ARGUMENTS` already answer. Cover at most:

- **Plan-dir name/location** — default `.planning/<slug>/` where `<slug>` is a short kebab-case name for the effort.
- **Session granularity** — roughly how many sessions (e.g. ~6–8), so each fits one fresh context window.
- **Where scope ends** — the last thing this plan delivers (and what's explicitly out of scope / a later phase).
- **Genuine domain forks** — only real either/or decisions surfaced in step 1 that change the plan's shape. Settle them **now**: an unattended session cannot ask, and a decision the plan leaves open becomes a ⛔ `Needs decision:` stop later.

## 3. Write `.planning/<slug>/PLAN.md`

The authoritative plan. Open with a one-line **status blockquote** (`> **Status:** ...`), then:

- **`## 1. Context`** — why this is being built, what it is, the intended outcome, and **what's frozen / signed off**. Note any doc reconciliations and which source wins.
- **`## 2. Target architecture`** (or Overview) — the end state, with a diagram or concise description.
- **`## 3. Cross-cutting decisions & reconciliations`** — confirmed decisions and where the source docs disagreed + the resolution.
- **`## 4. How the sessions work`** — the discipline (see below): each session reads the context docs, does its work within boundaries, confirms its verification gate, updates `TRACKER.md`, and surfaces the next kickoff prompt; if a gate fails, stop and record the blocker; if it needs a decision the plan doesn't settle and cannot ask, stop with a ⛔ `Needs decision:` row. Step 4 adds the runtime-profiles paragraph here.
- **`## 5. The N sessions`** — one subsection per session, each with **Objective / Do / Boundaries / Verification gate** (step 4 adds a **Runtime** line). Size each to one fresh context window.
- **`## 6. File map`** — new / modified / unchanged files at a glance.
- **`## 7. Verification`** — how the whole thing is validated end to end.

## 4. Calibrate runtime profiles — the second pass

Only now, with **every** session written down, rate them: which model and how much effort each one needs. Do it as a separate pass, not while drafting — difficulty is only visible relative to the whole set, and it is a different axis from sizing (reasoning density, not context volume).

Read the **`calibrate-roadmap`** skill's `SKILL.md` and follow its steps 2–4 (evidence → rubric → confirm with the user), then its write steps **5a–5b only** — the `**Runtime:**` line in each §5 subsection and the runtime-profiles paragraph in §4. Don't restate or fork its rubric here. The prompt frontmatter is written in step 6 below, from these ratings.

## 5. Write `.planning/<slug>/TRACKER.md`

The live status board. Open with a blockquote stating **the RULE** verbatim:

> The last action of every session is to (1) confirm its verification gate passed, (2) update the row below, and (3) surface the next session's kickoff prompt. If a gate fails, mark the row ⛔, record the blocker here, and **stop** — do not start the next session. If you need a decision the plan doesn't settle and cannot ask for it, mark the row ⛔ with `Needs decision: <question — options>` and **stop**.

Then:

- **Status board table** with columns: `# | Session | Status | Key artifacts | Verification | Notes`. Don't add a runtime column — the status emoji on these rows are a machine contract (`/session`, `autopilot.sh` and `/archive-roadmap` all count them), and profiles live in PLAN.md and the prompts.
- **Legend:** `⬜ Not started · 🟡 In progress · ✅ Done · ⛔ Blocked`.
- **Open items / blockers checklist** (where relevant) — external dependencies that gate later work, as `- [ ]` items.
- **Session log** — a heading where each completed session appends a short entry (what landed, what deviated). Seed it with "(none yet — Session 1 is next)".

## 6. Write `.planning/<slug>/prompts/session-N.md`

One self-contained kickoff prompt per session. Each file:

- Opens with the session's **runtime profile as YAML frontmatter** — the very first lines of the file, exactly in the form the `calibrate-roadmap` skill specifies (step 5c there): `---`, `model:`, `effort:`, `rationale:`, `---`. `autopilot.sh` parses this block; it must match the `**Runtime:**` line in PLAN.md.
- Then the paste line: "Paste everything below into a fresh Claude Code session in the `<repo>` repo. It has a runtime profile in the frontmatter above — set it first with `/model <model>` and `/effort <effort>` (autopilot applies it automatically)." then a `---` divider.
- States **Session N of M** and lists the **context docs to read first** (the source/spec docs + `PLAN.md` + `TRACKER.md`, and confirm the prior session is ✅).
- Restates that session's **Objective / Do / Boundaries / Verification gate** (self-contained — the reader shouldn't need to hunt through PLAN.md).
- Ends with a **`## Finish`** block: (1) confirm the gate passed, (2) update `TRACKER.md` (row → ✅, session-log entry), (3) output the next session's kickoff prompt from `prompts/session-(N+1).md` — or declare the roadmap complete if it's the last one.
- Notes near the top that the reader can instead just run **`/session`**, which does all of this automatically.

## 7. Report

Print to the user:
- The directory created and the file count.
- The number of sessions, and the **runtime table** from step 4 (`# | Session | Model | Effort | Why`).
- How to start: paste `.planning/<slug>/prompts/session-1.md` into a fresh session, **or** just run `/session`; `/autopilot` runs them all unattended and applies each session's profile with no flags.
- That `/calibrate-roadmap` re-rates the sessions later if one blocks or autopilot has to escalate.

## Rules

- **PLAN.md is authoritative.** Everything else (tracker, prompts) serves it. Keep them consistent.
- **Each session must fit one fresh context window** — if a session looks too big, split it.
- **Every session needs a concrete, runnable verification gate** — something that can actually pass or fail, not a vague "looks done".
- **Every session carries a runtime profile**, rated in the step-4 pass; when unsure, `opus / high`.
- **Leave no open decisions in the plan.** Unattended sessions can't ask; settle forks in step 2 and record them in PLAN.md §3.
- **Reference the shared session-summary format** (defined in the `wrapup` skill) and the calibration rubric (defined in the `calibrate-roadmap` skill); never restate or fork them.
- Don't add files beyond `PLAN.md`, `TRACKER.md`, and `prompts/session-*.md`.
