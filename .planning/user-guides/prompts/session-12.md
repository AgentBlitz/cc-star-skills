---
model: opus
effort: high
rationale: "updates live pages in place under campaign-brief's rules, behind Kam's go-aheads"
---
Paste everything below into a fresh Claude Code session in the **campaign-brief repo** (`/Users/kstar/_Dev/campaign-brief`), started as `cd /Users/kstar/_Dev/campaign-brief && claude --plugin-dir /Users/kstar/_PRJ/cc-star-skills/plugins/user-guides --add-dir /Users/kstar/_PRJ/cc-star-skills`. It has a runtime profile in the frontmatter above — set it first with `/model opus` and `/effort high` (autopilot applies it automatically). **Run this session by hand:** under autopilot it stops at once, by design.

---

# user-guides plugin roadmap — Session 12 of 12: campaign-brief on the plugin: adopt, refresh, republish (by hand, from campaign-brief)

> Prefer **`/planning:session /Users/kstar/_PRJ/cc-star-skills/.planning/user-guides`** — never a bare `/session`, which would pick up campaign-brief's own roadmap. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Read first
1. `/Users/kstar/_PRJ/cc-star-skills/.planning/user-guides/PLAN.md`:
   - §3: D9, D13, R8, R10, R21, R22, R24, R25;
   - §4: the **checkpoint protocol** and the working directories;
   - §5 Session 12.
2. `/Users/kstar/_PRJ/cc-star-skills/.planning/user-guides/TRACKER.md`: confirm Session 11 is ✅, and that 1.0.0 is pushed.
3. campaign-brief's `CLAUDE.md`. It binds: never `briefs/`, its standing checks, and `CB-0NN` commits.
4. campaign-brief's memory note on its Confluence pages: the parent page and its five role pages.
5. campaign-brief's `.planning/links-website-creative/QUESTIONS.md`: the open items about `docs/wiki/features-and-value.md`.
6. The plugin's two skills, `/user-guides:write-guides` and `/user-guides:wiki-guides`. The `--plugin-dir` copy wins over the installed release, and it is that release until a fix lands (R22).
7. The `chrome-browser` skill, before the first Claude in Chrome call.

## Checkpoint protocol: do this first
- **Headless** (autopilot), or **not started from campaign-brief**:
  - In cc-star-skills, set row 12 to ⛔, with Notes starting: `Needs decision: run Session 12 interactively — cd /Users/kstar/_Dev/campaign-brief && claude --plugin-dir /Users/kstar/_PRJ/cc-star-skills/plugins/user-guides --add-dir /Users/kstar/_PRJ/cc-star-skills, then /planning:session /Users/kstar/_PRJ/cc-star-skills/.planning/user-guides`.
  - Write the session summary, commit in cc-star-skills (`git -C /Users/kstar/_PRJ/cc-star-skills …`, subject `SKILLZ-01: Stop at Session 12 for the by-hand run (user-guides S12)`), and **stop**.
- **Interactive, from campaign-brief:** mark row 12 🟡 (in cc-star-skills) and continue.

## Objective
campaign-brief's own guides come under the released plugin. They are adopted, brought up to the current release by a walk, and republished in place on its wiki.

