# The guide set: `guides.json`

One file in the guides folder (default `docs/user-guides/guides.json`) describes the whole set: the
product, how to reach and sign in to the local app, the interview answers, every guide and every
picture, and where the guides are published. Both skills read it; each writes only its own parts.
It holds **no secrets**: no password, token or cookie value ever goes in it.

`scripts/guide-set.mjs` is the only code that should load, change or save it:

```bash
node <skill dir>/scripts/guide-set.mjs validate docs/user-guides/guides.json
node <skill dir>/scripts/guide-set.mjs summary  docs/user-guides/guides.json
node <skill dir>/scripts/guide-set.mjs index    docs/user-guides/guides.json docs/user-guides/README.md
```

Run them from the repo root. As a module it exports `createGuideSet`, `loadGuideSet`,
`saveGuideSet`, `validateGuideSet`, `addGuide`, `moveGuide`, `markGuideEdited`, `addShot`,
`moveShot`, `markRetakeIfChanged`, `statusBlock`, `updateIndex`, `summary` and `checkLocator`.
`saveGuideSet` refuses an invalid set and writes the keys in the order below. Unknown keys are
errors, so a typo never passes silently.

Both skills carry identical copies of this file and of `guide-set.mjs`; a plugin test keeps them
byte-identical.

## Paths

Every `file` and `path` is **repo-relative**: forward slashes, no leading `/`, no `..`. They may sit
outside the guides folder (an adopted set can keep its files where they are).

## Keys

