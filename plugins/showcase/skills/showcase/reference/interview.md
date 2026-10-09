# The interview (draft)

> Draft (Session 3). Session 9 reviews its wording with the user; Session 11 finishes it (the explorer briefs and report shapes in full).

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

Three Explore agents in parallel, each returning at most 600 words in a fixed shape:

- **A: Screens and hero moments.** Routes, navigation, URL state, and 5–8 ranked moments, each with its route, what changes on screen and anchor candidates.
- **B: Story and data.** Purpose, problem and language from the README, docs and landing page; data sources and seeds; clocks; live AI or external APIs; sign-in; any existing redaction.
- **C: Running and anchors.** Build and start commands, port, health URL; roles, labels and test ids; WebGL, iframes and dialogs; for the in-app path, the framework, router and mount point.

A summary of at most 15 lines goes back to the user, then `showcase init`, then `showcase inspect` on the key routes.

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
| Narrator? | Your saved default (offered only if one exists) · Audition about 9 OpenRouter voices (a few cents) · The draft voice for now |
| Language? | UK English · US English |
| What must never be on screen? (multi) | People's names · Hostnames and internal URLs · Emails and customer data · Nothing sensitive |
| Where should it be built? | Here, now (when the path allows) · An approved brief handed to `/planning:roadmap` |

**Here, now** is offered only if all of these hold: the deliverables are a film and/or live demo; one tour of 3 minutes or less; determinism needs config only, no app code.

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
| Kind | `meta.kind`; the template `templates/tour.<kind>.json` |
| How long | `meta.length.targetSec` (60, 90, 120, 180, 300, or the exact length) |
| Afterwards | `meta.afterwards`; the closing card (`showcase docs narrative`) |
| Who's watching | `meta.audience` (executives · users · team · developers); the register |
| Takeaway | `meta.takeaway` |
| Moments | The tour's steps and beats, in the kind's spine |
| Data | `config.json` `app.snapshot` / `app.reset` / `app.env` |
| Narrator | `config.json` `voice.narrator` (`approved` stays false until Round 5) |
| Language | `meta.language` (`en-GB` · `en-US`), `browser.locale` |
| Never on screen | `config.json` `privacy.deny`, pre-filled from any redaction config the explorers found |
| Approvals | `meta.approved.{storyboard, narrator, final}` (dates) |
| Save as default | `~/.config/showcase/defaults.json` (narrator and language) |

## Skip rules

- An argument answers its question: a kind (`pitch`), a length (`2min`, `90s`), outcomes (`film+demo`, `film`, `in-app`).
- `defaults.json` answers Narrator and Language, but they're still shown as the first option in their round, so the user can change them.
- An answer the files already hold (a tour's `meta`, `config.json`) is not asked again on resume.
- A round with every question settled is skipped, and the skill says which answers it used.
