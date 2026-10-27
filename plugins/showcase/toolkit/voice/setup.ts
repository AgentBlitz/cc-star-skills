/**
 * Who speaks (PLAN §2.3, §2.4): the narrator from `showcase/config.json` with the
 * `SHOWCASE_TTS_*` overrides, the draft voice (with the fallback off macOS), and the key. The key
 * comes only from `lib/env.ts` (C1); this module hands it to the pipeline and nowhere else.
 */
import type { Config } from "../lib/config.ts";
import { type EnvOptions, PermissionError, resolveAll } from "../lib/env.ts";
import { NARRATOR_PROVIDERS, type NarratorProvider, PROVIDER_KEY } from "./tts/narrator.ts";
import { DEFAULT_SAY_RATE, DEFAULT_SAY_VOICE, findSay } from "./tts/say.ts";

export interface Narrator {
  provider: NarratorProvider;
  model: string;
  voice: string;
  instructions?: string;
  speed?: number;
}

export interface Draft {
  provider: "say" | "fake";
  voice: string;
  rate: number;
}

export interface VoiceSetup {
  narrator: Narrator | null;
  /** The date the narrator was approved, or false. */
  approved: string | false;
  draft: Draft;
  /** Why the draft isn't what the config asked for (no `say` here), if so. */
  draftWarning: string | null;
  /** The narrator's provider's key (OpenRouter's when there is no narrator). */
  apiKey: string | undefined;
  /** That key's name, for messages. */
  keyName: string;
  keySource: string | null;
  /** Every provider's key that is set, for the audition, which can try both. */
  keys: Partial<Record<NarratorProvider, string>>;
  /** The user key file is too open to read; the fix is in the message. */
  keyProblem: string | null;
}

export interface SetupOptions extends EnvOptions {
  /** Where `say` is, or null for none (a test aid); default: look. */
  say?: string | null;
}

export function loadSetup(config: Config, opts: SetupOptions = {}): VoiceSetup {
  const { values, files } = resolveAll(opts);
  const get = (name: string) => values.find((v) => v.name === name);
  const given = config.voice.narrator;
  const provider: NarratorProvider = given?.provider ?? "openrouter";
  const keyName = PROVIDER_KEY[provider];
  const key = get(keyName);
  const keys: Partial<Record<NarratorProvider, string>> = {};
  for (const p of NARRATOR_PROVIDERS) {
    const v = get(PROVIDER_KEY[p])?.value;
    if (v) keys[p] = v;
  }
  const keyProblem = !key?.source && files.user.state === "loose" ? new PermissionError(files.user.path, "file", 0, files.user.fix ?? "").message : null;

  const model = get("SHOWCASE_TTS_MODEL")?.value ?? given?.model;
  const voice = get("SHOWCASE_TTS_VOICE")?.value ?? given?.voice;
  const instructions = get("SHOWCASE_TTS_INSTRUCTIONS")?.value ?? given?.instructions;
  const speedText = get("SHOWCASE_TTS_SPEED")?.value;
  const speed = speedText !== undefined ? Number(speedText) : given?.speed;
  if (speed !== undefined && !(speed >= 0.5 && speed <= 2)) throw new Error("SHOWCASE_TTS_SPEED must be a number between 0.5 and 2");
  const narrator: Narrator | null = model && voice ? { provider, model, voice, ...(instructions ? { instructions } : {}), ...(speed !== undefined ? { speed } : {}) } : null;

  const wantsSay = config.voice.draft.provider === "say";
  const say = opts.say === undefined ? findSay() : opts.say;
  const fallback = wantsSay && !say;
  const draft: Draft = fallback
    ? { provider: "fake", voice: "tone", rate: 0 }
    : wantsSay
      ? { provider: "say", voice: config.voice.draft.voice ?? DEFAULT_SAY_VOICE, rate: DEFAULT_SAY_RATE }
      : { provider: "fake", voice: "tone", rate: 0 };

  return {
    narrator,
    approved: given?.approved ?? false,
    draft,
    draftWarning: fallback ? "`say` isn't available on this machine: the draft voice is a fake tone" : null,
    apiKey: key?.value,
    keyName,
    keys,
    keySource: key?.source ?? null,
    keyProblem,
  };
}
