# Session: platform-audit S6, the skill text

**Date:** 2026-11-27
**Branch:** main
**Roadmap:** `.planning/platform-audit`
**Runtime:** `fable/high (autopilot attempt 1)`

## Summary

Session 6 of the platform-audit roadmap wrote the skill itself: `SKILL.md` (117 lines) and its six reference
files, in the house style of `write-guides`. SKILL.md carries the frontmatter, the `$S` line, the route table,
the Never list word for word from PLAN §2.2, steps 0–7 and the headless rule; the reference files hold the
interview (wording version 1), the ground rules with a reason for each, the code inventory with its in-page
fallback, the walk, the report and the final check. A new `test/skill-lint.test.mjs` (12 tests) lints the text
and runs the fallback's page snippets in a stand-in page. One script changed: `inventory.mjs` gained `join`,
which the fallback needed. The plugin is at 0.9.0. The gate passed: `npm test` 87/87, `claude plugin validate`
passes, and genericity is clean over 69 plugin files and the lines added under `.planning/`.

## Changes

- `plugins/audit/skills/platform-audit/SKILL.md`: the stub replaced. Description that triggers on auditing or
  mapping a platform from a URL and turns away SEO, performance, accessibility, security and code audits,
  scraping, user guides and product films; `argument-hint`; `allowed-tools`; `disable-model-invocation` removed.
- `plugins/audit/skills/platform-audit/reference/interview.md`: Rounds 1 and 2 word for word, the skip rules
  and short values, what each answer decides, and the two headless forms.
- `plugins/audit/skills/platform-audit/reference/ground-rules.md`: read-only and the never-click list with
  reasons, the probe's guard (every refusal reason), the interaction levels, pacing and the 429 rule, privacy
  and Chrome's query-string filter, context hygiene, sign-in, Claude in Chrome only.
- `plugins/audit/skills/platform-audit/reference/code-inventory.md`: the download, what a refusal is and why
  it is never worked around, the in-page fallback (three snippets and `join`), each query command and when to
  use it, the Checklist, reconciling a screen with the code, and what the reader misses.
- `plugins/audit/skills/platform-audit/reference/walking.md`: the probe's methods and its loader, recon, the
  walk order, one screen step by step, opening controls, forms, exports, tabs, detail pages, the shell, hidden
  routes by answer, writing as you go, resuming, another role.
- `plugins/audit/skills/platform-audit/reference/writing.md`: the sections and when each is written, route
  statuses, evidence tags and the three keys, the requirements check and renumbering, the capability matrix,
  limits and reference lists, both appendices with `label-map.json`, the executive summary, style, and the
  "Written for:" line.
- `plugins/audit/skills/platform-audit/reference/checking.md`: each `check-audit` finding and its fix, the
  `check` route alone, what the script can't check, closing the tab and removing the probe, the final message.
- `plugins/audit/skills/platform-audit/scripts/inventory.mjs`: new `join <parts-dir> --sums '<list>' --out
  <inventory.json>` subcommand, with its help text.
- `plugins/audit/test/skill-lint.test.mjs`: 12 tests (below).
- `plugins/audit/.claude-plugin/plugin.json`: version 0.9.0.
- `.planning/platform-audit/PLAN.md`: the status line; §2.2 frontmatter note; §2.3 headless `folder` and
  `role`; §2.6 `join`; D4 and D6 additions.
- `.planning/platform-audit/TRACKER.md`: row 6 done, session-log entry.

## Decisions & Rationale

- **The contracts were checked against the docs, not with `claude-code-guide`.** That agent isn't offered in
  this run, so a fetch agent read the current Claude Code docs (skills, plugins reference, permissions).
  `argument-hint` and `allowed-tools` are honoured; `allowed-tools` grants for the invoking turn and restricts
  nothing; `${CLAUDE_SKILL_DIR}` is filled in for plugin skills. The docs don't say whether a skill's
  `allowed-tools` takes MCP names. `mcp__claude-in-chrome__*` is listed anyway, since it is the documented
  permission-rule form and an entry that isn't honoured only means a prompt.
- **Bash is allowed by pattern** (`node`, `mkdir`, `ls`, `date`), not whole as in user-guides. A `curl` is how
  a refused download would be worked around, so it should still ask.
- **Headless, `folder` and `role` take their defaults.** PLAN §2.3's example command answers five questions,
  and S7's eval and rehearsal use those five, so the two low-stakes ones are filled in and said aloud. The five
  that decide what is done on the platform are never filled in.
- **`inventory.mjs join` checks sums.** The fallback pages the inventory back as text that Claude must save by
  hand. A slice with a few characters lost inside a string still parses as JSON (the first test draft showed
  it), so `join` takes the page's list of lengths and sums and writes nothing unless every part matches.
- **The fallback strips query strings rather than encoding them.** Chrome's filter blocks them; the snippet
  removes them from every value, and a `strict` switch blanks `?`, `&`, `=` and `%` if a slice is still
  blocked. Non-ASCII text is sent as `\u` escapes so a slice is plain ASCII and can't split a character.
- **The fallback reads only scripts the page has loaded.** A lazy chunk for an unopened screen is not fetched;
  the text says to run it again at the end of the walk and to name unread chunks in the report's limits.
- **Each rule in the reference files comes with its reason**, as skill-creator's guidance asks, so the skill
  can judge cases the lists don't name. The guard is described as a net, not a licence.
- **The lint goes beyond the plan's five checks**: every `file › Section` pointer resolves to a heading; the
  references name every `inventory.mjs` command, every `check-audit` check and every guard reason; the loader
  in `walking.md` is the one in the probe's header; the cleanup snippet runs; and the fallback's snippets run
  in a vm stand-in page over the fixture's scripts and give the CLI's inventory back.
- Smaller choices (the pace drop after a 429, `try-two`, `look`, exports, `{toggle: true}`, `code=skip`,
  another role's slug) are listed in the tracker's session-log entry.

## Remaining Work

- S7 (opus / medium): the eval cases, the trigger set and `run.sh`, written but not run (D17); then the
  rehearsal on the fixture, following SKILL.md step by step.
- For S7 and S8 to watch:
  - the in-page fallback has run only in a stand-in page. Run it once on the fixture with `--forbid-assets`,
    to see that `javascript_tool` takes the 69 KB core and an `await (async…)()` snippet;
  - whether Chrome calls still prompt with this `allowed-tools` (S8);
  - the probe can't press a row link, so detail pages go through `find` and a `computer` click;
  - whether `javascript_tool` shows a returned slice raw or as a quoted string.
- S8, S9 and S10 are by hand.

## Resumption Context

Key files to review when picking this up:
- `.planning/platform-audit/PLAN.md` (§2.2, §2.3, §2.6, §5 Session 7)
- `.planning/platform-audit/TRACKER.md` (row 6's notes)
- `plugins/audit/skills/platform-audit/SKILL.md` and `reference/`
- `plugins/audit/test/skill-lint.test.mjs`
- `.planning/platform-audit/prompts/session-7.md`

Suggested opening prompt for next session:
> "Run `/planning:session .planning/platform-audit` to do Session 7 (evals, triggers and a rehearsal) at `/model opus`, `/effort medium`."
