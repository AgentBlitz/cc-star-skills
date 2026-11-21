---
name: wiki-guides
description: Illustrate and publish a web app's end-user guides. Takes the screenshots with a script the project keeps (the local app, as each role), swaps them in for the picture placeholders, and publishes the guides to Confluence Data Center through the user's signed-in Chrome, or as self-contained HTML files; after a release it retakes and republishes only what changed. Reads the guides.json that /user-guides:write-guides leaves, or adopts guides written by hand. Use when asked to screenshot, illustrate, publish, republish or export a product's user guides or help pages to a wiki, Confluence or HTML. Not for writing the guides' text (that is write-guides), READMEs, API references, release notes, a product film, or publishing a single doc or page.
argument-hint: "[adopt | shots | answers, e.g. destination=confluence guides=all under=<page address> release=1.4]"
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion]
---

# wiki-guides — pictures, then pages

Take a set of guides from placeholder cards to published pages: real screenshots in place of
every card, then Confluence pages under the page the user names, or HTML files, or both.

The scripts are in the `scripts/` folder **inside** the base directory you were given when the
skill loaded (else `${CLAUDE_PLUGIN_ROOT}/skills/wiki-guides`): `W=<base directory>/scripts`.
Call that folder `$W` below. They are dependency-free Node ≥ 20; run them from the **target
repo's root**. Each step has its reference file: read it first and follow it, rather than
working from memory.

## Route by `$ARGUMENTS`

| Argument | Do |
|---|---|
| (none), or answers | The steps below; a set already published is a republish (its answers are recorded) |
| `adopt` | Guides with no `guides.json`: the adopt round (step 2), then the steps |
| `shots` | Steps 0, 3 and 4 only: take the pictures and swap them in; publish nothing |

**Answers** (`key=value`, as the user typed them): `destination=confluence|html|both`,
`guides=all|<id>,<id>`, `under=<the page's address>` (Confluence), `release=<name>`,
`go-ahead=yes`; for adopt, `adoptFiles=<a.md>,<b.md>`, `adoptTitles=as-written|<file>=<title>,…`,
`adoptTree=flat|<child file>=<parent file>,…`. An answer recorded in `guides.json` is settled.

## Never

- Ask for, accept, read or store a token, a password, an API key or a cookie value, and never
  call a wiki's REST API from a shell (curl, a script). A real wiki is reached **only** through
  the user's signed-in Chrome (`reference/chrome-publishing.md`). Without the Claude in Chrome
  tools (a `claude -p` run, Chrome not connected): stop with **No Chrome** below.
- Publish to Confluence Cloud, or to a wiki that cannot be identified: offer HTML files instead.
- Write to any wiki, the local mock included, without the user's go-ahead **in this session**:
  once for the test page, once for the real pages, once before removing the test page.
  `go-ahead=yes` gives all three in advance, and counts only when the user typed it: never
  add it yourself. It **covers** the plan's `needs.adopted` and `needs.foreignImages` (the page
  named on a first publish, hand-made pages, a picture uploaded by hand): pass
  `--confirm-adopted` / `confirm.adopted: true` and say in the report what was replaced. It
  never covers a page edited on the wiki since the last publish (`needs.edited`), or a stop.
- Guess an answer. Headless with a question unsettled: print it as shown below and stop.
- Change a guide's text beyond a wrong label seen on screen (D5). A step that no longer exists or
  a screen that works differently is `needs-text`, handed back to `/user-guides:write-guides`.
- Edit `guides.json` by hand: change it with the scripts, or `$W/set-edit.mjs` (it validates
  every change). Start or reset the app, or install Playwright, without asking; a headless run
  never does any of the three. Commit anything unless the user asks.

## Round 1: ask first

One AskUserQuestion round, the recommended option first, skipping what arguments or
`guides.json` settle (a set already published records its destination, its page and its guides).

| Id | Ask | Options |
|---|---|---|
| `destination` | Where should the guides go? | Confluence pages (Recommended) · HTML files · Both |
| `guides` | Which guides? | All \<n\> guides (Recommended) · Name them |
| `under` | Which wiki page should they go under? Its text is replaced by the guides' intro and list (Confluence only) | \<the page recorded\> · Paste its address |
| `release` | Which release do the guides show? It goes in every page's banner | \<the release found: a release or version file, the latest tag\> (Recommended) · Name it |

**Headless** (no AskUserQuestion, as in `claude -p`): print every unsettled question in this
form, list the settled ones with their answers, and **stop** before taking or writing anything:

