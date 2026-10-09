/**
 * The showcase runtime (PLAN §2.1, D7, D16): one framework-agnostic engine that runs injected
 * (Watch, rehearse and film, through the host) or vendored in-app (Session 10). This module is
 * the ESM entry for vendoring and the API the IIFE (`inject.ts`) boots from. The external boot
 * reads the config the host injects as `window.__showcaseConfig`, captures the real timers and
 * installs the top-layer watch and the control guard before any app code, and starts or resumes
 * the run once the document is ready.
 */
import { describeAnchor } from "./anchors.ts";
import { type AudioStats } from "./audio.ts";
import { type Acting } from "./bridge.ts";
import { type Command, Director, type Mode, type Snapshot } from "./director.ts";
import { type InputMode } from "./executor.ts";
import { type FilmAids } from "./film-aids.ts";
import { type FilmEvent } from "./film-events.ts";
import { type OutlineItem, type OutlineOptions } from "./inspect.ts";
import type { VoiceManifest } from "./narration.ts";
import { type Overlay } from "./overlay/index.ts";
import { type Tour } from "./schema.ts";
export * from "./anchors.ts";
export * from "./audio.ts";
export * from "./bridge.ts";
export * from "./capture.ts";
export * from "./clock.ts";
export * from "./director.ts";
export * from "./dom-events.ts";
export * from "./executor.ts";
export * from "./film-aids.ts";
export * from "./film-events.ts";
export * from "./inspect.ts";
export * from "./narration.ts";
export * from "./narrative.ts";
export * from "./overlay/index.ts";
export * from "./overlay/place.ts";
export * from "./overlay/top-layer.ts";
export * from "./overlay-port.ts";
export * from "./ready.ts";
export * from "./schema.ts";
export * from "./state.ts";
export * from "./timeline.ts";
export declare const RUNTIME_VERSION: string;
/** How long the page must be still before a film is armed. */
export declare const STILL_MS = 400;
/** What the host injects before the runtime (`window.__showcaseConfig`). */
export interface BootConfig {
    tour: Tour;
    mode: Mode;
    speed?: number;
    /** A deep link: the step to start at; earlier writes are fast-forwarded. */
    from?: string;
    /** `rehearse --synthetic` forces synthetic input. Default: trusted when a host is bound. */
    input?: InputMode;
    /** Draw the pointer (a film with `pointer: false` doesn't). */
    pointer?: boolean;
    manifest?: VoiceManifest | null;
    /** Start as soon as the document is ready (default). Otherwise the host calls `__showcase.start()`. */
    autostart?: boolean;
    /** A rehearsal (Watch mode, headless): no controls, captions held for each beat's still, a checkpoint per beat. */
    rehearse?: boolean;
    /** Start with the voice muted (`watch --muted`). */
    muted?: boolean;
}
export type AdapterFn = (args?: Record<string, unknown>) => unknown | Promise<unknown>;
/** `window.__showcase`: the runtime's API in the page, for the host, the overlay and tests. */
export interface ShowcaseApi {
    version: string;
    director: Director | null;
    config: BootConfig | null;
    /** The acting window while the host acts, else null. */
    acting: Acting | null;
    /** Resolves once the boot has run (whether or not a run started). */
    booted: Promise<void>;
    dispatch(command: Command): void;
    snapshot(): Snapshot | null;
    events(): readonly FilmEvent[];
    /** Starts a run with the config given (or the injected one) when `autostart` was off. */
    start(config?: BootConfig): Promise<void>;
    /** The adapter registry (`showcase.actions.register`): what `invoke` actions call. */
    actions: {
        register(name: string, fn: AdapterFn): void;
        has(name: string): boolean;
    };
    /** The overlay in this document, once a run has booted. */
    overlay: Overlay | null;
    /** What the voice has played (Watch). */
    audio: (AudioStats & {
        muted: boolean;
    }) | null;
    /** The page outlined by role and name, with suggested anchors (`showcase inspect`). */
    inspect(options?: OutlineOptions): OutlineItem[];
    /** The text a viewer can see now (`rehearse`'s spoken-number and deny-list checks). */
    visibleText(): string;
    /** The recorder's aids: the clock-sync probe, the heartbeat, the page's frame rate. */
    film: FilmAids;
}
type Realm = Window & typeof globalThis;
/**
 * Boots the runtime in this document: captures the natives, publishes `window.__showcase`,
 * and starts or resumes the run once the DOM is ready. Top frame only; once per document.
 */
export declare function boot(win?: Realm): ShowcaseApi | null;
export { describeAnchor as describe };
