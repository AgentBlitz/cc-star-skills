/**
 * The public speech catalogue, `GET /api/v1/models?output_modalities=speech` (PLAN §2.4): models
 * and their `supported_voices`. No key is needed, so nothing here touches `env.ts`.
 */
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