## Do
1. **`write-guides` in adopt mode:**
   - the six role guides in `docs/product/guides/` and `docs/wiki/features-and-value.md`, with the images in `docs/wiki/images/` (repo-relative paths, R8);
   - record the existing Confluence pages (the parent and the five role pages, from the memory note) in campaign-brief's `guides.json`, under `publish.confluence`, never in the plugin or in cc-star-skills (D13, R24);
   - **at the start, confirm with Kam** which file feeds the parent page, the top page (R10's `topGuide`).
2. **Refresh:**
   - walk each role on the local stack, with the e2e seed's accounts;
   - bring the text up to the current release, including the open `features-and-value.md` items in `QUESTIONS.md` (R25);
   - ask Kam before any start, seed or reset.
3. **`wiki-guides`:**
   - retake every shot (adopted shots have no fingerprint, so all are `retake`), look at every image, then convert;
   - publish through Kam's Chrome: a test page first, then his go-ahead;
   - then update the existing pages in place — the five role pages, and the parent if it carries `features-and-value.md` — and add a sixth child page for the approver guide. The adopted pages need one confirmation for the batch (R21);
   - then check every page;
   - delete the test page, with his go-ahead.
4. **Close the loose ends with Kam:**
   - tick the republishing items in campaign-brief's `.planning/bonus-changes/TRACKER.md` and `.planning/links-website-creative/TRACKER.md`;
   - decide whether `scripts/wiki/` is retired;
   - decide whether `/Users/kstar/_PRJ/cc-star-skills/.planning/user-guides/sources/` is kept or deleted.
5. **campaign-brief's commit:** as `CB-0NN`, following its CLAUDE.md, with Kam's go-ahead.
6. **Fix the plugin** from the friction log, with tests. If anything changed, release a patch (R22):
   1. both JSON files to 1.0.1;
   2. `npm test`, the affected evals, and `claude plugin validate` on the plugin and on `.`;
   3. commit `SKILLZ-01: Release user-guides 1.0.1 (user-guides S12)`, then `claude plugin tag plugins/user-guides`;
   4. print the push commands, as in Session 11. Kam pushes.
7. **The closing commit** in cc-star-skills: the summary and the ✅ row, `SKILLZ-01: Close the user-guides roadmap (user-guides S12)`.

## Boundaries
- **Never `briefs/`.**
- campaign-brief's text, hosts, space key and page ids stay in campaign-brief (D9, D13). cc-star-skills' tracker and summary name pages by title or role (R24).
- No campaign-brief app code. Never stop or reconfigure its stack.
- No push.

## Verification gate
- Every page passes `check-page`.
- A second publish with nothing changed reports nothing to update.
- The approver page is under the parent.
- campaign-brief's standing checks pass, and `git ls-files briefs` prints nothing.
- If a patch was released, its tag exists and `npm test` passes.

## Standing rules
- Never open, list, read or search `/Users/kstar/_Dev/campaign-brief/briefs/`. In campaign-brief and Clarity, name the folders each search covers (`rg … <folders>`), with no recursive search from a repo root. Afterwards, say whether any search started at a root.
- campaign-brief and its transcripts are read-only. Copy structure and code patterns from them, never text, host names, space keys, page ids, people's names or tokens. The one exception is S12, which writes campaign-brief's own guides and `guides.json` under its CLAUDE.md.
- Clarity: synthetic mail only; never `docs/feedback/`; its CLAUDE.md hard rules apply; commit there only with Kam's go-ahead.
- Never stop or reconfigure any local stack (Clarity's, campaign-brief's, the source app's, k3d).
- Never publish to a real wiki without Kam's go-ahead given in that session, never handle a token or password, never push, and never create claude.ai artifacts or cloud docs. That includes eval reports: `claude plugin eval` always runs with `--no-publish`.
- Read at most 150 lines per call, and search first: this machine cuts off large reads.

## Working rules
- **PLAN.md is authoritative.** If it and this file disagree, PLAN.md wins; log the discrepancy.
- **Where things go:** the tracker, the summary and plugin fixes live in cc-star-skills (R4). Nothing of this roadmap goes into campaign-brief's `.planning/`, except the two ticks above.
- **Shape-changing decisions:** a decision that changes the plan's shape and that PLAN.md doesn't settle means you ask Kam, then record the answer in PLAN §3 and TRACKER.
- **Before committing in cc-star-skills**, run the genericity test over the lines this session adds under `.planning/` (R17).

## Finish
1. **Gate:** run every check above for real. If any fails:
   - set row 12 in `/Users/kstar/_PRJ/cc-star-skills/.planning/user-guides/TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit in cc-star-skills;
   - **stop**.
2. **Record:**
   - Write the session summary to `/Users/kstar/_PRJ/cc-star-skills/.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/user-guides` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 12 to ✅;
     - fill in Key artifacts, Verification and Notes: guides adopted and refreshed, pages updated and added (by count and title), the second publish, and the patch release if any;
     - tick the remaining open items;
     - append a session-log entry with `Runtime: opus/high`.
   - Make the commits as in Do: campaign-brief's with Kam's go-ahead; in cc-star-skills, the patch (if any) and then the closing commit.
3. **Hand off: the roadmap is complete.** Summarise what was built, and say that `/archive-roadmap` will retire `.planning/user-guides/` into `.planning/archive/`.
