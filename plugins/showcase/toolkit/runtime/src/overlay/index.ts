/**
 * The overlay (PLAN §2.1 "Overlay", S-D3): the hybrid Session 2's Spike 3 chose.
 *
 * - **The drawing** (pointer, spotlight, callout, captions, cards, the end card) lives in a shadow
 *   root inside `<showcase-overlay popover="manual">` on `<html>`, re-shown on top at every
 *   top-layer change, so a modal dialog, an auto popover or a fullscreen element never covers it.
 * - **The Watch controls** have their own `<showcase-controls>` shadow host, and only they move:
 *   into the fullscreen element, else the topmost modal dialog, else the app's topmost open auto
 *   popover, else back into the overlay. Outside those the page is inert (or a click would
 *   light-dismiss the app's popover). The film has no controls, so it uses the popover alone.
 * - **Hygiene:** `:host{all:initial}`; adopted stylesheets only; fonts declared at document level;
 *   re-attached when the app re-renders it away; never takes focus (the bootstrap's guard consumes
 *   the controls' events and `preventDefault`s `mousedown`); reduced motion honoured in Watch.
 *
 * The DOM is built with `createElement`, never `innerHTML`, so a Trusted Types policy can't refuse it.
 */
import { type Rect, rectOf } from "../anchors.ts";
import { Aborted } from "../clock.ts";
import type { Callout, OverlayPort } from "../overlay-port.ts";
import { placeCallout } from "./place.ts";
import { CONTROLS_CSS, FONT_CSS, OVERLAY_CSS } from "./styles.ts";
import { safeMatches, type TopLayer, topmostAutoPopover, topmostModal } from "./top-layer.ts";

export const OVERLAY_TAG = "showcase-overlay";
export const CONTROLS_TAG = "showcase-controls";

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

type Child = Node | string | null | false | undefined;

function make(doc: Document, tag: string, attrs: Record<string, string> = {}, ...children: Child[]): HTMLElement {
  const el = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const c of children) if (c) el.append(c);
  return el;
}

const SVG = "http://www.w3.org/2000/svg";

function icon(doc: Document, d: string): SVGSVGElement {
  const svg = doc.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = doc.createElementNS(SVG, "path");
  path.setAttribute("d", d);
  svg.append(path);
  return svg;
}

const ICONS = {
  back: "M6 5h2v14H6zM20 5v14L9 12z",
  next: "M16 5h2v14h-2zM4 5l11 7-11 7z",
  play: "M7 4.5v15L19.5 12z",
  pause: "M6.5 5h4v14h-4zM13.5 5h4v14h-4z",
  sound: "M4 9h4l5-4v14l-5-4H4zM16 8.5a5 5 0 0 1 0 7l-1.4-1.4a3 3 0 0 0 0-4.2zM18.4 6a8.5 8.5 0 0 1 0 12L17 16.6a6.5 6.5 0 0 0 0-9.2z",
  muted: "M4 9h4l5-4v14l-5-4H4zM16.3 8.9l1.4-1.4 2.1 2.1 2.1-2.1 1.4 1.4-2.1 2.1 2.1 2.1-1.4 1.4-2.1-2.1-2.1 2.1-1.4-1.4 2.1-2.1z",
  exit: "M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z",
} as const;

/** The pointer: an arrow whose tip is the element's origin. */
function pointerSvg(doc: Document): SVGSVGElement {
  const svg = doc.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 30 30");
  svg.setAttribute("aria-hidden", "true");
  const path = doc.createElementNS(SVG, "path");
  path.setAttribute("d", "M1.5 1.5 L1.5 23 L7.2 17.6 L11.4 27 L15.3 25.3 L11.2 16.1 L19 16.1 Z");
  path.setAttribute("fill", "#0f172a");
  path.setAttribute("stroke", "#ffffff");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  return svg;
}

function sheetOf(doc: Document, css: string): CSSStyleSheet | null {
  try {
    const View = doc.defaultView as (Window & typeof globalThis) | null;
    const sheet = new (View?.CSSStyleSheet ?? CSSStyleSheet)();
    sheet.replaceSync(css);
    return sheet;
  } catch {
    // No constructable stylesheets: the overlay works unstyled rather than inject a <style> a CSP would refuse.
    return null;
  }
}

const FONT_MARK = "__showcaseFonts";

/** `@font-face` only works at document level, so the fonts are declared there, once. */
function declareFonts(doc: Document): void {
  const d = doc as unknown as Record<string, unknown>;
  if (d[FONT_MARK]) return;
  const sheet = sheetOf(doc, FONT_CSS);
  if (!sheet) return;
  try {
    doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
    d[FONT_MARK] = true;
  } catch {
    // The page froze its stylesheets: system fonts it is.
  }
}

