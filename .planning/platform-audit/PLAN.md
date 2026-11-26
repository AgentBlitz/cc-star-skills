# platform-audit — the `audit` plugin and its first skill, `/audit:platform-audit`

> **Status:** Planned 26 Nov 2026. 10 sessions, none done. Session 1 is next; run it **before about 14 Dec 2026**, because the transcript it copies is deleted after that.

## 1. Context

**Why.** On 13 Nov 2026 Kam had a partner's back office audited by hand. Claude, in Kam's signed-in Chrome,
mapped every screen, field and feature, read-only and slowly enough for the platform's rate limits. It
wrote a two-file audit: a 1,028-line report and a 526-line appendix of UI labels. The audit then became the
specification for a rebuild in AgentPoker. Kam wants the method as a reusable skill: give it a URL, and it
does the same for any web platform.

**What.** A new plugin, **`audit`**, in this marketplace, with room for other audit skills later. Its
first skill is **`platform-audit`**, typed `/audit:platform-audit <url>`. It runs in the repo where the audit
should live:
- it drives the user's signed-in Chrome through Claude in Chrome;
- it reads the platform's public JavaScript as text, for what the screens can't show;
- it writes `docs/<slug>-audit/<SLUG>-PLATFORM-AUDIT.md` and `appendix-ui-labels.md` in the reference
  audit's shape (§2.4).

**Outcome.** `audit` 1.0.0, released and tagged `audit--v1.0.0`. Before release it goes through a
rehearsal (S7), a trial by hand in Kam's Chrome (S8) and Kam's review of the trial report (S9). Both runs
use a fake back office on localhost (§2.7). The first audit of a real platform comes after this roadmap.

**Settled with Kam** (26 Nov 2026; the approved plan is `/Users/kstar/.claude/plans/delegated-churning-minsky.md`):
- the names: plugin `audit`, skill `platform-audit`;
- testing: unit tests, a localhost fixture, a rehearsal and a trial run by hand;
- commits go on `main`;
- the scope ends at 1.0.0;
- **no paid runs**: S7 writes the evals and Kam runs them later (D17);
- the runtime profiles in §5, as proposed.

**Frozen.** The `planning`, `copilot`, `showcase` and `user-guides` plugins don't change. Three shared files
do:
- `.gitignore` (S1);
- `.claude-plugin/marketplace.json` (S10);
- `README.md` (S10).

AgentPoker and its transcripts are read-only.

### 1.1 Sources (read-only)

| Id | What | Where | Read by |
|---|---|---|---|
| S-A | The approved plan of the 13 Nov audit: ground rules, pacing, privacy, code inventory first, walk order, deliverable outline, verification | `/Users/kstar/.claude/plans/i-have-been-asked-greedy-river.md`; S1 copies it to `sources/` | S1, S6 |
| S-B | The reference audit: the report and its label appendix | the only folder ending in `-audit` under `/Users/kstar/_Dev/AgentPoker/docs/` (committed there); S1 copies it to `sources/reference-audit/` | S5, S6, S9 |
| S-C | The audit session's transcript: the interview round and its answers, four parser scripts, the in-page snippets, the pacing pattern, the verification greps, the final message | `~/.claude/projects/-Users-kstar--Dev-AgentPoker/0c8feb2a-0aa8-4069-8103-bcae0567c975.jsonl` (5.6 MB); S1 extracts it into `sources/` | S1–S4, S6 |
| S-D | The project memory note on that audit: the method rules and the Chrome privacy-filter gotcha | `~/.claude/projects/-Users-kstar--Dev-AgentPoker/memory/`, the note its `MEMORY.md` lists for the platform audit; S1 copies it to `sources/` | S1, S6 |
| P-1 | The skill shape to copy | `plugins/user-guides/skills/write-guides/SKILL.md` and its `reference/interview.md` | S6 |
| P-2 | The genericity test | `plugins/user-guides/test/genericity.mjs` and `genericity.test.mjs` | S1 |
| P-3 | Eval cases, staging and trigger sets | `plugins/user-guides/evals/` (`*/case.yaml`, `scaffold.sh`, `run.sh`, `triggers/*.json`, `lib/scaffold.mjs`) | S7 |
| P-4 | Dev-only tests with Playwright | `plugins/user-guides/package.json`, `plugins/user-guides/test/helpers.mjs` | S1, S4 |
| P-5 | The README's plugin section, install and release steps | `README.md`: the `user-guides` section, Install, Updating, Layout | S10 |
| P-6 | Session discipline and the checkpoint protocol | `.planning/user-guides/PLAN.md` §3 conventions and §4 | all |

`sources/` means `.planning/platform-audit/sources/`, which git ignores (C7). The transcript last changed on 15
Nov 2026, and Claude Code deletes transcripts about 30 days after their last change: hence S1's deadline.

S-A to S-D name the partner, its hosts, brands and account. Sessions copy **structure and method** from them,
never text, names, hosts or ids (D9). After S1, sessions read the copies in `sources/`, not the originals.

### 1.2 The method being captured

From S-A and S-C:
1. **Recon on one page load.**
   - Read the page's structure, the menu and the list of scripts.
   - Peek at the bundle the browser already has cached, to find routes and the screens the menu hides.
2. **One interview round of four questions:**
   - is there a list of requirements to check against?
   - hidden screens: from code only, try one or two by URL, or try each?
   - interaction: open forms but never submit, the same plus downloads, or look only?
   - code labels: download the bundle, read it in the browser, or skip it?
3. **The code inventory comes first.**
   - Download the public JavaScript with a generic client and nothing identifying.
   - Parse it as text, never run it.
   - Pull out routes, UI labels grouped by component, server operations, permission rules, enums and limits.
   - That inventory is the checklist each screen is reconciled against.
4. **The walk:**
   - one tab, strictly one step at a time;
   - a wait after every action that loads server data (planned at 20 s; it ran at about 8 s with no 429s),
     while actions that only change the page locally go fast;
   - each screen read through `javascript_tool` text extraction, with screenshots only at scale 0.5–0.6,
     for layout;
   - filters, pickers, the column chooser and forms opened to read them, then closed with Escape or Cancel;
   - each screen's section written as soon as it's done, with a progress checklist kept for resuming.
5. **Privacy.**
   - Record structure only, with placeholders for data.
   - Claude in Chrome blocks any script output that contains a URL query string. So page scripts never return
     `location.search` (parameter names only), and they mask `?`, `&`, `=` and `%` in code excerpts.
6. **An empty account** means detail pages, row actions and higher roles' screens come from the code. The
   [UI] / [Code] tags say so honestly.
7. **Verification before handing over:**
   - every route is in the report with a status;
   - no personal data;
   - no placeholders left;
   - every table has consistent columns;
   - the tab is closed.

## 2. Target architecture

### 2.1 Overview

```
target repo (where the audit lives)
├── docs/<slug>-audit/<SLUG>-PLATFORM-AUDIT.md   the report (tracked)
│                     appendix-ui-labels.md       the label appendix (tracked)
└── .platform-audit/<slug>/                       the work folder (ignores itself)
      progress.md · private-terms.txt · bundle/ · inventory.json · api-operations.md · label-map.json

the user's Chrome (signed in) ── one tab ──► the platform
      ▲  javascript_tool: probe.js → window.__auditProbe
      │  recon · nav · screen · overlays · requests · peek · open (guarded)
Claude┤
      │  Bash from the repo root: Node ≥ 20, built-ins only
      └─ bundle.mjs ─► bundle/ ─► inventory.mjs build ─► inventory.json ─► routes · labels · ops · columns · limits
                                                         appendix.mjs ────► appendix-ui-labels.md
                                                         check-audit.mjs ─► findings (exit 0 / 1)
```

### 2.2 The skill

`/audit:platform-audit <url> [id=value …]`, or `… resume`, or `… check [<report>]`.

SKILL.md numbers the steps, and each step has its own reference file:

0. **Resume.** If `.platform-audit/*/progress.md` exists for this URL, read it, say where you are picking up,
   and carry on from its first unticked item. Answers recorded there are never asked again.
1. **Preflight and recon** (`ground-rules.md`, `walking.md` › Recon).
   - Headless with an unsettled question: print the round and stop (§2.3).
   - Load the Claude in Chrome tools in one ToolSearch, call `tabs_context_mcp`, and open the URL in a new tab.
     Not connected: say so, and stop.
   - At a sign-in page, the user signs in in that tab. Never type a credential.
   - Paste `probe.js`, then run `recon()`, `nav()` and `peek()`.
   - Put the account's identifying strings in `private-terms.txt`.
