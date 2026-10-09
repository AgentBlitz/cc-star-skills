/**
 * The voice in Watch (PLAN §2.1 "Audio", C5): the `AudioPort` the director speaks through when the
 * runtime is injected. Clips are found in the manifest by tour, beat and exact text
 * (`narration.ts`), their bytes come through the host binding (no network, D16) and play from
 * Blob URLs on one `HTMLAudioElement`.
 *
 * - `play` resolves on `playing`, or after a short grace at the latest: the sentence's clock
 *   starts then and runs for its `durationMs`, whatever the clip does.
 * - Muting is the element's `muted` flag only, so a muted tour keeps exactly the same timing: the
 *   clip still loads and plays. The choice is kept for the tab in sessionStorage, so a page load
 *   doesn't forget it.
 * - Every clip of the manifest is fetched ahead, in order, once per document.
 */
import type { Bridge } from "./bridge.ts";
import type { AudioPort, VoiceManifest } from "./narration.ts";
/** How long `play` waits for `playing` before the sentence goes on without it. */
export declare const AUDIO_GRACE_MS = 300;
export declare const MUTED_KEY = "showcase:muted";
export interface AudioStats {
    /** The clips started, by hash, in order. */
    played: string[];
    /** Clips that couldn't be fetched or played, with why. */
    failed: string[];
}
export interface BridgeAudioOptions {
    bridge: Bridge;
    document: Document;
    manifest: VoiceManifest | null;
    muted?: boolean;
    storage?: Pick<Storage, "getItem" | "setItem"> | null;
    setTimeout: (fn: () => void, ms: number) => number;
    clearTimeout: (id: number) => void;
    /** In-app: a clip's URL on the app's static path, played as it is (no host to ask). */
    clipUrl?: (file: string) => string;
}
export interface BridgeAudio extends AudioPort {
    readonly stats: AudioStats;
    readonly element: HTMLAudioElement | null;
}
export declare function createBridgeAudio(options: BridgeAudioOptions): BridgeAudio;
