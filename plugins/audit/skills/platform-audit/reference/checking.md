# Checking, closing and the final message

Steps 6 and 7. The report is checked by a script and then by you, the browser is left as it was
found, and the user is told plainly what was done in their name.

## Check

From the target repo's root:

```sh
node $S/check-audit.mjs <folder>/<SLUG>-PLATFORM-AUDIT.md \
  --inventory .platform-audit/<slug>/inventory.json \
  --private .platform-audit/<slug>/private-terms.txt \
  --appendix <folder>/appendix-ui-labels.md
```

It exits 0 when clean and 1 with findings, each printed as `<check>: <line>: <what>`. Fix every
finding in the report, never by loosening the inputs, and run it again until it is clean. With
`code=skip` there is no inventory and no appendix: leave those two flags out, and the `routes`
check is skipped.

| Check | It found | Fix |
|---|---|---|
| `routes` | A route from the inventory that isn't in the report in backticks | Add its row to the "Every route" table with a status. If it was never looked at, look at what the code says it is; don't invent a status |
| `private` | One of the account's identifying strings, in the report or the appendix. It prints the term's first two letters and its length, not the term | Replace it with a placeholder (`<partner-id>`), and look for the same slip nearby. Never remove the term from `private-terms.txt` to pass |
| `markers` | `TODO`, `TBD`, `FIXME`, a `<!-- SECTION` comment, `{{` or "In progress" | Write the missing part, or delete the template comment whose section is done. If the platform's own label holds one of these words, reword the sentence around it |
| `tables` | A row with more or fewer cells than its header | Usually a pipe character inside a cell, which needs a backslash before it, or a missing `—` in an empty cell |
| `xref` | A `§N` or `§N.N` that matches no numbered heading | Point it at the right section. Common after §2 was removed and the rest renumbered |
| `screens` | A `###` block in the screen-by-screen map without a Route row, a State observed row, or any evidence tag | Complete the block's header table, and tag its parts |
| `keys` | The reading key, the route status key or the capability key is missing, or lacks a status | Restore it from `templates/audit.md`, word for word |
| `links` | A relative link that doesn't resolve | Fix the path; the appendix sits beside the report |
| `summary` | The executive summary lacks one of its six bold-labelled parts | Add it, in the template's order |

`--json` prints `{ clean, findings, skipped }` instead, for when the findings are many.

### Check alone

`/audit:platform-audit check [<report>]` runs only this, with no browser and no changes.

1. Find the report: the path given, or the one `*-PLATFORM-AUDIT.md` under `docs/*-audit/`.
   Several and none named: list them and ask which (headless: list them and stop).
2. Add `--appendix` when `appendix-ui-labels.md` sits beside it, and `--inventory` and
   `--private` when a work folder under `.platform-audit/` has them. Say which checks were
   skipped for want of a file.
3. Report **each finding by its check's name**, with the line and what the table above says to
   do about it. Change nothing unless the user asks.

### What the script can't check

Read the report once more for these before closing. They are the audit's promises, and no
pattern finds them:

- **Personal data that isn't in `private-terms.txt`**: a customer's name from a row, an amount, a
  date of a record, an id in an example address. Structure only.
- **Coverage:** every visible menu item, and every tab or sub-view, has its block; every line in
  `progress.md` › Checklist is ticked or has a reason beside it.
- **Tags that tell the truth:** nothing read from code is marked **[UI]**.
- **Reconciliation:** for each screen, the columns, filters and fields seen were compared with
  the code's, and the differences are in its code-only notes.
- **The limits are all named:** what was not opened, the hidden screens described from code, a
  refused download, unread chunks, any 429.
- **No address of the platform's hosts beyond what the reader needs**, no code excerpt, and no
  redacted or secret-looking string.

## Close

When the check is clean:

1. Remove what the audit left in the page, with one `javascript_tool` call:

   ```js
   (()=>{try{sessionStorage.removeItem('__auditProbe')}catch(e){}delete window.__auditProbe;delete window.__auditNet;delete window.__auditInv;return 'removed'})()
   ```

2. Close the audit's tab with `tabs_close_mcp`. Close only the tab the audit opened.
3. Tick the last lines of `progress.md` › Checklist, and set the Resume point to "Finished".

The work folder stays. It ignores itself, so it is never committed, and it holds the downloaded
bundle, the inventory and the private terms. Tell the user it can be deleted once they are happy
with the report, and that a later re-audit would start from it.

If the run stops early for any reason, still close the tab and remove the probe, and say where
the resume point is.

## The final message

One message, in this order, short enough to forward:

1. **`Written for:`** who it is pitched at (`writing.md` › The final message's "Written for:"
   line).
2. **What the platform is and the headline findings:** the number of screens mapped, how much
   came from the screens and how much from code, and why (an empty account, hidden screens).
3. **What this role can use**, the **strengths**, and the **gaps to raise with the provider**: a
   few lines each, from the executive summary.
4. **Hidden screens:** how many, what was tried under the `hidden` answer, and what the platform
   answered.
5. **What was done on the platform, and what wasn't.** State each plainly:
   - nothing was saved, submitted, sent or transferred;
   - what was opened (menus, filters, the first step of which forms) and closed again;
   - downloads: none, or exactly which exports were pressed, and that the files are in the user's
     Downloads folder, unopened;
   - the pace kept, and any 429 or pause, with what was done about it;
   - the public scripts downloaded to the work folder (or read in the browser, or not read), and
     any refusal;
   - that the audit's tab is closed.

   If anything went differently from the rules (a control pressed by mistake, a dialog that
   fired, a setting that may have changed), say so first and exactly. The user needs to know
   before anyone else notices.
6. **The limits of the audit**, and the one or two **next steps** that would close them.
7. **The files:** the report and the appendix, as paths in the repo, and the work folder.

Nothing is committed unless the user asks. If they do, commit only the two files in `<folder>`;
the work folder is ignored and stays out.
