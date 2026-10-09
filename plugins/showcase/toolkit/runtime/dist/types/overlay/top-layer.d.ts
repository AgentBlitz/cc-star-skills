/**
 * What the bootstrap installs before any app code (PLAN §2.1 "Overlay", S-D2, S-D3), so the app
 * can neither capture the originals first nor see the overlay's events:
 *
 * - **The top-layer watch.** `showModal`, `showPopover`, `togglePopover` and `requestFullscreen`
 *   are patched, and `toggle`, `close` and `fullscreenchange` are watched in the capture phase.
 *   Each change calls the overlay's `raise`, which re-shows its popover on top and moves the
 *   Watch controls.
 * - **The control guard.** A window capture listener per pointer, mouse, focus and touch type:
 *   an event whose path holds one of the overlay's hosts is acted on (a click) and stopped there,
 *   so neither the app's capture-phase listeners nor its bubble-phase "click outside" handlers
 *   (Radix) ever see it. `mousedown` is also `preventDefault`ed, so the controls never take focus.
 */
/** The overlay's hosts: what the patches leave alone and the guard consumes events for. */
export interface TopLayer {
    /** Calls `fn` on every top-layer change (and returns the unsubscriber). */
    onChange(fn: () => void): () => void;
    /** Marks an element as the overlay's own. */
    own(el: Element): void;
    owns(el: EventTarget | null | undefined): boolean;
    /** What a click on the overlay's own elements does (the controls). */
    onControl(fn: ((path: EventTarget[], e: Event) => void) | null): void;
}
type Realm = Window & typeof globalThis;
/** Installs the patches and the guard in this window, once. */
export declare function installTopLayer(win: Realm): TopLayer;
/** The topmost open modal dialog, by the order they opened. */
export declare function topmostModal(doc: Document, order: Element[]): HTMLDialogElement | null;
/** The app's topmost open `popover=auto`, by the order they opened. */
export declare function topmostAutoPopover(doc: Document, order: Element[], mine: (el: Element) => boolean): HTMLElement | null;
export declare function safeMatches(el: Element, selector: string): boolean;
export {};
