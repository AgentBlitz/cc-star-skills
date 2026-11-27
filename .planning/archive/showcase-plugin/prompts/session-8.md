---
model: opus
effort: medium
rationale: "well-specified post chain with measured gates (LUFS, sync, SRT equality)"
---
Paste everything below into a fresh Claude Code session in the `cc-star-skills` repo, started with `claude --add-dir ~/_PRJ/gods-eye`. It has a runtime profile in the frontmatter above. Set it first with `/model opus` and `/effort medium` (autopilot applies it automatically).

---

# showcase plugin roadmap — Session 8 of 13: F4 · Film II: sound, captions, outputs and verify

> Prefer **`/session`**. It reads this file and handles the context, gate, tracker, commit and hand-off steps. Everything below is what it (or you) must do.

## Read first
1. `.planning/showcase-plugin/PLAN.md`: §1–§4 (D15, D19), §2.5 (the recorder: audio, captions, outputs, verify), §2.8 (the caption rules) and §5 Session 8.
2. `.planning/showcase-plugin/TRACKER.md`: confirm Session 7 is ✅, then mark row 8 🟡.
3. This plugin's `toolkit/film/*` (Session 7), `toolkit/voice/*` (Session 6, the manifest and clips) and `toolkit/runtime/src/narrative.ts` (caption wrapping).
4. The gods-eye reference, **read-only**: `~/_PRJ/gods-eye/.planning/showcase/PLAN.md` §5 Session 11 (sound, captions and the first cut).

## Objective
The first complete film: narration, captions, script, stills and a verification report.

## Do
1. **Sound:**
   - the mixdown in Node: decode each clip once (cached by file key) to 32-bit float at 48 kHz, place it at `sentence:start − t0`, sum, write a WAV;
   - two-pass loudnorm (−16 LUFS, true peak −1.5, LRA 11), then `aresample=48000`, because loudnorm outputs 192 kHz;
   - mux to AAC 192k with faststart;
   - chapters per beat (ffmetadata).
2. **Captions:**
   - an ASS file from the sentence timings: one sentence per cue, at most 2 × 42 characters, greedy wrapping;
   - in a bundled open-licence font in `toolkit/fonts/` (include its licence), through `fontsdir`;
   - burned in **after scaling**;
   - the SRT from the same timings.
3. **Outputs** in `showcase/out/<tour>/`:
   - `script.md`, timecoded;
   - a still per beat, and `contact-sheet.png` (ffmpeg `tile`);
   - `report.json` and `report.md`, with the verify list in PLAN §2.5.
4. **Flags and fixes:**
   - `--strict`, which fails on any warning;
   - `-draft.mp4` with a DRAFT watermark while the narrator is unapproved or the draft voice is used;
   - verify exempts a motion gap that starts at a `nav` load (S-D4 found no white flash with Playwright's defaults; a load shows as a held frame). Crossfades at `nav` stay a fallback, only if a real app flashes.
5. **A fixture beat that beeps and flashes together,** for measuring A/V sync.
6. **`skills/showcase/reference/film.md`.**

## Boundaries
- No camera, music or 4K (D19).
- gods-eye is read-only.

## Verification gate
- `film --strict` is green on the fixture tour, with both the fake and the `say` voice.
- The SRT cues equal the sentences.
- Caption and audio are within 50 ms, measured on the beep-and-flash beat.
- −16 ± 1 LUFS integrated, and true peak ≤ −1 dBTP.
- **Read back** `contact-sheet.png` and each still against its narration: does the screen show what the sentence says?
- `npm test` and `npm run typecheck` pass.

## Working rules
- PLAN.md is authoritative. If it and this file disagree, PLAN.md wins; log the discrepancy.
- Small choices, such as the font and caption styling: decide them and record them in the session-log entry.
- A shape-changing decision that PLAN.md doesn't settle: mark the row ⛔ `Needs decision: <question — options>` and stop.

## Finish
1. **Gate:** run every check above for real. If any fails:
   - set row 8 in `TRACKER.md` to ⛔ with a one-line blocker;
   - write the session summary;
   - commit;
   - **stop**.
2. **Record:**
   - Write the session summary to `.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/showcase-plugin` and the `Runtime:` it ran at.
   - In `TRACKER.md`:
     - set row 8 to ✅;
     - fill in Key artifacts, Verification and Notes (where the fixture film is: Session 9 shows it to the user);
     - append a session-log entry with `Runtime: opus/medium`.
   - Make one commit: `SKILLZ-01: Add sound, captions, outputs and verify to the film (showcase S8)`.
3. **Hand off:** print the kickoff prompt from `.planning/showcase-plugin/prompts/session-9.md` as a copy-pasteable blockquote, without its frontmatter. Note its profile (`/model opus`, `/effort high`). Tell the user Session 9 is a **by-hand review checkpoint**:
   - watch the fixture film (give its path);
   - try `showcase watch` on the fixture;
   - read `skills/showcase/reference/interview.md`;
   - then run Session 9 interactively, or add notes under TRACKER › Review notes › Look and feel.
