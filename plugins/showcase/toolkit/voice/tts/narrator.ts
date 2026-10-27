/**
 * The paid narrator's providers (showcase 1.1): OpenRouter, the 1.0 default, and Requesty. Each
 * has its own key, and a rejected key or an empty account at either one stops the queue.
 */
import type { TtsRequest, TtsResult } from "../types.ts";
import { type FormatMemory, OpenRouterKeyRejected, OpenRouterNoCredits, synthOpenRouter } from "./openrouter.ts";
import { RequestyKeyRejected, RequestyNoCredits, synthRequesty } from "./requesty.ts";

export const NARRATOR_PROVIDERS = ["openrouter", "requesty"] as const;
export type NarratorProvider = (typeof NARRATOR_PROVIDERS)[number];

/** The key each provider needs. */
export const PROVIDER_KEY = { openrouter: "OPENROUTER_API_KEY", requesty: "REQUESTY_API_KEY" } as const satisfies Record<NarratorProvider, string>;

/** The provider's name, as messages say it. */
export const PROVIDER_LABEL: Record<NarratorProvider, string> = { openrouter: "OpenRouter", requesty: "Requesty" };

export interface NarratorCallOptions {
  apiKey: string;
  formats: FormatMemory;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  retryDelaysMs?: readonly number[];
}

export function synthNarrator(provider: NarratorProvider, req: TtsRequest, options: NarratorCallOptions): Promise<TtsResult> {
  return provider === "requesty" ? synthRequesty(req, options) : synthOpenRouter(req, options);
}

/** A rejected key (401, 403) or no credits (402): nothing else in the queue can succeed. */
export function stopsQueue(e: unknown): boolean {
  return e instanceof OpenRouterKeyRejected || e instanceof OpenRouterNoCredits || e instanceof RequestyKeyRejected || e instanceof RequestyNoCredits;
}
