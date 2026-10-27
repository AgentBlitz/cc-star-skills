/**
 * The public speech catalogues (PLAN §2.4): OpenRouter's `GET /api/v1/models?output_modalities=speech`,
 * models and their `supported_voices`, and Requesty's `GET /v1/models/speech` (showcase 1.1). No key
 * is needed for either, so nothing here touches `env.ts`.
 */
import { requestyBase } from "./tts/requesty.ts";

export const CATALOGUE_URL = "https://openrouter.ai/api/v1/models?output_modalities=speech";

export interface SpeechModel {
  id: string;
  name: string;
  voices: string[];
}

export async function fetchCatalogue(fetchImpl: typeof fetch = (...args) => fetch(...args)): Promise<SpeechModel[]> {
  const res = await fetchImpl(CATALOGUE_URL, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`OpenRouter's catalogue returned ${res.status}`);
  const body = (await res.json()) as { data?: { id?: unknown; name?: unknown; supported_voices?: unknown }[] };
  return (body.data ?? [])
    .filter((m): m is { id: string; name?: unknown; supported_voices?: unknown } => typeof m.id === "string")
    .map((m) => ({
      id: m.id,
      name: typeof m.name === "string" ? m.name : m.id,
      voices: Array.isArray(m.supported_voices) ? m.supported_voices.filter((v): v is string => typeof v === "string") : [],
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Does the catalogue offer this model, and (when it lists voices) this voice? */
export function offered(catalogue: readonly SpeechModel[], model: string, voice: string): { model: boolean; voice: boolean } {
  const m = catalogue.find((x) => x.id === model);
  return { model: Boolean(m), voice: Boolean(m) && (m?.voices.length === 0 || m?.voices.includes(voice) === true) };
}

/**
 * OpenAI's voices for `gpt-4o-mini-tts` (its text-to-speech guide, read 2026-10-27). Requesty's
 * listing carries no voices, so they are named here, for that model and its dated snapshots.
 */
export const OPENAI_TTS_VOICES: readonly string[] = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse", "marin", "cedar"];
const OPENAI_TTS_MODEL = "openai/gpt-4o-mini-tts";

/** Requesty's public speech listing, `GET /v1/models/speech`. No key is needed, so none is sent. */
export async function fetchRequestyCatalogue(fetchImpl: typeof fetch = (...args) => fetch(...args)): Promise<SpeechModel[]> {
  const res = await fetchImpl(`${requestyBase().router}/models/speech`, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Requesty's catalogue returned ${res.status}`);
  const body = (await res.json()) as { data?: { id?: unknown }[] };
  return (body.data ?? [])
    .filter((m): m is { id: string } => typeof m.id === "string")
    .map((m) => ({ id: m.id, name: m.id, voices: m.id === OPENAI_TTS_MODEL || m.id.startsWith(`${OPENAI_TTS_MODEL}-`) ? [...OPENAI_TTS_VOICES] : [] }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
