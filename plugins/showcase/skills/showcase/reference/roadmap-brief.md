# The roadmap brief

When a showcase is too big for one session, `/showcase` doesn't start building. It writes `showcase/BRIEF.md`, commits it, and hands it to `/planning:roadmap`, which turns it into a multi-session plan run with `/session` or `/autopilot`. This doc says when that happens and what the brief must hold.

## When the work goes to a roadmap

Phase P5 keeps the work in the session only if **all** of these hold:

- the deliverables are a film and/or a live demo (no in-app tour);
- one tour of 3 minutes or less;
- determinism needs config only, no app code (`showcase docs determinism`).

Otherwise, or when the user picks "An approved brief handed to `/planning:roadmap`" in Round 3, the skill:

1. finishes the interview (Rounds 1–3) and the exploration, so the brief carries every answer;
2. runs `showcase init`, and drafts the tour if the story is clear enough (`check` clean; rehearsing can wait for the roadmap);
3. writes the brief: `showcase brief`, then fills in the sections only it knows (below);
4. commits `showcase/` (not `out/`, `.cache/` or `.auth/`), following the repo's commit conventions;
5. tells the user to run `/planning:roadmap showcase/BRIEF.md` **in a fresh session**, and stops.

The storyboard round (Round 4) can still happen first if the user wants to approve the story before the plan is made; the brief then records it as approved.

## `showcase brief`

```
showcase brief [--check] [--json]
```

- The first run copies `templates/BRIEF.md` to `showcase/BRIEF.md`. Every run regenerates the two blocks between `<!-- showcase:begin … -->` and `<!-- showcase:end … -->` markers from the repo's files, and keeps every other line as written.
- **`tours`:** for each tour in `showcase/tours/`, its kind, audience, close and language; the takeaway; the budget (the length preset scaled by the kind); where it stands now (narration by reading time, words, beats); its rules; `check`; the storyboard's freshness and approval; the last rehearse; the narrator; the voice status per sentence (as `voice --check` sees it); the last film's report; the final-cut approval.
- **`app`:** from `showcase/config.json`: build, start, URL and health; the names (never the values) of `app.env`; snapshot and reset; the clock, browser, blocked and hidden counts; how many deny-list entries; the sign-in; the voice folder; and which determinism levers are set.
- Nothing in it is dated, so the same state gives the same bytes. No key is read into it, ever.
- **`--check`** changes nothing and exits 1 if the brief is missing or its blocks are out of date. Each roadmap session can run it to see what moved; the last one makes it pass.

Delete a block's markers and `brief` leaves that part alone (it says so).

## What the brief must hold

Sections 2 and 4's tables are generated; the rest is the skill's to write, from the interview and the explorers' reports. Write for a fresh session that never saw the interview.

| § | Section | Holds |
|---|---|---|
| 1 | What was asked, verbatim | Every question of Rounds 1–3 and the user's answer **word for word**, including "Other" text; which answers came from arguments, `defaults.json` or the files; why the roadmap path was taken |
| 2 | The tours, budgets and approvals | Generated. The skill adds nothing here; it changes the tour or config and runs `brief` again |
| 3 | The story | The kind's spine, the register for the audience, the close for "afterwards"; the hero moments in order, each with its route, what changes on screen and anchor candidates; the beat to cut first |
| 4 | The app | Generated table, then: the routes the tours visit; sign-in; data sources and seeds; clocks and randomness; live AI and external APIs and how each stays out of the film; WebGL, iframes and dialogs; for in-app, the framework, router and mount point. **Determinism still to do:** each lever that needs app code, and what change. **Frozen and allowed code:** exactly what the roadmap may change in the app, and what it must not touch |
| 5 | Toolkit gates | The `showcase` commands each session's verification gate runs (the template's table; trim what doesn't apply) |
| 6 | Checkpoints | The checkpoint protocol below (the template's text) |
| 7 | Open items | The voice key (`showcase keys status`), a sign-in to record, data the snapshot can't pin, deferred answers |
| 8 | A suggested session cut | The template's typical cut, adjusted to this app |
| 9 | End-to-end verification | How the whole result is proved (the template's list, plus anything app-specific) |

Keep it to what a plan needs. The method lives in `showcase docs <topic>`; point to it rather than copying it.

## The checkpoint protocol

The user alone decides three things: the **storyboard** (Round 4), the **narrator** (the audition, Round 4 or 5) and the **final cut** (Round 5). Each becomes a roadmap session that stops for review, using `/session`'s `Needs decision:` mechanism (D14):

- **Headless (autopilot):** the session sets its tracker row to ⛔ `Needs decision: run Session N interactively — <what to review and how>`, writes its summary, commits and stops. Autopilot stops cleanly on it. (`/session` treats any other ⛔, `Needs review:` included, as a failed gate, so always use `Needs decision:`.)
- **Interactive:** the session shows the artifacts (`storyboard.html` with stills, the audition page, the film and its contact sheet) and asks with AskUserQuestion: Approve as-is · I have notes · the round's own options (`showcase docs interview`). Notes become a numbered checklist in the session log, are fixed, and the gate re-runs.
- **Recorded:** approval dates go in the tour's `meta.approved.{storyboard, narrator, final}`, and the narrator's in `voice.narrator.approved` in `showcase/config.json` (that's what turns the draft watermark off).

## Roadmap sessions use the CLI, not the skill

`/showcase` is user-invoked only (`disable-model-invocation: true`, D18), so a roadmap session can't load it. Sessions run the `showcase` CLI directly (it's on the Bash tool's PATH whenever the plugin is enabled) and read the method with `showcase docs <topic>`:

| Topic | When |
|---|---|
| `tour-format` | Writing or fixing a tour |
| `narrative` | Budgets, spines, writing and caption rules |
| `determinism` | Making the app repeatable |
| `voice` | Voicing, the audition, keys and cost |
| `film` | Rendering, verify thresholds, reading it back |
| `in-app` | Vendoring the runtime, adapters, deep links |
| `interview` | The rounds' wording, for checkpoint questions |
| `roadmap-brief` | This doc |

The plan's kickoff prompts should say so, and should carry the rules from the skill that apply to every session: never ask for, print or read a key; the tour JSON is the only source; budgets and caption limits are gates; read every still back; never publish or push without the user's go.
