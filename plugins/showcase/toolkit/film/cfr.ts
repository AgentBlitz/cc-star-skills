/**
 * The film's frame arithmetic (PLAN §2.5 "Video"), pure so it can be tested on its own:
 *
 * - **The constant-frame-rate schedule:** output frame k shows the latest captured frame at or
 *   before `t0 + k / fps`. The output has `round((t1 − t0) × fps)` frames, so the video's
 *   duration equals the timeline's to within half a frame.
 * - **Gaps:** the time between consecutive captured frames inside the take. With the page's
 *   heartbeat on (`film-aids.ts`) Chrome makes a frame on every vsync, so any long gap is a
 *   frame the capture missed, except the held frame of a full page load (S-D4): a gap that
 *   contains a `nav` load is exempt.
 * - **Frame rate:** captured frames per second in one-second windows, stepped by 250 ms.
 *
 * All times are epoch milliseconds.
 */

/** A `nav` load up to this long before a gap starts still explains it (the swap lags the commit). */
export const NAV_SLACK_MS = 100;

export function cfrCount(t0: number, t1: number, fps: number): number {
  return Math.max(1, Math.round(((t1 - t0) * fps) / 1000));
}

/** For each output frame, the index of the captured frame it shows. `ts` must be sorted. */
export function cfrSchedule(ts: readonly number[], fps: number, t0: number, t1: number): number[] {
  if (ts.length === 0) throw new Error("no frames were captured");
  const n = cfrCount(t0, t1, fps);
  const out: number[] = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const t = t0 + (k * 1000) / fps;
    while (j + 1 < ts.length && (ts[j + 1] as number) <= t) j++;
    out.push(j);
  }
  return out;
}

export interface Gap {
  /** Where the gap starts and ends, clipped to the take. */
  from: number;
  to: number;
  ms: number;
  /** It contains a page load: the held frame S-D4 allows. */
  nav: boolean;
}

/** The gaps between captured frames over `[from, to]`, longest first. */
export function frameGaps(ts: readonly number[], from: number, to: number, navLoads: readonly number[] = []): Gap[] {
  const gaps: Gap[] = [];
  const edges = [...ts.filter((t) => t > from && t < to)];
  const before = ts.filter((t) => t <= from).at(-1);
  const points = [before ?? from, ...edges, to];
  for (let i = 1; i < points.length; i++) {
    const a = Math.max(points[i - 1] as number, from);
    const b = points[i] as number;
    if (b <= a) continue;
    const raw = points[i - 1] as number;
    gaps.push({ from: a, to: b, ms: b - a, nav: navLoads.some((l) => l >= raw - NAV_SLACK_MS && l <= b) });
  }
  return gaps.sort((x, y) => y.ms - x.ms);
}

export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const s = [...values].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[i] as number;
}

/** Captured frames per second over `[from, to]`: one-second windows, 250 ms apart. */
export function fpsWindows(ts: readonly number[], from: number, to: number): number[] {
  const out: number[] = [];
  for (let a = from; a + 1000 <= to; a += 250) {
    let n = 0;
    for (const t of ts) if (t >= a && t < a + 1000) n++;
    out.push(n);
  }
  return out;
}
