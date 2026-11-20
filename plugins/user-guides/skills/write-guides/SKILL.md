---
name: write-guides
description: Write a web app's end-user guides as markdown in its repo, from a walk of the running local app as each role (role guides, features and value, getting started, admin and operations), with picture placeholders and a guides.json that /user-guides:wiki-guides illustrates and publishes. Interviews first; resumable; refreshes the guides after a release, or adopts guides written by hand. Use when asked to write, update, refresh or check a product's user guides or help pages, from or against the app itself. Not for READMEs, API or developer references, release notes, a product film, or a single shared doc or how-to.
argument-hint: "[refresh | adopt | check | answers, e.g. readers=employee,manager kinds=role-guide]"
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash, Agent, AskUserQuestion]
---

# write-guides — user guides from a walk of the app

Take the user from an interview to a checked set of guides for **their** app: one markdown file
per guide, written in the screens' own words, a placeholder card for every picture, and
`guides.json`, which records the set for refreshes and for `/user-guides:wiki-guides`.

The scripts are in this skill's `scripts/` folder (the base directory you were given when the
skill loaded; else `${CLAUDE_PLUGIN_ROOT}/skills/write-guides`). Call that folder `$S` below.
They are dependency-free Node ≥ 20; run them from the **target repo's root**. The method is in
`reference/`, one file a step: read the step's file first and follow it, rather than working
from memory.

## Route by `$ARGUMENTS`

| Argument | Do |
|---|---|
| (none), or answers | The steps below; resume from what `guides.json` and `.user-guides/walk/` hold |
| `refresh` | After a release: `reference/refresh.md` › Refresh |
| `adopt` | Guides written by hand, with no `guides.json`: `reference/refresh.md` › Adopt (one round, `interview.md` › Adopt) |
| `check` | `node $S/check-guides.mjs`, and explain each problem |

## Never

- Walk anything but the **local** app (`localhost` or `127.0.0.1`, unless the user confirms
  otherwise), or use real people's data. Synthetic accounts only.
- Read a folder the project's CLAUDE.md forbids, or a git-ignored file other than this
  skill's own work folder `.user-guides/`, in recon or after.
- Print, log or store a password, token or cookie value. Only a `storage-state` file is kept,
  mode 600 under `.user-guides/auth/`.
- Run `app.start` or `app.reset`, or install Playwright, without asking first; a reset wipes
  the synthetic accounts' data, so say so. A headless run never does any of the three.
- Guess an answer. Headless with a question unsettled: print the round and stop.
- Put a claim the walk did not confirm in a guide without recording it in `notChecked[]`, or
  put internal references (decision or ticket ids, file paths, code names) in a guide.
- Edit `guides.json` by hand: change it with `$S/set-edit.mjs`, which validates every change.

## The steps

**0. Resume.** If `guides.json` exists (default `docs/user-guides/guides.json`; search the
repo's docs folders if it isn't there), read it with `node $S/guide-set.mjs summary <file>`:
its answers are not asked again; guides at `outlined` are written next, `written` ones checked
next. A `.user-guides/walk/outline.json` from an earlier walk can be reused. Say in one line
where you are picking up.

**Headless** (no AskUserQuestion, as in `claude -p`): if the next round has an unsettled
question, print that round as `interview.md` › Headless runs shows and **stop**, before recon,
walking or writing anything.

**1. Recon** (`reference/recon.md`). Launch the three Explore agents **together in one
message**, each with its brief and report shape, limited to git-tracked files in named folders.
Then tell the user what you found in at most 15 lines.

**2. Interview** (`reference/interview.md`). Rounds 1 and 2, word for word, at most four
questions a round, the recommended option first, skipping what arguments or `guides.json`
already settle. Record each answer word for word (`interview.answers`) and the settings it
decides, with `set-edit.mjs`, as soon as it is given.

**3. Walk** (`reference/walking.md`). Preflight, then walk the local app as each role:
`node $S/walk-lib.mjs crawl`, plus a walk script of your own for what a crawl can't reach
(dialogs opened by clicks, states after an action). Read `.user-guides/walk/outline.md` and
the dumps. No app: take the code path and record what you could not check.

**4. Round 3: the guide set** (`interview.md` › Round 3, `reference/guide-types.md`). Propose the
guides and each one's outline; at most three loops of notes. On approval, register each guide
(`addGuide`, status `outlined`) and save its outline as the file's heading skeleton.

**5. Write** each guide from its template in `templates/` (`reference/style.md`): in the
screens' own words, a `**bold**` label only for words on screen, one placeholder per picture
(`placeholder.mjs`, then `addShot`), and every walked screen covered or in `leftOut[]`. Move it to
`written` when it is done. Large sets go guide by guide, over several sessions if need be.

**6. Check.** `node $S/check-guides.mjs` (add `--record` on the code path). Fix every problem,
then `--mark-checked`. `node $S/guide-set.mjs index <guides.json> <guides>/README.md` keeps the
index's status block current.

**7. Report.** The guides and their status, how many pictures are placeholders, what is in
`notChecked[]` and `leftOut[]`, and the next step: `/user-guides:wiki-guides` takes the
pictures and publishes. Nothing is committed unless the user asks.
