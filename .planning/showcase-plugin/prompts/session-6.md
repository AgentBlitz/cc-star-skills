---
model: sonnet
effort: high
rationale: "a port of the proven gods-eye pipeline with four known fixes; mocked-fetch and ffmpeg tests"
---
Paste everything below into a fresh Claude Code session in the `cc-star-skills` repo, started with `claude --add-dir ~/_PRJ/gods-eye`. It has a runtime profile in the frontmatter above. Set it first with `/model sonnet` and `/effort high` (autopilot applies it automatically).

---

# showcase plugin roadmap — Session 6 of 13: V1 · Voice

> Prefer **`/session`**. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Read first
1. `.planning/showcase-plugin/PLAN.md`: §1–§4 (D5, D6, C1, C5), §2.3 (keys), §2.4 (voice), and §5 Session 6.
2. `.planning/showcase-plugin/TRACKER.md`: confirm Session 5 is ✅, then mark row 6 🟡.
   - Check the key's open item with `bin/showcase keys status`. **Never** read the key file itself.
   - Without the key, the audition part of the gate is recorded as skipped and the item stays open.
3. The gods-eye reference, **read-only**:
   - `~/_PRJ/gods-eye/scripts/film/{voice,voices}.ts`;
   - `scripts/film/lib/{config,keys,status,audio,pool,ffmpeg}.ts` and `scripts/film/lib/tts/{types,openrouter,say,fake}.ts`;
   - `film/{voice,audition,lexicon}.json`;
   - `test/film/*.test.ts`;
   - `src/core/narration/{manifest,fingerprint}.ts`;
   - `.planning/sessions/2026-09-29-voice-pipeline.md` (the as-built notes, including Gemini's pcm-only answer).
4. This plugin's `toolkit/lib/{env,redact,child-env,ffmpeg}.ts` (Session 1) and `toolkit/runtime/src/narrative.ts` (Session 3).

## Objective
Every tour sentence gets narration audio from one portable pipeline, with an audition to choose the narrator.

## Do
1. **Providers.** Port the providers into `toolkit/voice/` (`tts/openrouter.ts`, `tts/say.ts`, `tts/fake.ts`) behind `TtsRequest` and `TtsResult`.
   - **OpenRouter:**
     - `POST https://openrouter.ai/api/v1/audio/speech`;
     - the catalogue from `GET /api/v1/models?output_modalities=speech` (`supported_voices`), without a key.
   - **The four fixes (PLAN §2.4):**
     1. Real concurrency: 3 requests in flight.
     2. Post-processing settings in the staleness key.
     3. Retries on network errors and timeouts, as well as 429 and 5xx, with backoff of 1, 3 and 9 s and `Retry-After` honoured.
     4. The working format from the wav → mp3 → pcm chain remembered per model.
   - 401 and 402 are never retried, and their bodies are never echoed.
   - **`say`:** an existence check; Daniel at 24 kHz WAVE by default; falls back to the fake off macOS, with a warning.
   - **The fake:** a sine tone, length characters ÷ 16 seconds.
2. **The pipeline:**
   - lexicon: longest key first, with letter boundaries;
   - the synth and file keys, including the post settings;
   - processing: trim, ebur128 measure, gain to −16 LUFS, `alimiter`, soxr at 24 kHz mono, 30 ms lead and 80 ms tail, MP3 at 64k, and the duration check;
   - the manifest: sorted, no timestamps, `spoken` stored when the lexicon changed the text;
   - status: missing, stale, draft or fresh.
3. **`voice <tour>`:**
   - flags: `--draft`, `--final`, `--check` (no network or key needed), `--yes` with `--max-chars` (default 20,000; refuse paid work without `--yes`), `--redo beat/n`, `--prune`, `--dry-run`;
   - `--audition`: an HTML page with three sample lines for each voice on the British shortlist in PLAN §2.4, plus the draft voice, written to `showcase/out/voices/index.html`;
   - a pacing table against the preset's narration window (warnings outside 120–185 wpm);
   - clips and the manifest written to `voice.dir`.
4. **`voices --list`:** the catalogue, without a key.
5. **`skills/showcase/reference/voice.md`.**

## Boundaries
- Playback exists already (Session 5). No film (Sessions 7–8).
- Never print, log or commit a key (C1). The key is read only through `toolkit/lib/env.ts` and sent only by `tts/openrouter.ts`.
- gods-eye is read-only.

## Verification gate
- The fake provider runs through real ffmpeg.
- Mocked-fetch tests cover: format memory; 429 with `Retry-After`; a network-error retry; 401 and 402 neither retried nor echoed; a canary key absent from every output.
- Draft clips measure mono, 24 kHz, −16 ± 1 LUFS (ebur128).
- Editing a sentence flips `--check` to missing; changing a post setting re-processes.
- If `keys status` shows the key: `voice --audition --yes` on the fixture tour stays within 1,500 characters and writes the page. Otherwise record the audition as skipped, pending the key.
- `npm test` and `npm run typecheck` pass.

## Working rules
- PLAN.md is authoritative. If it and this file disagree, PLAN.md wins; log the discrepancy.
- Small choices: decide them and record them in the session-log entry.
- A shape-changing decision that PLAN.md doesn't settle: mark the row ⛔ `Needs decision: <question — options>` and stop.

## Finish
1. **Gate:** run every check above for real. If any fails:
   - set row 6 in `TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit;
   - **stop**.
2. **Record:**
   - Write the session summary to `.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/showcase-plugin` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 6 to ✅;
     - fill in Key artifacts, Verification and Notes (which voices were auditioned, if any);
     - append a session-log entry with `Runtime: sonnet/high`;
     - update the key's open item.
   - Make one commit with no `.env*` files: `SKILLZ-01: Add the voice pipeline and audition (showcase S6)`.
3. **Hand off:** print the kickoff prompt from `.planning/showcase-plugin/prompts/session-7.md` as a copy-pasteable blockquote, without its frontmatter. Note its profile (`/model opus`, `/effort high`), or tell the user to run `/session`.
