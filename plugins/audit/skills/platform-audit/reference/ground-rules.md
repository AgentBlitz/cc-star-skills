# Ground rules

Read this before the first browser call. It holds for every step after it, whatever the interview's
answers are.

**Why the rules are strict.** The audit runs in the user's own signed-in Chrome, on a live
platform. Every click is made as the user, on an account they answer for; the platform may move
real money; the people in its tables are real; and its operator can lock an account that behaves
like a bot. An audit that changes one setting, sends one message or trips one rate limit has cost
the user more than the report is worth. So when a rule and the wish for a fuller report pull in
different directions, the rule wins, and the report says what was not looked at and why. A gap
that is named is a good audit; a click that was not safe is not.

## Read-only

The audit looks and reads. It may open things that only show more of the screen: a menu, a tab, a
filter's list of options, a date picker, a column chooser, a detail page, and the first step of a
data-entry form. It closes each one again with Escape or Cancel. It never does anything the
platform would remember or act on.

### Never click, and why

| Never | Why |
|---|---|
| Save, Submit, Confirm, OK, Yes, Apply changes, Update | These write to the platform. A form opened to read its fields is closed with Cancel or Escape |
| Delete, Remove, Archive, Reset, Revoke, Ban, Suspend, Deactivate, Block | They destroy or lock something, often with no undo, and often someone else's |
| Transfer, Pay, Refund, Withdraw, Approve, Reject, Decline | They move money or decide something for a person |
| Send, Invite, Publish | Real people receive what is sent |
| Upload, Import, a file input, a drop zone | Opening a file picker hangs the browser session, and an import writes many records at once |
| Log out, Sign out | It ends the user's session, and the user must sign in again by hand |
| A language switch, a theme switch, any settings control | The choice is saved to the account and changes what the user sees afterwards |
| Copy (a referral link, a key, a code) | It overwrites the user's clipboard, and puts an identifier where it may be pasted by accident |
| A row's switch or checkbox that turns something on or off | It takes effect at once, with no Save to hold back |
| A button whose dialog only confirms ("Are you sure?") | The only thing left to click is the action itself. Describe the dialog from the code's labels |
| Anything that raises a browser alert, confirm or prompt | A native dialog blocks the page, and the extension stops answering until the user dismisses it by hand |
| Export, Download (unless `interact=downloads`) | The file holds real data and lands on the user's disk |
| A link to another host, or one that opens a new tab | The audit covers the platform the user named, in one tab. Note the link's label and where it points, by host |
| Next, in a wizard | Later steps often validate, upload or save. The first step is read; the rest come from the code |

Also leave a table's own state alone: don't tick or untick columns in a column chooser, don't
change the page size, and don't click a header to re-sort. Many platforms save these per account,
and each one reloads data. Open the chooser or the list to read its options, then Escape. Work out
which columns sort from `screen()`'s `sortable` and from the code. Keep the default date range,
and look at page 1 only.

**Typing.** Only into a search or filter box, only when a screen can't be understood without it
(what a search matches on, say), only a neutral word, and clear it afterwards. A search is a
server load: pace it. Never type into a form's fields, and never a credential.

### The guard in `probe.js`

`__auditProbe.open(i | text)` is the only way the walk presses anything through the probe, and
it refuses, by name and by kind, most of what the table above lists. It is a net, not a licence:
what it lets through still has to pass the table. A refusal answers
`{"refused":"<reason>","t":"<the control's name>"}` and clicks nothing. The reasons:

| Reason | What it caught |
|---|---|
| `disabled` | A disabled control |
| `file input` | A file input, a control that holds one, or one that sits next to one (a drop zone) |
| `other host` | A link whose address is on another host |
| `new tab` | A link that opens a new tab |
| `log out` | Log out or sign out, by its name or its address |
| `download` | Export or download by name, a link with a `download` attribute, or one to a file or an export path. Allowed only with `open(x, {allowDownloads: true})`, and only when `interact=downloads` |
| `danger word` | A name holding one of: delete, remove, destroy, erase, purge, transfer, pay, refund, withdraw, approve, reject, decline, revoke, ban, suspend, deactivate, archive, reset, publish, upload, copy, clipboard, duplicate, or "cancel \<something\>" (cancel an order), with the common German forms |
| `submit` | A name holding save, submit, confirm, ok, yes, apply changes or update; any `type=submit` button in a form or a dialog; and, **inside** a dialog or form, send, import, create, add, invite, finish or done |
| `toggle` | A switch, a menu item that is a radio or a checkbox (settings, language), and any checkbox or radio unless `open(x, {toggle: true})` |
| `not found` | The index is stale or the text matches nothing: read the screen again |

