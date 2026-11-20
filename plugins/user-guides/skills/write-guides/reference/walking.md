# Walking the app

The guides are written from what each role actually sees on the **local** app, never from
memory or the code alone. `$S/walk-lib.mjs` does the walking; everything it records goes to the
project's git-ignored `.user-guides/walk/` (it adds `.user-guides/` to `.gitignore`).

## 1. Preflight

```bash
node $S/walk-lib.mjs preflight --set docs/user-guides/guides.json [--headless]
```

It checks that the base URL answers, finds Playwright (below) and signs every role in. Each
role's line says where `/` lands; a role that lands on a sign-in page did not sign in.

- **Exit 3, the app is unreachable.** Interactive: ask before running `app.start` (run it in
  the background and poll the base URL until it answers), or take the code path. Headless:
  never start it; take the code path.
- **`app.reset`** only with the user's yes (Round 2a): it wipes what the synthetic accounts have
  changed. Headless: never.
- **Sign-in values** are never printed. A `cookie-command` helper often refuses to run without a
  test-only flag in the environment; the user sets it, or tells you to.
- **`storage-state`:** the user signs each role in by hand once,
  `node $S/walk-lib.mjs sign-in --role <role>` (a headed browser; closing the window saves
  `.user-guides/auth/<role>.json`, mode 600). Never open or print that file. Headless: not
  possible, so the walk stops with the command to run.

**Playwright** is looked for in this order: the project's own dependency (from
`app.playwrightFrom`, e.g. `apps/web`), then `USER_GUIDES_PLAYWRIGHT_CORE`, then the user
cache `${XDG_CACHE_HOME:-~/.cache}/user-guides/pw-1.63.0`. With none, the walk fetches the
server-rendered pages instead, which is enough for most screens. To install it in the cache,
ask first; then `node $S/walk-lib.mjs install-playwright --yes`. Never add it to the project.
Headless: never install; print the command.

## 2. Crawl every role

```bash
node $S/walk-lib.mjs crawl --set docs/user-guides/guides.json [--roles a,b] [--from /,/home] [--fetch]
```

For each role it opens every screen reachable by links, and by forms with nothing to fill in,
with GET only (it never follows sign-out or delete links), and records each one:

- `dumps/<role>/<screen>.txt`: the screen's text as a person reads it; `.html` beside it;
- `outline.json` and `outline.md`: per role, every screen's path, title, headings, controls
  (role and name), named regions (each with its best locator and fingerprint), and aliases
  (`/` and `/home` when they are the same screen).

A browser walk and a fetch walk read the page through the same code, so they give the same
outline for the same markup, and two walks of the same data give identical outlines. Read
`outline.md` first, then the dumps of the screens you are writing about.

## 3. What a crawl can't reach

Dialogs opened by a click, the state after an action (a request sent, a setting saved), a
second step of a form: write a short walk script in `.user-guides/walk/` and run it with
`USER_GUIDES_SCRIPTS=$S node .user-guides/walk/<name>.mjs`. It is kept for refreshes, which run
it again from wherever the plugin is then installed, so it imports the scripts folder from that
variable, never from a written-out path:

```js
const { createWalk } = await import(`${process.env.USER_GUIDES_SCRIPTS}/walk-lib.mjs`);
const walk = await createWalk({ setFile: 'docs/user-guides/guides.json' });
const p = await walk.open('employee');
await walk.go(p, '/requests');
if (p.page) {                                   // a browser walk: click and type
  await p.page.getByRole('button', { name: 'Request leave' }).click();
}
await walk.dump(p, 'requests-dialog');           // records the screen as it is now
await walk.save();
await walk.close();
```

- `walk.api(p, method, path, body)` calls the app's own API with the role's session (to
  create the data a screen needs). Prefer the screens; use the API only to set the scene.
- Anything that changes data changes it for the synthetic account: say so in the report, and
  never run it against anything but the local app.
- Without a browser (`p.page` is undefined) a click can't happen: `go` to the URL the click
  leads to if there is one, otherwise record the claim in `notChecked[]`.
- A named dump (`walk.dump(p, 'requests-dialog')`) is its own outline entry beside the
  crawl's screen at the same path, so a dialog opened by a click never replaces the screen
  under it. Dumping the same name again replaces it.
- Keep the script: a refresh runs it again after the next release.

## 4. Locators and screens for pictures

Each shot's `target.locator` is the best locator the walk found for the region to crop:
take it from the region list in `outline.md` (`css=[data-region="…"]`,
`role=dialog[name="…"]`, `role=region[name="…"]`), or `null` for the whole screen. Each
shot's `state` starts with the screen's path, `On /requests?new=1: …`, then what must be
true first; a refresh finds the screen from that path.

## 5. No app: the code path

When the app can't run (unreachable and not started, no seed, no way to sign in), or the user
chose "From the code only":

- write from the code and the existing docs, in the UI strings' own words;
- record **every** claim you could not see on a screen in `notChecked[]`
  (`{ guide, claim, reason }`), with `set-edit.mjs` `push`; `check-guides --record` adds each
  unconfirmed bold label for you;
- never mention it in a guide: the guide reads the same; `notChecked[]` and the report say
  what is unchecked.

`check-guides` fails a set with no walk and an empty `notChecked[]`.

## 6. Coverage

Every screen in the outline must be in a guide for its role, or in `leftOut[]` with a reason
(`{ screen, role, reason }`, the screen by path or title), e.g. an error page or a screen
for developers. `check-guides` holds the set to it.
