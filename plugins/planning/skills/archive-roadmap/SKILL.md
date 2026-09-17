---
name: archive-roadmap
description: Retire a finished roadmap — move .planning/<slug>/ and its session logs into .planning/archive/<slug>/, write a one-page DIGEST.md of what was built, and commit the move. Triggers on "archive the roadmap", "retire this plan", "the roadmap is done — clean it up", "archive completed roadmaps", "/archive-roadmap". Produces .planning/archive/<slug>/ holding the original plan dir, its session logs, and DIGEST.md.
allowed-tools: [Read, Write, Bash, Glob, Grep, AskUserQuestion, Agent]
argument-hint: "[plan-dir] [force]"
---

# Archive Roadmap — Retire a Finished Plan

When the user invokes `/archive-roadmap`, move a completed roadmap and its session logs out
of the active planning tree into `.planning/archive/<slug>/`, leaving a one-page digest
behind.

> **See also:** `/roadmap` scaffolds the plan, `/session` advances it, `/autopilot` loops it
> to the end — this is the last step. Archiving works because roadmap discovery is a
> **depth-1 glob** (`.planning/*/TRACKER.md`): once a roadmap sits at
> `.planning/archive/<slug>/`, `/session` and `/autopilot` stop seeing it, with no exclusion
> logic anywhere. Session summaries keep the shared format defined in the `wrapup` skill.

## 1. Locate the roadmap and check its state

- `$ARGUMENTS` may give a plan-dir path — honour it. It may also contain the bare word
  `force` (see the pending-rows check below).
- Otherwise Glob `.planning/*/TRACKER.md` and offer **all** of them via `AskUserQuestion`.
  Unlike `/session`, a tracker with **zero** pending rows is the *primary* target here — do
  not filter to pending ones.
- The archive destination is `<parent-of-plan-dir>/archive/<name>/` — normally
  `.planning/archive/<slug>/`. `/roadmap` lets the user site a plan dir elsewhere, so derive
  the parent rather than hardcoding `.planning/`.

Run these guards **before** anything moves, and stop with a clear message on any that trip:

- **Refuse a plan dir named `archive` or `sessions`.** Both would corrupt the tree.
- **Not a git repo, or `.planning` is gitignored** — check `git rev-parse --is-inside-work-tree`
  and `git check-ignore -q .planning`. Neither is fatal: degrade to plain `mv`, **skip the
  commit entirely**, and say so in the report.
- **Merge or rebase in progress** (`.git/MERGE_HEAD`, `.git/rebase-merge/`, `.git/rebase-apply/`)
  — refuse. A pathspec-scoped commit is rejected mid-merge and you would fail *after* moving
  files.
- **Autopilot may be live** — if `<plan-dir>/autopilot/autopilot.log` was modified in the last
  10 minutes, or `pgrep -f autopilot.sh` matches, warn and require confirmation (see Rules).
- **`<plan-dir>/sessions/` already exists** — stop rather than silently merging the flat logs
  into a directory the roadmap already owns.
- **Ignored files inside the plan dir** — `git status --porcelain --ignored -- <plan-dir>`.
  These become untracked at the archive path and cannot be recovered by git if lost; see the
  hazard note in step 5. Not a refusal, but it must appear in the manifest and the report.
- **Destination already exists** — a re-created slug. Mirror the `wrapup` skill's convention:
  `test -e`, then append `-2`, `-3`, … and re-check until the name is free.

Then count the tracker rows — `grep -Ec '^\|.*(⬜|🟡)'`, `'^\|.*✅'`, `'^\|.*⛔'`. If any
⬜/🟡/⛔ rows remain and `force` is **not** in `$ARGUMENTS`, ask with `AskUserQuestion`:
*Archive anyway* · *Cancel* · *Show the pending rows first*. Treat ⛔ no more harshly than ⬜
— an abandoned roadmap is exactly the thing someone most wants to archive. Archiving an
incomplete roadmap is allowed; it just gains an `## Unfinished at archive time` section in
the digest.

