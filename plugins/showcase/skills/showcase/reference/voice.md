# Voice

How a tour's narration becomes audio: `showcase voice <tour>` voices every sentence through one pipeline, and `--audition` helps the user choose the narrator by ear. Drafts cost nothing; the narrator costs a few cents a minute through OpenRouter or Requesty.

## The pipeline

```
tour sentence ─► lexicon ─► TTS (OpenRouter | Requesty | say | fake) ─► raw cache
              ─► trim ─► ebur128 measure ─► gain to −16 LUFS ─► alimiter ─► soxr 24 kHz mono
              ─► 30 ms lead, 80 ms tail ─► MP3 64k ─► <voice.dir>/<hash>.mp3 + <tour>.manifest.json
```

- **Lexicon:** `voice.lexicon` in `showcase/config.json` maps written → spoken (`"W39": "week thirty-nine"`). Longest key first; word keys match only at a letter boundary (`pp` changes `4pp`, not `approve`). Captions keep the written text.
- **Processing:** the chain above, with a duration check (the MP3 may not drift more than 50 ms from the WAV). The settings are fixed; they are part of every clip's file name, so changing one re-processes everything from the raw cache without new spend.
- **Clips** are named by hash (`864a38ac24d17b34.mp3`), so tours can share one `voice.dir`.

## Keys

Each narrator provider has one key: `OPENROUTER_API_KEY` for OpenRouter (the default), `REQUESTY_API_KEY` for Requesty (from 1.1). Both live in one user-level file, read in every repo, so they travel with the user rather than with the code:

```
${SHOWCASE_CONFIG_DIR:-${XDG_CONFIG_HOME:-~/.config}/showcase}/.env      file 600, directory 700
```

- **Precedence:** the process environment, then the repo's `.env.local` (only the names showcase knows, and only if `git check-ignore` confirms the file is ignored), then the user file.
- **A file with looser permissions is refused**, with the `chmod` to fix it printed.
- The template also lists the narrator overrides, `FFMPEG_PATH`, `FFPROBE_PATH` and `SHOWCASE_CACHE_DIR`, and reserves `ELEVENLABS_API_KEY`, `OPENAI_API_KEY`, `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` (commented out) for direct providers later.

| Command | Does |
|---|---|
| `showcase keys status` | Each variable, both keys included: `set` or `unset`, and where from (`REQUESTY_API_KEY  set  (user file)`). Never a value |
| `showcase keys init` | Creates the directory and file with the right modes and commented template lines, no key |
| `showcase keys import <file> [NAME]` | Copies only that key's line (`OPENROUTER_API_KEY` by default, or `REQUESTY_API_KEY`) from another file (a repo's `.env.local`), without printing it. `--force` replaces one already set |
| `showcase keys test [NAME]` | Checks a key for free, never a synthesis: OpenRouter's `GET /api/v1/key`, Requesty's `GET /v1/manage/apikey/self` (a key may ask about itself; its id and name are never shown). Without a name, every key that is set |
| `showcase keys set [NAME]` | Asks for the key (`OPENROUTER_API_KEY` by default, or `REQUESTY_API_KEY`) with hidden input. It refuses without a terminal, so only the user's own terminal can run it |

**Claude's rules:**

- **Never ask for the key in chat, and never print, read or `cat` the key file**, a `.env*` file or `showcase/.auth/`. The plugin's hook denies any tool call that names them.
- To set it, the user runs `showcase shim` (once, for `~/.local/bin/showcase`) and then `showcase keys set` (or `showcase keys set REQUESTY_API_KEY`) **in their own terminal**, or edits the file themselves.
- `keys import` only with the user's go, naming the file they chose.
- Without the key everything still works on the draft voice; only the narrator and the audition's paid voices need it. The narrator needs its own provider's key.

Inside the toolkit, only `lib/env.ts` reads keys and only the two providers send them, each its own; every error passes through `redact()`; the app server gets its environment minus showcase's keys, and ffmpeg and Chromium a minimal allowlist.

## Voices

| Voice | What | Cost | Needs |
|---|---|---|---|
| **Narrator** | A speech model at its provider, `voice.narrator {provider?, model, voice, instructions?, speed?, approved}`. `provider` is `"openrouter"` (the default, so a 1.0 config is unchanged) or `"requesty"` | Paid; `--yes` required | `OPENROUTER_API_KEY` or `REQUESTY_API_KEY` |
| **Draft** | macOS `say` (Daniel, 24 kHz) | Free | macOS. Off macOS, or without `say`, a fake tone is used, with a warning |
| **Fake** | A sine tone, length = characters ÷ 16 seconds | Free | ffmpeg; for tests |

- `SHOWCASE_TTS_MODEL`, `SHOWCASE_TTS_VOICE`, `SHOWCASE_TTS_INSTRUCTIONS` and `SHOWCASE_TTS_SPEED` override the narrator for one run (process environment, an ignored `.env.local`, or the user key file).
- `voice.draft` is `{provider: "say" | "fake", voice?}`.
- OpenAI's `gpt-4o-mini-tts` (its voices include **Fable**) is reached through Requesty, never by calling OpenAI directly:

  ```json
  "narrator": { "provider": "requesty", "model": "openai/gpt-4o-mini-tts", "voice": "fable",
                "instructions": "Warm and unhurried, like a colleague showing you round." }
  ```

  `instructions` steer the delivery (tone, pace, accent); they are part of the synth key, so a new delivery is a new take. Fix pacing by rewording, not `speed`.

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

`showcase voice <tour> --audition [--yes] [--max-chars <n>]` writes a page with three sample lines for each voice on the shortlist, plus the draft voice, and nothing else changes.

