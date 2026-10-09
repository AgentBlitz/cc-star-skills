/**
 * What the executor and the director show while they act. Session 5's overlay implements it in
 * full; Session 4 ships a pointer stub (`overlay-stub.ts`).
 */
import type { Rect } from "./anchors.ts";
export interface Callout {
    title: string;
    body: string;
}
export interface OverlayPort {
    /** Moves the pointer onto the rectangle; resolves when it has arrived. */
    pointerTo(rect: Rect, signal?: AbortSignal): Promise<void>;
    /** The click ripple, where the pointer is. */
    press(rect: Rect): void;
    /** Dims everything but the rectangle (null clears it), with its callout. */
    spotlight(target: {
        rect: Rect;
        callout: Callout | null;
    } | null): void;
    /** A title or closing card over the screen; null clears it. */
    card(card: {
        title: string;
        lines: string[];
    } | null): void;
    /** Watch captions: the sentence being spoken; null clears it. */
    caption(text: string | null): void;
    /** The shield clears while the host acts, so trusted input reaches the page. */
    acting(on: boolean): void;
    /** Whether the element is the overlay's own: `elementsFromPoint` ignores it. */
    owns(el: Element): boolean;
    /** Where the pointer is, in viewport CSS pixels. */
    pointer(): {
        x: number;
        y: number;
    } | null;
    /** Puts the pointer somewhere at once (re-arming after a page load). */
    movePointer(x: number, y: number): void;
    /** Takes the overlay down. */
    destroy(): void;
}
export declare const NO_OVERLAY: OverlayPort;