## 2. Attribute the session logs

Session summaries live flat in `.planning/sessions/YYYY-MM-DD-<slug>.md` and, for older
logs, carry no roadmap field. Classify every one of them into three tiers:

| Tier | Signal | Default |
|---|---|---|
| **Excluded** | a `**Roadmap:**` header field naming a **different** plan dir, **or** a `## Changes` section that names another roadmap's plan dir and not this one | never move — check this **first** |
| **Certain** | a `**Roadmap:**` header field naming this plan dir, **or** `.planning/<slug>/` inside the log's `## Changes` section | move |
| **Likely** | `.planning/<slug>/` anywhere else in the file, **or** the filename's `YYYY-MM-DD` prefix falls inside the roadmap's git date window | offer |
| **Shared** | names this slug **and** another `.planning/<other>/` that is still live | **leave in place**, and say why |

When testing for "another roadmap's plan dir", only count paths that are actual plan dirs —
**ignore `.planning/sessions/` and `.planning/archive/`**. Every log lists its own summary
file under `.planning/sessions/`, so counting that as a rival roadmap would exclude almost
everything.

**Check Excluded first.** The `**Roadmap:**` field is authoritative in *both* directions: a
log that declares a different roadmap is not yours, however well its date fits. Without this
rule the git date window — which by design matches on filename alone — drags in every
concurrent log from every other roadmap active in the same fortnight. Tested against a real
repo, that was its single largest false-positive source.

Scope the Certain check to the `## Changes` section — `awk '/^## Changes/{f=1;next} f&&/^## /{exit} f'` —
not the whole file. A slug named in a *Resumption Context* or *Suggested opening prompt*
block is a mention, not a change, and whole-file grep turns those into false positives. Use
that section-safe form, **not** `awk '/^## Changes/,/^## [A-Z]/'` — `## Changes` matches the
end pattern too, so the range collapses to the heading line and silently matches nothing.

**Do not anchor the `**Roadmap:**` match to the start of a line.** Logs in the wild run it
inline after `**Date:**` with a `·` separator. Search the file's first ~6 lines for
`\*\*Roadmap:\*\*` anywhere on the line and capture the path that follows, tolerating a
trailing slash.

Get the date window from git, which is the only signal that finds `/wrapup`- and
`/handoff`-produced logs (they have no reason to name a tracker path, so grep never sees
them):

```bash
git log --format=%ad --date=short --reverse -- <plan-dir> | head -1   # first touch
git log --format=%ad --date=short         -- <plan-dir> | head -1     # last touch
```

Keep the **trailing slash** in `.planning/<slug>/` — it is the only thing stopping slug
`auth` from matching `.planning/auth-v2/`. Do not drop it.

A `/roadmap`-creation log — the summary of the commit that first wrote `PLAN.md` — belongs
to the roadmap's history. Archive it; it is not a false positive.

## 3. Confirm the manifest

`AskUserQuestion` cannot express "move 14 of these 17", so do not try. **Print** the manifest
first, as three labelled numbered buckets, each line `N. 2026-08-13-foo.md — <first line of
its ## Summary, truncated>`, followed by the plan-dir move and its resolved destination.

