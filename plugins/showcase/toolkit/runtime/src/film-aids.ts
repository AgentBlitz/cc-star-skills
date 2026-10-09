/**
 * What the recorder asks of the page in film mode (PLAN §2.5 "Capture"), on the captured clocks:
 *
 * - **The clock-sync probe:** a full-viewport flash drawn in a known animation frame. The host
 *   finds the first screencast frame that shows it and compares that frame's timestamp with the
 *   wall time returned here (`Date.now()`, captured): the offset between the page's clock and
 *   the capture's.
 * - **The heartbeat:** a 1 px element in the corner whose opacity flips between 0 and 0.01 every
 *   frame. The screencast only sends a frame when something changed, so on a still screen a gap
 *   would mean nothing; with the heartbeat Chrome makes a frame on every vsync, and any gap is a
 *   frame the capture missed (or a page load's held frame, S-D4). Nobody can see it.
 * - **The page's own frame rate:** the heartbeat's animation frames over its running time.
 *
 * The host starts the heartbeat at the pre-roll, and sets `window.__showcaseRolling` for every
 * later document, so a page load picks it up again at boot.
 */
import type { Natives } from "./capture.ts";

export const ROLLING_KEY = "__showcaseRolling";
const PROBE_TAG = "showcase-probe";
const HEARTBEAT_TAG = "showcase-heartbeat";
/** The probe's colour: nothing in an app is this exact magenta over the whole screen. */
export const PROBE_COLOUR = "#ff00ff";

/** An animation frame that came late: the page itself stalled (wall time it ended, and how long). */
export interface Stall {
  wall: number;
  ms: number;
}

export interface FrameRate {
  frames: number;
  ms: number;
  /** The page's own stalls over 50 ms (the first 100). */
  stalls: Stall[];
}

const STALL_MS = 50;

export interface FilmAids {
  /** Draws the flash for `holdMs`; resolves with the wall time of the frame it was drawn in. */
  probe(holdMs?: number): Promise<{ wall: number }>;
  heartbeat(on: boolean): void;
  /** Animation frames since the heartbeat started in this document. */
  frameRate(): FrameRate;
}

function fixed(el: HTMLElement, css: Partial<CSSStyleDeclaration>): void {
  // CSSOM, not a style attribute: allowed under a strict CSP.
  Object.assign(el.style, { position: "fixed", pointerEvents: "none", zIndex: "2147483647", margin: "0", padding: "0", border: "0" }, css);
}

export function createFilmAids(win: Window, n: Natives): FilmAids {
  const doc = win.document;
  let beat: { el: HTMLElement; frame: number; frames: number; since: number; flip: boolean; last: number; stalls: Stall[] } | null = null;

  const attach = (el: HTMLElement): boolean => {
    if (el.isConnected) return true;
    const root = doc.documentElement;
    if (!root) return false;
    root.appendChild(el);
    return true;
  };

  const tick = () => {
    const b = beat;
    if (!b) return;
    const now = n.perfNow();
    if (b.frames > 0 && now - b.last > STALL_MS && b.stalls.length < 100) b.stalls.push({ wall: n.dateNow(), ms: Math.round(now - b.last) });
    b.last = now;
    if (attach(b.el)) {
      b.flip = !b.flip;
      b.el.style.opacity = b.flip ? "0.01" : "0";
      b.frames += 1;
    }
    b.frame = n.requestAnimationFrame(tick);
  };

  return {
    probe(holdMs = 200) {
      return new Promise((resolve) => {
        const el = doc.createElement(PROBE_TAG);
        fixed(el, { inset: "0", width: "100vw", height: "100vh", background: PROBE_COLOUR, display: "block" });
        n.requestAnimationFrame(() => {
          attach(el);
          // This frame's rendering update draws it: its time is the probe's.
          const wall = n.dateNow();
          n.setTimeout(() => {
            el.remove();
            resolve({ wall });
          }, holdMs);
        });
      });
    },
    heartbeat(on) {
      if (on && !beat) {
        const el = doc.createElement(HEARTBEAT_TAG);
        fixed(el, { right: "0", bottom: "0", width: "1px", height: "1px", background: "#000", opacity: "0", display: "block" });
        beat = { el, frame: 0, frames: 0, since: n.perfNow(), flip: false, last: n.perfNow(), stalls: [] };
        beat.frame = n.requestAnimationFrame(tick);
      } else if (!on && beat) {
        n.cancelAnimationFrame(beat.frame);
        beat.el.remove();
        beat = null;
      }
    },
    frameRate: () => (beat ? { frames: beat.frames, ms: n.perfNow() - beat.since, stalls: [...beat.stalls] } : { frames: 0, ms: 0, stalls: [] }),
  };
}
