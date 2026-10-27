/**
 * Requesty's router, `POST /v1/audio/speech` (showcase 1.1): OpenAI-compatible, so OpenAI's
 * `gpt-4o-mini-tts` and its voices (Fable among them) speak with `instructions` for the delivery.
 * The only place `REQUESTY_API_KEY` is sent; every failure goes through `redact()`. Its rules are
 * OpenRouter's (`openrouter.ts`):
 *   - network errors, timeouts, 429 and 5xx are retried at 1, 3 and 9 s, honouring a capped `Retry-After`;
 *   - the format chain (wav → pcm → mp3) is remembered per model, so only a model's first request probes it;
 *   - 401, 403 and 402 are never retried and their bodies are never read, let alone echoed.
 * Errors arrive as `{"error": {"origin", "message"}}`. Nothing here calls OpenAI directly.
 */
import { redact } from "../../lib/redact.ts";
import type { AudioFormat, TtsRequest, TtsResult } from "../types.ts";
import { type FormatMemory, magicFormat, RETRY_DELAYS_MS, retryAfterMs } from "./openrouter.ts";

export const ROUTER_BASE = "https://router.requesty.ai/v1";
/** Requesty's management API: where a key can ask about itself, for free (`keys test`). */
export const MANAGE_BASE = "https://api-v2.requesty.ai/v1";
/** A long take is one call (up to 4,096 characters), so the timeout allows minutes of audio. */
const TIMEOUT_MS = 180_000;
const MAX_BODY_ECHO = 300;

/** The base URLs. A loopback override (`SHOWCASE_REQUESTY_BASE`) exists for tests only. */
export function requestyBase(): { router: string; manage: string } {
  const base = process.env.SHOWCASE_REQUESTY_BASE;
  if (base && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(base)) {
    const b = base.replace(/\/$/, "");
    return { router: b, manage: b };
  }
  return { router: ROUTER_BASE, manage: MANAGE_BASE };
}

export class RequestyKeyRejected extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`Requesty rejected the key (${status}): check it with \`showcase keys test REQUESTY_API_KEY\``);
    this.name = "RequestyKeyRejected";
    this.status = status;
  }
}

export class RequestyNoCredits extends Error {
  constructor() {
    super("Requesty says the account has no credits (402): top it up, or use --draft");
    this.name = "RequestyNoCredits";
  }
}

/** Tried in order until one is accepted. pcm is raw 24 kHz, 16-bit mono, as OpenAI sends it. */
export const FORMAT_CHAIN: readonly AudioFormat[] = ["wav", "pcm", "mp3"];

/** The format memory is shared with OpenRouter's, so a Requesty model is kept apart by its prefix. */
export const memoryKey = (model: string): string => `requesty:${model}`;

export interface RequestyOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  formats: FormatMemory;
  /** Injectable for tests: the real default really waits. */
  sleep?: (ms: number) => Promise<void>;
  retryDelaysMs?: readonly number[];
  timeoutMs?: number;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function requestBody(req: TtsRequest, format: AudioFormat): Record<string, unknown> {
  const body: Record<string, unknown> = { model: req.model, voice: req.voice, input: req.text, response_format: format };
  if (req.instructions) body.instructions = req.instructions;
  if (req.speed !== undefined && req.speed !== 1) body.speed = req.speed;
  return body;
}

/** The message of a `{"error": {"origin", "message"}}` body, else the text itself. */
function errorMessage(text: string): string {
  try {
    const e = (JSON.parse(text) as { error?: { origin?: unknown; message?: unknown } }).error;
    if (e && typeof e.message === "string") return typeof e.origin === "string" ? `${e.message} (${e.origin})` : e.message;
  } catch {}
  return text;
}

/**
 * Synthesises one request. Retries a thrown fetch (network error or timeout), 429 and 5xx up to
 * three times, waiting `Retry-After` when sent, else 1, 3, 9 s. A 400 that names the format moves
 * to the next entry of {@link FORMAT_CHAIN}; the format that works is remembered for the model.
 */
export async function synthRequesty(req: TtsRequest, options: RequestyOptions): Promise<TtsResult> {
  const fetchImpl = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const sleep = options.sleep ?? realSleep;
  const delays = options.retryDelaysMs ?? RETRY_DELAYS_MS;
  const memory = options.formats;
  const endpoint = `${requestyBase().router}/audio/speech`;
  const clean = (text: string) => redact(text, [options.apiKey]);

  const remembered = memory.get(memoryKey(req.model));
  let formatIndex = Math.max(0, remembered ? FORMAT_CHAIN.indexOf(remembered) : 0);
  let attempt = 0;

  for (;;) {
    const format = FORMAT_CHAIN[formatIndex] as AudioFormat;
    let res: Response;
    let bytes: Buffer | null = null;
    try {
      res = await fetchImpl(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(requestBody(req, format)),
        signal: AbortSignal.timeout(options.timeoutMs ?? TIMEOUT_MS),
      });
      if (res.ok) bytes = Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (attempt >= delays.length) throw new Error(clean(`Requesty request failed after ${attempt} retries: ${(e as Error).message}`));
      await sleep(delays[attempt] as number);
      attempt++;
      continue;
    }

    if (res.status === 401 || res.status === 403) throw new RequestyKeyRejected(res.status);
    if (res.status === 402) throw new RequestyNoCredits();

    if (res.status === 429 || res.status >= 500) {
      if (attempt >= delays.length) throw new Error(`Requesty ${res.status} after ${attempt} retries`);
      await sleep(retryAfterMs(res.headers.get("retry-after")) ?? (delays[attempt] as number));
      attempt++;
      continue;
    }

    if (!res.ok) {
      const text = clean(errorMessage(await res.text().catch(() => "")).slice(0, MAX_BODY_ECHO));
      if (res.status === 400 && /format/i.test(text) && formatIndex < FORMAT_CHAIN.length - 1) {
        formatIndex++;
        continue;
      }
      throw new Error(`Requesty ${res.status}: ${text}`);
    }

    if (!bytes) throw new Error("Requesty answered with no body");
    // pcm has no magic bytes to sniff: we know what we asked for and it answered 200.
    const detected = format === "pcm" ? "pcm" : magicFormat(bytes);
    if (!detected) throw new Error("Requesty's response has no recognised audio magic bytes");
    if (memory.get(memoryKey(req.model)) !== format) memory.set(memoryKey(req.model), format);
    return { bytes, format: detected };
  }
}
