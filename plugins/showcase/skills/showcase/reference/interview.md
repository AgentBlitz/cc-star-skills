# The interview

What `/showcase` asks, in what order, what it sends the explorers, and where each answer lands. The round wording below was reviewed and approved as-is (Session 9); keep it word for word.

The skill asks in AskUserQuestion rounds: at most four questions a round, the recommended option first. Arguments (`/showcase pitch 2min film+demo`), `~/.config/showcase/defaults.json` and the explorers' findings skip whatever they already settle. In a headless run, where AskUserQuestion isn't offered, the skill prints the round it needs and stops: **never guess an unasked answer.**

## Round 1: outcomes

Asked before exploring, because the answers steer what the explorers look for.

| Ask | Options |
|---|---|
| The narrated film is always made. What else? | Film + live demo (Recommended: it reuses the same tour) · Film only · Film + in-app tour (changes app code, usually a roadmap) · All three |
| What should the viewer do after watching? | Decide or back it · Try it themselves · Understand how it works · Champion it |
| What kind of video? | Pitch · Walkthrough · Feature spotlight · How-to |
| How long? | The kind's default (pitch 2:00, walkthrough 3:00, spotlight 1:00, how-to 2:00) · About 1 min · About 2 min · 3 min or more (Other for an exact length) |

## Exploring

Three Explore agents, launched together in one message, each with the brief below plus the Round 1 answers and the repo's path. Each returns **at most 600 words in its report shape**, nothing else: no code dumps, no file contents beyond a quoted line where it matters. They read; they never run the app, install anything or write.

### A: Screens and hero moments

> Map this web app's screens for a narrated product film of kind `<kind>`, for viewers who should `<afterwards>`. Find the routes (the router's files, links in the navigation), what each screen is for, and which state lives in the URL (query parameters, path ids). Then rank the 5–8 moments that would best show what the app does: a visible change a viewer would notice, reached by real clicks or typing. For each moment give the route, the actions that cause it, what changes on screen, and anchor candidates for the controls involved: an ARIA role and accessible name first, then a label, a test id, visible text, and CSS only as a last resort. Don't run the app.

```
## Routes
- /path: what it's for · URL state (params) · reached from …
## Navigation
One line on how screens connect (sidebar, tabs, palette).
## Hero moments (ranked)
1. <name> · /route · actions: … · on screen: … · anchors: role "name", label "…", testid …
…
## Risks
Anything that will fight a film: modals, virtualised lists, canvases, slow loads.
```

### B: Story and data

> Find what this app is for, for a film aimed at viewers who should `<afterwards>`. Read the README, docs, landing or marketing page and any product copy: the problem it solves in its users' own words, who it's for, and the language it uses for its main things. Then find where its data comes from: the database and how it's seeded, fixtures or demo modes, sign-in (and any demo account), clocks or "now" on screen, randomness, live AI calls or external APIs (and the environment variables that point at them), and any existing redaction or anonymisation. Don't run the app.

```
## Purpose
2–3 sentences: the problem, who has it, what changes for them.
## Their words
Terms the app uses for its main things (quoted).
## Takeaway candidates
1. … 2. … 3. … (one line each, for "What should they believe afterwards?")
## Data
Source · seeds or demo mode · snapshot route (e.g. SQLite file + path variable) · sign-in (demo account?)
## Moving parts
Clocks · randomness · live AI (base-URL variable) · external APIs · each with how to pin or avoid it.
## Privacy
Personal data on screen · existing redaction config (file, what it covers).
```

### C: Running and anchors

> Find how to run this web app as a production build for a scripted browser, and how stable its controls are to target. Give the build and start commands (from the package scripts, Docker files or docs), how to set its port, a health URL that answers once it's ready, and the environment it needs. Survey the markup for accessibility roles and names, labels and test ids (which attribute), and anything a scripted pointer will find hard: WebGL or canvases, iframes, modal dialogs, popovers, full-screen views, virtualised lists. If the in-app tour is wanted, also give the framework and version, the router, and where a root-level component would mount. Don't run the app.

```
## Run
Build: `…` · Start: `…` (port via …) · Health: /… · Env: NAME (what for), …
Dev-server tells to hide: (e.g. nextjs-portal)
## Anchors
Roles and names: good / patchy / poor (examples) · labels · test-id attribute and coverage
## Hard parts
WebGL · iframes (same-origin?) · dialogs · popovers · full screen · virtualised lists, each with where
## In-app (only if asked)
Framework + version · router · mount point (file) · existing Playwright?
```

### After exploring

Send the user a summary of **at most 15 lines**: what the app is for (one line), the hero moments you'd use, how it runs, the data plan, and anything that pushes toward the roadmap path (app code needed for determinism, an in-app tour, several tours). Then run `showcase init` and `showcase inspect <route>` on the two or three key routes, to check the anchor candidates resolve. Round 2's options are drafted from all of this.

## Round 2: the story

The options are drafted from the explorers' reports.

