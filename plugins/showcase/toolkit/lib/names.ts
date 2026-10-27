/** The variable names showcase knows about (PLAN §2.3). */

/** Read from the environment, an ignored `.env.local` or the user file. */
export const KEY_NAMES = [
  "OPENROUTER_API_KEY",
  "REQUESTY_API_KEY",
  "SHOWCASE_TTS_MODEL",
  "SHOWCASE_TTS_VOICE",
  "SHOWCASE_TTS_INSTRUCTIONS",
  "SHOWCASE_TTS_SPEED",
] as const;

export type KeyName = (typeof KEY_NAMES)[number];

/** Secrets: masked by `redact()`, stripped from the app server's environment. */
export const SECRET_NAMES = [
  "OPENROUTER_API_KEY",
  "REQUESTY_API_KEY",
  "ELEVENLABS_API_KEY",
  "OPENAI_API_KEY",
  "AZURE_SPEECH_KEY",
] as const;

/** Every name showcase owns, stripped from the app server's environment. */
export const SHOWCASE_NAMES: readonly string[] = [...KEY_NAMES, ...SECRET_NAMES, "AZURE_SPEECH_REGION"];
