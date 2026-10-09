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
export declare const ROLLING_KEY = "__showcaseRolling";
/** The probe's colour: nothing in an app is this exact magenta over the whole screen. */
export declare const PROBE_COLOUR = "#ff00ff";
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
export interface FilmAids {
    /** Draws the flash for `holdMs`; resolves with the wall time of the frame it was drawn in. */
    probe(holdMs?: number): Promise<{
        wall: number;
    }>;
    heartbeat(on: boolean): void;
    /** Animation frames since the heartbeat started in this document. */
    frameRate(): FrameRate;
}
export declare function createFilmAids(win: Window, n: Natives): FilmAids;
