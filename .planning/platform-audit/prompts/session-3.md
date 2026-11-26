---
model: opus
effort: medium
rationale: "a sizeable but well-specified fake app; integration tests catch most mistakes"
---
Paste everything below into a fresh Claude Code session in the `cc-star-skills` repo (`/Users/kstar/_PRJ/cc-star-skills`). It has a runtime profile in the frontmatter above — set it first with `/model opus` and `/effort medium` (autopilot applies it automatically).

---

# platform-audit roadmap — Session 3 of 10: The fixture and the downloader

> Prefer **`/planning:session .planning/platform-audit`**. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Read first
1. `.planning/platform-audit/PLAN.md`:
   - §2.6: the `bundle.mjs` row and the shape of `inventory.json`;
   - §2.7 (the fixture), including the shape of `truth.json`;
   - §3: D6, D9, D10, C5 and C6;
   - §5 Session 3.
2. `.planning/platform-audit/TRACKER.md`: confirm row 2 is ✅, read its Notes, and mark row 3 🟡.
3. For the fixture pattern (port 0, printed URL, dependency-free Node): `plugins/user-guides/fixtures/leave-app/`. Look at its server and README; search first.
4. `plugins/audit/skills/platform-audit/scripts/inventory.mjs --help`, and the style fixtures in `plugins/audit/test/bundles/`.

## Objective
The fake back office that every later test, the rehearsal and the trial run against, and the paced downloader, proved together.

## Do
1. **`plugins/audit/fixtures/partner-portal/`**, exactly as PLAN §2.7 describes:
   - `server.mjs`, taking `--port 0`, `--log <file.jsonl>`, `--rate <n>/<seconds>` and `--forbid-assets`. It listens only on 127.0.0.1 and prints `Partner Portal fixture on http://127.0.0.1:<port>`;
   - `public/index.html`, `public/app.css` and `public/config.js`;
   - `public/assets/index-<hash>.js`, `admin-<hash>.js` and `de-<hash>.js`, with fixed hash strings;
   - `truth.json`;
   - `README.md`: how to run it, the demo account, the rate limit, the log format and the flags.

   What it must have:
   - Every screen, hidden route, API operation and bundle pattern in §2.7.
   - Markup with the ARIA roles that real libraries emit, so that S4's probe tests mean something.
   - Hand-written plain JS that uses the patterns a Vite + React build leaves:
     - a route-constant object;
     - `{id, defaultMessage}` descriptors;
     - GraphQL documents in template strings;
     - a permission-rule table;
     - enums and limit constants;
     - a `sourceMappingURL` comment.

     The app really uses them, so the bundle stays honest.
   - The admin screens loaded by a dynamic `import()`.
2. **`plugins/audit/skills/platform-audit/scripts/bundle.mjs`**, as in §2.6 and D6:
   - discovery follows `import("./…")`, `assets/…-<hash>.js` and `static/js/…chunk.js` references;
   - same origin only, unless `--allow-host`;
   - `.js`, `.mjs` and `.json` only;
   - no cookies;
   - waits `--delay` ms between files (1500 by default), with the caps;
   - writes `manifest.json`;
   - on 401, 403, 429 or an HTML challenge page, it exits 3 without a retry;
   - `--dry-run` lists what it would fetch;
   - the client name is `platform-audit/1.0 (public bundle reader)`.
3. **`plugins/audit/test/fixture.test.mjs`:**
   - the server starts on port 0 and prints its URL;
   - sign-in sets the cookie, and pages and the API refuse a request without it;
   - each hidden route shows the permission screen to the demo role;
   - six quick data requests pass, and the seventh gets 429 with `Retry-After: 30`;
   - a test mutation, an upload and a download each appear in the log with the right `kind`.
4. **`plugins/audit/test/bundle.test.mjs`:**
   - `fetch` discovers and downloads the index, admin and German chunks;
   - the log's timestamps are at least `--delay` apart (use a small delay in the test);
   - another host is refused;
   - the manifest is written;
   - with `--forbid-assets`, it exits 3;
   - `inventory.mjs build` over the download finds every route in `truth.json` (visible and hidden), every GraphQL operation and the German labels.

## Boundaries
- Dependency-free: no browser yet. Playwright arrives in S4.
- The fixture listens on 127.0.0.1 only, and nothing is fetched from any other host.
- The demo account's terms are invented (§2.7). The fixture holds no real data.

## Verification gate
- `npm test` is green in `plugins/audit`, including both integration tests.
- The inventory finds every route listed in `truth.json`.
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
- **Small choices:** decide them, and record them in the session-log entry. Keep `truth.json` and the fixture in step. Every screen, route and form in the app is in `truth.json`, and nothing else is.
- **Shape-changing decisions** that PLAN.md doesn't settle (a dependency, a contract change, deleting data): mark the row ⛔ `Needs decision: <question — options>` and stop.
- **Before committing**, run the genericity test over the plugin and over the lines this session adds under `.planning/` (`--added`).
- **Unattended:** wait for every long command in the foreground, or in the background with Monitor. Never end the turn to wait: a headless run that ends its turn exits. Stop any fixture you started before you finish.

## Finish
1. **Gate:** run every check above for real. If any fails:
   - set row 3 in `TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit;
   - **stop**.
2. **Record:**
   - Write the session summary to `.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/platform-audit` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 3 to ✅;
     - fill in Key artifacts (the fixture and its `truth.json`, `bundle.mjs`), Verification and Notes (the route, screen and operation counts, and anything Session 4 must know about the markup);
     - append a session-log entry with the `Runtime:` it ran at.
   - Make one commit: `SKILLZ-01: Add the partner-portal fixture and the bundle downloader (platform-audit S3)`.
3. **Hand off:** print the kickoff prompt from `.planning/platform-audit/prompts/session-4.md` as a copy-pasteable blockquote, without its frontmatter. Note its profile (`/model opus`, `/effort high`), or tell the user to run `/planning:session .planning/platform-audit`.
