# Session: Re-center `opus` effort for Opus 5.5 in /calibrate-roadmap (planning v1.8.0)

**Date:** 2026-09-27
**Branch:** main

## Summary

The user asked whether Anthropic's Opus 5.5 release meant the planning skills or `autopilot.sh` needed changes. Research (the `claude-api` skill's Opus 5.5 migration notes plus the installed Claude Code CLI 2.1.283) found that **nothing breaks**: the plugin only ever passes the aliases `sonnet`/`opus`/`fable`, `--model opus` now resolves to `claude-opus-5-5`, and every result-JSON field `autopilot.sh` parses is unchanged. But **one assumption had silently shifted: what an effort level buys on `opus`.** The `/calibrate-roadmap` rubric (v1.6.0, 2026-09-17) was written when `opus` meant Opus 5 and `high` was every alias's everyday level. On Opus 5.5 the default is `medium`, which matches or beats Opus 5 at `high` on multistep repo work in about half the tokens, and the same level thinks more per turn. So the rubric's `opus / high` ratings (design/debugging, and the "unsure" fallback) were buying more thinking than intended: longer runs and more usage, with no evidence of better results. After the user approved a plan, the rubric now reads the effort table one step lower on `opus`, the "unsure" default is `opus / medium`, and a new rule records that aliases survive model upgrades but effort calibration doesn't. `/roadmap` and the README match; the plugin is versioned 1.8.0 (not yet tagged or pushed). Verified with plugin validation, a live alias smoke test, two headless runs of the edited skill on throwaway roadmaps, and an autopilot dry run. `autopilot.sh` is untouched.

## Changes

