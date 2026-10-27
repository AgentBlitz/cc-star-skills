# Narrative rules

How a showcase film is written: the spines, the register and the close, the length budgets, and the writing rules `check` gates on. The numbers are anchored to a measured film, Compass's two-minute pitch: 248 words, 100.8 s of narration by the reading estimate, about 119 s in all. Narration is about 85 % of the runtime, at about 2.46 words a second.

## The method

- **Perform real actions.** Every screen is the real app doing the real thing, never a mock-up or an edited frame.
- **Narration drives the timing.** A beat lasts as long as its narration (or its actions, if they take longer), plus its dwell. A sentence lasts its clip's duration once voiced, else its reading estimate. Muting never changes timing.
- **A spotlight holds for its sentence.** Pair each spotlight with the sentence that names what it shows (`after`), and follow it with a `hold` when the pointer moves on in the same beat.
- **Cut first.** Every film of 2:00 or more names the beat to drop if it runs long (`meta.rules.firstToCut`). Write that beat so dropping it leaves no gap.

## Reading time

```
readingMs(sentence) = max(1600, round(words × 60000 / 165 + 350))
```

165 words a minute, plus 350 ms for the breath, never under 1.6 s. It stands in for the voice until there are real clip durations. The voice's own pacing should land between 120 and 185 words a minute; if the narration is outside its window, rewrite the text. Never speed up the voice.

## Length presets

| Preset | Film | Narration | Words | Beats |
|---|---|---|---|---|
| 1:00 | 55–60 s | 48–54 s | 118–133 | 5–6 |
| 1:30 | 83–90 s | 72–81 s | 177–199 | 6–8 |
| 2:00 | 110–120 s | 96–108 s | 236–266 | 8–10 |
| 3:00 | 166–180 s | 144–162 s | 354–398 | 11–13 |
| 5:00 | 276–300 s | 240–270 s | 590–664 | 18–22 |

- **Kind factor**, on narration time and words: pitch and spotlight 1.0, walkthrough 0.94, how-to 0.85 (how-to has more silent doing). A 2:00 how-to's window is 81.6–91.8 s.
- **Between presets** the window is 80–90 % of the target, words about 1.97–2.22 a second, and the beat range is interpolated.
- **Each kind's default length:** pitch 2:00, walkthrough 3:00, spotlight 1:00, how-to 2:00.
- `meta.length.narration` and `meta.length.beats` override the preset when a film genuinely needs it.

## Spines

Each ships as `templates/tour.<kind>.json`, with placeholder narration that already fits its budget.

- **Pitch:** an opening card (the problem in the audience's words) → where it hurts → why → what we're doing (one to three beats, each a real action) → the payoff → the choice → an ask card. No callouts: the narration says what a spotlight shows.
- **Walkthrough:** an opening card → orient on the home screen → one beat per job → how the parts connect → a closing card.
- **Spotlight:** the hook → an optional "before" → the moment it works (one continuous action) → the clever detail → the payoff → a call-to-action card.
- **How-to:** a goal card → the starting point → one beat per step (imperative voice; the result held for at least 1.5 s; controls named exactly as labelled) → the result → a recap card.

## Register and close

The audience sets the register:

- **executives:** outcomes, with no jargon explained;
- **users:** plain words, benefits first;
- **your team:** specifics;
- **developers:** how it works.

What they should do afterwards sets the close:

- **decide:** an ask card;
- **try:** a "start here" card;
- **understand:** a recap of three takeaways;
- **champion:** the one-line story.

## One continuous script

The voice reads the narration in one take (`voice.takes: "tour"`, `showcase docs voice`), so write it as **one script a person would read aloud from start to finish**, not as a stack of captions.

- **Read it top to bottom before voicing.** Each sentence should follow from the one before: carry the thread with "then", "so", "that's" and the like, rather than restarting the subject every line.
- **Beats are paragraphs.** The voice pauses longer between beats than between sentences; put the turn of thought where the beat changes.
- **End every sentence with a full stop, question mark or exclamation mark.** The take is cut at the pause after each one; a sentence that runs on into the next with a comma can't be cut there.
- **Spell out what must be said exactly** (figures, acronyms, product names) or give it a lexicon entry, so the transcription check hears what the script says.
- **Pacing is fixed by rewording, never by `speed`.** A take reads at one pace throughout; a beat that runs long needs fewer words.

## Writing rules

- **One sentence per caption,** at most 2 lines of 42 characters, wrapped greedily. Long sentences split; they don't shrink.
- **Each beat's span is at least its narration.** The runtime guarantees it; write so the screen has something to show for every sentence.
- **The last card holds for at least 2 s** (`dwellMs` ≥ 2000), so the film doesn't end mid-read.
- **Films of 2:00 or more name `firstToCut`.**
- **Spoken numbers:** `on-screen-only` by default: any number the narration says must be on that beat's screen, which `rehearse` checks against the DOM text. A pitch can choose the stricter `none`, as Compass's does: no number at all. A *number* here is anything with a digit (`42`, `£1.2m`, `W39`) or a spelt-out quantity with a magnitude or percent (`two million`, `forty per cent`); plain counts ("four questions") are words.
- **Say what changed, not which button was pressed.** The pointer shows the press.
- **Name controls exactly as labelled** when the viewer must find them (how-to).
- Write in the target's language (`meta.language`); UK English by default.

## Rule ids

`check` prints T001–T015; the full list with levels is in `showcase docs tour-format`. The narrative ones: T007 caption, T008 narration window, T009 beat count (warning), T010 spoken number under `none`, T011 `firstToCut`, T012 the last card's hold, T013 a pitch callout (warning), T014 an empty beat (warning).
