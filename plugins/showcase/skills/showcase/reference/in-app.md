# In-app tours

How the same tour file ships inside the product as a guided tour any visitor can start: `showcase runtime vendor` copies the runtime into the app with an adapter, and `?showcase=<id>` plays it. The film can then be recorded from the in-app tour itself with `showcase film <tour> --in-app`.

This changes the app's code, so outside a roadmap session it normally goes through `showcase brief` and `/planning:roadmap`.

## Before vendoring

1. `showcase rehearse <tour> --synthetic`: plays the tour with synthetic input only, as an in-app tour does, and lists what synthetic input can't do:
   - **cannot** (a problem: the rehearse fails): an action with `"input": "trusted"`, or a `Tab` key (a synthetic Tab doesn't move focus; use a `focus` action).
   - **check** (a note): `hover` (CSS `:hover` and native tooltips don't answer synthetic events), other `key`s (no default action; Enter in a form field still submits), `upload` (the file must be served at `<base>/assets/`, and the target must be the `<input type=file>`), `drag`, and `scroll` with `by` (no wheel events).
2. Any action a role and name can't anchor gets a `data-showcase="<name>"` attribute in the app, which the tour names as `{"testId": "<name>"}`, with a test on both sides (the anchor resolves; the element has it), as Compass's `anchors.ts` and `dom.test.ts` do. Add one only where a role and name aren't enough: an anchor that names data (a result's title) is fine while the data holds still, and `rehearse` says when it stops resolving.

## `showcase runtime vendor`

```
showcase runtime vendor [--framework next|react|html] [--to <dir>] [--public <dir>] [--json]
```

| Framework | `--to` default | What it writes |
|---|---|---|
| `next` (default) | `src/showcase`, else `components/showcase` | `ShowcaseTour.tsx`, a `"use client"` component on `next/navigation`; `showcase-adapter.ts`, the app's own part, written once and never overwritten |
| `react` | the same | `ShowcaseTour.tsx`, which takes a `navigate` prop (and every other adapter option) |
| `html` | `<public>/showcase` | `runtime/snippet.html`, a `<script type="module">` for each page's `<head>`, also printed |

Every framework also gets, in `<to>/runtime/`:

- `showcase-runtime.mjs`, the runtime, with a first line stamping the plugin version and the source hash. Never edit it: vendor again.
- `showcase-runtime.d.mts` and `types/`, its declarations. They compile under `strict`, `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` with `skipLibCheck` off. (It's `.d.mts` because TypeScript reads an `.mjs` file's types from a `.d.mts` beside it.)

And it publishes what the runtime fetches, under `<public>` (default `public/`; for HTML without one, the repo root):

- `<public>/showcase/tours/<id>.json`: every valid tour in `showcase/tours/`, byte for byte;
- `voice.dir` in `showcase/config.json` set to `<public>/showcase/voice/`, so `showcase voice` writes there. Clips already voiced in the old folder are copied across.

It's idempotent: a second run with nothing new changes nothing. **Run it again after editing a tour**: `film --in-app` refuses a tour the app serves an older copy of.

## Mounting it

- **Next:** `<ShowcaseTour />` once, in the root layout (its default export, from `<to>/ShowcaseTour`). Steps move through `router.push`, on one document load.
- **React:** `<ShowcaseTour navigate={(url) => navigate(url)} />` once, near the root, with the app's router (React Router's `useNavigate`). Without `navigate`, a step's path is a full page load and the tour resumes after it.
- **HTML:** the snippet in every page's `<head>`. Multi-page apps work: each page load resumes the run.

Each adapter loads the runtime only when the URL has `?showcase=` or the tab is part-way through a tour (`sessionStorage["showcase:run"]`), so the page's bundle is untouched otherwise.

## The adapter

What `startInApp(adapter)` takes; every part is optional. In Next, put the app's own parts in `showcase-adapter.ts`:

