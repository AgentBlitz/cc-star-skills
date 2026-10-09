/**
 * The executor performs one action on the real screen (PLAN §2.1 "Executor"). Compass's rules:
 *
 * 1. Prefer the visible control to a hotkey (`key` is the keyboard, the last resort).
 * 2. Scroll the target to the centre, wait up to 10 s for it, and re-read its rectangle when
 *    the pointer arrives.
 * 3. Every write has a `done` predicate, and an action whose `done` already holds is skipped.
 * 4. Blur after typing, so the page's keys work again.
 *
 * Input goes two ways. Injected, it is **trusted CDP input** through the bridge, behind a
 * Playwright-style check: the target is visible, its rectangle is stable across two frames, and
 * `elementsFromPoint` (ignoring the overlay) finds it on top, at the centre or an inset point.
 * If something still covers it, the action falls back to **synthetic input** (`dom-events.ts`)
 * and says so. An "acting" window `{kind, point, deadline}` tells the tour's input from the
 * viewer's while the host acts. In-app, every action is synthetic.
 */
import { type AnchorContext, centreOf, deref, describeAnchor, isVisible, type Rect, rectOf, resolve } from "./anchors.ts";
import type { Acting, Bridge, InputRequest, MouseButton } from "./bridge.ts";
import type { Natives } from "./capture.ts";
import { type Clock, throwIfAborted } from "./clock.ts";
import {
  blur,
  caretToEnd,
  clearEditable,
  clickSequence,
  dragSequence,
  type FileData,
  fireChange,
  fireInput,
  fireKey,
  fireMouse,
  firePointer,
  focusQuietly,
  hoverOff,
  hoverOn,
  insertEditableText,
  isEditable,
  isValueElement,
  parseKey,
  selectAll,
  setFiles,
  setNativeValue,
} from "./dom-events.ts";
import { NO_OVERLAY, type OverlayPort } from "./overlay-port.ts";
import { ANCHOR_TIMEOUT_MS, anchorOf, contextOf, evaluate, READY_TIMEOUT_MS, type ReadyContext, ReadyTimeout, waitFor } from "./ready.ts";
import type { Action, AnchorRef, Offset, Ready } from "./schema.ts";

/** The writes a run has made, by `journalKey`. */
export interface Journal {
  has(key: string): boolean;
  add(key: string): void;
}

export type ActionPhase = "start" | "done" | "skipped" | "timeout";
export type InputMode = "trusted" | "synthetic";

export interface CameraFrame {
  rect: Rect | null;
  scale: number;
  easeMs: number;
}

export interface ExecutorDeps {
  /** The tour's pace: typing, holds and `wait ms` sleep on it. */
  pace: Clock;
  /** A ×1 clock: how long the app may take. */
  wall: Clock;
  ctx: AnchorContext;
  natives?: Natives | null;
  /** The host, for trusted input. Absent (in-app): synthetic. */
  bridge?: Bridge | null;
  /** The run's default input (`rehearse --synthetic` forces synthetic). */
  input?: InputMode;
  overlay?: OverlayPort;
  /** The adapter registry (`showcase.actions.register`, in-app). */
  invoke?: (name: string, args?: Record<string, unknown>) => Promise<unknown>;
  /** A `goto`: the app's router in-app, else a full load. */
  navigate?: (url: string, signal?: AbortSignal) => Promise<void>;
  /** Bytes for a synthetic upload. Default: the bridge's assets, else `fetch`. */
  readFile?: (path: string) => Promise<FileData>;
  onPhase?: (action: Action, phase: ActionPhase, input?: InputMode) => void;
  onCamera?: (frame: CameraFrame) => void;
  /** Something the report should know: a synthetic fallback and why. */
  onNote?: (note: string) => void;
  /** The acting window, published for the viewer-input listener. */
  acting?: (acting: Acting | null) => void;
  /** The next animation frame (the captured rAF). Absent: at once (tests). */
  frame?: () => Promise<void>;
}

export interface RunOptions {
  /** No pointer, no pauses, nothing that is only for show: a fast-forward. */
  instant?: boolean;
  signal?: AbortSignal;
  journal?: Journal;
  /** The action's `journalKey`. */
  key?: string;
  /** A ceiling on every wait (film mode: 15 s). */
  maxWaitMs?: number;
}

export type Outcome = "done" | "skipped";

export interface Executor {
  runAction(action: Action, options?: RunOptions): Promise<Outcome>;
  /** Whether the action has already taken effect (journalled, or its `done` holds). */
  isDone(action: Action, options?: Pick<RunOptions, "journal" | "key">): boolean;
  /** Clears the spotlight and the card, and lifts the pointer off what it hovers. */
  clear(): void;
}

