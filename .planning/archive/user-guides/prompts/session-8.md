---
model: fable
effort: high
rationale: "version checks, idempotent republish and the Cloud refusal guard a real wiki from overwrites"
---
Paste everything below into a fresh Claude Code session in the `cc-star-skills` repo, started with `claude --add-dir /Users/kstar/_Dev/campaign-brief` (a read-only reference). It has a runtime profile in the frontmatter above — set it first with `/model fable` and `/effort high` (autopilot applies it automatically).

---

# user-guides plugin roadmap — Session 8 of 12: wiki-guides: mock Confluence and the publisher

> Prefer **`/planning:session .planning/user-guides`**. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Read first
1. `.planning/user-guides/PLAN.md`:
   - §2.2 (wiki-guides' steps 5–8), §2.3 (`publish`) and §2.5;
   - §3: D6, D7, D8, R8, R10, R20, R21;
   - §5 Session 8.
2. `.planning/user-guides/TRACKER.md`: confirm Session 7 is ✅, then mark row 8 🟡.
3. `.planning/user-guides/sources/`: session 45's `javascript_tool` texts and `file_upload` calls (the REST calls and the in-page procedure that worked). It holds internal hosts and ids: generalise from it, and never copy them.
4. campaign-brief's `.planning/archive/campaign-brief-v1/sessions/2026-11-16-illustrated-wiki-guides.md`, read-only: the publishing gotchas.
5. Session 7's `to-confluence.mjs` and `bundle.mjs`.

## Objective
A publisher that is safe against a real wiki: it detects the flavour first, checks versions, and republishes idempotently. It is proven against a local mock of Confluence Data Center.

## Do
- **`plugins/user-guides/fixtures/mock-confluence`** (dependency-free, port 0):
  - content by space and title, get with expands, create with ancestors;
  - PUT with a version check, DELETE to the trash;
  - attachment list, create and replace via `/data`, refused without `X-Atlassian-Token: no-check`;
  - the applinks manifest, `cloud` and `unknown` modes, and an optional context path (a Data Center site often lives under one, e.g. `/confluence`);
  - 400 on storage format that is not well-formed, and a hook that simulates someone else editing a page;
  - seeding with hand-made pages whose versions carry no body-hash message (R21);
  - a view page with `#main-content` at a set width.
- **`skills/wiki-guides/scripts/publish-core.js`**, one script that runs in the page or in Node:
  - **Flavour first:** detect the flavour, then plan. Nothing is published to Cloud, or to a wiki that can't be identified (D6).
  - **Images:** attach them to the top page, skipping unchanged ones (`sha256:<hash>` in the attachment comment, D8).
  - **Pages:** create or update them with version checks against `publish.confluence.pages` (R8).
    - A page whose current version differs from the recorded one, or that has none recorded, is not overwritten until the user confirms. An adopted batch needs one confirmation (R21).
    - Titles are unique per space, so a title used elsewhere in the space stops and asks.
  - **The top page** is the page the user names (R10).
  - **Unchanged pages:** each page records its body hash in the version message, so an unchanged page is skipped.
  - **A test-page mode.**
  - **Reports** carry ids and counts, never URLs (Chrome blocks query strings).
- **`scripts/publish-node.mjs`:** runs `publish-core.js` in Node, and refuses anything but localhost.
- **`scripts/check-page.js`:** images loaded, the widest image against the column, in-page anchors.
- **`reference/chrome-publishing.md`** (R20), generalised from `sources/` with no hosts, ids or tokens. It covers:
  - inject the input, then `file_upload` in batches under 9 MB;
  - reload, and re-inject;
  - pass `publish-core.js` as the `javascript_tool` text;
  - wait until the page shows the expected version before judging it;
  - the checks.
- **Scenario tests:**
  - first publish;
  - republish after v2;
  - an edit made on the wiki since;
  - adopted hand-made pages, updated in place by id after one confirmation;
  - Cloud refused;
  - an unknown wiki refused.

## Boundaries
- **Never a real wiki:** the mock and localhost only.
- **No token or password** anywhere, in code or in tests.
- **No wiki-guides `SKILL.md`** (Session 9).
- `sources/` is never copied into a tracked file. The genericity test must pass over `chrome-publishing.md`.

## Verification gate
- Every scenario passes.
- In headless Chromium against the mock, the in-page path works end to end: inject the script, fill the input with `setInputFiles`, publish, then reload and inject again.
- `check-page` catches a 900 px image and passes at 640 px.
- `npm test` passes, the genericity test included.

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
   - set row 8 in `TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit;
   - **stop**.
2. **Record:**
   - Write the session summary to `.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/user-guides` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 8 to ✅;
     - fill in Key artifacts, Verification and Notes: the scenarios, the in-page run, and any Data Center behaviour the mock had to learn;
     - append a session-log entry with the `Runtime:` it ran at.
   - Make one commit: `SKILLZ-01: Add the mock Confluence and the publisher (user-guides S8)`.
3. **Hand off:** print the kickoff prompt from `.planning/user-guides/prompts/session-9.md` as a copy-pasteable blockquote, without its frontmatter. Note its profile (`/model opus`, `/effort high`), or tell the user to run `/planning:session .planning/user-guides`.
