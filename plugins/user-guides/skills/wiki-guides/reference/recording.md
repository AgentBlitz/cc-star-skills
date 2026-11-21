# Recording where the pages are, and adopting guides

`$W` below is this skill's `scripts/` folder. Run everything from the project root.

## 1. Record a publish

**Confluence.** The publisher's report is the record. In Chrome, save the report `publish()`
returned, exactly as returned, to `.user-guides/out/confluence/report.json`; `publish-node.mjs
publish` (the mock) saves it there itself. Then:

```bash
node $W/publish-kit.mjs record --report .user-guides/out/confluence/report.json
```

It writes each page's id and version into `publish.confluence.pages`, the space and the
release, and `.user-guides/out/confluence/last-publish.json` (what was sent, for the next
publish). It takes a partial report too: a publish that stopped part-way records the pages it
did. Record the test page nowhere: it is removed.

**HTML files.** Record the folder and the release:

```bash
node $W/set-edit.mjs docs/user-guides/guides.json <<'EOF'
[ { "op": "set", "path": "publish.html.outDir", "value": ".user-guides/out/html" },
  { "op": "set", "path": "publish.release", "value": "1.4" } ]
EOF
```

## 2. The README's published section

The guides' `README.md` (the index) ends with a section saying where the guides are and how
they are made, so the next person can publish again without this conversation. Write it after
the list of guides (only the README's opening paragraphs are published, so this section stays in
the repo), and replace it on every publish:

```markdown
## Where these guides are published

- **Confluence:** under the page "Product guides" (page 123456, space DOCS), release 1.4.
- **HTML files:** `.user-guides/out/html/index.html`, release 1.4.

These pages are made from the files in this folder by `/user-guides:wiki-guides`. After a
release, run `/user-guides:write-guides refresh`, then `/user-guides:wiki-guides release=<new>`:
only the pictures and pages that changed are sent. An edit made on the wiki is overwritten by
the next publish, so change the markdown instead.
```

Keep only the lines for the destinations used. Name the page by its title, id and space as the
wiki gives them; the wiki's address is already in `publish.confluence.baseUrl`. Never add a
link to a guide file here, so the index's list stays the one list of guides.

## 3. Report to the user

- **Pages:** created, updated and unchanged, from the report's `counts`; the top page's title.
- **Images:** attached, replaced and unchanged.
- **Guides not `checked`** (published as `written`): name them, and suggest
  `/user-guides:write-guides check`.
- **Shots handed back:** each `needs-text` shot with its note (for write-guides), each
  `blocked` shot with its reason.
- **Files that belong in git:** `guides.json`, the README, the guides whose labels were fixed,
  `images/*.png` (and the cards swap-shots deleted), and `scripts/user-guides/shots.mjs` and
  `guides-kit.mjs`. Not `.user-guides/`: it is the git-ignored work folder.

Nothing is committed unless the user asks.

## 4. Adopt (guides with no `guides.json`)

`/user-guides:wiki-guides adopt`, or any run that finds guides but no `guides.json`: they were
written by hand, perhaps already on a wiki. Adopting registers them as they are, so they can be
published; it never rewrites one.

1. **Find the candidates:** markdown files under the docs folders the user names (else `docs/`)
   that open with a `#` title. Read each one's title and its images.
2. **One round** (AskUserQuestion; headless: print it as Round 1 is printed, and stop):

   | Id | Ask | Options |
   |---|---|---|
   | `adoptFiles` | Which files are the guides? (multi) | All \<n\> found (Recommended) · \<file 1\> · \<file 2\> · Name them |
   | `adoptTitles` | What are their page titles? | Each file's own `#` title (Recommended) · Name them, e.g. `employee.md=For employees` |
   | `adoptTree` | How are the pages arranged? | All straight under the page they go under (Recommended) · Nest them, e.g. `manager.md=employee.md` |

   Round 1's own questions (destination, guides, page, release) come in the same round when
   they fit, else straight after.
3. **Register them** with `set-edit.mjs`, in one list of operations. `guides.json` and the
   README index go in the folder of the first file (say so); the guides stay where they are.
   With no README there yet, write one first: a `#` title and a short intro (it opens the top
   page), then let `--index` add the status block.

   ```bash
   node $W/set-edit.mjs docs/help/guides.json --index docs/help/README.md <<'EOF'
   [ { "op": "init", "product": { "name": "Leave Planner", "language": "en-GB" } },
     { "op": "addGuide", "adopt": true, "guide": { "id": "employee", "type": "role-guide",
       "file": "docs/help/employee.md", "title": "Leave Planner for employees",
       "audience": [], "parent": "", "order": 1 } },
     { "op": "addShot", "adopt": true, "shot": { "id": "my-requests",
       "alt": "My requests: the Request leave button above your requests", "as": "employee",
       "path": "docs/help/img/my-requests.png", "state": "", "guides": ["employee"],
       "target": { "what": "My requests: the Request leave button above your requests", "locator": null } } } ]
   EOF
   ```

   - **Each guide:** `addGuide` with `"adopt": true`, registered as `written`. `id` from the
     file name; `title` as answered; `parent` the parent's id, or `""`; `order` as listed;
     `type` the closest kind (`role-guide`, `getting-started`, `features-and-value`,
     `admin-operations`), and say which you chose.
   - **Each image a guide shows:** `addShot` with `"adopt": true`, registered as `taken` with
     no fingerprint, so write-guides' first refresh retakes it. `id` from the image's file name,
     `path` as it is, `guides` every guide that shows it, `as` the role the guide is for (else
     `user`), `state` `""`, `locator` null. `alt` must read `Screen: what to notice`: take the
     image's own alt text when it does, else propose one from its alt and section.
   - **No shot is invented** for a picture the guides don't have, and no image is moved.
4. **Never rewrite an adopted guide.** Its text and its images stay exactly as they are; a
   refresh by write-guides walks the app first.
5. **Carry on with the steps.** Every shot is `taken`, so there is nothing to photograph; convert
   and publish. Hand-made pages already on the wiki under the page they go under, with the same
   titles, are found by the publisher: the plan lists them under `needs.adopted`, and one
   confirmation for the whole batch updates them in place (their history keeps the old text).
6. **Report** what was registered (guides, shots, the folder of `guides.json`), then the
   publish as in section 3.
