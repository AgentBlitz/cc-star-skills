# Partner Portal fixture

A fake partner back office for platform-audit's tests, its rehearsal and its trial run. It has the hard
cases a real audit meets: role-gated screens hidden from the menu, a lazy-loaded admin chunk, a compiled
German locale, filters, dialogs, a wizard with an upload, and a rate limit that batched navigation trips.

Everything in it is invented. It holds no real data and talks to nothing but the browser that opens it.

## Run it

```sh
node plugins/audit/fixtures/partner-portal/server.mjs            # any free port
node plugins/audit/fixtures/partner-portal/server.mjs --port 4173 --log /tmp/portal.jsonl
```

It listens on 127.0.0.1 only, and prints:

```
Partner Portal fixture on http://127.0.0.1:<port>
```

Node ≥ 20, no dependencies. Stop it with Ctrl+C (or SIGTERM).

| Flag | Default | What it does |
|---|---|---|
| `--port <n>` | `0` | The port. 0 picks a free one, so it never clashes with another stack. |
| `--log <file.jsonl>` | none | Appends one JSON line per request (below). |
| `--rate <n>/<seconds>` | `6/10` | Data requests allowed per session in a sliding window. |
| `--forbid-assets` | off | Answers 403 for everything under `/assets/`: the downloader's refusal test. |

## The demo account

Open `/login` and press **Sign in as demo partner**. There is no password. It sets an `HttpOnly` session
cookie, `pp_session`; `/logout` clears it. Every page and every `/api/` call needs it. The scripts, the
stylesheet and `/config.js` are public, as a real app's are.

The account is a partner (`ROLE_PARTNER`). Its details are the fixture's private terms, which a report
must never contain: **Dana Example**, `dana@example.com`, partner id `P-104233` and referral code
`REF-7Q2X`.

## What's in it

- **Shell:** a sidebar menu with collapsible groups (Sales, Finance, Reports, Settings), balance chips in
  the top bar, and an Account menu with the profile block, Language (English / Deutsch), the Referral
  link with Copy, and Log out.
- **Screens:** Orders (status, date-range, search and amount filters; Columns; Export CSV; rows per page;
  column header menus) → Order details (three panels); Payouts (empty, with a Request payout dialog);
  Customers (row selection enables Send voucher; an Import customers wizard with a drop zone and a
  template download) → Customer details; Reports → Sales weekly and Sales daily (tabs); Settings → Profile.
- **Hidden, role-gated:** Reports → Finance (managers), and Admin → Users, Audit log and Settings
  (admins). The menu leaves them out, and by URL each shows "You do not have permission to view this
  page." The admin screens live in `assets/admin-8d41b6e0.js`, which only an admin loads, but which the
  entry chunk names in a dynamic `import()`.
- **API:** `POST /api/graphql` (the queries the screens use, and a mutation behind every submit; the
  `OrderUpdates` subscription exists in the bundle only), `GET /api/export/orders.csv`,
  `GET /api/export/customers-template.csv` and `POST /api/upload` (CSV or XLSX, up to 2 MB).
- **Bundle:** `assets/index-3f9c2a71.js` (the entry chunk), `assets/admin-8d41b6e0.js` and
  `assets/de-c27f5a94.js` (the compiled German locale), plus `/config.js` with a long fake key for the
  redaction test. The hashes are fixed. The markup uses the ARIA roles real component libraries emit:
  `navigation`, `tab`, `grid` / `columnheader` / `row`, `dialog`, `listbox` / `option`, `menu` /
  `menuitem`.

[`truth.json`](truth.json) is the ground truth: every route, screen, menu entry, filter, column, action and
form field, with the statuses a correct report gives each route. Keep it and the app in step: the server
reads its route list from it, and the tests compare the bundle against it.

## The rate limit

Per session, at most 6 data requests (GraphQL, upload, export) in any 10 seconds by default. Above that,
`429` with `Retry-After: 30`. A full page load costs two (the shell and the screen), in-app navigation one,
so paced use stays under the limit and batched navigation trips it. Pages and assets don't count.

## The request log

With `--log`, one JSON object per line, written as each response finishes:

```json
{"time":"2026-11-27T10:00:00.000Z","method":"POST","path":"/api/graphql","op":"RequestPayout","kind":"mutation","status":200}
```

| Field | Value |
|---|---|
| `time` | When the request arrived (ISO 8601) |
| `method`, `path` | The request (the path without its query) |
| `op` | The GraphQL operation name, or `null` |
| `kind` | `page` · `asset` · `query` · `mutation` · `upload` · `download` |
| `status` | The response status |

The tests use it to prove pacing (asset timestamps) and to show which requests changed something
(`mutation`, `upload`).
