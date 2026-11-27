# Recon and the walk

Steps 1 and 4. Recon is one page load that tells you what the platform is. The walk then visits
every screen once, slowly, and writes each one up before moving on. `ground-rules.md` governs
every action here: read it first.

## The probe

`$S/probe.js` is the audit's eyes and its one guarded hand. Read the file and paste its **whole
text** as the script of one `javascript_tool` call. It defines `window.__auditProbe` and returns
`recon()`. Pasting it twice is harmless.

Every method returns a JSON string of **structure only**: names of controls, headings, column
headers, counts. Addresses come back as host and path, and emails, long numbers and query strings
are masked. It never returns cell text or field values, so nothing it says is personal data.

| Call | Returns |
|---|---|
| `__auditProbe.recon()` | `title`, `lang`, `host`, `path`, `params` (names only), `fw` (framework hints), `scripts`, `styles`, `nav` (item count and top-level names), `signin` |
| `__auditProbe.nav()` | The menus: each item's name, path, depth `d`, whether it is current (`cur`), hidden in a collapsed group (`hid`), external (`ext`) or opens a new tab (`tab`) |
| `__auditProbe.screen(sel?)` | The main area: headings `h`, `crumbs`, `tabs`, `buttons`, `links`, `fields` (type, placeholder, required, options of a select), `toggles`, `terms` (the labels of a details list), `tables` (columns with `sortable` and a header `menu`, row count, the empty text), `empty`, `pager`, `rowControls`. `sel` scopes it to a CSS selector, such as `header` for the top bar |
| `__auditProbe.overlays()` | Whatever is open on top: each dialog, menu, listbox or popover with its `options`, `groups`, `fields`, `toggles`, `buttons`, `links` and, for a dialog, its `notes` |
| `__auditProbe.requests()` | The network calls since it was last asked, as `calls` by host (`path status×count`), and `n429` |
| `await __auditProbe.peek()` | A quick reading of the cached scripts: `files` with sizes, `routes`, counts of `labels` and `ops`, lazy `chunks` it saw named, `hidden` (routes no menu item leads to) and `detail` (routes with a parameter) |
| `__auditProbe.open(i \| text, opts?)` | Presses one control, if the guard allows it: `{"ok":1,"t":…,"blocked":[]}` or `{"refused":"<reason>","t":…}` (`ground-rules.md` › The guard in `probe.js`) |

- Every control a method lists carries an index `i`. `open(i)` presses that control; `open('Columns')`
  finds one by its name, in an open overlay first. After the page redraws, an old index may
  answer `not found`: read the screen again for fresh ones.
- Controls inside table cells are never listed, because their names are data. `rowControls`
  counts them by kind ("link ×25", "Edit ×25").
- It reads the page's own document. What sits inside an embedded frame from another origin is not
  seen: say in the screen's block that the part is a frame, and describe its layout only.

**After a full page load** (an address load, a reload, a return from sign-in) the probe is gone
from the page. It kept its own source in the tab's sessionStorage, so put it back with this short
loader in place of the whole file:

```js
(()=>{try{return(0,eval)(sessionStorage.__auditProbe||'"paste probe.js"')}catch(e){return'eval blocked: paste probe.js'}})()
```

If it answers `paste probe.js` or `eval blocked: paste probe.js`, paste the file again. That is
expected on a new origin (sessionStorage belongs to one origin, and a sign-in host is another)
and on a page whose policy forbids `eval`. In-app navigation keeps the probe, which is one more
reason to move by the menu.

## Recon

One page load, before the interview. Until `pace` is answered, wait 20 s after it.

1. `tabs_context_mcp`, then a new tab, then `navigate` to the URL. Wait, then paste the probe.
2. **`signin` is not null:** the tab is on a sign-in page. Ask the user to sign in and wait
   (`ground-rules.md` › Sign-in). When they are in, paste the probe again.
3. Read `recon()`, then `nav()`, then `await __auditProbe.peek()`. If `peek()` fails or finds no
   files (scripts served from another host, or not cached), carry on; the interview has wording
   for that.
4. Take **one** screenshot at scale 0.5–0.6, to see the layout the text describes.
5. Work out:
   - the **product**'s name, as its own screens write it, and from it the **slug** (kebab case;
     the host's first label when there is no name);
   - the **role**, if the profile block, the account menu or a role name on screen says it;
   - the **menu**: groups, items and their paths, from `nav()`;
   - how many routes the code names, and which of them no menu item leads to (`peek()` ›
     `hidden`). Treat that list as a first reading: the inventory will correct it.
