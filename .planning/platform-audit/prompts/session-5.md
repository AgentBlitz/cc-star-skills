---
model: sonnet
effort: medium
rationale: "templates mirror the reference audit; planted defects make a strong gate"
---
Paste everything below into a fresh Claude Code session in the `cc-star-skills` repo (`/Users/kstar/_PRJ/cc-star-skills`). It has a runtime profile in the frontmatter above — set it first with `/model sonnet` and `/effort medium` (autopilot applies it automatically).

---

# platform-audit roadmap — Session 5 of 10: Report tooling

> Prefer **`/planning:session .planning/platform-audit`**. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Read first
1. `.planning/platform-audit/PLAN.md`:
   - §2.4 (the report);
   - §2.5 (the work folder);
   - §2.6: the `appendix.mjs` and `check-audit.mjs` rows, and what `check-audit.mjs` checks;
   - §2.7 (`truth.json`);
   - §3: R6 and D9;
   - §5 Session 5.
2. `.planning/platform-audit/TRACKER.md`: confirm row 4 is ✅, read its Notes, and mark row 5 🟡.
3. The reference audit in `sources/reference-audit/`:
   - first its headings (`grep -n "^#"`);
   - then one screen section, the route table, the capability matrix and the appendix's opening, each in slices of at most 150 lines.

   Copy its **structure** (sections, tables, keys, tags). Never copy its text, names or values.
4. `sources/scripts/appendix.js`, through `ctx_execute`.
5. `plugins/audit/fixtures/partner-portal/truth.json`, and `inventory.mjs --help`.

## Objective
The report's templates, and the tools that write the label appendix and check a finished report.

## Do
1. **The templates**, in `plugins/audit/skills/platform-audit/templates/`:
   - `audit.md`: the whole report skeleton from PLAN §2.4, with:
     - the reading key;
     - every section heading, including the optional Requirements check, marked as optional;
     - the route status key and the capability key;
     - placeholders in angle brackets, plus a short HTML comment per section saying what goes there (the skill removes the comments when it writes).
   - `screen.md`: one screen block: the header table (Route, Menu, Who sees it, State observed), Purpose, Layout, header actions, filters, toolbar, columns, pagination, forms and dialogs, and code-only notes.
   - `progress.md`: as PLAN §2.5 describes: target, Answers, Decisions, Checklist, rate-limit log and resume point.
2. **`scripts/appendix.mjs`**, as in §2.6.
   - The output is deterministic: sorted groups, a contents list with counts, and a table per screen group (Component group | Labels).
   - The shared-library group comes last, followed by ids without built-in text.
   - Use `label-map.json` to place each group under a screen; any group not in the map goes under "Other".
3. **`scripts/check-audit.mjs`**, with every check in §2.6: `routes`, `private`, `markers`, `tables`, `xref`, `screens`, `keys`, `links` and `summary`.
   - It prints each finding as `<check>: <line>: <what>`, with `--json` as an option.
   - It exits 0 when clean, 1 with findings, 2 on a usage error.
4. **`plugins/audit/test/samples/partner-portal-audit/`:**
   - a **clean** audit of the fixture, written by hand from `truth.json` in the template's shape, with its appendix (generated with `appendix.mjs` from an inventory of the fixture);
   - one copy per **planted defect**:
     - a missing route;
     - a private term;
     - a leftover marker;
     - a broken table row;
     - a dangling § reference;
     - a screen block without State observed;
     - a missing key;
     - a broken link;
     - a summary without "Limits of this audit".
5. **`plugins/audit/test/score-report.mjs`**, a dev tool used by S7 and S8.
   - It scores a report against `truth.json`: the routes with an `expected` status, and the share of filters, columns, actions and form fields the report mentions.
   - It prints a table, and exits 1 below the thresholds (`--min-routes 1.0 --min-items 0.9` by default).
6. **`plugins/audit/test/report-tools.test.mjs`:**
   - the checker passes the clean sample and catches each planted defect under the right check name;
   - the appendix is byte-identical across two runs;
   - the scorer gives the clean sample full marks, and a sample missing a screen less than the threshold.

## Boundaries
- No skill text yet; that's S6.
- The templates keep S-B's structure and none of its text.
- The sample audit describes the fixture only.

## Verification gate
- `npm test` is green in `plugins/audit`.
- Every planted defect is caught, and the clean sample is clean.
- `node plugins/audit/test/genericity.mjs` (templates included) and `--added` are clean.

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
- **Shape-changing decisions** that PLAN.md doesn't settle (a dependency, a contract change, deleting data): mark the row ⛔ `Needs decision: <question — options>` and stop.
- **Before committing**, run the genericity test over the plugin and over the lines this session adds under `.planning/` (`--added`).
- **Unattended:** wait for every long command in the foreground, or in the background with Monitor. Never end the turn to wait: a headless run that ends its turn exits.

## Finish
1. **Gate:** run every check above for real. If any fails:
   - set row 5 in `TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit;
   - **stop**.
2. **Record:**
   - Write the session summary to `.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/platform-audit` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 5 to ✅;
     - fill in Key artifacts (the three templates, `appendix.mjs`, `check-audit.mjs`, the samples, `score-report.mjs`), Verification and Notes (anything S6 must say about the templates);
     - append a session-log entry with the `Runtime:` it ran at.
   - Make one commit: `SKILLZ-01: Add the report templates, appendix writer and checker (platform-audit S5)`.
3. **Hand off:** print the kickoff prompt from `.planning/platform-audit/prompts/session-6.md` as a copy-pasteable blockquote, without its frontmatter. Note its profile (`/model fable`, `/effort high`), or tell the user to run `/planning:session .planning/platform-audit`.
