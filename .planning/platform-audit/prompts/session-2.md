---
model: opus
effort: high
rationale: "heuristic multi-format parser every audit rests on; its expected inventories are written in the same session"
---
Paste everything below into a fresh Claude Code session in the `cc-star-skills` repo (`/Users/kstar/_PRJ/cc-star-skills`). It has a runtime profile in the frontmatter above — set it first with `/model opus` and `/effort high` (autopilot applies it automatically).

---

# platform-audit roadmap — Session 2 of 10: The bundle extractor

> Prefer **`/planning:session .planning/platform-audit`**. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Read first
1. `.planning/platform-audit/PLAN.md`:
   - §1.2 (the method);
   - §2.1 and §2.6: the `inventory-core.js` and `inventory.mjs` rows, the shape of `inventory.json`, and what `inventory-core.js` extracts;
   - §3: D6, D8, D9, R2, C5 and C9;
   - §5 Session 2.
2. `.planning/platform-audit/TRACKER.md`: confirm row 1 is ✅, read its Notes, and mark row 2 🟡.
3. `.planning/platform-audit/sources/README.md`, then, through `ctx_execute` and printing only what you need:
   - `sources/scripts/extract.js`, `labels.js` and `gql_summary.js`;
   - the parsing commands in `sources/bash/` that the README points to.

   They show what proved useful on one real bundle. They are tied to that bundle (R2), and their strings never go into a tracked file.

## Objective
A tested reader, not tied to any framework, that turns a folder of downloaded JavaScript into `inventory.json` in the shape PLAN §2.6 fixes.

## Do
1. **`plugins/audit/skills/platform-audit/scripts/inventory-core.js`**:
   - it extracts everything PLAN §2.6 lists: frameworks, routes, labels, columns, operations, access, enums, limits, config, source maps and chunks;
   - it is a classic script, with no `import` or `export`, and sets `globalThis.AuditInventory = { build(files, opts) }`, where `files` is `[{ name, text }]`;
   - it is made of pure functions over text. A small tolerant scanner steps over strings, template literals, regex literals and comments when it matches braces;
   - it uses no `eval` and no `Function`, and nothing Node-specific, because S6's fallback pastes it into a page.
2. **`plugins/audit/skills/platform-audit/scripts/inventory.mjs`**: the CLI in §2.6 (`build`, `summary`, `routes`, `labels list|show|grep`, `context`, `ops [--md]`, `columns`, `limits`, `enums`, `access`, and `--help`).
   - It imports `inventory-core.js` for its side effect.
   - It reads every `.js`, `.mjs` and `.json` file in the folder, except `manifest.json`.
   - It records the file each item came from.
   - It redacts any value longer than 24 random-looking characters.
3. **Synthetic bundles** under `plugins/audit/test/bundles/<style>/`, written by hand, each at most about 200 lines, each with an `expected.json` of what must be found:
   - `vite-react`:
     - a route-constant object and react-router `path:` entries;
     - formatjs descriptors in both orders, one with a `description`;
     - GraphQL documents with variables and a fragment;
     - a permission-rule table, an enum, and limits such as `5*1024*1024` and `1e4`;
     - MUI `{field, headerName}` columns;
     - a config object with a long key.
   - `formatjs-compiled`: a locale whose messages are built through variables (`x=[{type:0,value:"…"}]`, then `key:x`), and one with a placeholder.
   - `webpack-i18next`:
     - an i18next resource inside `JSON.parse('…')`;
     - axios REST calls, with methods and a template parameter;
     - `static/js/<n>.<hash>.chunk.js` names.
   - `vue`: vue-router routes with names and children, and vue-i18n `messages`.
   - `angular`: `{path, component}` routes with relative children, and `$localize` with `:@@id:`.
   - `next`: a `_buildManifest.js`.
   - `gql-ast`: a compiled `kind:"Document"` with an `OperationDefinition`.
   - `noise`: asset paths, MIME types, CSS strings, date formats and URL-like strings in comments. None of them may become a route or a label.
4. **`plugins/audit/test/inventory.test.mjs`:**
   - each style's expected items are found;
   - `noise` yields no routes and no labels;
   - every subcommand prints what it should, and `--help` works;
   - `build` over a folder that holds two styles merges them;
   - a long random value is redacted.

## Boundaries
- No downloader, fixture or probe yet; those are S3 and S4.
- No network.
- Use S-C's scripts as references only (R2). Nothing from `sources/` goes into a tracked file.

## Verification gate
- `npm test` is green in `plugins/audit`.
- Every `test/bundles/*/expected.json` is fully matched.
- `noise` yields zero routes and zero labels.
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
- **Small choices:** decide them, and record them in the session-log entry. If the `inventory.json` shape has to change, change PLAN §2.6 in the same commit and say why in the log.
- **Shape-changing decisions** that PLAN.md doesn't settle (a dependency, a contract change, deleting data): mark the row ⛔ `Needs decision: <question — options>` and stop.
- **Before committing**, run the genericity test over the plugin and over the lines this session adds under `.planning/` (`--added`).
- **Unattended:** wait for every long command in the foreground, or in the background with Monitor. Never end the turn to wait: a headless run that ends its turn exits.

## Finish
1. **Gate:** run every check above for real. If any fails:
   - set row 2 in `TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit;
   - **stop**.
2. **Record:**
   - Write the session summary to `.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/platform-audit` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 2 to ✅;
     - fill in Key artifacts (`inventory-core.js`, `inventory.mjs`, the eight style fixtures), Verification and Notes (what each style found, any limit of the heuristics Session 3 should know);
     - append a session-log entry with the `Runtime:` it ran at.
   - Make one commit: `SKILLZ-01: Add the bundle extractor and its style fixtures (platform-audit S2)`.
3. **Hand off:** print the kickoff prompt from `.planning/platform-audit/prompts/session-3.md` as a copy-pasteable blockquote, without its frontmatter. Note its profile (`/model opus`, `/effort medium`), or tell the user to run `/planning:session .planning/platform-audit`.
