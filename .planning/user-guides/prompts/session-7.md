---
model: opus
effort: medium
rationale: "a specified Markdown subset, gated by goldens and an XHTML check"
---
Paste everything below into a fresh Claude Code session in the `cc-star-skills` repo, started with `claude --add-dir /Users/kstar/_Dev/campaign-brief --add-dir /Users/kstar/_Dev/auto-conf --add-dir /Users/kstar/_Dev/action-tracker` (read-only references). It has a runtime profile in the frontmatter above — set it first with `/model opus` and `/effort medium` (autopilot applies it automatically).

---

# user-guides plugin roadmap — Session 7 of 12: wiki-guides: converter (Confluence and HTML)

> Prefer **`/planning:session .planning/user-guides`**. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Read first
1. `.planning/user-guides/PLAN.md`:
   - §2.5 (the converter's scope);
   - §3: D8, R8, R10, R19, R20;
   - §5 Session 7.
2. `.planning/user-guides/TRACKER.md`: confirm Session 6 is ✅, then mark row 7 🟡. Session 5's row says where Clarity's guides folder is.
3. campaign-brief's `scripts/wiki/to-confluence.mjs`, read-only and **for structure only**.
4. `/Users/kstar/_Dev/auto-conf/`: how it writes tables, code and quotes in storage format. Its sign-in model is not reused.
5. `plugins/user-guides/skills/write-guides/scripts/check-guides.mjs`, which gains the subset check.

## Objective
Guides convert to Confluence storage format and to self-contained HTML within a stated Markdown subset, and write-guides holds new guides to that subset.

## Do
- **`skills/wiki-guides/scripts/md.mjs`**, the subset in §2.5:
  - headings: H1 is the title; the rest shift up one level, with anchor macros using exact GitHub slugs, including `-1` for duplicates;
  - paragraphs; bold, italic and code;
  - links: in-page, another guide in the set (in any folder, R8), external. A repo-only file becomes plain text;
  - nested lists with paragraphs inside items; `---`;
  - images alone on their line;
  - GFM tables; fenced code;
  - blockquotes and GitHub alerts;
  - anything else fails with `file:line`, or, with the user's go-ahead, is shown as escaped text. Nothing is silently dropped.
- **`scripts/to-confluence.mjs`**, driven by `guides.json`, with the release as an argument:
  - the banner, naming the source file and release and warning that a wiki edit is overwritten;
  - the top page (R10): `topGuide`, else the README index's intro, then the list of guides, then "On this page";
  - the code macro, and the info, note and warning macros for alerts;
  - images at width `min(cap, px / scale)`, with the cap defaulting to 640;
  - a placeholder still in place (an `.svg` shot) stops the conversion for publishing, unless the user chooses to publish it as it is.
- **`scripts/to-html.mjs`:** self-contained pages with images as data URIs, plus an index.
- **`scripts/bundle.mjs`:** groups the files for upload into batches under 9 MB.
- **`templates/test-page.md`** (R19): every construct in the subset. It is also a golden.
- **`reference/confluence.md` and `reference/html.md`** (R20).
- **`md.mjs` copied byte for byte into `skills/write-guides/scripts/`.** There, `check-guides` gains the subset check, and the sync test covers it.
- **Golden tests** on synthetic docs, and a well-formedness check on the XHTML.
- **A read-only conversion of Session 5's Clarity guides** into the ignored `plugins/user-guides/test/.out/clarity/`. Nothing is written in Clarity.

## Boundaries
- No publishing and no mock (Session 8).
- Clarity is read-only here: read only its guides folder, and name it in each search.
- auto-conf and campaign-brief are references for structure only.

## Verification gate
- The goldens pass, and the XHTML is well-formed.
- Clarity's guides convert with no unsupported-construct error, or the errors are listed and fixed in the converter.
- `npm test` passes, the sync test included.

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
   - set row 7 in `TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit;
   - **stop**.
2. **Record:**
   - Write the session summary to `.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/user-guides` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 7 to ✅;
     - fill in Key artifacts, Verification and Notes: the goldens, the constructs covered, and the Clarity conversion's result;
     - append a session-log entry with the `Runtime:` it ran at.
   - Make one commit: `SKILLZ-01: Convert guides to Confluence storage format and HTML (user-guides S7)`.
3. **Hand off:** print the kickoff prompt from `.planning/user-guides/prompts/session-8.md` as a copy-pasteable blockquote, without its frontmatter. Note its profile (`/model fable`, `/effort high`), or tell the user to run `/planning:session .planning/user-guides`.
