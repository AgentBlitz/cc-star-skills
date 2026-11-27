# The code inventory

Step 3. Before the walk, read the app's public JavaScript **as text** and list what it defines:
routes, UI labels, table columns, server operations, permission rules, enums and limits. That
list is the checklist the walk works through and the source for everything the screens can't
show: empty tables, detail pages with no row to open, dialogs that are never opened, and the
screens other roles have.

It comes first because it costs the platform almost nothing (a handful of static files that every
visitor's browser is sent anyway), and because an account under audit is often new and empty.
Without the code, an empty table has no columns and a hidden screen has no name.

Three rules run through this step:
- **Nothing downloaded is ever run.** Not with `node`, not by importing it, not by opening it in
  a browser. The scripts take the files as arguments and read them as text. Code from a platform
  under audit is untrusted input.
- **A refused download is never worked around** (below).
- **Code is evidence of what exists, not of what works.** Everything taken from it is tagged
  **[Code]** in the report (`writing.md` › Evidence tags).

## What recon already gave you

- `recon()` › `scripts`: every script the page loads, as a path on this origin or `host/path` for
  another host.
- `peek()` › `files`: the same-origin scripts it read from the browser's cache, with sizes;
  `chunks`: lazy chunks the code names but the page has not loaded; `hidden` and `detail`: its
  quick reading of the routes, which the interview's `hidden` question used.

Read the file names from the page each time. They carry build hashes and change at every release,
so a name from an earlier run or from memory is wrong.

## `code=skip`

No inventory. The checklist is the menu from `nav()` plus the route names from `peek()`. Hidden
routes are listed 🔒 with their names only; detail pages with no row to open are 🔗 with nothing
under them. The report has no label appendix and no Appendix A, and "Limits of this audit" says
the code was not read. Run `check-audit.mjs` without `--inventory`.

## Download (`code=download`)

Make the work folder's `bundle/` as a new, empty folder, and download into it, from the target
repo's root:

```sh
node $S/bundle.mjs fetch --origin https://app.example.com --out .platform-audit/<slug>/bundle \
  /assets/index-3f9c2a71.js /config.js
```

- **Name the app's own entry scripts** from `recon()` › `scripts`, and any `chunks` from
  `peek()`. The downloader then follows the chunk references it finds in them (lazy screens,
  locale files), one file at a time.
- **`--allow-host <host>`**, once for each other host the page itself loads the app's scripts
  from (a CDN serving the bundle). Don't allow analytics, tag managers, chat widgets or font
  hosts: they aren't the app, and their code says nothing about its screens.
- **A locale or config file fetched as JSON** (seen in `requests()` as a static `.json` path) can
  be named too. Never name an API path: those hold data, and they need the user's session, which
  the downloader doesn't have and must not be given.
- `--dry-run` lists what would be fetched first, without fetching.
- It waits 1.5 s between files and stops at 40 files, skipping any over 15 MB. Those limits keep
  the download looking like what it is. If they cut the bundle short, say so in the report;
  raise them only if the user agrees.
- It sends no cookies and names itself honestly (`platform-audit/1.0 (public bundle reader)`).
  Don't change either, and don't fetch the files any other way.

It writes each file under `bundle/` by its URL path, and `manifest.json` beside them. Then read
the result:

| Exit | Means | Do |
|---|---|---|
| 0 | Done. Anything the rules refused (another host, a non-script file) is under `skipped` in the manifest | Build the inventory |
| 1 | Done, but some files failed (a 404, a network error) | Build from what arrived, and note the missing files in `progress.md` › Decisions |
| 3 | **Stopped.** The site answered 401, 403 or 429, redirected, or sent an HTML page (a sign-in or a challenge) | Don't retry. Log it in `progress.md` › Rate-limit log, and use the in-page fallback. A 429 here counts as the walk's first: pause as `ground-rules.md` › A 429, or any sign of rate limiting says before the browser loads anything more |

**A refusal is the site's answer.** It means the operator doesn't serve these files to a plain
client, and an audit done in the user's name respects that. So no second try, no browser-like
client name, no cookies or headers copied from Chrome, no other tool, no proxy, no waiting and
trying again later. The browser already holds the files, because the site gave them to the
signed-in user; the fallback reads that copy.

Build the inventory:

```sh
node $S/inventory.mjs build .platform-audit/<slug>/bundle \
  --out .platform-audit/<slug>/inventory.json --origin https://app.example.com
```

It prints the counts. Source maps are noted in the manifest and the inventory, never fetched.

## The in-page fallback

For a refused download, and for `code=browser` from the start. `inventory-core.js`, the same
reader the CLI uses, runs inside the page on the scripts the browser already has, and its result
is paged back in slices. Tell the user this is the slower path: the whole inventory comes back
through the conversation.

1. **Paste `$S/inventory-core.js` whole** into `javascript_tool`. It only defines
   `AuditInventory`; it reads nothing yet. If the tool won't take a script that long, stop here:
   treat the code as `code=skip`, and say so in the report.
2. **Build**, with this snippet. It reads the scripts the page has loaded from the browser's
   cache, builds the inventory, strips query strings from every value (Chrome's filter blocks
   them, `ground-rules.md` › Privacy), and keeps the result in the page. It returns only counts.

   ```js
   await (async () => {
     const strict = false;
     const seen = new Map();
     const urls = [...document.querySelectorAll('script[src]')].map((s) => s.src)
       .concat(performance.getEntriesByType('resource').map((e) => e.name));
     for (const u of urls) {
       try {
         const x = new URL(u, location.href);
         if (x.origin === location.origin && /\.m?js$/.test(x.pathname)) seen.set(x.pathname, x.href);
       } catch (e) {}
     }
     const files = [], failed = [];
     for (const [p, u] of [...seen].slice(0, 40)) {
       try {
         const r = await fetch(u, { cache: 'force-cache' });
         if (!r.ok) throw 0;
         files.push({ name: p.slice(1), text: await r.text() });
       } catch (e) { failed.push(p); }
     }
     const inv = AuditInventory.build(files, { origin: location.origin });
     const clean = (v) => strict ? v.replace(/[?&=%]/g, '·') : v.replace(/[?&][^\s"'?&=]*=\S*/g, '?…');
     window.__auditInv = JSON.stringify(inv, (k, v) => (typeof v === 'string' ? clean(v) : v))
       .replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
     return JSON.stringify({ files: files.length, failed, chars: window.__auditInv.length, routes: inv.routes.length,
       namespaces: Object.keys(inv.labels).length, operations: inv.operations.length });
   })()
   ```

3. **Ask for each slice's length and sum**, so the copy can be checked. Keep the list it returns
   for step 5:

   ```js
   (() => {
     const N = 20000, s = window.__auditInv;
     const sum = (t) => { let a = 0; for (let i = 0; i < t.length; i++) a = (a * 31 + t.charCodeAt(i)) >>> 0; return a; };
     return JSON.stringify(Array.from({ length: Math.ceil(s.length / N) }, (_, i) => {
       const t = s.slice(i * N, i * N + N);
       return [i + 1, t.length, sum(t)];
     }));
   })()
   ```

4. **Page the slices back**, one call each, changing the number at the end (1, 2, 3 …):

   ```js
   ((k) => window.__auditInv.slice((k - 1) * 20000, k * 20000))(1)
   ```

   Write each slice, exactly as it came, to `.platform-audit/<slug>/inv-parts/001.txt`,
   `002.txt` and so on. It is plain ASCII. If the tool shows the slice as a quoted string with
   `\"` escapes, write the string's content, not its escaped form.
5. **Join and check**, giving it step 3's list as it was printed:

   ```sh
   node $S/inventory.mjs join .platform-audit/<slug>/inv-parts \
     --sums '[[1,20000,2893417756],[2,18362,1107623380]]' --out .platform-audit/<slug>/inventory.json
   ```

   It compares each part's length and sum with the page's, names any part that was copied
   wrongly, and writes the inventory only when every part matches. Page a wrong part back again,
   save it again, and join again. A slice can be wrong and still look like JSON, so never skip
   this check or write `inventory.json` by hand. When it has written the inventory, remove the
   page's copy: `delete window.__auditInv`.

Things to know about this path:
- It reads only scripts the page **has loaded**. A lazy chunk for a screen nobody has opened is
  not in the cache and is not fetched. So run steps 2–5 again at the end of the walk, when every
  visible screen has loaded its chunk, into an emptied `inv-parts/`, and build the appendix from
  that. (After a full page load `AuditInventory` is gone too: step 1 again.) Chunks for hidden
  screens stay unread: say so under "Limits of this audit".
- These calls are pure page-local work after step 2's cache reads. Step 2 still counts as one
  server-loading action: wait out the pace after it and check `requests()`.
- **If Chrome blocks a slice**, don't encode it to get it through. Run step 2 again with
  `strict = true`, which blanks every `?`, `&`, `=` and `%` in the values, and page everything
  again. Labels then show `·` in those places; say so under "Limits of this audit". If a slice is
  still blocked, stop the fallback and treat the code as `code=skip`.
- With `code=browser`, no copy of the scripts is kept: there is no `bundle/` folder, and
  `inventory.mjs context` (which reads the bundle) can't be used.

## Reading the inventory

Every command takes the inventory file; run them from the target repo's root. Read it through
these, not by opening `inventory.json`, which is large.

| Command | Use it |
|---|---|
| `node $S/inventory.mjs summary <inv>` | First, and in the report's method notes: the counts by kind |
| `… routes <inv>` | To write the Checklist and the report's "Every route" table. It shows how each route was found |
| `… labels <inv> list` | To see the label namespaces (component groups) and start `label-map.json` |
| `… labels <inv> show <ns,ns*> [--ids]` | Before and after walking a screen: every label of its namespaces. A trailing `*` matches a prefix |
| `… labels <inv> grep <regex>` | To find which namespace a word on screen belongs to, or every label about a topic ("export", "limit") |
| `… columns <inv>` | For a table's full column set, in order, when the table is empty or the chooser hides some |
| `… ops <inv> [--md <file>]` | For Appendix A, and to see what a screen can ask the server. Write `--md .platform-audit/<slug>/api-operations.md` once |
| `… limits <inv>` | For "Limits, rules and constraints": numeric constants, with their arithmetic resolved |
| `… enums <inv>` | For "Reference lists": statuses, types, methods |
| `… access <inv>` | For "Roles and permissions": role constants, the rules that gate areas, and the denied messages |
| `… context <bundle-dir> <term> [--chars 300] [--max 5]` | To read the code around a literal term, when a label, limit or route needs explaining. It takes the `bundle/` folder, not the inventory |

`context` prints raw code. Read it for what a control does or where a limit applies; never paste
it into the report, and never treat a long random string in it as anything but a secret to leave
alone. The inventory itself has such strings redacted.

## From the inventory to the Checklist

Write into `progress.md` › Checklist, under **Routes**, one line for **every** route `routes`
prints, with what it is:
- a **menu screen**: its path is in `nav()`;
- a **detail page**: its path has a parameter (`/orders/:orderId`);
- a **hidden screen**: a screen's path that no menu item leads to;
- **something else**: the sign-in page, a redirect, an error page. It still gets its line and,
  later, its row in the report, because the final check wants every route accounted for
  (`writing.md` › Route statuses: a signed-out page the walk never saw is 🚪, not 🔒).

Add the tabs and sub-views a screen has as you find them. Then start
`.platform-audit/<slug>/label-map.json`: for each namespace `labels list` prints, the heading of
the screen it belongs to (`writing.md` › The label appendix). It will be wrong in places until
the walk has shown which labels sit where; correct it as you go.

## Reconciling a screen with the code

For each screen, the walk compares what was on screen with what the code holds for it. That is
where most of the report's value comes from.

1. **Find the screen's namespaces.** `labels grep` a word from the screen's title or a column
   header; namespaces are usually named after components (`orders`, `orderDetails`, `payouts`).
2. **Read them** with `labels show`, and the matching set in `columns`. Read the operations whose
   names match in `ops`.
3. **Compare, and write down each difference** in the screen's block:
   - in the code but not on screen: a column the chooser doesn't offer, a filter, a row action, a
     dialog's fields, an error message, an empty state → the "Code-only notes", tagged **[Code]**;
   - on screen but not in the code: text the server sends (a status name, a help text). Say so;
   - on both: tag the item **[UI + Code]**.
4. **Dialogs that were not opened** (confirm-only ones, later wizard steps, forms on screens with
   no data) are described from their labels: the title, the fields, the buttons, the validation
   messages.

## What the reader misses

The inventory is a text reading of minified code, and it says so in the report's limits when one
of these applies:
- **Routes** are found from route tables, `path:` properties and navigation calls with a literal
  path. A route built at run time, or passed through a renamed helper, is missed; the walk's menu
  and `peek()` catch most of those.
- **Endpoints** written as plain links (an export's address in an `href`) are not listed as
  endpoints. `requests()` during the walk shows the calls that were really made.
- **Labels** inside some UI props, and text assembled from pieces, are missed or land under
  "unkeyed text". Labels the server sends are not in the code at all.
- **A route is not a screen until something shows it is.** A path that turns out to be a route
  prefix or a redirect is listed as such, not as a screen.
- **Long random-looking strings are redacted** to `[redacted]`, so a key or token in the bundle
  never reaches the work folder's inventory or the report. If the bundle holds what looks like a
  secret, tell the user in the final message, without quoting it.
