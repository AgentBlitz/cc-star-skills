# Publishing through the user's signed-in Chrome

A real wiki is reached only through the user's own browser, with the Claude in Chrome tools. The
page's sign-in does the work: `publish-core.js` runs **in the wiki page** and calls the wiki's
REST API from there. `$W` below is this skill's `scripts/` folder. Run the commands from the
project root.

**Rules that hold at every step**

- Never ask for, create, read or store a token, a password or a cookie. If the wiki answers
  "not signed in", ask the user to sign in in that tab, then carry on.
- **Confluence Data Center only.** The publisher detects the flavour first and refuses
  Confluence Cloud and any wiki it cannot identify. Do not work around a refusal: offer HTML
  files instead (`html.md`).
- Nothing is written to a real page without the user's go-ahead **in this session**: once for
  the test page, once for the real pages, once before the test page is removed.
- Reports hold ids and counts, never addresses: Chrome blocks tool output that carries a query
  string. Do not print `location.href` or a link from the page.
- A wiki edit is never overwritten silently. When the plan says a page was edited, ask.
- **Keep each `javascript_tool` answer short.** Its answer is cut off after about a thousand
  characters. Return counts and actions, not whole objects; keep a long value in a page
  variable (`window.ugReport = …`) and read it back in slices (`window.ugReport.slice(0, 600)`).

| File | What it is |
|---|---|
| `$W/publish-core.js` | the publisher: uploaded into the page and run there (section 1) |
| `$W/check-page.js` | the page check: uploaded and run the same way on a published page |
| `.user-guides/out/confluence/publish.json` | the one file the publisher reads (`publish-kit.mjs input`) |
| `.user-guides/out/confluence/test-page.png` | the test page's picture |
| `.user-guides/out/confluence/batches.json` | the images in upload batches (`bundle.mjs`) |
| `.user-guides/out/confluence/report.json` | the publish report, saved by you for `publish-kit.mjs record` |
| `.user-guides/out/confluence/last-publish.json` | what was sent last time (written by `record`) |

## 1. Open the page and identify the wiki

1. Open the page the user named in a tab (`navigate`). It becomes the top page.
2. **Load the publisher by upload**, not by pasting its 25 KB into a tool call. Run this with
   `javascript_tool`. It adds the upload input the publisher uses, at the top of the page, so
   that `find` lists it first (on a page just loaded, usually as `ref_1`):

   ```js
   (() => { let i = document.getElementById('user-guides-upload'); if (!i) { i = document.createElement('input'); i.type = 'file'; i.multiple = true; i.id = 'user-guides-upload'; i.setAttribute('aria-label', 'user-guides upload'); document.body.prepend(i); } return 'ready'; })()
   ```

   `find` "user-guides upload file input" gives its `ref`. Then `file_upload` the **absolute**
   path of `$W/publish-core.js` to it, together with whatever this step needs next
   (`publish.json`, `test-page.png`, an image batch: one upload can carry them all, under
   10 MB), and run the script from the upload:

   ```js
   (0, eval)(await [...document.getElementById('user-guides-upload').files].find((f) => f.name === 'publish-core.js').text())
   ```

   It answers `user-guides publisher 1 ready`. If the page refuses `eval` (a Content Security
   Policy without `unsafe-eval`), pass the file's whole text as the `text` of `javascript_tool`
   instead. (A browser tool that takes a function rather than a script returns nothing unless
   you wrap the text and `return` that line yourself.)
3. Run `await userGuides.detect()`.

   | `flavour` | Do |
   |---|---|
   | `data-center` | carry on. Note `page.id`, `page.title`, `page.space` and `contextPath` |
   | `cloud` | stop. Tell the user that this plugin publishes to Confluence Data Center only, and offer HTML files |
   | `unknown` | stop. Tell the user the wiki could not be identified, and offer HTML files |

   Every other call refuses in the same way, so a skipped `detect()` cannot publish to Cloud.
   On Data Center the console shows a 404 for the Cloud check (`/_edge/tenant_info`): normal.

## 2. Make the input

With the page's id and title from `detect()`:

```bash
node $W/publish-kit.mjs target --top-page <page id> --base-url <the wiki's address, with its context path>
node $W/to-confluence.mjs --release <release> --top-title "<the page's title on the wiki>"
node $W/bundle.mjs
node $W/publish-kit.mjs input
```

- `target` records the page in `guides.json` (`publish.confluence`). `--top-guide <guide id>`
  makes that guide's text open the top page. Images have no fixed width, so the wiki fits them
  to the column; `--image-cap <px>` fixes their width instead, and `--image-cap fit` undoes it.
- `--top-title` must be the title **as the wiki has it**: guide pages find their images and
  the top page by that title. The publisher stops if the two differ.
- `input` writes `publish.json`: each page's storage format and hash, the versions last
  published, the images, and the test page.

## 3. The upload input

