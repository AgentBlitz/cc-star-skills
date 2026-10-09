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
import type { AudioPort, Cue, VoiceManifest } from "./narration.ts";

/** How long `play` waits for `playing` before the sentence goes on without it. */
export const AUDIO_GRACE_MS = 300;
export const MUTED_KEY = "showcase:muted";

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

export function createBridgeAudio(options: BridgeAudioOptions): BridgeAudio {
  const { bridge, document: doc, storage } = options;
  const win = doc.defaultView as (Window & typeof globalThis) | null;
  const stats: AudioStats = { played: [], failed: [] };
  const urls = new Map<string, Promise<string | null>>();
  let muted = options.muted ?? false;
  try {
    const kept = storage?.getItem(MUTED_KEY);
    if (kept === "true") muted = true;
    else if (kept === "false" && options.muted === undefined) muted = false;
  } catch {
    // A refused store.
  }
  let el: HTMLAudioElement | null = null;
  let held = false;

  const element = (): HTMLAudioElement | null => {
    if (el) return el;
    if (!win) return null;
    el = new win.Audio();
    el.preload = "auto";
    el.muted = muted;
    return el;
  };

  const load = (file: string): Promise<string | null> => {
    let p = urls.get(file);
    if (!p && options.clipUrl) {
      p = Promise.resolve(options.clipUrl(file));
      urls.set(file, p);
    }
    if (!p) {
      p = bridge
        .asset(file, "voice")
        .then((data) => {
          const View = win ?? globalThis;
          const blob = new View.Blob([data.bytes as BlobPart], { type: data.type || "audio/mpeg" });
          return View.URL.createObjectURL(blob);
        })
        .catch((e: unknown) => {
          stats.failed.push(`${file}: ${e instanceof Error ? e.message : String(e)}`);
          return null;
        });
      urls.set(file, p);
    }
    return p;
  };

  // Everything ahead, in order: a 2-minute film's clips are about a megabyte.
  if (bridge.present && options.manifest) {
    const files = [...new Set(options.manifest.clips.map((c) => c.file))];
    void (async () => {
      for (const f of files) await load(f);
    })();
  }

  return {
    stats,
    get element() {
      return el;
    },
    get muted() {
      return muted;
    },
    setMuted(m) {
      muted = m;
      if (el) el.muted = m;
      try {
        storage?.setItem(MUTED_KEY, String(m));
      } catch {
        // As above.
      }
    },
    preload(cue) {
      if (cue.audio && bridge.present) void load(cue.audio.file);
    },
    async play(cue: Cue, signal?: AbortSignal) {
      if (!cue.audio || !bridge.present) return;
      const a = element();
      if (!a) return;
      held = false;
      await new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          options.clearTimeout(timer);
          a.removeEventListener("playing", finish);
          signal?.removeEventListener("abort", finish);
          resolve();
        };
        const timer = options.setTimeout(finish, AUDIO_GRACE_MS);
        signal?.addEventListener("abort", finish, { once: true });
        a.addEventListener("playing", finish);
        void load((cue.audio as { file: string }).file).then((url) => {
          if (!url || signal?.aborted) {
            finish();
            return;
          }
          a.src = url;
          a.muted = muted;
          a.currentTime = 0;
          stats.played.push((cue.audio as { hash: string }).hash);
          const p = a.play();
          if (p) p.catch((e: unknown) => stats.failed.push(`play: ${e instanceof Error ? e.message : String(e)}`));
        });
      });
    },
    pause() {
      if (el && !el.paused) {
        el.pause();
        held = true;
      }
    },
    resume() {
      if (el && held) {
        held = false;
        void el.play()?.catch(() => {});
      }
    },
    stop() {
      held = false;
      if (el) {
        el.pause();
        try {
          el.currentTime = 0;
        } catch {
          // Nothing loaded.
        }
      }
    },
  };
}
