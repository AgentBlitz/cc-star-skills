---
name: calibrate-roadmap
description: Rate every pending session of a roadmap and give it a runtime profile — which model (sonnet / opus / fable) and how much effort (low → max) — so autopilot spends the heavy model only where it pays. Runs as a step inside /roadmap, or standalone to retrofit an existing roadmap or re-rate one after sessions escalated or blocked. Triggers on "calibrate the roadmap", "assign a model to each session", "which model and effort per session", "re-rate the sessions", "/calibrate-roadmap". Writes a Runtime line per session into PLAN.md and YAML frontmatter onto each prompts/session-N.md.
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion]
argument-hint: "[plan-dir] [guidance]"
effort: max
---

# Calibrate Roadmap — Give Every Session a Runtime Profile

A roadmap is a mix: mostly mechanical sessions (scaffolding, wiring, docs) and a few genuinely hard ones (design, cross-cutting refactors, subtle correctness). One model and effort for the whole run is either wasteful or under-powered. This skill is the **second pass** over a finished session list: it rates each session and records a **runtime profile** — `model` + `effort` + a one-line rationale — that `/autopilot` applies per session and a human can apply by hand with `/model` and `/effort`.

It is a separate pass on purpose. Difficulty is only visible **relative to the whole set**, and it is judged on a different axis from sizing: `/roadmap` sizes sessions by *context volume* (does it fit one window?); this rates them by *reasoning density* (what kind of thinking is the bottleneck, and what happens if it is subtly wrong?).

> **See also:** `/roadmap` scaffolds the plan and runs this as its calibration step; `/autopilot` consumes the profiles; `/session` records the runtime each session actually ran at. A profile is the *starting* runtime — autopilot escalates on its own when a session genuinely stalls.

## When this runs

- **From `/roadmap`** — the sessions exist in `PLAN.md` §5 but the prompts aren't written yet. Do steps 2–4, then write **PLAN.md only** (step 5a–b); `/roadmap` emits the frontmatter when it writes the prompts.
- **Standalone** — to retrofit a roadmap that predates profiles, or to **re-rate** one after evidence arrived: a session went ⛔, autopilot had to escalate, or the user says the ratings feel wrong. Do every step.

## 1. Locate the roadmap

- `$ARGUMENTS` may open with a plan-dir path — honour it. Any text after the path is **guidance** (e.g. "session 5 needed opus at max — bump the ones like it").
- Otherwise Glob `.planning/*/TRACKER.md`; if several have pending (⬜/🟡) rows, use `AskUserQuestion` to pick one. If none exist, say to run `/roadmap` first and stop.

## 2. Read the evidence

- **`PLAN.md` §5** — every session's Objective / Do / Boundaries / Verification gate. Read them all before rating any: calibration is relative.
- **`TRACKER.md`** — which sessions are ✅ (never re-rate those), which went ⛔ and why, and the `Runtime:` lines in the session log: they record what each session *actually* ran at, and `attempt 2` or higher means autopilot had to escalate — the profile was too light.
- **Existing frontmatter** on `prompts/session-N.md`, when re-rating.
- **Escalation history**, if autopilot has run — via Bash, never `Read` (the log is long):
  `grep -E 'rung=[2-9]/' <plan-dir>/autopilot/autopilot.log | cut -c1-220`
- **The guidance** in `$ARGUMENTS`.

## 3. Rate each pending session

Answer two separate questions per session. Don't collapse them into one "difficulty" number — a session can need a strong model at modest effort, or a modest model at high effort.

**Model — what kind of thinking is the bottleneck?**

| Model | Use when the session is… | Tell-tale wording in its Do list |
|---|---|---|
| `sonnet` | **pattern-following** — the shape of the answer already exists in the repo or the plan | scaffold, wire up, add config, mirror X for Y, rename, write docs, tests that copy existing ones, templated migrations |
| `opus` | **judgement** — it has to make design choices the plan leaves open, or find a cause | design, decide, investigate, debug, refactor across modules, integrate, reconcile, "figure out" |
| `fable` | **reasoning-bound** — being subtly wrong is expensive and hard to see | correctness-critical algorithms, concurrency or distributed state, security / auth / money, invariants that span the system, or anything that already went ⛔ or needed escalation |

**Effort — how much is at stake if it is subtly wrong, and will the gate catch it?**

