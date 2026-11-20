---
model: opus
effort: high
rationale: "first wiki-guides session: the shots API projects keep, sign-in secrecy, exact fingerprints"
---
Paste everything below into a fresh Claude Code session in the `cc-star-skills` repo, started with `claude --add-dir /Users/kstar/_Dev/campaign-brief` (a read-only reference). It has a runtime profile in the frontmatter above — set it first with `/model opus` and `/effort high` (autopilot applies it automatically).

---

# user-guides plugin roadmap — Session 6 of 12: wiki-guides: screenshots

> Prefer **`/planning:session .planning/user-guides`**. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Read first
1. `.planning/user-guides/PLAN.md`:
   - §2.2 (wiki-guides' steps 3–4), §2.3 and §2.4;
   - §3: D3, D9, D10, R7, R8, R12–R15, R20;
   - §5 Session 6.
2. `.planning/user-guides/TRACKER.md`: confirm Session 5 is ✅, then mark row 6 🟡.
3. `plugins/user-guides/skills/write-guides/scripts/kit-core.mjs` (Session 2) and `reference/guide-set.md`, the fixture's change table (R14), and the frozen guide set `plugins/user-guides/fixtures/leave-app-guides/` (Session 3).
4. The showcase patterns: `plugins/showcase/skills/showcase/reference/determinism.md`, `toolkit/host/auth.ts` and `toolkit/lib/playwright.ts`.
5. campaign-brief, read-only and **for structure only**:
   - `scripts/wiki/screenshots.mjs`;
   - the gotchas in `.planning/archive/campaign-brief-v1/sessions/2026-11-16-illustrated-wiki-guides.md`.

## Objective
Build a screenshot script that a project keeps, made from a template. It takes every shot in a guide set reproducibly, and records the fingerprints that refresh compares.

## Do
- **`skills/wiki-guides/templates/shots.template.mjs`:**
  - `as(role)` with the five sign-in kinds, from `kit-core.mjs`, and `as(role, { signedOut: true })` for a shot whose `state` says `signed out` (a screen before sign-in; S5 found Clarity's Getting started needs one, and `walk.open` already takes the option);
  - a preflight (`--check`): Playwright found, the base URL reachable, every role signed in;
  - `shot(name, target, {pad, maxHeight, clip})` and `step(label, work)`, reading `shots[].target`'s locator syntax (R8);
  - wait until the page settles, make sticky elements static, and move the mouse away;
  - viewport 1280×800, scale 2, light palette, reduced motion;
  - retake by name; failures are reported, and the rest carry on;
  - it never prints or stores a sign-in value;
  - it writes a half-size review copy of each shot to `.user-guides/out/`, for looking at every image;
  - it records each region's fingerprint with `kit-core.mjs`'s function (R12);
  - Playwright is found in D10's order (`kit-core.mjs`).
- **`skills/wiki-guides/templates/guides-kit.mjs`:** the helpers, with `kit-core.mjs` embedded, copied into the project with a version stamp. A check flags a stale copy.
- **`skills/wiki-guides/scripts/swap-shots.mjs`:** for each placeholder, write `images/<id>.png`, rewrite the link, delete the SVG, and set `taken` with taken-at, release and fingerprint (R7).
- **`skills/wiki-guides/reference/screenshots.md`** (R20): how a project's script is made, run, retaken and kept fresh.
- **Tests** on fixture v1 and v2, staged (R13) with the frozen guide set (R15). Read back a sample of the shots.

## Boundaries
- No converter or publisher code (Sessions 7 and 8), and no wiki-guides `SKILL.md` (Session 9).
- **`kit-core.mjs` changes only in both copies at once** (the sync test). The fingerprint's definition stays as Session 2 made it, unless a test proves it wrong; record any change in PLAN §3.
- campaign-brief is for structure only: none of its text, hosts or ids.

## Verification gate
- `npm test` takes every fixture shot.
- After v2, the fingerprints flag exactly the shots in R14's table, and `swap-shots` updates exactly those.
- A walk and a shot give the same fingerprint for every fixture shot (R12).

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
- **Unattended:** wait for every long command in the foreground, or in the background with Monitor. Never end the turn to wait: a headless run that ends its turn exits (D12).

## Finish
1. **Gate:** run every check above for real. If any fails:
   - set row 6 in `TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit;
   - **stop**.
2. **Record:**
   - Write the session summary to `.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/user-guides` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 6 to ✅;
     - fill in Key artifacts, Verification and Notes: the shot count, the v2 shots flagged, and the walk-and-shot agreement;
     - append a session-log entry with the `Runtime:` it ran at.
   - Make one commit: `SKILLZ-01: Add wiki-guides screenshots and fingerprints (user-guides S6)`.
3. **Hand off:** print the kickoff prompt from `.planning/user-guides/prompts/session-7.md` as a copy-pasteable blockquote, without its frontmatter. Note its profile (`/model opus`, `/effort medium`), or tell the user to run `/planning:session .planning/user-guides`.
