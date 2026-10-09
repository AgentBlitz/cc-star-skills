# The tour format

A tour is one JSON file, `showcase/tours/<id>.json`. It's the only source: the storyboard, the voice manifest and the film are all generated from it. The JSON Schema is `showcase/.schema/tour.schema.json` (copied by `showcase init`, so editors validate as you type); `showcase check <tour>` validates it and applies the rules below.

## The shape

```json
{ "$schema": "../.schema/tour.schema.json", "showcase": 1, "id": "find-a-decision", "title": "Find any decision in seconds",
  "meta": { "kind": "spotlight", "audience": "team", "afterwards": "try", "language": "en-GB", "length": { "targetSec": 60 } },
  "anchors": { "query": { "label": "Search" }, "summary": { "css": "p", "text": { "pattern": "results? ·" } } },
  "steps": [{ "id": "search", "path": "/search", "ready": { "kind": "visible", "anchor": "@query" },
    "beats": [{ "id": "ask",
      "narration": [ "Every session log from every repo lands in one searchable place.",
        { "text": "Ask in your own words, and Star finds the session that decided it.", "after": "type" } ],
      "actions": [
        { "id": "type", "kind": "type", "target": "@query", "text": "why sqlite" },
        { "id": "go", "kind": "click", "target": { "role": "button", "name": "Search" }, "navigates": true, "effect": "write",
          "done": { "kind": "url", "path": "/search", "params": { "q": "why sqlite" } } } ],
      "ready": { "kind": "visible", "anchor": "@summary" }, "dwellMs": 1200 }] }] }
```

- **Tour:** `{showcase: 1, id, title, meta, anchors?, steps[]}`. Ids are lower-case kebab (`^[a-z0-9][a-z0-9-]*$`).
- **Step:** `{id, title?, path?, ready?, beats[]}`: one screen. `path` is where it happens; `ready` must hold on arrival, before the first beat.
- **Beat:** `{id, narration?, actions?, ready?, dwellMs?, card?}`. Beat ids are unique across the tour: the voice manifest and the film's events key on them. A beat lasts the longest of its narration, its actions and its `ready`, plus `dwellMs`.
- **Sentence:** a string, or `{text, after}`: start once the beat's action `after` is done. One sentence is one caption.
- **Card:** `{title, lines?}` on a beat shows a title card instead of the screen (openings and closes).

## meta

| Field | Values |
|---|---|
| `kind` | `pitch` · `walkthrough` · `spotlight` · `howto` (the spines: `showcase docs narrative`) |
| `audience` | `executives` · `users` · `team` · `developers` |
| `afterwards` | `decide` · `try` · `understand` · `champion` |
| `takeaway` | The one line the viewer should believe afterwards |
| `language` | BCP 47, e.g. `en-GB` |
| `length` | `{targetSec, narration?: {min, max}, beats?: {min, max}}`. `targetSec` picks the preset; `narration` (seconds) and `beats` override it |
| `rules` | `{spokenNumbers?: "on-screen-only" \| "none", firstToCut?: <beat id>}` |
| `approved` | `{storyboard?, narrator?, final?}`: dates the skill records |

## Anchors

An anchor finds one element. In order of preference:

