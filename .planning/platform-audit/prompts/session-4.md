---
model: opus
effort: high
rationale: "DOM heuristics across UI libraries plus the click guard; the tests cover only the fixture's UI"
---
Paste everything below into a fresh Claude Code session in the `cc-star-skills` repo (`/Users/kstar/_PRJ/cc-star-skills`). It has a runtime profile in the frontmatter above — set it first with `/model opus` and `/effort high` (autopilot applies it automatically).

---

# platform-audit roadmap — Session 4 of 10: The in-page probe

> Prefer **`/planning:session .planning/platform-audit`**. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Read first
1. `.planning/platform-audit/PLAN.md`:
   - §1.2 (the method, especially privacy);
   - §2.2 (the Never list);
   - §2.6 (the `probe.js` row);
   - §3: D3, D4, D5, R7 and C5;
   - §5 Session 4.
2. `.planning/platform-audit/TRACKER.md`: confirm row 3 is ✅, read its Notes, and mark row 4 🟡.
3. Through `ctx_execute`, printing only what you need:
   - `sources/page-js/`, to see what those snippets read and how they dodged Chrome's query-string filter;
   - a few files from `sources/browser-batch/`, to see how clicks, waits and reads were sequenced.

   Copy the approach, never the strings.
4. `plugins/audit/fixtures/partner-portal/README.md` and `truth.json`.
5. How user-guides launches Chromium in tests: `plugins/user-guides/test/helpers.mjs`. Search for `launch` first.

## Objective
The helper Claude pastes into a page to read screens as text. It must be accurate, private and guarded.

## Do
1. **`plugins/audit/skills/platform-audit/scripts/probe.js`**, as in PLAN §2.6:
   - **at most 8 KB**, idempotent, with a `version`;
   - pasting it whole defines `window.__auditProbe` and returns `recon()`;
   - it saves its own source in sessionStorage. A one-line `reinstall` loader for after a full page load works where the page's CSP allows `eval`; it fails cleanly where it doesn't, and the probe is then pasted again. Document the one-liner in a header comment.

   Its methods:
   - `recon()`: title, language, host, framework hints, script and stylesheet paths, a nav summary, a signed-in hint (a sign-in form, or a redirect to an auth host), and URL parameter names only;
   - `nav()`: the menu tree, with depth, path and expanded state;
   - `screen()`:
     - path, headings, breadcrumbs and tabs (with the selected one);
     - buttons, with their disabled state, and links (with external ones marked);
     - fields, with label, type, placeholder, required and disabled;
     - toggles, with their state;
     - tables, with headers, sortability, row count, empty text and pagination text;
   - `overlays()`: what open popovers, menus, listboxes and dialogs hold: title, options, fields, buttons;
   - `requests()`: the fetch and XHR calls since the last call, as counts by status (from `responseStatus` when the browser gives it) and host plus pathname;
   - `peek()` (async): the same-origin scripts from the browser cache (`cache:'force-cache'`): sizes, route-like strings, label and operation counts, and hidden-route candidates, meaning routes in the code but not in `nav()`;
   - `open(i | text, opts)`: the guarded click (D3). It refuses, with `{refused: reason}`:
     - any control whose accessible name matches the danger words of PLAN §2.2;
     - submit-like buttons (Save, Submit, Confirm, OK, Yes, Apply changes, Send, Pay, Transfer) and `type=submit` inside a form or dialog;
     - file inputs;
     - download links and export buttons, unless `opts.allowDownloads`;
     - links to other hosts;
     - log out and sign out.

     It allows controls that open filters, pickers, menus, column choosers and forms.
2. **One `safe()` pass over every output:**
   - URLs as host and pathname only;
   - `?k=v` patterns masked;
   - input values never read, and table cell text never returned;
   - text cut at 200 characters.
3. **`plugins/audit/package.json`:** add `playwright-core@1.63.0` as the only dev dependency (C5), and run `npm install`. Launch Chromium the way user-guides' helpers do.
4. **`plugins/audit/test/probe.test.mjs`**, with Playwright against the fixture (signing in with its demo button):
   - each method's output on Orders, Payouts (empty), Customers and Order details, and with the Columns chooser, the date picker and the Request payout dialog open, checked against `truth.json`;
   - `open()` refuses Submit, Log out, Export CSV, the file input and an external link, and allows a filter button and the Request payout button;
   - no output holds a query string, a private term from a field value, or any cell text;
   - `peek()` finds the hidden routes;
   - pasting twice is harmless;
   - the file is at most 8 KB.

## Boundaries
- The probe only reads, and it clicks only through `open()`.
- No skill text yet.
- Headless Chromium from the Playwright cache, against the fixture only.

## Verification gate
- `npm test` is green in `plugins/audit`.
- The privacy assertions pass on every screen tested.
- The guard refuses every case listed.
- `probe.js` is at most 8 KB.
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
- **Small choices:** decide them, and record them in the session-log entry. That includes the exact danger-word list and how the guard tells a form-opening button from a submitting one; S6 documents both.
- **Shape-changing decisions** that PLAN.md doesn't settle (a dependency, a contract change, deleting data): mark the row ⛔ `Needs decision: <question — options>` and stop. If 8 KB proves too small for the methods, that is one of these.
- **Before committing**, run the genericity test over the plugin and over the lines this session adds under `.planning/` (`--added`).
- **Unattended:** wait for every long command in the foreground, or in the background with Monitor. Never end the turn to wait: a headless run that ends its turn exits. Stop any fixture you started.

## Finish
1. **Gate:** run every check above for real. If any fails:
   - set row 4 in `TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit;
   - **stop**.
2. **Record:**
   - Write the session summary to `.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/platform-audit` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 4 to ✅;
     - fill in Key artifacts (`probe.js` and its size, the Playwright test), Verification and Notes (the guard's word list in short, the `reinstall` one-liner, and what S6 must document);
     - append a session-log entry with the `Runtime:` it ran at.
   - Make one commit: `SKILLZ-01: Add the in-page probe with its privacy and click guards (platform-audit S4)`.
3. **Hand off:** print the kickoff prompt from `.planning/platform-audit/prompts/session-5.md` as a copy-pasteable blockquote, without its frontmatter. Note its profile (`/model sonnet`, `/effort medium`), or tell the user to run `/planning:session .planning/platform-audit`.
