# The interview

What platform-audit asks, in what order, and what each answer decides. Wording version **1**: keep
the questions and options word for word, and write `Wording version: 1` under `progress.md` ›
Answers.

Ask in AskUserQuestion rounds: **at most four questions a round, the recommended option first**.
Words in angle brackets are filled from recon (`walking.md` › Recon); everything else is fixed.
Record each answer **word for word** in `progress.md` › Answers as soon as it is given, so an
interrupted run resumes without asking again.

The questions are asked, not assumed, because each one is the user's permission for something
done in their name on a platform they answer for: how far to click, whether to knock on doors
their account can't open, whether to copy the app's code, how fast to go.

## Round 1: what to check, and how far to go

Asked after recon, because its wording comes from what recon found.

| Id | Ask | Options |
|---|---|---|
| `checklist` | Is there a list of required fields or capabilities I should check \<product\> against? | No list — map everything (Recommended) · Yes — I'll share it (a file path, or paste it next) |
| `hidden` | The app's code defines \<n\> screens this account's menu doesn't show (\<names\>). How should I handle them? | Document them from code only (Recommended: avoids looking like access probing) · Try one or two by URL; if they open, visit the rest once each · Try each once by URL |
| `interact` | How far may I interact with screens? Either way I never save, submit, transfer, delete, upload, log out or change settings. | Open forms, never submit (Recommended) · Same, plus downloads (exports land in your Downloads folder and may hold real data) · Look only |
| `code` | To list every field, even on empty screens, I'd read the app's public JavaScript (\<file\>, about \<size\>). How should I get it? | Download it to the work folder (Recommended: read as text, never run) · Read it in the browser only (slower; nothing saved) · Skip the code (screens only) |

When the peek found no hidden screens, or couldn't run, `hidden` asks instead: "If the app's code
defines screens this account's menu doesn't show, how should I handle them?", with the same
options.

Filling the brackets:
- \<product\> is the product's name as its own screens write it.
- \<n\> is the length of `peek()`'s `hidden` list. \<names\> are up to five of them, written from
  the routes' own words (`/admin/audit-log` → "Admin audit log"), then "and \<n\> more".
- \<file\> is the main script's file name, and \<size\> the total of `peek()`'s `files`, in KB or MB.

"Yes — I'll share it": ask next, in plain text, for the file's path or the pasted list. Save a
pasted list as `.platform-audit/<slug>/requirements.md`, and record the path as the answer.

## Round 2: pace and place

| Id | Ask | Options |
|---|---|---|
| `pace` | How slowly should I go? Platforms like this often limit how fast you can load data. | About 20 s after each page or data load (Recommended for live systems) · About 10 s · About 5 s (test or staging systems only) |
| `folder` | Where should the audit go? | docs/\<slug\>-audit/ (Recommended) · Another folder in this repo |
| `role` | Which role does this account have? Asked only when recon couldn't tell. | \<the role recon suggests\> (Recommended) · Another role (type it) |

- \<slug\> is the product's name in kebab case, or the host's first label when the product has no
  name.
- "Another folder in this repo": the user names it. It stays inside the repo the skill runs in.
- `role` is left out of the round when recon could tell (a role name in the profile block or the
  account menu). When it is asked, the suggestion is recon's best reading, such as the role whose
  menu matches the one on screen.

## Skip rules

- **Arguments** answer their questions, as `id=value` pairs:
  - `checklist=none|<path>`;
  - `hidden=code|try-two|try-all`;
  - `interact=open-forms|downloads|look`;
  - `code=download|browser|skip`;
  - `pace=20|10|5`;
  - `folder=<path>`;
  - `role=<name>`.

  The short values stand for the options in the order the tables list them. A value that is none
  of them is not an answer: ask the question (headless: print the round).
- **An answer already in `progress.md`** is not asked again. A round whose questions are all
  settled is skipped, and the run says which answers it used.
- **Headless**, `folder` and `role` are not asked. An unsettled `folder` is `docs/<slug>-audit/`,
  and an unsettled `role` is the role recon suggests, or "the signed-in account" when recon can't
  tell. The run says which it used. The other five are never filled in for the user: they decide
  what is done on the platform.

## What each answer decides

