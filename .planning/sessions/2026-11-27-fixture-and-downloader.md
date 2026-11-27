# Session: The fixture and the downloader (platform-audit S3)

**Date:** 2026-11-27
**Branch:** main
**Roadmap:** `.planning/platform-audit`

## Summary

Built the Partner Portal fixture (PLAN §2.7) and the paced downloader `bundle.mjs` (§2.6, D6), and proved
them together. The fixture is a dependency-free Node server on 127.0.0.1 and port 0. It serves a real
single-page app written in plain JS in Vite + React shapes: a route-constant object, `{id, defaultMessage}`
descriptors, GraphQL template strings, a permission table, enums, limits and a `sourceMappingURL`. The
admin chunk loads by dynamic `import()`, and the German locale is compiled formatjs. The app has sign-in,
the rate limit and the JSONL request log. `bundle.mjs` discovers the admin and German chunks from the entry
chunk, paces the downloads, refuses other hosts and other file types, sends no cookies, writes
`manifest.json`, and exits 3 on 401/403/429, a redirect or an HTML page. Gate: `npm test` 37/37 (13 new
across both integration tests). The inventory over the download finds exactly the 13 routes in
`truth.json` (all 4 hidden ones included), all 20 GraphQL operations and the German labels. Genericity is
clean.

## Changes

- `plugins/audit/fixtures/partner-portal/server.mjs`: the fixture server. Flags: `--port`, `--log`,
  `--rate`, `--forbid-assets` and `--help`. It reads its route list from `truth.json`, prerenders the
  permission screen on hidden routes, and keeps the GraphQL resolvers and invented data.
- `plugins/audit/fixtures/partner-portal/public/index.html`, `app.css` and `config.js`: the shell page,
  the styles, and runtime config with a long fake key.
- `plugins/audit/fixtures/partner-portal/public/assets/index-3f9c2a71.js`: the entry chunk, which is the
  whole app.
- `.../assets/admin-8d41b6e0.js`: the admin screens, loaded lazily.
- `.../assets/de-c27f5a94.js`: the compiled German locale.
- `plugins/audit/fixtures/partner-portal/truth.json`: the ground truth. It lists 13 routes, the shell, the
  operations, the endpoints and per-screen filters, columns, actions and fields (plus panels, dialogs and
  tabs).
- `plugins/audit/fixtures/partner-portal/README.md`: covers running it, the demo account, the flags, the
  rate limit and the log format.
- `plugins/audit/skills/platform-audit/scripts/bundle.mjs`: the downloader. Its interface is the one in
  §2.6.
- `plugins/audit/test/portal.mjs`: the test helper. It starts the fixture, signs in and sends GraphQL.
- `plugins/audit/test/fixture.test.mjs`: 8 tests: start-up; the cookie gate; hidden routes; the 429 on
  the seventh request; `--rate`; the log kinds; upload refusals; `truth.json` consistency.
- `plugins/audit/test/bundle.test.mjs`: 5 tests: discovery, pacing, the manifest and the inventory against
  `truth.json`; refused hosts and types; `--forbid-assets` exits 3; an HTML challenge exits 3 and
  `--dry-run` sends nothing; usage.
- `.planning/platform-audit/TRACKER.md`: row 3 ✅ and the session log.

## Decisions & Rationale

- **The server reads its route table from `truth.json`.** This keeps the fixture and the truth in step by
  construction.
- **Hidden routes come back 200 with the permission screen prerendered** into `<main>`, and the SPA renders
  the same thing. Without this, a browser-less test couldn't see the permission screen, and a real SPA
  also answers 200 here.
- **Scripts, `app.css` and `config.js` are public.** Pages and `/api/` need the cookie. The downloader sends
  no cookies (D6), so the bundle must be public, as real apps' bundles are.
- **`/login` is in `truth.json`** because it is in the route object. **`/` and `/logout` are not**: `/`
  redirects and `/logout` isn't a screen, and neither appears as a route the inventory reports.
- **The admin chunk uses absolute `path:` props.** A `path:"/admin"` parent with relative children made
  the inventory report `/admin`, which isn't a screen.
- **API URLs are inlined literals,** as a minifier leaves single-use constants, so the inventory can see
  the endpoints.
- **`--delay` counts from the end of the previous file,** not its start. Measured from the start, the
  server saw a 238 ms gap for a 250 ms delay, because the first request paid for connection setup.
- **Exit codes:** 0 when done, with refusals listed under `skipped`; 1 when some files failed (404 or a
  network error); 2 for usage; 3 when stopped. A 3xx counts as a stop, because a redirect is usually a
  sign-in and must not be worked around.
- **German labels:** English descriptors win over German (S2's priority rule). The test therefore checks
  that the German chunk feeds `labelSources`, and builds over the German file alone to check the German
  text.

## Remaining Work

- **For S4:** the app has never run in a browser. Only `node --check` and the HTTP tests have touched it.
  Expect small DOM bugs when the probe first drives it.
- **For S4:** a full page load costs 2 data requests (Shell and the screen), and in-app navigation costs 1.
- **For S4:** the account menu is `role="menu"`, with `menuitemradio` for the language.
- **For S4:** the status filter is a `listbox` with `aria-multiselectable`, and the date range is a
  popover `dialog`.
- **For S5/S9:** the inventory finds 2 of the 4 endpoints. It misses the GET links written as
  `href:"/api/export/….csv"` (an S2 extractor gap). The skill's text should not promise that every
  endpoint shows up in the code.
- **Next:** Session 4, the in-page probe.

## Resumption Context

Key files to review when picking this up:
- `plugins/audit/fixtures/partner-portal/README.md` and `truth.json`
- `plugins/audit/fixtures/partner-portal/public/assets/index-3f9c2a71.js`
- `plugins/audit/skills/platform-audit/scripts/bundle.mjs`
- `plugins/audit/test/portal.mjs`

Suggested opening prompt for next session:
> "Run `/planning:session .planning/platform-audit` for Session 4, the in-page probe."
