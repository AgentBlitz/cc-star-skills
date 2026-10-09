/**
 * The real timers and setters, captured before any app code (PLAN §2.1, D16). The injected
 * script calls `captureNatives` first, in the top frame, so an app's clock tricks (a mocked
 * `Date`, a throttled rAF, a patched value setter) can never move the tour. Running the script
 * twice in one document hands back the first capture.
 */
export interface Natives {
    dateNow: () => number;
    perfNow: () => number;
    timeOrigin: number;
    setTimeout: (fn: () => void, ms: number) => number;
    clearTimeout: (id: number) => void;
    setInterval: (fn: () => void, ms: number) => number;
    clearInterval: (id: number) => void;
    requestAnimationFrame: (fn: (t: number) => void) => number;
    cancelAnimationFrame: (id: number) => void;
    /** The prototype setters React and friends replace on instances. */
    setters: {
        inputValue: ((this: HTMLInputElement, v: string) => void) | null;
        textareaValue: ((this: HTMLTextAreaElement, v: string) => void) | null;
        selectValue: ((this: HTMLSelectElement, v: string) => void) | null;
        checked: ((this: HTMLInputElement, v: boolean) => void) | null;
    };
    MutationObserver: typeof MutationObserver;
}
type Realm = Window & typeof globalThis;
/** Captures the realm's natives now, unless this document already has them. */
export declare function captureNatives(win?: Realm): Natives;
/** The captured natives, or a capture made now (a late import, or a test). */
export declare function natives(win?: Realm): Natives;
/** Whether this window is the top one. A cross-origin parent throws; that is not the top. */
export declare function isTopFrame(win?: Window): boolean;
/** The next animation frame, on the captured rAF. */
export declare function nextFrame(n?: Natives): Promise<void>;
export {};