- `plugins/planning/skills/calibrate-roadmap/SKILL.md`
  - §3 "Rate each pending session": new per-model note right after the effort table: **on `opus`, read the table one step lower** (`low` for the two mechanical rows, `medium` for design or debugging, `max` unchanged), then apply the modifiers. `sonnet` (Sonnet 5) and `fable` (Fable 5.1) use the table as written.
  - Modifiers: `Unsure → opus / high` → `Unsure → opus / medium` (Opus 5.5's own default, already stronger than what `opus / high` meant on Opus 5).
  - "When this runs → Standalone": new re-rate trigger, a model alias moved to a newer model since the roadmap was rated.
  - Rules, "Three models, four efforts": appended that **the effort scale doesn't survive upgrades**. When an alias moves, compare its effort levels with its predecessor's and update the per-model note.
- `plugins/planning/skills/roadmap/SKILL.md`: Rules (line 101) "when unsure, `opus / high`" → "`opus / medium`".
- `README.md`: "Calibrating a roadmap" (~lines 195–202) gains one sentence on `opus` reading the effort scale one step lower (with the Opus 5.5 vs Opus 5 comparison); the "when unsure" pick is now `opus / medium`.
- `plugins/planning/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`: planning 1.7.0 → 1.8.0.

## Decisions & Rationale

- **Re-center `opus` effort in the rubric, leave `autopilot.sh` alone** → the aliases already pick up Opus 5.5 (smoke test: `modelUsage` showed `claude-opus-5-5`), `--effort` still takes `low|medium|high|xhigh|max`, and the result-JSON fields `parse_run` reads (`subtype`, `num_turns`, `stop_reason`, `terminal_reason`, `permission_denials`, …) are all present on 2.1.283. The only thing that moved is what an effort level means on `opus`.
- **One step lower, but `max` stays `max`** → the evidence compares Opus 5.5 `medium` with Opus 5 `high` on repo work. It says nothing about the irreversible, wide-blast-radius tier that `max` is reserved for.
- **Existing `opus / high` examples left as they are** → worked check: "cross-cutting refactor across three modules with a manual gate" = opus → `medium`, +1 for the manual gate → `opus / high`. The `**Runtime:** opus / high` template in calibrate §5a and the README frontmatter example (README.md ~91–98) still hold.
- **Sonnet and fable rows unchanged** → those aliases didn't move (Sonnet 5, Fable 5.1), so `high` is still their everyday level. The model boundaries (sonnet = pattern-following, opus = judgement, fable = reasoning-bound) are unchanged too.
- **Escalation ladder unchanged** (own runtime → same model at `max` → next model at `max`) → a genuine stall is exactly the measured need `max` exists for. A re-centered session climbs `opus/medium → opus/max → fable/max`.
- **No refusal class in autopilot** → Opus 5.5's new `bio` refusal classifier is handled inside the CLI. 2.1.283 ships a refusal-fallback map (`bio`→`claude-opus-5`, `cyber`→`claude-opus-4-8`) and retries in-run, so a refusal shows up as an extra model in autopilot's `models=` log field rather than as a failed run. `reasoning_extraction` isn't retried, but no planning prompt asks the model to reproduce its reasoning (grepped).
- **`effort: max` kept on `/roadmap` and `/calibrate-roadmap` themselves** → they are one-off planning passes where depth pays. Revisit only if they feel slow on Opus 5.5.
- **Recorded as a rule plus a re-rate trigger, not just new numbers** → the alias rule used to imply that profiles were upgrade-proof. This upgrade showed they aren't, and the next alias move will need the same check.

## Remaining Work

1. **Release:** run `claude plugin tag plugins/planning` (creates `planning--v1.8.0`), then push `main` and `refs/tags/planning--v1.8.0` to both `origin` (GitHub) and `GITLAB`. `origin` already has every tag through `planning--v1.7.0`. `GITLAB`'s tag state wasn't checked because its host didn't resolve from the wrapup shell.
2. **Re-rate live roadmaps:** after `/plugin update planning@cc-star-skills`, re-run `/calibrate-roadmap` on any roadmap that still has pending sessions (the v1.6.0 log named collabmd `desktop-coordinator` and pokeriment). Their `opus` profiles were calibrated for Opus 5 and will over-spend on Opus 5.5.
3. **Watch:** if `/roadmap` or `/calibrate-roadmap` (both `effort: max` in their frontmatter) feel slow on Opus 5.5, consider lowering them.
4. Carried over from v1.6.0: auto-resume of yielded/needs-human autopilot runs; `stream-json` + `compact_boundary` counting for a "too big, split it" hint; a `--max-budget-usd` passthrough.

## Resumption Context

Key files to review when picking this up:
- `plugins/planning/skills/calibrate-roadmap/SKILL.md`: §3 (the effort table, the "On `opus`…" note below it, the modifiers) and the Rules section
- `plugins/planning/skills/roadmap/SKILL.md` (Rules)
- `README.md`: "Calibrating a roadmap"
- The approved plan: `~/.claude/plans/anthropic-just-release-opus-iridescent-mist.md`
- Source of the Opus 5.5 effort guidance: the `claude-api` skill's `shared/model-migration.md` (Opus 5.5 section), bundled with Claude Code 2.1.283

How it was verified (scratch-only, about $2 of usage; the fixtures lived in the session scratchpad and are not kept):
- `claude plugin validate plugins/planning` passed.
- Alias smoke test: `claude -p "Reply with the single word OK." --model opus --output-format json` listed `modelUsage` keys `claude-opus-5-5` and `claude-haiku-4-5-20251001` (Claude Code's background helper), and every field `parse_run` reads was present.
- The edited skill ran headless via `--plugin-dir plugins/planning` on two throwaway roadmaps. The run transcript showed `Base directory for this skill: …/cc-star-skills/plugins/planning/skills/calibrate-roadmap` and the new rubric text, so the edited copy was the one loaded.
  - 6-session "notes-cli sync" fixture: sonnet/low (scaffold), **opus/high** (tag-index design with a weak gate; the old rubric would have given `opus / max`), fable/high (race in a flaky test), fable/max twice (OAuth refresh; automatic migration of source-of-truth notes), sonnet/medium (docs). The fixture's prompt headlines were off by one (a slip in writing the fixture). The skill flagged the mismatch without editing prompt bodies, as its rules require.
  - 3-session "notes-cli fixes" fixture: **opus/medium** (root-causing a date bug; the old rubric gave `opus / high`), sonnet/low (`--json` mirroring `show --json`), opus/high (a config-loader merge whose gate misses its main risk).
- `autopilot.sh --plan .planning/demo --dry-run` with `model: opus` / `effort: medium` frontmatter printed `resolved runtime for session 1: model=opus effort=medium (source: frontmatter …)` and the ladder `opus/medium → opus/max → fable/max`.

Outside the repo, the auto-memory note `headless-plugin-skills.md` (and its `MEMORY.md` index line) gained the 2.1.283 findings: `opus`→`claude-opus-5-5`; `modelUsage` can include a haiku helper; the CLI-side refusal-fallback map; and the `Base directory for this skill:` transcript line as proof that an edited `--plugin-dir` copy ran.

Suggested opening prompt for next session:
> "Planning v1.8.0 re-centered `opus` effort for Opus 5.5 in /calibrate-roadmap. Read .planning/sessions/2026-09-27-recenter-opus-effort.md. Tag the release with `claude plugin tag plugins/planning`, push main and `planning--v1.8.0` to origin and GITLAB, then help me re-run /calibrate-roadmap on the live roadmaps that still have pending sessions."