2. **Interview** (`interview.md`, §2.3).
3. **Code inventory** (`code-inventory.md`), unless `code=skip`.
   - `bundle.mjs` downloads into `bundle/`, then `inventory.mjs build`.
   - A refused download is never worked around: use the in-page fallback (D6).
   - Write every route and section into `progress.md` › Checklist.
4. **The walk** (`walking.md`).
   - The order: the global shell, then the menu in order, tabs and sub-views, detail pages, forms (first step
     only), and hidden routes as answered.
   - Pace every server-loading action. Check `requests()` for 429s.
   - Write each screen's block as soon as it's done, then tick it off.
5. **Write** (`writing.md`, `templates/`): the access model, the capability matrix, limits, reference lists,
   the requirements check (when a list was given) and both appendices. The executive summary comes last.
6. **Check** (`checking.md`).
   - Run `check-audit.mjs` and fix each finding until it is clean.
   - Close the tab, and remove the probe's sessionStorage entry.
7. **Report** to the user:
   - a "Written for:" line;
   - what the platform is and the headline findings;
   - what was and wasn't done on the platform;
   - the limits of the audit;
   - the file paths.

   Nothing is committed unless the user asks.

**Never** (SKILL.md's list, with the reasons in `ground-rules.md`):
- Click, press or submit anything that saves, submits, confirms, deletes, transfers, pays, sends, approves,
  uploads, imports, logs out, switches language or settings, copies to the clipboard, or toggles a row
  switch. Never open a dialog that only confirms, and never trigger a browser alert, confirm or prompt.
- Type into anything but a search or filter box. Never type a credential: the user signs in.
- Follow a link to another host, or visit a hidden route beyond what the `hidden` answer allows.
- Download an export unless `interact=downloads`. Never upload a file.
- Batch navigation, or load server data faster than the `pace` answer allows.
- Run downloaded code, or work around a refused download (401, 403, 429, a bot challenge, a CAPTCHA).
- Put personal data or an account identifier in the report. Structure only, with placeholders.
- Return `location.search`, or a URL with its query string, from a page script.
- Guess an answer.
- Create a claude.ai artifact or a cloud doc, or commit, unless the user asks.

### 2.3 The interview (wording version 1)

Ask in AskUserQuestion rounds: at most four questions a round, with the recommended option first. Angle
brackets are filled from recon. Record each answer **word for word** in `progress.md` › Answers as soon as it
is given.

**Round 1** comes after recon:

| Id | Ask | Options |
|---|---|---|
| `checklist` | Is there a list of required fields or capabilities I should check \<product\> against? | No list — map everything (Recommended) · Yes — I'll share it (a file path, or paste it next) |
| `hidden` | The app's code defines \<n\> screens this account's menu doesn't show (\<names\>). How should I handle them? | Document them from code only (Recommended: avoids looking like access probing) · Try one or two by URL; if they open, visit the rest once each · Try each once by URL |
| `interact` | How far may I interact with screens? Either way I never save, submit, transfer, delete, upload, log out or change settings. | Open forms, never submit (Recommended) · Same, plus downloads (exports land in your Downloads folder and may hold real data) · Look only |
| `code` | To list every field, even on empty screens, I'd read the app's public JavaScript (\<file\>, about \<size\>). How should I get it? | Download it to the work folder (Recommended: read as text, never run) · Read it in the browser only (slower; nothing saved) · Skip the code (screens only) |

When the peek found no hidden screens, or couldn't run, `hidden` asks instead: "If the app's code defines
screens this account's menu doesn't show, how should I handle them?", with the same options.

**Round 2:**

| Id | Ask | Options |
|---|---|---|
| `pace` | How slowly should I go? Platforms like this often limit how fast you can load data. | About 20 s after each page or data load (Recommended for live systems) · About 10 s · About 5 s (test or staging systems only) |
| `folder` | Where should the audit go? | docs/\<slug\>-audit/ (Recommended) · Another folder in this repo |
| `role` | Which role does this account have? Asked only when recon couldn't tell. | \<the role recon suggests\> (Recommended) · Another role (type it) |

**Skip rules.**
- Arguments answer questions as `id=value`:
  - `checklist=none|<path>`;
  - `hidden=code|try-two|try-all`;
  - `interact=open-forms|downloads|look`;
  - `code=download|browser|skip`;
  - `pace=20|10|5`;
  - `folder=<path>`;
  - `role=<name>`.
- An answer already in `progress.md` is not asked again. A round whose questions are all settled is skipped,
  and the run says which answers it used.
- **Headless** (no AskUserQuestion, as in `claude -p`), with a question unsettled:
  - print `platform-audit needs your answers (Round <n> of 2)`;
  - then the round's questions with their options;
  - then the command that answers them, e.g.
    `/audit:platform-audit https://app.example.com checklist=none hidden=code interact=open-forms code=download pace=20`;
  - then stop, before any Chrome call, recon or download.

  With every answer given but no Claude in Chrome, say so and stop. Write nothing.

### 2.4 The report

The sections of the reference audit (S-B), made generic. The skeleton is `templates/audit.md`.

- `# <Product> — Platform Audit`, then a "How to read this document" blockquote. Its key:
  - **[UI]** seen on screen;
  - **[Code]** in the app's code only;
  - **[UI + Code]** both;
  - *(shared library)* for labels from shared components the product may not use.
- `## 1. Executive summary`:
  - what it is;
  - what \<role\> can use;
  - strengths;
  - limitations and gaps to raise with the provider;
  - limits of this audit;
  - suggested next steps.
- `## 2. Requirements check`, only when a checklist was given. Each requirement is ✅ met, ⚠️ partial,
  ❌ missing or ❓ can't tell, with evidence as a § reference. The later sections number on from there.
- **Platform architecture and access model:**
  - the technology as seen from the browser (a table);
  - the business scope seen in the data model [Code];
  - roles and permissions;
  - how data is scoped for this role.
- **Navigation map:**
  - the menu as \<role\> sees it [UI], as a tree;
  - menu items for other roles [Code];
  - every route (\<n\>), with the status key: ✅ seen on screen · 📄 opened, but empty for this account ·
    🔗 detail page, no data to open · ⛔ tried and blocked · 🔒 not shown to this role (from code).
- **Global interface (on every screen).**
- **Screen-by-screen map**, one `###` per screen, from `templates/screen.md`:
  - a header table with Route, Menu, Who sees it and State observed;
  - Purpose and Layout;
  - header actions (Button | State seen | What it does);
  - filters (Filter | Type | Options seen);
  - the toolbar;
  - table columns (Column | Can hide? | Notes);
  - pagination;
  - forms and dialogs (opened, not submitted);
  - code-only notes.

  Each block carries its evidence tag.
- **Screens not available to \<role\>.**
- **Capability matrix**, by domain, with the key: ✅ available to this role · 🔒 exists, but only for other
  roles · 👁 view only · ⚠️ partial or limited · ❌ not found.
- **Limits, rules and constraints found** (Limit | Value | Where).
- **Reference lists**: enums, statuses, types.
- **Appendix A — Server operations available to the web app**: queries, actions and live subscriptions, or
  REST endpoints.
- **Appendix B — UI label inventory**: a link to `appendix-ui-labels.md`. That file holds a contents list with
  counts, then labels by component group, grouped by screen, with the shared-library group last and ids
  without built-in text at the end.

**Style** (`writing.md`):
- plain and direct, in short sentences;
- the screens' own words in bold, and numbers that matter in bold;
- structure only, with placeholders such as `<customer-id>`;
- the user's own spelling.

### 2.5 The work folder

`.platform-audit/<slug>/` sits at the target repo's root, and `.platform-audit/.gitignore` holds `*`. The
slug is the product's name in kebab case, or the host's first label when there's no product name. It holds:
- `progress.md`, from `templates/progress.md`:
  - the target (URL, product, role, date);
  - Answers, word for word;
  - Decisions;
  - the Checklist: every route and section, ticked when written;
  - the rate-limit log;
  - the resume point.
- `private-terms.txt`: one term per line, for each name, id, email or referral code the account shows. Only
  `check-audit.mjs` reads it, and it never leaves the folder.
- `bundle/`: a new, empty folder for the downloads, with `manifest.json`.
- `inventory.json`, `api-operations.md`, and `label-map.json` (component group → screen heading, for the
  appendix).

### 2.6 Scripts

All the scripts live in `skills/platform-audit/scripts/`.
- They use Node ≥ 20 built-ins only.
- They run from the target repo's root as `node $S/<script>`, where `$S` is the skill's base directory plus
  `/scripts`.
- Each prints a short summary, and its usage on `--help`.
- Downloaded files are passed as arguments; nothing runs from inside `bundle/` (D8).

| Script | Interface |
|---|---|
| `probe.js` | Pasted whole into `javascript_tool`. Defines `window.__auditProbe` (idempotent, with a `version`) and returns `recon()`. The methods are `recon()`, `nav()`, `screen()`, `overlays()`, `requests()`, `peek()` (async) and `open(i \| text)`, and every output is a JSON string. It stores its own source in sessionStorage, so the short loader (`reinstall()` in `walking.md`) puts it back after a full page load wherever the page's CSP allows `eval`; otherwise it is pasted again. **At most 8 KB**, because Claude has to type it into the tool. |
| `inventory-core.js` | A classic script with no `import` or `export`. Sets `globalThis.AuditInventory = { build(files, opts) }`, where `files` is `[{ name, text }]`. It runs in Node (`inventory.mjs` imports it for its side effect) and, pasted into the page, as the fallback (D6). |
| `inventory.mjs` | `build <bundle-dir> --out <inventory.json> [--origin <url>]` · `summary <inv>` · `routes <inv>` · `labels <inv> list` · `labels <inv> show <ns,ns*> [--ids]` · `labels <inv> grep <regex>` · `context <bundle-dir> <term> [--chars 300] [--max 5]` · `ops <inv> [--md <file>]` · `columns <inv>` · `limits <inv>` · `enums <inv>` · `access <inv>` |
| `bundle.mjs` | `fetch --origin <url> --out <dir> [--allow-host <host>]… [--delay 1500] [--max-files 40] [--max-bytes 15000000] [--no-discover] [--dry-run] <path \| url>…`. Writes the files and `manifest.json` (url, file, status, bytes, type, sha256). It refuses other hosts and anything not `.js`, `.mjs` or `.json`, and sends no cookies. On 401, 403, 429 or an HTML challenge page it stops with exit 3 and doesn't retry. Client name: `platform-audit/1.0 (public bundle reader)`. |
| `appendix.mjs` | `<inventory.json> --map <label-map.json> --title "<Product>" --out <file> [--build <name>] [--date <YYYY-MM-DD>]` |
| `check-audit.mjs` | `<report.md> [--inventory <inv.json>] [--private <terms.txt>] [--appendix <file>] [--json]`. Exits 0 when clean, 1 with findings, 2 on a usage error. |

**The shape of `inventory.json`.** S2 fixes it, and S3–S7 rely on it, so any change is recorded here:

```
{ "version": 1, "generated": "<iso>", "origin": "<url|null>",
  "files":      [{ "name", "bytes", "sha256" }],
  "frameworks": { "<name>": <signal count> },
  "routes":     [{ "path", "kinds": ["path-prop"|"route-map"|"nav-target"|"manifest"], "keys": [], "files": [] }],
  "labels":     { "<namespace>": { "<id>": "<text>" } },
  "unkeyed":    { "<file>": ["<text>"] },
  "idsWithoutText": [],
  "columns":    [{ "file", "set": [{ "field", "header" }] }],
  "operations": [{ "kind": "query"|"mutation"|"subscription"|"fragment", "name", "variables", "fields": [], "source": "document"|"ast"|"persisted", "file" }],
  "endpoints":  [{ "method", "path", "file" }],
  "hosts":      { "api": [], "auth": [], "ws": [] },
  "access":     { "constants": [], "rules": [{ "name", "roles": [], "context" }], "deniedMessages": [] },
  "enums":      [{ "name", "members": [] }],
  "limits":     [{ "name", "value", "raw", "file" }],
  "config":     [{ "key", "value" }],
  "sourceMaps": [], "chunks": [] }
```

**What `check-audit.mjs` checks:**
- `routes`: every inventory route appears in the report in backticks.
- `private`: no private term appears, matched without regard to case or spacing.
- `markers`: no `TODO`, `TBD`, `FIXME`, `<!-- SECTION`, `{{` or `In progress` is left.
- `tables`: every row has the header's number of columns.
- `xref`: every `§N` or `§N.N(.N)` matches a numbered heading.
- `screens`: every `###` in the screen-by-screen map has a Route row, a State observed row and at least one
  evidence tag.
- `keys`: the reading key, the route status key and the capability key are all there.
- `links`: relative links resolve.
- `summary`: the executive summary has its six parts.

**What `inventory-core.js` extracts:**
- **Frameworks and libraries:**
  - React, Vue, Angular, Svelte, Next and Nuxt;
  - MUI, Ant Design, Chakra and Bootstrap, plus data grids;
  - Apollo, urql and Relay;
  - formatjs, i18next and vue-i18n;
  - routers;
  - Keycloak, OIDC, MSAL and Auth0 hints.
- **Routes:**
  - `path:` properties;
  - route-constant objects (three or more `key:"/path"` pairs close together);
  - navigation targets (`navigate(`, `to:`, `href:`, `push(`, `redirect(`);
  - a Next build manifest.

  API paths, assets, MIME types and date formats are filtered out.
- **Labels:**
  - formatjs descriptors: `id` and `defaultMessage` in either order, with an optional `description`;
  - compiled formatjs locales (`[{type:0,value:…}]`, written directly or through variables);
  - i18next, vue-i18n and JSON resources, including `JSON.parse('…')` blobs; a tolerant object-literal reader
    rebuilds the dotted keys;
  - Angular `$localize`;
  - UI props (`label`, `title`, `placeholder`, `headerName`, `header`, `tooltip`, `helperText`);
  - inline text that reads as human.

  Namespaces come from the id's prefix (split at `.`, `_` or `/`), or from the file for text with no key.
  Ids referenced without built-in text are listed too.
- **Columns:** `{field, headerName}`, `{dataIndex, title}`, `{accessorKey, header}` and `{key|prop, label}`
  sets, in order.
- **Operations:**
  - GraphQL `query`, `mutation`, `subscription` and `fragment` documents, with their variables and balanced
    bodies;
  - compiled gql ASTs (operation and field names);
  - persisted `operationName`s;
  - REST endpoints, with the method where it can be seen and template parameters as `:param`;
  - WebSocket and EventSource URLs;
  - the API and auth hosts.
- **Access:**
  - role and permission constants;
  - `roles`, `permissions`, `groups`, `policies` and `scopes` arrays, with their context;
  - permission-denied messages.
- **The rest:**
  - enums: three or more UPPER_CASE members, and TypeScript enum output;
  - limits: numeric constants named like max, limit, size, count, timeout or retention, with arithmetic such
    as `5*1024*1024` resolved;
  - config keys (`window.__CONFIG__`, and `VITE_`, `REACT_APP_` and `NEXT_PUBLIC_` names), with long values
    redacted;
  - source-map comments, noted but not followed;
  - chunk references, for discovery.

### 2.7 The fixture: `fixtures/partner-portal/`

A fake partner back office. Every test, the rehearsal and the trial run against something that has the
reference audit's hard cases. It is dependency-free Node:
`node fixtures/partner-portal/server.mjs [--port 0] [--log <file.jsonl>] [--rate <n>/<seconds>] [--forbid-assets]`.
It prints `Partner Portal fixture on http://127.0.0.1:<port>`.

- **Sign-in.** `/login` has a single "Sign in as demo partner" button, with no password, which sets a session
  cookie. Every page and API call needs that cookie; `/logout` clears it.
- **The demo account.** Its display name, email, partner id and referral code are the fixture's private
  terms. They are invented: "Dana Example", `dana@example.com`, `P-104233` and `REF-7Q2X`.
- **The shell:**
  - a sidebar menu with collapsible groups;
  - balance chips in the top bar;
  - an Account section: Language (EN / DE), Log out, and a Referral link with Copy;
  - a profile block.
- **Visible screens (about 10):**
  - **Orders**, with data rows:
    - filters: a status multi-select, a date-range picker with presets, search and an amount range;
    - a Columns chooser, rows per page (10 / 25 / 50) and header menus;
    - Export CSV;
    - rows that link to **Order details**, which has three panels.
  - **Payouts**: the empty state, and a **Request payout** dialog (Amount, Method, Note; Submit / Cancel).
  - **Customers**:
    - selecting rows enables **Send voucher**;
    - an **Import customers** wizard, whose step 1 has a drop zone (CSV or XLSX, up to 2 MB) and a template
      download.
  - **Customer details**.
  - **Reports → Sales weekly** and **Sales daily**, with tabs.
  - **Settings → Profile**: a form with Save.
- **Hidden, role-gated screens.** The menu hides them from partners, and by URL each shows "You do not have
  permission to view this page.":
  - Admin → Users;
  - Admin → Audit log;
  - Admin → Settings;
  - Reports → Finance (managers only).

  The three admin screens live in a lazy-loaded admin chunk.
- **The API:**
  - `POST /api/graphql`, with the queries the screens use and a mutation behind every submit; a subscription
    document exists in the bundle only;
  - `GET /api/export/orders.csv`;
  - `POST /api/upload`.
- **The rate limit**, per session: 6 data requests per 10 s by default. Above that, `429` with
  `Retry-After: 30`. Paced use stays under it; batched navigation trips it.
- **The bundle:**
  - `/assets/index-<hash>.js` is hand-written plain JS that uses the patterns a Vite + React build leaves:
    - a route-constant object;
    - `{id, defaultMessage}` descriptors;
    - GraphQL documents in template strings;
    - a permission-rule table;
    - enums and limit constants;
    - a `sourceMappingURL` comment.
  - `/assets/admin-<hash>.js` is loaded by dynamic import.
  - `/assets/de-<hash>.js` is a compiled formatjs locale.
  - `/config.js` holds runtime config with a long fake key, for the redaction test.

  The hashes are fixed strings. The markup uses the ARIA roles real libraries emit (`navigation`, `tab`,
  `grid` / `columnheader` / `row`, `dialog`, `listbox` / `option`, `menu` / `menuitem`).
- **The request log** (JSONL) has one line per request: time, method, path, GraphQL operation name, kind
  (`page` · `asset` · `query` · `mutation` · `upload` · `download`) and status.
- **`truth.json`** is the ground truth, and `test/score-report.mjs` (S5) scores a report against it. Its
  shape:

  ```
  { "product": "Partner Portal", "role": "partner", "privateTerms": ["…"],
    "routes":  [{ "path", "screen", "menu", "visible": true|false, "expected": ["✅"] }],
    "screens": { "<screen>": { "filters": [], "columns": [], "actions": [], "fields": [] } } }
  ```

  - `expected` lists every status that is right for the route. A hidden route takes `["⛔", "🔒"]`, because
    which one applies depends on the `hidden` answer.
  - The empty Payouts list takes `["📄"]`.
  - The detail pages, which have data, take `["✅"]`.
- `--forbid-assets` makes `/assets/` answer 403, for the downloader's refusal test.

### 2.8 Layout

```
plugins/audit/
├── .claude-plugin/plugin.json          # "audit": 0.1.0 (S1) → 0.9.0 (S6) → 1.0.0 (S10)
├── package.json                        # dev only: node --test; playwright-core@1.63.0 (S4)
├── skills/platform-audit/
│   ├── SKILL.md
│   ├── reference/                      # interview, ground-rules, code-inventory, walking, writing, checking
│   ├── templates/                      # audit.md, screen.md, progress.md
│   └── scripts/                        # probe.js, inventory-core.js, inventory.mjs, bundle.mjs, appendix.mjs, check-audit.mjs
├── fixtures/partner-portal/            # server.mjs, public/, truth.json, README.md
├── test/
│   ├── bundles/<style>/                # synthetic bundles + expected.json (S2)
│   ├── samples/partner-portal-audit/   # clean and planted-defect reports (S5)
│   ├── score-report.mjs                # scores a report against truth.json (S5)
│   ├── genericity.mjs                  # host + deny-list rules (S1)
│   └── *.test.mjs
└── evals/                              # platform-audit-* cases, triggers/platform-audit.json, run.sh (S7)
```

## 3. Cross-cutting decisions & reconciliations

### Decisions (settled 26 Nov 2026)

- **D1. Names.** The plugin is `audit` and the skill is `platform-audit`, typed `/audit:platform-audit <url>`.
  Claude may invoke it. Its description turns away SEO, performance, accessibility, security and code audits,
  and scraping.
- **D2. Browser.** Claude in Chrome only, in the user's signed-in Chrome. No other browser, no automatic
  sign-in, and the skill never handles a password, token or cookie.
- **D3. Read-only by default.** The interview decides how far it may go.
  - The Never list (§2.2) always applies.
  - A dialog that only confirms is never opened; it is described from the code.
  - `probe.js`'s `open()` refuses guarded controls:
    - controls whose text holds a danger word;
    - `type=submit` inside a form;
    - file inputs;
    - download links;
    - other hosts;
    - logout.

  Deliberate clicks with the `computer` tool follow the same list.
- **D4. Pacing**, as answered:
  - one tab, and never batched navigation;
  - `computer wait` in steps of at most 10 s;
  - in-app navigation (clicking the menu, as a user would) is preferred to loading URLs;
  - `requests()` reports response statuses, so a 429 is noticed. On a 429, stop for 3–5 minutes. On a second
    one, tell the user and ask before going on.
- **D5. Privacy.**
  - The report holds structure only.
  - The probe never returns field values, cell text or query strings.
  - Private terms stay in the work folder, and `check-audit` fails a report that contains one.
- **D6. The code.**
  - Downloads come from the same origin, plus any host the page itself loads scripts from (`--allow-host`).
  - They use an honest generic client name, and wait about 1.5 s between files.
  - They are capped: at most 40 files, 15 MB each.
  - Only `.js`, `.mjs` and `.json`. Source maps are noted, never fetched.
  - Nothing downloaded is ever run.
  - A refused download is never worked around. Instead `inventory-core.js` is pasted into the page and run on
    the cached copy, and its results are paged back and written to the work folder.
- **D7. The work folder** is `.platform-audit/<slug>/`. It ignores itself, and a run resumes from
  `progress.md`. A markdown file is enough: one run, one reader (R3).
- **D8. Scripts** use Node ≥ 20 built-ins only and run from the target repo's root. Downloaded files are
  only ever arguments.
- **D9. Genericity.** This repo is public, and `.planning/` is pushed too.
  - Tracked files name no host but `localhost`, `127.0.0.1`, `example.*` and the repo's own GitHub address.
  - Tracked files contain no term from `.planning/platform-audit/sources/deny.txt`, which git ignores.
  - `plugins/audit/test/genericity.mjs`, adapted from P-2, checks both.
- **D10. The fixture** is §2.7. It listens on port 0 and only on 127.0.0.1.
- **D11. Evals.** Eval runs can't reach 127.0.0.1, so the eval cases are headless only:
  - `platform-audit-headless-round-1`;
  - `platform-audit-no-chrome`;
  - `platform-audit-check`.

  There's also a 20-query trigger set. The walk is proved by the rehearsal (S7) and the trial (S8).
- **D12. By-hand sessions** are S8, S9 and S10. Under autopilot, each one sets ⛔ `Needs decision: run
  Session N interactively — …` at once and stops.
- **D13. Commits** go on `main`, one per session (S10 makes two, R8). Nothing is pushed except by Kam's
  go-ahead in S10, to `origin` and `GITLAB`.
- **D14. Out of scope for 1.0:**
  - merging several roles into one report (the guidance is one run per role, one report each);
  - a refresh, or a diff against an earlier audit;
  - reading source maps;
  - screenshots in the report;
  - browsers other than Chrome;
  - an audit of a real platform.
- **D15. The rehearsal (S7)** follows the skill step by step on the fixture.
  - It uses the Playwright MCP tools in place of Claude in Chrome: `browser_evaluate` for `javascript_tool`,
    and `browser_wait_for` for `computer wait`.
  - When those tools aren't there, it uses a scripted walk with `playwright-core`.
  - Only on the fixture may a session click the demo sign-in itself.
- **D16. The trial (S8) runs in two terminals.**
  - Kam runs the skill in a **fresh** Claude Code session, in the throwaway repo
    `/Users/kstar/_PRJ/platform-audit-trial`. S8 makes that repo with `git init`, outside this repo.
  - The fresh session is loaded with `--plugin-dir`, so nothing but the skill's own text guides it.
  - S8's own session starts the fixture, waits for Kam, then checks the result.
- **D17. No paid runs in this roadmap** (Kam, 26 Nov).
  - S7 writes the eval cases, the trigger set and `run.sh`, but runs none of them. No session runs
    `claude plugin eval`, `evals/run.sh` or skill-creator's description loop.
  - Kam runs `bash plugins/audit/evals/run.sh` when they choose.

### Reconciliations

- **R1. Pace.** S-A planned about 20 s per load and S-D says the same; S-C actually ran at about 8 s with no
  429s. → The interview asks. 20 s is the recommended default for live systems, and 5 s is offered only for
  test systems.
- **R2.** S-C's scripts were tied to one app: they searched for that bundle's exact route object and
  permission classes. → They are references for what proved useful. `inventory-core.js` is written fresh and
  tested against many build styles (S2).
- **R3. Contract.** user-guides keeps a validated JSON contract, `guides.json`, changed only through
  `set-edit.mjs`. → This skill keeps a markdown `progress.md`, with no contract script. An audit has one run
  and one reader, and resuming needs only the answers and the checklist.
- **R4.** user-guides found that eval runs can neither listen on nor reach 127.0.0.1. → Evals are headless
  only (D11), and the walk is proved by S7 and S8.
- **R5.** The approved plan's S7 ran the evals and a tuning pass. Kam then chose no paid runs. → S7 writes
  the evals and rehearses on the fixture instead (D15, D17).
- **R6. Numbering.** The reference audit's section numbers are fixed. A requirements check inserts §2. →
  The skill numbers the later sections on, and `check-audit`'s `xref` check keeps every § reference true.
- **R7. Probe size.** S-C's snippets were small and typed on the fly, while the probe is a single reusable
  file. → It is capped at 8 KB and reinstalled from sessionStorage after full loads where possible. In-app
  navigation is preferred, so it is re-pasted rarely.
- **R8.** S10 makes two commits, as user-guides' release did: the release commit, which the tag points to,
  then the roadmap close.

### Conventions for this roadmap

- **C1.** UK English in docs, script messages and commit messages.
- **C2. Commits.**
  - Each is `SKILLZ-01: <subject> (platform-audit S<n>)`, with a body wrapped at about 72 columns and the
    `Co-Authored-By:` line the harness specifies.
  - A headless stop at a by-hand session commits as
    `SKILLZ-01: Stop at Session N for the by-hand run (platform-audit S<n>)`.
- **C3. Session summaries** go to `.planning/sessions/<date>-<slug>.md`, in the `wrapup` skill's format, with
  `**Roadmap:** .planning/platform-audit`.
- **C4. Versions:** 0.1.0 in S1, 0.9.0 in S6, then 1.0.0 with the marketplace entry in S10. Only S10 tags,
  with `claude plugin tag plugins/audit`.
- **C5. Dependencies.**
  - The scripts use Node ≥ 20 built-ins only.
  - The single dev dependency is `playwright-core@1.63.0`, as in user-guides and showcase. S4 adds it.
  - Any new dependency needs a decision recorded here.
- **C6. The fixture** listens on port 0 and prints its URL, so it never clashes with another stack.
- **C7. Ignored paths.** S1 adds these lines before it copies anything:
  - `.planning/platform-audit/sources/`;
  - `plugins/audit/test/.out/`;
  - `plugins/audit/evals/results/`;
  - `**/.platform-audit/`.
- **C8. Evals.** Case names start with `platform-audit-`. `run.sh` always passes `--no-publish`. None run in
  this roadmap (D17).
- **C9. Reading.** At most 150 lines per call, and search first. Transcripts and bundles are read only with
  scripts (through `ctx_execute`), never with `Read`.

## 4. How the sessions work

- **Instructions.** `prompts/session-N.md` is each session's single source of instructions. Running
  `/planning:session .planning/platform-audit` does everything below.
- **Each session:**
  1. Reads this PLAN.md (authoritative) and `TRACKER.md`, confirms the previous row is ✅, then marks its own
     row 🟡.
  2. Reads its reading list. Every §1.1 source is read-only.
  3. Works within its **Boundaries** and the standing rules below.
  4. Runs its **Verification gate** for real.
  5. Runs the genericity test over the plugin and the lines it adds under `.planning/` (D9). Then it updates
     `TRACKER.md` (its row, plus a session-log entry with the `Runtime:` it ran at) and writes the session
     summary (C3).
  6. Commits once (C2; S10 twice, R8) and surfaces the next kickoff prompt.
- **When a session can't finish:**
  - a gate fails → mark the row ⛔, record the blocker, commit and **stop**;
  - it needs a decision this plan doesn't settle and it can't ask (a dependency, a contract change, deleting
    data) → mark the row ⛔ `Needs decision: <question — options>`, commit and **stop**.
- **Checkpoint protocol** (D12) for S8, S9 and S10:
  - **Headless (autopilot):** set the row to ⛔ `Needs decision: run Session N interactively — <how to start
    it and what Kam does>`. Write the summary, commit (C2) and stop.
  - **Interactive:**
    1. Read the session's notes under `TRACKER.md` › Review notes.
    2. If there are none, show the artifacts, and ask with AskUserQuestion: Approve as-is · I have notes · the
       session's own options.
    3. On "Approve as-is", run the gate and mark the row ✅. If there are notes, turn them into a numbered
       checklist in the session log, carry it out, then run the gate.
  - Run interactively, `/session` turns a `Needs decision:` row into a question, records the answer in §3,
    and runs the session. Any other ⛔ counts as a failed gate.
- **Working directories.**
  - Every session runs in this repo, `/Users/kstar/_PRJ/cc-star-skills`.
  - S1 also reads AgentPoker, its transcripts and the plans folder. Interactive, start it as:
    `claude --add-dir /Users/kstar/_Dev/AgentPoker --add-dir /Users/kstar/.claude/projects/-Users-kstar--Dev-AgentPoker --add-dir /Users/kstar/.claude/plans`.
    Autopilot's `bypassPermissions` covers reading them.
  - S8 writes `/Users/kstar/_PRJ/platform-audit-trial` and reads its transcripts under
    `/Users/kstar/.claude/projects/-Users-kstar--PRJ-platform-audit-trial/`; approve those when asked. S9
    reads the trial report there.
- **Branching.** Sessions commit to `main`, as this repo's history and `/session` do. Nothing is pushed
  before S10, and then only on Kam's go-ahead.
- **Autopilot** can run S1–S7. It stops cleanly at S8, S9 and S10, each of which sets its ⛔ `Needs
  decision:` row at once. Run S1 before about 14 Dec 2026.
- **Open items** live in `TRACKER.md`:
  - the S1 deadline;
  - Kam's time for S8–S10;
  - Chrome with Claude in Chrome connected, for S8;
  - the trial repo;
  - the go-ahead to push.
- **Tools and skills:**
  - the `claude-code-guide` agent, to check current Claude Code contracts (the plugin manifest, skill
    frontmatter and `allowed-tools`, `claude plugin eval`'s case format) before relying on them;
  - the `chrome-browser` skill, read before S8 uses Claude in Chrome;
  - the Playwright MCP tools for S7's rehearsal (D15);
  - skill-creator's writing guidance for S6 (its eval loop is not run, D17).
- **Standing rules** (every prompt carries them word for word):
  - AgentPoker (`/Users/kstar/_Dev/AgentPoker`) and its transcripts are read-only. Copy structure and method
    from them, never text, product or brand names, hosts, account ids or people's names, into a tracked file.
  - This repo is public: tracked files, `.planning/` included, name no host but `localhost`, `127.0.0.1`,
    `example.*` and the repo's own GitHub address, and no term from `sources/deny.txt` (D9). Run the
    genericity test over what you add before committing.
  - During the build, browse nothing but the fixture on 127.0.0.1, and never contact the platform the
    sources describe.
  - No paid runs: never run `claude plugin eval`, `evals/run.sh` or skill-creator's description loop (D17).
  - Never push (the one exception: S10, on Kam's go-ahead given in that session, D13), never handle a
    password, token or cookie value, and never create claude.ai artifacts or cloud docs.
  - Stop only the processes you started (the fixture), and touch no other stack.
  - Read at most 150 lines per call, and search first: this machine cuts off large reads. Read transcripts
    and bundles only with scripts (`ctx_execute`), never with `Read`.

> **Runtime profiles.** Each session carries a `Runtime:` line (model / effort) — advice for a human running it by hand (`/model`, `/effort`) and a contract for `/autopilot`, which applies it per session. When a run makes no tracker progress autopilot classifies it first — needs a human, environment failure, yielded early, or a genuine stall — and only a stall is escalated (same model at `max`, then the next model up). Each session's log entry records the `Runtime:` it actually ran at.

## 5. The 10 sessions

### Phase A — Foundations

#### Session 1: Sources and skeleton

**Objective.** Save the sources before the transcript is deleted. Then lay the plugin's skeleton, with the
genericity test in place before any skill text exists.

**Do.**
1. **Ignore first** (C7). Add the four `.gitignore` lines, and confirm each with `git check-ignore`.
2. **Copy the sources into `sources/`.** Extract from the transcript with a script through `ctx_execute`,
   never `Read`, because S-C is 5.6 MB.
   - `plan-2026-11-13.md` ← S-A.
   - `reference-audit/` ← the two files of S-B. Find the folder with `ls /Users/kstar/_Dev/AgentPoker/docs`.
   - `memory-note.md` ← S-D.
   - From S-C:
     - `interview.json`: the AskUserQuestion input and its answer;
     - `scripts/`: every file written with the Write tool under the session's scratchpad (the four parser
       scripts and the progress file);
     - `page-js/NN.js`: every `javascript_tool` text, numbered in order;
     - `browser-batch/NN.json`: every `browser_batch` input;
     - `bash/NN.sh`: every Bash command, headed by its description;
     - `final-message.md`: the last assistant message.
   - `README.md`: an index with counts by kind, and which later session reads what.
   - Expected counts (taken on 26 Nov): 16 `javascript_tool`, 51 `browser_batch`, 81 Bash and 10 Write calls;
     5 of the Write calls are scratchpad scripts and the progress file.
3. **`sources/deny.txt`.** One term per line, distinctive terms only:
   - the partner's hosts and domain;
   - its product name and short forms;
   - its brand and platform codes;
   - the account id, and fragments of the account's name and email;
   - group names peculiar to the platform.

   Leave out ordinary words, such as a display name that is a plain English word, because they would fail
   innocent text. A comment at the top describes the contents by kind, not by value.
4. **The skeleton:**
   - `plugins/audit/.claude-plugin/plugin.json` at 0.1.0, with name, version, licence (MIT), description,
     author, homepage, repository and keywords, as in the other plugins;
   - `plugins/audit/package.json`, dev only: `test` (`node --test --test-concurrency=1 "test/*.test.mjs"`), a
     `genericity` script, and `engines` Node ≥ 20. No dependencies yet;
   - `skills/platform-audit/SKILL.md`, a stub with `disable-model-invocation: true`, which S6 replaces.
5. **The genericity test**, `plugins/audit/test/genericity.mjs` and `genericity.test.mjs`, adapted from P-2:
   - the host rule allows `localhost`, `127.0.0.1`, `example.*` and `github.com/AgentBlitz/cc-star-skills`;
   - the deny-list rule reads `.planning/platform-audit/sources/deny.txt`;
   - an `--added` mode checks the lines added under `.planning/platform-audit/` since HEAD;
   - a `--text` mode checks given lines;
   - a `--paths` mode checks given files.
6. **Check the scaffold once.** Run the deny-list over the whole of `.planning/platform-audit/`, minus
   `sources/`, because the roadmap was written before the list existed. Fix any hit.

**Boundaries.**
- No skill text, scripts or fixture yet.
- Nothing from `sources/` goes into a tracked file. Describe the sources by counts and kinds only.
- AgentPoker and the transcripts are read-only.
- No network.

**Verification gate.**
- `git ls-files .planning/platform-audit/sources` prints nothing, and `git check-ignore -q` passes for each
  ignored path.
- `sources/` holds the expected counts, or the ⛔ path was taken.
- `npm test` passes in `plugins/audit`.
- The genericity test is clean over the plugin and over `.planning/platform-audit/`, with the deny-list
  present.
- `claude plugin validate plugins/audit` passes.

**Runtime:** opus / medium — deadline-critical extraction that must keep the partner's names out of git; sets the skeleton and the genericity test every later session runs

#### Session 2: The bundle extractor

**Objective.** A tested reader, not tied to any framework, that turns a folder of downloaded JavaScript into
`inventory.json` (§2.6).

**Do.**
1. **`scripts/inventory-core.js`**, extracting everything §2.6 lists. It is a classic script of pure
   functions over text. A small tolerant scanner steps over strings, template literals, regex literals and
   comments when it matches braces. It uses no `eval` and no `Function`.
2. **`scripts/inventory.mjs`**, the CLI in §2.6.
   - It reads every `.js`, `.mjs` and `.json` file in the folder except `manifest.json`.
   - It records which file each item came from.
   - It redacts any value longer than 24 random-looking characters.
3. **Synthetic bundles** under `test/bundles/<style>/`, written by hand, each at most about 200 lines, each with
   an `expected.json`:
   - `vite-react`:
     - route constants and react-router `path:`;
     - formatjs descriptors in both orders;
     - GraphQL documents with variables and fragments;
     - a permission table, enums and limits such as `5*1024*1024`;
     - MUI `{field, headerName}` columns;
     - a config object with a long key.
   - `formatjs-compiled`: a locale built through variables, as in S-C.
   - `webpack-i18next`:
     - an i18next resource inside `JSON.parse('…')`;
     - axios REST calls, with methods and template parameters;
     - `static/js/…chunk.js` names.
   - `vue`: vue-router routes with names and children, and vue-i18n messages.
   - `angular`: `{path, component}` routes with relative children, and `$localize` with `:@@id:`.
   - `next`: a `_buildManifest.js`.
   - `gql-ast`: a compiled `kind:"Document"`.
   - `noise`: asset paths, MIME types, CSS strings and date formats. None of them may become a route or a
     label.
4. **`test/inventory.test.mjs`:**
   - each style's expected items are found;
   - `noise` yields none;
   - every subcommand prints what it should;
   - `build` over a folder holding two styles merges them.

**Boundaries.**
- No downloader, fixture or probe yet. No network.
- S-C's parser scripts in `sources/scripts/` show what proved useful; don't copy them blind (R2).

**Verification gate.**
- `npm test` is green.
- Every `expected.json` is fully matched, and `noise` yields zero routes and zero labels.
- The genericity test is clean.

**Runtime:** opus / high — heuristic multi-format parser every audit rests on; its expected inventories are written in the same session

#### Session 3: The fixture and the downloader

**Objective.** The fake back office every later test runs against (§2.7), and the paced downloader, proved
together.

**Do.**
1. **`fixtures/partner-portal/`**, as §2.7 describes:
   - `server.mjs`;
   - `public/index.html`, `public/app.css` and `public/config.js`;
   - `public/assets/index-<hash>.js`, `admin-<hash>.js` and `de-<hash>.js`;
   - `truth.json`;
   - a `README.md` covering how to run it, the demo account, the rate limit and the log format.
2. **`scripts/bundle.mjs`**, as in §2.6 and D6.
   - Discovery follows `import("./…")`, `assets/…-<hash>.js` and `static/js/…chunk.js` references.
   - Same origin only, unless `--allow-host`.
   - Paced and capped, and it writes `manifest.json`.
   - On 401, 403, 429 or an HTML challenge page it exits 3, without a retry.
3. **`test/fixture.test.mjs`:**
   - the server starts on port 0 and prints its URL;
   - sign-in sets the cookie, and pages and the API refuse a request without it;
   - each hidden route shows the permission screen to the demo role;
   - a burst past the rate limit gets a 429 with `Retry-After`;
   - a test mutation, an upload and a download each appear in the log with the right kind.
4. **`test/bundle.test.mjs`:**
   - `fetch` finds and downloads the index, admin and German chunks;
   - the log's timestamps show `--delay` was honoured;
   - another host is refused, and the manifest is written;
   - with `--forbid-assets` it exits 3;
   - `inventory.mjs build` over the download finds every route in `truth.json` (visible and hidden), every
     GraphQL operation, and the German labels.

**Boundaries.**
- Dependency-free. No browser yet; that's S4.
- The fixture listens on 127.0.0.1 only, and nothing is fetched from any other host.

**Verification gate.**
- `npm test` is green, including the integration test.
- The inventory finds every route in `truth.json`.
- The genericity test is clean.

**Runtime:** opus / medium — a sizeable but well-specified fake app; integration tests catch most mistakes

### Phase B — The skill

#### Session 4: The in-page probe

**Objective.** The helper Claude pastes into the page to read screens as text. It must be accurate, private
and guarded.

**Do.**
1. **`scripts/probe.js`**, as in §2.6: at most 8 KB, idempotent, with a `version`, and its source saved in
   sessionStorage for `reinstall()`. Its methods:
   - `recon()`: title, language, host, framework hints, script and stylesheet paths, a nav summary, a
     signed-in hint, and URL parameter names;
   - `nav()`: the menu tree, with depth, path and expanded state;
   - `screen()`:
     - path, headings, breadcrumbs and tabs;
     - buttons, with their disabled state, and links;
     - fields, with label, type, placeholder, required and disabled;
     - toggles;
     - tables, with headers, sortability, row count, empty text and pagination text;
   - `overlays()`: what open popovers, menus, listboxes and dialogs hold: title, options, fields, buttons;
   - `requests()`: fetch and XHR calls since the last call, by status, as host and pathname. It uses
     `responseStatus` when the browser gives it;
   - `peek()`: the same-origin scripts from the browser cache (`cache:'force-cache'`): sizes, route-like
     strings, label and operation counts, and hidden-route candidates;
   - `open(i | text)`: the guarded click (D3). It returns `{refused: reason}` for a guarded control.
2. **One `safe()` pass over every output:**
   - URLs as host and pathname only;
   - `?k=v` patterns masked;
   - input values never read, table cells never returned;
   - text cut at 200 characters.
3. **`package.json`:** add `playwright-core@1.63.0`, the only dev dependency (C5), and run `npm install`.
   Launch Chromium the way user-guides' `test/helpers.mjs` does.
4. **`test/probe.test.mjs`** runs in Playwright against the fixture:
   - every method's output on Orders, Payouts (empty), Customers and a detail page, with the Columns chooser,
     the date picker and the Request payout dialog open;
   - `open()` refuses Submit, Log out, Export CSV, the file input and an external link, and allows a filter
     button;
   - no output holds a query string, a private term from a field value, or any cell text;
   - `peek()` finds the hidden routes.

**Boundaries.**
- The probe only reads, and it clicks only through `open()`.
- No skill text yet.
- Headless Chromium from the Playwright cache, and never a real site.

**Verification gate.**
- `npm test` is green, and the privacy assertions pass on every screen.
- The guard refuses every case listed.
- `probe.js` is at most 8 KB.
- The genericity test is clean.

**Runtime:** opus / high — DOM heuristics across UI libraries plus the click guard; the tests cover only the fixture's UI

#### Session 5: Report tooling

**Objective.** The report's templates, and the tools that write the appendix and check the report.

**Do.**
1. **The templates:**
   - `templates/audit.md`: the report's skeleton (§2.4), generalised from `sources/reference-audit/`: its
     headings, the three keys, and placeholders in angle brackets;
   - `templates/screen.md`: one screen block;
   - `templates/progress.md`: as §2.5 describes.
2. **`scripts/appendix.mjs`** (§2.6), using S-C's appendix script as a reference.
3. **`scripts/check-audit.mjs`**, with every check in §2.6.
4. **`test/samples/partner-portal-audit/`:**
   - a clean audit of the fixture, written by hand from `truth.json` in the template's shape, with its
     appendix;
   - one copy per planted defect: a missing route, a private term, a leftover marker, a broken table row, a
     dangling § reference, a screen block without State observed, a missing key, a broken link, and a summary
     without "Limits of this audit".
5. **`test/score-report.mjs`**, a dev tool for D15 and D16.
   - It scores a report against `truth.json`: the routes with the right status, and the share of filters,
     columns, actions and form fields the report mentions.
   - It prints a table, and exits 1 below its thresholds (`--min-routes 1.0 --min-items 0.9`).
6. **`test/report-tools.test.mjs`:**
   - the checker passes the clean sample and catches each planted defect under the right check name;
   - the appendix comes out the same for the same inventory;
   - the scorer gives the clean sample full marks.

**Boundaries.**
- No skill text yet.
- The templates keep S-B's structure and none of its text.

**Verification gate.**
- `npm test` is green.
- Every planted defect is caught, and the clean sample is clean.
- The genericity test is clean, templates included.

**Runtime:** sonnet / medium — templates mirror the reference audit; planted defects make a strong gate

#### Session 6: The skill text

**Objective.** SKILL.md and its reference files: the method, the interview and the rules, in this repo's
house style (P-1).

**Do.**
1. **`skills/platform-audit/SKILL.md`**, about 200 lines at most.
   - The frontmatter:
     - `name`;
     - a description that triggers on auditing or mapping a web platform's features, screens and fields from
       a URL in the user's own browser, and turns away SEO, performance, accessibility, security and code
       audits, scraping and user guides;
     - `argument-hint`;
     - `allowed-tools`, checked against current Claude Code with the `claude-code-guide` agent.
   - Remove `disable-model-invocation`.
   - The body:
     - the `$S` line;
     - the route table by `$ARGUMENTS` (a URL with answers, `resume`, `check`);
     - the Never list (§2.2);
     - steps 0–7, each pointing at its reference file;
     - the headless rule.
2. **`reference/interview.md`**: §2.3 word for word, as wording version 1, with the skip rules, short values,
   the headless format, and where each answer goes.
3. **`reference/ground-rules.md`:**
   - what read-only means, and the never-click list with its reasons;
   - pacing with `computer wait`, in-app navigation, `requests()` and 429 handling (D4);
   - privacy: structure only, `private-terms.txt`, and the query-string filter;
   - context hygiene: text over screenshots, and screenshots at scale 0.5–0.6;
   - sign-in, where the user signs in themselves;
   - Chrome not connected → stop.
4. **`reference/code-inventory.md`:**
   - finding the scripts from recon;
   - `bundle.mjs` with `--allow-host` for the hosts the page loads scripts from;
   - a refusal, with no work-around, and the in-page fallback (paste `inventory-core.js`, page the results
     back in slices, write them to the work folder);
   - when to use each query subcommand;
   - reconciling each screen with its namespaces.
5. **`reference/walking.md`:**
   - recon;
   - the probe and `reinstall()`;
   - the walk order;
   - what each screen block needs;
   - opening controls one at a time, with Escape after each;
   - header menus (one is enough when they're alike);
   - forms, first step only, then Cancel;
   - detail pages from the first row, or from the code when the list is empty;
   - tabs and sub-views;
   - hidden routes, as answered;
   - writing each section at once;
   - the checklist and resuming;
   - more than one role: one run per role (D14).
6. **`reference/writing.md`:**
   - §2.4 and the style;
   - evidence tags and the three keys;
   - the requirements check;
   - choosing the capability-matrix domains from what the platform does;
   - limits and reference lists;
   - the appendices (`appendix.mjs`, `label-map.json`);
   - the executive summary last;
   - the final message's "Written for:" line.
7. **`reference/checking.md`:**
   - each `check-audit` finding, and how to fix it;
   - closing the tab and cleaning up the probe's sessionStorage entry;
   - the final report to the user: what was done on the platform and what wasn't, and where the files are.
8. **`test/skill-lint.test.mjs`:**
   - every `reference/`, `templates/` and `scripts/` file that SKILL.md names exists;
   - every interview id has its short argument values;
   - SKILL.md is at most 200 lines;
   - the description says what it turns away;
   - any reference file over 300 lines has a contents list.
9. **Version** 0.9.0 in `plugin.json`.

**Boundaries.**
- No eval cases yet; that's S7. No browser runs.
- Skill text names no partner, host or brand (D9). Examples use `app.example.com` and the fixture.

**Verification gate.**
- `npm test` is green, skill lint included.
- `claude plugin validate plugins/audit` passes.
- The genericity test is clean over the plugin and the planning lines added.

**Runtime:** fable / high — the read-only, pacing and privacy rules a live money platform relies on; the gate can only lint the text

#### Session 7: Evals, triggers and a rehearsal

**Objective.** Write the evals, without running them (D17). Then rehearse the whole skill on the fixture and
fix what breaks.

**Do.**
1. **`evals/`**, on P-3's pattern:
   - `platform-audit-headless-round-1`: with no answers, it prints Round 1 and the command that answers it, and
     stops: no Write, no Chrome tool, no `bundle.mjs`;
   - `platform-audit-no-chrome`: with all the answers but no Claude in Chrome, it says so and writes nothing;
   - `platform-audit-check`: a scaffolded repo holds a report with planted defects, and `check` reports each by
     name;
   - `evals/triggers/platform-audit.json`: 20 queries, 10 that should trigger and 10 near-misses (an SEO
     site audit, Lighthouse, accessibility, a penetration test, code review, scraping a competitor's prices,
     user guides, a product film);
   - `evals/run.sh`: a staged copy without `node_modules`, `--no-publish`, results in `evals/results/`.
2. **`test/evals-lint.test.mjs`:**
   - each `case.yaml` has the required keys (a line-level check, since Node has no YAML parser);
   - case names start with `platform-audit-`;
   - scaffold scripts exist and are executable;
   - the trigger set has 20 entries, with at least 8 of each kind;
   - `bash -n evals/run.sh` passes.
3. **The rehearsal** (D15).
   - Start the fixture with `--log plugins/audit/test/.out/rehearsal/log.jsonl`.
   - Make a throwaway repo at `plugins/audit/test/.out/rehearsal/repo/`.
   - Follow SKILL.md step by step there, with
     `checklist=none hidden=try-two interact=open-forms code=download pace=5`.
4. **Fix** what the rehearsal shows, in the skill text and the scripts, within their sessions' boundaries.
   Keep a numbered list in the session log.

**Boundaries.**
- No paid runs (D17).
- Only the fixture is browsed.
- Nothing from the rehearsal repo is committed.

**Verification gate.**
- `npm test` is green, evals lint included.
- The rehearsal's report passes `check-audit.mjs` with the fixture's private terms.
- `node test/score-report.mjs` gives routes 1.0 and items ≥ 0.9.
- The fixture log shows 0 mutations, 0 uploads, 0 downloads and no 429.
- The genericity test is clean.

**Runtime:** opus / medium — cases mirror user-guides'; the rehearsal is debugging with a scored gate

### Phase C — Proof and release

#### Session 8: Trial run in Kam's Chrome (by hand)

**Objective.** Prove the skill in its real setting, on the fixture: a fresh Claude session, Kam's signed-in
Chrome, and Kam answering the interview (D16).

**Do** (checkpoint protocol; interactive only):
1. **Preflight.**
   - Kam confirms Chrome is running with Claude in Chrome connected.
   - `npm test` is green.
   - The plugin is at 0.9.x.
2. **Set up.**
   - Make `/Users/kstar/_PRJ/platform-audit-trial` (`git init` and a one-line README) if it isn't there.
   - Start the fixture in the background, on port 0, with
     `--log plugins/audit/test/.out/trial/log.jsonl`.
   - Note its URL.
3. **Part A, which Kam runs in their own terminal.** Tell Kam to:
   - open the URL in Chrome, and click "Sign in as demo partner";
   - run `cd /Users/kstar/_PRJ/platform-audit-trial && claude --plugin-dir /Users/kstar/_PRJ/cc-star-skills/plugins/audit`;
   - type `/audit:platform-audit <url>`;
   - answer the interview as for a real platform, except the pace (5 s is fine on the fixture). Suggested:
     no list · try one or two · open forms, never submit · download · 5 s · the default folder;
   - let it finish.
4. **Wait** with AskUserQuestion: "Has the trial run finished?" — Finished · It stopped early (say what
   happened) · Abandon this trial.
5. **Check.**
   - `check-audit.mjs` on the trial report, with the fixture's private terms.
   - `score-report.mjs`: routes 1.0, and items at least 0.9.
   - The fixture log: 0 mutations and 0 uploads; downloads only if allowed; and after any 429, the next data
     request came at least the `Retry-After` later.
   - The trial session's transcript, read with a script: tool counts, any refused `open()` or click on a
     guarded control, the number of screenshots, the pacing between loads, and the elapsed time.
6. **Close.**
   - Stop the fixture.
   - Write the findings, numbered, under `TRACKER.md` › Review notes › Trial findings.
   - Give Kam the report's path.

**Boundaries.**
- Only the fixture is browsed. The trial repo is never committed.
- Skill fixes wait for S9. The exception is a blocker that stops the trial: fix it, note it, and re-run once.

**Verification gate.**
- The trial report exists and passes `check-audit`.
- The score meets both thresholds.
- The log shows a read-only, paced run.
- The findings are recorded.

**Runtime:** opus / medium — supervises Kam's run and judges the findings; the log and the score are automated

#### Session 9: Review and fixes (by hand)

**Objective.** Kam's verdict on the trial report, against the reference audit, and every note dealt with.

**Do.**
1. **Gather the notes.** Read Review notes › Trial findings and › Kam's notes on the trial report. If Kam's
   notes are empty, give the trial report's path, the findings, and the reference audit's section list, and
   ask: Approve as-is · I have notes · Re-run the trial after the fixes.
2. **Fix.** Turn the findings and the notes into one numbered checklist in the session log, and fix each item
   in the skill text, scripts or templates. Then re-run:
   - the tests;
   - `check-audit` and `score-report` on the trial report, where the checker or the templates changed;
   - a short rehearsal (one screen plus the hidden routes), where the walking instructions changed.
3. **If Kam chose a re-run,** repeat S8's steps once, record that, and then close the notes.

**Boundaries.**
- Nothing beyond the notes. Anything bigger goes under Review notes › After 1.0.
- No push.

**Verification gate.**
- Every checklist item is closed, or moved to After 1.0 with Kam's say-so.
- `npm test` is green.
- `claude plugin validate plugins/audit` passes.
- The genericity test is clean.

**Runtime:** opus / high — Kam's notes are unknown now and may reach the safety rules

#### Session 10: Release 1.0.0 (by hand)

**Objective.** Ship `audit` 1.0.0.

**Do.**
1. **`README.md`** (P-5):
   - the intro mentions `audit`;
   - a `## The audit plugin` section covering:
     - what `/audit:platform-audit` does;
     - how it stays read-only and paced;
     - **Requirements:** Chrome with Claude in Chrome, signed in to the platform, and Node ≥ 20;
     - **What it adds to your repo:** `docs/<slug>-audit/`, tracked, and `.platform-audit/`, ignored;
     - the evals: `bash plugins/audit/evals/run.sh`, billed, and not run by this roadmap;
   - the Install, Updating and Layout lines.
2. **`marketplace.json`:** the `audit` entry (1.0.0, MIT, description, author) and the top-level
   description. Set `plugin.json` to 1.0.0.
3. **Checks and the tag.**
   - `npm test`.
   - `claude plugin validate plugins/audit`.
   - The genericity test.
   - The release commit (R8), then `claude plugin tag plugins/audit`, which makes `audit--v1.0.0`.
4. **Ask Kam for the go-ahead** to push `main` and the tag to `origin` and `GITLAB`. With a yes, push.
   Otherwise, print the commands.
5. **Close the roadmap** in a second commit (R8). Suggest `/archive-roadmap` and a first real audit, and say
   the trial repo can now be deleted.

**Boundaries.**
- Release work only.
- Push only on Kam's go-ahead, given in this session.

**Verification gate.**
- `npm test` is green.
- validate passes.
- `git tag -l audit--v1.0.0` prints the tag.
- The two version fields agree.
- The README lists `audit` under Install, Updating and Layout.

**Runtime:** sonnet / high — templated release mirroring user-guides 1.0.0, but it tags and, on Kam's go, pushes

## 6. File map

| Path | State | Sessions |
|---|---|---|
| `.gitignore` | modified: 4 lines | S1 |
| `.planning/platform-audit/` | new: PLAN, TRACKER, prompts (`sources/` ignored) | scaffold, then every session |
| `plugins/audit/.claude-plugin/plugin.json` | new | S1, S6, S10 |
| `plugins/audit/package.json` (+ `package-lock.json`) | new | S1, S4 |
| `plugins/audit/skills/platform-audit/SKILL.md` | new | S1 (stub), S6 |
| `plugins/audit/skills/platform-audit/reference/*.md` | new | S6, S7–S9 fixes |
| `plugins/audit/skills/platform-audit/templates/*.md` | new | S5 |
| `plugins/audit/skills/platform-audit/scripts/inventory-core.js`, `inventory.mjs` | new | S2 |
| `plugins/audit/skills/platform-audit/scripts/bundle.mjs` | new | S3 |
| `plugins/audit/skills/platform-audit/scripts/probe.js` | new | S4 |
| `plugins/audit/skills/platform-audit/scripts/appendix.mjs`, `check-audit.mjs` | new | S5 |
| `plugins/audit/fixtures/partner-portal/` | new | S3 |
| `plugins/audit/test/` | new | S1–S7 |
| `plugins/audit/evals/` | new | S7 |
| `.claude-plugin/marketplace.json` | modified: the `audit` entry | S10 |
| `README.md` | modified: the plugin's section, Install, Updating, Layout | S10 |
| `.planning/sessions/*.md` | new, one per session | every session |
| `plugins/planning/`, `copilot/`, `showcase/`, `user-guides/` | unchanged | — |
| `/Users/kstar/_PRJ/platform-audit-trial/` | outside the repo, throwaway | S8, S9 |

## 7. Verification

- **Unit and integration tests** (`cd plugins/audit && npm test`) cover the extractor across build styles,
  the fixture, the downloader against the fixture, the probe in Chromium against the fixture, the report
  tools with planted defects, the skill and eval lints, and genericity.
- **`claude plugin validate plugins/audit`** in S1, S6, S9 and S10.
- **The rehearsal (S7)** runs the whole skill on the fixture. Its report passes `check-audit` and scores
  routes 1.0 and items ≥ 0.9, and the fixture log proves the run read-only and paced.
- **The trial (S8)** is the same test in the real setting: a fresh session, Kam's Chrome, Kam's answers.
  The fixture's request log and the trial transcript show what the skill actually did.
- **Kam's review (S9)** compares the trial report with the reference audit's structure and depth.
- **The paid evals** (`bash plugins/audit/evals/run.sh`) are ready for Kam to run after release (D17).