Chrome's `file_upload` fills a file input: the one section 1 added. (`userGuides.input()` adds
the same input when it is missing, and keeps it when it is there.)

1. The input is `<input type="file" multiple id="user-guides-upload">` (labelled
   `user-guides upload`; the page's accessibility tree may show it as a button of that name).
   Find its `ref` with `find` or `read_page`.
2. `file_upload` with that `ref` and **absolute** paths: the paths in `publish.json` and
   `batches.json` are relative to the project root, so put the root in front. Each call
   **replaces** the input's files. If the tool refuses a path as outside the folders it may
   read, copy the files into a folder it allows and upload them from there.
3. `await userGuides.load()` reads `publish.json` from the input into the page's memory, where
   it stays until the page reloads. Uploading other files later (an image batch) does not
   unload it: there is no need to send `publish.json` again with each batch.

**A reload or a navigation removes the script, the input and the loaded input.** After either
one, do section 1's step 2 again, uploading `publish-core.js` with `publish.json` (and the next
files), then `load()`. The four steps fit in one `browser_batch`: the snippet, `find`,
`file_upload`, then `eval` and the calls that follow.

## 4. The test page first

Before a first publish (and whenever the user wants to see it):

1. Upload `publish.json` **and** `test-page.png` together in section 3 when the test page comes
   next (one upload, then `await userGuides.load()`).
2. With the user's go-ahead, `await userGuides.test()`. It writes one child page under the top
   page, titled `<top page's title>: publishing test`, with every construct the guides may use
   and its picture attached to itself. The top page is not written.
3. Open the test page by its id (`<base>/pages/viewpage.action?pageId=<id>`), check it (step 7,
   with `version` set to the `test.version` that `test()` returned), take a screenshot and show
   the user.
4. When the user has seen it, ask before removing it. Back on the top page, do section 3 again
   (script, `input()`, upload `publish.json`, `load()`), then
   `await userGuides.removeTest('<its page id>')` moves it to the space's trash.

## 5. Plan, and ask

`await userGuides.plan()` reads the wiki and writes nothing.

| In the plan | Means | Do |
|---|---|---|
| `pages[].action` `create` / `update` / `skip` | a new page / the publisher's own page, unchanged since / nothing to send | nothing to ask |
| `needs.adopted` (page ids, `top`) and `needs.foreignImages` | pages and images this publisher did not make: the page the user named on a first publish, hand-made pages given by id, a picture uploaded by hand under the same name | ask **once** for the whole batch. Say that each page's current text is replaced (its history keeps the old text). Then pass `confirm.adopted: true` |
| `needs.edited` (`page id: version`) | someone edited that page on the wiki since the last publish | name the page and ask: bring the edit into the markdown first (recommended), or overwrite it. To overwrite, pass that id and version in `confirm.edited` |
| `stops[]` with `title-taken` | another page in the space already has that title | stop and ask: rename the guide, or adopt that page by its id |
| `stops[]` with `gone` | a recorded page is no longer there | stop and ask: restore it from the trash, or remove its entry from `publish.confluence.pages` to make a new page |
| `images.attach` / `replace` | the images to upload | these are all you need to upload |

A first publish always lists `top` under `needs.adopted`: the go-ahead for the real pages is
that confirmation.

## 6. Attach, publish, record

```js
const yes = { confirm: { adopted: true, edited: { "<page id>": 7 } } };   // only what the user confirmed
await userGuides.attach(yes);    // once per upload batch
await userGuides.publish(yes);
```

1. **Images, a batch at a time.** For each batch in `batches.json`: `file_upload` its paths
   (made absolute),
   then `await userGuides.attach(…)`. It attaches each image to the top page with its
   `sha256:` in the attachment comment, skips one the wiki already holds, and lists under
   `waiting` the ones still to come. On a republish, `node $W/bundle.mjs --only a.png,b.png`
   batches just the images the plan listed. If `file_upload` refuses a batch for its size, make
   smaller ones: `node $W/bundle.mjs --limit 6000000`.
2. **Pages.** `await userGuides.publish(…)` reads every version again, then writes the top page
   and each guide page: a new page under its parent, an update at the next version. It refuses
   while an image is missing or a confirmation is not given, and then writes nothing at all.
3. **If it stops part-way** (`ok: false` with `failed`), the wiki refused one page, usually
   because someone saved it at that moment. The pages before it were published. Record the
   report as below, plan again, and ask about that page.
4. **Record.** Keep the report in the page, without its hashes, and read it back (in slices
   when it is long):

   ```js
   window.ugReport = JSON.stringify(await userGuides.publish(yes), (k, v) => (k === 'hash' ? undefined : v));
   window.ugReport.length
   ```

   Save that text unchanged to `.user-guides/out/confluence/report.json`, then run `record`
   (before making the input again). It takes each page's hash from `publish.json`, which is
   what the publisher sent, and refuses a report whose hash for a page differs from it: a
   report copied with a mistake records nothing.

   ```bash
   node $W/publish-kit.mjs record --report .user-guides/out/confluence/report.json
   ```

   It writes each page's id and version into `guides.json` (`publish.confluence.pages`), the
   space and the release. Tell the user `guides.json` changed and belongs in git.

