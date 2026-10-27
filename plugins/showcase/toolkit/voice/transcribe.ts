/**
 * The take's transcription check (showcase 1.1). The processed take goes to Requesty's
 * `POST /v1/audio/transcriptions` with an OpenAI Whisper model from its public
 * `GET /v1/models/transcription` listing, `response_format=verbose_json` and word timings, with
 * the same `REQUESTY_API_KEY` as the narrator. Nothing here calls OpenAI directly. The call follows
 * the narrator's rules (`tts/requesty.ts`): 429, 5xx and network errors are retried; 401, 402 and
 * 403 are never read and stop the run.
 *
 * Then, pure: what was heard is aligned word by word with what was written, after normalising
 * case, punctuation and numbers, and each sentence is judged: read as written, skipped, garbled,
 * or repeated. The heard words' times also confirm (or move) each cut.
 */
import { redact } from "../lib/redact.ts";
import { mid, type Pause } from "./align.ts";
import { RETRY_DELAYS_MS, retryAfterMs } from "./tts/openrouter.ts";
import { RequestyKeyRejected, RequestyNoCredits, requestyBase } from "./tts/requesty.ts";

export interface Word {
  word: string;
  startMs: number;
  endMs: number;
}

export interface Transcript {
  model: string;
  words: Word[];
}

/** The model used when the listing can't be read. */
export const DEFAULT_TRANSCRIPTION_MODEL = "openai/whisper-1";
const TIMEOUT_MS = 180_000;

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Requesty's public transcription listing: the first OpenAI Whisper model, `whisper-1` preferred. No key is sent. */
export async function pickTranscriptionModel(fetchImpl: typeof fetch = (...args) => fetch(...args)): Promise<string | null> {
  const res = await fetchImpl(`${requestyBase().router}/models/transcription`, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Requesty's transcription listing returned ${res.status}`);
  const body = (await res.json()) as { data?: { id?: unknown }[] };
  const ids = (body.data ?? []).map((m) => m.id).filter((id): id is string => typeof id === "string" && /^openai\/whisper/.test(id)).sort();
  return ids.includes(DEFAULT_TRANSCRIPTION_MODEL) ? DEFAULT_TRANSCRIPTION_MODEL : (ids[0] ?? null);
}

export interface TranscribeOptions {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  retryDelaysMs?: readonly number[];
  timeoutMs?: number;
}

/** Transcribes an MP3, word by word. */
export async function transcribeRequesty(mp3: Buffer, options: TranscribeOptions): Promise<Transcript> {
  const fetchImpl = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const sleep = options.sleep ?? realSleep;
  const delays = options.retryDelaysMs ?? RETRY_DELAYS_MS;
  const endpoint = `${requestyBase().router}/audio/transcriptions`;
  const clean = (text: string) => redact(text, [options.apiKey]);
  let attempt = 0;
  for (;;) {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(mp3)], { type: "audio/mpeg" }), "take.mp3");
    form.append("model", options.model);
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");
    let res: Response;
    try {
      res = await fetchImpl(endpoint, { method: "POST", headers: { Authorization: `Bearer ${options.apiKey}` }, body: form, signal: AbortSignal.timeout(options.timeoutMs ?? TIMEOUT_MS) });
    } catch (e) {
      if (attempt >= delays.length) throw new Error(clean(`Requesty transcription failed after ${attempt} retries: ${(e as Error).message}`));
      await sleep(delays[attempt] as number);
      attempt++;
      continue;
    }
    if (res.status === 401 || res.status === 403) throw new RequestyKeyRejected(res.status);
    if (res.status === 402) throw new RequestyNoCredits();
    if (res.status === 429 || res.status >= 500) {
      if (attempt >= delays.length) throw new Error(`Requesty transcription ${res.status} after ${attempt} retries`);
      await sleep(retryAfterMs(res.headers.get("retry-after")) ?? (delays[attempt] as number));
      attempt++;
      continue;
    }
    if (!res.ok) throw new Error(`Requesty transcription ${res.status}: ${clean((await res.text().catch(() => "")).slice(0, 300))}`);
    const body = (await res.json()) as { words?: { word?: unknown; start?: unknown; end?: unknown }[] };
    if (!Array.isArray(body.words)) throw new Error("Requesty's transcription has no word timings");
    const words = body.words
      .filter((w): w is { word: string; start: number; end: number } => typeof w.word === "string" && typeof w.start === "number" && typeof w.end === "number")
      .map((w) => ({ word: w.word, startMs: Math.round(w.start * 1000), endMs: Math.round(w.end * 1000) }));
    return { model: options.model, words };
  }
}

// ——— Normalising ———

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const SCALES: [number, string][] = [
  [1e9, "billion"],
  [1e6, "million"],
  [1e3, "thousand"],
];
const ORDINAL: Record<string, string> = { one: "first", two: "second", three: "third", five: "fifth", eight: "eighth", nine: "ninth", twelve: "twelfth" };

