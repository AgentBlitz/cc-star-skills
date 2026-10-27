import type { OverlayPort } from "../overlay-port.ts";
import { type CardBrand, type MarkNode } from "./brand.ts";
import { type TopLayer } from "./top-layer.ts";
export declare const OVERLAY_TAG = "showcase-overlay";
export declare const CONTROLS_TAG = "showcase-controls";
export type OverlayUi = "watch" | "film" | "rehearse";
/** What a control (or a viewer's key) asks of the run. */
export type ControlCommand = "toggle" | "back" | "next" | "mute" | "exit" | "retry" | "skip";
/** What the controls and the end card show. */
export interface OverlayView {
    status: string;
    stepIndex: number;
    stepCount: number;
    paused: boolean;
    muted: boolean;
    /** Why the run is stuck, while it is. */
    blocked: string | null;
    ended: "finished" | "left" | "error" | null;
}
export interface OverlayOptions {
    document?: Document;
    topLayer?: TopLayer | null;
    /** The captured animation-frame timers and observer (the app can't throttle them). */
    natives?: {
        requestAnimationFrame: (fn: (t: number) => void) => number;
        cancelAnimationFrame: (id: number) => void;
        MutationObserver: typeof MutationObserver;
    } | null;
    /** The tour's speed: the pointer travels faster at ×10. */
    speed?: () => number;
    ui: OverlayUi;
    /** Draw the pointer (a film with `pointer: false` doesn't). */
    pointer?: boolean;
    /** Watch and rehearse captions; the film burns its own in (D15). */
    captions?: boolean;
    /** The Watch controls. */
    controls?: boolean;
    /** Rehearse: a caption stays up until the next one, or until `clearCaption()` (the beat's still). */
    lingerCaptions?: boolean;
    /** No motion at all: the pointer jumps, nothing eases (rehearse stills, reduced motion). */
    reducedMotion?: boolean;
    /** The tour's title, for the end card. */
    title?: string;
    /** `film.cards` as a brand (colours, mark, fonts); absent or null: showcase's own look. */
    cards?: CardBrand | null;
    onCommand?: (command: ControlCommand) => void;
}
export interface Overlay extends OverlayPort {
    readonly host: HTMLElement;
    readonly controlsHost: HTMLElement | null;
    /** Updates the controls and the end card. */
    view(view: OverlayView): void;
    /** Takes a lingering caption down. */
    clearCaption(): void;
    /** Re-shows the overlay on top and puts the controls where they can be clicked. */
    raise(): void;
}
/** Builds a sanitised mark (sanitised again here: the overlay trusts no input). */
export declare function buildMark(doc: Document, mark: MarkNode): SVGElement | null;
export declare function createOverlay(options: OverlayOptions): Overlay;
