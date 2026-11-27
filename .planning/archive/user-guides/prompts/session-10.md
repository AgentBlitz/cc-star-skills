---
model: opus
effort: high
rationale: "the first real wiki: the mock's gaps surface here, behind Kam's go-aheads"
---
Paste everything below into a fresh Claude Code session in the **Clarity repo** (`/Users/kstar/_Dev/action-tracker`), started as `cd /Users/kstar/_Dev/action-tracker && claude --plugin-dir /Users/kstar/_PRJ/cc-star-skills/plugins/user-guides --add-dir /Users/kstar/_PRJ/cc-star-skills`. It has a runtime profile in the frontmatter above — set it first with `/model opus` and `/effort high` (autopilot applies it automatically). **Run this session by hand:** under autopilot it stops at once, by design.

---

# user-guides plugin roadmap — Session 10 of 12: Checkpoint 2 · Clarity on the wiki (by hand, from Clarity)

> Prefer **`/planning:session /Users/kstar/_PRJ/cc-star-skills/.planning/user-guides`** — never a bare `/session`, which would pick up Clarity's own roadmap (`.planning/ux-opportunities/`). It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Read first
1. `/Users/kstar/_PRJ/cc-star-skills/.planning/user-guides/PLAN.md`:
   - §3: D6, D7, D8, D11, D13, R4, R10, R24;
   - §4: the **checkpoint protocol** and the working directories;
   - §5 Session 10.
2. `/Users/kstar/_PRJ/cc-star-skills/.planning/user-guides/TRACKER.md`: confirm Session 9 is ✅. Read **`## Review notes › Clarity on the wiki (read by Session 10)`**.
3. Clarity's `CLAUDE.md`. Its hard rules apply.
4. The `chrome-browser` skill, **before the first Claude in Chrome call**.
5. The plugin's wiki-guides skill (`/user-guides:wiki-guides`) and its `reference/chrome-publishing.md`.

## Checkpoint protocol: do this first
- **Headless** (autopilot), or **not started from Clarity**:
  - In cc-star-skills, set row 10 to ⛔, with Notes starting: `Needs decision: run Session 10 interactively — cd /Users/kstar/_Dev/action-tracker && claude --plugin-dir /Users/kstar/_PRJ/cc-star-skills/plugins/user-guides --add-dir /Users/kstar/_PRJ/cc-star-skills, then /planning:session /Users/kstar/_PRJ/cc-star-skills/.planning/user-guides`.
  - Write the session summary, commit in cc-star-skills (`git -C /Users/kstar/_PRJ/cc-star-skills …`, subject `SKILLZ-01: Stop at Session 10 for the by-hand run (user-guides S10)`), and **stop**.
- **Interactive, from Clarity:** mark row 10 🟡 (in cc-star-skills) and continue. If there are notes under the heading, apply them as you go.

## Objective
Clarity's guides are illustrated and published on the real wiki through Kam's Chrome. Every page is checked, and a republish changes nothing.

## Do
1. **Rehearse the Chrome path against the mock first:** Session 8's mock on localhost, in Kam's Chrome, following `chrome-publishing.md`.
2. **The shots:**
   - write Clarity's screenshot script, `scripts/user-guides/shots.mjs` (from the template, with `guides-kit.mjs`), using Clarity's own Playwright (`app.playwrightFrom`) and its seeded synthetic mail;
   - run the preflight, take the shots, and **look at every image** (the half-size review copies);
   - swap them in, then convert.
3. **Kam names the page to publish under.** It becomes the top page (R10).
4. **The test page:** publish `test-page.md` (every construct), then run the checks.
   - Any difference between the real wiki and the mock is fixed in the mock and the publisher, with tests, before a real page goes up.
5. **Then Kam's go-ahead, then publish.**
   - Check every page with `check-page`.
   - Delete the test page, with his go-ahead.
6. **Record** a line in Clarity's docs README, with his go-ahead.
7. **Fix the plugin** from the friction log, with tests, in `/Users/kstar/_PRJ/cc-star-skills/plugins/user-guides`.
8. **Commits:**
   - in Clarity (`scripts/user-guides/`, the PNGs, `guides.json`, the README line), only with Kam's go-ahead, in Clarity's style;
   - in cc-star-skills (`git -C`): the plugin fixes, the tracker and the summary.
9. **Review notes:** record Kam's verdict under TRACKER › Review notes › Clarity on the wiki.

## Boundaries
- Only through Kam's signed-in Chrome. Never a token or password, and nothing to a Cloud or unidentified wiki.
- The wiki's host, space key and page ids live only in Clarity's `guides.json`. cc-star-skills' tracker and summary name pages by title or role (R24).
- No Clarity app code. Never stop or reconfigure Clarity's stack, and ask before any seed or reset.
- No push.

## Verification gate
- No placeholder is left, and every page passes `check-page`.
- A second publish with nothing changed reports nothing to update.
- The evals pass after the fixes (in cc-star-skills: `bash plugins/user-guides/evals/run.sh`, with `--max-cost-usd`).

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
- **Shape-changing decisions:** a decision that changes the plan's shape and that PLAN.md doesn't settle means you ask Kam, then record the answer in PLAN §3 and TRACKER.
- **Before committing in cc-star-skills**, run the genericity test over the lines this session adds under `.planning/` (R17).

## Finish
1. **Gate:** run every check above for real. If any fails:
   - set row 10 in `/Users/kstar/_PRJ/cc-star-skills/.planning/user-guides/TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit in cc-star-skills;
   - **stop**.
2. **Record:**
   - Write the session summary to `/Users/kstar/_PRJ/cc-star-skills/.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/user-guides` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 10 to ✅;
     - fill in Key artifacts, Verification and Notes: pages and images published (by count), the `check-page` results, the second publish, and the mock fixes;
     - tick the open items for the wiki page and Session 10's review notes;
     - append a session-log entry with `Runtime: opus/high`.
   - Make one commit in cc-star-skills: `SKILLZ-01: Publish Clarity's guides through wiki-guides (user-guides S10)`.
   - Make Clarity's own commit only with Kam's go-ahead.
3. **Hand off:** print the kickoff prompt from `/Users/kstar/_PRJ/cc-star-skills/.planning/user-guides/prompts/session-11.md` as a copy-pasteable blockquote, without its frontmatter. Note its profile (`/model opus`, `/effort medium`), and that it runs **by hand, in cc-star-skills**.
