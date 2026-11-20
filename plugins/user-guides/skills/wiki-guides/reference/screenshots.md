# Taking the screenshots

Every picture in the guides is taken by a script **the project keeps**, so it can be taken again
at every release. `$W` below is this skill's `scripts/` folder. Run everything from the
project root.

| File | What it is | In git? |
|---|---|---|
| `scripts/user-guides/shots.mjs` | the project's own script: one block per shot | yes |
| `scripts/user-guides/guides-kit.mjs` | the helpers, copied from the plugin with a stamp; never edit | yes |
| `.user-guides/out/shots/<id>.png` | each shot at full size (1280 CSS px wide, scale 2) | no |
| `.user-guides/out/review/<id>.png` | a half-size copy of each, to look at | no |
| `.user-guides/out/shots.json` | the manifest: per shot, its file, size, takenAt and fingerprint, or why it failed | no |
| `<guides>/images/<id>.png` | the picture in the guides, written by `swap-shots.mjs` | yes |

## 1. Make the script

```bash
node $W/shots-kit.mjs install --set docs/user-guides/guides.json
```

- It copies `templates/guides-kit.mjs` to `scripts/user-guides/` with a stamp line (the plugin
  version and the template's hash).
- It writes `scripts/user-guides/shots.mjs` from `templates/shots.template.mjs`, with one block
  per shot of `guides.json`: a page per role, then `open` the path the shot's `state` starts
  with, then `shot`. A project that already has a `shots.mjs` keeps it: it is theirs.
- **Read the blocks against each shot's `state`.** A state that needs more than a path (a
  dialog opened by a click, a filter chosen) needs a `step()` before its `shot()`. A state with
  no path gets a `TODO` and opens `/`: fix it.
- Tell the user the two files belong in git, beside the guides.

### The script's API (from `guides-kit.mjs`)

```js
const k = await startShots({ root, setFile, argv });
const manager = await k.as('manager');                 // signed in, the set's sign-in kind
const visitor = await k.as('employee', { signedOut: true }); // the screens before sign-in
await k.open(manager, '/inbox');                       // go, then wait until it settles
await k.step('open the first request', async () => {   // set-up; a failure is reported
  await manager.getByRole('link', { name: /Annual leave/ }).first().click();
  await k.settle(manager);
});
await k.shot('inbox', manager);                        // crop to the shot's target.locator
await k.shot('inbox-card', manager.locator('article').first(), { pad: 4, maxHeight: 600 });
process.exit(await k.done());
```

- **`as(role)`** uses the five sign-in kinds of `app.signIn` (D9), the same code as the walk.
  `{ signedOut: true }` is for a shot whose `state` says `signed out`; `shot()` refuses a
  signed-out page for any other shot, and a page of the wrong role.
- **`shot(id, target, { pad, maxHeight, clip })`**: `target` is the page (cropped to the shot's
  `target.locator`, or the whole screen when it is null), a Playwright locator, or a locator
  string in R8's syntax (`role=dialog[name="Request leave"]`). `pad` defaults to 12 px around a
  crop and `maxHeight` to 1600 px; `clip` (page coordinates) suits a whole-screen shot.
- **The fingerprint** always comes from the shot's own `target.locator`, read from the page's
  DOM with the same reader and function as the walk (`kit-core.mjs` › `regionFingerprint`).
  So a walk and a shot of the same screen agree, and refresh can compare them. A crop you pass
  in changes the picture, never the fingerprint. A region the page lacks fails the shot.
- **Before each shot** it waits until the page settles (load, network idle, fonts, two frames),
  moves the mouse away, then makes sticky elements static so they don't cover a crop. Whole
  screens end where the content ends. Viewport 1280×800, scale 2, light palette, reduced motion,
  animations off, no caret.

## 2. Preflight

```bash
node scripts/user-guides/shots.mjs --check
```

It checks that Playwright is found and Chromium starts, the base URL answers, and every role
signs in (its `/` must not land where a signed-out page lands). Fix a `FAIL` before taking
anything:

- **Playwright** is found as the walk finds it (D10): the project's own (`app.playwrightFrom`),
  then `USER_GUIDES_PLAYWRIGHT_CORE`, then the user-level cache. Never add it to the project
  without asking. Fill the cache only after the user says yes, and never in a headless run:
  print the install command instead.
- **The base URL** is the local app. Start it only as the walk does: with the user's yes, never
  headless.
- **Sign-in values** are never printed or stored by the script. A `storage-state` role needs
  its saved sign-in first (write-guides' `walk-lib.mjs sign-in --role <role>`, by hand).

## 3. Take the shots

```bash
node scripts/user-guides/shots.mjs              # every shot
node scripts/user-guides/shots.mjs settings     # retake by name (the set-up still runs)
node scripts/user-guides/shots.mjs --pending    # placeholder, retake and blocked shots only
```

A shot that fails is reported and the rest carry on; the exit code is 1 when anything failed,
including a shot of `guides.json` that the script has no block for.

**Then look at every image** in `.user-guides/out/review/`, with Read, one by one. For each:

- **Right:** nothing to do.
- **Wrong crop, wrong state, data that should not be there** (a test account's residue, a
  half-loaded panel): fix `shots.mjs` and retake by name.
- **A label on screen differs from the guide's word for it** (one word or button name): correct
  the guide's label. That is the only text wiki-guides changes (D5); a `checked` guide becomes
  `written` again (R7).
- **Anything bigger** (a step that no longer exists, a screen that works differently): the shot
  is `needs-text`, handed back to write-guides (`--needs-text` below).

## 4. Swap them into the guides

```bash
node $W/swap-shots.mjs --release 1.4 [--only a,b] [--needs-text <id>=<what is wrong>] [--dry-run]
```

For each shot still to take (`placeholder`, `retake` or `blocked`) that the last run took:

- it writes `images/<id>.png` beside the card;
- it rewrites every guide's link from the `.svg` to the `.png` and deletes the card;
- it sets the shot `taken`, with takenAt (when the script took it), the release and the
  fingerprint;
- it regenerates the README index's status block.

The other outcomes:

- A shot the run failed to take becomes `blocked`, with the reason in its `note`. It keeps its
  card (or, after a retake, its old picture) until a later run takes it.
- A `retake` must be taken again after refresh marked it: an image from before is skipped.
- A `taken` shot is never touched. If the run saw its region change, swap-shots says so: run
  write-guides' refresh, which marks it `retake` and fixes the text first.

The release defaults to `publish.release`. Swapping a link does not change a guide's status: it
is the picture the guide planned.

## 5. After a release

1. write-guides' refresh walks again, updates the text and marks `retake` each shot whose
   fingerprint changed.
2. `node $W/shots-kit.mjs check`: a stale kit (the plugin's is newer) is replaced with
   `install`, and an edited one is flagged; move its changes into `shots.mjs`. It also lists
   the shots `shots.mjs` lacks; `shots-kit.mjs blocks` prints their blocks to paste in.
3. `shots.mjs --pending`, look at every image, `swap-shots.mjs --release <new>`.

Only the shots whose regions changed are retaken. The other pictures, and their entries, stay
exactly as they were.
