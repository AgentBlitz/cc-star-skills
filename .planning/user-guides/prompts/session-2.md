---
model: opus
effort: high
rationale: "the skill's wording and flow are the product; its gate checks only the scripts"
---
Paste everything below into a fresh Claude Code session in the `cc-star-skills` repo, started with `claude --add-dir /Users/kstar/_Dev/campaign-brief` (a read-only reference). It has a runtime profile in the frontmatter above — set it first with `/model opus` and `/effort high` (autopilot applies it automatically).

---

# user-guides plugin roadmap — Session 2 of 12: write-guides: the skill

> Prefer **`/planning:session .planning/user-guides`**. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Read first
1. `.planning/user-guides/PLAN.md`:
   - §2.2 (write-guides' seven steps), §2.3 (the contract) and §2.4;
   - §3: D1, D3, D4, D9, D10, R7–R13, R18, and Session 1's **Spike verdicts**;
   - §5 Session 2.
2. `.planning/user-guides/TRACKER.md`: confirm Session 1 is ✅, then mark row 2 🟡.
3. `plugins/user-guides/skills/write-guides/reference/guide-set.md` (the contract as Session 1 built it), the fixture's README (its change table) and the staging helper.
4. `.planning/user-guides/sources/README.md`, and session 42's walk library there.
5. The showcase patterns:
   - `plugins/showcase/skills/showcase/SKILL.md` and `reference/interview.md` (rounds, skip rules, the headless rule, Explore briefs);
   - `toolkit/host/auth.ts` and `toolkit/lib/playwright.ts`.
6. `plugins/copilot/skills/build-copilot/reference/design-guide.md`, for its spec-and-orchestration split.
7. campaign-brief, read-only and **for structure only**:
   - `.planning/archive/campaign-brief-v1/sessions/2026-11-15-wiki-documents-guides.md` (how the guides were walked and checked);
   - `docs/product/guides/*.md` and `docs/wiki/*.md`.

## Objective
`/user-guides:write-guides` works end to end on the staged fixture: recon, the interview, the walk, writing, checking, refresh and adopt.

## Do
- **`SKILL.md`**, orchestration only and short.
  - Its frontmatter passes `claude plugin validate`. skill-creator's `quick_validate.py` is only advisory: it rejects plugin keys such as `argument-hint`.
  - It is model-invocable, with a description tuned against D1's near-misses (the synced `docs` skill's guides and how-tos, READMEs, API references, release notes, a product film).
- **The six other reference files and the four templates** (§2.4):
  - `interview.md`: the three rounds' fixed wording, the recommended option first, at most four questions a round; the skip rules (arguments, and answers already in `guides.json`); the headless print-and-stop rule; the recorded Round-3 `approve as proposed` (R9); adopt's one round (R18);
  - `recon.md`: the three Explore briefs and their fixed report shapes (screens and routes; roles, permissions and data; running, sign-in, seed and existing docs). They read only git-tracked files, in named folders, and never a folder the project's CLAUDE.md forbids. The summary is ≤ 15 lines;
  - `walking.md`, `guide-types.md` and `style.md`;
  - `refresh.md`: refresh mode, and adopt mode (R18);
  - templates: `role-guide.md`, `features-and-value.md`, `getting-started.md` and `admin-operations.md`.
- **`scripts/kit-core.mjs`** (R12), byte-identical in both skills, with the sync test extended to it:
  - the Playwright lookup in D10's order: the project's `app.playwrightFrom`, then `USER_GUIDES_PLAYWRIGHT_CORE`, then `${XDG_CACHE_HOME:-~/.cache}/user-guides/pw-<version>`. The cache is filled only after asking, and never when headless;
  - sign-in for D9's five kinds, from §2.3's keys. A sign-in value is never printed or stored, except a `storage-state` file, which is mode 600 under `.user-guides/auth/`;
  - D3's fingerprint: a pure function of a region's headings and control names, with numbers and dates normalised, then hashed. A browser collects them from the live region, and a fetch walk from the served HTML when it can find the region.
- **`scripts/walk-lib.mjs`**, generalised from session 42's walk library (`open(account)`, `go`, `dump`, `api`) and built on `kit-core.mjs`.
  - Walk outlines and dumps go to `.user-guides/walk/`.
  - When no browser is available, it walks by fetching the server-rendered pages.
- **`scripts/check-guides.mjs`:**
  - internal references: decision, ticket and session ids, file paths, code names, plus `checks.patterns[]`;
  - alt text present, each image on its own line;
  - placeholders matched to `shots[]` both ways;
  - links and anchors resolve;
  - every bold UI label is found in the walk dumps. With no dumps, unconfirmed labels go into `notChecked[]` (R11);
  - every walked screen is covered or listed in `leftOut[]`;
  - `notChecked[]` is non-empty whenever a walk was skipped.
- **The guides folder's `README.md` index**, whose status block between markers `guide-set.mjs` regenerates.
- **The headless rules** (R9):
  - the recorded Round-3 answer;
  - an approved outline saved as the guide file's heading skeleton at `outlined`;
  - no start, reset or Playwright install when headless. An unreachable base URL means the code path, with `notChecked[]`.
- **A dry run** on the staged fixture (R13), with answers in `guides.json`.

## Boundaries
- Copy structure and code patterns from `sources/` and campaign-brief, never their text, hosts or ids.
- No wiki-guides code (S6–S9) and no evals (S3).
- In `skills/wiki-guides/`, only the shared files' copies change.
- The contract (`guide-set.mjs`) changes only if the skill can't work without it. Record any change in PLAN §2.3 and `reference/guide-set.md`, in both skills.

## Verification gate
- `npm test` passes, the sync test included.
- Two walks of the staged fixture give identical outlines.
- `check-guides` passes on the dry run.
- `claude plugin validate plugins/user-guides` passes.

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
   - set row 2 in `TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit;
   - **stop**.
2. **Record:**
   - Write the session summary to `.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/user-guides` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 2 to ✅;
     - fill in Key artifacts, Verification and Notes: SKILL.md's length, the references and templates, `kit-core.mjs`, `walk-lib.mjs`, `check-guides.mjs`, and the dry run's result;
     - append a session-log entry with the `Runtime:` it ran at.
   - Make one commit: `SKILLZ-01: Add the write-guides skill (user-guides S2)`.
3. **Hand off:** print the kickoff prompt from `.planning/user-guides/prompts/session-3.md` as a copy-pasteable blockquote, without its frontmatter. Note its profile (`/model opus`, `/effort medium`), or tell the user to run `/planning:session .planning/user-guides`.
