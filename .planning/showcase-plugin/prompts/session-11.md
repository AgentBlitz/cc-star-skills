---
model: opus
effort: high
rationale: "the wizard's wording and flow are the product, and evals only cover its headless paths"
---
Paste everything below into a fresh Claude Code session in the `cc-star-skills` repo, started with `claude --add-dir ~/_PRJ/gods-eye`. It has a runtime profile in the frontmatter above. Set it first with `/model opus` and `/effort high` (autopilot applies it automatically).

---

# showcase plugin roadmap — Session 11 of 13: S1 · The skill and integration

> Prefer **`/session`**. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Read first
1. `.planning/showcase-plugin/PLAN.md`: §1–§4 (D1, D12, D13, D14, D17, D18), §2.7 (the experience and phases), §2.8 (the interview), §2.9 (the skill's files), §2.10 (the footprint), §5 Session 11, and any review notes in §3.
2. `.planning/showcase-plugin/TRACKER.md`: confirm Session 10 is ✅, then mark row 11 🟡.
3. This repo's skills and conventions:
   - `plugins/copilot/skills/build-copilot/SKILL.md`: the wizard's shape and style;
   - `plugins/planning/skills/{roadmap,session}/SKILL.md`: how `/planning:roadmap` takes a brief, and how `Needs decision:` rows are asked;
   - `plugins/planning/scripts/autopilot.sh`: how checkpoints stop;
   - `README.md`, the whole of it, for the section and table shapes;
   - `.claude-plugin/marketplace.json`.
4. This plugin's `skills/showcase/reference/*` so far, and `bin/showcase docs`.
5. Before writing `evals/`, confirm the current `claude plugin eval` case and grader format with the `claude-code-guide` agent.

## Objective
`/showcase` — the wizard, its references and templates — wired into the marketplace and README, with evals.

## Do
1. **`skills/showcase/SKILL.md`** (PLAN §2.9):
   - **Frontmatter:** `name: showcase`, a description of about 300 characters, the `argument-hint`, `allowed-tools`, and `disable-model-invocation: true`.
   - **Body:**
     - the subcommands;
     - phases P0–P11 (§2.7), each naming the reference doc to read first: "pull the exact contract from the reference, don't reconstruct it from memory";
     - the Rules.
2. **`reference/`:**
   - finish `interview.md` (the rounds verbatim, the explorer briefs and report shapes, the mapping to config, the skip rules);
   - write `determinism.md` and `roadmap-brief.md`;
   - make `tour-format.md`, `narrative.md`, `voice.md`, `film.md` and `in-app.md` consistent with what was built.
3. **`templates/BRIEF.md`, and `brief`,** which writes `showcase/BRIEF.md` from the current state.
4. **`evals/`:**
   - `keys status` with a canary `OPENROUTER_API_KEY` set through the case's `env`: a regex grader fails if the canary appears anywhere;
   - a headless `/showcase` prints Round 1 and stops (D13);
   - `storyboard` generates its file (`file_exists`);
   - `brief` writes `showcase/BRIEF.md`.
5. **Integration:**
   - **`.claude-plugin/marketplace.json`:** a `showcase` entry (source `./plugins/showcase`, version `0.9.0`, licence MIT, description, author), and the top-level description extended.
   - **`plugin.json`:** version `0.9.0`, with the final description.
   - **`README.md`:**
     - a row in the overview table;
     - a `## The showcase plugin` section: requirements (Node 24, Homebrew ffmpeg, Chromium via `doctor --install`), keys (the user file, `keys set`, `keys import`), the CLI and `shim`, the footprint in a target repo, roadmap hand-off and checkpoints, and cost;
     - the "Which one?" line;
     - the `/plugin install showcase@cc-star-skills` and update lines;
     - the Layout tree;
     - a "Developing the showcase plugin" note (`npm install`, `npm test`).
   - **`.gitignore`:** check it still covers the lines from Session 1.

## Boundaries
- No Star work.
- No push (C12).
- Don't change the planning or copilot plugins' files; only their mentions in the README and marketplace descriptions.
- gods-eye is read-only.

## Verification gate
- `claude plugin validate plugins/showcase` and `claude plugin validate .` (the marketplace) pass.
- `claude plugin eval plugins/showcase --max-cost-usd 2` is green.
- From a scratch copy of the fixture app, a headless `claude -p --plugin-dir <abs>/plugins/showcase "/showcase:showcase doctor"` works, and its transcript shows `Base directory for this skill: …/plugins/showcase`.
- `claude plugin details showcase` (or the equivalent with `--plugin-dir`) shows no always-on description cost.
- `npm test` and `npm run typecheck` pass.

## Working rules
- PLAN.md is authoritative. If it and this file disagree, PLAN.md wins; log the discrepancy.
- The wording of SKILL.md and the interview matters: write for the user, in UK English, matching the house style of the existing skills.
- A shape-changing decision that PLAN.md doesn't settle: mark the row ⛔ `Needs decision: <question — options>` and stop.

## Finish
1. **Gate:** run every check above for real. If any fails:
   - set row 11 in `TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit;
   - **stop**.
2. **Record:**
   - Write the session summary to `.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/showcase-plugin` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 11 to ✅;
     - fill in Key artifacts, Verification and Notes;
     - append a session-log entry with `Runtime: opus/high`.
   - Make one commit: `SKILLZ-01: Add the /showcase skill, references, evals and docs (showcase v0.9.0)`.
3. **Hand off:** print the kickoff prompt from `.planning/showcase-plugin/prompts/session-12.md` as a copy-pasteable blockquote, without its frontmatter. Note its profile (`/model opus`, `/effort high`). Tell the user that Session 12 is **by hand, run from Star**:
   `cd ~/_PRJ/star && claude --plugin-dir ~/_PRJ/cc-star-skills/plugins/showcase --add-dir ~/_PRJ/cc-star-skills`, then `/session ~/_PRJ/cc-star-skills/.planning/showcase-plugin`.
