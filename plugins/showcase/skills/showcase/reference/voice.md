# Voice

How a tour's narration becomes audio: `showcase voice <tour>` voices every sentence through one pipeline, and `--audition` helps the user choose the narrator by ear. Drafts cost nothing; the narrator costs a few cents a minute through OpenRouter.

## The pipeline

```
tour sentence ─► lexicon ─► TTS (OpenRouter | say | fake) ─► raw cache
              ─► trim ─► ebur128 measure ─► gain to −16 LUFS ─► alimiter ─► soxr 24 kHz mono
              ─► 30 ms lead, 80 ms tail ─► MP3 64k ─► <voice.dir>/<hash>.mp3 + <tour>.manifest.json
```

- **Lexicon:** `voice.lexicon` in `showcase/config.json` maps written → spoken (`"W39": "week thirty-nine"`). Longest key first; word keys match only at a letter boundary (`pp` changes `4pp`, not `approve`). Captions keep the written text.
- **Processing:** the chain above, with a duration check (the MP3 may not drift more than 50 ms from the WAV). The settings are fixed; they are part of every clip's file name, so changing one re-processes everything from the raw cache without new spend.
- **Clips** are named by hash (`864a38ac24d17b34.mp3`), so tours can share one `voice.dir`.

## Voices

| Voice | What | Cost | Needs |
|---|---|---|---|
| **Narrator** | An OpenRouter speech model, `voice.narrator {model, voice, instructions?, speed?, approved}` | Paid; `--yes` required | `OPENROUTER_API_KEY` |
| **Draft** | macOS `say` (Daniel, 24 kHz) | Free | macOS. Off macOS, or without `say`, a fake tone is used, with a warning |
| **Fake** | A sine tone, length = characters ÷ 16 seconds | Free | ffmpeg; for tests |

- `SHOWCASE_TTS_MODEL`, `SHOWCASE_TTS_VOICE`, `SHOWCASE_TTS_INSTRUCTIONS` and `SHOWCASE_TTS_SPEED` override the narrator for one run (process environment, an ignored `.env.local`, or the user key file).
- `voice.draft` is `{provider: "say" | "fake", voice?}`.
- Never ask the user for the key in chat. They run `showcase keys set` in their own terminal. `showcase keys status` shows whether it is set, never its value.

## Commands

```
showcase voice <tour> [--draft | --final] [--check] [--yes] [--max-chars <n>]
                      [--redo <beat/n>] [--prune] [--dry-run] [--audition] [--json]
showcase voices --list [--model <id>]
```

| Flag | Meaning |
|---|---|
| (none) | The narrator if one is configured and the key is set; otherwise the draft voice. Clips that are already current are kept, even narrator clips when the key is absent |
| `--draft` | Draft voice only, whatever is configured |
| `--final` | Narrator only. Fails if there is no narrator or no key, and `--check --final` fails on any draft clip |
| `--check` | Report `missing`, `stale`, `draft` or `fresh` per sentence. **No network, key or ffmpeg.** Exit 1 if anything is missing or stale |
| `--yes` | Allow the paid calls. Without it, a run that needs them is refused and says how many sentences and characters |
| `--max-chars` | Cap on characters sent to OpenRouter in one run (default `voice.maxChars`, else 20,000). Refused over the cap even with `--yes` |
| `--redo beat/n` | Voice sentence `n` (from 0) of a beat again, as a new take |
| `--prune` | Delete clips no manifest in the voice dir points to (refused if a manifest is unreadable) |
| `--dry-run` | Say what would be voiced; change nothing |
| `--audition` | Write `showcase/out/voices/index.html`, see below |

### Status

A sentence is **fresh** when its manifest clip's synth key *and* file name match what the pipeline would make now. The synth key covers the spoken text, provider, model, voice, instructions, speed and take. The file name also covers the post-processing settings.

- **missing:** no clip for this exact text in this beat (a new or edited sentence), or the file is gone.
- **stale:** a clip exists, but the voice, the lexicon, the take or a post setting changed since.
- **draft:** current, but spoken by the draft voice.
- **fresh:** current, spoken by the narrator.

Editing a sentence's text flips it to `missing`; editing the lexicon flips the sentences it touches to `stale`.

### The pacing table

