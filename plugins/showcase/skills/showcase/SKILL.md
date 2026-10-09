---
name: showcase
description: Interview-led wizard that makes a narrated product film of any web app from one tour file — real screens driven in Playwright, an OpenRouter or draft voice, burned-in captions, a verified 1080p MP4 — plus a self-playing live demo and an in-app guided tour. Subcommands for keys, watch, film, review, brief, in-app, doctor.
argument-hint: "[keys | watch <tour> | film <tour> | review <tour> | brief | in-app | doctor]"
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash, Agent, AskUserQuestion]
disable-model-invocation: true
---

# Showcase — Narrated Product Films for Any Web App

When the user invokes `/showcase`, take them from an interview to a finished, verified film of
**their** app: a narrated MP4 with burned-in captions, an SRT, a timecoded script, a still per
beat and a verification report. The same tour can also play as a live demo (`watch`) and ship
inside the product as an in-app tour. Only the user decides three things: the storyboard, the
narrator and the final cut.

The `showcase` CLI does the mechanics; it's on the Bash tool's PATH while this plugin is enabled
(`showcase --help`; every command takes `--json`). If a shell can't find it, call
`${CLAUDE_PLUGIN_ROOT}/bin/showcase` instead. The method lives in
`${CLAUDE_PLUGIN_ROOT}/skills/showcase/reference/`, one doc per topic (also printed by
`showcase docs <topic>`). Each phase below names the doc to read first. **Pull the exact contract
from the reference, don't reconstruct it from memory**: the budgets, rule ids, flags and
thresholds there are what the CLI enforces.

## Route by `$ARGUMENTS`

| Argument | Do |
|---|---|
| (none), or answers such as `pitch 2min film+demo decide` | The wizard, P0–P11 below; it resumes from whatever `showcase/` already holds |
| `keys` | `showcase keys status`. If `OPENROUTER_API_KEY` is unset, offer: run `showcase shim`, then `showcase keys set` in **their own terminal** · `showcase keys import <file>` with their go · carry on with the draft voice. Then `showcase keys test` (free). Read `voice.md` › Keys |
| `watch <tour>` | `check`, `voice --check` (play anyway if only drafts), then `showcase watch <tour> --detach`; tell them Space pauses, ← → step, M mutes, Esc exits |
| `film <tour>` | P8 for stale voice, `rehearse` if it's older than the tour, then P9 and P10 |
| `review <tour>` | The notes loop: their notes → a numbered checklist → fixes in the tour or config → `check`, `rehearse` → re-render → read back → Round 5 again |
| `brief` | `showcase brief`, then fill in its hand-written sections (`roadmap-brief.md`) |
| `in-app` | The in-app path (`in-app.md`). It changes app code: outside a roadmap session, confirm first or take the brief path |
| `doctor` | `showcase doctor`; explain each row that isn't ok and its fix. `doctor --install --yes` only with their go |

## The wizard

### P0 Route and resume

