# Style

Guides are for the people who use the product, not the people who build it. Write as a
colleague who knows the app well and is showing a new starter how to get their work done.

## Words

- **The screens' own words.** Every name of a screen, button, field, option, tab or message is
  written exactly as the walk saw it (`.user-guides/walk/dumps/`), with its capitals. Never
  invent a name, translate one, or use the code's name for it.
- **Bold is only for words on screen**: `**Request leave**`. A path through the interface is
  one bold run with arrows: `**Settings → Notifications**`. `check-guides` looks every bold
  label up in the walk dumps, so never bold for emphasis; use plain words or italics.
- **The product's words for its things** (recon's "Their words"): if the app says "request",
  never "ticket" or "application".
- **Plain and direct**, in the language and tone of Round 2: "you", the active voice, short
  sentences, one idea each. Say what to do, then what happens. UK or US spelling as chosen.
- **No internal references:** no decision, ticket or session ids, no file paths, code names,
  environment variables, routes as code, or the project's own patterns in
  `checks.patterns[]`. A URL path a person types or bookmarks may appear as plain text when it
  helps; most guides need none.
- **No people's real names or data.** Examples use the synthetic accounts' invented people and
  data, as the walk saw them.
- **No hedging about how it was written.** A guide never says "probably", "should" (for what
  the app does) or "not checked": what wasn't checked goes in `notChecked[]`.

## Shape

- H1 is the title; sections are H2, numbered in a role guide (`## 1. Ask for time off`); H3
  only inside a long section. Headings say what the person wants done.
- **Steps** are a numbered list when the order matters, bullets when it doesn't. One action a
  step; the result after it ("The dialog closes and the request shows as **Pending**.").
- Lead each section with one or two sentences of why or when, then the steps.
- **Notes** that matter are a blockquote, and a warning (data lost, can't be undone) a GitHub
  alert: `> [!WARNING]`. Use them sparingly.
- **Tables** for options or settings with a meaning each (setting, what it does, default).
- **Links** to other guides in the set, relative (`[Settings](employee.md#3-change-your-settings)`),
  with anchors as GitHub makes them. No links to repo files that aren't guides.
- Stay inside the converter's subset (wiki-guides publishes it): headings, paragraphs, bold,
  italic, code, links, nested lists, `---`, images alone on their line, GFM tables, fenced
  code, blockquotes and GitHub alerts. No raw HTML, footnotes or task lists.

## Pictures

One picture where it saves words: a screen the reader has not seen yet, a dialog with several
fields, a result to recognise. Not every step. While the shot is a placeholder, the picture is
an SVG card naming the caption, the role and the screen:

```bash
node $S/placeholder.mjs --dir docs/user-guides --id request-dialog --screen "Request leave" \
  --notice "the dialog, with the dates filled in" --role employee --guide docs/user-guides/employee.md
```

It prints the markdown line to put in the guide, **alone on its line**. Alt text is always
`Screen: what to notice`. Then register the shot with `set-edit.mjs` `addShot`:

```json
{ "op": "addShot", "shot": { "id": "request-dialog", "alt": "Request leave: the dialog, with the dates filled in",
  "as": "employee", "path": "docs/user-guides/images/request-dialog.svg",
  "target": { "what": "the Request leave dialog, whole", "locator": "role=dialog[name=\"Request leave\"]" },
  "state": "On /requests?new=1: the dates filled in", "guides": ["employee"] } }
```

One shot may be shown in several guides: list them all in `guides`, and use the same image.
With `pictures` "No pictures", write no placeholders and no shots.

## Done

A guide is `written` when every section is written from the walk, every picture is placed,
and no template comment is left. `check-guides` passing makes it `checked`.
