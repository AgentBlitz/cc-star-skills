---
name: platform-audit
description: "Audit a web platform from the user's side. Given a URL, walk the signed-in app in the user's own Chrome (Claude in Chrome), read-only and slowly, read its public JavaScript as text for what the screens can't show, and write a report that maps every screen, field, filter, action and feature, with a capability matrix, an optional requirements check and an appendix of UI labels. Use whenever someone wants a web app, back office, admin panel, partner portal or SaaS product audited, mapped or inventoried from a URL, even if they don't say 'audit': 'audit this platform', 'map every screen', 'what can this back office do', 'check it has the fields we need', due diligence on a vendor's or partner's platform, a feature inventory before a rebuild or a migration. Interviews first; resumable. Not for SEO, performance, accessibility, security or penetration audits, code review or an audit of a codebase, scraping or extracting a site's data, writing user guides (that is /user-guides:write-guides), or a product film."
argument-hint: "<url> [answers, e.g. checklist=none hidden=code interact=open-forms code=download pace=20] | resume | check [<report>]"
allowed-tools: [Read, Write, Edit, Glob, Grep, AskUserQuestion, ToolSearch, "Bash(node *)", "Bash(mkdir *)", "Bash(ls *)", "Bash(date *)", "mcp__claude-in-chrome__*"]
---

# platform-audit — map every screen, field and feature of a web platform

Take the user from a URL to a checked audit of a web platform as **their** account sees it: every
screen, filter, column, form and action, what the app's code holds beyond what this account can
open, a capability matrix, and an appendix of every UI label. The work happens in the user's own
signed-in Chrome, through Claude in Chrome, **read-only and slowly**. The platform is live, it may
move real money, and every click is made as the user, so nothing is ever saved, submitted or
hurried.

It writes two files in the repo it runs in, `docs/<slug>-audit/<SLUG>-PLATFORM-AUDIT.md` and
`appendix-ui-labels.md` beside it, and keeps its working files in `.platform-audit/<slug>/`, a
folder that ignores itself.

The scripts are in `${CLAUDE_SKILL_DIR}/scripts`: the `scripts/` folder **inside** the base
directory you were given when the skill loaded. Call that folder `$S` below. They are
dependency-free Node ≥ 20; run them from the **target repo's root**. The method is in
`reference/`, one file a step: read the step's file first and follow it, rather than working from
memory.

## Route by `$ARGUMENTS`

| Argument | Do |
|---|---|
| a URL, with or without answers (`id=value`) | The steps below. A work folder for this URL means a resume (step 0) |
| `resume` | Step 0, with the one work folder under `.platform-audit/` (several: ask which; headless: list them and stop) |
| `check [<report>]` | Only `reference/checking.md` › Check alone: run `$S/check-audit.mjs` and explain each finding. No browser |
| (none) | Ask for the URL (headless: print the usage line and stop) |

## Never

The reason for each is in `reference/ground-rules.md`. They hold whatever the answers are.

- Click, press or submit anything that saves, submits, confirms, deletes, transfers, pays, sends,
  approves, uploads, imports, logs out, switches language or settings, copies to the clipboard, or
  toggles a row switch. Never open a dialog that only confirms, and never trigger a browser alert,
  confirm or prompt.
- Type into anything but a search or filter box. Never type a credential: the user signs in.
- Follow a link to another host, or visit a hidden route beyond what the `hidden` answer allows.
- Download an export unless `interact=downloads`. Never upload a file.
- Batch navigation, or load server data faster than the `pace` answer allows.
- Run downloaded code, or work around a refused download (401, 403, 429, a bot challenge, a
  CAPTCHA).
- Put personal data or an account identifier in the report. Structure only, with placeholders.
- Return `location.search`, or a URL with its query string, from a page script.
- Guess an answer.
- Create a claude.ai artifact or a cloud doc, or commit, unless the user asks.

## The steps

**0. Resume.** If `.platform-audit/*/progress.md` exists for this URL (the same origin in its
Target table), read it, say in one line where you are picking up, and carry on from the first
unticked item of its Checklist (`reference/walking.md` › Resuming). Every answer recorded there is
settled and never asked again.

**Headless** (no AskUserQuestion, as in `claude -p`): if `checklist`, `hidden`, `interact`, `code`
or `pace` is not settled by the arguments or by `progress.md`, print the round as
`reference/interview.md` › Headless runs shows and **stop**, before any Chrome call, recon or
download. With every answer given but no Claude in Chrome, say so and stop. Write nothing in
either case.

**1. Preflight and recon** (`reference/ground-rules.md`, then `reference/walking.md` › Recon).
Read the ground rules before the first browser call; they apply to every step after it.
- Load the Claude in Chrome tools in **one** ToolSearch call, call `tabs_context_mcp`, and open
  the URL in a **new** tab. That one tab is the only one the audit uses. Not connected: say so,
  and stop. No other browser will do, because only the user's Chrome holds their sign-in.
- At a sign-in page, ask the user to sign in in that tab, and wait. Never type a credential.
- Paste `$S/probe.js` whole into `javascript_tool`, then run `recon()`, `nav()` and `peek()`.
- Make the work folder from `templates/progress.md`, and put the account's identifying strings
  in its `private-terms.txt` at once.
- Tell the user what recon found, in about ten lines: the product, the role, the menu, how many
  screens the code names and how many of them the menu hides.

**2. Interview** (`reference/interview.md`). Rounds 1 and 2, word for word, at most four
questions a round, the recommended option first, skipping what the arguments or `progress.md`
already settle. Record each answer word for word in `progress.md` › Answers as soon as it is
given.

**3. Code inventory** (`reference/code-inventory.md`), unless `code=skip`.
- `node $S/bundle.mjs fetch …` downloads the app's public scripts into the work folder's
  `bundle/`, then `node $S/inventory.mjs build …` reads them, as text, into `inventory.json`.
- A refused download is never worked around. Use the in-page fallback instead: paste
  `$S/inventory-core.js` into the page and read the copy the browser already has. `code=browser`
  takes that path from the start.
- Write every route and every report section into `progress.md` › Checklist. That list, not the
  menu, is what the walk works through.

**4. The walk** (`reference/walking.md`). One screen at a time, in this order: the global shell,
the menu from top to bottom, each screen's tabs and sub-views, detail pages, forms (the first
step only, then Cancel), and last the hidden routes, as far as the `hidden` answer allows.
- After every action that loads server data, wait as long as the `pace` answer says, then check
  `requests()` for a 429 before the next one.
- Read each screen with the probe's `screen()` and `overlays()`, and open controls only through
  its guarded `open()`. Reconcile the screen with its labels, columns and operations in the
  inventory.
- Write the screen's block into the report from `templates/screen.md` as soon as the screen is
  done, then tick it off and move the resume point.

**5. Write** (`reference/writing.md`, `templates/audit.md`). The access model, the navigation map
with a status for every route, the global interface, the screens not available to this role, the
capability matrix, limits, reference lists, the requirements check (when a list was given) and
both appendices (`node $S/appendix.mjs …` writes the label appendix). The executive summary comes
last, when everything it sums up exists.

**6. Check** (`reference/checking.md`). Run `node $S/check-audit.mjs` with the inventory, the
private terms and the appendix, and fix each finding until it is clean. Then remove the probe's
sessionStorage entry and close the tab.

**7. Report** to the user (`reference/checking.md` › The final message): a "Written for:" line;
what the platform is and the headline findings; what was and wasn't done on the platform; the
limits of the audit; the file paths. Nothing is committed unless the user asks.