```ts
import type { Adapter } from "./runtime/showcase-runtime.mjs";

export const adapter: Adapter = {
  // Puts the app's data back before a tour starts from a link (not on a reload's resume).
  reset: async () => { await fetch("/api/showcase/reset", { method: "POST" }); },
  // Before every start or resume: for example a deterministic AI for this browser.
  beforeStart: ({ tour }) => { document.cookie = `showcase-tour=${tour.id}; path=/; SameSite=Lax`; },
  // The tour's `invoke` actions, by name (also `window.__showcase.actions.register(name, fn)`).
  actions: { "open-palette": () => openPalette() },
};
```

The other options: `navigate(url)` (the adapter supplies the router), `base` (where `tours/`, `voice/` and `assets/` are served; default `/showcase`), `speed`, and `onExit` (the viewer closed the tour).

## Deep links

| Parameter | Meaning |
|---|---|
| `?showcase=<id>` | Start the tour (Watch mode) |
| `&showcaseStep=<step>` | Start at that step; the earlier steps' writes are fast-forwarded first |
| `&showcaseMode=film` | Film mode: no controls, waits for the recorder (`film --in-app`) |

The names are namespaced so they never clash with an app's own `tour` parameter. Add a "Take the tour" link to `/?showcase=<id>` wherever it suits the app:

- **Next:** a `<Link href="/?showcase=<id>">` works. The adapter watches the URL, so the first tour in a document starts in place; a later one reloads the page first, because the runtime runs one tour per document.
- **React and HTML:** make it a document load: a plain `<a href>` (React Router: `<Link reloadDocument>`). A client-side route change to the link doesn't start a tour.

## How it runs

- **Input is synthetic only:** realm-correct events with React's value setter, `beforeinput` typing for contenteditable, and `DataTransfer` uploads.
- **Run state is the tab's sessionStorage.** A tour started from a link takes its parameters off the URL at once, so a **reload resumes** where it was without writing twice (the journal knows each write). A finished or closed tour clears it.
- **Router hops** push again every 2 s until the URL is the step's (an app's own soft refresh can undo a push), and fail the step after 10 s.
- **The voice starts muted**, with the control to turn it on: the browser only allows sound after the viewer's click. Clips play from `<base>/voice/` as the manifest names them.
- **Esc or the close control** ends the tour and takes the overlay down. A viewer's click pauses it, as in Watch.

## Filming the in-app tour

```
showcase film <tour> --in-app [--strict]
```

It opens `?showcase=<id>&showcaseMode=film` on the first step's path and injects nothing: the app's vendored runtime boots from the link and talks to the recorder over the same contract as an injected film (the `__showcaseHost` binding, the film's events, `__showcaseGo()`). The app's own router moves the steps, so the take shows `nav` events of kind `spa`, not page loads. Everything else is as `film` (see `showcase docs film`). If the page never arms, the runtime isn't vendored or `<ShowcaseTour />` (or the snippet) isn't on the page.

Two things the recorder does for an in-app film, so it behaves as an injected one:

- **It holds the run state**, not the tab. A step that is a full page load (a plain GET form, a multi-page app) shows as a `nav` of kind `load`; the adapter sees the recorder in the new document and loads the runtime again, which resumes from the recorder's state.
- **It captures the real clocks first**, before any clock script, so `browser.clock.fixed` gives the app its fixed time while the film's events keep the real one.

## Footprint

The in-app path adds to the app (PLAN §2.10): the vendored runtime and adapter (`<to>/`), the entry point and any `data-showcase` anchors with their test, and `<public>/showcase/{tours,voice}/`, all committed. If the app already has Playwright, add one smoke test that opens `?showcase=<id>` and waits for the end card.

## The Next fixture

`toolkit/fixtures/next/` is a minimal app-router app (Next 16, React 19, strict TypeScript) for the plugin's own tests. Its dependencies are installed on demand into `${XDG_CACHE_HOME:-~/.cache}/showcase/fixtures/next-<hash>/` and never committed. `npm run test:next` vendors it twice, voices it, builds it, plays the deep link on a single document load and films it `--in-app --strict`.
