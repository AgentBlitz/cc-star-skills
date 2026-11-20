# Session: wiki-guides: converter, Confluence and HTML (user-guides S7)

**Date:** 2026-11-20
**Branch:** main
**Roadmap:** `.planning/user-guides`
**Runtime:** `opus/medium (autopilot attempt 1)`

## Summary

This session built wiki-guides' converters.

- **The parser.** `md.mjs` reads the Markdown subset in PLAN §2.5 into a small tree. Anything outside the subset is an error with `file:line`, or, with the user's go-ahead, escaped text. Both skills carry the file byte for byte (sync-tested), and write-guides' `check-guides` now holds every written guide to the subset (a new `subset` rule) and takes its GitHub slugs and anchors from it.
- **Storage format.** `to-confluence.mjs` turns a guide set into Confluence storage format plus a `pages.json` manifest. It writes:
  - the banner;
  - the top page (README intro or `topGuide`, then the guides, then "On this page");
  - anchor macros;
  - the code macro and the alert macros;
  - images at `min(cap, px / scale)`, attached to the top page;
  - links across folders.

  A placeholder card stops it unless `--allow-placeholders`.
- **HTML.** `to-html.mjs` writes self-contained XHTML-clean pages (data-URI images, inline CSS) and an index.
- **Batches.** `bundle.mjs` groups the images into upload batches under 9 MB.
- **The test page.** `templates/test-page.md` (with a sample PNG) holds every construct and is the golden source.

The gate passed:
- the goldens match, and every page is well-formed under the test checker and xmllint;
- Clarity's 6 guides convert with no unsupported-construct error (read-only, into the git-ignored `test/.out/clarity/`);
- `npm test` is 93/93, with the sync test covering `md.mjs`.

## Changes

- `plugins/user-guides/skills/wiki-guides/scripts/md.mjs` (new): the subset parser (`parse`, `parseInline`, `slug`, `anchors`, `headings`, `plainText`, `ALERTS`).
- `plugins/user-guides/skills/write-guides/scripts/md.mjs` (new): a byte-for-byte copy.
- `plugins/user-guides/skills/wiki-guides/scripts/to-confluence.mjs` (new):
  - it exports `prepare`, `resolveLink`, `guideTree`, `pageParts`, `pageXhtml`, `convert`, `imageSize`;
  - the CLI takes `--release`, `--set`, `--out`, `--top-title`, `--guides`, `--allow-placeholders`, `--escape-unsupported` and `--root`.
- `plugins/user-guides/skills/wiki-guides/scripts/to-html.mjs` (new): self-contained pages and `index.html`, reusing `prepare`.
- `plugins/user-guides/skills/wiki-guides/scripts/bundle.mjs` (new): `pages.json` → `batches.json`, under 9,000,000 bytes, sha-checked.
- `plugins/user-guides/skills/wiki-guides/templates/test-page.md` and `test-page.png` (new): every construct in the subset; a 480×240 sample picture.
- `plugins/user-guides/skills/wiki-guides/reference/confluence.md` and `reference/html.md` (new, R20).
- `plugins/user-guides/skills/write-guides/scripts/check-guides.mjs`:
  - the `subset` rule, which skips `outlined` guides;
  - `slug` and `anchors` re-exported from `md.mjs`.
- `plugins/user-guides/skills/write-guides/reference/style.md`: names what the subset leaves out, and the `subset` rule.
- `plugins/user-guides/test/convert.test.mjs` (new, 13 tests):
  - the subset, the inline rules, the error lines and lists;
  - the storage and HTML goldens, with well-formedness;
  - the placeholder stop, escape mode, `topGuide`, unique image names;
  - bundle, and the XML checker's own test.
- `plugins/user-guides/test/xml.mjs` (new): a dependency-free well-formedness check, plus `xmllint` when it is present.
- `plugins/user-guides/test/golden/src/` and `test/golden/expected/{confluence,html}/` (new): the synthetic set and its goldens.
- `plugins/user-guides/test/check-guides.test.mjs`: a `subset` rule test.
- `plugins/user-guides/test/sync.test.mjs`: `md.mjs` moved into `SHARED`.
- `plugins/user-guides/test/cli-symlink.test.mjs`: covers the three new CLIs.
- `.planning/user-guides/PLAN.md`: `test-page.png` added to §2.4, and a new R30 (the converters as built).
- `.planning/user-guides/TRACKER.md`: row 7 ✅ and the S7 session log.

## Decisions & Rationale

- **`--top-title` is an argument.** Storage format reaches the top page by title (image attachments, links to the README index). Only the publisher knows the real title, so S8 passes it; the README's `#` title is the default.
- **The README intro is its opening paragraphs only.** The README's own guide list is used for descriptions in the generated list rather than repeated. This avoids publishing the status block or a duplicate list.
- **The shared code lives in `to-confluence.mjs`'s exports**, so the layout gains no extra module; `to-html.mjs` imports `prepare` and the link resolver.
- **The alert mapping** follows the plan's three macros: NOTE and TIP → `info`, IMPORTANT and WARNING → `note`, CAUTION → `warning`, each titled with its kind.
- **Hard line breaks are outside the subset**, and bare `https://` addresses are links, as on GitHub. This keeps the rule that nothing is silently dropped.
- **The goldens are byte-exact files, regenerated by `UPDATE_GOLDENS=1`.** `pages.json` holds no time, so reruns are identical.

## Remaining Work

- Session 8: the mock Confluence and the publisher. It should pass `--top-title` from the wiki, and decide whether the base64 overhead needs a lower `bundle.mjs --limit`.
- The fixed English words (the banner, "On this page", the alert titles) could follow `product.language` after v1.
- The write-guides evals were not rerun. The frozen fixture guides pass the new `subset` rule; S9 runs the evals.

## Resumption Context

Key files to review when picking this up:
- `.planning/user-guides/PLAN.md` (R30, §5 Session 8)
- `plugins/user-guides/skills/wiki-guides/scripts/to-confluence.mjs`
- `plugins/user-guides/skills/wiki-guides/reference/confluence.md`
- `plugins/user-guides/test/convert.test.mjs`

Suggested opening prompt for next session:
> "/planning:session .planning/user-guides"
