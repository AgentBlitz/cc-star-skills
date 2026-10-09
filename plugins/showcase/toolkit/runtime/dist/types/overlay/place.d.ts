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
export declare const CALLOUT_GAP = 12;
export declare function placeCallout(target: Rect, size: {
    w: number;
    h: number;
}, frame: Frame, gap?: number): Placement;
