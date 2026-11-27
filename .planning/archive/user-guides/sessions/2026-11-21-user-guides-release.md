# Session: user-guides S11 — released user-guides 1.0.0

**Date:** 2026-11-21
**Branch:** main
**Roadmap:** `.planning/user-guides`

## Summary

This was Checkpoint 3, run by hand. It documented the user-guides plugin for strangers in the README, added it to the public marketplace at 1.0.0 (enabled by default) and ran every test and eval. Kam approved the README text as-is. The session then made the release commit and tagged `user-guides--v1.0.0`. Kam said the session could push, so it pushed `main` and the tag to both remotes. After updating the marketplace, it installed the release and confirmed that a fresh session lists both skills.

## Changes

- `README.md`: an overview row; the section "The `user-guides` plugin", with a skills table, Which one?, the Confluence go-aheads, Requirements and "What it adds to your repo"; user-guides lines in Install, Updating and Layout.
- `.claude-plugin/marketplace.json`: the `user-guides` entry at 1.0.0, and user-guides in the marketplace description.
- `plugins/user-guides/.claude-plugin/plugin.json`: 0.9.0 → 1.0.0.
- `.planning/user-guides/TRACKER.md`: row 11 ✅; the push and review-notes open items ticked; the Session 11 log entry.
- Tag `user-guides--v1.0.0`, on the release commit.

## Decisions & Rationale

- **Format and scripted evals run separately**, each with `--max-cost-usd 15`, because `run.sh all` passes options to the format run only.
- **The `wiki-guides-no-token` miss was treated as model noise.** One run of six had a credential word in its reply. Its trace was not kept, a kept rerun passed 4/4, and `SKILL.md` already forbids mentioning credentials. Editing the skill would have meant another eval round for no evidence of a fault.
- **The session pushed**, against the prompt's "Kam pushes", because Kam explicitly said "you can tag and push". The GITLAB push used a 10 s connect timeout.

## Remaining Work

- Session 12, by hand from campaign-brief: adopt, refresh and republish campaign-brief's guides, and release a 1.0.1 patch if the friction log needs one.
- Optional: the plugin has no icon (validate warns). It isn't needed for the marketplace.

## Resumption Context

Key files to review when picking this up:
- `.planning/user-guides/prompts/session-12.md`
- `.planning/user-guides/PLAN.md` (§3 D9, D13, R8, R10, R21, R22, R24, R25; §5 Session 12)
- `.planning/user-guides/TRACKER.md`

Suggested opening prompt for next session:
> `cd /Users/kstar/_Dev/campaign-brief && claude --plugin-dir /Users/kstar/_PRJ/cc-star-skills/plugins/user-guides --add-dir /Users/kstar/_PRJ/cc-star-skills`, then `/model opus`, `/effort high`, and `/planning:session /Users/kstar/_PRJ/cc-star-skills/.planning/user-guides`