## 7. Check every page

For the top page and each guide page in the report:

1. Open it by id (`<base>/pages/viewpage.action?pageId=<id>`), or reload it if it is open.
2. Load `$W/check-page.js` as section 1 loads the publisher (the snippet, `find`,
   `file_upload`, then `(0, eval)(…)` with `check-page.js`), then run
   `await userGuidesCheck({ version: <the version in the report> })`. One `browser_batch` per
   page does it: `navigate`, the snippet, `find`, `file_upload`, the check.

| Answer | Do |
|---|---|
| `stale: true` | the tab still shows the old version: reload, pass the script again, check again. Never judge a stale page |
| `tooWide` not empty | an image with a fixed width runs past the content column (`column`, in px). Remove the cap (`publish-kit.mjs target --image-cap fit`, the default) or lower it below the column, convert, make the input and publish again: only the pages change |
| `notLoaded` not empty | an image did not load: is it attached to the top page under that name? |
| `brokenAnchors`, `unresolvedPageLinks` | a link has no target: fix the guide, convert and publish again |
| `ok: true` | go on to the next page. At the end, take a screenshot of the top page and of one guide page, and show the user |

**Then the final check.** Run `node $W/publish-kit.mjs input` again (it now carries the versions
just recorded), reload the top page, do section 3 again and `await userGuides.plan()`: every
page `skip` and no image to attach shows that the wiki holds exactly what was sent.

**The page tree** lists a page's children alphabetically unless someone orders them by hand
(Space tools › Reorder pages); the top page's list of guides keeps the guides' own order. The
publisher never moves a page.

## 8. Publishing again

After a release, or after any change to a guide: convert, `bundle.mjs`, `publish-kit.mjs input`,
then steps 1 and 3 to 7 (the test page only if the user wants it). The publisher sends only
what changed:

- an image whose `sha256:` the wiki already holds is skipped;
- a page whose title and storage format are what was last sent is skipped. Each update records
  `user-guides <release> sha256:<hash>` as its version message, and that is how the next
  publish knows. A new release alone changes no page: only the pages whose text changed are
  sent, each with the new release in its message;
- a page made by the last publish and not yet updated has no message of its own. The publisher
  knows it from `last-publish.json`. Without that file (a fresh clone), such a page is sent once
  more, which is harmless.

A page counts as untouched when its current version is the one recorded in `guides.json`, or
when its latest version carries the publisher's own message. Anything else is `edited` or
`adopted`, and needs the user's yes.

## Rehearsing without a wiki (the Node host)

`publish-node.mjs` runs the same `publish-core.js` in Node against a wiki **on this machine**,
such as the bundled mock (`fixtures/mock-confluence`), and refuses any other address. It is for
tests and rehearsals only: it never publishes to a real wiki. The go-aheads are the same as in
Chrome. `--base` is the wiki's address with its context path, taken from the page's address
(`http://127.0.0.1:<port>/pages/viewpage.action?pageId=<id>` → base `http://127.0.0.1:<port>`,
page `<id>`).

```bash
node <plugin>/fixtures/mock-confluence/server.mjs                    # prints its address
node $W/publish-node.mjs detect --base <base>                        # Data Center, or stop
node $W/publish-kit.mjs target --top-page <id> --base-url <base>
node $W/to-confluence.mjs --release <release> --top-title "<title>"
node $W/bundle.mjs && node $W/publish-kit.mjs input
node $W/publish-node.mjs plan        --base <base>                   # writes nothing
node $W/publish-node.mjs test        --base <base>                   # go-ahead 1: the test page
node $W/publish-node.mjs remove-test --base <base> --page-id <id>    # go-ahead 3, once it is seen
node $W/publish-node.mjs publish     --base <base> --confirm-adopted # go-ahead 2: the real pages
node $W/publish-kit.mjs record --report .user-guides/out/confluence/report.json
node $W/publish-kit.mjs input && node $W/publish-node.mjs plan --base <base>   # the check
```

- `plan` answers as in section 5. A `top-title` stop gives the page's title on the wiki:
  convert again with `--top-title` set to it, and make the input again.
- `--confirm-adopted` and `--confirm-edited <page id>=<version>` stand for the user's answers:
  pass them only when the user gave them. `publish` attaches the images, writes the pages and
  saves `report.json` beside the input.
- The check: after `record`, make the input again (it carries the versions just recorded),
  then `plan`. Every page `skip` and no image to attach shows that the wiki holds exactly what
  was sent. Planned from the old input, the new pages read as `adopted`: that is not a problem.