1. `{"role": "button", "name": "Search"}`: an ARIA role and accessible name;
2. `{"label": "Email"}`: a form control's label;
3. `{"testId": "save"}`: a `data-testid` (or the app's test-id attribute);
4. `{"text": "Sign in"}`: visible text;
5. `{"css": "main h1"}`: CSS, the last resort. With `text`, CSS is narrowed to matches.

`name`, `label` and `text` take a string (contains, case-insensitive; `"exact": true` for exact) or `{pattern, flags?}`. `name` needs `role`. `nth` picks a match (0 first, -1 last), `within` scopes to another anchor, `frame` to a same-origin iframe. Visible matches come first and open shadow roots are searched. Never use `nth-child` in CSS.

Name anchors once in `anchors` and use them as `"@name"` wherever a `target`, `anchor`, `within` or `to` is expected.

## Actions

Every action has `id` (unique in its beat) and `kind`, and may have:

- `label`: what it does, in words (the storyboard and report show it);
- `effect`: `read` (default) or `write`. A **write needs `done`**, a predicate that holds once it has taken effect; if `done` already holds, the action is skipped, so reruns, Back and deep links never write twice;
- `done`: as above, also usable on reads to wait for the effect;
- `timeoutMs`: how long the target or `done` may take (the target wait defaults to 10 s);
- `navigates: true`: the action causes a full page load. It must be the **last action of its beat**, and it runs after the beat's narration, so no sentence is cut off; no sentence may wait for it. SPA route changes don't need it;
- `input`: `trusted` or `synthetic`, to override how input is delivered.

| kind | Fields | Does |
|---|---|---|
| `goto` | `url` | Goes to a path or URL |
| `click` | `target`, `button?`, `count?` | Clicks with the visible pointer |
| `type` | `target`, `text`, `append?`, `submit?: enter\|button` | Types into a field, then blurs it |
| `select` | `target`, `value` or `option` | Picks an option |
| `check` | `target`, `checked?` (default true) | Sets a checkbox, radio or switch |
| `hover` | `target` | Moves the pointer onto the target |
| `focus` | `target` | Focuses the target |
| `key` | `key`, `target?` | Presses a key or chord (`Enter`, `Control+K`): the last resort |
| `press` | `target`, `ms?` | A long press |
| `drag` | `target`, `to` or `by: {x, y}` | Drags onto an element or by an offset |
| `upload` | `target`, `files[]` | Chooses files (paths relative to `showcase/`) |
| `scroll` | `target?`, one of `to: top\|bottom\|<anchor>`, `by`, `until` | Scrolls the page or a scroller; `until` keeps going (virtualised lists) |
| `spotlight` | `target`, `callout?: {title, body}` | Lights up the target; it holds for its sentence and clears when the pointer moves on |
| `wait` | `ms` or `until` | Waits a fixed time or for a predicate |
| `hold` | `ms` | Lets it be seen, on the tour's pace (fast-forward skips it) |
| `card` | `title`, `lines?`, `ms?` | Shows a card over the screen mid-beat |
| `invoke` | `name`, `args?` | Calls an adapter action (in-app only) |
| `camera` | `target?`, `scale?` (1–2), `end?` | Accepted and ignored in v1 (D19) |

Prefer the visible control to a hotkey. The executor scrolls the target to the centre, waits up to 10 s for it, and blurs after typing.

## Readiness predicates

Used by step and beat `ready`, action `done`, `wait.until` and `scroll.until`:

| kind | Fields |
|---|---|
| `visible` · `exists` · `enabled` · `absent` | `anchor` |
| `attr` | `anchor`, `name`, `prop?` (read the DOM property), one of `equals` · `contains` · `matches` · `nonEmpty` |
| `text` | `anchor`, one of `equals` · `contains` · `matches` |
| `count` | `anchor`, `min?`, `max?` (at least one) |
| `url` | `path?`, `params?` (at least one) |
| `all` · `any` | `of: [predicates]` |

## Rules `check` applies

Errors fail `check` (exit 1); warnings are printed.

| Id | Level | Rule |
|---|---|---|
| T001 | error | The tour matches the schema (unknown properties, kinds and missing fields are reported by JSON pointer) |
| T002 | error | Step and beat ids are unique in the tour; action ids are unique in their beat |
| T003 | error | A sentence's `after` names an action of the same beat |
| T004 | error | An `effect: write` action has `done` |
| T005 | error | A `navigates` action is last in its beat, and no sentence waits for it |
| T006 | error | Every `@name` is defined in `anchors` |
| T007 | error | Every sentence fits one caption: 2 lines of 42 characters, wrapped greedily |
| T008 | error | Narration is inside the window for the length and kind: each sentence by its clip once voiced (the voice manifest), else by `readingMs` |
| T009 | warning | The beat count is inside the preset's range |
| T010 | error | Under `spokenNumbers: "none"`, no sentence says a number |
| T011 | error | A film of 2:00 or more names a `firstToCut` beat, and it exists |
| T012 | error | A closing card holds at least 2 s (`dwellMs` ≥ 2000) |
| T013 | warning | A pitch has no callouts |
| T014 | warning | No beat is empty (no narration, actions or card) |
| T015 | error | `showcase/storyboard/<id>.md` is current (run `showcase storyboard <id>`) |

`rehearse` adds the live checks: every anchor resolves, each spoken number is on that beat's screen (`on-screen-only`), and nothing on the deny-list is visible.

## The storyboard

`showcase storyboard <tour>` writes `showcase/storyboard/<id>.md`: a meta header, a beats table (planned start, step and path, actions, narration, words, seconds) and the pacing against the preset. `--stills` rehearses the tour for a still per beat, and `--html` writes `showcase/out/<id>/storyboard.html` with them: the page the storyboard round (Round 4) shows. It's generated, never edited; its first lines carry a hash of the tour's content (key order, whitespace and `$schema` don't count), and `check` reports T015 when they differ.
