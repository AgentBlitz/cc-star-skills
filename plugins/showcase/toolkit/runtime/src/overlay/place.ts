/**
 * Where a callout goes beside what the spotlight shows, ported from Compass's `place.ts`. Pure,
 * so a test runs it without a browser.
 *
 * It prefers below the target, then above, then the right, then the left: the first side with
 * room for the whole callout between the top and what the overlay keeps at the foot (captions,
 * controls). With no side free (a target that fills the screen) it sits inside the target's top
 * edge. Either way it is kept on screen.
 */
import type { Rect } from "../anchors.ts";

export type Side = "below" | "above" | "right" | "left" | "inside";

export interface Placement {
  x: number;
  y: number;
  side: Side;
}

export interface Frame {
  /** The viewport. */
  w: number;
  h: number;
  /** What is kept clear at the top and at the foot. */
  top: number;
  bottom: number;
}

/** The space between the target and its callout, and from the screen's edges. */
export const CALLOUT_GAP = 12;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

export function placeCallout(target: Rect, size: { w: number; h: number }, frame: Frame, gap = CALLOUT_GAP): Placement {
  const minX = gap;
  const maxX = frame.w - size.w - gap;
  const minY = frame.top + gap;
  const maxY = frame.h - frame.bottom - size.h - gap;
  const centreX = clamp(target.x + target.w / 2 - size.w / 2, minX, maxX);
  const centreY = clamp(target.y + target.h / 2 - size.h / 2, minY, maxY);

  const below = target.y + target.h + gap;
  if (below + size.h <= frame.h - frame.bottom - gap) return { x: centreX, y: below, side: "below" };
  const above = target.y - gap - size.h;
  if (above >= minY) return { x: centreX, y: above, side: "above" };
  const right = target.x + target.w + gap;
  if (right + size.w <= frame.w - gap) return { x: right, y: centreY, side: "right" };
  const left = target.x - gap - size.w;
  if (left >= minX) return { x: left, y: centreY, side: "left" };
  return { x: clamp(target.x + gap, minX, maxX), y: clamp(target.y + gap, minY, maxY), side: "inside" };
}