`voice` prints one row per sentence (words, seconds, words a minute) and the total against the preset's narration window.

- It warns outside **120–185 wpm** (sentences under four words aren't judged) and outside the window.
- A `~` means the duration is the reading-time estimate, because there is no clip yet.
- If the narration is outside its window, **rewrite the text**. Never speed up the voice.
- The draft voice runs faster than a human narrator. Treat its pacing as a guide and judge the pace again once the narrator is voiced.

## The manifest

`<voice.dir>/<tour-id>.manifest.json`, which Watch and the film read (`voiceFor` also accepts a hand-made `manifest.json` for the same tour).

```json
{
  "clips": [
    { "beat": "open", "durationMs": 4058, "file": "864a38ac24d17b34.mp3", "hash": "864a38ac24d17b34",
      "n": 0, "spoken": "…", "synth": "…", "take": 0, "text": "…", "voice": "draft" }
  ],
  "id": "<narration fingerprint>", "narrationMs": 28300, "post": { … }, "tour": "fixture-tour", "v": 1, "voices": { … }
}
```

Keys are sorted and nothing is timestamped, so a re-run that changes nothing changes no bytes. `spoken` appears only when the lexicon changed the text. Clips are in tour order, one per distinct beat and text. The manifest is written only when every sentence has a clip.

## The audition

`showcase voice <tour> --audition [--yes] [--max-chars <n>]` writes a page with three sample lines for each voice on the British shortlist, plus the draft voice, and nothing else changes.

| Model | Voices |
|---|---|
| `elevenlabs/eleven-v3` | george, daniel, alice, lily |
| `microsoft/mai-voice-2.1` | en-GB-Harry, en-GB-Emily |
| `google/gemini-3.8-flash-tts` | Charon, Orus, Kore |

- The lines are the tour's opening, its line with the most figures and its closing. If they would push the cost over the budget (**1,500 characters** by default, across all voices), the shortest lines that fit are used.
- With the key, `--yes` is required, because it is paid (a few cents). Without the key the page still gets the draft voice, and each other voice is marked skipped.
- Shortlisted voices the live catalogue no longer offers are skipped, unspent. `showcase voices --list` shows what is offered, with no key.
- The raw audio is cached, so rerunning the audition costs nothing.
- Afterwards the user chooses by ear. Put the chosen `model` and `voice` in `voice.narrator` in `showcase/config.json` and set `approved` to the date once they sign it off (Round 5 of the interview), then run `showcase voice <tour> --final --yes`.

## OpenRouter details

- `POST https://openrouter.ai/api/v1/audio/speech`; the catalogue is `GET /api/v1/models?output_modalities=speech` (public).
- Three requests run at a time.
- **Format chain:** wav → mp3 → pcm. A 400 that names the format moves to the next one; the one that works is remembered per model (also on disk, in the raw cache's `formats.json`), so only a model's first sentence probes. Some models (Gemini's) answer only in `pcm`: raw signed 16-bit little-endian, 24 kHz mono.
- **Retries:** network errors, timeouts, 429 and 5xx, three times, after 1, 3 and 9 s (or the `Retry-After`, capped at two minutes).
- **Never retried:** 401 and 403 (a rejected key) and 402 (no credits). Their bodies are never read or printed, and one of them stops the queue so nothing more is spent.

## Where things live

| Path | In git? | What |
|---|---|---|
| `<voice.dir>/` (default `showcase/voice/`) | yes | MP3 clips and `<tour>.manifest.json` (about 1 MB per two minutes), so a re-render needs no key |
| `showcase/.cache/tts/` | no | Raw synthesised audio by synth key, plus `formats.json` |
| `showcase/out/voices/` | no | The audition page and its samples |

## Troubleshooting

- **"there is no narrator":** choose one with `--audition`, then set `voice.narrator`.
- **"OPENROUTER_API_KEY is unset" / "mode 644":** run `showcase keys status`; the user fixes the file or runs `showcase keys set`.
- **"rejected the key (401)":** `showcase keys test` checks it, free.
- **"no credits (402)":** the account needs topping up, or use `--draft`.
- **Everything is `stale` after a plugin update:** the processing chain changed (`chain` in the post settings); rerun `voice`. It re-processes from the raw cache without spending.
