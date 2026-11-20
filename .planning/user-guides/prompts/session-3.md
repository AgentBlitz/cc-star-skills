---
model: opus
effort: medium
rationale: "cases follow showcase's format and the evals are the gate; failures need diagnosis"
---
Paste everything below into a fresh Claude Code session in the `cc-star-skills` repo. It has a runtime profile in the frontmatter above — set it first with `/model opus` and `/effort medium` (autopilot applies it automatically).

---

# user-guides plugin roadmap — Session 3 of 12: write-guides: evals, tuning, samples for review

> Prefer **`/planning:session .planning/user-guides`**. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Read first
1. `.planning/user-guides/PLAN.md`:
   - §3: D1, D12, R9, R13–R16, R18, C8 and the **Spike verdicts** table (they decide how each case runs);
   - §5 Session 3.
2. `.planning/user-guides/TRACKER.md`: confirm Session 2 is ✅, then mark row 3 🟡.
3. `plugins/showcase/evals/`: every case and `run.sh`. This is the format to follow.
4. skill-creator, at `~/.claude/skills/synced/*/skill-creator/`: `SKILL.md` (the eval loop and description tuning), plus `scripts/run_loop.py` and `scripts/run_eval.py`.
5. The write-guides skill as Session 2 left it, the fixture's change table (R14) and the staging helper (R13).

## Objective
Prove write-guides against a no-skill baseline, tune its description, and leave samples and a frozen guide set behind.

## Do
- **The eval harness** (R16):
  - `evals/run.sh`, modelled on showcase's. It stages the plugin without `node_modules`, as an installed plugin has none, so D10's lookup is really exercised;
  - the `claude` shim, which adds `--plugin-dir` so the edited copy is tested;
  - case names start `write-guides-` (C8).
- **Cases**, each staging the fixture through the helper (R13). Where a spike verdict was "no", use its fallback (R16).
  - Headless round 1 prints and stops, and writes nothing.
  - First guides for the fixture, from answers in `guides.json`, with Round 3 recorded as `approve as proposed`.
  - Refresh after v2, starting from taken shots with v1 fingerprints (written by the case's scaffold with `kit-core.mjs`): the text is updated, and exactly the shots in R14's table are marked `retake`.
  - A non-local base URL is refused.
  - Answers given and the walk skipped: every guide is written, each picture has a card and an entry, and `notChecked[]` is non-empty.
  - Adopt (R18): guides with no `guides.json` are registered as `written`, and their images as `taken` with no fingerprint. No text is rewritten before a walk.
  - The canary in the fixture's git-ignored `private/` never appears in any run's trace.
- **skill-creator's loop** with a baseline, iterating to green. Claude Code 2.1.322 adds the baseline arm itself.
- **Trigger tuning** (`run_loop.py`, 20 queries including D1's near-misses), through a temporary `.claude/commands/write-guides.md` in this repo's root.
  - Run it with the plugin not loaded and the shim off PATH.
  - Afterwards, `git status` must show nothing left behind.
- **The best fixture run:** commit it as `plugins/user-guides/fixtures/leave-app-guides/` (R15), for Sessions 6–9 to stage, and copy it to `.planning/user-guides/samples/` for Session 4.

## Boundaries
- **Runs are billed.** Give each case a modest `runs`, use `--max-cost-usd` on wide runs, and always pass `--no-publish`.
- **The skill** changes only as far as the evals demand. A change to the contract is a `Needs decision:`.
- **No wiki-guides work** (S6–S9).

## Verification gate
- Every case passes with the skill in ≥ 2 runs.
- The difference from the baseline and the held-out trigger score are recorded in TRACKER and the summary.
- `npm test` passes, and `git status` shows no trigger-tuning leftovers.

## Standing rules
- Never open, list, read or search `/Users/kstar/_Dev/campaign-brief/briefs/`. In campaign-brief and Clarity, name the folders each search covers (`rg … <folders>`), with no recursive search from a repo root. Afterwards, say whether any search started at a root.
- campaign-brief and its transcripts are read-only. Copy structure and code patterns from them, never text, host names, space keys, page ids, people's names or tokens. The one exception is S12, which writes campaign-brief's own guides and `guides.json` under its CLAUDE.md.
- Clarity: synthetic mail only; never `docs/feedback/`; its CLAUDE.md hard rules apply; commit there only with Kam's go-ahead.
- Never stop or reconfigure any local stack (Clarity's, campaign-brief's, the source app's, k3d).
- Never publish to a real wiki without Kam's go-ahead given in that session, never handle a token or password, never push, and never create claude.ai artifacts or cloud docs. That includes eval reports: `claude plugin eval` always runs with `--no-publish`.
- Read at most 150 lines per call, and search first: this machine cuts off large reads.

## Working rules
- **PLAN.md is authoritative.** If it and this file disagree, PLAN.md wins; log the discrepancy.
- **Small choices:** decide them, and record them in the session-log entry.
- **Shape-changing decisions:** a decision that changes the plan's shape and that PLAN.md doesn't settle (a contract field, a dependency, deleting data) means you mark the row ⛔ `Needs decision: <question — options>` and stop.
- **Before committing**, run the genericity test over the lines this session adds under `.planning/` (R17). cc-star-skills is public: in `.planning/`, name wiki pages by title or role only, never by host, space key or page id (R24).
- **Unattended:** run `bash evals/run.sh` and `run_loop.py` as commands you wait for, in the foreground or in the background with Monitor. Never end the turn to wait: a headless run that ends its turn exits (D12). Invoke `claude -p … < /dev/null`.
- **Prove the edited copy ran** by its `Base directory for this skill:` line in the transcript.

## Finish
1. **Gate:** run every check above for real. If any fails:
   - set row 3 in `TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit;
   - **stop**.
2. **Record:**
   - Write the session summary to `.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/user-guides` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 3 to ✅;
     - fill in Key artifacts, Verification and Notes: the cases, the pass rates with and without the skill, the trigger score, the cost, and the path of the samples for Session 4;
     - append a session-log entry with the `Runtime:` it ran at.
   - Make one commit: `SKILLZ-01: Prove write-guides with evals and a tuned description (user-guides S3)`.
3. **Hand off:** print the kickoff prompt from `.planning/user-guides/prompts/session-4.md` as a copy-pasteable blockquote, without its frontmatter. Note its profile (`/model opus`, `/effort high`), and that it runs **by hand** (under autopilot it stops at once).