/** The pause between typed characters, on the pace clock. */
export const TYPE_MS = 40;
/** A long press, when the action doesn't say. */
export const PRESS_MS = 600;
/** How long the page settles after a scroll before the next move (S-D1), on the pace clock. */
export const SCROLL_SETTLE_MS = 300;
/** The camera's ease, recorded for v1.1. */
export const CAMERA_EASE_MS = 600;
/** How long a rectangle may keep moving (an animation) before the check gives up. */
const STABLE_LIMIT_MS = 1500;

/** Actions that only show something: a fast-forward leaves them out. */
export function isCosmetic(action: Action): boolean {
  switch (action.kind) {
    case "spotlight":
    case "hover":
    case "focus":
    case "camera":
    case "card":
    case "hold":
      return true;
    case "wait":
      return action.until === undefined;
    default:
      return false;
  }
}

export class ActionError extends Error {
  readonly action: Action;
  readonly anchor: string | null;
  constructor(action: Action, message: string, anchor: string | null = null) {
    super(`${action.label ?? action.id}: ${message}`);
    this.name = "ActionError";
    this.action = action;
    this.anchor = anchor;
  }
}

const INSETS: [number, number][] = [
  [0.5, 0.5],
  [0.25, 0.5],
  [0.75, 0.5],
  [0.5, 0.25],
  [0.5, 0.75],
];

