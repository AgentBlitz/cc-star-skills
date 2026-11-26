---
model: sonnet
effort: high
rationale: "templated release mirroring user-guides 1.0.0, but it tags and, on Kam's go, pushes"
---
Paste everything below into a fresh Claude Code session in the `cc-star-skills` repo (`/Users/kstar/_PRJ/cc-star-skills`), started with `claude`. It has a runtime profile in the frontmatter above — set it first with `/model sonnet` and `/effort high` (autopilot applies it automatically). **Run this session by hand**, with Kam present: under autopilot it stops at once, by design.

---

# platform-audit roadmap — Session 10 of 10: Release 1.0.0 (by hand)

> Prefer **`/planning:session .planning/platform-audit`**. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Headless?
If this runs without AskUserQuestion (autopilot, `claude -p`):
1. Set row 10 to ⛔ `Needs decision: run Session 10 interactively — Kam gives the go-ahead to push the release`.
2. Write the session summary.
3. Commit `SKILLZ-01: Stop at Session 10 for the by-hand run (platform-audit S10)`.
4. Stop.

## Read first
1. `.planning/platform-audit/PLAN.md`:
   - §1 and §2.8;
   - §3: D13, D17, R8, C2 and C4;
   - §5 Session 10.
2. `.planning/platform-audit/TRACKER.md`: confirm row 9 is ✅, read Review notes › After 1.0, and mark row 10 🟡.
3. P-5, searching first:
   - `grep -n "^#" README.md`;
   - then, in slices of at most 150 lines, the `user-guides` section, Install, Updating and Layout.
4. `.claude-plugin/marketplace.json`, and `plugins/audit/.claude-plugin/plugin.json`.

## Objective
Ship `audit` 1.0.0.

## Do
1. **`README.md`**, in the shape of the other plugins' sections:
   - the intro mentions `audit`;
   - a `## The audit plugin` section, with:
     - a table for `/audit:platform-audit`: what it does, in the user's words;
     - how it stays read-only and paced, and what it reads from the code;
     - **Requirements:** Chrome with Claude in Chrome, signed in to the platform, and Node ≥ 20;
     - **What it adds to your repo:** `docs/<slug>-audit/`, tracked, and `.platform-audit/`, ignored;
     - the evals: `bash plugins/audit/evals/run.sh`, which is billed and was not run by this roadmap (D17);
   - Install: `/plugin install audit@cc-star-skills`, plus the line saying what installing adds;
   - Updating: `/plugin update audit@cc-star-skills`;
   - the Layout tree.
2. **`.claude-plugin/marketplace.json`:**
   - the `audit` entry: `source` `./plugins/audit`, version 1.0.0, MIT, description, author;
   - the top-level description, which names the new plugin.

   Set `plugins/audit/.claude-plugin/plugin.json` to 1.0.0.
3. **Checks:**
   - `npm test` in `plugins/audit`;
   - `claude plugin validate plugins/audit`;
   - `node plugins/audit/test/genericity.mjs` and `--added`.
4. **The release commit** (R8), `SKILLZ-01: Release audit 1.0.0 (platform-audit S10)`. Then run `claude plugin tag plugins/audit`, which checks that the two versions agree and makes `audit--v1.0.0`.
5. **Ask Kam with AskUserQuestion:** "Push main and audit--v1.0.0 to origin and GITLAB now?" — Push now · Not yet: print the commands.
   - On "Push now": `git push origin main refs/tags/audit--v1.0.0`, then `git push GITLAB main refs/tags/audit--v1.0.0`.
   - Otherwise, print both commands.
6. **Close the roadmap** in the Finish below, and suggest:
   - `/archive-roadmap`;
   - the first real audit: `/audit:platform-audit <url>` from the repo where it should live;
   - deleting `/Users/kstar/_PRJ/platform-audit-trial`, which Kam may do.

## Boundaries
- Release work only. Fixes found here are patch work after 1.0: add them under Review notes › After 1.0.
- Push only on Kam's go-ahead given in this session (D13).

## Verification gate
- `npm test` is green.
- `claude plugin validate plugins/audit` passes.
- `git tag -l audit--v1.0.0` prints the tag.
- `plugin.json` and `marketplace.json` both say 1.0.0.
- The README lists `audit` under Install, Updating and Layout.

## Standing rules
- AgentPoker (`/Users/kstar/_Dev/AgentPoker`) and its transcripts are read-only. Copy structure and method from them, never text, product or brand names, hosts, account ids or people's names, into a tracked file.
- This repo is public: tracked files, `.planning/` included, name no host but `localhost`, `127.0.0.1`, `example.*` and the repo's own GitHub address, and no term from `sources/deny.txt` (D9). Run the genericity test over what you add before committing.
- During the build, browse nothing but the fixture on 127.0.0.1, and never contact the platform the sources describe.
- No paid runs: never run `claude plugin eval`, `evals/run.sh` or skill-creator's description loop (D17).
- Never push (the one exception: S10, on Kam's go-ahead given in that session, D13), never handle a password, token or cookie value, and never create claude.ai artifacts or cloud docs.
- Stop only the processes you started (the fixture), and touch no other stack.
- Read at most 150 lines per call, and search first: this machine cuts off large reads. Read transcripts and bundles only with scripts (`ctx_execute`), never with `Read`.

## Working rules
- **PLAN.md is authoritative.** If it and this file disagree, PLAN.md wins; log the discrepancy.
- **Small choices:** decide them, and record them in the session-log entry.
- **Before each commit**, run the genericity test over the plugin and over the lines this session adds under `.planning/` (`--added`).

## Finish
1. **Gate:** run every check above for real. If any fails before the tag:
   - set row 10 in `TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit;
   - **stop**.
2. **Record:**
   - Write the session summary to `.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/platform-audit` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 10 to ✅;
     - fill in Key artifacts (`audit` 1.0.0, the tag), Verification and Notes (pushed, or the commands printed);
     - tick the push open item if pushed;
     - append a session-log entry with `Runtime: sonnet/high (by hand)`.
   - Set PLAN.md's status line to "Complete".
   - Make the second commit (R8): `SKILLZ-01: Close the platform-audit roadmap (platform-audit S10)`. If Kam chose "Push now", push this commit too, with `git push origin main` and `git push GITLAB main`.
3. **Hand off:** declare the roadmap complete. Print what to do next: `/archive-roadmap`, and the first real audit.
