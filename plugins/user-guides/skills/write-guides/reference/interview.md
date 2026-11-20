# The interview

What write-guides asks, in what order, and where each answer goes. Wording version **2**: keep
the questions and options word for word, and record `"wordingVersion": "2"` with the answers.
(Version 2: no repeated language option, a second folder option, the URL and Round 2a rules.)

Ask in AskUserQuestion rounds: **at most four questions a round, the recommended option
first**. Options in angle brackets are filled from recon (`recon.md`); everything else is
fixed. Record every answer **word for word** in `interview.answers` under its id, with
`set-edit.mjs` (`{"op":"set","path":"interview.answers.<id>","value":…}`), as soon as it is
given, so an interrupted run resumes without asking again.

## Round 1: readers and kinds

Asked after recon, because its options come from the roles recon found.

| Id | Ask | Options |
|---|---|---|
| `readers` | Who will read these guides? (multi) | Every role: \<role list\> (Recommended: a guide each) · \<role 1\> · \<role 2\> · \<role 3\> |
| `kinds` | Which kinds of guide? (multi) | Role guides, one per role, by task (Recommended) · Getting started · Features and value · Admin and operations |
| `depth` | How deep should they go? | Every task, step by step (Recommended) · The main tasks only · A short tour of each screen |
| `whereRead` | Where will they be read? | In the repo and on a wiki (Recommended: /user-guides:wiki-guides publishes them) · In the repo only · As HTML files · On a wiki only |

More than three roles: offer the three with the most screens and let Other name the rest.
"Admin and operations" is recommended too when recon found an admin role or settings only
some roles reach.

## Round 2: words, pictures, facts, folder

