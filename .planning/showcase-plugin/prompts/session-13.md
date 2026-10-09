---
model: opus
effort: high
rationale: "code changes in Star plus the release tag, behind a manual gate"
---
Paste everything below into a fresh Claude Code session in the **`star` repo**, started as `cd ~/_PRJ/star && claude --plugin-dir ~/_PRJ/cc-star-skills/plugins/showcase --add-dir ~/_PRJ/cc-star-skills`. It has a runtime profile in the frontmatter above. Set it first with `/model opus` and `/effort high`. **Run this session by hand:** under autopilot it stops at once, by design.

---

# showcase plugin roadmap — Session 13 of 13: P2 · Star II: the in-app tour, then the release (by hand)

> Prefer **`/session ~/_PRJ/cc-star-skills/.planning/showcase-plugin`**. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Read first
1. `~/_PRJ/cc-star-skills/.planning/showcase-plugin/PLAN.md`: §3 (D1, D3, D7, D14), §4, §2.6 (the in-app path), and §5 Session 13.
2. `~/_PRJ/cc-star-skills/.planning/showcase-plugin/TRACKER.md`: confirm Session 12 is ✅. Read Review notes › Star film and live demo.
3. Star's `CLAUDE.md` and `AGENTS.md`, and `node_modules/next/dist/docs/` for Next 16's client-component and router APIs.
4. The plugin's `reference/in-app.md`, and Session 12's `showcase/` in Star.
5. `~/_PRJ/cc-star-skills/README.md`, the "Updating" section: the version bump, `claude plugin validate`, `claude plugin tag`, the push.

## Checkpoint protocol: do this first
- **Headless:**
  - In `~/_PRJ/cc-star-skills`, set row 13 to ⛔ with Notes starting: `Needs decision: run Session 13 interactively — cd ~/_PRJ/star && claude --plugin-dir ~/_PRJ/cc-star-skills/plugins/showcase --add-dir ~/_PRJ/cc-star-skills, then /session ~/_PRJ/cc-star-skills/.planning/showcase-plugin`.
  - Write the session summary, commit there, and **stop**.
- **Interactive:** mark row 13 🟡 and continue.

## Objective
Prove the in-app path on Star, then release showcase v1.0.0.

## Do
1. **`/showcase in-app` in Star,** reusing Session 12's tour:
   - `runtime vendor --framework next`, giving the vendored runtime and the lazy `ShowcaseTour.tsx`;
   - the adapter: `navigate` through Next's router, `reset` to the snapshot, the copilot kept out;
   - `data-showcase` anchors only where roles and names aren't enough, with a two-sided contract test in Star's own test setup (or `showcase check` against the anchors, if Star has no runner);
   - a "Take the tour" entry point, **placed where the user agrees**;
   - `?showcase=<id>&showcaseStep=<step>` deep links, and clips in `public/showcase/voice/`;
   - `film --in-app --strict`.
2. **Star's gates:** its own lint, typecheck and build. Then commit in Star **with the user's go**, following Star's conventions.
3. **The release** (in cc-star-skills):
   1. 1.0.0 in `plugins/showcase/.claude-plugin/plugin.json` and the `showcase` entry of `.claude-plugin/marketplace.json`, together, and the README updated.
   2. `claude plugin validate plugins/showcase` and `claude plugin validate .`.
   3. Commit: `SKILLZ-01: Release showcase 1.0.0 (showcase v1.0.0)`.
   4. `claude plugin tag plugins/showcase`, which makes `showcase--v1.0.0`.
   5. **Ask the user** before pushing `git push origin main refs/tags/showcase--v1.0.0`, and the same to `GITLAB`. The marketplace auto-updates from GitHub.
4. **If too much is found:** set ⛔ `Needs decision: split the remaining fixes into a Session 14? — yes / ship as is`.

## Boundaries
- Star changes only as listed above.
- No push without the user's go.
- Never print a key.

## Verification gate
- Star's own lint, typecheck and build pass.
- The tour plays from the entry point and from a deep link.
- A reload mid-tour resumes without writing twice.
- `film --in-app --strict` is green.
- The user approves.
- The tag `showcase--v1.0.0` exists.
- The plugin's `npm test` is green.

## Working rules
- PLAN.md is authoritative. If it and this file disagree, PLAN.md wins; log the discrepancy.
- Anything the user decides here goes into TRACKER › Review notes › Star in-app tour and release.

## Finish
1. **Gate:** run every check above for real. If any fails:
   - set row 13 in `TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit in cc-star-skills;
   - **stop**.
2. **Record:**
   - Write the session summary to `~/_PRJ/cc-star-skills/.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/showcase-plugin` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 13 to ✅;
     - fill in Key artifacts, Verification and Notes (the tag, whether it was pushed);
     - append a session-log entry with `Runtime: opus/high`;
     - close the open items.
   - Commit in cc-star-skills. The release commit from Do 3 can carry the tracker update.
3. **Hand off:** this is the last session, so declare the roadmap **complete**. Summarise what shipped, in which version, and whether it was pushed.
   - Suggest `/archive-roadmap` to retire `.planning/showcase-plugin/` when the user is ready.
   - Suggest `/plugin update showcase@cc-star-skills` once it's pushed.
