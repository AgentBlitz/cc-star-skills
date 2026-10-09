# showcase plugin: narrated product films and self-playing tours for any web app

> **Status:** Approved 2026-10-09 in plan mode (decisions D1–D19, §3). **11 of 13 sessions done.** Next: **Session 12 (P1, Star I: the film and live demo), by hand, run from Star**. Live status is in `TRACKER.md`, and each session's instructions are in `prompts/session-N.md`. Run the next one with `/session`.

## 1. Context

**Where this comes from.** The gods-eye "showcase" roadmap (`/Users/kstar/_PRJ/gods-eye/.planning/showcase/`, Sessions 1–8 done) made the Compass prototype explain itself:
- a tour that performs each step on the real screens: a visible pointer clicks, types and drags, with a spotlight, captions and an AI narrator;
- a two-minute exec pitch whose timing is driven by its narration.

The user wants the same kind of video in other repositories and for other apps. This roadmap builds it as a new plugin, **`showcase`**, in this marketplace. The skill interviews them about the outcomes they want, the kind of video and its length, and carries the voice-over key setup from repo to repo.

**What exists and what doesn't:**
- **Built in gods-eye, but React/Next- and Compass-specific:**
  - the tour engine, `src/ui/tour/`;
  - the film-mode handshake: `engine/index.ts`, `engine/timeline.ts` and `src/core/narration/film-events.ts`;
  - the voice pipeline, `scripts/film/`.
- **Specified but never built:** the recorder. gods-eye Sessions 10–12 are still ⬜, so no Compass MP4 exists, and this plugin's recorder is the first real one. Compass keeps its own Sessions 10–12 (D8).

**The intended outcome.** In any web-app repo, `/showcase` takes the user from an interview to a finished, verified film:
- a narrated MP4 with burned-in captions, an SRT, a timecoded script, a still per beat and a verification report;
- review checkpoints where only the user can decide: the storyboard, the narrator and the final cut.

The same tour file can also run as a self-playing live demo (injected, so the app is unchanged) and ship inside the product as an in-app guided tour (a vendored runtime).

**Provenance.**
- The user settled the decisions in plan mode on 2026-10-09.
- Six read-only passes informed them:
  - a digest of the gods-eye showcase work;
  - the voice pipeline;
  - this marketplace's conventions;
  - Claude Code plugin facts;
  - a technical risk review, with measurements on this M4 Max;
  - a scope, UX and session review.
- The approved plan is `~/.claude/plans/the-showcase-roadmap-was-curious-quiche.md`. This PLAN.md is its roadmap form, and now the authority.

**Frozen, do not change:**
- **gods-eye** (`/Users/kstar/_PRJ/gods-eye`): a read-only reference. Never edit, commit or run its scripts that write.
- **The `planning` and `copilot` plugins** in this repo. Only the README and marketplace descriptions change, in Session 11.
- **Star** (`/Users/kstar/_PRJ/star`):
  - untouched until Session 12;
  - Session 12 adds only `showcase/` and ignore lines;
  - Session 13 changes app code as listed;
  - both commit in Star only with the user's go.

**Out of scope.** See the list at the end of §2.

## 2. Target architecture

```
cc-star-skills/plugins/showcase/
  .claude-plugin/plugin.json                           name, version, dependencies ["planning"]
  skills/showcase/SKILL.md + reference/ + templates/   what Claude does: wizard, method, rules
  hooks/hooks.json                                     PreToolUse guard: no tool call may name the key file
  bin/showcase                                         on the Bash tool's PATH → node toolkit/cli.ts
  toolkit/  cli.ts · commands · lib · voice · host · film     (Node 24 TS, run natively)
  toolkit/runtime/src → dist/ (IIFE, ESM, .d.ts)              (browser TS, no framework)
  toolkit/schema/ · toolkit/fonts/ · toolkit/fixtures/ · toolkit/spikes/ · toolkit/test/
  evals/ · package.json · tsconfig.json

In a target repo:
  showcase/tours/<id>.json ─► voice ─► OpenRouter TTS | say | fake ─► ffmpeg ─► showcase/voice/ (manifest + mp3)
       │
       ├─► rehearse   headless run, no capture: anchors, on-screen numbers, deny-list, stills ─► storyboard
       ├─► watch      app ─► headed Chromium (maximised) + injected runtime ─► plays live, with voice
       ├─► film       app (own port, snapshot, reset) ─► headless Chromium ─► runtime in film mode
       │              ─► CDP screencast + timeline ─► CFR H.264 (BT.709) ─► voice mixed in Node ─► master
       │              ─► ASS captions + SRT ─► showcase/out/<id>/{<id>.mp4, .srt, script.md, report, stills, contact sheet}
       └─► in-app     runtime vendored + adapter ─► ?showcase=<id> for any visitor ─► film --in-app
```

### 2.1 The runtime (browser, framework-agnostic)

A port of Compass's engine without React or Zod.

**The tour format.**
- The JSON Schema is the single source. A small interpreter checks it, plus Compass-style cross-field checks. `init` copies the schema into the repo's `showcase/.schema/`.
- A tour is `{showcase: 1, id, title, meta, anchors, steps[]}`:
  - `meta {kind, audience, afterwards, takeaway, language, length{targetSec, narration{min,max}, beats}, rules{spokenNumbers, firstToCut}}`;
  - named `anchors`, referenced as `"@name"`.
- A step is `{id, title?, path?, ready?, beats[]}`. A beat is `{id, narration[], actions[], ready?, dwellMs?, card?}`. A sentence is a string or `{text, after: actionId}`.
- **Actions** (`kind`):
  - `goto`, `click`, `type`, `select`, `check`, `hover`, `focus`, `key`, `press`, `drag`, `upload`;
  - `scroll` (with `until`, for virtualised lists);
  - `spotlight` (an optional callout), `wait`, `hold`, `card`;
  - `invoke` (an adapter action);
  - `camera` (accepted, ignored in v1, D19).
- **Action rules:**
  - `effect` defaults to `read`, and a `write` needs `done`.
  - An action marked `navigates` must be the last in its beat. It runs after the beat's narration, so no sentence is cut or repeated.
  - A per-action `input: trusted | synthetic` override is allowed.
- **Ready predicates:** visible, exists, enabled, attr, text, count, url, absent, all, any.
- **Anchors**, in order of preference: role and name → label → test id → text → CSS. Visible matches come first, open shadow roots are searched, and `nth-child` is never used.

```json
{ "$schema": "../.schema/tour.schema.json", "showcase": 1, "id": "find-a-decision", "title": "Find any decision in seconds",
  "meta": { "kind": "spotlight", "audience": "team", "afterwards": "try", "language": "en-GB", "length": { "targetSec": 60 } },
  "anchors": { "query": { "css": "input[name=q]" }, "summary": { "css": "p", "text": { "pattern": "results? ·" } } },
  "steps": [{ "id": "search", "path": "/search", "ready": { "kind": "visible", "anchor": "@query" },
    "beats": [{ "id": "ask",
      "narration": [ "Every session log from every repo lands in one searchable place.",
        { "text": "Ask in your own words, and Star finds the session that decided it.", "after": "type" } ],
      "actions": [
        { "id": "type", "kind": "type", "target": "@query", "text": "why sqlite" },
        { "id": "go", "kind": "click", "target": { "role": "button", "name": "Search" }, "navigates": true, "effect": "write",
          "done": { "kind": "url", "path": "/search", "params": { "q": "why sqlite" } } } ],
      "ready": { "kind": "visible", "anchor": "@summary" }, "dwellMs": 1200 }] }] }
```

**Director.**
- Each beat runs two tracks, narration and actions, with `after` gates. A beat lasts the longest of its narration, actions and readiness, plus its dwell.
- Three clocks (pace, wall, ticker), Compass's lesson. They're built on the real timers the bootstrap captured, so the app's own clock tricks can't move the tour.
- Next, and Back (which re-shows a step without writing again). Deep links fast-forward the skipped writes.
- **Run state** (step, phase, journal, sequence number):
  - injected: held by the host, so it survives full page loads and cross-origin hops;
  - in-app: a sessionStorage journal.

**Executor.** It follows Compass's rules:
- prefer the visible control to a hotkey;
- scroll the target to centre;
- wait up to 10 s for a target;
- blur after typing.

Input goes two ways:
- **Injected: trusted CDP input** through the binding.
  - Before every action, a Playwright-style check: the target is visible, its rect is stable across two frames after `scrollend`, and `elementsFromPoint` (ignoring the overlay) finds it on top.
  - If something covers the target, scroll and try inset points. Otherwise fall back to synthetic input and log it in the report.
  - The real mouse moves on first, so hover fires.
  - An "acting" window `{kind, point, deadline}` replaces Compass's `isTrusted` test for telling the tour's input from the viewer's. A viewer's click pauses the tour.
- **In-app: realm-correct synthetic events**, ported from Compass's `dom-events.ts`: the React value setter, plus `beforeinput` typing for contenteditable and `DataTransfer` uploads. `rehearse --synthetic` shows which tours can ship in-app.