- **Openers and submitters.** Outside a dialog or form, "Send voucher", "Import customers",
  "Create order" and "Add user" open a form, so they are allowed. Inside one, the same words send
  it, so they are refused. A plain Cancel, Next and Apply (a filter's) are allowed by the guard;
  Next is still not pressed, for the reason in the table above.
- **Native dialogs.** While it clicks, the guard replaces `alert`, `confirm`, `prompt` and
  `window.open` with stubs, and lists any that fired under `blocked`. A non-empty `blocked` means
  the control was not what it seemed: note it in `progress.md` › Decisions and don't press it
  again.
- **The first row's selection checkbox** may be ticked once, to see which bulk actions it
  enables, when `interact` allows opening forms. It sits in a table cell, so the probe doesn't
  list it: find it with `find` and click its `ref` with `computer`, then untick it the same way.
  `{toggle: true}` is for a selection checkbox the probe does list (outside the table). Never
  tick a switch, a column chooser, "Select all" or a settings checkbox.
- **A refusal is final.** Don't press the same control another way. If the guard refuses
  something harmless (a tab called "Archive", a filter called "Approved"), describe what it leads
  to from the code (`code-inventory.md`), or ask the user. The guard reads names, not intent, so
  it also lets through what a name hides: read every control's name and surroundings before
  pressing it, and when in doubt, don't.
- **Deliberate clicks with the `computer` tool follow the same list.** Some things the probe
  can't press: a row's link to its detail page (the probe never lists controls inside table
  cells), a control drawn on a canvas, a hover menu. Find the control with `find`, read its name,
  hold it against the table above yourself, and only then click it by its `ref`.

### What each interaction level allows

| `interact` | The walk may |
|---|---|
| `look` | Move between screens by the menu, tabs and row links, and read. It opens nothing else; what a control offers comes from the code |
| `open-forms` | Also open menus, filter lists, pickers, column choosers and the first step of data-entry forms, closing each with Escape or Cancel |
| `downloads` | The same, and press each export once (`walking.md` › Exports) |

## Pacing

Platforms limit how fast an account may load data, and a signed-in session that loads pages
faster than a person could looks like an attack. The `pace` answer (20, 10 or 5 seconds) is the
wait after **every action that loads server data**: opening a page, changing a tab that fetches,
applying a filter, opening a detail page, searching.

- **One tab, one step at a time.** Never open a second tab, and never queue two loads. If the
  extension offers a batch tool, one batch may hold one server-loading action, its waits and the
  reads that follow. It never holds two loads.
- **Wait with `computer` `wait`**, in steps of at most 10 seconds: 20 s is two waits. Until
  `pace` is answered (recon comes before the interview), use 20 s.
- **Actions that only change the page locally** go faster: opening a menu, a picker or a column
  chooser needs about a second before `overlays()`. If `requests()` then shows the action did
  fetch something, it was a server load: wait out the pace, and treat that kind of control as one
  from then on.
- **Move inside the app**, by pressing the menu as a user would, in preference to loading
  addresses. An address load fetches the whole app again, and it is how a probing script looks.
- **After each wait, call `__auditProbe.requests()`.** It lists the calls made since the last
  time it was asked, by host, path and status, and counts the 429s under `n429`.
- **Keep the load small:** default date ranges, page 1, no re-sorting, no "refresh" buttons.

### A 429, or any sign of rate limiting

A 429 in `requests()`, a "too many requests" or "slow down" message, a challenge page or a
CAPTCHA all mean the same thing.

1. **Stop.** Make no further request of any kind. Don't retry the action.
2. Write it in `progress.md` › Rate-limit log, with the time and what was being loaded.
3. Wait 3 to 5 minutes, with `computer` `wait` in 10-second steps and nothing in between.
4. Go on one pace slower than before (5 → 10 → 20 s; at 20, go to 30).
5. **On a second one, stop again, tell the user what happened both times, and ask before going
   on.** Headless, write the resume point and stop instead.

A CAPTCHA or a challenge page is never solved or clicked through: tell the user, and wait for
them. A session that expires in the middle of the walk is the same as a sign-in page (below).

## Privacy

The report records **structure only**: screens, fields, columns, filters, options, actions,
rules. It never holds what the account's data says: no names, emails, ids, balances, amounts,
dates of records, referral codes or addresses. Where an example helps, use a placeholder:
`<customer-id>`, `<email>`, `https://…/?ref=<code>`. The report may be read by people the data's
owners never agreed to share it with, and it lives in a repository for years.

- **The probe never returns data.** Its output has names of controls, headings, column headers
  and counts, never cell text or field values, and it masks emails, long numbers and query
  strings. Read screens through it, not through `get_page_text` or `read_page`, which bring every
  cell into the conversation.
- **`private-terms.txt`** in the work folder lists the strings that identify this account, one a
  line: the display name, the username, the email, the account or partner id, the company name, a
  referral code, a phone number. Read them once from the profile block or the account menu (a
  zoomed screenshot or `find` will do), write them there at once, and add any the walk shows
  later. Only `check-audit.mjs` reads the file, and it never leaves the work folder: it is how
  the final check proves none of them reached the report. Write whole strings; a term of two or
  three letters matches ordinary words.
- **Chrome's query-string filter.** Claude in Chrome blocks a script's output when it holds a
  URL's query string, since those carry tokens. So a page script never returns `location.search`
  or `location.href` (use `location.pathname`, and the *names* of the parameters when they
  matter), and it strips query strings from any code excerpt before returning it. The probe
  already does both. When an output is blocked, remove the data that tripped the filter; don't
  encode it to get it through.
- **Screenshots show real data.** What you see in one is not written down anywhere, in the
  report, in `progress.md` or in a message.
- **The scripts are public; the data is not.** `bundle.mjs` downloads only what any visitor's
  browser is sent, without cookies. Nothing behind the sign-in is ever fetched outside the
  browser, and no API is called directly.

## Context hygiene

A full walk is a hundred or more browser steps, so each step should bring back little.

- Prefer text: `screen()` and `overlays()` return a few hundred characters of structure.
- Take a screenshot only when the layout can't be told from the text, at **scale 0.5–0.6**, at
  most one a screen. Use `zoom` on a region for a detail, in place of a full-size screenshot.
- Write each screen's block into the report as soon as the screen is done, and tick it in
  `progress.md`. The report file is the memory; the conversation is not.
- Give the user a line of progress after each menu group, not after each click.

## Sign-in

The user signs in, by hand, in the tab the audit opened. `recon()` reports `signin` as
`sign-in form` or `auth page` when the tab is on one.

- Say: "Please sign in in the tab I opened, and tell me when you're in." Then wait for the reply.
  Headless, say so and stop.
- Never type a username, password or code, never press a "Sign in with …" button, and never read
  or copy a cookie, a token or a stored password. A password manager's prompt is the user's to
  answer.
- After sign-in the page has loaded afresh, often from another host: paste the probe again
  (`walking.md` › The probe).
- If the session expires during the walk, write the resume point, log it under Rate-limit log,
  and ask the user to sign in again.

## Claude in Chrome, and nothing else

- Load the tools in one ToolSearch call: `tabs_context_mcp`, `tabs_create_mcp`,
  `tabs_close_mcp`, `navigate`, `computer`, `find` and `javascript_tool`, all under
  `mcp__claude-in-chrome__`. Call `tabs_context_mcp` first, then open a **new** tab; never take
  over a tab the user has open.
- **Not connected** (the tools aren't there, or a call says the extension isn't connected or gets
  no answer): say so, tell the user to open Chrome with the Claude in Chrome extension connected
  and run the skill again, and **stop**. Don't retry more than once, and don't fall back to
  another browser: only the user's Chrome holds their sign-in, and a fresh automated browser on a
  live platform is exactly what its operator blocks.
- If Chrome asks the user to allow the site, tell them and wait. A site they decline is not
  audited.
- If browser calls fail twice in a row, or the page stops answering, stop and tell the user what
  was tried, with the resume point written. Don't keep retrying against a live platform.