Then ask **one** question — *Certain only* (default) · *Certain + Likely* · *Plan dir only,
no logs* · *Let me adjust the list*. The last option hands control back as free text ("drop
3 and 7, add 12"), which you apply and re-print.

Because the manifest prints before anything moves, a wrong answer costs a re-run, not data.

## 4. Gather the digest material — before moving anything

Do this while the original paths are still valid, so a cancellation leaves the tree
untouched. **Never `Read` a session log.** Extract sections with `awk`/`grep` via Bash so
only the extract enters context:

| DIGEST section | Source | Extraction |
|---|---|---|
| Status blockquote | tracker counts | the `grep -Ec` counts from step 1 |
| `## What was built` | `PLAN.md` §1 Context + its status blockquote | `awk '/^## 1\./,/^## 2\./'` |
| `## Key decisions` | `PLAN.md` §3 + each log's `## Decisions & Rationale` | `awk '/^## 3\./,/^## 4\./'` · `awk '/^## Decisions/,/^## Remaining/'` |
| `## Gate results` | `TRACKER.md` table rows | `grep -E '^\|'` — the status board is already a compact table |
| `## Deviations from PLAN.md` | `TRACKER.md` `## Session log` | `awk '/^## Session log/,0'` — that section exists *for* deviations |
| `## Final file map` | union of `## Changes` bullets across the logs | `awk '/^## Changes/{f=1;next} f&&/^## /{exit} f' \| grep '^- ' \| sort -u` — the same section-safe form as step 2 (`## Decisions & Rationale` is optional, so a `/start/,/end/` range would run to EOF when it's absent) |
| `## Unfinished at archive time` | the pending/blocked rows verbatim | only when incomplete |
| `## Where everything went` | the move manifest + commit hash | computed in steps 5–6 |

Two things worth getting right:

- **Derive the file map from the logs, not `PLAN.md` §6.** §6 is the *plan*, and it drifts;
  the union of `## Changes` is what actually happened. Cross-check the two and **record the
  drift** — "PLAN.md §6 listed `x.ts`; no session log touched it" is one of the most useful
  lines a digest can carry.
- **Autopilot artefacts are metadata, never content.** Never read `autopilot.log` or
  the `run-*.json` result files (named `run-<launch>-<n>.json` since v1.6.0). Emit one line — `Autopilot: N runs — log at autopilot/autopilot.log` — from
  `ls <plan-dir>/autopilot/run-*.json 2>/dev/null | wc -l`.

**Bound the work:** `wc -c` the concatenated extracts. Under ~60 KB, synthesise directly. Over
it (or more than 20 session logs), fan out to `Agent` in batches of ~10 logs, each returning
at most 15 lines, and stitch the returns — the same pattern `/roadmap` uses for its Explore
agents. Keep the common path deterministic and agent-free.

## 5. Move everything

```bash
mkdir -p <archive>                          # the PARENT only — see the warning below
git mv <plan-dir> <archive>/<slug>
mkdir -p <archive>/<slug>/sessions          # only AFTER the plan dir has landed
git mv <log1> <log2> … <archive>/<slug>/sessions/
```

> **Create the parent, never the destination.** `mkdir -p <archive>/<slug>/sessions` before
> the `git mv` makes `<archive>/<slug>` already exist, so `mv` moves the source *inside* it
> and you get `.planning/archive/<slug>/<slug>/`. Make `<archive>` only, move, then make
> `sessions/`.

### Ignored files inside the plan dir are a one-way hazard

Check this **before** moving, with `git status --porcelain --ignored -- <plan-dir>`, and
report what you find.

`.gitignore` rules are usually **path-anchored** — a real roadmap carries rules like
`/.planning/<slug>/art/*/*.webp` or `/.planning/<slug>/concepts/*`. Once the directory moves
to `.planning/archive/<slug>/`, those patterns **no longer match**: the files stop being
ignored and surface as untracked (`??`) at the new path.

Two consequences, both sharp:

- **Do not stage them.** They were excluded deliberately — generated candidates, scratch,
  large binaries. Report them; let the user decide.
- **The move is not revertible for them.** `git reset --hard` restores tracked files only, so
  a "just undo it" that deletes the archive directory destroys every ignored file inside it
  **permanently** — git never had a copy. If the user wants the archive undone, reverse it
  with `git mv` back to the original path; **never `rm -rf` an archive directory**, and
  never suggest that as a cleanup.

If the plan dir contains ignored files, say so in the report and offer to append the
equivalent rules for the new path to `.gitignore` so they stay excluded after the move.

- **Move the plan dir wholesale** — one `git mv` on the directory, never file by file. Real
  roadmap dirs grow `art/`, `concepts/`, `DESIGN-BRIEF.md`; enumerating contents silently
  drops them.
- On any non-zero exit (the dir is untracked, `.planning` is ignored, not a repo), fall back
  to plain `mv` for that path and note it.
- Then run `git status --porcelain -- .planning` and **verify the result against the
  manifest** before committing.
- Report untracked files that rode along with the directory rename, but **do not stage
  them** — `art/` may hold large binaries, and auto-staging them is a surprise commit.

## 6. Write DIGEST.md and commit

Write `<archive>/<slug>/DIGEST.md`, opening with a one-line status blockquote that mirrors
`PLAN.md`'s:

```markdown
> **Archived:** YYYY-MM-DD · **Sessions:** N/M ✅ · **Outcome:** <one line>
```

Get `YYYY-MM-DD` from `date +%F` via Bash — **do not guess it**. That blockquote is
deliberately the first line of every digest, so `head -3 .planning/archive/*/DIGEST.md` acts
as an index of the whole archive that can never go stale. Then the sections from step 4,
ending with `## Where everything went` — the move manifest, and the note that `git log
--follow <path>` recovers a moved file's history and that reversing the archive is a `git mv`
back.

Commit with an **explicit pathspec**:

```bash
git commit -m "<message in the repo's convention>" -- <old-plan-dir> <archive>/<slug> <each moved log path>
```

- The pathspec **must include the old paths**, or the staged deletions go unrecorded and you
  commit an archive copy while the original stays put — the worst possible outcome.
- Enumerate the exact moved log filenames. Do **not** pass `.planning/sessions` as a
  directory pathspec; it would sweep in an unrelated summary someone just wrote.
- A pathspec-scoped commit leaves any unrelated staged work staged and uncommitted.
- Derive the message style from `git log --oneline -5`, the way the sibling skills do — never
  hardcode a prefix.
- Skip the commit entirely if `.planning` is gitignored or this is not a git repo, and say so.

## 7. Report

Print to the user:

- The destination path.
- Sessions archived, session logs moved, and any logs **left behind** with the reason.
- The commit short hash (or why no commit was made).
- Any untracked files that rode along unstaged.
- If the roadmap was incomplete, the unfinished-sessions warning and where it is recorded.

## Rules

- **Never create `.planning/archive/TRACKER.md`.** The whole design rests on
  `.planning/archive/` not matching `.planning/*/TRACKER.md`; a tracker at that path would
  make the archive dir look like a live roadmap to `/session`, `/autopilot` and
  `autopilot.sh` simultaneously.
- **Move the plan directory wholesale, never enumerate its contents** — roadmap dirs carry
  non-canonical files that a file-by-file move drops.
- **Print the manifest before moving anything.** The user confirms once, against a complete
  list; a wrong answer must cost a re-run, not data.
- **Grep is a candidate generator, not an oracle.** `/wrapup` logs never name the tracker —
  the git date window is the only signal that finds them.
- **Leave shared logs in place.** A log that also references another live roadmap stays in
  `.planning/sessions/`; say so rather than moving it.
- **Scope the commit with pathspecs** covering both the old and new paths. Never `git add -A`,
  and never sweep up unrelated work.
- **Never archive while autopilot is running.** `autopilot.sh` runs without `set -e`, so a
  vanished `TRACKER.md` makes its `grep -c` return empty, the `[ "$PENDING" -eq 0 ]`
  completion check error out and evaluate false, and the loop keep spawning sessions against
  a gone plan dir until the two-strike no-progress brake exits 3.
- **Never `rm -rf` an archive path.** Path-anchored `.gitignore` rules stop matching after
  the move, so deliberately-ignored files (generated art, scratch, binaries) sit untracked
  inside the archive dir and `git reset --hard` cannot bring them back. Reverse a move with
  `git mv`, never with a recursive delete.
- **Archiving is one-way by design.** There is no restore flag — `DIGEST.md`'s "Where
  everything went" section is the reversal instruction.
