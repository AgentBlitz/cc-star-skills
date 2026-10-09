/**
 * `voice --audition` (PLAN §2.4): an HTML page with three sample lines from the tour for each
 * voice on the British shortlist, plus the draft voice, so the user can choose the narrator by
 * ear. A few cents at most: the samples are the shortest lines that fit the character budget, and
 * the raw audio is cached, so a second page costs nothing.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spokenNumbers } from "../runtime/src/narrative.ts";
import { encodeMp3, type FfmpegPaths, processClip } from "./audio.ts";
import { offered, type SpeechModel } from "./catalogue.ts";
import { POST, type PostConfig, synthKey } from "./keys.ts";
import { createPool } from "./pool.ts";
import type { Sentence } from "./pipeline.ts";
import type { VoiceSetup } from "./setup.ts";
import { createFormatMemory, OpenRouterKeyRejected, OpenRouterNoCredits, synthOpenRouter } from "./tts/openrouter.ts";
import { synthFake } from "./tts/fake.ts";
import { synthSay } from "./tts/say.ts";
import type { AudioFormat, TtsResult } from "./types.ts";

export interface Candidate {
  id: string;
  model: string;
  voice: string;
  instructions?: string;
}

/** The British shortlist (PLAN §2.4), named as the public catalogue lists them on 2026-10-09. */
export const SHORTLIST: readonly Candidate[] = [
  ...["george", "daniel", "alice", "lily"].map((v): Candidate => ({ id: `elevenlabs-${v}`, model: "elevenlabs/eleven-v3", voice: v })),
  ...["Harry", "Emily"].map((v): Candidate => ({ id: `mai-${v.toLowerCase()}`, model: "microsoft/mai-voice-2.1", voice: `en-GB-${v}:MAI-Voice-2.1` })),
  ...["Charon", "Orus", "Kore"].map((v): Candidate => ({ id: `gemini-${v.toLowerCase()}`, model: "google/gemini-3.8-flash-tts", voice: v })),
];

export const AUDITION_MAX_CHARS = 1500;
export const SAMPLE_COUNT = 3;

export interface Sample {
  key: "opening" | "figures" | "closing" | string;
  label: string;
  text: string;
}

/**
 * Three lines: the opening, the one with the most figures, the closing. When voicing all of them
 * for every paid voice would pass `budget`, the shortest lines that fit are used instead, and
 * fewer if three won't fit.
 */
export function pickSamples(sentences: readonly Sentence[], paidVoices: number, budget: number): Sample[] {
  const texts = [...new Set(sentences.map((s) => s.spoken))];
  if (texts.length === 0) throw new Error("the tour has no narration to audition");
  const perVoice = paidVoices > 0 ? Math.floor(budget / paidVoices) : Number.POSITIVE_INFINITY;
  const total = (xs: readonly string[]) => xs.reduce((n, t) => n + t.length, 0);

  const opening = texts[0] as string;
  const closing = texts[texts.length - 1] as string;
  const figures = [...texts].sort((a, b) => spokenNumbers(b).length - spokenNumbers(a).length || a.length - b.length)[0] as string;
  const roles: Sample[] = [
    { key: "opening", label: "Opening line", text: opening },
    { key: "figures", label: "A line with figures", text: figures },
    { key: "closing", label: "Closing line", text: closing },
  ].filter((s, i, all) => all.findIndex((x) => x.text === s.text) === i);
  if (total(roles.map((r) => r.text)) <= perVoice) return roles;

  // Over budget: the shortest lines, kept in tour order, as many as fit.
  const shortest = [...texts].sort((a, b) => a.length - b.length);
  const chosen: string[] = [];
  for (const t of shortest) {
    if (chosen.length === SAMPLE_COUNT) break;
    if (total(chosen) + t.length <= perVoice) chosen.push(t);
  }
  if (chosen.length === 0) throw new Error(`no sentence fits the ${budget}-character audition budget for ${paidVoices} voices: raise --max-chars`);
  return texts.filter((t) => chosen.includes(t)).map((text, i) => ({ key: `line${i + 1}`, label: `Line ${i + 1}`, text }));
}

export interface AuditionOptions {
  sentences: readonly Sentence[];
  title: string;
  outDir: string;
  cacheDir: string;
  setup: VoiceSetup;
  ffmpeg: FfmpegPaths;
  /** The catalogue, when it could be fetched: candidates it doesn't offer are skipped, unspent. */
  catalogue?: readonly SpeechModel[] | undefined;
  yes: boolean;
  maxChars: number;
  post?: PostConfig;
  candidates?: readonly Candidate[];
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  say?: (line: string) => void;
}

export interface AuditionResult {
  file: string;
  samples: Sample[];
  voices: { id: string; label: string; clips: (string | null)[]; skipped?: string }[];
  charsSent: number;
  paid: boolean;
}

const EXT: readonly AudioFormat[] = ["wav", "mp3", "pcm", "ogg", "flac"];