| Ask | Options |
|---|---|
| Who's watching? | Executives · Prospective users · Your team · Developers (ordered by the answer to "afterwards") |
| What should they believe afterwards? | Three one-line takeaways drafted from the README, the landing copy and the problem the app solves |
| Which moments carry the story? (multi) | The top four hero moments, each with its route and what changes on screen |
| The film shows data. How should it see it? | A frozen snapshot · The app's own seed mode (offered only if one exists) · Live at render time |

## Round 3: voice and path

| Ask | Options |
|---|---|
| Narrator? | Your saved default (offered only if one exists) · Audition the shortlist: 9 British voices through OpenRouter and OpenAI's Fable through Requesty (a few cents) · The draft voice for now |
| Language? | UK English · US English |
| What must never be on screen? (multi) | People's names · Hostnames and internal URLs · Emails and customer data · Nothing sensitive |
| Where should it be built? | Here, now (when the path allows) · An approved brief handed to `/planning:roadmap` |

An audition voice needs its provider's key (`OPENROUTER_API_KEY` or `REQUESTY_API_KEY`, `showcase keys status`); without it that voice is skipped, unspent. To compare deliveries of one voice (Fable warm against Fable brisk, say), list them in `voice.audition` with their own `instructions` (`showcase docs voice`).

**Here, now** is offered only if all of these hold: the deliverables are a film and/or live demo; one tour of 3 minutes or less; determinism needs config only, no app code. Otherwise the last question isn't asked: say why, and take the roadmap path (`showcase docs roadmap-brief`).

## Round 4: the storyboard

After a real rehearsal, with a still per beat:

- Approve, voice and film it · Change beats · Tighten (drop the first-to-cut beat) · A different angle (the second takeaway).
- If there was an audition, the narrator is picked here too.
- At most three revision loops, then offer the roadmap path.

## Round 5: the final cut

- Approve as final · I have notes (they become a numbered checklist) · Re-voice · Re-time.
- Then: "Save this narrator as your default for every repo?"

## How answers map to files

| Answer | Goes to |
|---|---|
| What else | Which phases run: Watch (P10) for the live demo; the in-app path (`showcase docs in-app`) for the in-app tour |
| Kind | `meta.kind`; the template `templates/tour.<kind>.json` |
| How long | `meta.length.targetSec` (60, 90, 120, 180, 300, or the exact length) |
| Afterwards | `meta.afterwards` (`decide` · `try` · `understand` · `champion`); the closing card (`showcase docs narrative`) |
| Who's watching | `meta.audience` (executives · users · team · developers); the register |
| Takeaway | `meta.takeaway` |
| Moments | The tour's steps and beats, in the kind's spine |
| Data | `config.json` `app.snapshot` / `app.reset` / `app.env` (`showcase docs determinism`) |
| Narrator | `config.json` `voice.narrator` (`approved` stays false until Round 5) |
| Language | `meta.language` (`en-GB` · `en-US`), `browser.locale` |
| Never on screen | `config.json` `privacy.deny`, pre-filled from any redaction config the explorers found |
| Where | In this session, or `showcase/BRIEF.md` and `/planning:roadmap` |
| Approvals | `meta.approved.{storyboard, narrator, final}` (dates) |
| Save as default | `~/.config/showcase/defaults.json` (narrator and language) |

On the roadmap path, every answer also goes into `showcase/BRIEF.md` §1, word for word.

### `defaults.json`

`${SHOWCASE_CONFIG_DIR:-~/.config/showcase}/defaults.json`, written only with the user's yes after a final cut (D17), so the next repo starts with the same narrator:

```json
{ "narrator": { "model": "elevenlabs/eleven-v3", "voice": "george" }, "language": "en-GB" }
{ "narrator": { "provider": "requesty", "model": "openai/gpt-4o-mini-tts", "voice": "fable", "instructions": "Warm and unhurried." }, "language": "en-GB" }
```

It holds no key and no approval: a new repo's narrator starts unapproved until its own final cut.

## Skip rules

- An argument answers its question: a kind (`pitch`, `walkthrough`, `spotlight`, `howto`), a length (`2min`, `90s`, `1:30`), outcomes (`film+demo`, `film`, `film+in-app`, `all`), what the viewer does afterwards (`decide`, `try`, `understand`, `champion`). So `/showcase pitch 2min film+demo decide` settles Round 1.
- `defaults.json` answers Narrator and Language, but they're still shown as the first option in their round, so the user can change them.
- An answer the files already hold (a tour's `meta`, `config.json`) is not asked again on resume.
- A round with every question settled is skipped, and the skill says which answers it used.

## Headless runs

`claude -p` doesn't offer AskUserQuestion. When the next round has any unsettled question, print the round and stop, without exploring, writing files or guessing:

```
/showcase needs your answers before it can go on. Round 1 of 5: outcomes

1. The narrated film is always made. What else?
   a) Film + live demo (Recommended: it reuses the same tour)  b) Film only
   c) Film + in-app tour (changes app code, usually a roadmap)  d) All three
2. What should the viewer do after watching?
   …

Run /showcase in an interactive session, or answer with arguments,
e.g. /showcase pitch 2min film+demo decide
```

Show every question of the round with its options, in the order above, and the arguments that would answer them. Answers the arguments or files already gave are listed as settled, not asked.
