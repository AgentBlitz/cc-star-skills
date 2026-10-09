<!-- showcase brief v1. `showcase brief` rewrites only the blocks between showcase:begin and showcase:end markers, from the repo's files; every other line is written by /showcase and kept. What each section must hold: `showcase docs roadmap-brief`. -->

# Showcase brief

> For `/planning:roadmap showcase/BRIEF.md`, run in a fresh session. It turns this brief into a multi-session plan that ends in an approved, verified film. Everything a session needs to know without the interview is here; `showcase docs <topic>` has the method.

## 1. What was asked, verbatim

_Each interview round's questions and the user's answers, word for word, including any "Other" text. Note the answers settled by arguments, `defaults.json` or the files, and say which._

| Round | Question | Answer |
|---|---|---|
| 1 | The narrated film is always made. What else? | |
| 1 | What should the viewer do after watching? | |
| 1 | What kind of video? | |
| 1 | How long? | |
| 2 | Who's watching? | |
| 2 | What should they believe afterwards? | |
| 2 | Which moments carry the story? | |
| 2 | The film shows data. How should it see it? | |
| 3 | Narrator? | |
| 3 | Language? | |
| 3 | What must never be on screen? | |
| 3 | Where should it be built? | An approved brief handed to `/planning:roadmap` |

**Why the roadmap path:** _the P5 condition that failed (an in-app tour; more than one tour or over 3 minutes; determinism that needs app code), or the user's choice._

## 2. The tours, budgets and approvals

Generated from `showcase/tours/`, the storyboards, the voice manifest and the last renders. The budget is the length preset scaled by the kind (`showcase docs narrative`); `check` gates on it.

<!-- showcase:begin tours -->
<!-- showcase:end tours -->

## 3. The story

_The spine for the kind, the register for the audience and the close for "afterwards" (`showcase docs narrative`); the hero moments in order, each with its route, what changes on screen and its anchor candidates; the beat to cut first._

## 4. The app

Generated from `showcase/config.json`:

<!-- showcase:begin app -->
<!-- showcase:end app -->

_From the explorers: the routes the tours visit; sign-in; data sources and seeds; clocks and randomness; live AI or external APIs and how each is kept out of the film; WebGL, iframes, dialogs; for the in-app path, the framework, router and mount point._

**Determinism still to do:** _each lever the app needs that config can't give, and the change it needs (`showcase docs determinism`)._

**Frozen and allowed code:** _what the roadmap may change in the app (for example `data-showcase` anchors, a reset endpoint, the vendored runtime, the entry point) and what it must not touch._

## 5. Toolkit gates

Each session's verification gate uses these, for real:

| Stage | Gate |
|---|---|
| Tour | `showcase check <tour>` exits 0 (no errors; the storyboard is fresh) |
| Rehearsal | `showcase rehearse <tour>` clean three times in a row; on the in-app path also `rehearse --synthetic` with no `cannot` gaps |
| Storyboard | `showcase storyboard <tour> --stills --html`, each still read back against its sentence |
| Voice | `showcase voice <tour> --check` exits 0; the pacing table inside the window |
| Film | `showcase film <tour> --strict` green, then the contact sheet and every still read back against `report.md` |
| In-app | `showcase runtime vendor` twice with no diff; the app's own lint, typecheck and build; `showcase film <tour> --in-app --strict` green |
| Repeatable | two renders give the same SRT, timecodes within 100 ms |

## 6. Checkpoints

The user decides three things, and only the user: the **storyboard** (Round 4), the **narrator** and the **final cut** (Round 5). Each is a roadmap session that stops for review:

- **Run headless (autopilot):** the session sets its row to ⛔ `Needs decision: run Session N interactively — <what to review and how>`, writes its summary, commits and stops.
- **Run interactively:** it shows the artifacts (the storyboard page, the audition page, the film and contact sheet) and asks: Approve as-is · I have notes · the round's own options. Notes become a numbered checklist, fixed and re-rendered before the gate.
- Approvals are recorded as dates in the tour's `meta.approved` and, for the narrator, `voice.narrator.approved` in `showcase/config.json`.

## 7. Open items

_Anything not settled: the voice key (`showcase keys status`), a sign-in to record (`showcase auth`), data the snapshot can't pin, an answer the user deferred._

## 8. A suggested session cut

_Adjust to the work. A typical cut:_

1. **Determinism and anchors:** the levers in §4, `showcase init`, `inspect` on the key routes, any app changes allowed.
2. **The tour:** draft from `templates/tour.<kind>.json`, `check` and `rehearse` clean, the storyboard with stills.
3. **Checkpoint: the storyboard** (Round 4), with the audition if one was chosen.
4. **Voice and film:** `voice --yes`, `film --strict --detach`, read back.
5. **Checkpoint: the final cut** (Round 5), then `watch` if a live demo was asked for.
6. **In-app** (if asked for): `runtime vendor`, the adapter, anchors and their test, the entry point, `film --in-app --strict`, then a checkpoint.

## 9. End-to-end verification

- `showcase check`, `rehearse` (three clean runs) and `voice --check` pass for every tour.
- `showcase film <tour> --strict` is green, and every still shows what its sentence says.
- Two renders give the same SRT, with timecodes within 100 ms.
- The user approved the storyboard, the narrator and the final cut, and the dates are in the tour's `meta.approved`.
- `showcase brief --check` exits 0, so this brief matches the repo.
- Nothing under `showcase/out/`, `.cache/` or `.auth/` is committed, and no key is in the repo.
