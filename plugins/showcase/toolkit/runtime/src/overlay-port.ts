/**
 * What the executor and the director show while they act: the contract `overlay/index.ts`
 * implements (PLAN §2.1 "Overlay"). The engine only ever sees this port.
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
  /** Dims everything but the rectangle (null clears it), with its callout; it follows the element when given one. */
  spotlight(target: { rect: Rect; callout: Callout | null; element?: Element | null } | null): void;
  /** A title or closing card over the screen; null clears it. */
  card(card: { title: string; lines: string[] } | null): void;
  /** Watch captions: the sentence being spoken; null clears it. */
  caption(text: string | null): void;
  /** The shield clears while the host acts, so trusted input reaches the page. */
  acting(on: boolean): void;
  /** Whether the element is the overlay's own: `elementsFromPoint` ignores it. */
  owns(el: Element): boolean;
  /** Where the pointer is, in viewport CSS pixels. */
  pointer(): { x: number; y: number } | null;
  /** Puts the pointer somewhere at once (re-arming after a page load). */
  movePointer(x: number, y: number): void;
  /** Takes the overlay down. */
  destroy(): void;
}

export const NO_OVERLAY: OverlayPort = {
  pointerTo: async () => {},
  press: () => {},
  spotlight: () => {},
  card: () => {},
  caption: () => {},
  acting: () => {},
  owns: () => false,
  pointer: () => null,
  movePointer: () => {},
  destroy: () => {},
};