/** Pure: a whole number in words, without "and" (so "a hundred and five" and "105" agree once "and" is dropped). */
export function numberWords(n: number): string {
  if (n < 20) return ONES[n] as string;
  if (n < 100) return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` ${numberWords(n % 100)}` : ""}`;
  for (const [size, name] of SCALES) if (n >= size) return `${numberWords(Math.floor(n / size))} ${name}${n % size ? ` ${numberWords(n % size)}` : ""}`;
  return String(n);
}

function ordinalWords(n: number): string {
  const words = numberWords(n).split(" ");
  const last = words.pop() as string;
  const ord = ORDINAL[last] ?? (last.endsWith("y") ? `${last.slice(0, -1)}ieth` : `${last}th`);
  return [...words, ord].join(" ");
}

const NUMBER_WORDS = new Set([...ONES, ...TENS.filter(Boolean), "hundred", "thousand", "million", "billion"]);

/** Pure: lower-case words with the punctuation gone and the figures spelled out. */
export function normaliseWords(text: string): string[] {
  let t = text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  t = t.replace(/[‘’ʼ]/g, "'").replace(/[–—]/g, " ");
  t = t.replace(/(\d),(?=\d{3}\b)/g, "$1");
  t = t.replace(/([£$€])\s?(\d+(?:\.\d+)?)/g, (_m, sym: string, num: string) => `${num} ${sym === "£" ? "pounds" : sym === "$" ? "dollars" : "euros"}`);
  // Whisper times "per" and "cent" as two words, so "percent" and "%" become them too.
  t = t.replace(/(\d)\s?%/g, "$1 per cent").replace(/\bpercent\b/g, "per cent").replace(/&/g, " and ");
  t = t.replace(/\ba (hundred|thousand|million|billion)\b/g, "one $1");
  t = t.replace(/\b(\d+)(st|nd|rd|th)\b/g, (_m, num: string) => ordinalWords(Number(num)));
  t = t.replace(/\b(\d+)\.(\d+)\b/g, (_m, a: string, b: string) => `${numberWords(Number(a))} point ${[...b].map((d) => ONES[Number(d)]).join(" ")}`);
  t = t.replace(/\b\d+\b/g, (num) => (num.length > 12 ? num : numberWords(Number(num))));
  const words = t
    .replace(/'/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  // "a hundred and five": the "and" inside a number isn't a word to compare.
  return words.filter((w, i) => !(w === "and" && NUMBER_WORDS.has(words[i - 1] ?? "") && NUMBER_WORDS.has(words[i + 1] ?? "")));
}

// ——— Comparing ———

export type SentenceVerdict = "ok" | "skipped" | "garbled" | "repeated";

export interface SentenceCheck {
  index: number;
  verdict: SentenceVerdict;
  /** Script words heard as written, of how many. */
  matched: number;
  words: number;
  /** What was heard for it, normalised. */
  heard: string;
  /** When its first and last matched words were spoken, in the take. */
  firstMs: number | null;
  lastMs: number | null;
}

export interface TakeCheck {
  ok: boolean;
  sentences: SentenceCheck[];
}

/** A sentence passes with at most this share of its words missed (and one word always allowed): Whisper mishears a name now and then. */
const MISS_SHARE = 0.15;

function allowedMisses(words: number): number {
  return Math.max(1, Math.floor(words * MISS_SHARE));
}

/** Pure: the longest common subsequence's length. */
function lcs(a: readonly string[], b: readonly string[]): number {
  const row = new Array<number>(b.length + 1).fill(0);
  for (const x of a) {
    let diag = 0;
    for (let j = 1; j <= b.length; j++) {
      const up = row[j] as number;
      row[j] = x === b[j - 1] ? diag + 1 : Math.max(row[j] as number, row[j - 1] as number);
      diag = up;
    }
  }
  return row[b.length] as number;
}

/**
 * Pure: each sentence against what was heard. The word sequences are aligned by edit distance;
 * a sentence is `skipped` when under half its words were heard, `garbled` when more than its
 * allowance were missed, and `repeated` when a run of extra heard words reads it again.
 */
export function checkTake(sentences: readonly string[], heard: readonly Word[]): TakeCheck {
  const script = sentences.flatMap((s, i) => normaliseWords(s).map((w) => ({ w, s: i })));
  const said = heard.flatMap((h) => normaliseWords(h.word).map((w) => ({ w, h })));
  const n = script.length;
  const m = said.length;
  // Edit distance with a full table (a five-minute take is about 700 words each way).
  const d = new Uint32Array((n + 1) * (m + 1));
  const at = (i: number, j: number) => i * (m + 1) + j;
  for (let i = 0; i <= n; i++) d[at(i, 0)] = i;
  for (let j = 0; j <= m; j++) d[at(0, j)] = j;
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) {
      const same = script[i - 1]?.w === said[j - 1]?.w;
      d[at(i, j)] = Math.min((d[at(i - 1, j - 1)] as number) + (same ? 0 : 1), (d[at(i - 1, j)] as number) + 1, (d[at(i, j - 1)] as number) + 1);
    }
  // Walk back: matches, substitutions, script words not heard, heard words not in the script.
  const matchedBy = sentences.map(() => 0);
  const heardBy: string[][] = sentences.map(() => []);
  const times: { first: number | null; last: number | null }[] = sentences.map(() => ({ first: null, last: null }));
  const extras: { w: string; after: number }[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const here = d[at(i, j)] as number;
    if (i > 0 && j > 0 && here === (d[at(i - 1, j - 1)] as number) + (script[i - 1]?.w === said[j - 1]?.w ? 0 : 1)) {
      const s = (script[i - 1] as { s: number }).s;
      const word = said[j - 1] as { w: string; h: Word };
      heardBy[s]?.unshift(word.w);
      if (script[i - 1]?.w === word.w) {
        matchedBy[s] = (matchedBy[s] as number) + 1;
        const t = times[s] as { first: number | null; last: number | null };
        t.first = word.h.startMs;
        t.last ??= word.h.endMs;
      }
      i--;
      j--;
    } else if (i > 0 && here === (d[at(i - 1, j)] as number) + 1) i--;
    else {
      extras.unshift({ w: (said[j - 1] as { w: string }).w, after: i > 0 ? (script[i - 1] as { s: number }).s : -1 });
      j--;
    }
  }
  // Runs of extra words: one that reads a sentence again is a repeat.
  // Runs of extra words: one that reads a sentence again is a repeat; any other of three words or
  // more (a restarted phrase) garbles the sentence it follows.
  const repeated = new Set<number>();
  const restarted = new Set<number>();
  const runs: { after: number; words: string[] }[] = [];
  for (const e of extras) {
    const last = runs[runs.length - 1];
    if (last && last.after === e.after) last.words.push(e.w);
    else runs.push({ after: e.after, words: [e.w] });
  }
  for (const run of runs) {
    if (run.words.length < 3) continue;
    let again = false;
    sentences.forEach((s, k) => {
      const words = normaliseWords(s);
      if (words.length > 0 && lcs(words, run.words) >= Math.max(3, words.length - allowedMisses(words.length))) {
        repeated.add(k);
        again = true;
      }
    });
    if (!again) restarted.add(Math.max(0, run.after));
  }
  const checks = sentences.map((s, k): SentenceCheck => {
    const words = normaliseWords(s).length;
    const matched = matchedBy[k] as number;
    const verdict: SentenceVerdict = repeated.has(k) ? "repeated" : matched * 2 < words ? "skipped" : words - matched > allowedMisses(words) || restarted.has(k) ? "garbled" : "ok";
    return { index: k, verdict, matched, words, heard: (heardBy[k] as string[]).join(" "), firstMs: times[k]?.first ?? null, lastMs: times[k]?.last ?? null };
  });
  return { ok: checks.every((c) => c.verdict === "ok"), sentences: checks };
}

/** How sure Whisper's word times are: a cut may sit this far outside the gap between two sentences' words. */
const WORD_TIME_SLACK_MS = 150;

/**
 * Pure: the boundaries, confirmed against the heard words. A cut whose pause lies between the
 * last word of one sentence and the first of the next stands; otherwise the longest pause there
 * replaces it. When no pause lies there, the cut stands and is reported.
 */
export function confirmBoundaries(boundaries: readonly Pause[], pauses: readonly Pause[], check: TakeCheck): { boundaries: Pause[]; unconfirmed: number[] } {
  const out = [...boundaries];
  const unconfirmed: number[] = [];
  boundaries.forEach((b, k) => {
    const last = check.sentences[k]?.lastMs;
    const first = check.sentences[k + 1]?.firstMs;
    if (last == null || first == null) return;
    const lo = last - WORD_TIME_SLACK_MS;
    const hi = first + WORD_TIME_SLACK_MS;
    if (mid(b) >= lo && mid(b) <= hi) return;
    const before = k > 0 ? mid(out[k - 1] as Pause) : Number.NEGATIVE_INFINITY;
    const afterB = k + 1 < out.length ? mid(out[k + 1] as Pause) : Number.POSITIVE_INFINITY;
    const there = pauses.filter((p) => mid(p) >= lo && mid(p) <= hi && mid(p) > before && mid(p) < afterB).sort((x, y) => y.endMs - y.startMs - (x.endMs - x.startMs));
    if (there[0]) out[k] = there[0];
    else unconfirmed.push(k);
  });
  return { boundaries: out, unconfirmed };
}

/** Pure: the per-sentence table a failed take prints. */
export function checkTable(check: TakeCheck, labels: readonly string[]): string[] {
  return [
    "  sentence        verdict   heard",
    ...check.sentences.map((c) => `  ${(labels[c.index] ?? String(c.index)).padEnd(15)} ${c.verdict.padEnd(9)} ${c.matched}/${c.words} words${c.verdict === "ok" ? "" : `: "${c.heard.slice(0, 80)}"`}`),
  ];
}