6. **Make the work folder.** `.platform-audit/.gitignore` holding the single line `*`, then
   `.platform-audit/<slug>/progress.md` from `templates/progress.md`, with the Target table
   filled in. Write the account's identifying strings to
   `.platform-audit/<slug>/private-terms.txt` (`ground-rules.md` › Privacy).
7. Tell the user what you found in about ten lines, structure only, and go to the interview.

## The order of the walk

1. **The global shell**: what is on every screen (below).
2. **The menu, top to bottom.** For each screen, in this order: the screen itself, its **tabs
   and sub-views**, its **detail page**, its **forms and dialogs**.
3. **Hidden routes**, last, as far as the `hidden` answer allows.

The Checklist in `progress.md` is the list to finish, not the menu: it has every route the code
names (`code-inventory.md` › From the inventory to the Checklist).

## One screen, step by step

1. **Go there inside the app**: `open(i)` on its menu item from `nav()` (open a collapsed group
   first, which is local). Then wait out the pace, and call `requests()`. A 429 stops everything
   (`ground-rules.md` › A 429, or any sign of rate limiting).
2. **Read it**: `screen()`. Note the path and the names of its parameters, the headings, tabs,
   buttons, filters, each table's columns and whether it has rows or its empty text, the pager.
3. **One screenshot** at scale 0.5–0.6 if the layout isn't clear from the text.
4. **Open what shows more**, one control at a time (next section), unless `interact=look`.
5. **Reconcile with the code** (`code-inventory.md` › Reconciling a screen with the code).
6. **Write the block now** (below), tick the screen in the Checklist, and move the resume point.

What a screen's block needs, from `templates/screen.md`:
- the header table: **Route** (in backticks, with where it lands from and what its address
  holds), **Menu**, **Who sees it**, **State observed** (with data, empty, or blocked, and what
  that meant for this account);
- **Purpose** and **Layout**;
- **Header actions**: each button, the state it was seen in, what it opens or does;
- **Filters**: each one's type and the options seen, with defaults;
- the **Toolbar**: export, column chooser, density, refresh, and their limits;
- **Table columns**, in order, with whether each can be hidden and whether it sorts;
- **Pagination**: page sizes, the default, how the total is shown;
- **Forms and dialogs** (opened, not submitted): fields with type and rule, and the buttons;
- **Code-only notes**: what the code holds for this screen that the screen didn't show.

Leave out a part the screen doesn't have. Every part carries its evidence tag (`writing.md` ›
Evidence tags).

## Opening controls

One at a time, and always the same four beats, so that nothing is left open and nothing is
pressed blind:

1. `open(i)`. A refusal is final; describe the control from the code instead.
2. Wait about a second (it is local). If `requests()` shows it loaded data, wait out the pace.
3. `overlays()`: read the options, fields, buttons and notes.
4. **Close it**: the `Escape` key with `computer`, or `open('Cancel')` for a dialog whose Escape
   does nothing. Then `overlays()` again; it should answer `[]`. Don't open the next thing until
   it does.

What to open on a screen:
- each **filter**'s list of options, the **date-range picker** (for its presets), the **rows per
  page** list and the **column chooser**. Read them; don't choose an option, tick a column or
  change the page size;
- one **column-header menu**. When the headers' menus look alike, one is enough: say in the
  block that it stands for the rest;
- the **account menu** and any top-bar menu, once, during the shell;
- each **header action** that opens a form or a dialog (next section).

## Forms and dialogs

With `interact=open-forms` or `downloads`:
- Open a data-entry form or dialog to read its **first step**: the title, each field with its
  type, whether it is required, a select's options, the helper and limit texts, the buttons.
  Then **Cancel** (or Escape). Type nothing into it.
- A wizard's later steps are not visited: Next often validates or uploads. Describe them from the
  code's labels.
- A drop zone or file input is read, never pressed. The file types and size limit are usually in
  its text and in the code's limits.
- A dialog that **only confirms** is not opened at all. Its title, text and buttons are in the
  code's labels.
- A button that is **disabled** until rows are selected: tick the first row's checkbox with
  `open(i, {toggle: true})` only when a bulk action can't be understood otherwise, read what it
  enables, open that action's form as above, cancel, and untick the row.

### Exports

Without `interact=downloads`, note each export button's name and place, and take its format and
row limit from the code. With it, press each export **once** with
`open(i, {allowDownloads: true})`, wait out the pace, and record only that it downloaded and what
kind of file it was. Don't open, read or move the file: it sits in the user's Downloads folder
and may hold real data. Tell the user at the end which files the audit caused.

## Tabs and sub-views