export async function audition(o: AuditionOptions): Promise<AuditionResult> {
  const post = o.post ?? POST;
  const say = o.say ?? (() => {});
  const keyed = Boolean(o.setup.apiKey);
  const all = o.candidates ?? SHORTLIST;
  const notOffered = (c: Candidate) => (o.catalogue && !offered(o.catalogue, c.model, c.voice).voice ? `not in the catalogue (${c.model})` : null);
  const paid = keyed ? all.filter((c) => !notOffered(c)) : [];
  const samples = pickSamples(o.sentences, paid.length, o.maxChars);
  const perVoiceChars = samples.reduce((n, s) => n + s.text.length, 0);
  const charsPlanned = perVoiceChars * paid.length;
  if (paid.length > 0 && !o.yes) throw new Error(`the audition would send ${charsPlanned} characters to OpenRouter (${paid.length} voices × ${samples.length} lines): pass --yes (limit --max-chars ${o.maxChars})`);

  mkdirSync(o.outDir, { recursive: true });
  mkdirSync(o.cacheDir, { recursive: true });
  const formats = createFormatMemory();
  const pool = createPool(3);
  let charsSent = 0;
  let fatal: Error | null = null;

  const clip = (id: string, i: number, make: (text: string) => { synth: string; fetch: () => Promise<TtsResult>; paid: boolean }) =>
    pool(async (): Promise<string | null> => {
      if (fatal) return null;
      const sample = samples[i] as Sample;
      const job = make(sample.text);
      let raw: TtsResult | null = null;
      for (const ext of EXT) {
        const path = join(o.cacheDir, `${job.synth}.${ext}`);
        if (existsSync(path)) raw = { bytes: readFileSync(path), format: ext };
      }
      try {
        if (!raw) {
          raw = await job.fetch();
          if (job.paid) charsSent += sample.text.length;
          writeFileSync(join(o.cacheDir, `${job.synth}.${raw.format}`), raw.bytes);
        }
        const work = mkdtempSync(join(tmpdir(), "showcase-audition-"));
        try {
          const processed = await processClip(o.ffmpeg, raw, post, work);
          const name = `${id}-${i + 1}.mp3`;
          await encodeMp3(o.ffmpeg, processed.wavPath, join(o.outDir, name), post);
          return name;
        } finally {
          rmSync(work, { recursive: true, force: true });
        }
      } catch (e) {
        if (e instanceof OpenRouterKeyRejected || e instanceof OpenRouterNoCredits) fatal = e;
        say(`  ${id} line ${i + 1}: ${(e as Error).message}`);
        return null;
      }
    });

  const voices: AuditionResult["voices"] = [];
  const jobs: Promise<void>[] = [];
  for (const c of all) {
    const row: AuditionResult["voices"][number] = { id: c.id, label: `${c.model} · ${c.voice}${c.instructions ? ` · "${c.instructions}"` : ""}`, clips: samples.map(() => null) };
    voices.push(row);
    const skip = notOffered(c) ?? (keyed ? null : "no OPENROUTER_API_KEY");
    if (skip) {
      row.skipped = skip;
      continue;
    }
    samples.forEach((_, i) =>
      jobs.push(
        clip(c.id, i, (text) => ({
          synth: synthKey({ spoken: text, provider: "openrouter", model: c.model, voice: c.voice, instructions: c.instructions, take: 0 }),
          paid: true,
          fetch: () =>
            synthOpenRouter(
              { text, provider: "openrouter", model: c.model, voice: c.voice, ...(c.instructions ? { instructions: c.instructions } : {}) },
              { apiKey: o.setup.apiKey ?? "", formats, ...(o.fetchImpl ? { fetchImpl: o.fetchImpl } : {}), ...(o.sleep ? { sleep: o.sleep } : {}) },
            ),
        })).then((name) => void (row.clips[i] = name)),
      ),
    );
  }
  const draft = o.setup.draft;
  const draftRow: AuditionResult["voices"][number] = { id: "draft", label: draft.provider === "say" ? `say · ${draft.voice}` : "fake tone (no `say` here)", clips: samples.map(() => null) };
  voices.push(draftRow);
  samples.forEach((_, i) =>
    jobs.push(
      clip("draft", i, (text) => ({
        synth: synthKey({ spoken: text, provider: draft.provider, model: draft.provider, voice: draft.voice, rate: draft.rate, take: 0 }),
        paid: false,
        fetch: () => (draft.provider === "say" ? synthSay(text, { voice: draft.voice, rate: draft.rate }) : synthFake(o.ffmpeg.ffmpeg, text)),
      })).then((name) => void (draftRow.clips[i] = name)),
    ),
  );
  await Promise.all(jobs);

  const file = join(o.outDir, "index.html");
  writeFileSync(file, renderPage(o.title, samples, voices, keyed));
  return { file, samples, voices, charsSent, paid: paid.length > 0 };
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

export function renderPage(title: string, samples: readonly Sample[], voices: AuditionResult["voices"], keyed: boolean): string {
  const head = samples.map((s) => `<th>${esc(s.label)}<br><small>${esc(s.text)}</small></th>`).join("");
  const body = voices
    .map((v) => {
      const cells = v.clips.map((f) => `<td>${f ? `<audio controls preload="none" src="${esc(f)}"></audio>` : "—"}</td>`).join("");
      return `<tr><th scope="row">${esc(v.id)}<br><small>${esc(v.label)}${v.skipped ? ` · skipped: ${esc(v.skipped)}` : ""}</small></th>${cells}</tr>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<title>${esc(title)}: the narrator audition</title>
<style>
  body { font: 14px/1.4 -apple-system, sans-serif; margin: 2rem; color: #111; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; vertical-align: top; }
  th small, td small { color: #666; font-weight: normal; }
  audio { width: 220px; }
</style>
</head>
<body>
<h1>${esc(title)}: the narrator audition</h1>
<p>${keyed ? "Voiced through OpenRouter." : "No OPENROUTER_API_KEY, so only the draft voice has clips."} To choose one, set <code>voice.narrator</code> (<code>model</code> and <code>voice</code> from its row) in <code>showcase/config.json</code>, then run <code>showcase voice &lt;tour&gt; --final</code>.</p>
<table>
<thead><tr><th>Voice</th>${head}</tr></thead>
<tbody>
${body}
</tbody>
</table>
</body>
</html>
`;
}
