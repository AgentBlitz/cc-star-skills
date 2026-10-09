import type { OverlayPort } from "./overlay-port.ts";
export declare const OVERLAY_TAG = "showcase-overlay";
export interface StubOptions {
    document?: Document;
    /** The tour's speed: the pointer travels faster at ×10. */
    speed?: () => number;
    /** Whether to draw at all (a film with `pointer: false`, or a rehearsal). */
    visible?: boolean;
}
export declare function createOverlayStub(options?: StubOptions): OverlayPort;
