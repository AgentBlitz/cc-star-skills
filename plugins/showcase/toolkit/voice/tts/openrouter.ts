/**
 * OpenRouter's `/audio/speech` (PLAN §2.4, D5): the only place the key is sent (C1). Every failure
 * goes through `redact()`. It fixes four faults of the Compass pipeline this was ported from:
 *   1. real concurrency, which is the pool's job (`pool.ts`; the pipeline runs three at a time);
 *   2. post-processing settings in the staleness key (`keys.ts`, `manifest.ts`);
 *   3. network errors and timeouts retried as well as 429 and 5xx, at 1, 3 and 9 s, honouring `Retry-After`;
 *   4. the format chain (wav → mp3 → pcm) remembered per model, so only a model's first sentence probes it.
 * 401, 403 and 402 are never retried and their bodies are never read, let alone echoed.
 */
import { redact } from "../../lib/redact.ts";
import type { AudioFormat, TtsRequest, TtsResult } from "../types.ts";

export const SPEECH_ENDPOINT = "https://openrouter.ai/api/v1/audio/speech";
export const RETRY_DELAYS_MS: readonly number[] = [1000, 3000, 9000];
const TIMEOUT_MS = 60_000;
/** A `Retry-After` longer than this is capped: a stuck minute is a failure, not a wait. */
const MAX_RETRY_AFTER_MS = 120_000;
const MAX_BODY_ECHO = 300;

export class OpenRouterKeyRejected extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`OpenRouter rejected the key (${status}): check it with \`showcase keys test\``);
    this.name = "OpenRouterKeyRejected";
    this.status = status;
  }
}

export class OpenRouterNoCredits extends Error {
  constructor() {
    super("OpenRouter says the account has no credits (402): top it up, or use --draft");
    this.name = "OpenRouterNoCredits";
  }
}

/**
 * Tried in order until one is accepted. `wav` is the general default; some models answer 400 for
 * anything but their one supported format (Gemini's TTS family only takes `pcm`).
 */
export const FORMAT_CHAIN: readonly AudioFormat[] = ["wav", "mp3", "pcm"];

/** Which format of the chain worked for a model; shared across a run so only the first sentence probes. */
export interface FormatMemory {
  get(model: string): AudioFormat | undefined;
  set(model: string, format: AudioFormat): void;
}

export function createFormatMemory(initial: Record<string, AudioFormat> = {}): FormatMemory & { entries(): Record<string, AudioFormat> } {
  const map = new Map<string, AudioFormat>(Object.entries(initial));
  return {
    get: (model) => map.get(model),
    set: (model, format) => void map.set(model, format),
    entries: () => Object.fromEntries([...map].sort(([a], [b]) => a.localeCompare(b))),
  };
}

/** Process-wide default, for callers that don't keep their own. */
const sharedMemory = createFormatMemory();

export interface OpenRouterOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  formats?: FormatMemory;
  /** Injectable for tests: the real default really waits. */
  sleep?: (ms: number) => Promise<void>;
  retryDelaysMs?: readonly number[];
  timeoutMs?: number;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The container a response's bytes declare, or null (pcm has none). `requesty.ts` shares it. */
export function magicFormat(bytes: Buffer): AudioFormat | null {
  if (bytes.length < 4) return null;
  const head = bytes.toString("latin1", 0, 4);
  if (head === "RIFF" && bytes.length >= 12 && bytes.toString("latin1", 8, 12) === "WAVE") return "wav";
  if (head === "OggS") return "ogg";
  if (head === "fLaC") return "flac";
  if (head.startsWith("ID3")) return "mp3";
  if (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0) return "mp3";
  return null;
}

function requestBody(req: TtsRequest, format: AudioFormat): Record<string, unknown> {
  const body: Record<string, unknown> = { model: req.model, input: req.text, voice: req.voice, response_format: format };
  if (req.speed !== undefined && req.speed !== 1) body.speed = req.speed;
  if (req.instructions && req.model.startsWith("openai/")) body.provider = { options: { openai: { instructions: req.instructions } } };
  return body;
}

/** `Retry-After` as milliseconds: delta-seconds or an HTTP date; null when absent or unreadable. */
export function retryAfterMs(header: string | null, now: number = Date.now()): number | null {
  if (!header) return null;
  const secs = Number(header);
  const ms = Number.isFinite(secs) ? secs * 1000 : Date.parse(header) - now;
  if (!Number.isFinite(ms)) return null;
  return Math.min(Math.max(0, ms), MAX_RETRY_AFTER_MS);
}

/**
 * Synthesises one sentence. Retries a thrown fetch (network error or timeout), 429 and 5xx up to
 * three times, waiting `Retry-After` when sent, else 1, 3, 9 s. A 400 that names the format moves
 * to the next entry of {@link FORMAT_CHAIN}; the format that works is remembered for the model.
 */
export async function synthOpenRouter(req: TtsRequest, options: OpenRouterOptions): Promise<TtsResult> {
  const fetchImpl = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const sleep = options.sleep ?? realSleep;
  const delays = options.retryDelaysMs ?? RETRY_DELAYS_MS;
  const memory = options.formats ?? sharedMemory;
  const secrets = [options.apiKey];
  const clean = (text: string) => redact(text, secrets);

  const remembered = memory.get(req.model);
  let formatIndex = Math.max(0, remembered ? FORMAT_CHAIN.indexOf(remembered) : 0);
  let attempt = 0;

  for (;;) {
    const format = FORMAT_CHAIN[formatIndex] as AudioFormat;
    let res: Response;
    let bytes: Buffer | null = null;
    try {
      res = await fetchImpl(SPEECH_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json", "X-Title": "showcase" },
        body: JSON.stringify(requestBody(req, format)),
        signal: AbortSignal.timeout(options.timeoutMs ?? TIMEOUT_MS),
      });
      if (res.ok) bytes = Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (attempt >= delays.length) throw new Error(clean(`OpenRouter request failed after ${attempt} retries: ${(e as Error).message}`));
      await sleep(delays[attempt] as number);
      attempt++;
      continue;
    }

    if (res.status === 401 || res.status === 403) throw new OpenRouterKeyRejected(res.status);
    if (res.status === 402) throw new OpenRouterNoCredits();

    if (res.status === 429 || res.status >= 500) {
      if (attempt >= delays.length) throw new Error(`OpenRouter ${res.status} after ${attempt} retries`);
      await sleep(retryAfterMs(res.headers.get("retry-after")) ?? (delays[attempt] as number));
      attempt++;
      continue;
    }

    if (!res.ok) {
      const text = clean((await res.text().catch(() => "")).slice(0, MAX_BODY_ECHO));
      if (res.status === 400 && /format/i.test(text) && formatIndex < FORMAT_CHAIN.length - 1) {
        formatIndex++;
        continue;
      }
      throw new Error(`OpenRouter ${res.status}: ${text}`);
    }

    if (!bytes) throw new Error("OpenRouter answered with no body");
    // pcm has no magic bytes to sniff: we know what we asked for and it answered 200.
    const detected = format === "pcm" ? "pcm" : magicFormat(bytes);
    if (!detected) throw new Error("OpenRouter's response has no recognised audio magic bytes");
    if (memory.get(req.model) !== format) memory.set(req.model, format);
    return { bytes, format: detected };
  }
}
