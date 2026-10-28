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
app (own port, snapshot, health, reset, answering) ─► headless Chromium at browser.scale, fixed clock
  ─► runtime in film mode ─► CDP screencast (JPEG q90, every frame) + events on the video's clock
  ─► 30 fps CFR schedule ─┬─► video.mp4               the picture: BT.601 full → BT.709 limited, x264 CRF 17
                          └─► <tour>[-draft].mp4      the same frames + ASS captions burned in after scaling
voice clips ─► mixed in Node at sentence:start − t0 ─► two-pass loudnorm (−16 LUFS, TP −1.5, LRA 11)
  ─► aresample 48 kHz stereo ─► AAC 192k ─► the master, with a chapter per beat and faststart
```

- **Sound:** each clip is decoded once to 32-bit float at 48 kHz and summed where its sentence starts. A take's slices tile it, so sentences with no gate between them play back to back exactly as the take was read. Loudnorm runs twice (measure, then apply) and then resamples, because it works at 192 kHz inside.
- **Captions:** one cue per sentence, at most 2 lines of 42 characters, wrapped greedily (the same rule as `check`'s T007). A voiced caption starts when its voice does: the sentence's start plus the clip's **onset**. A clip cut from a take (manifest v2) records its own onset, the half pause it opens with (often 100–400 ms); any other clip's is the 30 ms lead. Each start then moves to the **nearest frame** (within 17 ms at 30 fps), never before the cue it follows ends, and the ASS start is rounded down to its centisecond, so the caption shows on that frame and not the next. Burned in by ffmpeg's `ass` filter in the bundled font, **Atkinson Hyperlegible Bold** (`toolkit/fonts/`, SIL Open Font License), so macOS and Linux match: 46 px, white on a 60 %-opaque dark box, bottom centre. In-page captions are for Watch only.
- **The SRT** comes from the same timings as the burned-in captions.
- **Before the tour opens**, the app must answer at its own URL after `app.reset` (any page but a server error, within 30 s), and `app.start` must not have failed. Otherwise the film stops there with the reason. Health can pass on an instance left from an earlier run while `app.start` is still starting the new one, so a start that recreates containers can be left half-done.
- **Draft or final:** the film is `<tour>-draft.mp4`, with a DRAFT watermark top right, unless every sentence has a narrator clip and `voice.narrator.approved` is set. Then it's `<tour>.mp4`. Only one of the two is kept.

## Cards

The title and closing cards (a beat's `card`, or a `card` action) are drawn by the overlay, so they look the same in the film, the storyboard stills, rehearsals and Watch. `film.cards` in `showcase/config.json` sets their look:

- `true` (the default) is showcase's own: a dark blue gradient, in the system font. It is exactly 1.0's look.
- A brand (1.1) draws the cards in the product's own look:

  ```json
  "cards": {
    "background": "#F6F7F9", "foreground": "#1C2333", "muted": "#5B6472", "accent": "#4A5D7A",
    "mark": "showcase/brand/mark.svg",
    "fonts": {
      "title":  { "family": "Fraunces",      "file": "apps/web/public/fonts/Fraunces-Variable.woff2" },
      "lines":  { "family": "Inter",         "file": "apps/web/public/fonts/Inter-Variable.woff2" },
      "kicker": { "family": "IBM Plex Mono", "file": "apps/web/public/fonts/IBMPlexMono-Medium.woff2" }
    }
  }
  ```

  - **Colours** are `#rrggbb`: `background`, `foreground` (the title), `muted` (the kicker and the lines) and `accent` (the mark).
  - **The mark** is an SVG file, drawn above the title in the accent. Only `svg`, `g`, `path`, `circle`, `line` and `polyline` survive, with geometry and presentation attributes; scripts, links, `href`, `style`, event handlers and any `url(…)` are dropped, and a paint other than `none` becomes the accent. A stroked icon on a 24 px grid (Lucide style) works well.
  - **Fonts** are woff2 files, each `{family, file}`, for the title, the lines and the kicker. Any role left out keeps the system font.
  - Paths are relative to the repo root and may not leave it. Everything is inlined into the page (the fonts as data URIs, the mark as SVG elements), so nothing is fetched.
- The order on a card is the mark, the title, the kicker (`card.kicker`, in capitals), then the lines.

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
| size, cfr, codec, colour, frames, duration, keyframes | The picture is 1920×1080 CFR 30 fps H.264 High yuv420p BT.709, as long as the timeline, a keyframe at each beat | ✗ |
| order | The events are in a valid order: armed, started, beats in index order with their sentences inside them, `seq` rising, time never going back within a page, one ending. The host stamps `nav` events when Chrome's message reaches it, a few ms after the page's events of that moment, so a host stamp and a page stamp may disagree by up to 15 ms. Two page stamps, or two host stamps, may not | ✗ |
| sync-probe | The clock-sync flash lands 0–100 ms after the page's time | ✗ |
| motion-gap | No capture gap over 100 ms, except the held frame of a page load (`nav`) | ✗ |
| duration-target | Within `meta.length.targetSec` ± max(5 s, 10 %) | ⚠ |
| loudness, true-peak | −16 ± 1 LUFS integrated; true peak ≤ −1 dBTP, on the master | ⚠ |
| silence | No silence over 2.5 s between the first sound and the last | ⚠ |
| srt | One cue per sentence, in order, with the tour's text, ≤ 2 × 42, no overlaps, all before the end | ✗ |
| av-sync | Each caption that follows a blank shows within 50 ms of its sound (measured in the master: the caption band against the picture's, and the speech's onset in its own audio, the first 10 ms above −35 dB, so the breath before a sentence isn't its sound; both looked for from the sentence's start plus its clip's onset, the sound from 100 ms before it) | ⚠ |
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
| ⚠ av-sync | Read `report.md`'s captions-against-sound table. Every row late by about the same amount points at the clips' onsets (re-cut the take: `showcase voice <tour>`); a few rows far out, at a sentence that starts softly or after a loud breath |
| ✗ order: "time went back" | Two events of the same page out of order, or a page event more than 15 ms from the host's `nav` stamp: a runtime or host bug, worth reporting with `timeline.json` |
| "the app isn't answering at … after app.reset" | Part of the app is down: check the app log (`out/<tour>/app.log`). With Docker Compose, a `start` that rebuilds or recreates containers while an old instance still answers health can leave one created but not started; `docker compose up -d --wait` brings it up |
| The renderer note says SwiftShader | No GPU: WebGL and canvases will be slow; set `browser.gpu: "required"` to refuse it |
