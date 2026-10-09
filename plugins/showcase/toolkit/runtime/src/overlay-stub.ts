/**
 * The pointer stub (Session 4's boundary: no overlay visuals beyond this). A `<showcase-overlay
 * popover="manual">` on `<html>` with a shadow root, adopted styles, `pointer-events: none`, and
 * one pointer dot moved with WAAPI. Session 5 replaces it with the hybrid overlay of PLAN §2.1;
 * the host and the executor only ever see `OverlayPort`.
 */
import type { Rect } from "./anchors.ts";
import { Aborted } from "./clock.ts";
import type { OverlayPort } from "./overlay-port.ts";

export const OVERLAY_TAG = "showcase-overlay";

const CSS = `
  :host { all: initial; position: fixed; inset: 0; width: 100vw; height: 100vh; margin: 0; padding: 0; border: 0;
    background: transparent; overflow: visible; pointer-events: none; z-index: 2147483647; display: block; }
  .pointer { position: absolute; left: 0; top: 0; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%;
    background: rgb(255 255 255 / 0.9); border: 2px solid rgb(0 0 0 / 0.75); box-shadow: 0 1px 6px rgb(0 0 0 / 0.4);
    will-change: transform; }
  .pointer[hidden] { display: none; }
  .ripple { position: absolute; left: 0; top: 0; width: 36px; height: 36px; margin: -18px 0 0 -18px; border-radius: 50%;
    border: 2px solid rgb(59 130 246); opacity: 0; pointer-events: none; }
`;

export interface StubOptions {
  document?: Document;
  /** The tour's speed: the pointer travels faster at ×10. */
  speed?: () => number;
  /** Whether to draw at all (a film with `pointer: false`, or a rehearsal). */
  visible?: boolean;
}

export function createOverlayStub(options: StubOptions = {}): OverlayPort {
  const doc = options.document ?? document;
  const speed = options.speed ?? (() => 1);
  const host = doc.createElement(OVERLAY_TAG);
  host.setAttribute("popover", "manual");
  host.setAttribute("aria-hidden", "true");
  const root = host.attachShadow({ mode: "open" });
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(CSS);
    root.adoptedStyleSheets = [sheet];
  } catch {
    // No constructable stylesheets: Session 5 adds the fallback.
  }
  const pointer = doc.createElement("div");
  pointer.className = "pointer";
  if (options.visible === false) pointer.hidden = true;
  const ripple = doc.createElement("div");
  ripple.className = "ripple";
  root.append(pointer, ripple);

  let at: { x: number; y: number } | null = null;
  let travel: Animation | null = null;

  function attach(): void {
    const html = doc.documentElement;
    if (!html) return;
    if (host.parentNode !== html) html.append(host);
    try {
      if (!host.matches(":popover-open")) host.showPopover();
    } catch {
      // Not a popover-capable document: it is still on top of most things.
    }
  }
  attach();
  const observer = new MutationObserver(() => {
    if (!host.isConnected) attach();
  });
  if (doc.documentElement) observer.observe(doc.documentElement, { childList: true });

  const place = (x: number, y: number) => {
    pointer.style.transform = `translate(${x}px, ${y}px)`;
    ripple.style.transform = `translate(${x}px, ${y}px)`;
  };

  return {
    async pointerTo(rect, signal) {
      const to = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
      const from = at ?? { x: doc.defaultView?.innerWidth ?? 0, y: (doc.defaultView?.innerHeight ?? 0) / 2 };
      if (!at) place(from.x, from.y);
      const dist = Math.hypot(to.x - from.x, to.y - from.y);
      const ms = Math.min(700, Math.max(120, dist * 0.9)) / speed();
      travel?.cancel();
      if (signal?.aborted) throw new Aborted();
      if (typeof pointer.animate !== "function") {
        place(to.x, to.y);
        at = to;
        return;
      }
      const a = pointer.animate([{ transform: `translate(${from.x}px, ${from.y}px)` }, { transform: `translate(${to.x}px, ${to.y}px)` }], {
        duration: ms,
        easing: "cubic-bezier(.4,0,.2,1)",
        fill: "forwards",
      });
      travel = a;
      const stop = () => a.cancel();
      signal?.addEventListener("abort", stop, { once: true });
      try {
        await a.finished;
      } catch {
        if (signal?.aborted) throw new Aborted();
      } finally {
        signal?.removeEventListener("abort", stop);
      }
      place(to.x, to.y);
      ripple.style.transform = `translate(${to.x}px, ${to.y}px)`;
      try {
        a.cancel();
      } catch {
        // Already cancelled.
      }
      at = to;
    },
    press() {
      if (!at || typeof ripple.animate !== "function") return;
      ripple.animate([{ opacity: 0.9, transform: `translate(${at.x}px, ${at.y}px) scale(0.4)` }, { opacity: 0, transform: `translate(${at.x}px, ${at.y}px) scale(1.4)` }], {
        duration: 320 / speed(),
        easing: "ease-out",
      });
    },
    spotlight() {},
    card() {},
    caption() {},
    acting(on) {
      if (on) host.setAttribute("data-acting", "");
      else host.removeAttribute("data-acting");
    },
    owns: (el) => el === host || host.contains(el) || root.contains(el),
    pointer: () => at,
    movePointer(x, y) {
      at = { x, y };
      place(x, y);
    },
    destroy() {
      observer.disconnect();
      travel?.cancel();
      host.remove();
    },
  };
}