**Overlay** (the hybrid design Session 2's Spike 3 chose, S-D3).
- A shadow root inside `<showcase-overlay popover="manual">`, attached to `<html>`, not `<body>`, so React hydration doesn't trip over it.
- **Staying on top:**
  - `showPopover()` is called again (hide, then show) on every top-layer change. Without it the overlay is drawn under a modal dialog, an auto popover or a fullscreen element.
  - The bootstrap patches `showModal`, `showPopover` and `requestFullscreen`, and also watches `toggle` (capture phase), `fullscreenchange` and dialog `open`.
- **Staying out of the way:**
  - Anything outside an open modal dialog is inert, and in Chromium so is anything outside a fullscreen element. A click on the controls also light-dismisses an app's open `popover=auto`. So in Watch mode **only the controls** move, in their own `<showcase-controls>` shadow host: into the fullscreen element, else the topmost modal dialog, else the app's topmost open auto popover, else back into the overlay. The drawing (pointer, spotlight, captions, cards) stays in the popover. The film has nothing interactive, so it uses the popover alone.
  - Everything is `pointer-events: none` except the controls. A `data-acting` flag clears the shield during host input.
  - Events from the controls are consumed by a **window capture listener** the bootstrap registers before any app code: it acts on the control and stops the event, so neither bubble-phase "click outside" handlers (Radix) nor capture-phase ones ever see it.
  - It never takes focus: the controls `preventDefault()` on `mousedown`.
- **Hygiene:**
  - `:host{all:initial}`;
  - adopted stylesheets only (safe under CSP and Trusted Types);
  - fonts declared at document level;
  - re-attached if the app re-renders it away;
  - reduced motion honoured in Watch and in-app.
- **Pieces:**
  - a pointer with a click ripple, animated with WAAPI and awaited through `finished`;
  - a spotlight, which holds for its sentence and clears when the pointer moves on;
  - an optional callout;
  - Watch captions;
  - title and closing cards;
  - controls;
  - an end card.
- **The fallback** is Compass's portal into the topmost open dialog. Spike 3 found it isn't drawn over an auto popover or a fullscreen element.

**Audio.**
- Clips come from the manifest, looked up by tour, beat and exact text. Muting never changes timing.
- The injected live demo starts with sound (`--autoplay-policy=no-user-gesture-required`; Playwright mutes only headless browsers).
- An in-app tour starts muted, with a toggle. Its audio element is created inside the Watch click, as Compass's `audio-element.ts` does.

**Film contract.** Every event carries `v:1, seq, doc, t, wall`:
- `t` and `wall` come from the captured real clocks;
- `doc` goes up by one on each page load;
- `filmOrderProblems` (ported from Compass) checks the order, and `seq` only ever increases.

```
film:armed     { tour, fingerprint, manifestId|null, viewport:{w,h,dpr}, runtime }
film:start     {}
beat:start     { beat, index, step, kind:"screen"|"card", title? }
sentence:start { beat, index, text, audio:{hash,durationMs}|null }
sentence:end   { beat, index }
action         { beat, id, kind, phase:"start"|"done"|"skipped"|"timeout", input?:"trusted"|"synthetic" }
camera         { beat, rect|null, scale, easeMs }           // recorded in v1, used from v1.1
beat:end       { beat, index, narrationMs, waitedMs }
nav            { url, kind:"load"|"spa" }                   // host-emitted on framenavigated
film:end       {}   |   film:error { beat?, message, anchor? }
```

- **Arming** waits for `document.fonts.ready`, then 400 ms with no screencast frames, which also covers canvases.
- **Channel:** the one host binding `__showcaseHost(msg)` carries the events (with input, state, assets and logs), and the host keeps the log across reloads (Session 4). The page API is `window.__showcase`.
- **Start:** the host starts the film with `__showcaseGo()`.
- **No caption event:** the SRT cues are the sentences, split in post.

**Adapters (in-app only):**
- `navigate(url)` through the app's router;
- `reset()`;
- `showcase.actions.register`;
- `beforeStart()`, for example a deterministic AI for the tour's browser, as Compass's scripted-AI cookie gives.

### 2.2 The toolkit (`showcase` CLI)

| Command | What it does |
|---|---|
| `doctor [--json] [--install]` | The capability matrix: Node and TS stripping; ffmpeg and ffprobe filters (libass, soxr, perspective, loudnorm, ebur128, lame); Chromium (the Playwright cache, else Chrome, else offer the install); `say` and an en-GB voice; key status (names and source only); the planning plugin |
| `keys status \| init \| import <file> \| test \| set` | See 2.3. `test` is free: it calls `GET https://openrouter.ai/api/v1/key`, never synthesis. `set` asks for the key with hidden input, and refuses without a TTY, so only the user's own terminal can run it |
| `shim` | Writes `~/.local/bin/showcase`, which runs the newest installed version, for terminal use |
| `init` | Scaffolds `showcase/` from the templates, adds the ignore lines and copies the schemas |
| `docs [topic]` | Prints a reference doc. Roadmap sessions and your own terminal use it, because the skill isn't model-invocable (D18) |
| `inspect <url\|path> [--hidden] [--limit]` | Outlines a page by role and name and suggests anchors, each checked to resolve back to its element. A path opens on the repo's app |
| `auth [path]` | Records a sign-in in a headed browser into `showcase/.auth/state.json` (dir 700, file 600, ignored) as Playwright `storageState`; it ends when the window closes or Enter is pressed |
| `check <tour>` | Static, no network: schema; length budgets; captions (2 × 42); the spoken-number rule; `firstToCut`; card holds; the `navigates` rule; whether the storyboard and voice are current. Prints rule ids, with `--json` |
| `rehearse <tour> [--speed] [--synthetic] [--out]` | A fast headless run (×10 by default) with no capture, and Claude's authoring loop. It resolves every anchor, checks each spoken number against that beat's on-screen text, scans visible text for deny-list strings and saves a still per beat to `out/<id>/rehearse/`. On failure it saves a screenshot, a DOM excerpt, the page's outline and candidate anchors. The report is `out/<id>/rehearse.json` |
| `storyboard <tour> [--stills] [--html] [--out-dir]` | Generates `showcase/storyboard/<tour>.md` (never dependent on the stills). `--stills` rehearses for them; `--html` writes `out/<id>/storyboard.html` with them |
| `voice <tour> [--audition] [--draft\|--final] [--check] [--yes] [--redo beat/n] [--prune] [--dry-run]` and `voices --list` | See 2.4 |
| `watch <tour> [--speed] [--muted] [--from <step>] [--detach] [--manifest]` | The live demo: headed and maximised (`viewport: null`). Space pauses; ← and → step; M mutes; Esc exits; a viewer's click pauses. A finished tour holds its end card until the viewer closes it. `--detach` returns the pid, a log and `out/<id>/watch.json` |
| `film <tour> [--draft] [--strict] [--video-only] [--in-app] [--refresh-snapshot] [--detach]` | See 2.5. `--detach` writes `progress.json`, because the Bash tool stops after 10 minutes |

Every command that brings the app up (`rehearse`, `watch`, `inspect` with a path, `auth`, `storyboard --stills`) also takes `--base <url>` (an app already running: no lifecycle, no lock), `--build` (run `app.build` first; off by default outside `film`) and `--no-reset` (skip `snapshot` and `reset`). App commands run with `sh -c` in the directory holding `showcase/`; `{port}` and `{url}` are filled in (Session 5).
| `brief [--check]` | Writes `showcase/BRIEF.md` from the current state, for `/planning:roadmap`. *As built (Session 11):* the first run copies `templates/BRIEF.md`; every run regenerates only the `tours` and `app` blocks between `<!-- showcase:begin/end … -->` markers and keeps the skill's own sections; nothing is dated; `--check` exits 1 when the blocks are out of date |
| `runtime vendor [--framework next\|react\|html] [--to <dir>]` | See 2.6. It's idempotent and version-stamped |

**`showcase/config.json`** holds:
- **`app`:** `build`, `start`, `url`, `health`, `env`, `reset` (a command or HTTP), `snapshot` (for example an SQLite `.backup`).
- **`browser`:**
  - `scale` (default 1.5, S-D1), `viewport`;
  - `colorScheme`, `locale`, `timezone`;
  - `clock` (`setFixedTime` only; `clock.install` would fake the tour's own timers);
  - `storageState`;
  - `gpu` (`required` refuses SwiftShader, which Playwright always enables);
  - `block` (URL patterns: analytics, chat widgets, third parties);
  - `hide` (CSS selectors such as `nextjs-portal`, cookie banners).
- **`voice`:** `narrator {model, voice, instructions?, speed?, approved}`, `draft`, `lexicon`, `dir`, `maxChars`.
- **`film`:** `fps`, pointer on or off, cards, `targetSec`, `tolerance`.
- **`privacy.deny`:** strings and patterns that must never be on screen.

**The host also:**
- holds a lock per repo and allocates its own port;
- kills the app's whole process group on exit;
- answers file choosers from fixtures;
- accepts `beforeunload`;
- keeps `window.open` and `target=_blank` in the same tab;
- ignores "context destroyed" errors after a click navigates;
- grants clipboard permissions;
- handles full page loads per Spike 4 (S-D4): Playwright's default arguments show no white flash, because the old page stays on screen until the new one paints. The host holds the run state across loads, including the pointer's position (the overlay re-arms at the centre). A crossfade at `nav` in post stays the fallback.

**Injection (D16).**
- The IIFE goes in with `addInitScript`, in the top frame only, registered before any clock script.
- Assets such as voice clips come through the binding.
- **There's no `context.route`:** in Playwright 1.63 any route turns off the HTTP cache and holds every request in Node.

### 2.3 Keys (the part that travels between repos)

- **File:** `${SHOWCASE_CONFIG_DIR:-${XDG_CONFIG_HOME:-~/.config}/showcase}/.env`.
  - `keys init` creates the directory with mode 700 and the file with mode 600, with commented template lines and no key.
  - A file with looser permissions is refused, with the fix printed.
- **Variables:**
  - `OPENROUTER_API_KEY`: needed for the final voice. Without it the draft voice carries the work.
  - Optional narrator overrides: `SHOWCASE_TTS_MODEL`, `SHOWCASE_TTS_VOICE`, `SHOWCASE_TTS_INSTRUCTIONS`, `SHOWCASE_TTS_SPEED`.
  - Tools: `FFMPEG_PATH`, `FFPROBE_PATH`, `SHOWCASE_CACHE_DIR`.
  - The template lists `ELEVENLABS_API_KEY`, `OPENAI_API_KEY`, `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` commented out, reserved for direct providers later.
- **Resolution:**
  1. The process environment.
  2. The repo's `.env.local`, parsed with `util.parseEnv` (which never touches `process.env`), taking only the names above, and only when `git check-ignore` confirms the file is ignored.
  3. The user file.

  `keys status` prints, for example, `OPENROUTER_API_KEY  set  (user file)`, and never a value.
- **Guardrails:**
  - Only `toolkit/lib/env.ts` reads keys, and only the OpenRouter provider sends one.
  - Every error passes through `redact()`.
  - The app server gets its normal environment minus showcase's keys. ffmpeg and Chromium get a minimal allowlist.
  - Paid calls need `--yes` and respect `--max-chars`.
  - `storageState` files are treated as secrets too.
  - The plugin's PreToolUse hook denies any tool call that names the key file or `showcase/.auth/`. It's fast (plain bash and grep) because it runs in every session.
- **Claude's rules:**
  - Never ask for a key in chat. The user runs `showcase keys set` in their own terminal, after `showcase shim`, or edits the file themselves.
  - `keys import <repo>/.env.local` copies one key line without printing it, and only with the user's go.
- **First use on this machine:** `showcase keys import ~/_PRJ/gods-eye/.env.local` moves Compass's key into the user file.

### 2.4 Voice (Compass's pipeline, generalised)

- **Narration source:** the tour files.
- **The OpenRouter provider:**
  - `POST https://openrouter.ai/api/v1/audio/speech`.
  - Models and voices come from the public catalogue, `GET /api/v1/models?output_modalities=speech` (`supported_voices`). No key is needed to list them. On 2026-10-09 it listed 32 speech models, including ElevenLabs v3/v4, Gemini 3.8 Flash TTS, Microsoft MAI Voice, Deepgram Aura-2 and Fish Audio.
  - It fixes four bugs the design pass confirmed in Compass's code:
    1. The pool never had two requests in flight; now synthesis really runs 3 at a time.
    2. Post-processing settings weren't part of the staleness key; now they are.
    3. A fetch that throws wasn't retried; now network errors and timeouts are retried, as well as 429 and 5xx, with backoff of 1, 3 and 9 s, honouring `Retry-After`.
    4. The wav → mp3 → pcm format chain restarted for every sentence; now the working format is remembered per model.
  - 401 and 402 are never retried, and their bodies are never echoed.
- **Processing** is Compass's chain: trim, measure (ebur128), gain to −16 LUFS, `alimiter`, soxr at 24 kHz mono, 30 ms lead and 80 ms tail, MP3 at 64k, with a duration check.
- **Lexicon:** pronunciation fixes, longest key first, with letter boundaries. Captions keep the written text.
- **Manifest:** keyed by tour, beat and exact text, sorted, with no timestamps. `--check` needs no network and no key.
- **`--audition`** writes an HTML page with three sample lines for each voice on a British shortlist, plus the draft voice, with the user's go for the cost (a few cents):
  - ElevenLabs: george, daniel, alice, lily;
  - MAI: en-GB-Harry, en-GB-Emily;
  - Gemini: Charon, Orus, Kore.
- **Pacing:** a table with a warning outside 120–185 wpm. If the narration is outside its window, rewrite the text. Never speed up the voice.

### 2.5 The recorder (Compass's unbuilt spec, built generically, trimmed for v1)

- **Take:**
  - Film the production build; dev overlays and hot reloads would show up.
  - The app runs on its own port with `app.env`, after `snapshot` and `reset`, and the recorder waits for `health`.
  - Headless Chromium (new headless, `channel: "chromium"`) at the configured scale (default 1.5, S-D1), with `--force-color-profile=srgb`, the locale, timezone and colour scheme, a fixed clock, and `reducedMotion: 'no-preference'`.
  - **The DPR must be real:** launch with `--force-device-scale-factor=<scale>` as well as the context's `deviceScaleFactor`. With emulation alone the screencast sends frames at the CSS viewport size (960×540 at scale 2).
- **Capture:**
  - CDP `Page.startScreencast`: JPEG q90 (S-D1), `maxWidth` 1920 and `maxHeight` 1080, every frame, acknowledged at once, written through a bounded queue. When it's full, acknowledgements are delayed, so Chrome drops frames rather than Node's memory growing. Spike 1 measured 60 fps at p5 and about 6 MB/s at every scale.
  - The executor settles 300 ms after each scroll. Back-to-back scrolls with no settle cause one ~267 ms capture stall when the burst ends.
  - If the event loop lags (p99 over 20 ms), capture moves to a worker on a raw CDP WebSocket. Spike 1 measured 11.7 ms.
  - A clock-sync probe, a 750 ms pre-roll, a watchdog, and a 1.2 s tail.
  - The page's own frame rate is logged too.
  - Playwright's `recordVideo` was rejected: VP8 at 1 Mbps and 25 fps is too soft for text.
- **Video:**
  - A constant 30 fps schedule.
  - An explicit colour conversion from the screencast's BT.601 full range to BT.709 limited, with the output tagged.
  - x264 at CRF 17, preset slow, High profile, yuv420p, with keyframes at beat starts.
- **Audio:**
  - Mixed in Node: each clip is decoded once to 32-bit float at 48 kHz and summed at `sentence:start − t0`.
  - Then two-pass loudnorm (−16 LUFS, true peak −1.5, LRA 11), then `aresample=48000`, because loudnorm outputs 192 kHz.
  - AAC 192k, faststart, a chapter per beat.
- **Captions:**
  - An ASS file is built from the sentence timings: one sentence per cue, at most 2 × 42 characters.
  - It's burned in after scaling, in a bundled open-licence font (`toolkit/fonts/`).
  - The SRT comes from the same timings.
- **Outputs** in `showcase/out/<tour>/`:
  - `<tour>.mp4`, plus `-draft.mp4` with a DRAFT watermark while the narrator is unapproved;
  - `.srt`, `script.md` (timecoded), `timeline.json`, `report.json` and `report.md`;
  - a still per beat, and `contact-sheet.png`.
- **Verify** (`--strict` fails on any warning):
  - duration within the target ± tolerance;
  - −16 ± 1 LUFS, true peak ≤ −1 dBTP;
  - no silent gap over 2.5 s;
  - the SRT equals the sentences;
  - captions and audio within 50 ms;
  - no motion gap over 100 ms, except one that starts at a `nav` load (the held frame of a page load, S-D4);
  - the last `rehearse` deny-list result clean.

  Then Claude reads the contact sheet and each still against its narration: does the screen show what the sentence says?

### 2.6 The in-app path

- **`runtime vendor`:**
  - It copies `showcase-runtime.mjs` and its `.d.ts` into the app (for example `src/showcase/runtime/`), stamped with the version and never edited.
    - *As built (Session 10):* the declarations are `showcase-runtime.d.mts` plus a `types/` folder, because TypeScript reads an `.mjs` file's types only from a `.d.mts`.
  - It compiles cleanly under `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`.
  - *As built:* it also publishes every tour to `<public>/showcase/tours/<id>.json` (run it again after editing a tour; `film --in-app` refuses a stale copy). The runtime fetches the tour, the manifest and upload files under `/showcase/` (the adapter's `base`).
- **Adapters:**
  - **Next:** a lazy client component `ShowcaseTour.tsx`, wired to the router.
  - **React.**
  - **HTML:** a plain `<script type="module">`, which also covers multi-page apps.
- **Loading:** the runtime loads only when `?showcase=` is present, so the page's bundle budget is untouched.
  - *As built:* or when the tab is part-way through a tour (`sessionStorage["showcase:run"]`). A deep link takes its parameters off the URL, so a reload resumes instead of restarting.
- **The app also gets:**
  - a "Take the tour" entry point and the `?showcase=<id>&showcaseStep=<step>` deep links;
  - `data-showcase` anchors where roles and names aren't enough, with a two-sided contract test (as Compass's `anchors.ts` and `dom.test.ts` do);
  - `voice.dir` pointed at `public/showcase/voice/`;
  - one smoke test, if the app already has Playwright.
- **`film --in-app`** opens `?showcase=<id>&showcaseMode=film` and records through the same contract.
- **When this needs app code,** it's normally a roadmap path (`showcase/BRIEF.md` → `/planning:roadmap`). Run inside a roadmap session, as with Star, it's done in place.

### 2.7 The experience in a target repo

```
/showcase                 the wizard; resumes from whatever showcase/ already holds
/showcase keys            set up or check the voice key (user-level file)
/showcase watch <tour>    play the live demo
/showcase film <tour>     refresh stale voice, render, read back, then the final-cut round
/showcase review <tour>   the notes loop: notes → checklist → fixes → re-render
/showcase brief           write showcase/BRIEF.md from the current state, for /planning:roadmap
/showcase in-app          vendor the runtime and wire the in-app tour
/showcase doctor          prerequisites
```

**The wizard's phases:**
- **P0 Route and resume.** Work out where things stand from the files: config, tours, voice manifest, renders.
- **P1 Preflight.**
  - Confirm the working directory is the target app, not the marketplace (as build-copilot does).
  - `doctor --json`.
  - `keys status`. If the key is missing, offer `keys set` in the user's terminal, `keys import`, or carrying on with the draft voice.
- **P2 Round 1:** the outcomes.
- **P3 Explore.** Three Explore agents in parallel, each returning at most 600 words in a fixed shape:
  - **A — Screens and hero moments:** routes, navigation, URL state, and 5–8 ranked moments with anchor candidates.
  - **B — Story and data:** purpose, problem and language from the README, docs and landing page; data sources and seeds; clocks; live AI or external APIs; sign-in; any existing redaction.
  - **C — Running and anchors:** build and start commands, port, health URL; roles, labels and test ids; WebGL, iframes and dialogs; for the in-app path, the framework, router and mount point.

  A summary of at most 15 lines goes back to the user, then `init`, then `inspect` on the key routes.
- **P4 Rounds 2 and 3:** the story; the voice and path.
- **P5 Choose the path.** Stay in-session only if all of these hold:
  - the deliverables are a film and/or live demo;
  - one tour of 3 minutes or less;
  - determinism needs config only, no app code.

  Otherwise, write `showcase/BRIEF.md`, commit it, tell the user to run `/planning:roadmap showcase/BRIEF.md` in a fresh session, and stop.
- **P6 Storyboard.**
  - Draft the tour from the kind's template.
  - `check` until it's clean, then `rehearse` until it's clean three times in a row.
  - `storyboard --stills`. Run the audition in parallel if one was chosen.
- **P7 Round 4:** the storyboard, with the stills. At most 3 revision loops, then offer the roadmap path.
- **P8 Voice:** the cost pre-scan, `voice --yes`, the pacing table, and text rewritten where needed.
- **P9 Film:** `film --strict --detach`, polling `progress.json`, then read the contact sheet and the report. Fix and re-render.
- **P10 Round 5:** the final cut, then `watch` if a live demo was chosen.
- **P11 Wrap up.**
  - Record approval dates in the tour's `meta`, and offer to save the narrator as the default.
  - Commit `showcase/` (not `out/`, `.cache/` or `.auth/`), and suggest `/planning:wrapup`.
  - Offer the storyboard page, in one line, as a private claude.ai artifact.

### 2.8 The interview

AskUserQuestion rounds, at most four questions each, with the recommended option first. Arguments, `~/.config/showcase/defaults.json` and the explorers' findings skip what they settle. Headless runs stop instead of asking (D13).

**Round 1, outcomes** (before exploring, because the answers steer what the explorers look for):

| Ask | Options |
|---|---|
| The narrated film is always made. What else? | Film + live demo (Recommended: it reuses the same tour) · Film only · Film + in-app tour (changes app code, usually a roadmap) · All three |
| What should the viewer do after watching? | Decide or back it · Try it themselves · Understand how it works · Champion it |
| What kind of video? | Pitch · Walkthrough · Feature spotlight · How-to |
| How long? | The kind's default (pitch 2:00, walkthrough 3:00, spotlight 1:00, how-to 2:00) · About 1 min · About 2 min · 3 min or more (Other for an exact length) |

**Round 2, the story** (after exploring; the options are drafted from the explorers' reports):

| Ask | Options |
|---|---|
| Who's watching? | Executives · Prospective users · Your team · Developers (ordered by the answer to "afterwards") |
| What should they believe afterwards? | Three one-line takeaways drafted from the README, the landing copy and the problem the app solves |
| Which moments carry the story? (multi) | The top four hero moments, each with its route and what changes on screen |
| The film shows data. How should it see it? | A frozen snapshot · The app's own seed mode (offered only if one exists) · Live at render time |

**Round 3, voice and path:**

| Ask | Options |
|---|---|
| Narrator? | Your saved default (offered only if one exists) · Audition about 9 OpenRouter voices (a few cents) · The draft voice for now |
| Language? | UK English · US English |
| What must never be on screen? (multi) | People's names · Hostnames and internal URLs · Emails and customer data · Nothing sensitive. This becomes `privacy.deny`, pre-filled from any redaction config the explorers found |
| Where should it be built? | Here, now (when P5 allows) · An approved brief handed to `/planning:roadmap` |

- **Round 4, the storyboard** (after a real rehearsal, with stills):
  - Approve, voice and film it · Change beats · Tighten (drop the first-to-cut beat) · A different angle (the second takeaway).
  - If there was an audition, the narrator is picked here too.
- **Round 5, the final cut:**
  - Approve as final · I have notes (they become a numbered checklist) · Re-voice · Re-time.
  - Then: "Save this narrator as your default for every repo?" (D17)

**Length presets.** They're anchored to the measured Compass pitch: 248 words, 100.8 s of `readingMs` narration, about 119 s in all. So narration is about 85% of the runtime, at about 2.46 words per second.

| Preset | Film | Narration | Words | Beats |
|---|---|---|---|---|
| 1:00 | 55–60 s | 48–54 s | 118–133 | 5–6 |
| 1:30 | 83–90 s | 72–81 s | 177–199 | 6–8 |
| 2:00 | 110–120 s | 96–108 s | 236–266 | 8–10 |
| 3:00 | 166–180 s | 144–162 s | 354–398 | 11–13 |
| 5:00 | 276–300 s | 240–270 s | 590–664 | 18–22 |

- **Kind factor** on narration time and words: pitch and spotlight 1.0, walkthrough 0.94, how-to 0.85 (how-to has more silent doing).
- **Spines** (each ships as a `templates/tour.<kind>.json`):
  - **Pitch:** an opening card (the problem in the audience's words) → where it hurts → why → what we're doing (one to three beats, each a real action) → the payoff → the choice → an ask card. No callouts.
  - **Walkthrough:** an opening card → orient on the home screen → one beat per job → how the parts connect → a closing card.
  - **Spotlight:** the hook → an optional "before" → the moment it works (one continuous action) → the clever detail → the payoff → a call-to-action card.
  - **How-to:** a goal card → the starting point → one beat per step (imperative voice; the result held for at least 1.5 s; controls named exactly as labelled) → the result → a recap card.
- **The audience sets the register:**
  - executives: outcomes, with no jargon explained;
  - users: plain words, benefits first;
  - your team: specifics;
  - developers: how it works.
- **"Afterwards" sets the close:**
  - decide: an ask card;
  - try: a "start here" card;
  - understand: a recap of three takeaways;
  - champion: the one-line story.
- **Rules for every film:**
  - `readingMs = max(1600, round(words × 60000 / 165 + 350))` until there are real durations (rounded to the millisecond, as Compass's is; Session 3);
  - one sentence per caption, at most 2 lines of 42 characters;
  - each beat's span is at least its narration;
  - the last card holds for at least 2 s;
  - films of 2:00 or more name a `firstToCut` beat;
  - `spokenNumbers: "on-screen-only"` by default, checked by `rehearse` against the beat's DOM text. A pitch can choose Compass's stricter `"none"`.

### 2.9 The skill's files

**`SKILL.md`** is about 170 lines, in build-copilot's shape.
- **Frontmatter:**
  - `name: showcase`;
  - a description of about 300 characters;
  - `argument-hint: "[keys | watch <tour> | film <tour> | review <tour> | brief | in-app | doctor]"`;
  - `allowed-tools: [Read, Write, Edit, Glob, Grep, Bash, Agent, AskUserQuestion]`;
  - `disable-model-invocation: true`.
- **Body:**
  1. Purpose: the CLI does the mechanics, and `${CLAUDE_PLUGIN_ROOT}/skills/showcase/reference/` is the source of truth. "Pull the exact contract from the reference, don't reconstruct it from memory."
  2. 0 Route and preflight.
  3. 1 Outcomes.
  4. 2 Discover.
  5. 3 Story, voice and path.
  6. 4 Storyboard and approval.
  7. 5 Voice and film.
  8. 6 Review and wrap-up.
  9. Rules.
- **Rules:**
  - Never ask for, print or read a key.
  - The tour JSON is the only source; the storyboard is generated from it.
  - On the in-session path, never edit app code. Change the beat instead, or take the roadmap path.
  - Budgets and caption limits are gates, not advice.
  - Make the app deterministic before filming.
  - Every screen is the real app, never a mock-up or an edited frame.
  - Read every still back.
  - Keep CLI output terse (`--json`), and detach long runs.
  - Never guess an unasked answer.
  - Checkpoints are `Needs decision:` rows.
  - Never publish, upload or push without the user's go.
  - Follow the target repo's own conventions (`CLAUDE.md`, language).

**`reference/`:**

| Doc | Holds |
|---|---|
| `interview.md` | The rounds verbatim, the explorer briefs and report shapes, how answers map to config, the skip rules |
| `narrative.md` | The spines, registers and closes; the length presets and pacing maths; the writing and caption rules; Compass's method (perform real actions, narration-driven timing, a spotlight holds for its sentence, cut first) |
| `tour-format.md` | The schema and every action and predicate; anchors and `@names`; readiness; `after`; `navigates`; `effect: write` with `done`; cards; examples |
| `determinism.md` | Production build; own server, port and env; snapshots (SQLite via `.backup`); `setFixedTime`; seeded randomness; no live AI (point base-URL variables at a fake, or keep AI out of the story); `block` and `hide`; fonts and idle; `auth` and `storageState`; popups, uploads and the clipboard; the deny-list and privacy |
| `voice.md` | Keys (the file, precedence, rules); OpenRouter (format memory, retries, 401/402, model discovery); lexicon; cache keys; the −16 LUFS chain; audition; cost |
| `film.md` | The pipeline, flags and report thresholds; reading the contact sheet against the narration; troubleshooting (covered targets, the top layer, low fps, drift, white flashes, a stale manifest, a rejected key) |
| `in-app.md` | Vendoring and adapters (Next, React, HTML); lazy loading; the entry point; deep links; the voice folder; the anchor contract test; synthetic-input limits; what must not change |
| `roadmap-brief.md` | What `BRIEF.md` must hold: every answer verbatim and the budgets; the tour and storyboard with their approval status; the narrative rules; app facts (start, routes, determinism levers, frozen vs allowed code); toolkit gates per session; open items; the checkpoint protocol; a suggested session cut; end-to-end verification |

**`templates/`:** `config.json`, `tour.{pitch,walkthrough,spotlight,howto}.json`, `BRIEF.md`, `env.template`.

*As built (Session 11):*
- **Evals** (`evals/<case>/case.yaml`, claude 2.1.285): `keys-status-canary`, `headless-round-1`, `storyboard-file`, `brief-file`. Run them with `bash evals/run.sh [options]`, not bare `claude plugin eval plugins/showcase`: eval runs get a sealed HOME, so `"dependencies": ["planning"]` can't be satisfied and the plugin isn't loaded at all, and the plugin's `bin/` isn't on the runs' PATH. The wrapper evaluates a staged copy without the dependency line, with its `bin/` first on PATH, `--no-publish --trust-plugin --allow-tools Bash`. A case's `env` may only set `EVAL_*` names, so the canary reaches the CLI as `OPENROUTER_API_KEY="$EVAL_CANARY_KEY"`; macOS's `/usr/bin/git` can't run in the eval sandbox, so the cases don't `git init`.
- **`claude plugin details` doesn't model `disable-model-invocation`**: it reports ~132 always-on tokens for `/showcase`, and the same figure with or without the flag on a control skill. A direct check (asking a headless session to list its invocable skills) shows `/showcase` absent from the model's listing, as D18 intends; the control skill without the flag is listed.
- `SKILL.md` falls back to `${CLAUDE_PLUGIN_ROOT}/bin/showcase` when a shell can't find `showcase`.
- The interview takes "afterwards" as an argument too (`decide`, `try`, `understand`, `champion`), so `/showcase pitch 2min film+demo decide` settles Round 1.

### 2.10 Footprint in a target repo

| Path | Git | Holds |
|---|---|---|
| `showcase/config.json` | committed | App, browser, voice, film and privacy settings |
| `showcase/tours/<id>.json` | committed | The tour |
| `showcase/storyboard/<id>.md` | committed | Generated; `check` fails if it's stale |
| `showcase/voice/` | committed | `<tour>.manifest.json` plus MP3 clips (about 1 MB per 2-minute film), so a re-render needs no key |
| `showcase/.schema/` | committed | Copies of the JSON Schemas, for editor validation |
| `showcase/BRIEF.md` | committed | Roadmap path only |
| `showcase/out/` | ignored | MP4, SRT, `script.md`, stills, contact sheet, reports, `storyboard.html`, the audition page |
| `showcase/.cache/` | ignored | Raw TTS cache, captured frames, data snapshots |
| `showcase/.auth/` | ignored, mode 600 | Recorded sign-ins (`storageState`) |

The in-app path adds the vendored runtime, the adapter, the entry point, any `data-showcase` anchors and their test, and `public/showcase/voice/`.

### 2.11 Out of scope for v1

- **Deferred to v1.1:**
  - Present mode and the notes window.
  - Camera moves, using `perspective` (D19).
  - Music beds.
  - 4K, 60 fps, and 1:1 and 9:16 formats.
  - Per-beat MP4 clips (stills and chapters stay).
  - Re-rendering from a capture.
  - Network replay (HAR), and a scripted fake LLM server for apps' AI base URLs.
  - Multi-tour or translated films.
  - Reusable tour fragments.
  - A `check` the app's CI can run without the plugin.
- **Not planned:**
  - Terminal and native apps.
  - Direct TTS providers (OpenRouter already reaches ElevenLabs and others).
  - Voice cloning.
  - Uploading or publishing videos.
  - Compass's film.
  - Windows.
  - Linux beyond best-effort guards: `say` falls back to the fake, VideoToolbox to libx264, headed Watch needs a display (`xvfb-run`), and `doctor` reports each one.
- **Outside this roadmap:** teaching `/session` and autopilot about `Needs review:` (a planning v1.9.0 idea).

## 3. Cross-cutting decisions & reconciliations

### Decisions (plan mode, 2026-10-09)

| # | Decision |
|---|---|
| D1 | A new plugin, **`showcase`**, with one skill, `/showcase`, and subcommands. Versions stay 0.x during the build (0.1.0 in Session 1, 0.9.0 in Session 11); the release is 1.0.0 (Session 13). |
| D2 | **Web apps only** in v1: a local dev server, Docker or a deployed URL. |
| D3 | **Every run makes a narrated film.** Optional outcomes: a **self-playing live demo** (Watch mode in a headed browser, injected from outside, so the app's code doesn't change) and an **in-app guided tour** (built into the product, with `?showcase=<id>` deep links). |
| D4 | **Watch only in v1:** no Present mode or notes window. |
| D5 | **Voice through OpenRouter only**, plus macOS `say` for drafts and a fake for tests. One key reaches 32 speech models, and the public catalogue lists each model's `supported_voices`. The provider seam stays open. |
| D6 | **The key lives in one user-level file**, `${XDG_CONFIG_HOME:-~/.config}/showcase/.env` (file 600, directory 700), read in every repo. A repo's `.env.local` can override it, but only if `git check-ignore` confirms the file is ignored. The process environment wins over both. The key never enters a repo and is never printed or pasted into chat. |
| D7 | **One shared, framework-agnostic tour runtime.** One tour file works injected (Watch, film) or vendored (in-app). The director runs in the page. Node is the host: it launches, injects, supplies trusted input, owns run state when the runtime is injected, and collects events. |
| D8 | **Compass's film stays with gods-eye's own Sessions 10–12.** The plugin is proven on built-in fixtures, then twice on the user's **Star** dashboard (Next 16): first as a no-code-change film and live demo (Session 12), then with the tour embedded in Star (Session 13). |
| D9 | **This 13-session roadmap**, run with `/session` or `/autopilot`. Sessions 9, 12 and 13 are run by hand. |
| D10 | **The CLI runs on Node ≥ 24**, executing TypeScript natively (verified on 24.21; `node --test` runs TS tests too).<br>• `bin/showcase` checks `process.features.typescript` and passes `--disable-warning=ExperimentalWarning`. (`--no-warnings=…` silences every warning.)<br>• The only runtime npm dependency is `playwright-core` pinned at **1.63.0**, which matches the cached Chromium build 1243. Installed plugins carry no `node_modules`, so it's installed on first use with `npm install --prefix ${XDG_CACHE_HOME:-~/.cache}/showcase/<ver> --ignore-scripts`.<br>• ffmpeg comes from Homebrew (8.0.1 has loudnorm, ebur128, ass and subtitles, perspective, libx264, AAC and libmp3lame).<br>• Tests are committed, unlike the scratch-only tests elsewhere in this repo, because this plugin is real code. |
| D11 | **Not Claude Code's plugin options for the key.** A `sensitive` `userConfig` value only reaches hooks and MCP config, not commands run through the Bash tool. `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` aren't exported to Bash either. So `bin/showcase` finds its own directory, the cache lives under XDG, and `showcase shim` puts a launcher on `~/.local/bin` for terminal use. |
| D12 | `plugin.json` declares `"dependencies": ["planning"]`: a bare name, because planning 1.8.0 has no tag. That brings `/planning:roadmap` along for the hand-off. |
| D13 | Arguments skip questions (for example `/showcase pitch 2min film+demo`). In a headless run, where AskUserQuestion isn't available, the skill prints the round it needs and stops. It never guesses an answer. |
| D14 | **Every checkpoint is a ⛔ `Needs decision:` row.** `/session` only turns `Needs decision:` into a question; any other ⛔ (`Needs review:` included) counts as a failed gate. A by-hand session under autopilot sets ⛔ `Needs decision: run Session N interactively …` at once, so autopilot stops cleanly. |
| D15 | **Film captions are burned in by ffmpeg** from an ASS file, after scaling, in a bundled open-licence font, so macOS and Linux match. The SRT comes from the same timing. In-page captions are for Watch only. |
| D16 | **The browser runtime is TypeScript bundled by esbuild** (a dev-only dependency) into a committed `runtime/dist/`: an IIFE for injection, and an ESM file plus `.d.ts` for vendoring. They're hash-stamped, and a test fails if they're stale.<br>• **Injection is `addInitScript`.** It runs in the top frame only, before any app code and any clock script, so it captures the real timers first.<br>• Assets such as voice clips come through the host binding.<br>• **No network interception:** in Playwright 1.63 any `route` turns off the HTTP cache and holds every request in Node. |
| D17 | **Defaults travel too.** After a final cut the skill offers to save the narrator and language to `~/.config/showcase/defaults.json`, so the next repo starts with them. |
| D18 | **One skill, no always-on cost.** All installed skills share one description budget. `disable-model-invocation: true` takes `/showcase` out of the model's listing, so the cost is zero; the price is that Claude won't suggest it unprompted. Roadmap sessions use the CLI and `showcase docs <topic>` instead of loading the skill. |
| D19 | **The v1 film is 1080p, 16:9, 30 fps, with no camera zoom or music.**<br>• The `camera` action is accepted, ignored and noted in the report.<br>• Legibility instead comes from `browser.scale`: a smaller CSS viewport at a matching DPR, so the UI renders larger, the way Compass's presenter mode does.<br>• v1.1 adds camera moves using ffmpeg's `perspective` filter (the design pass measured `zoompan` and crop+scale juddering in 2-pixel steps), plus 4K, 60 fps, other aspect ratios and music. |

### Review notes — look and feel (Session 9, 2026-10-09)

**Approved as-is.** The user watched the fixture film (`fixture-tour-draft.mp4`) and the live `showcase watch fixture-tour`, and read `reference/interview.md`. The verdict was "Approve as-is", with no notes and no change of narrator or caption style. The pointer, spotlight, captions, pacing, voice defaults and interview wording stand as Sessions 5–8 built them. Session 8's weak spots (the cookies step showing the notice already accepted, "the trend" spoken over a spinner, the DRAFT watermark over "Account") were not raised and are left as they are.

### Spike verdicts (Session 2 fills these in)

| # | Question | Verdict | Numbers | Default chosen | Fallback |
|---|---|---|---|---|---|
| S-D1 | Capture: fps and frame gaps at scale 1, 1.5 and 2 (JPEG q80/q90) | **Holds at every scale, once the DPR is real.** With only `deviceScaleFactor` emulated, the screencast sends CSS-size frames (960×540 at scale 2), so the recorder also launches with `--force-device-scale-factor=<scale>`; then every scale gives 1920×1080. Back-to-back scrolls with no settle cause one ~267 ms capture stall when the burst ends (the page's rAF never stalls); a 300 ms settle after each scroll removes it | All six configs (2 reps, worst kept, 300 ms settle): p5 60 fps, median 60, largest gap 21–35 ms, event-loop p99 11.7 ms, 4.8–6.9 MB/s, 80–116 kB/frame, page rAF 60; bounded queue never above 2, no delayed acks. Burst (no settle): p5 43, one 267 ms gap at all scales. Renderer: ANGLE Metal, M4 Max (`spikes/results/spike1-*.json`) | **`browser.scale` 1.5** (1280×720 CSS, a desktop layout, at DPR 1.5); **JPEG q90**; capture on the main thread (p99 far under 20 ms); the executor settles 300 ms after each scroll | worker capture → lower scale → `beginFrame` (`Needs decision:`) |
| S-D2 | Trusted clicks under covers; controls vs the app's menus | **Trusted CDP input lands everywhere** behind the §2.1 check (scroll to centre, rect stable over two frames, `elementsFromPoint` ignoring the overlay, inset points). Events from the controls are best consumed by a **window capture listener** the bootstrap registers before any app code: stopping them at the host keeps Radix-style (bubble) menus open, but capture-phase listeners still see them | 20/20 landed and logged as trusted (header 4, banner 4, nested scroller 4, iframe 4, modal dialog 4), 16 of them covered or clipped before the check, 0 synthetic fallbacks. Menu: host-stop and window-stop both kept it open across 5 control clicks with focus left in the menu; a capture-phase listener saw 5 of 5 with host-stop and 0 with window-stop; with no stopping, the first click closed it (`spikes/results/spike2-clicks.json`) | trusted input with the check; window-capture event consumption; controls `preventDefault` on `mousedown`, so they never take focus | synthetic input, logged |
| S-D3 | Overlay hosting: the popover top layer vs `showModal`, `popover=auto`, full screen | **A hybrid.** The popover host, re-shown on every top-layer change, draws on top in every case, but its controls are inert under a modal dialog and under full screen (Chromium makes everything outside the fullscreen element inert too), and a control click light-dismisses an app's `popover=auto`. Compass's portal fails for `popover=auto` and full screen. So the **drawing** stays in the popover, and only the **controls** move into the topmost modal dialog, the fullscreen element or the app's open auto popover | Popover re-shown: drawn 4/4, clickable 2/4. Popover never re-shown: drawn 1/4. Compass portal: drawn 2/4, clickable 2/4. Hybrid: 4/4 drawn and clickable, but the auto popover closed. Hybrid with popovers: 4/4 drawn, 4/4 clickable, 4/4 app elements kept. Pixel checks (pointer magenta, bar yellow), `elementFromPoint` and screenshots for all 20 cells (`spikes/results/spike3-toplayer.json`, contact sheet read back) | **The hybrid** (§2.1 "Overlay"); the film has no controls, so it uses the popover alone | Compass's portal into the topmost dialog |
| S-D4 | Continuity and white flashes across full page loads | **No white flashes, with or without PaintHolding.** New headless keeps the old page on screen until the new one paints, so a load shows as a held last frame, as long as the server takes. Playwright's defaults stay. The init script re-arms on each load, an SPA route doesn't re-arm, and the host-held `seq` carries on | 4 runs (PaintHolding off/on × 120/400 ms latency): 0 white frames, max mean luma 31 against a base of 26; 3 held frames per tour of 149 ms (120 ms latency) and about 420 ms (400 ms); re-armed on each of 4 loads with `doc` up by one each time, `seq` strictly increasing over 36–47 events plus `nav` events; the `/spa/settings` route came as `navigatedWithinDocument` (`spikes/results/spike4-pageload.json`) | Playwright's default arguments (no PaintHolding change); verify exempts a motion gap that starts at a `nav` load; the host also holds the pointer's position, which re-arms at the centre | crossfade at `nav` in post |

### Reconciliations (the newer decision wins)

| Source | Says | Resolution |
|---|---|---|
| gods-eye PLAN §2/§3 (S9, Session 7 film mode) | Captions are drawn in the page (`FilmCaption`) and captured | **D15 wins.** ASS burn-in after scaling. In-page captions are for Watch only. (The tracker already noted the plate can cover what it describes.) |
| gods-eye `?tour=&tourMode=&tourStep=` | Deep-link parameter names | **Namespaced `?showcase=&showcaseMode=&showcaseStep=`**, so they never clash with an app's own `tour` parameter |
| gods-eye persistence (sessionStorage; film runs never restored) | Run state lives in the page | **D7:** host-owned when injected (it survives page loads and cross-origin hops); sessionStorage only in-app |
| gods-eye's overlay portalled into the topmost dialog (`host.tsx`) | Top-layer handling | **The popover host is the default; the portal is the fallback.** Spike 3 decides |
| gods-eye Session 9's `Needs review:` checkpoint | A checkpoint row | **D14:** `Needs decision:`, because `/session` treats any other ⛔ as a failed gate |
| gods-eye's recorder spec: camera crop in post, DPR up to 2 | Camera zoom in v1 | **D19:** deferred to v1.1 with `perspective`; v1 uses `browser.scale` |
| gods-eye `.env.local` only (C7) | Where the key lives | **D6:** the user-level file, with an ignored `.env.local` as an override |
| cc-star-skills: new plugins start at 1.0.0; tests are scratch-only | Conventions | **D1:** 0.x until release, because nothing is pushed mid-build. **D10:** tests committed |
| gods-eye `film:voice` uses `tsx` | How the scripts run | **D10:** Node runs the TypeScript natively, so there's no `tsx` |

### Conventions for this roadmap

- **C1 · Secrets.**
  - Only `toolkit/lib/env.ts` reads keys, and only `toolkit/voice/tts/openrouter.ts` sends one.
  - Nothing prints, logs or commits a key. Tests use a canary value.
  - Never open, cat or grep `~/.config/showcase/.env`, a `.env*` file or `showcase/.auth/`. Use `showcase keys status`.
  - Child processes get the policy from §2.3.
- **C2 · Dependencies.**
  - Runtime: `playwright-core@1.63.0` only, installed to the cache.
  - Dev: `typescript`, `esbuild`, `playwright-core`, plus `@types/node` (added in Session 1: `tsc --noEmit` can't check Node code without it; typings only, never shipped).
  - Any new dependency needs a decision recorded here.
- **C3 · TypeScript.**
  - Erasable syntax only: no enums, no constructor parameter properties, no namespaces.
  - `.ts` import specifiers.
  - In `tsconfig`: `erasableSyntaxOnly`, `verbatimModuleSyntax`, `allowImportingTsExtensions`, `noEmit`, `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`.
  - `toolkit/spikes/` has its own `tsconfig.json`, which adds the DOM lib for its `page.evaluate` code; `npm run typecheck` checks both, so Node code still sees no DOM globals (Session 2).
  - `toolkit/runtime/` (browser code) and `toolkit/host/` (Node, with the DOM lib for the runtime's types; it also takes `toolkit/test/runtime/`) have their own too, and the root excludes them (Session 4). `npm run typecheck` runs all four.
  - The CLI's commands import the host, so the host's import graph stays free of DOM types: what the host and the page say to each other (the binding's messages, the snapshot and commands, the voice manifest and `inspect`'s outline) is in `runtime/src/protocol.ts`, types only, and in-page work is called by name (`__showcase.inspect()`, `__showcase.visibleText()`) (Session 5).
- **C4 · The runtime** imports nothing from Node or any framework (a test enforces it). `dist/` is rebuilt with `npm run build:runtime` and must be fresh (a test enforces the stamp).
- **C5 · Timing is driven by narration:** a sentence lasts `durationMs` from the manifest, else `readingMs`. Muting never changes timing.
- **C6 · Writes are idempotent:** every `write` has `done`, and fast-forward and re-show never write twice.
- **C7 · CLI output** is terse, with `--json` for anything Claude parses. Exit codes: 0 ok, 1 failure, 2 usage. Long runs `--detach` with `progress.json`.
- **C8 · UK English** in docs, CLI messages and commit messages.
- **C9 · Fixtures** live under `toolkit/fixtures/`. Generated output goes under `toolkit/test/.out/` (ignored). Nothing large is committed: no video, and only tiny audio fixtures.
- **C10 · Commits.**
  - Subject: `SKILLZ-01: <Imperative summary> (showcase S<n>)`; release commits end `(showcase v1.0.0)`.
  - Body wrapped at about 72 columns, ending with the `Co-Authored-By:` line the harness specifies.
  - One commit per session.
- **C11 · Session summaries** go to `.planning/sessions/<date>-<slug>.md` in the `wrapup` skill's format, with `**Roadmap:** .planning/showcase-plugin`, and people named by role.
- **C12 · Nothing is pushed** before Session 13, and then only on the user's go (the marketplace auto-updates from GitHub). gods-eye is never modified. Star is modified only in Sessions 12–13, with the user's go.

## 4. How the sessions work

- **Instructions.** `prompts/session-N.md` is each session's single source of instructions. Running **`/session`** does all of the following.
- **Each session:**
  1. Reads this PLAN.md (authoritative) and `TRACKER.md`, confirms the previous row is ✅, then marks its row 🟡.
  2. Reads its reading list, with gods-eye as a read-only reference.
  3. Works within its **Boundaries**.
  4. Runs its **Verification gate** for real. Sessions with screens or stills read them back.
  5. Updates `TRACKER.md` (its row, plus a session-log entry with the `Runtime:` it ran at) and writes the session summary (C11).
  6. Commits once (C10) and surfaces the next kickoff prompt.
- **When a session can't finish:**
  - A gate fails → mark ⛔, record the blocker, commit and **stop**.
  - It needs a decision this plan doesn't settle and it can't ask → mark ⛔ `Needs decision: <question — options>`, commit and **stop**.
- **Checkpoint protocol** (Sessions 9, 12 and 13; D14):
  - **Headless (autopilot):** set the row to ⛔ `Needs decision: run Session N interactively — <what to review and how>`, write the summary, commit and stop.
  - **Interactive:**
    1. Look for notes under `TRACKER.md › Review notes › <heading>` or a Review-notes entry in §3.
    2. If there are none, show the artifacts and ask with AskUserQuestion: Approve as-is · I have notes · (session-specific options).
    3. "Approve as-is": run the gate, mark ✅. Notes: turn them into a numbered checklist, implement it, run the gate.
- **Working directories:**
  - Sessions 1–11 run in this repo. Interactive runs need `claude --add-dir ~/_PRJ/gods-eye`; autopilot's `bypassPermissions` covers reading it.
  - Sessions 12–13 run **from Star**:
    `cd ~/_PRJ/star && claude --plugin-dir ~/_PRJ/cc-star-skills/plugins/showcase --add-dir ~/_PRJ/cc-star-skills`, then `/session ~/_PRJ/cc-star-skills/.planning/showcase-plugin`.
    - Star's changes commit in Star, with the user's go.
    - The plugin's fixes, the tracker and the summary commit in cc-star-skills (`git -C`).
- **Branching.** Sessions commit to `main`, as this repo's history and `/session` do. `autopilot --branch showcase-v1` keeps `main` clean until the release.
- **Open items** (TRACKER):
  - `OPENROUTER_API_KEY` in the user file. Session 6's audition and Session 12's final voice need it; the draft voice covers everything else.
  - The notes for Sessions 9, 12 and 13.
  - The user's availability for the by-hand sessions.
  - The go to push.
- **Skills:**
  - `run`, to launch apps and take screenshots;
  - `claude-code-guide` (an agent), to check current Claude Code contracts (hooks, plugin manifest, evals) before relying on them.

> **Runtime profiles.** Each session carries a `Runtime:` line (model / effort) — advice for a human running it by hand (`/model`, `/effort`) and a contract for `/autopilot`, which applies it per session. When a run makes no tracker progress autopilot classifies it first — needs a human, environment failure, yielded early, or a genuine stall — and only a stall is escalated (same model at `max`, then the next model up). Each session's log entry records the `Runtime:` it actually ran at.

## 5. The 13 sessions

### Phase A — Foundations

#### Session 1 — F1 · Foundation: plugin skeleton, CLI, keys, doctor

**Objective.** The `showcase` plugin exists, with a working CLI, key handling that travels between repos, and a prerequisites check: the base every later session builds on.

**Do.**
1. **Plugin metadata:**
   - `plugins/showcase/.claude-plugin/plugin.json`: name `showcase`, version `0.1.0`, the description, author (Kam Star, kam@kamstar.net), homepage and repository (`https://github.com/AgentBlitz/cc-star-skills`), keywords (video, demo, tour, narration, tts, playwright, film), and `"dependencies": ["planning"]`.
   - No marketplace entry yet (Session 11).
2. **`plugins/showcase/package.json`:**
   - `"private": true`, `"type": "module"`.
   - Scripts: `test` (`node --disable-warning=ExperimentalWarning --test "toolkit/test/**/*.test.ts"`), `typecheck` (`tsc --noEmit`), `build:runtime` (a placeholder until Session 4, real from it).
   - Dev dependencies: `typescript`, `esbuild`, and `playwright-core` pinned at exactly `1.63.0`.
   - `tsconfig.json` per C3.
   - The root `.gitignore` gains `**/showcase/out/`, `**/showcase/.cache/`, `**/showcase/.auth/` and `plugins/showcase/toolkit/test/.out/`.
3. **`bin/showcase`** (bash, mode 755):
   - resolves its own directory through symlinks;
   - checks `node` exists, its major version is ≥ 24 and `process.features.typescript` is set, else prints a one-line hint;
   - then `exec node --disable-warning=ExperimentalWarning "$DIR/../toolkit/cli.ts" "$@"`.
4. **`toolkit/cli.ts`:** a `node:util` `parseArgs` router with a subcommand registry, per-command `--help`, `--json`, and the exit codes in C7.
5. **`toolkit/lib/`:**
   - **`log.ts`**: human output vs `--json`.
   - **`redact.ts`**: a port of gods-eye's, masking loaded key values (6+ characters), Bearer, `authorization:`, and `key=`/`token=`/`api_key=`.
   - **`env.ts`**, the only key reader (§2.3):
     - resolution order and source reporting;
     - `git check-ignore -q`, `util.parseEnv` and the mode checks.
   - **`child-env.ts`** (§2.3 policy).
   - **`ffmpeg.ts`**: a port of gods-eye's discovery (`FFMPEG_PATH`/`FFPROBE_PATH`, the Homebrew paths, `which`), plus a capability probe for these filters and encoders: ass/subtitles, aresample with soxr, perspective, loudnorm, ebur128, alimiter, silenceremove, libx264, aac, libmp3lame.
   - **`playwright.ts`**: resolves `SHOWCASE_PLAYWRIGHT_CORE`, then the plugin's own `node_modules` (dev), then the cache.
     - `install()`: `npm install --prefix <cache>/pw-1.63.0 --ignore-scripts playwright-core@1.63.0`.
     - The Chromium check (the executable path exists), else `node <cache>/…/playwright-core/cli.js install chromium`, only with `--yes`.
   - **`paths.ts`**: config, cache, plugin root, and the repo root via `git rev-parse --show-toplevel`.
6. **Commands:**
   - **`doctor [--json] [--install]`**: the capability matrix in §2.2, plus platform notes.
   - **`keys status|init|import <file>|test|set`** (§2.2–2.3):
     - `test` confirms OpenRouter's `GET /api/v1/key` endpoint and its response shape in this session, and prints only non-secret fields;
     - `set` uses `node:readline` with muted output and refuses without a TTY;
     - `import` refuses to overwrite without `--force`.
   - **`shim`**: writes `~/.local/bin/showcase`, which finds the newest `~/.claude/plugins/cache/*/showcase/*/bin/showcase`, else the dev checkout recorded when the shim was written. It warns if `~/.local/bin` isn't on PATH.
   - **`docs [topic]`**: lists or prints `skills/showcase/reference/<topic>.md`, and says so when there are none yet.
7. **`hooks/hooks.json`:**
   - A PreToolUse hook on `Read|Grep|Glob|Bash|Edit|Write|NotebookEdit` runs `${CLAUDE_PLUGIN_ROOT}/hooks/guard-keys.sh`.
   - The script is plain bash and grep (it runs on every matching tool call in every session). It denies a call whose input names the user key file, in its `~`, `$HOME`, `$XDG_CONFIG_HOME` and `$SHOWCASE_CONFIG_DIR` forms, or `showcase/.auth/`.
   - The deny reason points at `showcase keys status`.
   - **First** confirm the current hook input and output contract with the `claude-code-guide` agent.
8. **`skills/showcase/templates/env.template`:**
   - `OPENROUTER_API_KEY=`;
   - the `SHOWCASE_TTS_*` overrides;
   - the reserved provider names, commented out.
9. **Tests** (`toolkit/test/`):
   - env precedence, using temp dirs and a scratch git repo with an ignored and an unignored `.env.local`;
   - mode refusal;
   - `process.env` untouched by `util.parseEnv`;
   - redaction: a canary key in a thrown error or fetch body never reaches stdout or stderr;
   - `keys status` and `keys import` never print the value;
   - the guard script denies sample hook payloads that name the file and allows others;
   - ffmpeg capability parsing;
   - CLI routing and exit codes.

**Boundaries.**
- No tour, runtime, voice or film code.
- Don't touch other plugins, `marketplace.json` or the README.
- Never read or print a real key; tests use a canary only.
- gods-eye is read-only.

**Verification gate.**
- In `plugins/showcase`: `npm install`, then `npm test` and `npm run typecheck` pass.
- `bin/showcase doctor --json` on this Mac shows every capability present: the ffmpeg 8.0.1 filters; playwright-core found or installed into the cache, with Chromium 1243; `say` with an en-GB voice.
- `bin/showcase keys status`:
  - from `/Users/kstar/_PRJ/gods-eye`, it reports the source of `OPENROUTER_API_KEY` without the value;
  - from a scratch dir, it reports the user file's state.
- The canary and hook tests pass.
- `claude plugin validate plugins/showcase` passes.

**Runtime:** opus / medium — establishes the CLI's conventions and key handling; canary-key tests are a strong gate

#### Session 2 — F2 · Spikes and the fixture app

**Objective.** Settle the four riskiest technical questions by measurement, on a purpose-built fixture app, and record the verdicts, so Sessions 4–8 build on facts.

**Do.**
1. **The fixture app, `toolkit/fixtures/app/`:**
   - Zero dependencies, served by `toolkit/fixtures/serve.ts` (`node:http`, its own port).
   - Pages: `index.html`, `list.html` and `detail.html` (three linked pages, for full page loads), and `spa.html` with a History-API route.
   - Elements:
     - a sticky header and a dismissable cookie banner;
     - a Radix-like menu that closes on an outside click;
     - a modal `<dialog>` (`showModal`);
     - a nested scroll container and a same-origin iframe;
     - a form with text, select, checkbox and contenteditable fields;
     - a hover-only menu, a drag with a drop zone, an animated canvas and a spinner;
     - a file input and a `window.open` link.
   - Realistic roles and labels, and **no test ids**, as in Star.
2. **The spike harness, `toolkit/spikes/`**, using playwright-core (committed as evidence, not shipped):
   - **Spike 1, capture:**
     - CDP `Page.startScreencast` over a scripted motion sequence: a smooth scroll, ten pointer trips, the spinner and the canvas.
     - At scale 1, 1.5 and 2 (the viewport is 1920×1080 divided by the scale, at DPR equal to the scale), with JPEG at q80 and q90.
     - Measure the 5th-percentile and median fps, the largest gap, the event-loop p99 (`monitorEventLoopDelay`), MB/s, and the page's own rAF rate.
   - **Spike 2, trusted clicks:**
     - 20 clicks on targets under the sticky header, behind the banner, in the scroller, in the iframe and in the open dialog, with a `pointer-events:none` overlay present.
     - Prove all 20 land.
     - Prove a click on overlay controls never closes the app's menu (propagation stopped at the host).
   - **Spike 3, the top layer:**
     - Test `<showcase-overlay popover="manual">` (a shadow root on `<html>`) against `showModal()`, `popover=auto` and `requestFullscreen()`.
     - For each: is it drawn on top (screenshots plus `elementFromPoint`), and are its controls clickable (inertness)?
     - Compare with Compass's portal into the topmost dialog.
   - **Spike 4, page-load continuity:**
     - A three-page tour by link clicks, while capturing.
     - Count white-flash frames with Playwright's default arguments, and with `PaintHolding` re-enabled (`ignoreDefaultArgs`, removing it from `--disable-features`).
     - Prove the init script re-arms on each load and a host-held sequence number carries on.
3. **Record the verdicts:**
   - Fill in §3 "Spike verdicts" (S-D1…S-D4) with the numbers, the chosen defaults (default scale, JPEG quality, overlay design, page-load handling) and the fallbacks.
   - If a verdict changes something §2 says, update §2 to match and note it in the session log.

**Boundaries.**
- No production runtime or host code. The harness is evidence-quality.
- Don't change Session 1's CLI behaviour.

**Verification gate.**
- The fixture serves, and every page loads without console errors.
- Every spike has measured numbers and a verdict in §3.
- Spike 2: 20 of 20 clicks land, and the controls never close the app's menu.
- Spike 3: a screenshot and `elementFromPoint` evidence for each top-layer case.
- `npm test` still passes.

**Runtime:** opus / high — four measured spikes decide the runtime's design; the gate only checks that verdicts exist

#### Session 3 — T1 · Tour format and narrative rules

**Objective.** A validated tour format, with the narrative rules as code: the contract every later session and every target repo builds on.

**Do.**
1. **The schema.** `toolkit/schema/tour.schema.json` (a JSON Schema 2020-12 subset) is the single source.
   - `toolkit/runtime/src/schema.ts` is a small interpreter for the keywords used (about 250 lines), plus cross-field checks:
     - unique ids;
     - `after` naming an action in the same beat;
     - `write` needing `done`;
     - `navigates` last in its beat;
     - every `@anchor` resolving;
     - caption limits.
   - It also holds the TS types. It's browser-safe and shared with the CLI.
2. **Config validation:** `toolkit/schema/config.schema.json` and `toolkit/lib/config.ts`, for `showcase/config.json`.
3. **`toolkit/runtime/src/narrative.ts`** (shared):
   - `readingMs`;
   - the length presets, kind factors and beat counts from §2.8;
   - greedy caption wrapping (2 × 42);
   - the `firstToCut` rule (2:00 or more);
   - the last-card hold (2 s or more);
   - spoken-number detection.
4. **`check <tour>`:** static, no network. It covers schema, cross-field rules, budgets (the narration window by preset and kind), captions, the static spoken-number rule, `firstToCut`, card holds, `navigates`, and whether the storyboard is stale. It prints rule ids (`T001`…), with `--json`.
5. **`storyboard <tour>`:**
   - It writes `showcase/storyboard/<tour>.md`, deterministically: a meta header; a beats table with planned starts, path, actions, narration, words and pacing; and a hash comment that `check` compares.
6. **`init`** is idempotent. It writes `showcase/config.json`, `showcase/.schema/`, `showcase/tours/`, and the repo-root `.gitignore` lines.
7. **Templates:** `skills/showcase/templates/tour.{pitch,walkthrough,spotlight,howto}.json` (the spines in §2.8, with placeholder narration that passes `check`) and `config.json`.
8. **The golden.** Port gods-eye's `src/ui/tour/tours/pitch.ts` (narration, beats and cards; actions may be simplified, with placeholder anchors) to `toolkit/test/golden/compass-pitch.json`. It must measure 100.8 s of `readingMs` narration and pass every rule.
9. **Docs:** `skills/showcase/reference/tour-format.md`, `narrative.md`, and a draft `interview.md` (§2.8).
10. **Tests:**
    - the golden at 100.8 s;
    - the templates pass;
    - at least 12 negative fixtures, each failing with its expected rule id;
    - storyboard determinism;
    - `init` idempotence.

**Boundaries.**
- No engine (Session 4).
- `schema.ts` and `narrative.ts` stay browser-safe.
- gods-eye is read-only.

**Verification gate.**
- The tests above pass, along with `npm test` and `npm run typecheck`.
- `showcase check` on each template is clean.
- `showcase docs tour-format` prints the doc.

**Runtime:** opus / medium — the schema's shape is specified in PLAN; a golden plus negative fixtures gate it

### Phase B — The runtime

#### Session 4 — R1 · Runtime I: the engine

**Objective.** The in-page engine — director, executor, anchors, readiness, clocks, run state and film events — bundled, and proven headless on the fixture app.

**Do.**
1. **`toolkit/runtime/src/`:**
   - **`capture.ts`:** top frame only. It captures the real `Date.now`, `performance.now`, timers, rAF and input value setters before app code.
   - **`clock.ts`:** pace, wall and ticker, on the captured timers.
   - **`anchors.ts`:** role and name (a subset of accessible-name computation), label, test id, text and CSS; visible first; open shadow roots; same-origin frames; `@name`.
   - **`ready.ts`:** the predicates, on a MutationObserver plus a 100 ms poll on the wall clock. Anchors time out at 10 s and readiness at 30 s.
   - **`dom-events.ts`:** a port, plus `beforeinput` for contenteditable and `DataTransfer` uploads.
   - **`executor.ts`:** the action kinds, Compass's rules, clickability checks, the acting window, trusted input through the bridge with synthetic fallback, `done`, and the journal.
   - **`director.ts`:** Watch and film only. Two tracks, `after` gates, dwell, Next and Back re-show, and fast-forward.
   - **`state.ts`:** host-backed or sessionStorage.
   - **`film-events.ts` and `timeline.ts`:** the §2.1 contract, with `filmOrderProblems` ported.
   - **`bridge.ts`:** `__showcaseHost(msg)` for input, state, assets and events, and `__showcaseGo()`.
   - **`index.ts`:** the external boot (the in-app boot is Session 10).
2. **Port, don't copy:** erasable syntax only (C3), dropping Present, notes and Compass's server.
3. **`npm run build:runtime`** (esbuild) writes `toolkit/runtime/dist/showcase-runtime.iife.js`, `.mjs` and `.d.ts`, plus `dist/STAMP`, a hash of `src/`.
4. **`toolkit/host/` skeleton,** enough for tests: launch Chromium through playwright-core, `addInitScript` the IIFE, expose the binding.
5. **Tests,** in real Chromium on the fixture:
   - every action kind works with trusted input;
   - covered targets are handled;
   - a full page load mid-tour resumes without repeating writes or sentences;
   - a missing anchor raises `film:error` naming the beat;
   - Back re-shows without writing, and fast-forward applies writes silently;
   - the director runs on a fake clock;
   - the bundle is fresh;
   - the runtime imports nothing from Node or any framework.

**Boundaries.**
- No overlay visuals beyond a pointer stub (Session 5).
- No audio (Sessions 5–6).
- No capture (Session 7).

**Verification gate.** Every test above passes headless, along with `npm test` and `npm run typecheck`, and the stamp is fresh.

**Runtime:** fable / high — clocks, two-track timing and resume-without-rewrite invariants are subtle and system-wide

- **As built (2026-10-09):** as planned, plus what later sessions build on:
  - **The bridge** is one binding, `__showcaseHost(msg)`: `input` (move, click, down, up, wheel, key, type, upload), `state` (load, save, clear), `asset`, `event`, `log`, `ready` (a document booted) and `snapshot`. The host starts a film with `__showcaseGo()`. The page API is `window.__showcase` (`dispatch`, `snapshot`, `events`, `start`, `actions.register`, `acting`).
  - **Run state** (`state.ts`): step, beat, position `{action, sentence, speaking, stage}` with stages `begin → tracks → nav → ready → dwell`, `entered`, `target` (a fast-forward in progress), the journal, `seq`, `doc`, `rolling`, `filmBeats`, `paused`, the pointer. The runtime stamps `seq`; the host bumps it for `nav`; `doc` goes up at each boot.
  - **A `navigates` action** runs after both tracks, stage `nav` persisted first; the next document waits for its `done`, journals it and emits its `done` phase. A sentence cut by an unmarked load is ended in the next document, not repeated.
  - **Re-show** leaves out the reads before a write **the journal** holds; a `done` that happens to hold before a write doesn't count.
  - **Executor details:** `scroll … until` means on screen (the scroller is brought on screen first); `select` hovers with the real mouse then sets the value as Playwright's `selectOption` does; trusted `upload` is `setInputFiles` on the element; trusted `type` clicks to focus, select-all + Backspace, then types per character; `key` uses Playwright's spelling; cosmetic kinds (left out of a fast-forward) are spotlight, hover, focus, camera, card, hold and `wait` without `until`.
  - **The overlay contract** is `OverlayPort` (`overlay-port.ts`); Session 4 ships a pointer stub.
  - The runtime never boots on `about:blank`. `narration.ts` carries a draft `VoiceManifest` shape (`{v, id, tour, clips[{beat, text, hash, file, durationMs}]}`) and an FNV-1a `narrationFingerprint` for Session 6 to firm up.

#### Session 5 — R2 · Runtime II: overlay, host, Watch, rehearse and inspect

**Objective.** The tour becomes visible and playable: the overlay, the full host, the live demo, the rehearsal loop and anchor discovery.

**Do.**
1. **The overlay** (`toolkit/runtime/src/overlay/`), per S-D3: §2.1's design, every piece, and the hygiene rules.
2. **Audio in the runtime:** manifest lookup, `HTMLAudio` from Blob URLs delivered through the bridge, timing independent of mute.
3. **The full host** (`toolkit/host/`):
   - **App lifecycle:** `app.build`, `start`, `url`, `health` and `env`; port allocation; a per-repo lock; process-group kill; the `snapshot` and `reset` hooks.
   - **Launch:** new headless or headed; scale (with `--force-device-scale-factor`, S-D1); locale, timezone and colour scheme.
   - **The clock:** `setFixedTime`, registered after the runtime's init script.
   - **Browser options:**
     - `bypassCSP` and `serviceWorkers: 'block'`;
     - `block` through `Network.setBlockedURLs`, and `hide` through an injected style;
     - file-chooser fixtures, `beforeunload` accepted, popups kept in the same tab, clipboard permissions;
     - page-load handling per S-D4.
   - **The binding:** trusted input through `page.mouse` and `page.keyboard`, state, assets and events, with "context destroyed" tolerated.
4. **Commands:** `watch` (headed, maximised, the autoplay flag, its keys, `--detach`), `rehearse`, `inspect`, `auth`, and `storyboard --stills --html` (§2.2).
5. **Config:** `browser.*` and `privacy.deny` are supported.
6. **Tests** on the fixture:
   - the overlay over a modal (`elementFromPoint`), with the controls clickable in Watch;
   - a planted deny-list string fails and names its beat;
   - `rehearse` is clean three times at ×10;
   - `inspect` suggests role-and-name anchors;
   - a headed `watch --detach` smoke test exits cleanly.

**Boundaries.**
- No synthesis (Session 6); use a fixture manifest for audio.
- No capture (Session 7).

**Verification gate.**
- The tests above pass.
- Claude reads back the stills from one `rehearse`.
- `npm test` and `npm run typecheck` pass.

**Runtime:** opus / high — top-layer, trusted-input and process-lifecycle quirks; part of the gate is reading screens back

- **As built (2026-10-09):** as planned, plus what later sessions build on:
  - **The overlay** is `runtime/src/overlay/` (`index.ts`, `top-layer.ts`, `place.ts`, `styles.ts`), replacing the stub. The bootstrap installs the top-layer patches (`showModal`, `showPopover`, `togglePopover`, `requestFullscreen`; `toggle`, `close`, `fullscreenchange`) and the control guard (a window capture listener per pointer, mouse, focus, touch and wheel type) before any app code; the overlay subscribes to both. Its DOM is built with `createElement` (Trusted Types). The UI is `watch` (controls, captions, end card), `rehearse` (no controls; captions linger for the beat's still; no motion) or `film` (popover only, no captions, D15). A spotlight follows its element (a frame loop) with its callout placed by Compass's `placeCallout`; a card hides the spotlight and the pointer.
  - **Watch keys and controls** go through one `command()`: toggle, back, next, mute, exit, retry, skip. Esc on a finished tour sends the host `exit`.
  - **Audio** (`runtime/src/audio.ts`): clips come through the binding as `asset` with `kind: "voice"` (resolved in the manifest's dir), play from Blob URLs on one `<audio>`, `play` resolves on `playing` or after 300 ms; mute is `muted` only and is kept in sessionStorage across loads. All of a manifest's clips are fetched ahead. The snapshot carries `muted`.
  - **Rehearse checkpoints:** the director's `checkpoint` dep is awaited after a beat's `ready`, or after its tracks when it has a navigating action (so the still is of its own screen), via the binding's `checkpoint` message. `rehearse` checks spoken numbers by value (`lib/screen-checks.ts`: digits, words, percent, magnitudes; times and codes as text) and the deny-list against `__showcase.visibleText()` (body text of the page and same-origin frames plus visible field values) and a card's text.
  - **The host** is `host/{launch,app,project,rehearse,watch,inspect,auth}.ts`. `launch.ts` takes `tour: null` for a page with the API only (inspect, auth). Init scripts go config → runtime → same-tab → hide → `setFixedTime` → test scripts. Unrequested file choosers are cancelled; an `upload` aimed at a button answers the chooser it opens. The lock is `showcase/.cache/host.lock` (taken over from a dead pid); `stop()` waits for the whole process group, then SIGKILLs. `SHOWCASE_RUN_MARKER` puts `--showcase-run=<marker>` on Chromium's command line (a test aid).
  - **The voice manifest** for Watch is `--manifest`, else `<voice.dir>/<tour>.manifest.json` (Session 6), else a hand-made `<voice.dir>/manifest.json` when its `tour` matches (`host/project.ts › voiceFor`).
  - **The fixture project** `toolkit/fixtures/showcase/` (config with `{port}`, `fixture-tour` of 8 beats over 3 pages, its storyboard, a hand-made draft manifest and one 0.6 s clip) is what rehearse, watch and Session 6's audition run on.
  - **A Session 4 fix:** a run resumed after a step's own page load treated the first beat's navigating action as already dispatched; only a resume at stage `nav` does now.

### Phase C — Voice and film

#### Session 6 — V1 · Voice

**Objective.** Every tour sentence gets narration audio from one portable pipeline, with an audition to choose the narrator.

**Do.**
1. **Providers:** port gods-eye's `scripts/film` providers into `toolkit/voice/` (`openrouter`, `say`, `fake`) behind `TtsRequest` and `TtsResult`, with §2.4's four fixes.
   - `say` checks that it exists, defaults to Daniel at 24 kHz, and falls back to the fake off macOS with a warning.
2. **The pipeline:**
   - lexicon;
   - the synth and file keys, including the post settings;
   - the processing chain and duration check;
   - the manifest (sorted, no timestamps, `spoken` stored when the lexicon changed the text);
   - status (missing, stale, draft, fresh).
3. **`voice <tour>`,** with `--draft`, `--final`, `--check` (no network or key needed), `--yes` with `--max-chars`, `--redo`, `--prune`, `--dry-run` and `--audition`.
   - It prints the pacing table against the preset's window, and writes the manifest and clips to `voice.dir`.
4. **`voices --list`:** the catalogue, without a key.
5. **`skills/showcase/reference/voice.md`.**

**Boundaries.**
- Playback exists already (Session 5).
- No film (Sessions 7–8).
- Never print keys (C1).

**Verification gate.**
- The fake provider runs through real ffmpeg.
- Mocked-fetch tests cover format memory, 429, a network-error retry, 401 and 402 neither retried nor echoed, and the canary key.
- Draft clips measure mono, 24 kHz, −16 ± 1 LUFS (ebur128).
- Editing a sentence flips `--check` to missing; changing the post settings re-processes.
- With the key present (`keys status`): `voice --audition --yes` on the fixture tour stays within 1,500 characters and writes the page.
- `npm test` and `npm run typecheck` pass.

**Runtime:** sonnet / high — a port of the proven gods-eye pipeline with four known fixes; mocked-fetch and ffmpeg tests

**As built (Session 6).**
- **`toolkit/voice/`:**
  - `tts/{openrouter,say,fake}.ts` behind `TtsRequest`/`TtsResult` (`types.ts`), with the four fixes:
    - one pool, three in flight, covering synthesis and processing (`pool.ts`);
    - the post settings in the file name, so a changed setting makes every clip stale and re-processes from the raw cache;
    - retries on a thrown fetch, 429 and 5xx at 1, 3 and 9 s with `Retry-After` honoured (capped at two minutes);
    - the format chain remembered per model, and on disk in the raw cache's `formats.json`.
    - A 401, 403 or 402 is never retried and its body is never read; it also stops the rest of the queue.
  - `keys.ts` (`synthKey`, `fileKey`, `POST` with a `chain` version), `lexicon.ts` (a single pass, longest key first), `audio.ts` (the chain, async), `manifest.ts`, `setup.ts` (narrator + `SHOWCASE_TTS_*` overrides, draft fallback, key via `env.ts` only), `pipeline.ts` (`plan` is pure; `run` does the work; `pacing`), `audition.ts`, `catalogue.ts`.
- **Commands:** `voice <tour>` (`--draft --final --check --yes --max-chars --redo beat/n --prune --dry-run --audition`) and `voices --list [--model]`.
- **The manifest is `<voice.dir>/<tour>.manifest.json`, one per tour.** It is the runtime's `{v, id, tour, clips[]}` plus `narrationMs`, `voices`, `post` and, per clip, `n`, `take`, `synth`, `voice` and `spoken`. Clips are named by hash, so tours share the directory. `protocol.ts` was left alone (so `dist/` and its stamp are unchanged).
- **Modes.** Default: the narrator if one is configured and the key is set, else the draft; clips that are already current are kept (narrator clips too, when the key is absent). `--final`: the narrator only. `--check` needs no key, network or ffmpeg and accepts either voice unless `--final`.
- **`--max-chars`** caps characters sent to OpenRouter in a run (not per sentence); the audition's own default is 1,500.
- Reference doc: `skills/showcase/reference/voice.md`.

#### Session 7 — F3 · Film I: capture and video

**Objective.** The recorder captures a tour from the real app and produces a constant-frame-rate H.264 video aligned to the tour's timeline.

**Do.**
1. **`film <tour> --video-only [--detach]`:**
   - **The take:** production-build guidance; its own port, snapshot, reset and health; headless at S-D1's default scale, with a fixed clock, `reducedMotion: 'no-preference'`, `--force-color-profile=srgb`, and the SwiftShader check when `gpu` is `required`.
2. **Film mode in the runtime:**
   - arming (fonts, then 400 ms with no new frames);
   - `film:armed`, then `__showcaseGo()`;
   - events over the binding, with the host keeping the log across reloads.
3. **Capture:** CDP `Page.startScreencast` at S-D1's quality, acknowledged at once, through the bounded queue with delayed acknowledgements, with the worker fallback.
   - Also the clock-sync probe (a flash at a known timeline time), a 750 ms pre-roll, a watchdog and a 1.2 s tail.
4. **Encode:**
   - the 30 fps CFR schedule;
   - BT.601 full to BT.709 limited, with the output tagged;
   - x264 at CRF 17, preset slow, High profile, yuv420p, with keyframes at beat starts.
5. **Outputs:** `timeline.json`, and `progress.json` for `--detach`.

**Boundaries.**
- No audio or captions (Session 8).
- Camera events are recorded only (D19).

**Verification gate.**
- ffprobe shows 1920×1080, constant 30 fps, H.264 High, yuv420p, tagged BT.709.
- The largest motion gap is ≤ 100 ms.
- The sync probe is within 0–100 ms.
- The duration equals the timeline to within one frame.
- No app, Chromium or ffmpeg process is left behind.
- `npm test` and `npm run typecheck` pass.

**Runtime:** opus / high — first recorder session: backpressured capture and frame-to-timeline sync, gated by ffprobe

**As built (Session 7).**
- **`toolkit/film/`:** `record.ts` (the take, the watchdog, measuring, the checks), `capture.ts` (main-thread screencast, the event-loop monitor, quiet detection, the hand-off to the worker), `capture-worker.ts` (a raw CDP WebSocket in a worker thread), `frames.ts` (the bounded queue: 120 frames, then acks wait for writes), `cfr.ts` (the 30 fps schedule, gaps, frame rate; pure), `timeline.ts` (spans on the video's clock; pure), `encode.ts` (hard-linked CFR sequence → x264; ffprobe; the probe's patch colours). The command is `commands/film.ts`.
- **`film <tour> --video-only [--detach] [--capture auto|main|worker] [--keep-frames] [--out] [--base] [--no-build] [--no-reset]`.** Without `--video-only` it exits 2 until Session 8. The film runs `app.build` by default (`--no-build` skips it) and notes a `start` that looks like a dev server, or a missing `app.build`.
- **The video's clock:** time 0 is the start of the 750 ms pre-roll (the host's `Date.now()`); events gain `ms = wall − t0`; the video ends 1.2 s after `film:end`. Screencast timestamps, the page's captured `Date.now()` and Node's clock are all epoch milliseconds on one machine; the probe measures the offset between the first two.
- **Arming:** the runtime's `film:armed` (fonts, two frames, 400 ms), then the host waits for 400 ms with no screencast frame (capped at 5 s; the fixture's spinner never stops, which is noted).
- **The clock-sync probe runs before the pre-roll**, so it's never in the video: a full-viewport `#ff00ff` element drawn in a known animation frame (`__showcase.film.probe()`), found in the frames by the colour of a 32×32 patch.
- **The heartbeat** (a decision of this session): from the pre-roll, a 1 px element at opacity 0 ↔ 0.01 flips every animation frame (`runtime/src/film-aids.ts`), so Chrome makes a frame on every vsync and any gap in the capture is a missed frame, not a still screen. Later documents pick it up at boot from `window.__showcaseRolling` (an init script added at the pre-roll). It also gives the page's own frame rate and its stalls (animation frames > 50 ms late).
- **The motion-gap check** takes the largest gap between captured frames over the take, exempting one that contains a `nav` load (from up to 100 ms before it starts), per S-D4.
- **The worker fallback:** Chromium gets `--remote-debugging-port=<free port>` (unless `--capture main`); after a one-second window with event-loop p99 > 20 ms, a worker opens its own session on the page's target, and the main screencast stops once the worker has a frame.
- **Colour:** `scale=…:in_color_matrix=bt601:in_range=full:out_color_matrix=bt709:out_range=limited,format=yuv420p,setparams=…bt709…:range=tv`. The `-color_*` output options alone left transfer and primaries untagged, which is why `setparams` is there. A test round-trips saturated colours.
- **Outputs:** `showcase/out/<tour>/video.mp4` (the picture; Session 8 muxes it into `<tour>.mp4`), `timeline.json` (spans, events with `ms`, `keyframesMs`, `probe`, `capture` stats, `videoProbe`, `checks`, `orderProblems`, `app`), `progress.json` (phases starting → launching → arming → probing → rolling → tail → encoding → done or failed). A failed take writes `error.png` and `timeline.partial.json`. The frames go in `.capture/` and are deleted after the encode, unless `--keep-frames`.
- **Measured on the fixture tour (M4 Max, ANGLE Metal):** 40.3 s; capture median 60 fps, p5 59; page 60 fps; largest motion gap 20–27 ms over five takes (the session's very first take had one 193 ms gap at the first click, before the stall diagnostics existed, and it hasn't come back); sync probe 18–21 ms; event-loop p99 11.7 ms; queue never above 1; about 4.9 MB/s; `video.mp4` about 2 MB.

#### Session 8 — F4 · Film II: sound, captions, outputs and verify

**Objective.** The first complete film: narration, captions, script, stills and a verification report.

**Do.**
1. **Sound:**
   - the Node mixdown (§2.5);
   - two-pass loudnorm, then `aresample=48000`;
   - AAC 192k with faststart;
   - chapters per beat (ffmetadata).
2. **Captions:**
   - ASS, one sentence per cue, at most 2 × 42 characters;
   - in a bundled open-licence font in `toolkit/fonts/`, through `fontsdir`;
   - burned in after scaling;
   - the SRT from the same timings.
3. **Outputs and verify:**
   - `script.md` (timecoded);
   - stills per beat, and `contact-sheet.png` (ffmpeg tile);
   - `report.json` and `report.md` with the §2.5 verify list;
   - `--strict`;
   - `-draft.mp4` with a DRAFT watermark;
   - verify exempts a motion gap that starts at a `nav` load (S-D4: no white flash with Playwright's defaults); crossfades at `nav` only as a fallback.
4. **`skills/showcase/reference/film.md`.**

**Boundaries.** No camera, music or 4K (D19).

**Verification gate.**
- `film --strict` is green on the fixture tour with both the fake and the `say` voice.
- The SRT equals the sentences.
- Caption and audio are within 50 ms (a beep-and-flash fixture beat).
- −16 ± 1 LUFS.
- Claude reads the contact sheet back against the narration.
- `npm test` and `npm run typecheck` pass.

**Runtime:** opus / medium — well-specified post chain with measured gates (LUFS, sync, SRT equality)

**As built (Session 8).**
- **`toolkit/film/`:** `mix.ts` (the Node mixdown, two-pass loudnorm, ebur128, levels, silences, onsets), `captions.ts` (ASS and SRT from one set of cues, the SRT check), `script.ts` (ffmetadata chapters, `script.md`), `post.ts` (draft or final, the cues, `.post/`), `verify.ts` (the checks, caption-against-sound, stills and contact sheet, the report). `encode.ts` encodes the master beside the picture from the same CFR frames (one generation; captions burned in after scaling; AAC 192k 48 kHz stereo; chapters; faststart).
- **`film <tour> [--strict]`** makes the finished film; `--video-only` is Session 7's picture-only take. Outputs: `<tour>.mp4` or `<tour>-draft.mp4` (only one is kept), `video.mp4`, `<tour>.srt`, `script.md`, `stills/NN-<beat>.png`, `contact-sheet.png`, `report.json`, `report.md`, `timeline.json`.
- **Draft** unless every sentence has a narrator clip and `voice.narrator.approved` is set; a draft is reported, not a warning.
- **Check levels:** failures — the picture checks, `srt`, `audio`, `faststart`, `chapters`, a deny-list hit; warnings (fatal with `--strict`) — `duration-target` (± max(5 s, 10 %)), `loudness`, `true-peak`, `silence` (between first and last sound), `av-sync`, `voiced`, a missing or stale rehearse.
- **A voiced caption starts at its sentence's start plus the clip's 30 ms lead** (`post.leadMs`), so it lands within a frame of its sound. Font: Atkinson Hyperlegible Bold (OFL), 46 px, white on a 60 % dark box, bottom centre.
- **Fixtures:** `sync.html` and `sync-tour` (the beep-and-flash beat); the fixture tour's target is now 40 s.
- **Measured:** caption↔sound on the beep beat −26.7 ms (fake) / +3.3 ms (`say`); the flash 27–30 ms after the sound; masters at −16.0 ± 0.2 LUFS.

### Phase D — Review, in-app and the skill

#### Session 9 — R1 · Checkpoint: look and feel (by hand)

**Objective.** The user reviews the fixture film, the live demo and the interview wording, and the changes are applied before the in-app path and the skill build on them.

**Do.**
1. **Checkpoint protocol first** (§4):
   - **Headless:** set ⛔ `Needs decision: run Session 9 interactively — watch the fixture film (toolkit/test/.out/…/*.mp4), run "showcase watch" on the fixture tour, read skills/showcase/reference/interview.md, then approve as-is or add notes under TRACKER › Review notes › Look and feel`. Then commit and stop.
   - **Interactive, with no notes:**
     - give the artifact paths;
     - start `watch --detach` on the fixture;
     - ask: Approve as-is · I have notes · A different narrator style · A different caption style.
2. **Notes:** turn them into a numbered checklist in the session log, then implement it: pointer feel, spotlight timing, caption style, pacing, voice defaults, interview wording.
3. **Re-render:** the fixture film, `--strict`.

**Boundaries.** Only what the notes ask for. Any change of scope becomes `Needs decision:`.

**Verification gate.**
- Every note is closed with evidence (before and after stills or numbers).
- The re-render passes `--strict`.
- `npm test` passes.

**Runtime:** opus / high — the scope of review feedback isn't known in advance

#### Session 10 — I1 · The in-app path

**Objective.** The same tour ships inside an app: a vendored runtime, framework adapters, deep links, and a film recorded from the in-app tour.

**Do.**
1. **The in-app boot,** in `runtime/src/index.ts`:
   - it reads `?showcase=`, `showcaseStep` and `showcaseMode`;
   - it loads the tour JSON and the manifest from the app's static paths;
   - synthetic input only, with sessionStorage state;
   - the adapter API (`navigate`, `reset`, `actions.register`, `beforeStart`).
2. **`runtime vendor --framework next|react|html [--to <dir>]`** (§2.6): the version stamp, idempotence, and the strict TypeScript flags.
3. **The voice folder:** `voice.dir` set to `public/showcase/voice/` when vendoring.
4. **`film --in-app`** and **`rehearse --synthetic`.**
5. **A minimal Next fixture,** `toolkit/fixtures/next/`. Its dependencies are installed on demand into the cache; no `node_modules` are committed.
6. **`skills/showcase/reference/in-app.md`.**

**Boundaries.** No changes to Star (Session 13).

**Verification gate.**
- The HTML adapter plays the fixture tour from a deep link.
- The Next fixture passes `next build` and plays with in-app navigation, on a single document load.
- A reload resumes without writing twice.
- Vendoring twice gives no diff.
- `film --in-app --strict` is green on the Next fixture.
- `npm test` and `npm run typecheck` pass.

**Runtime:** opus / medium — adapter API design, checked by a real `next build` and a play-through

#### Session 11 — S1 · The skill and integration

**Objective.** `/showcase` — the wizard, its references and templates — wired into the marketplace and README, with evals.

**Do.**
1. **`skills/showcase/SKILL.md`** (§2.9): frontmatter, subcommands, phases P0–P11 (§2.7) and the Rules.
2. **`reference/`:**
   - finish `interview.md`;
   - write `determinism.md` and `roadmap-brief.md`;
   - make `tour-format.md`, `narrative.md`, `voice.md`, `film.md` and `in-app.md` consistent with what was built.
3. **`templates/BRIEF.md`, and `brief`.**
4. **`evals/`** (with the `claude-code-guide` agent confirming the current eval format first):
   - `keys status` with a canary `OPENROUTER_API_KEY` in the case's `env`: a regex grader fails if the canary appears;
   - a headless `/showcase` prints Round 1 and stops;
   - `storyboard` generates the file;
   - `brief` writes the brief.
5. **Integration:**
   - **`.claude-plugin/marketplace.json`:** a `showcase` entry (version 0.9.0, description), and the top-level description extended.
   - **`plugin.json`:** 0.9.0, with the final description.
   - **README:** an overview row; a `## The showcase plugin` section (requirements, keys, CLI, `shim`, footprint, roadmap and checkpoints, cost); the "Which one?" line; the install and update lines; the Layout tree; a "Developing the showcase plugin" note.
   - **`.gitignore`:** checked.

**Boundaries.** No Star work, and no push.

**Verification gate.**
- `claude plugin validate plugins/showcase`, and the marketplace manifest, pass.
- `claude plugin eval plugins/showcase --max-cost-usd 2` is green.
- A headless `claude -p --plugin-dir plugins/showcase "/showcase:showcase doctor"`, from a scratch copy of the fixture app, works, and its transcript shows `Base directory for this skill: …/plugins/showcase`.
- `claude plugin details showcase` shows no always-on description cost.
- `npm test` passes.

**Runtime:** opus / high — the wizard's wording and flow are the product, and evals only cover its headless paths

### Phase E — Proving on Star, and the release

#### Session 12 — P1 · Star I: the film and live demo (by hand)

**Objective.** Prove the no-code-change path on a real app: a repeatable, approved Star film and live demo, made with `/showcase`.

**Do.**
1. **Checkpoint protocol first.** Headless: set ⛔ `Needs decision: run Session 12 interactively — cd ~/_PRJ/star && claude --plugin-dir ~/_PRJ/cc-star-skills/plugins/showcase --add-dir ~/_PRJ/cc-star-skills, then /session ~/_PRJ/cc-star-skills/.planning/showcase-plugin`. Then commit in cc-star-skills and stop.
2. **Interactive, in Star:** run `/showcase` with the user: Rounds 1–3, exploration, then `init` and `inspect`. Star has no test ids, so use role-and-name anchors.
3. **Determinism:**
   - a snapshot of the SQLite DB through `.backup` into `showcase/.cache/`, with `app.env` setting `STAR_DB_PATH` to the snapshot and `STAR_READONLY=1`;
   - a fixed clock;
   - search pinned to a lexical mode in the step path, or `EMBED_URL` pointed at a fake;
   - the copilot (`COPILOT_LLM_URL`) kept out of the story.
4. **Privacy:** `privacy.deny` for people's names and hostnames, reusing Star's redaction config where possible.
5. **The film:**
   - storyboard approval (Round 4) with the stills;
   - the audition and the narrator pick;
   - `voice --yes`, then `film --strict --detach`;
   - Round 5;
   - the live demo (`watch`).
6. **The friction log:** a friction log in the session log, and plugin fixes in cc-star-skills with tests.

**Boundaries.**
- No Star app code: only `showcase/` and the ignore lines, committed in Star with the user's go.
- Star's `CLAUDE.md` and `AGENTS.md` apply to anything written there.
- Never print keys.

**Verification gate.**
- `rehearse` passes 5 of 5.
- `film --strict` is green.
- Two renders give identical SRTs, with timecodes within 100 ms.
- The user approves in Round 5.
- The plugin's `npm test` is green after the fixes.

**Runtime:** opus / high — a real app with unknowns and a manual gate

#### Session 13 — P2 · Star II: the in-app tour, then the release (by hand)

**Objective.** Prove the in-app path on Star, then release showcase v1.0.0.

**Do.**
1. **Checkpoint protocol first.** Headless: as in Session 12, with "Session 13".
2. **`/showcase in-app` in Star,** reusing Session 12's tour:
   - `runtime vendor --framework next`, giving the vendored runtime and `ShowcaseTour.tsx`;
   - the adapter: Next's router, the snapshot reset, the copilot kept out;
   - `data-showcase` anchors where roles and names aren't enough, with a contract test in Star's own test setup (or `showcase check` against the anchors if Star has no runner);
   - a "Take the tour" entry point, placed where the user agrees;
   - deep links and `public/showcase/voice/`;
   - `film --in-app --strict`.
   - Then Star's lint, typecheck and build, and a commit in Star with the user's go.
3. **The release:**
   - 1.0.0 in `plugin.json` and `marketplace.json`, and the README updated;
   - `claude plugin validate`;
   - `claude plugin tag plugins/showcase`, which makes `showcase--v1.0.0`;
   - then **ask** before running `git push origin main refs/tags/showcase--v1.0.0`, and the same to `GITLAB`.
4. **If too much is found:** ⛔ `Needs decision: split the remaining fixes into a Session 14? — yes / ship as is`.

**Boundaries.**
- Star changes only as listed.
- No push without the user's go.

**Verification gate.**
- Star's own lint, typecheck and build pass.
- The tour plays from the entry point and from a deep link.
- A reload resumes without writing twice.
- `film --in-app --strict` is green.
- The user approves.
- The tag `showcase--v1.0.0` exists.
- The plugin's `npm test` is green.

**Runtime:** opus / high — code changes in Star plus the release tag, behind a manual gate

## 6. File map

**New in cc-star-skills:**
- `plugins/showcase/**`: everything in §2's tree, namely:
  - `.claude-plugin/plugin.json`, `bin/showcase`, `hooks/`;
  - `skills/showcase/{SKILL.md, reference/, templates/}`;
  - `toolkit/{cli.ts, commands/, lib/, voice/, host/, film/, runtime/{src,dist}/, schema/, fonts/, fixtures/, spikes/, test/}`;
  - `evals/`, `package.json`, `tsconfig.json`.
- `.planning/showcase-plugin/**`: this roadmap.
- `.planning/sessions/<date>-*.md`: one per session.

**Modified in cc-star-skills:**
- `.claude-plugin/marketplace.json` (Session 11; version in Session 13);
- `README.md` (Sessions 11 and 13);
- `.gitignore` (Session 1).

**Unchanged:** `plugins/planning/**` and `plugins/copilot/**`.

**Star** (`/Users/kstar/_PRJ/star`):
- Session 12: `showcase/**` and the ignore lines.
- Session 13: the vendored runtime directory, `ShowcaseTour.tsx`, the entry-point edit, any `data-showcase` anchors, a contract test, and `public/showcase/voice/`.

**gods-eye:** unchanged (a read-only reference).

## 7. Verification

- **Unit:**
  - `npm test` in `plugins/showcase` runs `node --test` over the TypeScript tests natively, plus `npm run typecheck`.
  - There's no test framework dependency; anything that needs a DOM runs in real Chromium through playwright-core.
  - Covered:
    - key precedence, modes and redaction (a 401 body that echoes the key never reaches stdout, stderr or a file);
    - the hook's denials;
    - tour validation with rule ids;
    - the golden pitch at 100.8 s;
    - the director on a fake clock;
    - manifest staleness, including post settings;
    - the CFR schedule, the audio mixdown, and the ASS and SRT builders.
- **The fixture app:**
  - the four spikes' measurements, recorded;
  - `rehearse` clean three times;
  - `watch` plays;
  - `voice --draft` works;
  - `film --strict` gives a green report, and ffprobe shows 1920×1080 H.264 at 30 fps, BT.709, with AAC and one chapter per beat;
  - the contact sheet is read back against the narration.
- **The in-app fixtures:**
  - the HTML adapter plays;
  - the Next fixture builds and plays on a single document load;
  - a reload mid-tour resumes without writing twice;
  - `film --in-app` is green.
- **The plugin:**
  - `claude plugin validate`;
  - `claude plugin details showcase` (no always-on cost);
  - `claude plugin eval plugins/showcase` against a no-plugin baseline;
  - a headless `/showcase:showcase doctor` through `--plugin-dir`.
- **The real app (Star):**
  - Session 12: a no-code-change film and live demo, made with the user, repeatable across two renders;
  - Session 13: the same tour embedded and filmed `--in-app`, approved by the user.
- **Secrets:** a canary key runs through every command. Nothing in stdout, stderr, `showcase/`, `out/`, `.cache/` or the reports may match it, and the real key is never printed.
