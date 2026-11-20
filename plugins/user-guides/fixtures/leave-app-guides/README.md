# The frozen guide set for the Leave Planner fixture

The best fixture run of Session 3 (PLAN R15), kept so that later sessions (wiki-guides: shots,
converter, publisher, evals) stage a known set instead of writing guides first. Everyone in it is
invented (the fixture's seed data).

It is what `/user-guides:write-guides` wrote, headless, for a staged copy of `fixtures/leave-app`
(v1) from the answers in `evals/lib/scaffold.mjs` (preset `walk`: readers employee and manager,
role guides and getting started, every task, placeholders, a walk of the local app, Round 3
recorded as "approve as proposed"): run 0 of the `write-guides-first-guides` eval's third pass,
the first with the picture rules in `reference/style.md` as they now stand.

| Path | What it is |
|---|---|
| `docs/user-guides/guides.json` | the set: 3 guides at `checked`, 5 shots at `placeholder`, the run's `notChecked[]` |
| `docs/user-guides/*.md` | `getting-started.md`, `employee.md`, `manager.md` and the `README.md` index |
| `docs/user-guides/images/*.svg` | the placeholder cards |
| `.user-guides/walk/states.mjs` | the walk script the run kept for what a crawl can't reach; refreshes run it again (`USER_GUIDES_SCRIPTS=<scripts> node .user-guides/walk/states.mjs`) |

Two edits after the run: the walk script's import was changed from the run's absolute path to
`USER_GUIDES_SCRIPTS` (the convention `reference/walking.md` now gives), and nothing else.

## Using it

Copy this folder's contents (not this README) over a staged copy of the fixture, then set
`app.baseUrl` (and `interview.answers.appBaseUrl`) to where the staged fixture listens. The
recorded port is the run's own and means nothing. `evals/scripted/write-guides-refresh-v2/scaffold.mjs`
does exactly that, takes every picture at v1 (a PNG in place of each card, with the v1
fingerprint) and releases the copy as v2.

## Against the v2 change table

The fixture's README (R14) names the shots v2 must retake: those whose region holds the Requests
toolbar or the Settings Notifications panel. In this set that is **exactly one** shot,
`settings` (the whole Settings screen). `my-requests` is cropped to the table, which v2 leaves
alone, and `request-dialog` to the dialog, which keeps its name. The text changes are three
"Select **Request leave**" steps (now **New request**) and one row naming the removed checkbox.
