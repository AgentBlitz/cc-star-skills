---
model: opus
effort: medium
rationale: "cases mirror user-guides'; the rehearsal is debugging with a scored gate"
---
Paste everything below into a fresh Claude Code session in the `cc-star-skills` repo (`/Users/kstar/_PRJ/cc-star-skills`). It has a runtime profile in the frontmatter above — set it first with `/model opus` and `/effort medium` (autopilot applies it automatically).

---

# platform-audit roadmap — Session 7 of 10: Evals, triggers and a rehearsal

> Prefer **`/planning:session .planning/platform-audit`**. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Read first
1. `.planning/platform-audit/PLAN.md`:
   - §2.2 and §2.3 (the headless format, which the eval regexes match);
   - §2.7 (the fixture);
   - §3: D11, D15, D17, R4, R5 and C8;
   - §5 Session 7.
2. `.planning/platform-audit/TRACKER.md`: confirm row 6 is ✅, read its Notes, and mark row 7 🟡.
3. P-3, the eval pattern, searching first:
   - `plugins/user-guides/evals/write-guides-headless-round-1/` (its `case.yaml` and `scaffold.sh`);
   - `plugins/user-guides/evals/run.sh`;
   - `plugins/user-guides/evals/lib/scaffold.mjs`;
   - `plugins/user-guides/evals/triggers/write-guides.json`.
4. The skill as written: `plugins/audit/skills/platform-audit/SKILL.md` and its `reference/` files.

## Objective
- Write the evals, without running them (D17).
- Then rehearse the whole skill on the fixture, and fix what breaks.

## Do
1. **`plugins/audit/evals/`**, on P-3's pattern:
   - `platform-audit-headless-round-1`:
     - `/audit:platform-audit https://app.example.com`, with no answers;
     - graders: the last message matches the headless format and Round 1's four questions, and it offers the answering command; no Write; no Claude in Chrome tool; no `bundle.mjs` call.
   - `platform-audit-no-chrome`:
     - every answer given as arguments, with no Claude in Chrome tools;
     - graders: it says Claude in Chrome isn't connected, and no file is written.
   - `platform-audit-check`:
     - the scaffold copies a planted-defect sample from `test/samples/` into a repo;
     - `/audit:platform-audit check docs/<…>/<…>.md`;
     - graders: the findings name the planted checks.
   - `evals/triggers/platform-audit.json`: 20 realistic queries.
     - 10 should trigger, phrased variously: a partner's back office, "map every screen", "check it has the fields we need", a URL with "I'm logged in".
     - 10 are near-misses: an SEO site audit, Lighthouse speed, accessibility, a penetration test, a code review, scraping a competitor's prices, user guides, a product film, an audit of the repo's own code, a GDPR cookie audit.
   - `evals/run.sh`: a staged copy without `node_modules`, `--no-publish` and `--trust-plugin`, with results copied to `evals/results/`. A header comment says the runs are billed and that this roadmap runs none (D17).
2. **`plugins/audit/test/evals-lint.test.mjs`:**
   - every `case.yaml` has `schema_version`, `name`, `execution.prompt` and `graders` (a line-level check, since Node has no YAML parser);
   - names start with `platform-audit-`;
   - scaffold scripts exist and are executable;
   - the trigger set has 20 entries, with at least 8 of each kind;
   - `bash -n evals/run.sh` passes.
3. **The rehearsal** (D15).
   1. Start the fixture in the background on port 0, with `--log plugins/audit/test/.out/rehearsal/log.jsonl`, and read its URL.
   2. Make a throwaway repo at `plugins/audit/test/.out/rehearsal/repo/` (`git init`).
   3. Working there, follow SKILL.md step by step as `/audit:platform-audit <url> checklist=none hidden=try-two interact=open-forms code=download pace=5`.
   4. Stand in for Claude in Chrome with the Playwright MCP tools, loaded in one ToolSearch:
      - `browser_navigate`;
      - `browser_evaluate`, in place of `javascript_tool`. Wrap the probe as a function that ends with `return window.__auditProbe.<method>()`;
      - `browser_click` and `browser_press_key`;
      - `browser_wait_for`, in place of `computer wait`;
      - `browser_snapshot`.

      If those tools aren't available, write a scripted walk with `playwright-core` under `test/.out/rehearsal/`. Sign in with the fixture's demo button; that is allowed on the fixture only.
   5. Let it write the report and the appendix, and run `check-audit.mjs` as the skill says.
4. **Fix** what the rehearsal shows, in the skill text and the scripts, and re-run the affected tests. Keep a numbered list in the session log: what broke, and what changed.

## Boundaries
- No paid runs: never run `claude plugin eval`, `evals/run.sh` or skill-creator's loop (D17).
- Only the fixture is browsed.
- Nothing from `test/.out/` is committed.
- Stop the fixture before you finish.

## Verification gate
- `npm test` is green in `plugins/audit`, evals lint included.
- The rehearsal's report passes `node plugins/audit/skills/platform-audit/scripts/check-audit.mjs <report> --inventory <inv> --private <the fixture's private terms>`.
- `node plugins/audit/test/score-report.mjs <report>` scores routes 1.0 and items at least 0.9.
- The fixture log shows 0 `mutation`, 0 `upload`, 0 `download` and no 429.
- `node plugins/audit/test/genericity.mjs` and `--added` are clean.

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
- **Shape-changing decisions** that PLAN.md doesn't settle (a dependency, a contract change, deleting data): mark the row ⛔ `Needs decision: <question — options>` and stop. A rehearsal that keeps failing after three rounds of fixes is a failed gate: record what still breaks.
- **Before committing**, run the genericity test over the plugin and over the lines this session adds under `.planning/` (`--added`).
- **Unattended:** wait for every long command in the foreground, or in the background with Monitor. Never end the turn to wait: a headless run that ends its turn exits.

## Finish
1. **Gate:** run every check above for real. If any fails:
   - set row 7 in `TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit;
   - **stop**.
2. **Record:**
   - Write the session summary to `.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/platform-audit` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 7 to ✅;
     - fill in Key artifacts (the three eval cases, the trigger set, `run.sh`, the evals lint), Verification (the rehearsal's score and log counts) and Notes (the fixes, as a count and a one-line list, and what the trial should watch);
     - append a session-log entry with the `Runtime:` it ran at.
   - Make one commit: `SKILLZ-01: Add the evals and rehearse the skill on the fixture (platform-audit S7)`.
3. **Hand off:** print the kickoff prompt from `.planning/platform-audit/prompts/session-8.md` as a copy-pasteable blockquote, without its frontmatter. Note its profile (`/model opus`, `/effort medium`) and that it is **run by hand**, with Kam present and Chrome connected.
