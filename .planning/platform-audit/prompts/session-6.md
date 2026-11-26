---
model: fable
effort: high
rationale: "the read-only, pacing and privacy rules a live money platform relies on; the gate can only lint the text"
---
Paste everything below into a fresh Claude Code session in the `cc-star-skills` repo (`/Users/kstar/_PRJ/cc-star-skills`). It has a runtime profile in the frontmatter above — set it first with `/model fable` and `/effort high` (autopilot applies it automatically).

---

# platform-audit roadmap — Session 6 of 10: The skill text

> Prefer **`/planning:session .planning/platform-audit`**. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Read first
1. `.planning/platform-audit/PLAN.md`:
   - §1 and all of §2, especially §2.2 (the skill and its Never list), §2.3 (the interview, word for word), §2.4 (the report) and §2.5 (the work folder);
   - §3: every decision and reconciliation;
   - §4's standing rules;
   - §5 Session 6.
2. `.planning/platform-audit/TRACKER.md`: confirm row 5 is ✅, read the Notes of rows 2–5, and mark row 6 🟡.
3. P-1, the house style:
   - `plugins/user-guides/skills/write-guides/SKILL.md`;
   - `plugins/user-guides/skills/write-guides/reference/interview.md`, in slices.
4. The method as it was really used, through `ctx_execute` where the files are large, copying approach and never strings:
   - `sources/plan-2026-11-13.md`, `sources/interview.json`, `sources/memory-note.md` and `sources/final-message.md`;
   - the headings of `sources/reference-audit/`.
5. What exists now:
   - every script's `--help` (run them);
   - the header comment of `probe.js`;
   - the templates in `plugins/audit/skills/platform-audit/templates/`.
6. Guidance on writing skills: the "Skill Writing Guide" section of the skill-creator skill. Don't run its evals or description loop (D17).

## Objective
SKILL.md and its six reference files: the method, the interview and the rules, in this repo's house style. Precise enough that a fresh session, with nothing but the skill, audits a platform safely.

## Do
1. **Check the contracts first.** Ask the `claude-code-guide` agent:
   - which skill frontmatter fields the current Claude Code honours, including `argument-hint` and `allowed-tools`;
   - whether `allowed-tools` pre-approves MCP tools such as `mcp__claude-in-chrome__javascript_tool`;
   - how a plugin skill finds its own base directory.

   Record the answers in the session log.
2. **`plugins/audit/skills/platform-audit/SKILL.md`**, about 200 lines at most.
   - The frontmatter:
     - `name: platform-audit`;
     - a description that triggers firmly on auditing or mapping a web platform's features, screens and fields from a URL in the user's own browser. Use the phrasings people use: "audit this platform", "map every screen", "what can this back office do", "check it has the fields we need";
     - the same description turns away SEO, performance, accessibility, security and code audits, scraping, user guides and product films;
     - `argument-hint`;
     - `allowed-tools`, as confirmed in step 1.
   - Remove the stub's `disable-model-invocation`.
   - The body:
     - the `$S` line;
     - the route table by `$ARGUMENTS`: a URL with answers, `resume`, `check [<report>]`;
     - the **Never** list from §2.2, word for word, with one line saying the reasons are in `ground-rules.md`;
     - steps 0–7 from §2.2, each naming its reference file;
     - the headless rule (§2.3).
3. **`reference/interview.md`:** §2.3 word for word, marked as wording version 1, with the skip rules, the short values, the headless format, and where each answer goes in `progress.md`.
4. **`reference/ground-rules.md`:**
   - what read-only means, and the never-click list with the reason for each item;
   - the guard in `probe.js`: what it refuses, and that deliberate `computer` clicks follow the same list;
   - pacing: `computer wait` in steps of at most 10 s, in-app navigation, `requests()`, and on a 429 stop for 3–5 minutes, then tell the user and ask on a second one (D4);
   - privacy: structure only, `private-terms.txt`, and Chrome's query-string filter;
   - context hygiene: text over screenshots, and screenshots at scale 0.5–0.6 for layout only;
   - sign-in, which the user does themselves;
   - Claude in Chrome not connected → say so, and stop.
