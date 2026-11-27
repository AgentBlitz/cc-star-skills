---
model: opus
effort: high
rationale: "a real app with unknowns and a manual gate"
---
Paste everything below into a fresh Claude Code session in the **`star` repo**, started as `cd ~/_PRJ/star && claude --plugin-dir ~/_PRJ/cc-star-skills/plugins/showcase --add-dir ~/_PRJ/cc-star-skills`. It has a runtime profile in the frontmatter above. Set it first with `/model opus` and `/effort high`. **Run this session by hand:** under autopilot it stops at once, by design.

---

# showcase plugin roadmap — Session 12 of 13: P1 · Star I: the film and live demo (by hand)

> Prefer **`/session ~/_PRJ/cc-star-skills/.planning/showcase-plugin`**. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Read first
1. `~/_PRJ/cc-star-skills/.planning/showcase-plugin/PLAN.md`: §3 (D8, D13, D14), §4 (the checkpoint protocol and working directories), §2.7–§2.8 (the wizard and interview), and §5 Session 12.
2. `~/_PRJ/cc-star-skills/.planning/showcase-plugin/TRACKER.md`: confirm Session 11 is ✅.
3. Star's `CLAUDE.md` and `AGENTS.md`. They apply to anything written in Star. Star is on Next 16, so check `node_modules/next/dist/docs/` before relying on a Next API.
4. The plugin's `skills/showcase/SKILL.md` and `reference/` (through `/showcase` or `showcase docs`).

## Checkpoint protocol: do this first
- **Headless** (autopilot, or not started from Star):
  - In `~/_PRJ/cc-star-skills`, set row 12 to ⛔ with Notes starting: `Needs decision: run Session 12 interactively — cd ~/_PRJ/star && claude --plugin-dir ~/_PRJ/cc-star-skills/plugins/showcase --add-dir ~/_PRJ/cc-star-skills, then /session ~/_PRJ/cc-star-skills/.planning/showcase-plugin`.
  - Write the session summary, commit there (`git -C ~/_PRJ/cc-star-skills …`), and **stop**.
- **Interactive:** mark row 12 🟡 (in cc-star-skills) and continue.

## Objective
Prove the no-code-change path on a real app: a repeatable, approved Star film and live demo, made with `/showcase`.

## Do
1. **Run `/showcase`** in Star with the user: Rounds 1–3, the three Explore agents, then `init` and `inspect` on the key routes. Star has no test ids, so use role-and-name anchors.
2. **Determinism** (`showcase/config.json`):
   - **Data:** a snapshot of the SQLite DB through `.backup` into `showcase/.cache/`, with `app.env` setting `STAR_DB_PATH` to the snapshot and `STAR_READONLY=1`.
   - **Clock:** a fixed clock.
   - **Search:** pin a lexical mode in the step path, or point `EMBED_URL` at a fake.
   - **AI:** keep the copilot (`COPILOT_LLM_URL`) out of the story.
   - **Build:** film the production build (`next build`, then `next start`).
3. **Privacy:** `privacy.deny` for people's names and hostnames, reusing Star's own redaction config where possible. `rehearse` must scan clean.
4. **The film:**
   - storyboard approval (Round 4) with the stills;
   - the audition and the narrator pick;
   - `voice --yes`, then `film --strict --detach`;
   - Round 5;
   - then the live demo (`watch`) with the user.
5. **The friction log:** keep one in the session-log entry. Fix plugin problems in `~/_PRJ/cc-star-skills/plugins/showcase` with tests.
6. **Commits:**
   - in Star, `showcase/` (not `out/`, `.cache/` or `.auth/`) and the ignore lines, **only with the user's go**, following Star's conventions;
   - in cc-star-skills, the plugin fixes, the tracker and the summary.

## Boundaries
- **No Star app code.** Only `showcase/` and the ignore lines.
- Never print a key, and never read Star's `.env*` files. `showcase keys status` reports the source.
- No push.

## Verification gate
- `rehearse` passes 5 times out of 5.
- `film --strict` is green.
- Two renders give identical SRTs, with timecodes within 100 ms.
- The user approves in Round 5, and has seen the live demo.
- The plugin's `npm test` is green after the fixes.

## Working rules
- PLAN.md is authoritative. If it and this file disagree, PLAN.md wins; log the discrepancy.
- Anything the user decides here goes into TRACKER › Review notes › Star film and live demo.
- A shape-changing decision that PLAN.md doesn't settle: mark the row ⛔ `Needs decision: <question — options>` and stop.

## Finish
1. **Gate:** run every check above for real. If any fails:
   - set row 12 in `TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit in cc-star-skills;
   - **stop**.
2. **Record:**
   - Write the session summary to `~/_PRJ/cc-star-skills/.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/showcase-plugin` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 12 to ✅;
     - fill in Key artifacts, Verification and Notes (the film's length, narrator, render repeatability and friction-log headlines);
     - append a session-log entry with `Runtime: opus/high`.
   - Make one commit in cc-star-skills: `SKILLZ-01: Prove showcase on Star: film and live demo (showcase S12)`.
   - Make Star's own commit only with the user's go.
3. **Hand off:** print the kickoff prompt from `~/_PRJ/cc-star-skills/.planning/showcase-plugin/prompts/session-13.md` as a copy-pasteable blockquote, without its frontmatter. Note its profile (`/model opus`, `/effort high`), and that it also runs **by hand, from Star**.
