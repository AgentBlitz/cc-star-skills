# Film

How a tour becomes a finished, verified film: `showcase film <tour>` plays the tour in the real app, headless, captures every frame, and makes a narrated 1080p MP4 with burned-in captions, an SRT, a timecoded script, a still per beat, a contact sheet and a verification report.

## Before filming

1. `showcase check <tour>`: the tour is valid and its storyboard is fresh.
2. `showcase voice <tour>` (or `--draft`): every sentence has a clip. A sentence with no clip lasts its reading time and is silent, which `--strict` refuses.
3. `showcase rehearse <tour>`: the anchors hold and no deny-list text is on screen. The film's verify reads the last rehearse; with none, or one older than the tour, it warns.
4. Film the **production build**: `app.build` runs first (skip it with `--no-build`). A `start` that looks like a dev server is noted, because dev overlays and hot reloads show up in the video.
5. The app is deterministic: data pinned, clock fixed, third parties blocked (`showcase docs determinism`).

## The pipeline

```
app (own port, snapshot, reset, health) ─► headless Chromium at browser.scale, fixed clock
  ─► runtime in film mode ─► CDP screencast (JPEG q90, every frame) + events on the video's clock
  ─► 30 fps CFR schedule ─┬─► video.mp4               the picture: BT.601 full → BT.709 limited, x264 CRF 17
                          └─► <tour>[-draft].mp4      the same frames + ASS captions burned in after scaling
voice clips ─► mixed in Node at sentence:start − t0 ─► two-pass loudnorm (−16 LUFS, TP −1.5, LRA 11)
  ─► aresample 48 kHz stereo ─► AAC 192k ─► the master, with a chapter per beat and faststart
```

- **Sound:** each clip is decoded once to 32-bit float at 48 kHz and summed where its sentence starts. Loudnorm runs twice (measure, then apply) and then resamples, because it works at 192 kHz inside.
- **Captions:** one cue per sentence, at most 2 lines of 42 characters, wrapped greedily (the same rule as `check`'s T007). A voiced caption starts when its voice does: the sentence's start plus the clip's 30 ms lead. Burned in by ffmpeg's `ass` filter in the bundled font, **Atkinson Hyperlegible Bold** (`toolkit/fonts/`, SIL Open Font License), so macOS and Linux match: 46 px, white on a 60 %-opaque dark box, bottom centre. In-page captions are for Watch only.
- **The SRT** comes from the same timings as the burned-in captions.
- **Draft or final:** the film is `<tour>-draft.mp4`, with a DRAFT watermark top right, unless every sentence has a narrator clip and `voice.narrator.approved` is set. Then it's `<tour>.mp4`. Only one of the two is kept.

## Command

```
showcase film <tour> [--strict] [--video-only] [--in-app] [--detach] [--capture auto|main|worker]
                     [--keep-frames] [--out <dir>] [--base <url>] [--no-build] [--no-reset] [--json]
```

| Flag | Meaning |
|---|---|
| `--strict` | Any warning fails the film (exit 1) |
| `--video-only` | The picture and `timeline.json` only: no sound, captions, sidecars or verify |
| `--in-app` | Film the app's own vendored tour from `?showcase=<id>&showcaseMode=film`, injecting nothing (`showcase docs in-app`) |
| `--detach` | Run in the background (the Bash tool stops commands after 10 minutes); prints the pid, a log and `progress.json`. Poll `progress.json` until `phase` is `done` or `failed`, in one foreground loop: don't end the turn to wait |
| `--capture` | `auto` (default: the main thread, a worker on a raw CDP socket if the event loop lags), `main`, `worker` |
| `--keep-frames` | Keep the captured JPEGs in `out/<id>/.capture/` |
| `--out` | Where the outputs go (default `showcase/out/<id>/`). Rehearse writes there too: keep them together |
| `--base` | Film an app that's already running instead of `app.start` |
| `--no-build`, `--no-reset` | Skip `app.build`; skip `app.snapshot` and `app.reset` |

## Outputs (`showcase/out/<tour>/`)

| File | What |
|---|---|
| `<tour>.mp4` or `<tour>-draft.mp4` | The film: 1920×1080, CFR 30 fps, H.264 High, BT.709, AAC 192k 48 kHz stereo, chapters, captions |
| `video.mp4` | The picture alone (no captions, no sound) |
| `<tour>.srt` | The captions as a sidecar |
| `script.md` | The film as read: each beat's timecode, its sentences, spoken and held time |
| `stills/NN-<beat>.png` | A frame of the film just before each beat's last sentence ends |
| `contact-sheet.png` | The stills, four across |
| `timeline.json` | Every event on the video's clock, beat and sentence spans, capture statistics |
| `report.json`, `report.md` | The verify checks, loudness, captions against sound per sentence, the stills with their narration |
| `progress.json`, `film.log` | For `--detach` |

## Verify

Each check is ✓, ⚠ (a warning: fails only with `--strict`) or ✗ (a failure).

| Check | Rule | Level |
|---|---|---|
| size, cfr, codec, colour, frames, duration, keyframes, order | The picture is 1920×1080 CFR 30 fps H.264 High yuv420p BT.709, as long as the timeline, a keyframe at each beat | ✗ |
| sync-probe | The clock-sync flash lands 0–100 ms after the page's time | ✗ |
| motion-gap | No capture gap over 100 ms, except the held frame of a page load (`nav`) | ✗ |
| duration-target | Within `meta.length.targetSec` ± max(5 s, 10 %) | ⚠ |
| loudness, true-peak | −16 ± 1 LUFS integrated; true peak ≤ −1 dBTP, on the master | ⚠ |
| silence | No silence over 2.5 s between the first sound and the last | ⚠ |
| srt | One cue per sentence, in order, with the tour's text, ≤ 2 × 42, no overlaps, all before the end | ✗ |
| av-sync | Each caption that follows a blank shows within 50 ms of its sound (measured in the master: the caption band against the picture's, the sound's onset in its own audio) | ⚠ |
| voiced | Every sentence has its clip | ⚠ |
| audio, faststart, chapters | AAC 48 kHz stereo; `moov` before `mdat`; a chapter per beat | ✗ |
| deny-list | The last rehearse was clean (✗ if not; ⚠ if there's none, or it's older than the tour) | ✗ / ⚠ |

The camera (`camera` actions) is recorded in `timeline.json` and ignored in v1, as are music and 4K.

## Then read it back

The checks can't tell whether the film says the right thing. Read `contact-sheet.png`, then each still in `stills/` against the narration `report.md` lists beside it: **does the screen show what the sentence says?** A still that shows the wrong moment means a beat's actions and narration are out of step: move the sentence's `after`, add a `hold`, or split the beat, then film again. Fix pacing in the tour, never in post.

## Troubleshooting

| Symptom | Fix |
|---|---|
| ⚠ duration-target | The narration sets the length: rewrite sentences (see `script.md` and the `voice` pacing table), or change `meta.length.targetSec` if the target was wrong |
| ⚠ voiced | Run `showcase voice <tour>` |
| ⚠ deny-list: no rehearse | Run `showcase rehearse <tour>` (with the same `--out`, if any) |
| ✗ motion-gap | Something stalled the capture: close heavy apps; try `--capture worker`; check `timeline.json` › `capture.pageStalls` (the page itself stalled) |
| ⚠ silence | A long hold with nothing said: shorten the `hold`/`dwellMs`, or add a sentence |
| The renderer note says SwiftShader | No GPU: WebGL and canvases will be slow; set `browser.gpu: "required"` to refuse it |
