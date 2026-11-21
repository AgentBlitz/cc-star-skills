# Refresh and adopt

## Refresh (after a release)

`/user-guides:write-guides refresh`. The guides exist and `guides.json` records them; the app
has changed. Walk again, bring the text up to date, and mark for retaking every picture whose
region changed.

1. **Preflight and walk again**, exactly as the first time (`walking.md`): a kept
   `.user-guides/walk/scene.mjs` first (it sets up the data), then `walk-lib.mjs crawl`, then
   every other walk script kept in `.user-guides/walk/`
   (`USER_GUIDES_SCRIPTS=$S node .user-guides/walk/<name>.mjs`). The crawl keeps
   the walk before as `outline.previous.json`.
2. **What changed:** `node $S/walk-lib.mjs diff` lists, per role, the screens added, removed
   and changed (controls and headings that came and went, and the regions that changed). With no
   previous outline (the first refresh after adopting), treat every screen as changed.
3. **Pictures:** `node $S/walk-lib.mjs refresh --write` compares each `taken` shot's region
   fingerprint (D3: its headings and control names, numbers and dates normalised) with the new
   walk, and moves it to `retake` when it changed, when none was recorded (adopted images), or
   when its region is no longer found. It lists every shot with why. Placeholders stay
   placeholders.
4. **Text:** for every changed screen, update each guide that covers it, in the new screens'
   words: renamed labels, removed controls (and the steps that used them), new controls worth a
   step. Added screens get a section, or go in `leftOut[]`; removed ones leave the guides. Then
   `set-edit.mjs` `edited` for each guide you changed (a `checked` guide goes back to
   `written`). If a shot's alt text or caption names what changed, change it with
   `set-edit.mjs` `updateShot` (and, for a placeholder, write its card again with
   `placeholder.mjs`), and the image line in each guide that shows it.
   A kept walk script that no longer runs (a renamed button) is fixed and run again.
5. **`needs-text` shots** (handed back by wiki-guides because the screen no longer matches the
   text): fix the text, then move each one on: to `placeholder` if it never had a picture (write
   a new card with `placeholder.mjs` and pass its `path`), else to `retake`.
6. **Claims:** drop each `notChecked[]` entry the new walk confirms (`set-edit.mjs` `drop`); add
   any the walk could not reach.
7. **Check** (`check-guides.mjs`, then `--mark-checked`) and regenerate the index.
8. **Report:** the screens that changed, per role; the guides edited and how; the shots now
   `retake` (their ids, and the count against the screens that changed); what was added to
   `leftOut[]` or `notChecked[]`. Next: `/user-guides:wiki-guides` retakes the pictures and
   republishes.

A refresh never rewrites a guide's sections that the walk shows unchanged.

## Adopt (guides written without this skill)

`/user-guides:write-guides adopt`. The guides exist, but there is no `guides.json`: they were
written by hand, perhaps split across folders, perhaps already on a wiki. Adopt registers them
as they are, then refreshes them.

1. **Recon**, as usual, with brief C's "Existing docs" doing most of the work.
2. **One round** (`interview.md` › Adopt): which files, each one's kind and roles, the images
   folder, and any wiki pages they are already on.
3. **Register them** with `set-edit.mjs`, starting with `init` (product and `app` from recon)
   when there is no `guides.json` yet. Put `guides.json` and the `README.md` index in the
   folder the user names (default: beside the first guide); the guides **stay where they are**
   (`file` may sit outside the guides folder).
   - Each guide: `addGuide` with `"adopt": true`. It is registered as `written`, under its own
     H1 as `title`.
   - Each image it shows: `addShot` with `"adopt": true`, registered as `taken` with no
     fingerprint, so the first refresh retakes it. `id` from the image's file name, `path` as it
     is, `as` the guide's role, `guides` every guide that shows it, `target.what` from its alt
     text and section, `locator` null, `state` "". The shot's `alt` must read
     `Screen: what to notice`; propose one from the image's alt and section. The guide's own
     alt text is left alone until the refresh.
   - Wiki pages it was told of: `set` `publish.confluence` (only when it is absent) with
     `pages: { <guide id>: { "pageId": "<digits>", "version": null } }`, plus `baseUrl` and
     `space` if given. wiki-guides owns the rest.
   - No shot is invented for a picture the guides don't have.
4. **Never rewrite a guide you have only adopted.** Its text changes only after a walk shows
   what is on the screens.
5. **Then refresh** (above): walk, `walk-lib.mjs refresh --write` (every adopted shot becomes
   `retake`), and bring each guide's text, labels and alt text up to the walk. `check-guides`
   holds the adopted guides to the same rules as written ones; fix what it finds, as part of
   the refresh.
6. **Report** as a refresh does, plus what was registered: guides, shots, pages.
