/** What every TTS provider (`tts/openrouter.ts`, `tts/say.ts`, `tts/fake.ts`) takes and returns (PLAN §2.4). */
export interface TtsRequest {
  text: string;
  provider: string;
  model: string;
  voice: string;
  instructions?: string;
  speed?: number;
}

/**
 * `pcm` is raw signed 16-bit little-endian samples at 24 kHz mono, no container: some OpenRouter
 * speech models (Gemini's TTS family) answer only in this format.
 */
export type AudioFormat = "wav" | "mp3" | "ogg" | "flac" | "pcm";

export interface TtsResult {
  bytes: Buffer;
  format: AudioFormat;
}
