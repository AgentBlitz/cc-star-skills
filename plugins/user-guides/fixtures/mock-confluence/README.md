# mock-confluence

A stand-in for the part of Confluence Data Center that the user-guides publisher talks to. It is
dependency-free, keeps everything in memory, and listens on port 0. The plugin's tests and the
wiki-guides evals publish to it, so nothing in them can reach a real wiki.

```bash
node server.mjs                                  # Data Center, one empty page to publish under
node server.mjs --context /confluence            # the same, under a context path
node server.mjs --seed adopted                   # the guides already there as hand-made pages
node server.mjs --mode cloud                     # looks like Confluence Cloud: the publisher must refuse
node server.mjs --mode unknown                   # cannot be identified: the publisher must refuse
```

It prints `mock-confluence (<mode>) listening on http://127.0.0.1:<port><context>`. Pass that
address to `publish-node.mjs --base`. `--width` sets the content column of the view page
(default 656 px). `--seed` also takes a JSON file: `{ "pages": [{ "id", "space", "title",
"parent", "body", "versions" }], "attachments": [{ "page", "name", "text", "comment" }] }`.

## The seeds

| Seed | Pages (space `DOCS`) |
|---|---|
| `empty` | `Team home` (1000) › `Product guides` (1001, the page to publish under) and `Meeting notes` (1002) |
| `adopted` | the same, plus the three Leave Planner guides as hand-made pages under 1001 (ids 1010–1012, at versions 2, 3 and 1), the top page at version 4, and a `settings.png` uploaded by hand |

A hand-made page has no version message, as on a real wiki (PLAN R21).

## What it answers

Under the context path:

| Request | Answer |
|---|---|
| `GET /rest/applinks/1.0/manifest` | the manifest (`typeId` `confluence`, a version); 404 in `unknown` mode |
| `GET /rest/api/content?spaceKey=&title=&expand=` | pages by space and title |
| `GET /rest/api/content/<id>?expand=version,space,ancestors,body.storage,body.view` | one page; 404 when it is in the trash |
| `POST /rest/api/content` | create a page, with `ancestors`. 400 for a title already used in the space, and for storage format that is not well-formed |
| `PUT /rest/api/content/<id>` | update: `version.number` must be the current version + 1, else 409 |
| `DELETE /rest/api/content/<id>` | 204: the page and its children go to the trash, and their titles are free again |
| `GET /rest/api/content/<id>/child/page` · `…/child/attachment` | children; attachments with `metadata.comment` |
| `POST /rest/api/content/<id>/child/attachment` | attach files (multipart). 403 without `X-Atlassian-Token: no-check`; 400 for a name already attached |
| `POST /rest/api/content/<id>/child/attachment/<attachment id>/data` | replace an attachment's data: its next version |
| `GET /download/attachments/<id>/<name>` | the file |
| `GET /pages/viewpage.action?pageId=<id>` | the page as a reader sees it: `#main-content` at the set width, `img.confluence-embedded-image`, and the `ajs-` meta tags (page id, page version, context path) |

In `cloud` mode the context path is `/wiki`, `/_edge/tenant_info` answers with a cloud id and the
view page carries a cloud id meta tag. The REST calls still work in `cloud` and `unknown` modes,
so a test that sees no write request has proved the publisher refused, not that the wiki did.

Data Center behaviour it copies: an anchor's id on the view page is the page title with its
spaces removed, a hyphen, then the anchor's name; an image whose attachment is missing shows as
an unresolved image that does not load; a list is cut off at 200 results a page.

## Control paths (outside the context path)

| Request | Does |
|---|---|
| `GET /__mock/state` | pages (title, parent, status, version, version message, body hash), attachments (comment, version, hash) and every write request so far |
| `POST /__mock/edit?pageId=<id>` | someone else edits the page: its next version, with no message. Body: `{ "body": "…" }` (optional) |
| `POST /__mock/page` | add a hand-made page: `{ "title", "parent", "body" }` |
| `POST /__mock/race?pageId=<id>` | someone else saves that page just before the next update of it lands, so the update gets a 409 |

As a module, `startMock({ mode, context, seed, width })` returns the same as functions:
`editPage`, `addPage`, `raceOnPut`, `snapshot`, `writes` and `close`.
