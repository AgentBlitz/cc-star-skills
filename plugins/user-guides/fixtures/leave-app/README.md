# Leave Planner (the user-guides test fixture)

A small, server-rendered leave-request app that the user-guides plugin's tests and evals write
guides for and photograph. Dependency-free Node >= 20; every person in it is invented.

**Never run anything on this folder in place.** Stage a copy first (`test/stage.mjs`): inside
cc-star-skills, git would resolve to this repo, and a skill would write its guides, work folder
and ignore line here.

```bash
node server.mjs [--variant v1|v2] [--port 0]    # prints "Leave Planner 1.0 (v1) listening on http://127.0.0.1:<port>"
EVAL_LEAVE_APP=1 node sign-in.mjs manager       # prints a leave_session cookie value
node reset.mjs                                  # back to the seed data
```

- It listens on **port 0** by default and prints its URL, so it never clashes with another stack.
- `GET /__health` answers `ok <variant> <release>`, for preflights.
- The variant comes from `--variant`, then `LEAVE_APP_VARIANT`, then `release.json`
  (`{"release": "1.0", "variant": "v1"}`). Staging a v2 copy rewrites `release.json` to
  `{"release": "1.1", "variant": "v2"}`, as a release would.
- Data lives in `data/` (git-ignored): `state.json`, re-read on every request so that a reset
  applies at once, and `.secret`, the per-copy key that signs sessions. `LEAVE_APP_DATA` moves it.
- `LEAVE_APP_TODAY` (default `2026-03-02`) fixes "today", so dates and balances are stable.

## Roles and accounts

| Role | Username | Person | Sees |
|---|---|---|---|
| employee | `rowan` | Rowan Pell, Platform | Home, Requests, People, Settings |
| manager | `tamsin` | Tamsin Hale, Platform | the same, plus Inbox (two requests waiting) |
| admin | `idris` | Idris Kettle, Operations | the same as employee, plus Admin |

Seven more invented people fill the People directory; they cannot sign in.

### Signing in

- **`cookie-command`:** `EVAL_LEAVE_APP=1 node sign-in.mjs <username | role>` prints the value of
  the `leave_session` cookie. Without `EVAL_LEAVE_APP=1` it refuses and exits 2, so it only ever
  runs in tests and evals (a `case.yaml` can set only `EVAL_*` variables). The guides.json setting:
  `"signIn": { "kind": "cookie-command", "command": "node sign-in.mjs {id}", "cookie": { "name": "leave_session" } }`
  with `"accounts": { "employee": { "id": "rowan" }, … }`.
- **`form`:** start the server with `EVAL_LEAVE_APP_PASSWORD` set; `/sign-in` then shows a
  Username / Password form, and any of the three usernames signs in with that password.
  Without the variable the form is not offered.

## Screens

| Path | Screen | What makes it a hard case |
|---|---|---|
| (every page) | sticky header: Leave Planner, the Main navigation (role-gated), the signed-in person and Sign out | `position: sticky`; it overlaps crops lower down the page |
| `/sign-in` | Sign in | the only page without the navigation |
| `/home` | Home: cards Your balance, Next time off, Who's out today; Waiting for you (manager); Leave policy (admin) | cards that differ by role; numbers and dates |
| `/requests` | My requests: the toolbar (`data-region="requests-toolbar"`, region "Requests toolbar") with a Show filter and the **Request leave** button; the table of requests | an empty state for the manager and admin ("You have no requests yet.") |
| `/requests?new=1` | the **Request leave** dialog: Type of leave, First day, Last day, Note for your manager, Cancel, Submit request | a `<dialog>`: server-rendered `open` for a fetch walk, made modal (with a backdrop) by its script in a browser |
| `/inbox` | Inbox (manager only): requests waiting, each with Approve and Decline | role-only; 403 for the others; empties as requests are decided |
| `/people` | People: a search box and a card per person | long enough to scroll below the fold |
| `/settings` | Settings: the Notifications panel (`data-region="settings-notifications"`) with three checkboxes, the Working week panel, Save settings | toggles; a panel-sized crop |
| `/admin` | Admin (admin only): Leave policy form, People and roles table | role-only; a table of selects |
| any other | 403 "You don't have access to this page", 404 "Page not found" | error screens |

## The v2 change table

v2 (release 1.1) changes exactly two screens. Refresh tests and evals take their "exactly"
counts from this table.

| Screen | Change in v2 | Region that changes | Shots it must retake |
|---|---|---|---|
| Requests (`/requests`) | the toolbar button **Request leave** is renamed **New request** (the dialog's own title stays "Request leave") | the Requests toolbar | every shot whose region contains the toolbar: the toolbar itself or the whole Requests screen |
| Settings (`/settings`) | the checkbox **Sync my leave to my calendar** is removed from the Notifications panel | the Notifications panel | every shot whose region contains the panel: the panel itself or the whole Settings screen |

Everything else, the dialog included, is identical in v1 and v2. With one shot per changed screen
(the plan's assumption), **exactly two** shots retake.

## Privacy fixtures

- `CLAUDE.md` forbids the folder `private/`.
- `private/` is git-ignored and absent from this folder. Staging creates it in the copy, with a
  freshly generated canary string, and commits; the canary never reaches git. An eval checks that
  the canary appears nowhere in a run.