| Id | Ask | Options |
|---|---|---|
| `languageTone` | Which language and tone? | \<detected language\>, plain and direct (Recommended: the app's own words) · UK English, plain and direct · US English, plain and direct · Formal |
| `pictures` | Pictures? | Placeholders now, screenshots later (Recommended: /user-guides:wiki-guides takes them) · No pictures |
| `facts` | How should the guides' facts be checked? | Walk the local app as each role (Recommended) · From the code only (every claim is listed as not checked) |
| `folder` | Where should the guides go? | docs/user-guides/ (Recommended) · \<an existing docs folder recon found\> · Next to the existing guides in \<folder\> |

The detected language is named in words (UK English, US English, German, …), from the app's
`lang` or locale files. When it is UK or US English, that option is the first one and
Recommended, and is not repeated; the others follow in order. Every folder is in the app's own
repo, from its root. When recon found neither a docs folder nor existing guides, the second
option is "Another folder in this repo" (the user names it). The third option is only for
guides recon found; with none (a docs folder that holds developer docs only), leave it out.

Round 1's answers are recorded before the folder is asked, so they go in `guides.json` in the
default folder. If Round 2 picks another folder, move the file there (with `git mv` if it is
tracked) before recording Round 2.

### Round 2a: running the app (only what recon left open)

At most three questions. A value recon found is
still asked once, as the Recommended option, so the user confirms it; a value recon could not
find is asked with the options it can offer.

| Id | Ask | Options |
|---|---|---|
| `appBaseUrl` | Where does the local app run? | \<URL recon found\> (Recommended) · It isn't running: you may start it with \<start command\> · Use the code only |
| `appSignIn` | How should each role sign in? | \<the sign-in kind recon found, e.g. a helper that prints a session cookie\> (Recommended) · I sign in by hand once per role (saved, mode 600, git-ignored) · A sign-in form, with synthetic credentials from environment variables · No sign-in |
| `appReset` | May the walk reset the seed data first? It wipes what the synthetic accounts have changed. | No, walk the data as it is (Recommended) · Yes, run \<reset command\> |

A running URL is Recommended only when recon found the synthetic accounts that app's data holds
(its seed, or a test setup that signs them in). With no URL found, or a running app whose data may
not hold them (one used for real work, or not seeded), "It isn't running: you may start it with
\<start command\>" comes first and is Recommended, and a running URL follows it.

When recon found several synthetic accounts for one role (a test user and a demo user with tidier
data, say), the `appSignIn` Recommended option's description names the account proposed for each
role (`user = demo.user, admin = test-admin`), so the answer settles `app.accounts` too. Prefer
the account whose data reads best in a picture.

## Round 3: the guide set

After the walk. Show the proposed set as a table (guide, kind, for whom, file) and each guide's
outline (its headings, `guide-types.md`), then ask:

| Id | Ask | Options |
|---|---|---|
| `approval` | Write these guides with these outlines? | Approve as proposed (Recommended) · I have notes |

"I have notes" → turn the notes into a numbered list, change the proposal, and ask again: **at
most three loops**, then write what was last proposed and say which notes are still open.
`approval` holds the final answer; earlier notes go in `approvalNotes` (a list, word for word).

A recorded `"approval": "approve as proposed"` (R9) counts as given: a headless run with it
writes without asking. On approval, each guide is registered at `outlined` and its outline is
saved as the guide file's heading skeleton, so a later session can write it guide by guide.

## Adopt: one round

For guides written without this skill (`/user-guides:write-guides adopt`), instead of Rounds
1–3:

| Id | Ask | Options |
|---|---|---|
| `adoptFiles` | Which files are the guides? (multi) | \<the guide-like markdown files recon found, by folder\> |
| `adoptTypes` | Who is each one for, and what kind is it? | As proposed: \<file → kind, roles\> (Recommended) · I have changes |
| `adoptImages` | Where are their images? | \<the folder their images are in\> (Recommended) · They have none |
| `adoptPages` | Are they on a wiki already? | No · Yes: I'll give each guide's page id (Other) |

Then `refresh.md` › Adopt.

## Skip rules

- **Arguments** answer their questions, as `id=value` pairs (lists comma-separated):
  `readers=employee,manager kinds=role-guide,getting-started depth=every-task
  where=repo+wiki language=en-GB pictures=placeholders facts=walk folder=docs/user-guides`.
  `approve` alone records `approval: approve as proposed`.
  Short values: `depth` every-task · main-tasks · tour; `where` repo+wiki · repo · html · wiki;
  `pictures` placeholders · none; `facts` walk · code; `kinds` role-guide · getting-started ·
  features-and-value · admin-operations.
- **Answers already in `guides.json`** are not asked again. A round whose questions are all
  settled is skipped, and you say which answers you used.
- Round 2a is skipped when `guides.json` or the arguments already hold the app's base URL,
  sign-in and accounts, and the reset answer; recon finding them is not enough (they are confirmed).

## How answers map to files

| Answer | Goes to |
|---|---|
| every answer | `interview.answers.<id>`, word for word; `interview.wordingVersion` "2" |
| `readers` | the roles in `app.accounts`; each guide's `audience` |
| `kinds`, `depth` | the proposed guide set (`guide-types.md`) |
| `languageTone` | `product.language` (`en-GB`, `en-US`, …); the register (`style.md`) |
| `pictures` | placeholders and `shots[]`, or none |
| `facts` | walk, or the code path (`walking.md` › No app) |
| `folder` | where `guides.json`, the guides, `images/` and the `README.md` index go |
| `appBaseUrl`, `appSignIn`, `appReset` | `app.baseUrl`, `app.signIn`, `app.reset` |
| `approval` | the guides at `outlined`, each file's heading skeleton |
| `adopt*` | `refresh.md` › Adopt |

## Headless runs

A run without AskUserQuestion (`claude -p`) never guesses. When the next round has an unsettled
question, print the round in this form and **stop**, before recon, walking or writing anything:

```
/user-guides:write-guides needs your answers before it can go on. Round 1 of 3: readers and kinds

1. Who will read these guides? (one or more)
   a) Every role (Recommended: a guide each)  b) Name the roles, e.g. employee,manager
2. Which kinds of guide? (one or more)
   a) Role guides, one per role, by task (Recommended)  b) Getting started
   c) Features and value  d) Admin and operations
3. How deep should they go?
   a) Every task, step by step (Recommended)  b) The main tasks only  c) A short tour of each screen
4. Where will they be read?
   a) In the repo and on a wiki (Recommended)  b) In the repo only  c) As HTML files  d) On a wiki only

Run /user-guides:write-guides in an interactive session, or answer with arguments, e.g.
/user-guides:write-guides readers=all kinds=role-guide depth=every-task where=repo+wiki
```

- Show every unsettled question of the round, in the order above, and list the settled ones
  as settled (with the answer used).
- Options that come from recon are written generically (`Every role`, `Name the roles`).
  `readers=all` means every role recon finds.
- Round 3 headless: with no recorded `approval`, print the proposed set and outlines, then
  the question, and stop; `approve` as an argument, or `"approval": "approve as proposed"` in
  `guides.json`, settles it.
- Headless runs also never start or reset the app or install Playwright (`walking.md`).
