# Writing the report

Step 5, and the blocks written during the walk. The report is read by people deciding whether a
platform does what they need, often months later and often to build against it. They were not
there for the walk. So every statement says where its evidence came from, every gap is named,
and nothing in it depends on having seen the screens.

## The two files

- `<folder>/<SLUG>-PLATFORM-AUDIT.md`: the report. `<folder>` is the `folder` answer
  (`docs/<slug>-audit/` by default), and `<SLUG>` is the slug in capitals.
- `<folder>/appendix-ui-labels.md`: the label appendix, written by `appendix.mjs`.

Both are local markdown files in the repo. Nothing is published anywhere.

### Starting the file

At the first screen of the walk, copy `templates/audit.md` to the report's path and fill in the
title. The template's `<!-- SECTION … -->` comments say what each section is for: follow them,
and **delete each one as its section is written**. The final check fails while any is left.
Sections whose turn has not come keep their placeholders until step 5.

## The sections

In the template's order. The numbers below are the template's, with a requirements check; without
one they shift (next section).

| § | Section | Written | From |
|---|---|---|---|
| | Title and "How to read this document" | first | the template; put the role in |
| 1 | Executive summary | **last** | everything else |
| 2 | Requirements check | step 5, only with a checklist | the user's list, against §6–§10 |
| 3 | Platform architecture and access model | step 5 | `recon()`, `summary`, `access`, `ops`, the walk |
| 4 | Navigation map | step 5 | `nav()`, `routes`, the walk's statuses |
| 5 | Global interface | during the walk (the shell) | `walking.md` › The global shell |
| 6 | Screen-by-screen map | during the walk, a block a screen | `templates/screen.md` |
| 7 | Screens not available to \<role\> | during the walk, at the end | the code, and the hidden tries |
| 8 | Capability matrix | step 5 | §5–§7 |
| 9 | Limits, rules and constraints found | step 5 | the screens, `limits`, validation labels |
| 10 | Reference lists | step 5 | `enums`, filters' options |
| A | Server operations available to the web app | step 5 | `ops` |
| B | UI label inventory | step 5 | `appendix.mjs` |

Notes on the ones that need judgement:

- **§3 Architecture.** Only what the browser shows: the frameworks (`recon()` › `fw`, `summary`),
  how sign-in works as seen (a form, a single sign-on redirect), the API's style (GraphQL, REST,
  live updates), hosts named **by their part** ("a separate sign-in host", "one API gateway"), not
  by address. The business scope is the entities and enums the operations reveal, tagged
  **[Code]**. Roles come from `access`: each role and the areas it can open. Data scope is what
  the server filters to this account, as seen in filters, operation variables and empty states.
- **§4 Navigation map.** The menu as a tree with each item's route; the menu items other roles
  have, from the code; then **every route the inventory found**, each in backticks with one
  status. The count in the heading is the table's row count.
- **§7 Screens not available.** One entry per hidden screen: who it is for, its purpose, what it
  holds. Say which routes were tried by address and what each showed, in the platform's words.

### Route statuses

One per route, in §4's table and on §7's headings:

| Status | Use it when |
|---|---|
| ✅ seen on screen | The screen opened and showed its content |
| 📄 opened, but empty for this account | It opened, and its table or panel had no data |
| 🔗 detail page, no data to open | A route with a parameter, and no row to open it from |
| 🚪 public page, not opened (already signed in) | A page for signed-out visitors (sign-in, sign-up, password reset) that the walk never saw, because the user was already signed in |
| ⛔ tried and blocked | Loaded by address under the `hidden` answer, and refused |
| 🔒 not shown to this role (from code) | Never visited; known from the code only. Not for a signed-out page (🚪) |

A route that is not a screen (the sign-in page, a redirect) still gets its row, and a few words
saying what it is:

- the sign-in page and the other signed-out pages: ✅ if the tab showed them during the walk
  (the user signed in there), and then a short block with what they show; 🚪 if not. Never load
  one to see it: on some platforms that ends the session;
- a redirect or other route the walk passed through: ✅; one it did not: 🔒.

## Evidence tags

Three tags, and the reading key at the top explains them:

- **[UI]**: seen on screen in this walk, signed in as this role.
- **[Code]**: found in the app's code only. The screen was empty, the control was not opened, or
  the screen belongs to another role.
- **[UI + Code]**: both agree.

Tag each part of a screen block (the template shows where), each row of a table whose rows differ
in evidence, and every statement in the summary that rests on code alone. Be exact rather than
generous: a dialog read from its labels is **[Code]** even though its button was seen. Labels
from shared components that the product may not use are marked *(shared library)*.

The check looks for **three keys**, word for word as the template has them: the reading key
("How to read this document"), the route status key ("Status key: …") above §4's route table, and
the capability key ("Key: …") under the capability matrix's heading. Keep all three even when a
status is unused.

## The requirements check

Only when the `checklist` answer gave a list.

- **Read the list** from the path given, or from `.platform-audit/<slug>/requirements.md` where a
  pasted list was saved. Keep each requirement in the user's own words, one row each, in their
  order. Split a line that asks for two things only if their answers differ.
- **Give each a status:** ✅ met · ⚠️ partial · ❌ missing · ❓ can't tell. The evidence column
  points to the section that shows it (`§6.3`) and says in a line what was found.
  - ✅ needs evidence this role can use, seen on screen.
  - A capability that exists only in the code, or only for another role, is ⚠️, and the line
    says which.
  - ❌ means the screens and the code were both searched (`labels grep`) and nothing was found.
    Say what was searched for.
  - ❓ is the honest answer when an empty account or an unread chunk hides the truth. It is
    better than a guess in either direction.