A tab that swaps the table or the panel is a view of its own. Open each one in turn (`open(i)` on
the tab; it usually loads data, so pace it), read it with `screen()`, and give it a sub-block or
a row in the screen's block. When many tabs share one layout and differ only in columns, one full
block and a table of "tab → columns that differ" says it best. Add each tab to the Checklist when
you find it, and tick it when written.

## Detail pages

- **The list has rows:** open the **first** row's detail link. The probe doesn't list row links,
  so find it with `find` ("the first row's link in the table") and click its `ref` with
  `computer`: it is a deliberate click, so hold it against the never-click list first. Wait out
  the pace. Read the page with `screen()`: its panels, the `terms` of each details list, its tabs
  and its actions. One record is enough; never page through records.
- **The list is empty:** the detail page can't be opened. Don't guess an id into the address.
  Mark the route 🔗, and describe the page from the code: its labels, columns and operations,
  tagged **[Code]**.
- The record's id, name and values never go in the report. The route is written with its
  parameter (`/orders/:orderId`).

## The global shell

Before the first screen, read what every screen shares: `nav()` for the menu, `screen('header')`
(or the selector that holds the top bar) for its controls, and the account menu opened once with
`open(i)` and read with `overlays()`. Record the menu and how it collapses, the top bar's chips
and what they show (the kind of value, never the value), the account menu's items, the language
list (read, never switched), help and external links (label and host only), and the profile
block's fields. This becomes the report's "Global interface" section and the menu tree.

## Hidden routes

The routes no menu item leads to, as the `hidden` answer says. They come last, when the visible
walk is safely written.

| `hidden` | Do | Status in the report |
|---|---|---|
| `code` | Visit none. Describe each from the code | 🔒 for each |
| `try-two` | Load **two** by address, from different menu groups. If either opens, visit the rest once each. If both are blocked, stop there | ⛔ for a route that was tried and blocked; ✅ or 📄 for one that opened; 🔒 for the rest |
| `try-all` | Load each once by address | ⛔, ✅ or 📄 for each |

- **Which two:** prefer screens that only show things (a report, a log) to screens whose purpose
  is to change things, and take them from different groups, so the answer says something about
  the whole. Never a route with a parameter, and never one that logs out.
- **Each try is a full page load**: `navigate`, wait out the pace, put the probe back with the
  loader, then `screen()` and `requests()`.
- **Blocked** means a permission message, a redirect to another screen or to sign-in, or the
  screen's data calls answering 401 or 403. Record what was shown, in the platform's own words.
  One try each: never reload a blocked route, and never try a variation of its address.
- **It opened:** walk it like any other screen. Take extra care on a screen this role isn't
  shown: read, open filters, and leave its forms closed.
- After the tries, go back to a normal screen by the menu.

Whatever the answer, each hidden screen gets its entry in "Screens not available to \<role\>",
described from the code: who it is for (`inventory.mjs access`), its purpose, its columns, fields
and actions.

## Writing as you go

Write each screen's block into the report file as soon as that screen is done, under the
screen-by-screen map, and each hidden screen's entry as soon as it is settled. Don't hold blocks
in the conversation for later: a long walk outlives its context, and a block written from memory
an hour later is a guess. Start the report file from `templates/audit.md` at the first screen
(`writing.md` › Starting the file), and leave the sections that come after the walk as they are.

After each screen, in `progress.md`:
- tick its line in the Checklist;
- set the **Resume point**: the very next step ("Reports › Sales daily: open the date picker"),
  and the last one done, with the time;
- add to **Decisions** anything decided on the way and why (a control left unopened, a tab
  treated as a view, a refusal by the guard).

## Resuming

When step 0 finds a `progress.md`:
1. Read it: the Target, the Answers (all settled), the Decisions, the Checklist, the Rate-limit
   log, the Resume point.
2. Read the report file's headings, to see what is written.
3. The old tab is gone. Do step 1's preflight again: a new tab, one paced load of the URL, the
   probe. Recon is not repeated, and no question is asked again.
4. Go to the Resume point by the menu and carry on from the first unticked item.
5. If the Rate-limit log's last entry is a second 429 with no answer from the user, ask before
   loading anything.

A release may have changed the app since the earlier session. If `recon()` › `scripts` no longer
match the names in the bundle's `manifest.json`, say so, and ask whether to read the code again;
headless, note it in Decisions and in the report's limits, and carry on with the code you have.

## Another role

One run audits the platform as **one** account sees it. For another role, the user signs in as
that account and runs the skill again: it gets its own slug (add the role, `<slug>-manager`),
its own work folder and its own report. Don't merge two roles into one report, and never ask for
or switch accounts yourself. In the report's next steps, say which other role would confirm the
parts that came from code.