export function createExecutor(deps: ExecutorDeps): Executor {
  const overlay = deps.overlay ?? NO_OVERLAY;
  const natives = deps.natives ?? null;
  const ctx = deps.ctx;
  const doc = () => ctx.document;
  const view = () => doc().defaultView as (Window & typeof globalThis) | null;
  const readyCtx = (): ReadyContext => contextOf(ctx);
  const named = ctx.anchors;
  const frame = deps.frame ?? (() => Promise.resolve());
  let hovered: Element | null = null;
  let ceiling = Number.POSITIVE_INFINITY;
  const readyMs = (action: Action) => Math.min(action.timeoutMs ?? READY_TIMEOUT_MS, ceiling);
  const anchorMs = () => Math.min(ANCHOR_TIMEOUT_MS, ceiling);
  const trustedByDefault = (deps.input ?? (deps.bridge?.present ? "trusted" : "synthetic")) === "trusted" && !!deps.bridge?.present;

  const wantsTrusted = (action: Action): boolean => {
    const mode = action.input ?? (trustedByDefault ? "trusted" : "synthetic");
    return mode === "trusted" && !!deps.bridge?.present;
  };

  // ——— Finding and approaching ———

  async function locate(action: Action, ref: AnchorRef, options: { use?: boolean; signal?: AbortSignal } = {}): Promise<Element> {
    const named = describeAnchor(ref, ctx.anchors);
    try {
      await waitFor({ kind: "visible", anchor: ref }, { clock: deps.wall, ctx: readyCtx(), timeoutMs: anchorMs(), what: "anchor", ...(options.signal ? { signal: options.signal } : {}) });
      if (options.use) {
        await waitFor({ kind: "enabled", anchor: ref }, { clock: deps.wall, ctx: readyCtx(), timeoutMs: readyMs(action), ...(options.signal ? { signal: options.signal } : {}) });
      }
    } catch (e) {
      if (e instanceof ReadyTimeout) throw new ActionError(action, e.message, named);
      throw e;
    }
    const el = resolve(ref, ctx);
    if (!el) throw new ActionError(action, `couldn't find ${named}`, named);
    return el;
  }

  /** Whether the element's rectangle is inside the top viewport, its own frame's, and every scroll container it sits in. */
  function inView(el: Element): boolean {
    const v = view();
    if (!v) return true;
    const r = rectOf(el);
    if (!(r.y >= 0 && r.x >= 0 && r.y + r.h <= v.innerHeight && r.x + r.w <= v.innerWidth)) return false;
    const own = el.ownerDocument.defaultView;
    if (!own) return true;
    const b = el.getBoundingClientRect();
    if (el.ownerDocument !== doc() && !(b.top >= 0 && b.left >= 0 && b.bottom <= own.innerHeight && b.right <= own.innerWidth)) return false;
    // A nested scroller clips what it scrolls: the rectangle must sit inside each one's box.
    for (let p: Element | null = el.parentElement; p && p !== el.ownerDocument.documentElement; p = p.parentElement) {
      const style = own.getComputedStyle(p);
      const clips = (o: string) => o === "auto" || o === "scroll" || o === "hidden" || o === "clip";
      if (!clips(style.overflowY) && !clips(style.overflowX)) continue;
      const c = p.getBoundingClientRect();
      if (clips(style.overflowY) && (b.top < c.top || b.bottom > c.bottom)) return false;
      if (clips(style.overflowX) && (b.left < c.left || b.right > c.right)) return false;
    }
    return true;
  }

  function scrollToCentre(el: Element): void {
    (el as HTMLElement).scrollIntoView?.({ block: "center", inline: "center" });
  }

  /** Waits until the rectangle holds still across two frames (an animation or a smooth scroll). */
  async function stable(el: Element, signal?: AbortSignal): Promise<Rect> {
    const started = deps.wall.now();
    let last = rectOf(el);
    for (;;) {
      await frame();
      throwIfAborted(signal);
      const now = rectOf(el);
      if (now.x === last.x && now.y === last.y && now.w === last.w && now.h === last.h) return now;
      last = now;
      if (deps.wall.now() - started > STABLE_LIMIT_MS) return now;
    }
  }

  /** The element on top at a viewport point, looking into same-origin frames, the overlay ignored. */
  function topAt(x: number, y: number): Element | null {
    let d: Document = doc();
    let px = x;
    let py = y;
    for (let hops = 0; hops < 8; hops++) {
      const list = d.elementsFromPoint(px, py).filter((e) => !overlay.owns(e));
      const top = list[0] ?? null;
      if (!top) return null;
      if (top.tagName === "IFRAME") {
        let inner: Document | null = null;
        try {
          inner = (top as HTMLIFrameElement).contentDocument;
        } catch {
          inner = null;
        }
        if (!inner) return top;
        const fr = top.getBoundingClientRect();
        px -= fr.left + (top as HTMLElement).clientLeft;
        py -= fr.top + (top as HTMLElement).clientTop;
        d = inner;
        continue;
      }
      return top;
    }
    return null;
  }

  function hits(el: Element, top: Element | null): boolean {
    if (!top) return false;
    if (top === el || el.contains(top)) return true;
    // Inside a shadow tree: the document's hit test stops at the host.
    let root = el.getRootNode();
    while (root instanceof ShadowRoot) {
      if (root.host === top || top.contains(root.host)) return true;
      root = root.host.getRootNode();
    }
    // A label's control, or a control's label, counts.
    if (el.tagName === "LABEL" && (el as HTMLLabelElement).control === top) return true;
    const labels = (el as HTMLInputElement).labels;
    if (labels) for (const l of labels) if (l === top || l.contains(top)) return true;
    return false;
  }

  interface Check {
    ok: boolean;
    point: { x: number; y: number };
    rect: Rect;
    why?: string;
  }

  /** The Playwright-style check: brings the element into view and finds a point that reaches it. */
  async function clickable(el: Element, signal?: AbortSignal): Promise<Check> {
    if (!inView(el)) {
      scrollToCentre(el);
      await frame();
    }
    const rect = await stable(el, signal);
    if (rect.w === 0 && rect.h === 0) return { ok: false, point: centreOf(rect), rect, why: "it has no size" };
    for (const [fx, fy] of INSETS) {
      const point = { x: rect.x + rect.w * fx, y: rect.y + rect.h * fy };
      if (hits(el, topAt(point.x, point.y))) return { ok: true, point, rect };
    }
    const c = centreOf(rect);
    const cover = topAt(c.x, c.y);
    const name = cover ? `${cover.tagName.toLowerCase()}${cover.id ? `#${cover.id}` : ""}${cover.className && typeof cover.className === "string" ? `.${cover.className.split(" ")[0]}` : ""}` : "nothing";
    return { ok: false, point: c, rect, why: `${name} covers it` };
  }

  /** Brings the element into view and the pointer onto it; returns where it now is. */
  async function approach(el: Element, instant: boolean, signal?: AbortSignal): Promise<Rect> {
    if (!inView(el)) {
      scrollToCentre(el);
      await frame();
    }
    if (instant) return rectOf(el);
    overlay.spotlight(null);
    if (hovered && hovered !== el) {
      hoverOff(hovered, el);
      hovered = null;
    }
    await overlay.pointerTo(rectOf(el), signal);
    throwIfAborted(signal);
    return rectOf(el);
  }

  // ——— Trusted input ———

  const bridge = () => {
    const b = deps.bridge;
    if (!b?.present) throw new Error("no host for trusted input");
    return b;
  };

  async function host(req: InputRequest, point: { x: number; y: number } | null): Promise<void> {
    const n = natives;
    const deadline = (n ? n.perfNow() : Date.now()) + 5000;
    deps.acting?.({ kind: req.kind, point, deadline });
    overlay.acting(true);
    try {
      await bridge().input(req);
    } finally {
      overlay.acting(false);
      deps.acting?.(null);
    }
  }

  /** The pointer and the mouse arrive together: the real mouse moves on first, so hover fires. */
  async function arrive(el: Element, instant: boolean, signal?: AbortSignal): Promise<Check> {
    const rect = await approach(el, instant, signal);
    const check = await clickable(el, signal);
    if (!instant && (check.rect.x !== rect.x || check.rect.y !== rect.y)) await overlay.pointerTo(check.rect, signal);
    return check;
  }

  /** Lands trusted input on the element, or falls back to synthetic and says so. */
  async function trusted(action: Action, el: Element, instant: boolean, signal: AbortSignal | undefined, req: (point: { x: number; y: number }) => InputRequest, synthetic: () => void | Promise<void>): Promise<InputMode> {
    if (!wantsTrusted(action)) {
      await approach(el, instant, signal);
      await synthetic();
      return "synthetic";
    }
    const check = await arrive(el, instant, signal);
    if (!check.ok) {
      deps.onNote?.(`${action.id}: synthetic fallback, ${check.why ?? "the target can't be reached"}`);
      await synthetic();
      return "synthetic";
    }
    if (!instant) overlay.press(check.rect);
    await host(req(check.point), check.point);
    return "trusted";
  }

  // ——— The kinds ———

  async function click(action: Action & { kind: "click" }, instant: boolean, signal?: AbortSignal): Promise<InputMode> {
    const el = await locate(action, action.target, { use: true, ...(signal ? { signal } : {}) });
    return trusted(action, el, instant, signal, (p) => ({ kind: "click", x: p.x, y: p.y, ...(action.button ? { button: action.button } : {}), ...(action.count ? { count: action.count } : {}) }), () => clickSequence(el, hovered, action.button ?? "left"));
  }

  async function pressElement(action: Action, el: Element, instant: boolean, signal?: AbortSignal): Promise<InputMode> {
    return trusted(action, el, instant, signal, (p) => ({ kind: "click", x: p.x, y: p.y }), () => clickSequence(el, hovered));
  }

  async function typeInto(action: Action & { kind: "type" }, instant: boolean, signal?: AbortSignal): Promise<InputMode> {
    const el = await locate(action, action.target, { use: true, ...(signal ? { signal } : {}) });
    const control = el.tagName === "LABEL" ? ((el as HTMLLabelElement).control ?? el) : el;
    const field = isValueElement(control) && control.tagName !== "SELECT" ? (control as HTMLInputElement | HTMLTextAreaElement) : null;
    const editable = !field && isEditable(control) ? (control as HTMLElement) : null;
    if (!field && !editable) throw new ActionError(action, "the target is not a text field", describeAnchor(action.target, ctx.anchors));
    const target = (field ?? editable) as Element;
    let mode: InputMode = "synthetic";
    const useTrusted = wantsTrusted(action);
    if (useTrusted) {
      const check = await arrive(target, instant, signal);
      if (check.ok) {
        if (!instant) overlay.press(check.rect);
        await host({ kind: "click", x: check.point.x, y: check.point.y }, check.point);
        mode = "trusted";
      } else deps.onNote?.(`${action.id}: synthetic fallback, ${check.why ?? "the field can't be reached"}`);
    } else await approach(target, instant, signal);
    if (mode === "synthetic") focusQuietly(target);
    try {
      // Replace, or add to what is there.
      if (action.append) caretToEnd(target);
      else if (field ? field.value !== "" : (editable?.textContent ?? "") !== "") {
        if (mode === "trusted") {
          selectAll(target);
          await host({ kind: "key", key: "Backspace" }, null);
        } else if (field) {
          setNativeValue(field, "", natives);
          fireInput(field, null, "deleteContentBackward");
        } else if (editable) clearEditable(editable);
      }
      if (mode === "trusted") {
        if (instant) {
          if (action.text) await host({ kind: "type", text: action.text }, null);
        } else {
          for (const ch of action.text) {
            throwIfAborted(signal);
            await host({ kind: "type", text: ch }, null);
            await deps.pace.sleep(TYPE_MS, signal);
          }
        }
      } else if (field) {
        let value = field.value;
        if (instant) {
          if (action.text) {
            setNativeValue(field, value + action.text, natives);
            fireInput(field, action.text);
          }
        } else {
          for (const ch of action.text) {
            value += ch;
            fireKey(field, "keydown", ch);
            setNativeValue(field, value, natives);
            fireInput(field, ch);
            fireKey(field, "keyup", ch);
            await deps.pace.sleep(TYPE_MS, signal);
          }
        }
      } else if (editable) {
        if (instant) insertEditableText(editable, action.text);
        else {
          for (const ch of action.text) {
            insertEditableText(editable, ch);
            await deps.pace.sleep(TYPE_MS, signal);
          }
        }
      }
      if (action.submit === "enter") {
        if (mode === "trusted") await host({ kind: "key", key: "Enter" }, null);
        else {
          const unhandled = fireKey(target, "keydown", "Enter");
          fireKey(target, "keyup", "Enter");
          if (unhandled && field) field.form?.requestSubmit();
        }
      } else if (action.submit === "button") {
        const form = field?.form ?? editable?.closest("form") ?? null;
        const button = form?.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
        if (!button) throw new ActionError(action, "the field's form has no submit button");
        const started = deps.wall.now();
        while ((button as HTMLButtonElement).disabled) {
          if (deps.wall.now() - started > readyMs(action)) throw new ActionError(action, "the submit button stayed disabled");
          await deps.wall.sleep(100, signal);
        }
        await pressElement(action, button, instant, signal);
      }
    } finally {
      if (action.submit !== "button") blur(target);
    }
    return mode;
  }

  async function select(action: Action & { kind: "select" }, instant: boolean, signal?: AbortSignal): Promise<InputMode> {
    const el = await locate(action, action.target, { use: true, ...(signal ? { signal } : {}) });
    const control = el.tagName === "LABEL" ? ((el as HTMLLabelElement).control ?? el) : el;
    if (control.tagName !== "SELECT") throw new ActionError(action, "the target is not a select", describeAnchor(action.target, ctx.anchors));
    const sel = control as HTMLSelectElement;
    const options = [...sel.options];
    const want = action.value !== undefined ? options.find((o) => o.value === action.value) : action.option !== undefined ? options.find((o) => o.label.trim().toLowerCase() === action.option?.trim().toLowerCase()) ?? options.find((o) => o.label.toLowerCase().includes(action.option?.toLowerCase() ?? "")) : undefined;
    if (!want) throw new ActionError(action, `the select has no option ${JSON.stringify(action.value ?? action.option ?? "")}`);
    // The pointer and the mouse arrive (hover fires); the value is set as Playwright's selectOption
    // does, so the native popup never opens over the film.
    let mode: InputMode = "synthetic";
    if (wantsTrusted(action)) {
      const check = await arrive(sel, instant, signal);
      if (check.ok) {
        if (!instant) overlay.press(check.rect);
        await host({ kind: "move", x: check.point.x, y: check.point.y }, check.point);
        mode = "trusted";
      }
    } else await approach(sel, instant, signal);
    focusQuietly(sel);
    if (sel.value !== want.value) {
      setNativeValue(sel, want.value, natives);
      fireInput(sel, null, "insertReplacementText");
      fireChange(sel);
    }
    blur(sel);
    return mode;
  }

  function isChecked(control: Element): boolean | null {
    if ("checked" in control && control.tagName === "INPUT") return (control as HTMLInputElement).checked;
    const aria = control.getAttribute("aria-checked") ?? control.getAttribute("aria-pressed");
    if (aria === "true") return true;
    if (aria === "false") return false;
    return null;
  }

  async function check(action: Action & { kind: "check" }, instant: boolean, signal?: AbortSignal): Promise<InputMode | null> {
    const el = await locate(action, action.target, { use: true, ...(signal ? { signal } : {}) });
    const control = el.tagName === "LABEL" ? ((el as HTMLLabelElement).control ?? el) : el;
    const want = action.checked ?? true;
    const now = isChecked(control);
    if (now === null) throw new ActionError(action, "the target is not a checkbox, a radio or a switch", describeAnchor(action.target, ctx.anchors));
    if (now === want) return null;
    // The click itself toggles. A hidden native box is clicked through its label.
    const clickTarget = isVisible(control) ? control : (el.tagName === "LABEL" ? el : (control as HTMLInputElement).labels?.[0]) ?? control;
    return pressElement(action, clickTarget, instant, signal);
  }

  async function hover(action: Action & { kind: "hover" | "focus" }, instant: boolean, signal?: AbortSignal): Promise<InputMode> {
    const el = await locate(action, action.target, signal ? { signal } : {});
    const mode = await trusted(action, el, instant, signal, (p) => ({ kind: "move", x: p.x, y: p.y, steps: 6 }), () => hoverOn(el, hovered));
    hovered = el;
    return mode;
  }

  async function key(action: Action & { kind: "key" }, instant: boolean, signal?: AbortSignal): Promise<InputMode> {
    let el: Element;
    if (action.target) {
      el = await locate(action, action.target, signal ? { signal } : {});
      await approach(el, instant, signal);
      focusQuietly(el);
    } else el = doc().activeElement ?? doc().body;
    if (wantsTrusted(action)) {
      await host({ kind: "key", key: action.key }, null);
      return "trusted";
    }
    const { key: k, init } = parseKey(action.key);
    const unhandled = fireKey(el, "keydown", k, init);
    fireKey(el, "keyup", k, init);
    if (unhandled && k === "Enter" && isValueElement(el) && el.tagName !== "SELECT") (el as HTMLInputElement).form?.requestSubmit();
    return "synthetic";
  }

  async function press(action: Action & { kind: "press" }, instant: boolean, signal?: AbortSignal): Promise<InputMode> {
    const el = await locate(action, action.target, { use: true, ...(signal ? { signal } : {}) });
    const ms = action.ms ?? PRESS_MS;
    if (wantsTrusted(action)) {
      const c = await arrive(el, instant, signal);
      if (c.ok) {
        if (!instant) overlay.press(c.rect);
        await host({ kind: "down", x: c.point.x, y: c.point.y }, c.point);
        try {
          if (!instant) await deps.pace.sleep(ms, signal);
        } finally {
          await host({ kind: "up", x: c.point.x, y: c.point.y }, c.point);
        }
        return "trusted";
      }
      deps.onNote?.(`${action.id}: synthetic fallback, ${c.why ?? "the target can't be reached"}`);
    } else await approach(el, instant, signal);
    firePointer(el, "pointerdown");
    fireMouse(el, "mousedown");
    try {
      if (!instant) await deps.pace.sleep(ms, signal);
    } finally {
      firePointer(el, "pointerup");
      fireMouse(el, "mouseup");
      (el as HTMLElement).click?.();
    }
    return "synthetic";
  }

  function offsetPoint(from: { x: number; y: number }, by: Offset | undefined): { x: number; y: number } {
    return { x: from.x + (by?.x ?? 0), y: from.y + (by?.y ?? 0) };
  }

  async function drag(action: Action & { kind: "drag" }, instant: boolean, signal?: AbortSignal): Promise<InputMode> {
    const el = await locate(action, action.target, { use: true, ...(signal ? { signal } : {}) });
    let toEl: Element | null = null;
    let dest: { x: number; y: number };
    if (action.to !== undefined) {
      toEl = await locate(action, action.to, signal ? { signal } : {});
      if (!inView(toEl)) {
        scrollToCentre(toEl);
        await frame();
      }
      dest = centreOf(rectOf(toEl));
    } else dest = offsetPoint(centreOf(rectOf(el)), action.by);
    if (wantsTrusted(action)) {
      const c = await arrive(el, instant, signal);
      if (c.ok) {
        if (!instant) overlay.press(c.rect);
        await host({ kind: "down", x: c.point.x, y: c.point.y }, c.point);
        try {
          if (toEl) dest = centreOf(rectOf(toEl));
          await host({ kind: "move", x: c.point.x + 4, y: c.point.y + 4, steps: 2 }, c.point);
          if (!instant) {
            const travel = overlay.pointerTo({ x: dest.x, y: dest.y, w: 0, h: 0 }, signal);
            await host({ kind: "move", x: dest.x, y: dest.y, steps: 12 }, dest);
            await travel;
          } else await host({ kind: "move", x: dest.x, y: dest.y, steps: 4 }, dest);
        } finally {
          await host({ kind: "up", x: dest.x, y: dest.y }, dest);
        }
        return "trusted";
      }
      deps.onNote?.(`${action.id}: synthetic fallback, ${c.why ?? "the target can't be reached"}`);
    } else await approach(el, instant, signal);
    const target = toEl ?? topAt(dest.x, dest.y) ?? doc().body;
    if (!instant) await overlay.pointerTo({ x: dest.x, y: dest.y, w: 0, h: 0 }, signal);
    dragSequence(el, target, { clientX: dest.x, clientY: dest.y });
    return "synthetic";
  }

  async function readFile(path: string): Promise<FileData> {
    if (deps.readFile) return deps.readFile(path);
    if (deps.bridge?.present) return deps.bridge.asset(path);
    const res = await fetch(path);
    if (!res.ok) throw new Error(`couldn't fetch ${path}: ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { name: path.split("/").pop() ?? path, type: res.headers.get("content-type") ?? "application/octet-stream", bytes };
  }

  async function upload(action: Action & { kind: "upload" }, instant: boolean, signal?: AbortSignal): Promise<InputMode> {
    const el = await locate(action, action.target, { use: true, ...(signal ? { signal } : {}) });
    const control = el.tagName === "LABEL" ? ((el as HTMLLabelElement).control ?? el) : el;
    if (control.tagName !== "INPUT" || (control as HTMLInputElement).type !== "file") throw new ActionError(action, "the target is not a file input", describeAnchor(action.target, ctx.anchors));
    const input = control as HTMLInputElement;
    if (wantsTrusted(action)) {
      // The host sets the files on the element itself (Playwright's `setInputFiles`): the
      // pointer visits a visible input for show, a hidden one is served all the same.
      if (isVisible(el)) await approach(el, instant, signal);
      (view() as unknown as Record<string, unknown>).__showcaseUploadTarget = input;
      await host({ kind: "upload", x: 0, y: 0, files: action.files }, null);
      return "trusted";
    }
    if (isVisible(el)) await approach(el, instant, signal);
    const files = await Promise.all(action.files.map(readFile));
    setFiles(input, files);
    return "synthetic";
  }

  async function settle(signal?: AbortSignal): Promise<void> {
    await frame();
    await deps.pace.sleep(SCROLL_SETTLE_MS, signal);
  }

  async function scroll(action: Action & { kind: "scroll" }, instant: boolean, signal?: AbortSignal): Promise<InputMode> {
    const scroller: Element | null = action.target ? await locate(action, action.target, signal ? { signal } : {}) : null;
    const v = view();
    const mode: InputMode = wantsTrusted(action) ? "trusted" : "synthetic";
    const by = async (dx: number, dy: number) => {
      // The wheel lands under the pointer: the scroller itself must be on screen first.
      if (scroller && !inView(scroller)) {
        scrollToCentre(scroller);
        await frame();
      }
      if (mode === "trusted") {
        const at = scroller ? centreOf(rectOf(scroller)) : { x: (v?.innerWidth ?? 0) / 2, y: (v?.innerHeight ?? 0) / 2 };
        if (!instant) await overlay.pointerTo({ x: at.x, y: at.y, w: 0, h: 0 }, signal);
        await host({ kind: "wheel", x: at.x, y: at.y, dx, dy }, at);
      } else if (scroller) scroller.scrollBy({ left: dx, top: dy, behavior: instant ? "instant" : "smooth" });
      else v?.scrollBy({ left: dx, top: dy, behavior: instant ? "instant" : "smooth" });
      if (!instant) await settle(signal);
      else await frame();
    };
    if (action.to !== undefined) {
      if (action.to === "top" || action.to === "bottom") {
        const target = scroller ?? doc().scrollingElement ?? doc().documentElement;
        const top = action.to === "top" ? 0 : target.scrollHeight;
        target.scrollTo({ top, behavior: instant ? "instant" : "smooth" });
      } else {
        const el = await locate(action, action.to, signal ? { signal } : {});
        scrollToCentre(el);
      }
      if (!instant) await settle(signal);
      else await frame();
    }
    if (action.by) await by(action.by.x ?? 0, action.by.y ?? 0);
    if (action.until) {
      // Scroll until the predicate holds and what it names is in view: "visible" means rendered,
      // and a row clipped by its scroller is rendered, so the author's intent is "on screen".
      const until: Ready = action.until;
      const named = anchorOf(until) as AnchorRef | null;
      const satisfied = () => {
        if (!evaluate(until, readyCtx())) return false;
        if (!named) return true;
        const el = resolve(named, ctx);
        return el !== null && inView(el);
      };
      const step = action.by?.y ?? Math.round(((scroller ? rectOf(scroller).h : (v?.innerHeight ?? 600)) || 600) * 0.6);
      const max = action.maxSteps ?? 20;
      for (let i = 0; i < max && !satisfied(); i++) {
        throwIfAborted(signal);
        await by(action.by?.x ?? 0, step);
      }
      if (!satisfied()) {
        await waitFor(until, { clock: deps.wall, ctx: readyCtx(), timeoutMs: Math.min(readyMs(action), 2000), ...(signal ? { signal } : {}) });
        if (!satisfied()) throw new ActionError(action, `still not in view after ${max} scroll steps`, named ? describeAnchor(named, ctx.anchors) : null);
      }
    }
    return mode;
  }

  async function spotlight(action: Action & { kind: "spotlight" }, signal?: AbortSignal): Promise<void> {
    const el = await locate(action, action.target, signal ? { signal } : {});
    if (!inView(el)) {
      scrollToCentre(el);
      await frame();
    }
    overlay.spotlight({ rect: rectOf(el), callout: action.callout ?? null, element: el });
  }

  async function perform(action: Action, instant: boolean, signal?: AbortSignal): Promise<InputMode | null> {
    switch (action.kind) {
      case "goto": {
        const url = action.url;
        if (deps.navigate) await deps.navigate(url, signal);
        else view()?.location.assign(url);
        return null;
      }
      case "click":
        return click(action, instant, signal);
      case "type":
        return typeInto(action, instant, signal);
      case "select":
        return select(action, instant, signal);
      case "check":
        return check(action, instant, signal);
      case "hover":
        return hover(action, instant, signal);
      case "focus": {
        const el = await locate(action, action.target, signal ? { signal } : {});
        await approach(el, instant, signal);
        (el as HTMLElement).focus?.();
        return null;
      }
      case "key":
        return key(action, instant, signal);
      case "press":
        return press(action, instant, signal);
      case "drag":
        return drag(action, instant, signal);
      case "upload":
        return upload(action, instant, signal);
      case "scroll":
        return scroll(action, instant, signal);
      case "spotlight":
        await spotlight(action, signal);
        return null;
      case "wait":
        if (action.ms !== undefined && !instant) await deps.pace.sleep(action.ms, signal);
        if (action.until) await waitFor(action.until, { clock: deps.wall, ctx: readyCtx(), timeoutMs: readyMs(action), ...(signal ? { signal } : {}) });
        return null;
      case "hold":
        if (!instant) await deps.pace.sleep(action.ms, signal);
        return null;
      case "card":
        overlay.card({ title: action.title, lines: action.lines ?? [] });
        if (action.ms !== undefined && !instant) await deps.pace.sleep(action.ms, signal);
        return null;
      case "invoke":
        if (!deps.invoke) throw new ActionError(action, `no adapter registered for invoke '${action.name}'`);
        await deps.invoke(action.name, action.args);
        return null;
      case "camera": {
        if (action.end || !action.target) {
          deps.onCamera?.({ rect: null, scale: 1, easeMs: CAMERA_EASE_MS });
          return null;
        }
        const el = await locate(action, action.target, signal ? { signal } : {});
        if (!inView(el)) {
          scrollToCentre(el);
          await frame();
        }
        deps.onCamera?.({ rect: rectOf(el), scale: action.scale ?? 1.5, easeMs: CAMERA_EASE_MS });
        return null;
      }
    }
  }

  function isDone(action: Action, options: Pick<RunOptions, "journal" | "key"> = {}): boolean {
    if (action.effect === "write" && options.key && options.journal?.has(options.key)) return true;
    if (!action.done) return false;
    try {
      return evaluate(action.done, readyCtx());
    } catch {
      return false;
    }
  }

  return {
    isDone,

    async runAction(action, options = {}) {
      const { instant = false, signal, journal, key: jkey } = options;
      throwIfAborted(signal);
      ceiling = options.maxWaitMs ?? Number.POSITIVE_INFINITY;
      if (instant && isCosmetic(action)) {
        deps.onPhase?.(action, "skipped");
        return "skipped";
      }
      // Rule 3: what is already done is shown, not done again.
      if (isDone(action, { ...(journal ? { journal } : {}), ...(jkey ? { key: jkey } : {}) })) {
        if (action.effect === "write" && jkey) journal?.add(jkey);
        const result = action.done ? anchorOf(action.done) : null;
        if (!instant && result) {
          const el = resolve(result, ctx);
          if (el) {
            if (!inView(el)) {
              scrollToCentre(el);
              await frame();
            }
            overlay.spotlight({ rect: rectOf(el), callout: null, element: el });
          }
        }
        deps.onPhase?.(action, "skipped");
        return "skipped";
      }

      deps.onPhase?.(action, "start");
      let mode: InputMode | null = null;
      try {
        mode = await perform(action, instant, signal);
        if (action.done) {
          await waitFor(action.done, { clock: deps.wall, ctx: readyCtx(), timeoutMs: readyMs(action), ...(signal ? { signal } : {}) });
        }
      } catch (e) {
        if (e instanceof ReadyTimeout) {
          deps.onPhase?.(action, "timeout", mode ?? undefined);
          throw new ActionError(action, e.message, e.anchor);
        }
        if (e instanceof ActionError && e.message.includes("within")) deps.onPhase?.(action, "timeout");
        throw e;
      } finally {
        const active = doc().activeElement;
        if (active?.tagName === "IFRAME") view()?.focus();
      }
      if (action.effect === "write" && jkey) journal?.add(jkey);
      deps.onPhase?.(action, "done", mode ?? undefined);
      return "done";
    },

    clear() {
      if (hovered) hoverOff(hovered);
      hovered = null;
      overlay.spotlight(null);
      overlay.card(null);
    },
  };
}

export { deref };
