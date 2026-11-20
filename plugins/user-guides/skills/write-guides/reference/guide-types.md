# Guide types and the proposed set

Four kinds of guide in v1, each with a template in `templates/`. Anything else the user asks for
gets the closest template, and you say which one and why.

| Kind (`type`) | Template | One per | For | It answers |
|---|---|---|---|---|
| Role guide (`role-guide`) | `role-guide.md` | role | that role | "How do I do my job here?": the role's tasks, in the order they come up |
| Getting started (`getting-started`) | `getting-started.md` | product (or role, when first steps differ a lot) | everyone new | "What is this and how do I start?": signing in, finding your way, the first task |
| Features and value (`features-and-value`) | `features-and-value.md` | product | everyone, and people deciding whether to use it | "What does it do and why is it worth it?": by job, not by screen |
| Admin and operations (`admin-operations`) | `admin-operations.md` | product | the admin role, and whoever runs it | "How do I set it up and keep it right?": settings, people and access, what to do when something is wrong |

Closest-template rules: a "how-to" or "FAQ" → a role guide with one section per task or
question; a "tour" → getting started; a "what's new" → features and value, for the screens that
changed (a refresh is usually the better answer); "troubleshooting" → admin and operations ›
When something is wrong.

## Proposing the set (Round 3)

From the answers and the walk outline:

- **One guide per chosen kind and role**, as the table says. Ids are kebab-case and short: the
  role's name for a role guide (`manager`, `admin`), else the kind itself (`getting-started`,
  `features-and-value`, `admin-operations`), so a role guide and a kind's guide never share an id
  or a file.
- **Files** in the chosen folder: `<folder>/<id>.md`. The `README.md` index sits beside them,
  with `guides.json` and `images/`.
- **Titles** in the product's words: "Leave Planner for managers", "Getting started with
  Leave Planner".
- **Audience** is the roles it is for (empty for everyone).
- **Order and parent** (for the wiki): getting started first, then the role guides in the
  order of the roles' work, then features and value, then admin. `parent` is `""` unless a
  guide belongs under another.

## The outline

Each guide's outline is its headings, from its template's skeleton, filled from the walk:

- **Role guide:** "What you can do", then one numbered section per task, each named by what the
  person wants done ("1. Ask for time off", not "The Requests screen"), in the order the role
  meets them; a task per screen at most, often several. Then "If something goes wrong".
- **Getting started:** "Signing in", "Finding your way" (the navigation each role sees), "Your
  first \<thing\>", "Where to go next".
- **Features and value:** "What it replaces", then one section per job the product does, each
  with what it does and why it is worth having.
- **Admin and operations:** "People and access", "Settings", one section per thing an admin
  keeps right, "When something is wrong".

`depth` shapes it: **every task** gives every task its own numbered steps; **main tasks** keeps
the three to five tasks a role does most and lists the rest in one line each; **a short tour**
gives one short section per screen.

Show the outline as indented headings under each guide's title, and say which screens of the
walk each section covers, so the user can see nothing is missing. Screens no guide will cover
are proposed for `leftOut[]` with a reason.

## Saving an approved outline

For each approved guide:

1. `set-edit.mjs` `addGuide` (`{ id, type, file, title, audience, parent, order }`; it is
   added at `outlined`).
2. Write the file as its heading skeleton: the H1 title, then each heading of the outline, and
   under each a one-line HTML comment saying what goes there and which screens it covers
   (`<!-- covers /requests, /requests?new=1 -->`). Writing replaces the comments.
3. The first time, write `<folder>/README.md`: a title ("\<Product\> user guides"), one
   paragraph on what the guides are and who each is for, and a list of the guides with a line
   each. Then `node $S/guide-set.mjs index <guides.json> <folder>/README.md` adds the status
   block between its markers; run it again after every change of status.

A later session resumes from these files: an `outlined` guide is written next.