```
/user-guides:wiki-guides needs your answers before it can go on. Round 1 of 1: where and what
1. Where should the guides go?  a) Confluence pages (Recommended)  b) HTML files  c) Both
2. Which guides?  a) All 3 guides (Recommended)  b) Name them, e.g. employee,manager
3. Which wiki page should they go under? (its address)
4. Which release do the guides show?  a) 1.4 (Recommended)  b) Name it
Answer with arguments, e.g. /user-guides:wiki-guides destination=confluence guides=all under=<address> release=1.4
```

## The steps

**0. Resume.** Find `guides.json` (default `docs/user-guides/guides.json`; else search the docs
folders) and read it with `node $W/guide-set.mjs summary <file>`. None: the adopt path. Its
`publish` says where the set went last: a `confluence` with a `topPageId` (and `baseUrl`) or an
`html` settles the destination, the page and the guides, so a republish asks only for the
release. Say in one line where you are picking up: shots still to take, published or not.

**1. Ask** (Round 1 above).

**2. The guides.** Publish the `written` and `checked` guides chosen; skip an `outlined` one,
and name every guide that is not `checked` in the report. **Adopt** (no `guides.json`): one
round, `reference/recording.md` › Adopt: which files, their titles, the page tree. Existing
images are registered `taken`; no shot is invented.

**3. Shots** (`reference/screenshots.md`), for shots at `placeholder`, `retake` or `blocked`:
`shots-kit.mjs install`, read the blocks against each `state`, `shots.mjs --check`, take them.
Then **Read every image** in `.user-guides/out/review/`, one Read each, before the swap, and
compare it with what its guide says around it (the step, the alt text, any table of the
screen's controls). Go through every control the text names for that screen, one by one:
- **A label that differs** (a button renamed): fix the guide's word wherever that guide uses it
  for this control, then `set-edit.mjs` `edited` for that guide.
- **A control the text names that the picture lacks** (a checkbox, a step, a panel gone), or a
  screen that works differently: that is bigger than a label. Leave the text alone and pass
  `--needs-text <id>=<what is wrong>` to the swap; the card stays until write-guides fixes it.

**4. Swap** them in: `node $W/swap-shots.mjs --release <release>`.

**5. Convert**: `reference/confluence.md` (Confluence) and `reference/html.md` (HTML). A
placeholder still in place stops it: publish the cards as they are only if the user chooses to.

**6. Publish** (Confluence). Where the wiki is decides how:
- **A wiki on this machine** (`localhost`, `127.0.0.1`: the bundled mock, a rehearsal):
  `publish-node.mjs`, the same publisher in Node (`chrome-publishing.md` › Rehearsing).
  `plan` first (it writes nothing), then the test page, the real pages and its removal, each
  with its go-ahead. A `top-title` stop names the page's title on the wiki: convert again with it.
- **Any other wiki:** `reference/chrome-publishing.md`, step by step, with the Claude in Chrome
  tools. Detect the flavour first.
- **No go-ahead yet, headless:** after `plan`, stop with **No go-ahead** below. Nothing written.
- **Cloud or unknown** (`detect`, or any call that refuses): stop with **Not Data Center** below.

**7. Check** every page: in Chrome, `check-page.js` (`chrome-publishing.md` › 7). On the mock, after
step 8's `record`: `publish-kit.mjs input`, then `publish-node.mjs plan`: every page `skip`.

**8. Record** (`reference/recording.md`): `publish-kit.mjs record`, the README's published
section, and the report: pages and images sent, guides not `checked`, shots handed back
(`needs-text`, `blocked`), and the files that belong in git.

## The stops, word for word

Fill in the angle brackets; mention no credential of any kind (none is ever needed).

- **No Chrome:** "Publishing to \<host\> goes through your own signed-in Chrome (Claude in
  Chrome), which this session doesn't have, so nothing was sent. Run /user-guides:wiki-guides
  in an interactive session with Chrome connected, or choose HTML files: destination=html."
- **Not Data Center:** "\<host\> is Confluence Cloud (or: could not be identified as
  Confluence Data Center), and user-guides publishes to Confluence Data Center only, so nothing
  was sent. HTML files work anywhere: /user-guides:wiki-guides destination=html."
- **No go-ahead:** "Ready to publish under \<top page title\>: \<n\> pages to create, \<n\> to
  update, \<n\> images to attach\<; and these need your yes: …\>. Nothing has been written.
  First comes a test page (\<title\>: publishing test), then the real pages, then the test
  page's removal; each needs your go-ahead. Give it with /user-guides:wiki-guides \<the same
  answers\> go-ahead=yes, or run it interactively."
