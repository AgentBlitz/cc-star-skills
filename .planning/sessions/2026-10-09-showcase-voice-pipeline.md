# Session: showcase S6 — the voice pipeline and audition

**Date:** 2026-10-09
**Branch:** main
**Roadmap:** `.planning/showcase-plugin`
**Runtime:** `sonnet/high (autopilot attempt 1)`

## Summary

Ran Session 6 of the showcase plugin roadmap: every tour sentence can now be voiced through one portable pipeline. The OpenRouter, `say` and fake providers were ported from gods-eye into `toolkit/voice/` behind `TtsRequest`/`TtsResult`, with the four planned fixes: three requests really in flight, post-processing settings in the staleness key (they are part of each clip's file name), retries on network errors and timeouts as well as 429 and 5xx with `Retry-After`, and the working audio format remembered per model. The pipeline applies the lexicon, synthesises, trims, normalises to −16 LUFS, limits, resamples to 24 kHz mono, encodes MP3 at 64k and writes a sorted, timestamp-free manifest. `showcase voice <tour>` has `--draft --final --check --yes --max-chars --redo --prune --dry-run --audition`, a pacing table, and `voices --list` shows the public catalogue without a key. The gate passed on everything that can run without the key: 192/192 tests, typecheck over four projects, plugin validate. The one gate item that could not run is the live audition, because `OPENROUTER_API_KEY` is unset; that is recorded as skipped. The audition's code path is covered with a mocked fetch, and without the key it wrote the page with the draft voice only.

## Changes

- `plugins/showcase/toolkit/voice/types.ts`, `pool.ts`, `lexicon.ts`, `keys.ts` — new: provider types, the three-at-a-time pool, the single-pass lexicon, `synthKey`/`fileKey`/`POST`.
- `plugins/showcase/toolkit/voice/tts/{openrouter,say,fake}.ts` — new providers; OpenRouter holds the retries, the format chain and memory, and is the only sender of the key.
- `plugins/showcase/toolkit/voice/audio.ts` — new: `requireFfmpeg`, `processClip`, `encodeMp3`, `measureLufs` and the probes (async).
- `plugins/showcase/toolkit/voice/manifest.ts`, `setup.ts`, `pipeline.ts` — new: the per-tour manifest, who speaks (narrator, draft, key), `plan`/`run`/`pacing`.
- `plugins/showcase/toolkit/voice/audition.ts`, `catalogue.ts` — new: the British shortlist, sample picking within the budget, the HTML page, the public catalogue.
- `plugins/showcase/toolkit/commands/voice.ts`, `voices.ts`; `cli.ts` registers them.
- `plugins/showcase/toolkit/host/project.ts` — `voiceFor` looks for `<voice.dir>/<tour>.manifest.json` first, then a hand-made `manifest.json`.
- `plugins/showcase/skills/showcase/reference/voice.md` — new reference doc.
- `plugins/showcase/toolkit/test/voice/{openrouter,lexicon,catalogue,pipeline,audition}.test.ts`, `test/voice-cli.test.ts` — 35 new tests (192 in all).
- `.planning/showcase-plugin/PLAN.md` — status line, §2.10 manifest name, Session 5 manifest lookup, Session 6 "As built".
- `.planning/showcase-plugin/TRACKER.md` — row 6 ✅, the session-log entry, the key's open item.

## Decisions & Rationale

- The manifest is one file per tour, `<tour>.manifest.json`, because the runtime's manifest shape holds one tour while tours share a clips directory. It extends the runtime's fields without changing them, so `protocol.ts`, the bundle and its stamp are untouched.
- A clip is fresh only when both the synth key and the expected file name match, and the file name includes the post settings. That is how a changed setting makes everything stale and re-processes from the raw cache without spending.
- `--max-chars` caps the characters sent in a whole run (the Compass check was per sentence), which is what actually bounds the cost.
- A plain run keeps clips that are already current even when the key is absent, so a committed film can be re-rendered without it; only missing or stale sentences get a draft voice, with a warning.
- A 401, 403 or 402 stops the queue, so a bad key or an empty account spends nothing more. Their bodies are never read.
- No narrator is configured by default; it is chosen from the audition and written to `voice.narrator`.
- The live audition was skipped, not faked: the unset key was recorded and the item stays open.

## Remaining Work

- `OPENROUTER_API_KEY` in the user file is still open. Once it is set, run `showcase voice <tour> --audition --yes` on the fixture tour (within 1,500 characters) to complete the audition gate. Session 12's final voice needs it too.
- `check` doesn't yet report voice currency (PLAN §2.2 lists it); `voice --check` does. Session 8's verify is the natural place to join them.
- The draft (`say`) voice runs fast on short lines, so pacing warnings on a draft are a guide only.

## Resumption Context

Key files to review when picking this up:
- `plugins/showcase/toolkit/voice/pipeline.ts` (`plan`, `run`, `pacing`), `voice/manifest.ts`, `voice/tts/openrouter.ts`
- `plugins/showcase/toolkit/host/project.ts` (`voiceFor`)
- `plugins/showcase/skills/showcase/reference/voice.md`
- `.planning/showcase-plugin/PLAN.md` §5 Session 6 "As built"

Suggested opening prompt for next session:
> "Run /session .planning/showcase-plugin — Session 7 (F3, film I: capture and video). Clips and the manifest come from `showcase voice <tour>`; `voiceFor` in host/project.ts finds `<voice.dir>/<tour>.manifest.json`."