| Effort | Use when |
|---|---|
| `low` | mechanical work **and** a strong automated gate (tests, types, lint) that would catch a mistake |
| `medium` | mechanical work with a weaker gate, or a little judgement |
| `high` | the default for anything with design or debugging in it |
| `max` | the hardest sessions: weak or manual gates, wide blast radius, irreversible steps |

(`xhigh` is accepted if a human sets it by hand; this rubric doesn't emit it.)

**Modifiers — apply after the tables:**
- A **strong automated gate** lets you drop one step (a mistake gets caught cheaply). A **manual or weak gate** moves you up one.
- The **first session of a new subsystem** moves up — later sessions copy whatever it establishes.
- **History wins over reading:** a session like one that went ⛔ or was escalated moves up to at least what finally worked.
- **Unsure → `opus / high`.** Under-powering a session costs a whole failed run; over-powering costs a little more for one run.

**Then a consistency pass over the whole set:** similar sessions get the same profile; and check the distribution — a plan rated all `fable / max` (or all `sonnet / low`) has not been calibrated, it has been defaulted. The point is to spend the heavy model where it pays.

## 4. Confirm

Show the ratings as a table — `# | Session | Model | Effort | Why` (one short clause of rationale each; note which rows are unchanged when re-rating) — then ask **one** `AskUserQuestion`:

- **Accept** (recommended)
- **Heavier across the board** — move every pending session up one step: effort first (`low → medium → high → max`), and a session already at `max` moves up a model.
- **Lighter across the board** — the reverse, but never below `sonnet / low`, and never lighten a session you rated `fable` for correctness reasons without saying so.

Free-text answers ("make 4 and 7 opus/max") are edits — apply them and carry on.

## 5. Write

a. **`PLAN.md` §5** — in each rated session's subsection, add (or replace) one line after its Verification gate:

   `**Runtime:** opus / high — <one-clause rationale>`

b. **`PLAN.md` §4 "How the sessions work"** — add (or refresh) this paragraph:

   > **Runtime profiles.** Each session carries a `Runtime:` line (model / effort) — advice for a human running it by hand (`/model`, `/effort`) and a contract for `/autopilot`, which applies it per session. When a run makes no tracker progress autopilot classifies it first — needs a human, environment failure, yielded early, or a genuine stall — and only a stall is escalated (same model at `max`, then the next model up). Each session's log entry records the `Runtime:` it actually ran at.

c. **`prompts/session-N.md`** *(skip when invoked from `/roadmap` — it writes these itself)* — add (or replace) a YAML block as the **very first lines** of the file; never touch the body below it:

   ```markdown
   ---
   model: opus
   effort: high
   rationale: cross-cutting refactor across three modules with a manual gate
   ---
   Paste everything below into a fresh Claude Code session …
   ```

   This block is what `autopilot.sh` parses, so keep it exact: line 1 is `---`; keys are `model`, `effort`, `rationale`; a closing `---`; `model` is `sonnet`, `opus` or `fable`; `effort` is `low`, `medium`, `high` or `max`; wrap `rationale` in double quotes if it contains `: `. It must match the `Runtime:` line in PLAN.md.

## 6. Report

Print the final table, the files changed, and:
- `/autopilot` now picks the profiles up **with no flags**; an explicit `--model` / `--effort` overrides every session for that run.
- Running by hand: the profile is at the top of each prompt file — set it with `/model <model>` and `/effort <effort>` before pasting.
- A later ⛔, or `Runtime: … (autopilot attempt 2)` lines appearing in the tracker, is the cue to run `/calibrate-roadmap` again.

## Rules

- **PLAN.md is authoritative**; a prompt's frontmatter must say the same thing as its `Runtime:` line.
- **Never re-rate a ✅ session** — its `Runtime:` line is history.
- **Three models, four efforts.** Don't invent tiers, and don't write model IDs — the aliases (`sonnet`, `opus`, `fable`) are what `claude --model` takes and they survive model upgrades.
- **A profile is a floor, not a ceiling** — autopilot may escalate above it; it never runs below it.
- **Every rationale is one clause a reviewer can argue with** ("templated CRUD, tests mirror `users.test.ts`"), not a restatement of the tier ("hard session").
- Don't add files beyond what `/roadmap` allows (`PLAN.md`, `TRACKER.md`, `prompts/session-*.md`).
