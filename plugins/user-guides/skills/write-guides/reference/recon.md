# Recon

Before the interview, three Explore agents read the repo, **together in one message**. They
read; they never run the app, install anything or write.

## What they may read

Give every agent these rules with its brief:

- **Only git-tracked files.** Start from `git ls-files <folder>`, never a recursive search of the
  repo root. Name the folders each search covers (`rg … apps/web/src docs`).
- **Never a folder the project forbids.** Read the root `CLAUDE.md` (and any `CLAUDE.md` in the
  folders you search) first; if it forbids a folder or file, do not open, list or search it,
  even if it is tracked. Git-ignored files are out of bounds too: they are often where private
  data lives.
- **No secrets.** Do not open `.env*` files, key files or anything named like a credential;
  name the variables the code reads instead.
- Report **at most 500 words in the report shape**, nothing else: no code dumps, no file
  contents beyond a quoted line where it matters.

Pick the folders from `git ls-files | cut -d/ -f1 | sort -u` (the top-level folders) and the
package manifests; tell each agent which ones to search.

## A: Screens and routes

> Map this web app's screens for user guides. From git-tracked files in \<folders\> only (never a
> folder its CLAUDE.md forbids), find the routes (the router's files, links in the navigation),
> what each screen is for, which roles can reach it, and what state lives in the URL (query
> parameters, ids). Note dialogs, panels and tabs that open without a new URL, and empty and
> error states. Don't run the app.

```
## Routes
- /path: what it is for · roles that reach it · URL state · reached from …
## Navigation
One line on how screens connect (header, sidebar, tabs), and how it differs by role.
## Without a URL
Dialogs, drawers, tabs, steps: where each opens and from which control.
## States worth showing
Empty states, errors, limits (one line each, with the screen).
```

## B: Roles, permissions and data

> Find who uses this web app and what each kind of user can do. From git-tracked files in
> \<folders\> only (never a folder its CLAUDE.md forbids), find the roles (or groups,
> permissions), what each may see and change, the product's own words for its main things
> (quote them), and its language (UI strings, `lang`, locale files). Then find the data: how it
> is seeded for local use, which synthetic accounts exist for each role, and anything on screen
> that would be real people's data. Don't run the app.

```
## Product
Name · one sentence on what it is for · language (e.g. en-GB) and where that comes from.
## Roles
- role: what they do · screens only they reach · what they may change
## Their words
Terms the app uses for its main things (quoted).
## Seed data
Seed command · synthetic accounts per role (usernames only) · anything that looks like real data (where).
```

## C: Running, sign-in, seed and existing docs

> Find how to run this web app locally for a scripted walk, and what documentation it already
> has. From git-tracked files in \<folders\> only (never a folder its CLAUDE.md forbids), give
> the start command (package scripts, compose files, docs), the local URL and port, a health
> URL, and the reset or seed command (say whether it wipes data). Find how a test or a script
> signs a role in: a helper that prints a session cookie, a login form, a test-only module, or
> no sign-in; name the environment variables it reads, never their values. Note where
> Playwright is a dependency (which package folder). Then list existing user-facing docs:
> guides, help pages, a docs folder, a wiki export. Don't run the app.

```
## Run
Start: `…` · URL: http://localhost:… · Health: /… · Reset/seed: `…` (wipes: yes/no)
## Sign-in
Kind: cookie-command | storage-state | form | module | none · how (command, form path, module) · variables
## Playwright
Package folder with playwright / @playwright/test / playwright-core, or none
## Existing docs
- folder or file: what it covers, who for, how current (a line each)
```

## After recon

Tell the user, in **at most 15 lines**: what the app is for (one line), its roles, the screens
per role (counts and the main ones), how it runs and signs in, the existing docs, and anything
that will push the walk to the code path (no seed, no local sign-in). Then:

- Draft Round 1's and Round 2's options from the reports (`interview.md`).
- Prepare `app` for `guides.json`: `baseUrl`, `start`, `reset`, `playwrightFrom`, `signIn`
  and `accounts` per role (`guide-set.md` › `app`). Ask Round 2a for whatever is still open.
- Note existing guides: if the user wants them kept rather than rewritten, that is adopt
  (`refresh.md` › Adopt).