Work out where things stand from the files, in this order: `showcase/config.json` → `showcase/tours/*.json`
(each tour's `meta`, including `approved`) → `showcase/storyboard/` → the voice manifest
(`showcase voice <tour> --check --json`) → `showcase/out/<id>/report.json`. Resume at the first
phase not done, and say in one line where you're picking up. An answer the files hold is never
asked again.

**Headless** (no AskUserQuestion, as in `claude -p`): if the next round has an unsettled question,
print that round in the format in `interview.md` › Headless runs and **stop**. No preflight,
exploring or writing first, and never guess an answer (D13).

### P1 Preflight

1. Confirm the working directory is the **target web app**, not this marketplace or an empty
   folder. If it's ambiguous, ask which repo, and stop until it's clear.
2. `showcase doctor --json`. Fix or explain anything missing (Node 24, ffmpeg with libass,
   Chromium via `doctor --install --yes` with their go).
3. `showcase keys status`. If the key is missing, offer the three options under `keys` above. A
   missing key never blocks: the draft voice carries the work until the narrator.

### P2 Round 1: outcomes

Read `interview.md`. Ask Round 1 word for word, skipping what `$ARGUMENTS` settled.

### P3 Explore

Launch the three Explore agents (A screens and hero moments, B story and data, C running and
anchors) **together in one message**, each with its brief and report shape from `interview.md`,
plus the Round 1 answers. Then: the summary of at most 15 lines → `showcase init` →
`showcase inspect <route> --json` on the two or three key routes, to confirm anchors resolve.

### P4 Rounds 2 and 3: the story; the voice and path

Draft Round 2's options from the reports, then ask Round 3. Write the answers to the tour's
`meta` and `showcase/config.json` as `interview.md` › How answers map to files says. Make the app
deterministic now (`determinism.md`): data, clock, blocked third parties, hidden overlays,
sign-in (`showcase auth` — the user signs in, you never see the session), `privacy.deny`.

### P5 Choose the path

Stay in this session only if **all** hold: the deliverables are a film and/or live demo; one tour
of 3 minutes or less; determinism needs config only, no app code. Otherwise follow
`roadmap-brief.md`: `showcase brief`, fill in its sections, commit `showcase/`, tell the user to
run `/planning:roadmap showcase/BRIEF.md` in a fresh session, and **stop**.

### P6 Storyboard

Read `narrative.md` and `tour-format.md`.

1. Copy `${CLAUDE_PLUGIN_ROOT}/skills/showcase/templates/tour.<kind>.json` to
   `showcase/tours/<id>.json` and write the real tour: the kind's spine, the audience's register,
   the close for "afterwards", the chosen moments, anchors from `inspect`.
2. `showcase check <tour>` until it's clean (fix the tour, never the rules), then
   `showcase storyboard <tour>`.
3. `showcase rehearse <tour> --json` until it's clean **three times in a row**. A failure saves a
   screenshot, a DOM excerpt and candidate anchors in `out/<id>/rehearse/`: read them, fix the
   beat.
4. `showcase storyboard <tour> --stills --html`, and read every still back. If they chose an
   audition, run `showcase voice <tour> --audition --yes` alongside (after their go on the cost).

### P7 Round 4: the storyboard

Show `showcase/out/<id>/storyboard.html` and the storyboard, then ask Round 4. At most three
revision loops, then offer the roadmap path. On approval, record `meta.approved.storyboard` (today's
date) and the narrator they picked.

### P8 Voice

Read `voice.md`. Run `showcase voice <tour>` without `--yes` first: a paid run is refused with
its sentence and character count. Show the count, get their go, then `--yes`. Read the pacing
table: outside 120–185 wpm or the narration window, **rewrite the text**, never speed the voice.
Re-run `check` and `storyboard` after any rewrite.

### P9 Film

Read `film.md`. `showcase film <tour> --strict --detach`, then poll its `progress.json` in one
foreground loop until `phase` is `done` or `failed` (never end the turn to wait). Read
`report.md`, then `contact-sheet.png` and **every still against its sentence**: does the screen
show what the sentence says? Fix in the tour (move an `after`, add a `hold`, split a beat) and
re-render. Fix pacing in the tour, never in post.

### P10 Round 5: the final cut

Give the film's path and ask Round 5. Notes become a numbered checklist; fix each, re-render,
read back, and ask again. On approval, ask "Save this narrator as your default for every repo?"
Then, if a live demo was chosen, `showcase watch <tour> --detach`.

### P11 Wrap up

- Record `meta.approved.final` and `.narrator` (dates) and `voice.narrator.approved` in the
  config; if they said yes, write `defaults.json` (`interview.md` › `defaults.json`).
- Re-run `showcase voice <tour> --final --yes` and the film if the approval turned a draft into
  the final cut (the DRAFT watermark goes only then).
- Commit `showcase/` — never `out/`, `.cache/` or `.auth/` — following the repo's own commit
  conventions, and suggest `/planning:wrapup`.
- Offer, in one line, to publish the storyboard page as a private claude.ai artifact.

## Rules

- **Never ask for, print or read a key.** Not in chat, not with `cat`, `grep` or Read on the key
  file, a `.env*` file or `showcase/.auth/`. `showcase keys status` is how you know.
- **The tour JSON is the only source.** The storyboard, voice and film are generated from it;
  never edit the storyboard by hand.
- **On the in-session path, never edit app code.** Change the beat instead, or take the roadmap
  path.
- **Budgets and caption limits are gates, not advice.** `check` errors and `film --strict`
  warnings are fixed, not waived.
- **Make the app deterministic before filming** (`determinism.md`).
- **Every screen is the real app**, never a mock-up, a blurred patch or an edited frame.
- **Read every still back.** The checks can't tell whether the film says the right thing.
- **Keep CLI output terse** (`--json`), and detach long runs (`film --detach`); the Bash tool
  stops commands after 10 minutes.
- **Never guess an unasked answer.** Headless, print the round and stop.
- **Checkpoints are `Needs decision:` rows** when this runs inside a roadmap (`roadmap-brief.md`).
- **Never publish, upload or push without the user's go**, and spend on voices only after they've
  seen the count.
- **Follow the target repo's own conventions**: its `CLAUDE.md`, its language for the narration,
  its commit style.
