# Spikes (Session 2)

Evidence, not shipped behaviour. They measured the four riskiest technical questions on the fixture app (`../fixtures/`), and the verdicts are in `.planning/showcase-plugin/PLAN.md` §3 ("Spike verdicts", S-D1…S-D4).

```
npm run spikes            # the fixture check, then all four spikes (about 6 minutes)
node --disable-warning=ExperimentalWarning toolkit/spikes/spike2-clicks.ts   # one at a time
```

| File | Question | Result file |
|---|---|---|
| `check-fixture.ts` | Every fixture page loads without console errors; the elements exist, found by role and label | `results/fixture-check.json` |
| `spike1-capture.ts` | CDP screencast fps and gaps at scale 1/1.5/2, JPEG q80/q90 (`--settle 0` for the scroll-burst stall, `--emulated-dpr` for the CSS-size frames) | `results/spike1-capture*.json` |
| `spike2-clicks.ts` | 20 trusted clicks under covers; overlay controls vs a Radix-like menu | `results/spike2-clicks.json` |
| `spike3-toplayer.ts` | The overlay vs `showModal`, `popover=auto` and full screen, for five designs | `results/spike3-toplayer.json` |
| `spike4-pageload.ts` | White flashes across full page loads, PaintHolding off and on; re-arming and `seq` | `results/spike4-pageload.json` |

- `overlay-proto.js` is the prototype overlay they inject (popover host, Compass portal, the hybrid). Session 5 builds the real one.
- `lib.ts` launches new-headless Chromium through `../lib/playwright.ts`.
- Screenshots, sample frames and the Spike 3 contact sheet go to `toolkit/test/.out/spikes/`, which is ignored.
- This directory has its own `tsconfig.json`, which adds the DOM lib for the `page.evaluate` code.
