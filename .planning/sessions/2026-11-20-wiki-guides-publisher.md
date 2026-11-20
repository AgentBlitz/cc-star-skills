# Session: wiki-guides: mock Confluence and the publisher (user-guides S8)

**Date:** 2026-11-20
**Branch:** main
**Roadmap:** `.planning/user-guides`
**Runtime:** `fable/high (autopilot attempt 1)`

## Summary

This session built the publisher for wiki-guides and a local mock of Confluence Data Center to prove it against. No real wiki and no Chrome were used.

- **The mock.** `fixtures/mock-confluence/server.mjs` is dependency-free and in memory, on port 0. It answers the REST subset the publisher uses (content by space and title, create with ancestors, update with a version check, the trash, attachments with the token check, the applinks manifest) and a reader's view of each page. It has `cloud` and `unknown` modes, an optional context path, two seeds (`empty`, and `adopted` with hand-made pages), and control paths that let a test play a colleague editing a page.
- **The publisher.** `publish-core.js` is one script that runs in the wiki page or in Node. It detects the flavour first and refuses Cloud and unidentified wikis. It plans before it writes. It writes nothing until the user has confirmed every page it did not make or that was edited since. It skips unchanged images and pages.
- **Its hosts and helpers.** `publish-node.mjs` runs the same text in Node and refuses any host but localhost. `publish-kit.mjs` records the page to publish under, makes the one input file (`publish.json`) and records a publish report in `guides.json`. `check-page.js` checks a published page.
- **The procedure.** `reference/chrome-publishing.md` gives the eight steps for Claude in Chrome, generalised from the worked example with no host, id or token.

The gate passed:
- all six scenarios (first publish, republish after v2, an edit made on the wiki since, adopted hand-made pages, Cloud refused, an unknown wiki refused);
- the in-page path in headless Chromium against the mock, end to end, including a reload and a second injection;
- `check-page` catches a 900 px image in a 656 px column and passes at 640 px;
- `npm test` 107/107, the genericity test included; `claude plugin validate` passes.

## Changes

- `plugins/user-guides/fixtures/mock-confluence/server.mjs` (new): the mock. CLI (`--mode`, `--context`, `--seed`, `--width`, `--port`) and `startMock()` for tests (`editPage`, `addPage`, `raceOnPut`, `snapshot`, `writes`, `close`). Exports `storageProblem`, `SEEDS`, `TOP_ID`.
- `plugins/user-guides/fixtures/mock-confluence/README.md` (new): the seeds, every path it answers, the control paths, and the Data Center behaviour it copies.
- `plugins/user-guides/skills/wiki-guides/scripts/publish-core.js` (new): installs `userGuides` with `input`, `load`, `detect`, `plan`, `attach`, `publish`, `test`, `removeTest` and `configure` (for the Node host).
- `plugins/user-guides/skills/wiki-guides/scripts/publish-node.mjs` (new): `detect | plan | test | remove-test | publish --base <local address>`, with `--confirm-adopted` and `--confirm-edited <page id>=<version>`. Exports `isLocal` and `loadCore`.
- `plugins/user-guides/skills/wiki-guides/scripts/publish-kit.mjs` (new): `target`, `input`, `record`. Exports `makeInput`, `record`, `target`, `testPage`, `pageHash`.
- `plugins/user-guides/skills/wiki-guides/scripts/check-page.js` (new): installs `userGuidesCheck({ version })`.
- `plugins/user-guides/skills/wiki-guides/reference/chrome-publishing.md` (new, R20).
- `plugins/user-guides/skills/wiki-guides/reference/confluence.md`: `bundle.mjs --only`, and a section on the publisher's input.
- `plugins/user-guides/skills/wiki-guides/scripts/bundle.mjs`: `--only a.png,b.png`.
- `plugins/user-guides/skills/wiki-guides/scripts/to-confluence.mjs`: `pageXhtml` takes `{ ownImages }`, for the test page.
- `plugins/user-guides/test/publish.test.mjs` (new, 14 tests): the mock, the six scenarios, a title used elsewhere, three other stops, the test page, the localhost refusal, publish-kit and `bundle --only`, and the in-page run with check-page.
- `plugins/user-guides/test/cli-symlink.test.mjs`: covers the two new CLIs.
- `.planning/user-guides/PLAN.md`: §2.4 (`publish-kit.mjs`, the mock's seeds and control paths) and a new R31 (the publisher as built).
- `.planning/user-guides/TRACKER.md`: row 8 ✅ and the S8 session log.
- `.planning/user-guides/prompts/session-9.md`: its reading now lists R28–R31 and the mock's README.

## Decisions & Rationale

- **The contract is unchanged.** The top page's last-published version has no field in `guides.json` unless a `topGuide` is set. Adding one would be a contract change, which the plan reserves for a decision. Instead a page also counts as untouched when its latest version carries the publisher's own message (`user-guides <release> sha256:<hash>`): any wiki edit makes a newer version without it. This also survives a publish whose report was never recorded. PLAN R31 names `topVersion` as the alternative if a real wiki shows the message to be unreliable.
- **`attach` refuses until everything is confirmed**, like `publish` → the first draft attached new images to the top page before the user had said yes. Now nothing at all is written first, and a test holds it.
- **A create sends no `version`** → it is the request the worked example proved; whether Data Center keeps a message sent on create is not known. `record` writes `last-publish.json` so an unchanged new page is still skipped; without the file it is sent once more.
- **Node computes every hash** → a wiki on plain http gives the page no hashing. In the page, an image is checked by size, and by hash where available.
- **`publish-kit.mjs` joins the layout** → the input and the record need guides.json and the file system, and must never talk to a wiki; `publish-node.mjs` is "localhost only", so they did not belong there.
- **A title found under its expected parent is adopted, not a stop** → that is how a publish that was never recorded recovers. Found anywhere else, it stops.
- **In `cloud` and `unknown` modes the mock's REST calls still work** → "no write request" then proves the publisher refused.
- **The 9 MB limit stays**, with `--limit 6000000` documented as the fallback → the worked example's batches were too small to show whether Chrome counts raw or base64 size.

## Remaining Work

- **Session 9** (opus / high): wiki-guides' `SKILL.md` and `recording.md`, the evals through the Node host and the mock, trigger tuning, the Playwright-MCP rehearsal of `chrome-publishing.md`, and plugin 0.9.0.
- **For Session 9's rehearsal:** `publish-core.js` is about 25 KB as tool text and is passed again after every reload. Confirm that this size goes through; if not, the fallback is to upload the script through the file input and evaluate it from there (not built).
- **For Session 10 (the first real wiki):** three things only a real Data Center can show: whether the version message survives as the publisher reads it, whether a 9 MB batch is accepted, and whether the flavour signals hold behind the user's sign-on.
- Not run this session: the write-guides evals (no write-guides file changed).

## Resumption Context

Key files to review when picking this up:
- `.planning/user-guides/PLAN.md` (R31, and §5 Session 9)
- `plugins/user-guides/skills/wiki-guides/reference/chrome-publishing.md`
- `plugins/user-guides/skills/wiki-guides/scripts/publish-core.js`, `publish-kit.mjs`, `publish-node.mjs`, `check-page.js`
- `plugins/user-guides/fixtures/mock-confluence/README.md`
- `plugins/user-guides/test/publish.test.mjs`

Suggested opening prompt for next session:
> "Run `/planning:session .planning/user-guides` for Session 9 (wiki-guides: the skill, evals, tuning). Set `/model opus` and `/effort high` first."
