---
model: opus
effort: high
rationale: "a real app with unknowns and privacy rules, behind Kam's live answers"
---
Paste everything below into a fresh Claude Code session in the **Clarity repo** (`/Users/kstar/_Dev/action-tracker`), started as `cd /Users/kstar/_Dev/action-tracker && claude --plugin-dir /Users/kstar/_PRJ/cc-star-skills/plugins/user-guides --add-dir /Users/kstar/_PRJ/cc-star-skills`. It has a runtime profile in the frontmatter above — set it first with `/model opus` and `/effort high` (autopilot applies it automatically). **Run this session by hand:** under autopilot it stops at once, by design.

---

# user-guides plugin roadmap — Session 5 of 12: write-guides on Clarity (by hand, from Clarity)

> Prefer **`/planning:session /Users/kstar/_PRJ/cc-star-skills/.planning/user-guides`** — never a bare `/session`, which would pick up Clarity's own roadmap (`.planning/ux-opportunities/`). It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Read first
1. `/Users/kstar/_PRJ/cc-star-skills/.planning/user-guides/PLAN.md`:
   - §3: D4, D13, R4, R9, R23, R24;
   - §4: the **checkpoint protocol** and the working directories;
   - §2.2 and §2.3 (the skill and its contract);
   - §5 Session 5.
2. `/Users/kstar/_PRJ/cc-star-skills/.planning/user-guides/TRACKER.md`: confirm Session 4 is ✅, and read its review notes.
3. Clarity's `CLAUDE.md`. Its hard rules apply to everything written in Clarity.
4. The plugin's write-guides skill, through `/user-guides:write-guides` (loaded from `--plugin-dir`).

## Checkpoint protocol: do this first
- **Headless** (autopilot), or **not started from Clarity**:
  - In cc-star-skills, set row 5 to ⛔, with Notes starting: `Needs decision: run Session 5 interactively — cd /Users/kstar/_Dev/action-tracker && claude --plugin-dir /Users/kstar/_PRJ/cc-star-skills/plugins/user-guides --add-dir /Users/kstar/_PRJ/cc-star-skills, then /planning:session /Users/kstar/_PRJ/cc-star-skills/.planning/user-guides`.
  - Write the session summary, commit in cc-star-skills (`git -C /Users/kstar/_PRJ/cc-star-skills …`, subject `SKILLZ-01: Stop at Session 5 for the by-hand run (user-guides S5)`), and **stop**.
- **Interactive, from Clarity:** mark row 5 🟡 (in cc-star-skills) and continue.

## Objective
The first real run. Write Clarity's guides with the skill, from a walk of Clarity's local stack with synthetic mail, and fix the skill from what the run teaches.

## Do
1. **Run `/user-guides:write-guides`** in Clarity:
   - **Recon:** never `docs/feedback/`. Name the folders each search covers.
   - **The interview,** which Kam answers, then the outline, which Kam approves.
   - **The local stack** on `localhost:3000` (compose project `action-tracker`). Ask Kam before any start, seed (`pnpm seed:e2e`, `seed:film`) or reset command: they replace the synthetic accounts' data.
   - **Walk** as each role with seeded synthetic mail, signing in through `scripts/e2e-session.mjs`.
   - **Write** the guides with placeholders, then run `check-guides`.
2. **The friction log:** keep one in the session-log entry. Fix the skill in `/Users/kstar/_PRJ/cc-star-skills/plugins/user-guides`, with tests.
3. **If the run won't fit one session:** set ⛔ `Needs decision: resume Session 5 guide by guide from Clarity's guides.json in a follow-up — yes / stop here`, then write the summary, commit in cc-star-skills, and stop. The approved outlines are saved at `outlined` (R9).
4. **Record:**
   - The interview answers stay word for word in Clarity's `guides.json`.
   - TRACKER › Review notes › Clarity's guides gets only decisions that change the plan, plus a pointer to that file.
5. **Commits:**
   - in Clarity, the guides folder and the `.user-guides/` ignore line, **only with Kam's go-ahead**, in Clarity's style (see its `git log`);
   - in cc-star-skills (`git -C`): the skill fixes, the tracker and the summary.

## Boundaries
- **No Clarity app code:** only the guides folder and the `.user-guides/` ignore line.
- **Synthetic mail only;** never `docs/feedback/`. Never stop or reconfigure Clarity's stack.
- **In cc-star-skills' `.planning/`,** no Clarity mail, people or hosts (R24).
- **No push.**

## Verification gate
- `check-guides` passes on Clarity's guides, and every shot is in the ledger.
- **The allowlist** (R23): every person, address and subject line in the guides appears in the tracked seed sources behind `seed:e2e` and `seed:film`, and no guide mentions `docs/feedback/`.
- The affected evals still pass (in cc-star-skills: `bash plugins/user-guides/evals/run.sh --case 'write-guides-*'`, or narrower).

## Standing rules
- Never open, list, read or search `/Users/kstar/_Dev/campaign-brief/briefs/`. In campaign-brief and Clarity, name the folders each search covers (`rg … <folders>`), with no recursive search from a repo root. Afterwards, say whether any search started at a root.
- campaign-brief and its transcripts are read-only. Copy structure and code patterns from them, never text, host names, space keys, page ids, people's names or tokens. The one exception is S12, which writes campaign-brief's own guides and `guides.json` under its CLAUDE.md.
- Clarity: synthetic mail only; never `docs/feedback/`; its CLAUDE.md hard rules apply; commit there only with Kam's go-ahead.
- Never stop or reconfigure any local stack (Clarity's, campaign-brief's, the source app's, k3d).
- Never publish to a real wiki without Kam's go-ahead given in that session, never handle a token or password, never push, and never create claude.ai artifacts or cloud docs. That includes eval reports: `claude plugin eval` always runs with `--no-publish`.
- Read at most 150 lines per call, and search first: this machine cuts off large reads.

## Working rules
- **PLAN.md is authoritative.** If it and this file disagree, PLAN.md wins; log the discrepancy.
- **Where things go:** the tracker, the summary and plugin fixes live in cc-star-skills (R4). Nothing of this roadmap goes into Clarity's `.planning/`.
- **Shape-changing decisions:** a decision that changes the plan's shape and that PLAN.md doesn't settle means you ask Kam (this session is interactive), then record the answer in PLAN §3 and TRACKER.
- **Before committing in cc-star-skills**, run the genericity test over the lines this session adds under `.planning/` (R17).

## Finish
1. **Gate:** run every check above for real. If any fails:
   - set row 5 in `/Users/kstar/_PRJ/cc-star-skills/.planning/user-guides/TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit in cc-star-skills;
   - **stop**.
2. **Record:**
   - Write the session summary to `/Users/kstar/_PRJ/cc-star-skills/.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/user-guides` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 5 to ✅;
     - fill in Key artifacts, Verification and Notes: the number of guides and shots, `check-guides` and the allowlist results, the friction-log headlines, and where Clarity's guides folder is;
     - append a session-log entry with `Runtime: opus/high`.
   - Make one commit in cc-star-skills: `SKILLZ-01: Write Clarity's guides with write-guides (user-guides S5)`.
   - Make Clarity's own commit only with Kam's go-ahead.
3. **Hand off:** print the kickoff prompt from `/Users/kstar/_PRJ/cc-star-skills/.planning/user-guides/prompts/session-6.md` as a copy-pasteable blockquote, without its frontmatter. Note its profile (`/model opus`, `/effort high`), and that Sessions 6–9 run **in cc-star-skills**, unattended or by `/planning:session .planning/user-guides` there.