- **Numbering.** With a checklist, the template's numbers stand: the check is §2. Without one,
  delete §2, renumber every later section (3 → 2, and so on, with their sub-sections), and fix
  every `§` reference to match. The final check's `xref` rule catches a reference to a heading
  that no longer exists, but not one that now points at the wrong section: search for `§` and
  read each one.

## The capability matrix

One table per **domain**, each row a capability with a status and the section that shows it. The
key: ✅ available to this role · 🔒 exists, but only for other roles · 👁 view only · ⚠️ partial or
limited · ❌ not found.

Choose the domains from what this platform does, not from a fixed list. Read the menu groups,
the operation names and the enums, and name five to ten areas a buyer would ask about. Most
platforms have some of: access and account; the main records (customers, orders, accounts,
tickets); money movement; hierarchy or teams; pricing, commission or billing; reporting and
exports; marketing and referral; multi-brand, multi-currency or multi-language; administration
and logs; integrations and API. Within a domain, list what a user would call a capability
("export orders as CSV", "see a customer's order history"), including the ones a reader would
expect and the audit did **not** find, as ❌. A matrix of only ✅ rows hides the gaps the reader
most needs.

## Limits and reference lists

- **Limits, rules and constraints.** Every number or rule that bounds what a user can do: page
  sizes, export row limits, upload sizes and file types, minimum and maximum amounts, date-range
  limits, lengths, timeouts, retention. Take them from the screens' helper texts, from
  `inventory.mjs limits` and from validation labels (`labels grep "max|min|limit|at least|up to"`).
  Give the value in bold, in the unit a person would use (2 MB, not 2097152), with where it
  applies and its tag.
- **Reference lists.** Each enum the platform shows or holds: statuses, types, methods, roles.
  Give the list's name, its count, where it is used, and the members in the platform's own
  spelling. These are the platform's vocabulary, not records, so they are written out in full.

## Appendix A: server operations

From `node $S/inventory.mjs ops <inv>` (the `--md` file in the work folder has them all). Open
with a paragraph on how the app talks to the server, and say that listing an operation doesn't
mean this role may call it: the server still checks. Then group them by area: data queries,
actions, live subscriptions, or REST endpoints by path, each with the screen that uses it. The
audit **never calls** an operation itself; the list is read from the code.

## The label appendix

`appendix.mjs` writes it from the inventory and a map of component groups to screens:

```sh
node $S/appendix.mjs .platform-audit/<slug>/inventory.json \
  --map .platform-audit/<slug>/label-map.json --title "<Product>" \
  --out <folder>/appendix-ui-labels.md \
  --build index-3f9c2a71.js --date 2026-01-31 --report <SLUG>-PLATFORM-AUDIT.md
```

`label-map.json` is one flat object, `{ "<component group>": "<heading>" }`:

```json
{
  "shell": "Navigation, layout and app-wide messages",
  "order*": "Sales › Orders and Order details",
  "payouts": "Finance › Payouts",
  "admin": "Hidden → Admin (Users, Audit log, Settings)",
  "common": "shared"
}
```

- A key is a namespace from `inventory.mjs labels <inv> list`. A key ending in `*` matches every
  namespace with that prefix; an exact key wins over a prefix, and a longer prefix over a
  shorter.
- Headings come out in the map's order, so write it in the report's order: the shell, the screens
  as the menu has them, then the hidden ones.
- The heading `"shared"` sends a group to the shared-library section: labels of a component
  library bundled with the app, most of which no screen uses. Use it when the walk showed no
  screen with those labels.
- A group the map doesn't name lands under "Other". Aim for an empty "Other": check with
  `labels show <ns>` where each belongs.

Appendix B in the report is the template's two lines, with the counts `appendix.mjs` printed and
the link. With `code=skip` there is no appendix: say so there in a sentence, and remove the link.

## The executive summary

Written **last**, from the finished sections, in the template's six parts and order (the check
looks for each bold label):

1. **What it is.** One paragraph: what the product is, who uses it, how sign-in works, its
   languages and currencies.
2. **What \<role\> can use.** Counts and lists: screens, detail pages, account tools.
3. **Strengths.** What it does well, each with the section that shows it.
4. **Limitations and gaps to raise with the provider.** What is missing or limited, and why it
   matters to this role. These are the questions the reader will take to the provider.
5. **Limits of this audit.** What was not opened, submitted or seen, and why: empty tables, hidden
   screens described from code, unread chunks, rate limits, a refused download.
6. **Suggested next steps.** Short and concrete: a demo account with data, a higher role's
   sign-in, a question to the provider.

Keep findings and limits apart. "The platform has no bulk export" is a finding; "the export was
not pressed" is a limit of the audit.

## Style

- Plain and direct, in short sentences. No sales language, in either direction.
- The screens' own words in **bold** (**Request payout**, **Rows per page**), spelled as the
  platform spells them. Numbers that matter in bold.
- Structure only, with placeholders for data: `<customer-id>`, `<email>`, `<amount>`. No name,
  id, balance or code from the account (`ground-rules.md` › Privacy).
- The user's own spelling (UK or US), taken from how they write.
- Every table row has as many cells as its header: an empty cell is `—`, and a `|` inside a cell
  is written `\|`.
- Say "not found" only for what was searched for, and "not seen" for what the walk couldn't
  reach.

## The final message's "Written for:" line

The message that ends the run (`checking.md` › The final message) opens with one line naming who
it is pitched at, so the user can forward it as it stands:

> Written for: the people who asked for this audit, business and technical readers comparing the
> platform against their needs.

Take the readers from what the user said about why they want the audit. When they said nothing,
use the line above.