| Provider | Model | Voices |
|---|---|---|
| OpenRouter | `elevenlabs/eleven-v3` | george, daniel, alice, lily |
| OpenRouter | `microsoft/mai-voice-2.1` | en-GB-Harry, en-GB-Emily |
| OpenRouter | `google/gemini-3.8-flash-tts` | Charon, Orus, Kore |
| Requesty | `openai/gpt-4o-mini-tts` | fable |

**Your own list.** `voice.audition` in `showcase/config.json` replaces the shortlist: entries `{id, provider?, model, voice, instructions?}`. Two entries may share a voice with different `instructions`, so two deliveries are compared side by side:

```json
"audition": [
  { "id": "fable-warm",  "provider": "requesty", "model": "openai/gpt-4o-mini-tts", "voice": "fable", "instructions": "Warm and unhurried." },
  { "id": "fable-brisk", "provider": "requesty", "model": "openai/gpt-4o-mini-tts", "voice": "fable", "instructions": "Brisk and clear." },
  { "id": "marin",       "provider": "requesty", "model": "openai/gpt-4o-mini-tts", "voice": "marin" }
]
```


- The lines are the tour's opening, its line with the most figures and its closing. If they would push the cost over the budget (**1,500 characters** by default, across all voices), the shortest lines that fit are used.
- With a key, `--yes` is required, because it is paid (a few cents). A voice whose provider has no key is marked skipped (`no REQUESTY_API_KEY`); with no key at all the page still gets the draft voice.
- Voices their provider's live catalogue no longer offers are skipped, unspent. `showcase voices --list` shows what is offered, with no key.
- The raw audio is cached, so rerunning the audition costs nothing.
- Afterwards the user chooses by ear. Put the chosen row's `provider`, `model`, `voice` and any `instructions` in `voice.narrator` in `showcase/config.json` and set `approved` to the date once they sign it off (Round 5 of the interview), then run `showcase voice <tour> --final --yes`.

## OpenRouter details

- `POST https://openrouter.ai/api/v1/audio/speech`; the catalogue is `GET /api/v1/models?output_modalities=speech` (public).
- Three requests run at a time.
- **Format chain:** wav → mp3 → pcm. A 400 that names the format moves to the next one; the one that works is remembered per model (also on disk, in the raw cache's `formats.json`), so only a model's first sentence probes. Some models (Gemini's) answer only in `pcm`: raw signed 16-bit little-endian, 24 kHz mono.
- **Retries:** network errors, timeouts, 429 and 5xx, three times, after 1, 3 and 9 s (or the `Retry-After`, capped at two minutes).
- **Never retried:** 401 and 403 (a rejected key) and 402 (no credits). Their bodies are never read or printed, and one of them stops the queue so nothing more is spent.

## Requesty details

- `POST https://router.requesty.ai/v1/audio/speech`, OpenAI-compatible: `{model, voice, input, instructions, response_format}` and a bearer key. One request takes at most 4,096 characters.
- The catalogue is `GET /v1/models/speech` (public). It lists model ids only, so `voices --list` names OpenAI's 13 voices for `openai/gpt-4o-mini-tts`: alloy, ash, ballad, coral, echo, fable, nova, onyx, sage, shimmer, verse, marin and cedar.
- **Format chain:** wav → pcm (24 kHz, 16-bit mono) → mp3, remembered per model as OpenRouter's is (as `requesty:<model>` in `formats.json`).
- **Retries and refusals** are OpenRouter's: network errors, timeouts, 429 and 5xx three times after 1, 3 and 9 s (or a capped `Retry-After`); 401, 403 and 402 never, unread, and they stop the queue. Errors arrive as `{"error": {"origin", "message"}}`; the message is redacted before it is shown.
- **OpenAI's `gpt-4o-mini-tts` is due to shut down on 6 January 2027.** Committed clips keep re-rendering after that; re-voicing needs another narrator.

## Cost

- **Drafts, `say` and the fake are free**, and so are `voices --list`, `keys test` and `voice --check`.
- **The narrator** is billed by its provider per character, at the model's own rate (`gpt-4o-mini-tts` through Requesty: about $0.015 a minute): a two-minute film is about 1,500 characters, typically a few cents. Check the model's price on OpenRouter before a long film.
- **The pre-scan:** run `showcase voice <tour>` without `--yes` first. A run that needs paid calls is refused, saying how many sentences and characters it would send (`--dry-run` lists the sentences). Show those numbers to the user and get their go before adding `--yes`.
- **Caps:** `--max-chars` (default `voice.maxChars`, else 20,000) refuses a bigger run even with `--yes`; the audition stays under 1,500 characters across all voices.
- **Nothing is paid for twice:** raw audio is cached by synth key, so re-processing, a lexicon change on other sentences, or a re-render costs nothing. Only edited sentences and `--redo` takes are new spend.

## Where things live

| Path | In git? | What |
|---|---|---|
| `<voice.dir>/` (default `showcase/voice/`) | yes | MP3 clips and `<tour>.manifest.json` (about 1 MB per two minutes), so a re-render needs no key |
| `showcase/.cache/tts/` | no | Raw synthesised audio by synth key, plus `formats.json` |
| `showcase/out/voices/` | no | The audition page and its samples |

## Troubleshooting

- **"there is no narrator":** choose one with `--audition`, then set `voice.narrator`.
- **"OPENROUTER_API_KEY is unset" / "REQUESTY_API_KEY is unset" / "mode 644":** run `showcase keys status`; the user fixes the file or runs `showcase keys set [NAME]`.
- **"rejected the key (401)":** `showcase keys test [NAME]` checks it, free.
- **"no credits (402)":** the account needs topping up, or use `--draft`.
- **Everything is `stale` after a plugin update:** the processing chain changed (`chain` in the post settings); rerun `voice`. It re-processes from the raw cache without spending.
