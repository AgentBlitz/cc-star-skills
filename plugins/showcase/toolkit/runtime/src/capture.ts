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

const KEY = "__showcaseNatives";

type Realm = Window & typeof globalThis;

function setterOf<T>(proto: object, name: string): T | null {
  return (Object.getOwnPropertyDescriptor(proto, name)?.set as T | undefined) ?? null;
}

/** Captures the realm's natives now, unless this document already has them. */
export function captureNatives(win: Realm = window): Natives {
  const held = (win as unknown as Record<string, Natives | undefined>)[KEY];
  if (held) return held;
  const n: Natives = {
    dateNow: win.Date.now.bind(win.Date),
    perfNow: win.performance.now.bind(win.performance),
    timeOrigin: win.performance.timeOrigin,
    setTimeout: win.setTimeout.bind(win),
    clearTimeout: win.clearTimeout.bind(win),
    setInterval: win.setInterval.bind(win),
    clearInterval: win.clearInterval.bind(win),
    requestAnimationFrame: win.requestAnimationFrame.bind(win),
    cancelAnimationFrame: win.cancelAnimationFrame.bind(win),
    setters: {
      inputValue: setterOf(win.HTMLInputElement.prototype, "value"),
      textareaValue: setterOf(win.HTMLTextAreaElement.prototype, "value"),
      selectValue: setterOf(win.HTMLSelectElement.prototype, "value"),
      checked: setterOf(win.HTMLInputElement.prototype, "checked"),
    },
    MutationObserver: win.MutationObserver,
  };
  Object.defineProperty(win, KEY, { value: n, configurable: false, enumerable: false, writable: false });
  return n;
}

/** The captured natives, or a capture made now (a late import, or a test). */
export function natives(win: Realm = window): Natives {
  return captureNatives(win);
}

/** Whether this window is the top one. A cross-origin parent throws; that is not the top. */
export function isTopFrame(win: Window = window): boolean {
  try {
    return win.top === win;
  } catch {
    return false;
  }
}

/** The next animation frame, on the captured rAF. */
export function nextFrame(n: Natives = natives()): Promise<void> {
  return new Promise((resolve) => n.requestAnimationFrame(() => resolve()));
}
