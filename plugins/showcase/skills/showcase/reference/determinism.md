# Determinism

How to make the app show the same thing on every take, so a film can be re-rendered, compared and approved. Two renders of a deterministic setup give the same SRT with timecodes within 100 ms, and the same screens. Do this before the first rehearsal that counts: a storyboard approved on data that moves is approved on nothing.

Most of it is `showcase/config.json`, and no app code changes. When a lever needs app code, the in-session path stops there and the work goes to a roadmap (`showcase brief`).

## What a take does

Every command that brings the app up (`rehearse`, `watch`, `film`, `storyboard --stills`, `inspect` with a path, `auth`) runs the same lifecycle:

```
app.build (film always; others with --build) ─► app.snapshot ─► app.start on showcase's own port
  ─► wait for app.health (2xx) ─► app.reset ─► headless Chromium, the runtime injected ─► the tour
```

- **Its own server, port and environment.** showcase allocates a free port and fills `{port}` and `{url}` into `start`, `url`, `health`, `env`, `reset` and `snapshot`. App commands run with `sh -c` in the directory holding `showcase/`. The server gets its normal environment minus showcase's keys, plus `app.env`. A lock per repo stops two runs sharing, or resetting, one app. On exit the whole process group is stopped.
- **`--base <url>`** uses an app that's already running: no build, snapshot, reset or lock. Handy while authoring; never for the final film.
- **`--no-reset`** skips `snapshot` and `reset`.

## The levers

| Lever | Config | Notes |
|---|---|---|
| Production build | `app.build`, `app.start` | Film the production build: dev overlays, hot reloads and slow first compiles show up in the video. `film` runs `app.build` unless `--no-build`; a `start` that looks like a dev server is noted. Hide what's left with `browser.hide` (`nextjs-portal`) |
| Data | `app.snapshot`, `app.reset` | Each is a shell command or an HTTP call (`{"url": "{url}/api/reset", "method": "POST"}`). `snapshot` runs before the server starts; `reset` after it's healthy |
| The clock | `browser.clock.fixed` | An ISO time with its offset (`"2026-10-05T09:00:00+01:00"`), given to Playwright's `clock.setFixedTime`: `Date` is fixed, timers run normally. Never `clock.install`, which would fake the tour's own timers too |
| Locale and zone | `browser.locale`, `browser.timezone`, `browser.colorScheme` | Defaults `en-GB`, `Europe/London`, `light` |
| Third parties | `browser.block` | URL patterns with `*` wildcards (`*://*.google-analytics.com/*`, `*intercom*`), blocked through CDP `Network.setBlockedURLs`: analytics, chat widgets, ads, A/B tests |
| Overlays | `browser.hide` | CSS selectors hidden in every take, through an adopted stylesheet (safe under CSP): cookie banners, dev overlays, "what's new" pop-ups |
| Sign-in | `browser.storageState` | See below |
| GPU | `browser.gpu` | `preferred` (default) or `required`, which refuses SwiftShader, the software renderer Playwright always enables. Use `required` for WebGL-heavy apps |
| Legibility | `browser.scale` | DPR 1.5 by default: a 1280×720 CSS viewport rendered at 1920×1080, so the UI reads larger (D19) |

### Data

Pin the data the film shows. In order of preference:

1. **A snapshot** restored before every take. For SQLite, take it once with `.backup` (safe while the app runs) into `showcase/.cache/`, then point the app at a fresh copy: `"snapshot": "cp showcase/.cache/snapshot.db showcase/.cache/take.db"` with `"env": {"DB_PATH": "showcase/.cache/take.db"}`. A read-only flag, if the app has one, keeps the take from writing to it. Postgres: `pg_restore` into a scratch database named in `app.env`.
2. **The app's own seed mode**, run as `reset` or as part of `start` (`npm run seed && npm run start -- --port {port}`).
3. **Live at render time**: only when the user chose it in Round 2. Expect the storyboard to drift from the film; re-approve before the final cut.

