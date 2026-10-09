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

const GUARDED = ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "dblclick", "auxclick", "contextmenu", "focusin", "focusout", "touchstart", "touchend", "wheel"] as const;

const KEY = "__showcaseTopLayer";

type Realm = Window & typeof globalThis;

/** Installs the patches and the guard in this window, once. */
export function installTopLayer(win: Realm): TopLayer {
  const w = win as unknown as Record<string, TopLayer | undefined>;
  const held = w[KEY];
  if (held) return held;
  const listeners = new Set<() => void>();
  const owned = new WeakSet<EventTarget>();
  let control: ((path: EventTarget[], e: Event) => void) | null = null;
  let busy = false;
  const changed = () => {
    if (busy) return;
    busy = true;
    try {
      for (const fn of [...listeners]) {
        try {
          fn();
        } catch {
          // An overlay that has gone away.
        }
      }
    } finally {
      busy = false;
    }
  };
  const owns = (el: EventTarget | null | undefined) => !!el && owned.has(el);

  const dialog = win.HTMLDialogElement?.prototype;
  if (dialog?.showModal) {
    const showModal = dialog.showModal;
    dialog.showModal = function (this: HTMLDialogElement) {
      showModal.call(this);
      changed();
    };
  }
  const el = win.HTMLElement?.prototype;
  if (el?.showPopover) {
    const showPopover = el.showPopover;
    el.showPopover = function (this: HTMLElement, ...args: unknown[]) {
      (showPopover as (...a: unknown[]) => void).apply(this, args);
      if (!owns(this)) changed();
    };
  }
  if (el?.togglePopover) {
    const togglePopover = el.togglePopover;
    el.togglePopover = function (this: HTMLElement, ...args: unknown[]) {
      const r = (togglePopover as (...a: unknown[]) => boolean).apply(this, args);
      if (!owns(this)) changed();
      return r;
    };
  }
  const element = win.Element?.prototype;
  if (element?.requestFullscreen) {
    const requestFullscreen = element.requestFullscreen;
    element.requestFullscreen = function (this: Element, options?: FullscreenOptions) {
      return requestFullscreen.call(this, options).then((v) => {
        changed();
        return v;
      });
    };
  }
  win.addEventListener(
    "toggle",
    (e) => {
      if (!owns(e.target)) changed();
    },
    true,
  );
  win.addEventListener("close", (e) => {
    if (!owns(e.target)) changed();
  }, true);
  win.document.addEventListener("fullscreenchange", changed);

  for (const type of GUARDED) {
    win.addEventListener(
      type,
      (e) => {
        const path = e.composedPath();
        if (!path.some(owns)) return;
        if (type === "mousedown" || type === "pointerdown" || type === "touchstart") {
          if (e.cancelable && type === "mousedown") e.preventDefault();
        }
        if (type === "click") control?.(path, e);
        e.stopImmediatePropagation();
      },
      { capture: true, passive: false },
    );
  }

  const api: TopLayer = {
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    own(e) {
      owned.add(e);
    },
    owns,
    onControl(fn) {
      control = fn;
    },
  };
  Object.defineProperty(win, KEY, { value: api, configurable: false, enumerable: false, writable: false });
  return api;
}

/** The topmost open modal dialog, by the order they opened. */
export function topmostModal(doc: Document, order: Element[]): HTMLDialogElement | null {
  const open = [...doc.querySelectorAll("dialog[open]")].filter((d) => safeMatches(d, ":modal"));
  const known = order.filter((d) => open.includes(d));
  const next = [...known, ...open.filter((d) => !known.includes(d))];
  order.splice(0, order.length, ...next);
  return (next.at(-1) as HTMLDialogElement | undefined) ?? null;
}

/** The app's topmost open `popover=auto`, by the order they opened. */
export function topmostAutoPopover(doc: Document, order: Element[], mine: (el: Element) => boolean): HTMLElement | null {
  const open = [...doc.querySelectorAll("[popover]")].filter((p) => !mine(p) && safeMatches(p, ":popover-open") && (p.getAttribute("popover") || "auto") === "auto");
  const known = order.filter((p) => open.includes(p));
  const next = [...known, ...open.filter((p) => !known.includes(p))];
  order.splice(0, order.length, ...next);
  return (next.at(-1) as HTMLElement | undefined) ?? null;
}

export function safeMatches(el: Element, selector: string): boolean {
  try {
    return el.matches(selector);
  } catch {
    return false;
  }
}
