# Voice

How a tour's narration becomes audio: `showcase voice <tour>` voices the narration through one pipeline, and `--audition` helps the user choose the narrator by ear. With `voice.takes: "tour"` (what `showcase init` writes, from 1.1) the voice reads the whole narration **in one continuous take**, which is then cut back into sentences at its own pauses; one call per sentence sounds read out line by line. Drafts cost nothing; the narrator costs a few cents a minute through OpenRouter or Requesty.

## The pipeline

```
script ─► lexicon ─► TTS (OpenRouter | Requesty | say | fake) ─► raw cache
       ─► trim ─► ebur128 measure ─► gain to −16 LUFS ─► alimiter ─► soxr 24 kHz mono
       ─► 30 ms lead, 80 ms tail ─► MP3 64k ─► <voice.dir>/<hash>.mp3 + <tour>.manifest.json
```

The script is one sentence (`voice.takes: "sentence"`, 1.0's way and the default when the config says nothing), or a whole take (`"tour"` or `"step"`), which then goes through the take's own steps below: silencedetect, the fit, the transcription check and the cut.

- **Lexicon:** `voice.lexicon` in `showcase/config.json` maps written → spoken (`"W39": "week thirty-nine"`). Longest key first; word keys match only at a letter boundary (`pp` changes `4pp`, not `approve`). Captions keep the written text.
- **Processing:** the chain above, with a duration check (the MP3 may not drift more than 50 ms from the WAV). The settings are fixed; they are part of every clip's file name, so changing one re-processes everything from the raw cache without new spend.
- **Clips** are named by hash (`864a38ac24d17b34.mp3`), so tours can share one `voice.dir`.

## Takes

`voice.takes` in `showcase/config.json` says how much the voice reads in one go.

| `voice.takes` | One call reads | Manifest |
|---|---|---|
| `"tour"` | As many whole steps as the provider's input limit allows: usually the whole tour | v2 |
| `"step"` | One step | v2 |
| `"sentence"` (or absent) | One sentence, as 1.0 did | v1 |

- **The limit.** OpenAI's speech models (`openai/gpt-4o-mini-tts`, through Requesty or OpenRouter) take 4,096 characters, ElevenLabs' `eleven-v3` 3,000, and any other model is given 4,096. `say` and the fake have none. A five-minute walkthrough's narration is about 3,500 characters, so it fits one take. A take breaks **only between steps**; a single step over the limit is refused (split the step).
- **The script** is the take's sentences in order, after the lexicon, one paragraph per beat with a blank line between beats, so the voice pauses where the film changes beat. Captions keep the written text, as always.
- **The raw take** is cached by its synth key (the script, the voice and the take number), like a sentence.

### Cutting a take

1. **One loudness pass.** The take goes through the chain above as a whole (trim, measure, gain, limit, resample, lead and tail), so every sentence is at the same level and nothing is renormalised per sentence.
2. **Pauses.** `silencedetect` (−45 dB, at least 60 ms) lists every pause in it. Commas pause too, so there are more pauses than sentences. A checked take gets a second, quieter pass (−35 dB): a breath or room tone between two sentences often sits between the two levels.
3. **The fit.** Each sentence is expected to last in proportion to its characters, at the take's own rate. A dynamic-programming fit chooses one pause per boundary, in order: a boundary costs the sentences' squared relative miss either side of it, and a short pause costs more than a long one, so of two pauses near the expected place the longer wins. Too few pauses for the sentences, and the take can't be cut.
4. **The heard words place the cuts.** The transcription check (below) confirms each sentence was read as written, and then each cut follows the heard words, not the fit: it snaps to the pause the heard words leave between the two sentences. A real narrator doesn't read in proportion to characters, so on a long take the fit alone can drift by seconds; it decides a cut only where the heard words can't.
5. **The cut.** At the middle of each sentence-final pause. Slice *i* runs from one cut to the next (the take's start and end at the edges), so the slices joined are the take, sample for sample, and each slice opens with half a pause: its **onset** is where its speech starts inside it. Each slice is an MP3 clip, named by its take's synth key, its place in the take, the cut's version and the post settings. When the cut changes (1.1.1 is version 2), every take's slices are stale: the next `voice` run cuts them again from the cached raw take, and sends nothing. Where `showcase/.cache/` is gone, a stale take must be voiced again, which a narrator take pays for.

Nothing else changes downstream. The runtime already speaks cues back to back, each held for its clip's `durationMs`, so the slices play as the take was read, apart from any wait for an `after` gate. Captions, the pacing table, `check`'s T008 and `voice --check` read the slices' durations; the film starts each caption, and looks for its sound, at the slice's onset.

### The transcription check

When the narrator speaks and `REQUESTY_API_KEY` is set (whichever provider voiced it), the processed take goes to **Requesty's transcription**: `POST https://router.requesty.ai/v1/audio/transcriptions` with an OpenAI Whisper model from the public `GET /v1/models/transcription` listing (`openai/whisper-1` when listed), `response_format=verbose_json` and `timestamp_granularities[]=word`. Same key, same retry and refusal rules as the speech call. Nothing calls OpenAI directly.

- **Comparing.** What was heard is aligned word by word with the script, after normalising case, punctuation and figures (`4%` and "four per cent", `£1,250` and "one thousand two hundred fifty pounds", `21st` and "twenty-first" read the same). A sentence passes with at most 15 % of its words missed, and always one (Whisper mishears a name now and then).
- **Verdicts.** `skipped` (under half its words heard), `garbled` (more missed than allowed, or a restarted phrase), `repeated` (read twice).
- **A take that fails is voiced again, whole, as a new take** (the take number goes up), at most **twice more**, each retake counted against `--max-chars`. One sentence is never patched in: it would not sound like the take around it. After the third take, `voice` fails with a per-sentence table (`invite/1  repeated  6/6 words: "…"`), and nothing is written.
- **The cuts follow the heard words** (1.1.1). The *heard gap* after a sentence runs from its last heard word's end to the next sentence's first heard word's start. Whisper's stamps can run back to back, with no gap at all, and can lag or lead the speech by a few hundred ms, so:
  - each boundary snaps to the pause nearest its heard gap, within about a second either side, the longest preferred (a pause loses half a ms of length per ms it lies outside the gap);
  - every pause belongs to the heard gap it lies nearest, so a sentence under a second long keeps the pause that ends it;
  - the strict pauses (−45 dB) come first; where none is near, the quieter pass's (−35 dB) are searched. A strict pause also widens to the quieter pause around it, so a breath before the next sentence counts as pause, and the slice's onset is where its speech starts;
  - only where neither pass has a pause near the heard gap does the fitted cut stand, and `voice` warns: listen to that join. A fitted cut that would fall out of order with its neighbours moves to the middle of the heard gap, so the cuts stay in order and no slice is empty.
- **Hyphens.** A hyphenated compound and its closed form are one word, so "sign-up" in the script matches Whisper's "signup", "sign-up" or "sign up". Numbers stay apart ("twenty-first" is two words, as figures are spelled out).
- **Whisper's own stamps are not the measure of a cut.** A first word stamped with no length (`Next [12.40–12.40 s]`) is often a few hundred ms late. The slice's onset comes from the audio, so it can sit that far before the stamp and still be right; listen, or read the take's levels, before moving a cut for it.
- The transcript is cached beside the raw take, so a re-run pays for neither. Without `REQUESTY_API_KEY` the take is cut from its pauses alone and `voice` warns that it wasn't checked; draft takes are never sent.
- The manifest records each take's `check`: `passed`, or `unchecked`.

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
                      [--redo <beat/n|step|take>] [--prune] [--dry-run] [--audition] [--json]
showcase voices --list [--model <id>]
```

| Flag | Meaning |
|---|---|
| (none) | The narrator if one is configured and the key is set; otherwise the draft voice. Clips that are already current are kept, even narrator clips when the key is absent |
| `--draft` | Draft voice only, whatever is configured |
| `--final` | Narrator only. Fails if there is no narrator or no key, and `--check --final` fails on any draft clip |
| `--check` | Report `missing`, `stale`, `draft` or `fresh` per sentence. **No network, key or ffmpeg.** Exit 1 if anything is missing or stale |
| `--yes` | Allow the paid calls. Without it, a run that needs them is refused and says how many sentences and characters |
| `--max-chars` | Cap on characters sent to the narrator's provider in one run, retakes included (default `voice.maxChars`, else 20,000). Refused over the cap even with `--yes` |
| `--redo beat/n` | Voice sentence `n` (from 0) of a beat again, as a new take. Under `voice.takes` `"tour"` or `"step"`, the whole take holding it; `--redo <step-id>` and `--redo t2` name a take too |
| `--prune` | Delete clips no manifest in the voice dir points to (refused if a manifest is unreadable) |
| `--dry-run` | Say what would be voiced; change nothing. Under takes, how many takes, sentences and characters |
| `--audition` | Write `showcase/out/voices/index.html`, see below |

### Status

A sentence is **fresh** when its manifest clip's synth key *and* file name match what the pipeline would make now. The synth key covers the spoken text, provider, model, voice, instructions, speed and take. The file name also covers the post-processing settings. A slice carries its take's synth key, so **editing one sentence makes its whole take stale**: the take is read again, never patched.

- **missing:** no clip for this exact text in this beat (a new or edited sentence), or the file is gone.
- **stale:** a clip exists, but the voice, the lexicon, the take or a post setting changed since.
- **draft:** current, but spoken by the draft voice.
- **fresh:** current, spoken by the narrator.

Editing a sentence's text flips it to `missing`; editing the lexicon flips the sentences it touches to `stale`.

### The pacing table

`voice` prints one row per sentence (words, seconds, words a minute) and the total against the preset's narration window. Under takes it adds a row per take (sentences, characters, whether it was voiced this run, and its check). A slice's seconds include the half pauses either side of it, so its words a minute read a little slower than a lone sentence's.

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

**v2**, written under takes, keeps every v1 field and adds the takes and where each clip was cut from:

```json
{
  "clips": [
    { "beat": "cookies", "durationMs": 4325, "file": "…", "hash": "…", "n": 0, "synth": "<the take's>",
      "slice": { "fromMs": 4067, "onsetMs": 119, "take": "t1", "toMs": 8392 }, "take": 0, "text": "…", "voice": "narrator" }
  ],
  "takes": [
    { "chars": 3512, "check": "passed", "durationMs": 241380, "id": "t1", "model": "openai/whisper-1",
      "steps": ["open", "today", "…"], "synth": "…", "take": 0, "voice": "narrator" }
  ],
  "v": 2, …
}
```

A v1 manifest still loads everywhere (Watch, the film, `check`, the in-app runtime), and its clips' onset is the 30 ms lead. Switching a tour from `sentence` to `tour` makes every sentence stale once.

## The audition

`showcase voice <tour> --audition [--yes] [--max-chars <n>]` writes a page with three sample lines for each voice on the shortlist, plus the draft voice, and nothing else changes. Under `voice.takes` `"tour"` or `"step"` each voice reads its three lines **as one take**, a paragraph each, so the page plays how the voice carries one line into the next (one clip per voice).

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
- **One take costs what its sentences would**: the narrator is billed per character either way. The blank lines between beats add two characters each.
- **The transcription check** is billed per minute of audio (Whisper: about $0.006 a minute upstream), so a five-minute take's check costs about three cents. It is cached with the raw take.
- **Retakes** are new spend: a take the check fails is read again whole, at most twice, inside `--max-chars`. The refusal without `--yes` says how many takes and characters, and that a transcription follows.
- **The narrator** is billed by its provider per character, at the model's own rate (`gpt-4o-mini-tts` through Requesty: about $0.015 a minute): a two-minute film is about 1,500 characters, typically a few cents. Check the model's price on OpenRouter before a long film.
- **The pre-scan:** run `showcase voice <tour>` without `--yes` first. A run that needs paid calls is refused, saying how many sentences and characters it would send (`--dry-run` lists the sentences). Show those numbers to the user and get their go before adding `--yes`.
- **Caps:** `--max-chars` (default `voice.maxChars`, else 20,000) refuses a bigger run even with `--yes`; the audition stays under 1,500 characters across all voices.
- **Nothing is paid for twice:** raw audio is cached by synth key, so re-processing, a lexicon change on other sentences, or a re-render costs nothing. Only edited sentences (under takes, their whole take), retakes and `--redo` takes are new spend.

## Where things live

| Path | In git? | What |
|---|---|---|
| `<voice.dir>/` (default `showcase/voice/`) | yes | MP3 clips and `<tour>.manifest.json` (about 1 MB per two minutes), so a re-render needs no key |
| `showcase/.cache/tts/` | no | Raw synthesised audio by synth key, takes' transcripts (`*.words.json`), plus `formats.json` |
| `showcase/out/voices/` | no | The audition page and its samples |

## Troubleshooting

- **"there is no narrator":** choose one with `--audition`, then set `voice.narrator`.
- **"OPENROUTER_API_KEY is unset" / "REQUESTY_API_KEY is unset" / "mode 644":** run `showcase keys status`; the user fixes the file or runs `showcase keys set [NAME]`.
- **"rejected the key (401)":** `showcase keys test [NAME]` checks it, free.
- **"no credits (402)":** the account needs topping up, or use `--draft`.
- **Everything is `stale` after a plugin update:** the processing chain changed (`chain` in the post settings); rerun `voice`. It re-processes from the raw cache without spending.
- **"the transcription doesn't match the script" after 3 takes:** read the table. A sentence the voice keeps garbling usually needs rewording (a figure, an acronym or a name: add a lexicon entry). Edit, then voice again.
- **"too few pauses to cut":** the voice ran sentences together. Stronger full stops, or `instructions` asking for a short pause between sentences, then `--redo` the take.
- **"isn't confirmed by the heard words":** neither pause pass found a pause within about a second of the gap the heard words leave there, so the fitted cut stands. Listen to the join it names in Watch; `--redo` the take if a sentence starts in the wrong slice.
