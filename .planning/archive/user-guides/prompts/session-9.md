---
model: opus
effort: high
rationale: "the skill's wording and the Chrome procedure are the product; evals reach only the Node and mock paths"
---
Paste everything below into a fresh Claude Code session in the `cc-star-skills` repo. It has a runtime profile in the frontmatter above — set it first with `/model opus` and `/effort high` (autopilot applies it automatically).

---

# user-guides plugin roadmap — Session 9 of 12: wiki-guides: the skill, evals, tuning (0.9.0)

> Prefer **`/planning:session .planning/user-guides`**. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Read first
1. `.planning/user-guides/PLAN.md`:
   - §2.2 (wiki-guides' eight steps);
   - §3: D1, D5, D6, D7, D12, R14, R16, R20, R21, R28–R31 (the harness, the shots, the converters and the publisher as built), C8 and the **Spike verdicts**;
   - §5 Session 9.
2. `.planning/user-guides/TRACKER.md`: confirm Session 8 is ✅, then mark row 9 🟡.
3. `plugins/user-guides/skills/write-guides/SKILL.md`, the sibling's pattern, and Session 3's harness (`evals/run.sh`, the shim, its cases).
4. The wiki-guides reference files from Sessions 6–8: `screenshots.md`, `confluence.md`, `html.md` and `chrome-publishing.md`; and `plugins/user-guides/fixtures/mock-confluence/README.md` (the seeds, and `/__mock/state` for graders).
5. skill-creator, at `~/.claude/skills/synced/*/skill-creator/`: the loop and `scripts/run_loop.py`.

## Objective
`/user-guides:wiki-guides` orchestrates Sessions 6–8's scripts and passes its evals against a baseline. The Chrome procedure is rehearsed without Kam's Chrome.

## Do
- **`skills/wiki-guides/SKILL.md`**, orchestration only:
  - model-invocable, with a description tuned against D1's near-misses;
  - it replaces Session 1's stub, if there was one.
- **`reference/recording.md`** (step 8: where the pages are and how they are made). The other reference files exist and are only touched up.
- **Its first round:** the destination (Confluence pages, recommended; HTML files; both), which guides, the page to publish under (R10), and the release for the banner.
- **The standalone adopt path:** one round asking which files, their titles and the page tree. Existing images are registered as `taken`; no shot is invented.
- **Evals**, named `wiki-guides-…` and run through `run.sh`; where a spike verdict was "no", use its fallback:
  - first publish to an empty page (the fixture plus the mock, via the Node host);
  - republish after v2: exactly the images in R14's table are replaced, and every page reaches its next version with the new banner;
  - HTML output;
  - guides with no `guides.json` (adopt), reusing Session 8's adopted-pages scenario (R21);
  - it reads every PNG back (a `Read` of each) before the swap;
  - a renamed label is fixed, while a removed feature is set to `needs-text`;
  - Cloud refused;
  - it never asks for a token;
  - it stops before a real wiki without a go-ahead. AskUserQuestion is not offered in `-p` runs, so a question arrives as plain text, and the grader checks that nothing was published.
- **skill-creator's loop** with a baseline, and **trigger tuning**, as in Session 3: a temporary `.claude/commands/wiki-guides.md`, the plugin not loaded, the shim off PATH, and `git status` clean afterwards.
- **A rehearsal of `chrome-publishing.md`** against the mock with the Playwright MCP tools. `browser_evaluate` and `browser_file_upload` stand in for `javascript_tool` and `file_upload`. This proves the procedure without Kam's Chrome.
- **`plugin.json` 0.9.0.**
- **If the evals can't all go green this session:** set ⛔ `Needs decision: split Session 9's remaining eval work into a follow-up session — yes / no`, write the summary, commit and stop (R20).

## Boundaries
- No real wiki and no Chrome: the mock and localhost only.
- Billed runs as in Session 3: a modest `runs`, `--max-cost-usd` on wide runs, and always `--no-publish`.
- The scripts change only where an eval shows a bug. Keep the contract as it is.

## Verification gate
- Every case passes with the skill in ≥ 2 runs.
- The rehearsal passes the checks.
- The trigger score and `claude plugin details`'s token cost are recorded.
- `claude plugin validate plugins/user-guides` passes, and so does `npm test`.

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
- **Prove the edited copy ran** by its `Base directory for this skill:` line.

## Finish
1. **Gate:** run every check above for real. If any fails:
   - set row 9 in `TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit;
   - **stop**.
2. **Record:**
   - Write the session summary to `.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/user-guides` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 9 to ✅;
     - fill in Key artifacts, Verification and Notes: the cases, the pass rates with and without the skill, the trigger score, the token cost, the rehearsal, and 0.9.0;
     - append a session-log entry with the `Runtime:` it ran at.
   - Make one commit: `SKILLZ-01: Add the wiki-guides skill, evals and tuning (user-guides S9)`.
3. **Hand off:** print the kickoff prompt from `.planning/user-guides/prompts/session-10.md` as a copy-pasteable blockquote, without its frontmatter. Note its profile (`/model opus`, `/effort high`), and that it runs **by hand, from Clarity**, with the start command at the top of that prompt.