5. **`reference/code-inventory.md`:**
   - the scripts recon lists;
   - `bundle.mjs`, with `--allow-host` for the hosts the page itself loads scripts from;
   - what a refusal looks like, that it is never worked around, and the in-page fallback: paste `inventory-core.js`, run it on the cached scripts, page the results back in slices, and write them to the work folder;
   - each query subcommand and when to use it;
   - reconciling each screen with its label namespaces and its operations.
6. **`reference/walking.md`:**
   - recon;
   - pasting the probe, and `reinstall`;
   - the walk order;
   - what each screen block needs (from `templates/screen.md`);
   - opening controls one at a time, with Escape after each and the read in between;
   - header menus: one is enough when they're alike;
   - forms: the first step only, then Cancel;
   - detail pages from the first row, or from the code when the list is empty;
   - tabs and sub-views;
   - hidden routes, by the `hidden` answer;
   - writing each section at once;
   - the checklist and resuming;
   - another role: one run per role, one report each (D14).
7. **`reference/writing.md`:**
   - §2.4 and the style;
   - the evidence tags and the three keys;
   - the requirements check: reading a list from a path or a paste, the statuses, and the numbering after it (R6);
   - choosing the capability-matrix domains from what the platform does;
   - limits and reference lists;
   - the appendices, with `appendix.mjs` and `label-map.json`;
   - the executive summary written last;
   - the final message's "Written for:" line.
8. **`reference/checking.md`:**
   - each `check-audit` finding, and how to fix it;
   - closing the tab and removing the probe's sessionStorage entry;
   - the final report to the user: what was done on the platform and what wasn't, the limits, and the paths. Nothing is committed unless the user asks.
9. **`plugins/audit/test/skill-lint.test.mjs`:**
   - every `reference/`, `templates/` and `scripts/` file that SKILL.md names exists;
   - every interview id has its short argument values in `interview.md`;
   - SKILL.md is at most 200 lines;
   - the description names what it turns away;
   - any reference file over 300 lines has a contents list.
10. **Version** 0.9.0 in `plugins/audit/.claude-plugin/plugin.json`.

## Boundaries
- No eval cases yet; that's S7. No browser runs.
- The skill text names no partner, host or brand (D9). Examples use `https://app.example.com` and the fixture.
- Scripts change only where the text exposes a real gap. Record each change in the log.

## Verification gate
- `npm test` is green in `plugins/audit`, skill lint included.
- `claude plugin validate plugins/audit` passes.
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
- **Small choices:** decide them, and record them in the session-log entry. Explain the *why* in the reference files, rather than piling up rules in capitals.
- **Shape-changing decisions** that PLAN.md doesn't settle (a dependency, a contract change, deleting data): mark the row ⛔ `Needs decision: <question — options>` and stop.
- **Before committing**, run the genericity test over the plugin and over the lines this session adds under `.planning/` (`--added`).
- **Unattended:** wait for every long command in the foreground, or in the background with Monitor. Never end the turn to wait: a headless run that ends its turn exits.

## Finish
1. **Gate:** run every check above for real. If any fails:
   - set row 6 in `TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit;
   - **stop**.
2. **Record:**
   - Write the session summary to `.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/platform-audit` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 6 to ✅;
     - fill in Key artifacts (SKILL.md, the six reference files, the skill lint, version 0.9.0), Verification and Notes (the `claude-code-guide` answers in a line, and anything the rehearsal should watch for);
     - append a session-log entry with the `Runtime:` it ran at.
   - Make one commit: `SKILLZ-01: Write the platform-audit skill (platform-audit S6)`.
3. **Hand off:** print the kickoff prompt from `.planning/platform-audit/prompts/session-7.md` as a copy-pasteable blockquote, without its frontmatter. Note its profile (`/model opus`, `/effort medium`), or tell the user to run `/planning:session .planning/platform-audit`.