| Key | Holds | Owner |
|---|---|---|
| `schemaVersion` | `1` | shared |
| `product` | `name`, `language` (a tag such as `en-GB`) | write-guides |
| `app` | how to reach and sign in to the **local** app (below) | shared |
| `interview` | `wordingVersion` (the version of `interview.md`'s wording) and `answers` (question id → the answer word for word: a string, or a list for a multi-select) | write-guides |
| `notChecked[]` | `{ guide, claim, reason }`: each claim the walk could not confirm. A code-only run always leaves it non-empty; an unconfirmed bold label lands here | write-guides |
| `leftOut[]` | `{ screen, role, reason }`: each walked screen deliberately left out | write-guides |
| `checks.patterns[]` | the project's own internal-reference patterns (JavaScript regular expressions, matched case-insensitively), read by `check-guides` | write-guides |
| `guides[]` | one entry per guide (below) | write-guides; wiki-guides adds entries when they are absent (adopting) |
| `shots[]` | one entry per picture (below) | the spec: write-guides; `status`, `takenAt`, `release`, `fingerprint`: wiki-guides, with the transitions below |
| `publish` | `release`, `confluence`, `html` (below); `{}` until something is published | wiki-guides; adopting may seed `confluence` when it is absent |

### `app`

| Key | Holds |
|---|---|
| `baseUrl` | `http://localhost:<port>` or `http://127.0.0.1:<port>`. Anything else only when the user confirms it (`validate` warns) |
| `start` | optional command that starts the app. The skill asks before running it; a headless run never runs it |
| `reset` | optional command that resets the seed data. The skill asks first and warns that it wipes the synthetic accounts' data; a headless run never runs it |
| `playwrightFrom` | optional package folder to load Playwright from, e.g. `apps/web` in a workspace (`.` for the root) |
| `signIn` | `{ kind, …settings }`, one of the five kinds below |
| `accounts` | role → account. Role names are lowercase (`employee`, `manager`). An account has optional `id`, `label`, `usernameEnv`, `passwordEnv` |

The sign-in kinds and their settings:

| `signIn.kind` | Settings | Each account needs | How a role signs in |
|---|---|---|---|
| `cookie-command` | `command` (may use `{id}` and `{role}`), `cookie: { name, path? }` | `id` | run the command; it prints the session cookie's value, which is set on the base URL's host and **never logged or stored** |
| `storage-state` | `loginUrl` (optional: a path such as `/login`, or a URL) | nothing | the user signs in by hand in a headed browser; the state is saved to `.user-guides/auth/<role>.json`, mode 600, git-ignored |
| `form` | `loginUrl`, `fields: { username, password, submit }` (locators) | `usernameEnv`, `passwordEnv` | fill the form from the environment variables the account names; the values are never logged or stored |
| `module` | `module`: a repo-relative `.mjs` that exports `signIn({ role, account, baseUrl, context })` | whatever the module reads | the project's own code signs the role in |
| `none` | nothing | nothing | no sign-in |

### `guides[]`

| Key | Holds |
|---|---|
| `id` | kebab-case, unique |
| `type` | `role-guide`, `features-and-value`, `getting-started` or `admin-operations` |
| `file` | the guide's repo-relative `.md` path, unique |
| `title` | the guide's title (its H1) |
| `audience` | the roles it is for, a list (empty means everyone) |
| `parent` | the id of the guide it sits under on the wiki, or `""` for directly under the top page |
| `order` | integer: its place among its siblings |
| `status` | `outlined`, `written` or `checked` |

### `shots[]`

| Key | Holds |
|---|---|
| `id` | kebab-case, unique; the image file is `images/<id>.svg` or `images/<id>.png` |
| `alt` | alt text in the form `Screen: what to notice` |
| `as` | the role whose account takes it |
| `path` | the image's repo-relative path: the `.svg` card while it is a placeholder |
| `target` | `{ what, locator }`: `what` says in words what to crop; `locator` is the best locator found, or `null` |
| `state` | what must be true first (`""` when nothing) |
| `guides` | the ids of the guides that show it (at least one) |
| `status` | `placeholder`, `taken`, `retake`, `blocked` or `needs-text` |
| `takenAt`, `release`, `fingerprint` | once taken: an ISO date-time, the release it shows, and `sha256:<64 hex>`, the hash of the region's headings and control names with numbers and dates normalised. An adopted image is `taken` with none of them, so the first refresh retakes it |
| `note` | optional: why it is `blocked` or `needs-text` |

**Locator syntax.** A Playwright selector string. Each part of a `>>` chain is `engine=body` with
one of the engines `role`, `css`, `text`, `id`, `data-testid`, `xpath`, `label`, `placeholder`,
`alt`, `title`, or a bare CSS selector. Prefer roles and accessible names:

```
role=button[name="Save"]
role=dialog[name="Request leave"]
role=region[name="Notifications"] >> role=checkbox[name="Email me"]
css=[data-region="requests-toolbar"]
```

### `publish`

| Key | Holds |
|---|---|
| `release` | the release named in the page banner |
| `html.outDir` | the repo-relative folder for the self-contained HTML files |
| `confluence.baseUrl` | the wiki's base URL |
| `confluence.space` | the space key |
| `confluence.topPageId` | the page the user named to publish under (digits, as a string); it becomes the top page |
| `confluence.topGuide` | optional: the guide whose text opens the top page (else the README index's intro) |
| `confluence.pages` | guide id → `{ pageId, version }`: `version` is the version last published, or `null` for a page adopted by id |
| `confluence.imageCap` | the widest an image is shown, in pixels (default 640) |
| `confluence.deviceScale` | the screenshots' device scale (default 2): an image shows at `min(imageCap, px / deviceScale)` |

## Status transitions

Guides go `outlined → written → checked`, all moved by write-guides. Any text edit to a `checked`
guide makes it `written` again: a refresh, a `needs-text` fix, or wiki-guides' fix of a wrong label
(`markGuideEdited`). Adopting (either skill) registers a guide as `written`. wiki-guides publishes
`written` and `checked` guides, and names the unchecked ones in its report.

| Guide status from | To | Who |
|---|---|---|
| (new) | `outlined` | write-guides |
| (an adopted guide) | `written` | adopt (either skill) |
| `outlined` | `written` | write-guides |
| `written` | `checked` | write-guides |
| `checked` | `written` | write-guides, or wiki-guides (label fix) |

| Shot status from | To | Who |
|---|---|---|
| (new) | `placeholder` | write-guides |
| (an adopted image) | `taken`, with no fingerprint | adopt (either skill) |
| `placeholder` | `taken`, `blocked` or `needs-text` | wiki-guides |
| `taken` | `retake`, when the fingerprint changed or none was recorded | write-guides' refresh |
| `retake` | `taken`, `blocked` or `needs-text` | wiki-guides |
| `needs-text` | `placeholder` (no PNG yet) or `retake`, once the text is fixed | write-guides |
| `blocked` | `taken`, on a later attempt | wiki-guides |

`moveShot(set, id, 'taken', { by: 'wiki-guides', path, takenAt, release, fingerprint })` needs all
four; going back to `placeholder` needs the `.svg` card's path and clears them.

## The README index

The guides folder's `README.md` carries a status block between
`<!-- user-guides:status:begin -->` and `<!-- user-guides:status:end -->`. `guide-set.mjs index`
regenerates it (one row per guide, its status and how many of its pictures are taken); everything
outside the markers is left alone.

## The work folder

`.user-guides/` at the project root is git-ignored (the skill adds the line). It holds `auth/`
(`storage-state` sign-ins), `walk/` (walk outlines and dumps) and `out/` (converted pages, upload
batches, half-size review copies). It lives in the project so that a later session can resume
from it.
