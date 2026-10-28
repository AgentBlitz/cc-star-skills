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
 * or repeated. The heard words' times then place each cut: at the pause nearest the gap they
 * leave between two sentences (showcase 1.1.1).
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

/**
 * A hyphenated compound reads as its closed form ("sign-up" as "signup", as Whisper often writes
 * it), unless it's a number ("twenty-first" stays two words, as the figures are spelled).
 */
const COMPOUND = /\b[a-z]+(?:-[a-z]+)+\b/g;
const NUMBERISH = new Set([...NUMBER_WORDS, ...Array.from({ length: 99 }, (_, i) => ordinalWords(i + 1).split(" ").pop() as string), "hundredth", "thousandth", "millionth"]);
const closeCompound = (c: string): string => {
  const parts = c.split("-");
  return parts.join(parts.some((p) => NUMBERISH.has(p)) ? " " : "");
};

/** Pure: lower-case words with the punctuation gone, the figures spelled out and each hyphenated compound closed. */
export function normaliseWords(text: string): string[] {
  let t = text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  t = t.replace(/[‘’ʼ]/g, "'").replace(/[–—]/g, " ");
  t = t.replace(COMPOUND, closeCompound);
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

/** The script's hyphenated compounds, closed, as {@link normaliseWords} writes them. */
function closedCompounds(text: string): string[] {
  const t = text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[‘’ʼ']/g, "");
  return [...t.matchAll(COMPOUND)].map((m) => closeCompound(m[0])).filter((w) => !w.includes(" "));
}

/** Heard words that spell one of the script's compounds apart ("sign up" for "sign-up") become that one word, timed across them. */
function joinCompounds(said: readonly { w: string; h: Word }[], closed: ReadonlySet<string>): { w: string; h: Word }[] {
  if (closed.size === 0) return [...said];
  const out: { w: string; h: Word }[] = [];
  for (let i = 0; i < said.length; ) {
    const n = [3, 2].find((len) => i + len <= said.length && closed.has(said.slice(i, i + len).map((x) => x.w).join("")));
    if (!n) {
      out.push(said[i] as { w: string; h: Word });
      i++;
      continue;
    }
    const parts = said.slice(i, i + n);
    const w = parts.map((x) => x.w).join("");
    out.push({ w, h: { word: w, startMs: (parts[0] as { h: Word }).h.startMs, endMs: (parts[n - 1] as { h: Word }).h.endMs } });
    i += n;
  }
  return out;
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
  const said = joinCompounds(
    heard.flatMap((h) => normaliseWords(h.word).map((w) => ({ w, h }))),
    new Set(sentences.flatMap(closedCompounds)),
  );
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

/**
 * How far a pause may lie outside the heard gap between two sentences and still be its pause.
 * Whisper's stamps can run back to back, and lag or lead the speech by a few hundred ms.
 */
export const SNAP_TOLERANCE_MS = 1000;
/** Of the pauses near one heard gap, each loses this much of its length per ms it lies outside the gap. */
const SNAP_DISTANCE_WEIGHT = 0.5;
/** The shortest slice a cut may leave, so a cut kept from the fit never undoes its neighbours' order. */
const MIN_SLICE_MS = 100;

interface HeardGap {
  lo: number;
  hi: number;
}

/** The heard gap after sentence `k`: from its last heard word's end to the next sentence's first heard word's start. */
function heardGap(check: TakeCheck, k: number): HeardGap | null {
  const last = check.sentences[k]?.lastMs;
  const first = check.sentences[k + 1]?.firstMs;
  if (last == null || first == null) return null;
  return { lo: Math.min(last, first), hi: Math.max(last, first) };
}

const outside = (p: Pause, g: HeardGap): number => Math.max(0, g.lo - p.endMs, p.startMs - g.hi);

/**
 * Pure: the pause each heard gap snaps to, or null. Every pause belongs to the gap it lies
 * nearest, so a short sentence keeps the pause that ends it; within {@link SNAP_TOLERANCE_MS} of
 * its gap, the longest wins, less half of how far outside the gap it lies.
 */
function snapTo(pool: readonly Pause[], gaps: readonly (HeardGap | null)[]): (Pause | null)[] {
  const best: ({ p: Pause; score: number } | null)[] = gaps.map(() => null);
  for (const p of pool) {
    let owner = -1;
    let near = Number.POSITIVE_INFINITY;
    gaps.forEach((g, k) => {
      if (!g) return;
      const d = outside(p, g);
      if (d < near) {
        near = d;
        owner = k;
      }
    });
    if (owner < 0 || near > SNAP_TOLERANCE_MS) continue;
    const score = p.endMs - p.startMs - SNAP_DISTANCE_WEIGHT * near;
    const held = best[owner];
    if (!held || score > held.score) best[owner] = { p, score };
  }
  return best.map((b) => b?.p ?? null);
}

/**
 * Pure: the cuts, following the heard words. Each boundary snaps to the pause nearest the gap the
 * heard words leave between its two sentences (the last heard word of one, the first of the next),
 * within about a second, the longest there preferred: from `pauses` first, else from `softPauses`
 * (a quieter pass that finds a pause a breath fills). A strict pause widens to the quieter pause
 * that holds it, so its end is where the next sentence's speech starts.
 *
 * The fitted cut matters only where neither pass has a pause near the gap: it stands there and is
 * reported, unless it would fall out of order with the cuts around it, when the cut goes to the
 * middle of the heard gap instead. A boundary whose sentences weren't heard keeps its fitted cut,
 * unreported, as long as it stays in order (moved, it is reported). The cuts come back in order,
 * with no slice shorter than {@link MIN_SLICE_MS}.
 */
export function confirmBoundaries(boundaries: readonly Pause[], pauses: readonly Pause[], check: TakeCheck, softPauses: readonly Pause[] = []): { boundaries: Pause[]; unconfirmed: number[] } {
  const gaps = boundaries.map((_, k) => heardGap(check, k));
  const strict = snapTo(pauses, gaps);
  const soft = snapTo(softPauses, gaps);
  // A strict pause widens to the quieter stretch around it, so a breath before the next sentence
  // counts as pause, and the slice's onset is where that sentence's speech starts.
  const widen = (p: Pause | null, g: HeardGap): Pause | null => {
    if (!p) return null;
    const q = softPauses.find((x) => x.startMs <= mid(p) && x.endMs >= mid(p));
    return q && outside(q, g) <= SNAP_TOLERANCE_MS ? q : p;
  };
  const snapped = gaps.map((g, k) => (g ? (widen(strict[k] ?? null, g) ?? soft[k] ?? null) : null));
  const unconfirmed: number[] = [];
  const out: Pause[] = [];
  let prev = 0;
  boundaries.forEach((fitted, k) => {
    const nextSnap = snapped.slice(k + 1).find((p): p is Pause => p !== null && mid(p) > prev + 2 * MIN_SLICE_MS);
    const next = nextSnap ? mid(nextSnap) : Number.POSITIVE_INFINITY;
    const fits = (p: Pause) => mid(p) >= prev + MIN_SLICE_MS && mid(p) <= next - MIN_SLICE_MS;
    const g = gaps[k];
    const middle: Pause | null = g ? { startMs: (g.lo + g.hi) / 2, endMs: (g.lo + g.hi) / 2 } : null;
    const between: Pause = { startMs: (prev + next) / 2, endMs: (prev + next) / 2 };
    const options = [snapped[k], fitted, middle].filter((p): p is Pause => p != null);
    const chosen = options.find(fits) ?? (Number.isFinite(next) ? between : { startMs: prev + MIN_SLICE_MS, endMs: prev + MIN_SLICE_MS });
    if (chosen !== (g ? snapped[k] : fitted)) unconfirmed.push(k);
    out.push(chosen);
    prev = mid(chosen);
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
