---
model: opus
effort: medium
rationale: "the README and release steps follow showcase's; tests, evals, validate and the tag gate it"
---
Paste everything below into a fresh Claude Code session in the `cc-star-skills` repo. It has a runtime profile in the frontmatter above — set it first with `/model opus` and `/effort medium` (autopilot applies it automatically). **Run this session by hand:** under autopilot it stops at once, by design.

---

# user-guides plugin roadmap — Session 11 of 12: Checkpoint 3 · release (1.0.0) (by hand)

> Prefer **`/planning:session .planning/user-guides`**. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Read first
1. `.planning/user-guides/PLAN.md`:
   - §2.4 (what it adds to a target repo);
   - §3: D1, D15, R22, C2, C4;
   - §4: the **checkpoint protocol**;
   - §5 Session 11.
2. `.planning/user-guides/TRACKER.md`: confirm Session 10 is ✅. Read **`## Review notes › Release (read by Session 11)`**.
3. `README.md` (the showcase plugin's section is the model) and `.claude-plugin/marketplace.json`.
4. `.planning/sessions/2026-10-11-showcase-release.md`: how showcase's release ran, two commits and the tag.

## Checkpoint protocol: do this first
- **Headless** (autopilot, or no way to ask Kam):
  - Set row 11 to ⛔, with Notes starting: `Needs decision: run Session 11 interactively — /planning:session .planning/user-guides in cc-star-skills; Kam reviews the README section and gives the go to release`.
  - Write the session summary, commit (`SKILLZ-01: Stop at Session 11 for the by-hand run (user-guides S11)`), and **stop**.
- **Interactive:** mark row 11 🟡 and continue. If there are notes under the heading, apply them first.

## Objective
Release user-guides 1.0.0 to the public marketplace, documented for strangers.

## Do
1. **The README, for strangers:**
   - an overview row;
   - a section "The `user-guides` plugin": Which one? (write-guides or wiki-guides), Requirements (Node ≥ 20; Playwright, found as in D10; Claude in Chrome for a real wiki; Confluence Data Center), and What it adds to your repo (§2.4's list, as a table);
   - the Install, Updating and Layout sections.
2. **The marketplace entry** and its description. The plugin is enabled by default (D1).
3. **1.0.0** in `plugins/user-guides/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`.
4. **Every test and eval:**
   - `npm test`;
   - `bash plugins/user-guides/evals/run.sh`, with `--max-cost-usd`;
   - `claude plugin validate plugins/user-guides` and `claude plugin validate .`.
5. **Ask Kam,** with the README section on screen: **Approve as-is** · **I have notes**. Notes are applied before the release.
6. **The release** (R22; `claude plugin tag` refuses a dirty working tree):
   1. the release commit: `SKILLZ-01: Release user-guides 1.0.0 (user-guides S11)`;
   2. `claude plugin tag plugins/user-guides`, which makes `user-guides--v1.0.0` (`--dry-run` first);
   3. print the exact push commands for Kam:
      - `git push origin main refs/tags/user-guides--v1.0.0`
      - `GIT_SSH_COMMAND='ssh -o ConnectTimeout=10' git push GITLAB main refs/tags/user-guides--v1.0.0` (that host is often unreachable, and a push to it can hang).

   **Kam pushes.**
7. **After the push,** with Kam's go-ahead: update the marketplace, install `user-guides@cc-star-skills` in a fresh session, and check that both skills are listed.
8. **The closing commit:** the summary and the ✅ row, `SKILLZ-01: Close the user-guides release session (user-guides S11)`.

## Boundaries
- No push by the session.
- Nothing but the README, the marketplace entry, the versions, and fixes the release needs.

## Verification gate
- `claude plugin validate` passes on the plugin and on `.`.
- The tag `user-guides--v1.0.0` exists.
- After Kam's push, `/plugin install user-guides@cc-star-skills` in a fresh session lists both skills.
- Every test and eval passes.

## Standing rules
- Never open, list, read or search `/Users/kstar/_Dev/campaign-brief/briefs/`. In campaign-brief and Clarity, name the folders each search covers (`rg … <folders>`), with no recursive search from a repo root. Afterwards, say whether any search started at a root.
- campaign-brief and its transcripts are read-only. Copy structure and code patterns from them, never text, host names, space keys, page ids, people's names or tokens. The one exception is S12, which writes campaign-brief's own guides and `guides.json` under its CLAUDE.md.
- Clarity: synthetic mail only; never `docs/feedback/`; its CLAUDE.md hard rules apply; commit there only with Kam's go-ahead.
- Never stop or reconfigure any local stack (Clarity's, campaign-brief's, the source app's, k3d).
- Never publish to a real wiki without Kam's go-ahead given in that session, never handle a token or password, never push, and never create claude.ai artifacts or cloud docs. That includes eval reports: `claude plugin eval` always runs with `--no-publish`.
- Read at most 150 lines per call, and search first: this machine cuts off large reads.

## Working rules
- **PLAN.md is authoritative.** If it and this file disagree, PLAN.md wins; log the discrepancy.
- **If Kam's push is delayed:** leave the row 🟡 with a note saying the install check waits for the push, and commit what is done. Run this session again after the push.
- **Before committing**, run the genericity test over the lines this session adds under `.planning/` (R17), and over the README section.

## Finish
1. **Gate:** run every check above for real. If any fails:
   - set row 11 in `TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit;
   - **stop**.
2. **Record:**
   - Write the session summary to `.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/user-guides` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 11 to ✅;
     - fill in Key artifacts, Verification and Notes: the tag and its commit, the remotes pushed, and the install check;
     - tick the open items for the push and Session 11's review notes;
     - append a session-log entry with `Runtime: opus/medium`.
   - Commits, as in Do: the release commit before the tag, and the closing commit after the install check.
3. **Hand off:** print the kickoff prompt from `.planning/user-guides/prompts/session-12.md` as a copy-pasteable blockquote, without its frontmatter. Note its profile (`/model opus`, `/effort high`), and that it runs **by hand, from campaign-brief**, with the start command at the top of that prompt.