A write the tour makes (`effect: write`) needs `done`, so a rerun against already-changed data skips it rather than doing it twice (`showcase docs tour-format`). `reset` is what puts the data back between takes.

### Randomness and time in the app

`browser.clock` fixes `Date`. It doesn't fix:

- **Random ids, shuffles and sampling.** If they show on screen, the app needs a seed: an environment variable it reads (`SEED=42` in `app.env`), or a route that pins it. That's app code: the roadmap path.
- **Server-side "now".** The browser's clock doesn't reach the server. Pass a fixed time through `app.env` if the app supports one, or let the snapshot carry dates that read well.
- **Animations that never settle** (a spinner, a ticker). Wait for what follows with a `ready` predicate, or `hide` the decoration.

### Live AI and external APIs

A film can't depend on a model's answer or a third party's uptime. Pick one:

- **Keep AI out of the story.** The cheapest fix, and the default: the tour shows the screens around it, not a live answer.
- **Point the base-URL variable at a fake** in `app.env` (`OPENAI_BASE_URL={url}/api/fake-llm`, or a small local server the `start` command runs alongside). A scripted fake server is a v1.1 idea; today it's app code or a tiny script of the user's: the roadmap path.
- **Block it** (`browser.block`) when the app degrades gracefully without it.

Never film a real customer's data through a live API.

### Fonts and settling

Before the first frame, the film waits for `document.fonts.ready` and then 400 ms with no new screencast frames, which also covers canvases. Web fonts from a CDN can still land late on a cold cache; prefer self-hosted fonts, or block the CDN and accept the fallback face consistently.

## Sign-in

`showcase auth [path]` opens a headed browser on the app; the user signs in by hand, then closes the window or presses Enter. The session is saved as Playwright `storageState` to `showcase/.auth/state.json` (directory 700, file 600, ignored by git). Set `"browser": {"storageState": ".auth/state.json"}` (relative to `showcase/`).

- Treat it as a secret, like a key. The plugin's hook denies any tool call that names `showcase/.auth/`; never read or print it.
- Use a demo account with demo data where one exists. Sign-ins expire: if a take lands on the login page, run `showcase auth` again.
- Prefer an app's own "demo mode" or seeded test user, set through `app.env`, to recording a real person's session.

## Browser behaviour the host already handles

- **Popups:** `window.open` and `target=_blank` stay in the same tab.
- **Uploads:** an `upload` action answers the file chooser with files under `showcase/`.
- **Dialogs:** `alert`, `confirm` and `beforeunload` are accepted.
- **Clipboard:** read and write permissions are granted.
- **Page loads:** the old page stays on screen until the new one paints, so a full load shows as a held frame, never a white flash (S-D4). The film's motion-gap check exempts it.
- **Service workers** are blocked, so a cached shell can't serve a stale build.

## Privacy

What must never be on screen goes in `privacy.deny`: strings, or `{"pattern": "…", "flags": "i"}` regular expressions. Pre-fill it from any redaction config the explorers found.

- `rehearse` scans every beat's visible text for it and fails on a hit; `film` refuses to pass (✗ `deny-list`) unless the last rehearse was clean.
- It checks text in the DOM, not pixels: names inside images, canvases or video aren't seen. Read every still back.
- Fix a hit in the data (the snapshot, the seed, a demo account), or `hide` the element. Never blur in post: every screen is the real app.
- People's names, email addresses, hostnames and internal URLs are the usual entries. A deny-list entry that matches the app's own chrome (its name, say) will fail every take; keep entries specific.

## Checklist before filming

- [ ] `app.build` and `app.start` run the production server on `{port}`, and `app.health` answers.
- [ ] The data is pinned (`snapshot` or `reset`), and a second take starts from the same state.
- [ ] `browser.clock.fixed` is set if any date or relative time is on screen.
- [ ] Analytics, chat widgets and banners are blocked or hidden.
- [ ] No live AI answer or third-party call is in the story, or it's faked.
- [ ] Sign-in is recorded with `showcase auth`, if the app needs one.
- [ ] `privacy.deny` holds what must never show, and `rehearse` is clean three times in a row.