| Answer | In `progress.md` | Decides |
|---|---|---|
| every answer | › Answers: the id, the question as asked, the answer word for word (an argument is written as given, marked "argument") | |
| `checklist` | the path, or "none" | whether the report has a requirements check (`writing.md` › The requirements check) |
| `hidden` | | what happens to routes the menu doesn't show: 🔒 from code, or tried by URL (`walking.md` › Hidden routes) |
| `interact` | | what the walk may open (`ground-rules.md` › What each interaction level allows) |
| `code` | | the path through `code-inventory.md`: the download, the in-page reading, or none |
| `pace` | | the wait after every action that loads server data (`ground-rules.md` › Pacing) |
| `folder` | › Target, Report | where the report and its appendix go |
| `role` | › Target, Role | \<role\> in the report's headings and its "Who sees it" rows |

Two answers need a word to the user when they take effect:
- `code=browser` saves no copy of the scripts. The inventory made from them (routes, labels,
  operation names) is still written to the work folder, because the appendix and the final check
  are made from it. Say so when the reading starts.
- `interact=downloads` lets each export be pressed once. The files land in the user's Downloads
  folder and may hold real data, so they are never opened or read (`walking.md` › Exports).

## Headless runs

A run without AskUserQuestion (`claude -p`) never guesses. When `checklist`, `hidden`, `interact`
or `code` is unsettled, print Round 1 in this form and **stop**, before any Chrome call, recon or
download:

```
platform-audit needs your answers (Round 1 of 2)

1. checklist: Is there a list of required fields or capabilities I should check the platform against?
   a) No list — map everything (Recommended)                    checklist=none
   b) Yes — I'll share it (a file path)                         checklist=<path>
2. hidden: If the app's code defines screens this account's menu doesn't show, how should I handle them?
   a) Document them from code only (Recommended: avoids looking like access probing)   hidden=code
   b) Try one or two by URL; if they open, visit the rest once each                    hidden=try-two
   c) Try each once by URL                                                             hidden=try-all
3. interact: How far may I interact with screens? Either way I never save, submit, transfer, delete,
   upload, log out or change settings.
   a) Open forms, never submit (Recommended)                    interact=open-forms
   b) Same, plus downloads (exports land in your Downloads folder and may hold real data)   interact=downloads
   c) Look only                                                 interact=look
4. code: To list every field, even on empty screens, I'd read the app's public JavaScript. How should I get it?
   a) Download it to the work folder (Recommended: read as text, never run)   code=download
   b) Read it in the browser only (slower; nothing saved)       code=browser
   c) Skip the code (screens only)                              code=skip

Round 2 then needs pace: 20 (about 20 s after each page or data load; Recommended for live systems),
10, or 5 (test or staging systems only).

Run /audit:platform-audit in an interactive session, or answer with arguments, e.g.
/audit:platform-audit https://app.example.com checklist=none hidden=code interact=open-forms code=download pace=20
```

When Round 1 is settled and only `pace` is not, print Round 2 the same way and stop:

```
platform-audit needs your answers (Round 2 of 2)

1. pace: How slowly should I go? Platforms like this often limit how fast you can load data.
   a) About 20 s after each page or data load (Recommended for live systems)   pace=20
   b) About 10 s                                                pace=10
   c) About 5 s (test or staging systems only)                  pace=5

Settled: checklist=none, hidden=code, interact=open-forms, code=download.
Not asked in a headless run: folder (docs/<slug>-audit/ unless you give folder=<path>) and role
(what recon finds, unless you give role=<name>).

Answer with arguments, e.g.
/audit:platform-audit https://app.example.com checklist=none hidden=code interact=open-forms code=download pace=20
```

- The first line is exactly `platform-audit needs your answers (Round <n> of 2)`.
- Show every unsettled question of the round, in the order above, and list the settled ones as
  settled, with the answer used.
- There has been no recon, so the brackets are written generically, as above, and the example
  command carries the URL the user gave.
- With all five given, a headless run goes on to step 1. If Claude in Chrome is not connected, it
  says so and stops, having written nothing.
- Later in a headless run there is still nobody to ask. Where the method says to ask the user (a
  second 429, a sign-in page, a session that expired), write the resume point, say what happened,
  and stop.