export function createOverlay(options: OverlayOptions): Overlay {
  const doc = options.document ?? document;
  const win = doc.defaultView as (Window & typeof globalThis) | null;
  const speed = options.speed ?? (() => 1);
  const ui = options.ui;
  const top = options.topLayer ?? null;
  const raf = options.natives?.requestAnimationFrame ?? ((fn: (t: number) => void) => (win ? win.requestAnimationFrame(fn) : 0));
  const caf = options.natives?.cancelAnimationFrame ?? ((id: number) => win?.cancelAnimationFrame(id));
  const MO = options.natives?.MutationObserver ?? win?.MutationObserver ?? MutationObserver;
  let reduced = options.reducedMotion ?? false;
  if (!reduced && ui === "watch") {
    try {
      reduced = !!win?.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    } catch {
      reduced = false;
    }
  }
  const wantsControls = options.controls ?? ui === "watch";
  const wantsCaptions = options.captions ?? ui !== "film";

  declareFonts(doc);

  // ——— The drawing ———
  const host = make(doc, OVERLAY_TAG, { popover: "manual", "aria-hidden": "true", "data-ui": ui, "data-controls": wantsControls ? "on" : "off" });
  if (reduced) host.setAttribute("data-motion", "reduce");
  const root = host.attachShadow({ mode: "open" });
  const sheet = sheetOf(doc, OVERLAY_CSS);
  if (sheet) root.adoptedStyleSheets = [sheet];

  const card = make(doc, "div", { class: "card", hidden: "" });
  const spot = make(doc, "div", { class: "spot", hidden: "" });
  const callout = make(doc, "div", { class: "callout", hidden: "" });
  const pointer = make(doc, "div", { class: "pointer", hidden: "" }, pointerSvg(doc));
  const ripple = make(doc, "div", { class: "ripple" });
  const captionText = make(doc, "p", { class: "caption", "aria-live": "polite" });
  const captions = make(doc, "div", { class: "captions", hidden: "" }, captionText);
  const end = make(doc, "div", { class: "end", hidden: "" });
  const layer = make(doc, "div", { class: "layer" }, card, spot, callout, captions, end, ripple, pointer);
  root.append(layer);
  top?.own(host);

  // ——— The controls ———
  let controlsHost: HTMLElement | null = null;
  let croot: ShadowRoot | null = null;
  const buttons: Partial<Record<ControlCommand, HTMLElement>> = {};
  let label: HTMLElement | null = null;
  let stuck: HTMLElement | null = null;
  if (wantsControls) {
    controlsHost = make(doc, CONTROLS_TAG, { "data-showcase": "controls" });
    croot = controlsHost.attachShadow({ mode: "open" });
    const csheet = sheetOf(doc, CONTROLS_CSS);
    if (csheet) croot.adoptedStyleSheets = [csheet];
    const button = (c: ControlCommand, name: string, d: string | null, text?: string) => {
      const b = make(doc, "button", { type: "button", tabindex: "-1", "data-c": c, "aria-label": name, title: name });
      if (d) b.append(icon(doc, d));
      if (text) {
        b.className = "text";
        b.append(text);
      }
      buttons[c] = b;
      return b;
    };
    label = make(doc, "span", { class: "label" });
    stuck = make(doc, "span", { class: "stuck", hidden: "" });
    const retry = button("retry", "Retry", null, "Retry");
    const skip = button("skip", "Skip", null, "Skip");
    retry.hidden = true;
    skip.hidden = true;
    const bar = make(
      doc,
      "div",
      { class: "bar", role: "toolbar", "aria-label": "Tour controls" },
      button("back", "Back (←)", ICONS.back),
      button("toggle", "Pause (Space)", ICONS.pause),
      button("next", "Next (→)", ICONS.next),
      label,
      stuck,
      retry,
      skip,
      make(doc, "span", { class: "sep" }),
      button("mute", "Mute (M)", ICONS.sound),
      button("exit", "Exit (Esc)", ICONS.exit),
    );
    croot.append(bar);
    top?.own(controlsHost);
    const act = (path: EventTarget[]) => {
      const b = path.find((n) => (n as HTMLElement).dataset?.c) as HTMLElement | undefined;
      const c = b?.dataset.c as ControlCommand | undefined;
      if (c) options.onCommand?.(c);
    };
    if (top) top.onControl(act);
    else {
      // No bootstrap guard (a test's bare overlay): stop what we can at the host.
      bar.addEventListener("mousedown", (e) => e.preventDefault());
      bar.addEventListener("click", (e) => {
        act(e.composedPath());
        e.stopPropagation();
      });
    }
    root.append(controlsHost);
  }

  const owns = (el: Element): boolean =>
    el === host || host.contains(el) || root.contains(el) || (!!controlsHost && (el === controlsHost || controlsHost.contains(el) || !!croot?.contains(el)));

  // ——— Staying on top ———
  const modals: Element[] = [];
  const autos: Element[] = [];
  function placeControls(): void {
    if (!controlsHost) return;
    let target: Element | null = null;
    try {
      target = doc.fullscreenElement ?? topmostModal(doc, modals) ?? topmostAutoPopover(doc, autos, (el) => el === host);
    } catch {
      target = null;
    }
    const want: ParentNode = target ?? root;
    if (controlsHost.parentNode !== want) want.append(controlsHost);
  }

  function attach(): void {
    const html = doc.documentElement;
    if (!html) return;
    if (host.parentNode !== html) html.append(host);
    try {
      if (!safeMatches(host, ":popover-open")) host.showPopover();
    } catch {
      // Not a popover-capable document: it is still on top of most things.
    }
  }

  function raise(): void {
    placeControls();
    if (!host.isConnected) attach();
    try {
      if (safeMatches(host, ":popover-open")) host.hidePopover();
      host.showPopover();
    } catch {
      // As above.
    }
  }

  attach();
  placeControls();
  const unsubscribe = top?.onChange(raise) ?? (() => {});
  let pending = 0;
  const observer = new MO(() => {
    if (!host.isConnected) {
      raise();
      return;
    }
    if (controlsHost && !pending) {
      pending = raf(() => {
        pending = 0;
        placeControls();
      });
    }
  });
  if (controlsHost) observer.observe(doc, { childList: true, subtree: true, attributes: true, attributeFilter: ["open", "popover"] });
  else if (doc.documentElement) observer.observe(doc.documentElement, { childList: true });

  // ——— The pointer ———
  let at: { x: number; y: number } | null = null;
  let travel: Animation | null = null;
  const drawPointer = options.pointer !== false;
  const place = (x: number, y: number) => {
    pointer.style.transform = `translate(${x}px, ${y}px)`;
    ripple.style.transform = `translate(${x}px, ${y}px)`;
    if (drawPointer) pointer.hidden = false;
  };

  // ——— The spotlight ———
  let spotted: { el: Element | null; rect: Rect; callout: Callout | null } | null = null;
  let follow = 0;
  let lastRect: Rect | null = null;
  const PAD = 6;
  const same = (a: Rect, b: Rect) => Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5;
  function drawSpot(r: Rect): void {
    Object.assign(spot.style, { left: `${r.x - PAD}px`, top: `${r.y - PAD}px`, width: `${r.w + PAD * 2}px`, height: `${r.h + PAD * 2}px` });
    if (!spotted?.callout) {
      callout.hidden = true;
      return;
    }
    callout.hidden = false;
    const vw = win?.innerWidth ?? 1280;
    const vh = win?.innerHeight ?? 720;
    const foot = (wantsControls ? 80 : 0) + (wantsCaptions && !captions.hidden ? 72 : 0);
    const size = { w: callout.offsetWidth, h: callout.offsetHeight };
    const p = placeCallout({ x: r.x - PAD, y: r.y - PAD, w: r.w + PAD * 2, h: r.h + PAD * 2 }, size, { w: vw, h: vh, top: 0, bottom: foot });
    callout.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
    callout.setAttribute("data-side", p.side);
  }
  function followLoop(): void {
    follow = 0;
    if (!spotted) return;
    const el = spotted.el;
    if (el?.isConnected) {
      const r = rectOf(el);
      if (!lastRect || !same(r, lastRect)) {
        lastRect = r;
        drawSpot(r);
      }
    }
    follow = raf(followLoop);
  }

  // ——— Captions, cards, the end ———
  function setCaption(text: string | null): void {
    if (!wantsCaptions) return;
    captionText.textContent = text ?? "";
    captions.hidden = text === null;
  }
  function fillCard(el: HTMLElement, c: { title: string; lines: string[] } | null): void {
    el.replaceChildren();
    if (!c) {
      el.hidden = true;
      return;
    }
    el.append(make(doc, "h1", {}, c.title));
    if (c.lines.length) el.append(make(doc, "ul", {}, ...c.lines.map((l) => make(doc, "li", {}, l))));
    el.hidden = false;
  }

  const overlay: Overlay = {
    host,
    controlsHost,

    async pointerTo(rect, signal) {
      const to = { x: Math.round(rect.x + rect.w / 2), y: Math.round(rect.y + rect.h / 2) };
      const from = at ?? { x: Math.round((win?.innerWidth ?? 0) / 2), y: Math.round((win?.innerHeight ?? 0) / 2) };
      if (!at) place(from.x, from.y);
      travel?.cancel();
      if (signal?.aborted) throw new Aborted();
      const dist = Math.hypot(to.x - from.x, to.y - from.y);
      const ms = Math.min(700, Math.max(120, dist * 0.9)) / Math.max(0.1, speed());
      if (reduced || typeof pointer.animate !== "function" || dist < 1) {
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
      try {
        a.cancel();
      } catch {
        // Already cancelled.
      }
      if (travel === a) travel = null;
      at = to;
    },

    press() {
      if (!at || reduced || typeof ripple.animate !== "function") return;
      ripple.animate(
        [
          { opacity: 0.95, transform: `translate(${at.x}px, ${at.y}px) scale(0.35)` },
          { opacity: 0, transform: `translate(${at.x}px, ${at.y}px) scale(1.5)` },
        ],
        { duration: 360 / Math.max(0.1, speed()), easing: "ease-out" },
      );
    },

    spotlight(target) {
      if (follow) caf(follow);
      follow = 0;
      lastRect = null;
      if (!target) {
        spotted = null;
        spot.hidden = true;
        callout.hidden = true;
        callout.replaceChildren();
        return;
      }
      spotted = { el: target.element ?? null, rect: target.rect, callout: target.callout };
      callout.replaceChildren();
      if (target.callout) callout.append(make(doc, "h2", {}, target.callout.title), make(doc, "p", {}, target.callout.body));
      spot.hidden = false;
      lastRect = target.rect;
      drawSpot(target.rect);
      if (spotted.el) follow = raf(followLoop);
    },

    card(c) {
      // A card is a screen of its own: what was spotlit beneath it, and the pointer, step aside.
      if (c) overlay.spotlight(null);
      fillCard(card, c);
      pointer.style.visibility = c ? "hidden" : "";
    },

    caption(text) {
      if (text === null && options.lingerCaptions) return;
      setCaption(text);
    },

    clearCaption() {
      setCaption(null);
    },

    acting(on) {
      for (const el of [host, controlsHost]) {
        if (!el) continue;
        if (on) el.setAttribute("data-acting", "");
        else el.removeAttribute("data-acting");
      }
    },

    owns,
    pointer: () => at,

    movePointer(x, y) {
      at = { x: Math.round(x), y: Math.round(y) };
      place(at.x, at.y);
    },

    view(v) {
      if (controlsHost) {
        const toggle = buttons.toggle;
        if (toggle) {
          const playing = !v.paused && v.status !== "blocked" && v.status !== "done";
          toggle.replaceChildren(icon(doc, playing ? ICONS.pause : ICONS.play));
          const name = playing ? "Pause (Space)" : "Play (Space)";
          toggle.setAttribute("aria-label", name);
          toggle.setAttribute("title", name);
        }
        const mute = buttons.mute;
        if (mute) {
          mute.replaceChildren(icon(doc, v.muted ? ICONS.muted : ICONS.sound));
          mute.setAttribute("aria-label", v.muted ? "Unmute (M)" : "Mute (M)");
        }
        if (label) label.textContent = v.stepCount ? `${Math.min(v.stepIndex + 1, v.stepCount)} / ${v.stepCount}` : "";
        if (stuck) {
          stuck.textContent = v.blocked ?? "";
          stuck.hidden = !v.blocked;
        }
        if (buttons.retry) buttons.retry.hidden = !v.blocked;
        if (buttons.skip) buttons.skip.hidden = !v.blocked;
      }
      if (ui === "watch" && v.ended === "finished") {
        end.replaceChildren(
          make(doc, "span", { class: "kicker" }, "That's the tour"),
          make(doc, "h1", {}, options.title ?? "Thanks for watching"),
          make(doc, "p", {}, wantsControls ? "Press Esc to close, or ← to go back." : ""),
        );
        end.hidden = false;
      } else end.hidden = true;
    },

    raise,

    destroy() {
      unsubscribe();
      observer.disconnect();
      if (follow) caf(follow);
      if (pending) caf(pending);
      travel?.cancel();
      if (top) top.onControl(null);
      controlsHost?.remove();
      host.remove();
    },
  };
  return overlay;
}
