/**
 * Synthetic events, realm-correct (PLAN §2.1 "In-app"), ported from Compass. An element inside
 * an iframe belongs to the iframe's realm: its events must come from that window's constructors
 * and its value setters from that window's prototypes, or `instanceof` checks (React's among
 * them) fail. Every constructor here is taken from `el.ownerDocument.defaultView`.
 *
 * Added for the plugin: `beforeinput` typing for contenteditable, `DataTransfer` uploads and a
 * drag-and-drop sequence. These events are untrusted (`isTrusted` is false): the synthetic path
 * is the in-app one, and the injected runtime's fallback, logged in the report.
 */
import type { Natives } from "./capture.ts";

type Realm = Window & typeof globalThis;

export function realmOf(el: Element): Realm {
  const view = el.ownerDocument.defaultView;
  if (!view) throw new Error("The element's document has no window");
  return view as Realm;
}

function make<I extends UIEventInit>(Ctor: new (type: string, init?: I) => Event, type: string, init: I, view: Window): Event {
  try {
    return new Ctor(type, { ...init, view });
  } catch {
    return new Ctor(type, init);
  }
}

function centre(el: Element): { clientX: number; clientY: number } {
  const r = el.getBoundingClientRect();
  return { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
}

const NON_BUBBLING = new Set(["pointerenter", "pointerleave", "mouseenter", "mouseleave"]);

export function fireMouse(el: Element, type: string, init: MouseEventInit = {}): boolean {
  const view = realmOf(el);
  return el.dispatchEvent(
    make<MouseEventInit>(
      view.MouseEvent,
      type,
      {
        bubbles: !NON_BUBBLING.has(type),
        cancelable: !NON_BUBBLING.has(type),
        composed: true,
        button: 0,
        buttons: type === "mousedown" ? 1 : 0,
        detail: type === "mousedown" || type === "mouseup" ? 1 : 0,
        ...centre(el),
        ...init,
      },
      view,
    ),
  );
}

export function firePointer(el: Element, type: string, init: PointerEventInit = {}): boolean {
  const view = realmOf(el);
  const Ctor = typeof view.PointerEvent === "function" ? view.PointerEvent : view.MouseEvent;
  return el.dispatchEvent(
    make<PointerEventInit>(
      Ctor,
      type,
      {
        bubbles: !NON_BUBBLING.has(type),
        cancelable: !NON_BUBBLING.has(type),
        composed: true,
        button: 0,
        buttons: type === "pointerdown" ? 1 : 0,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
        ...centre(el),
        ...init,
      },
      view,
    ),
  );
}

export function fireKey(el: Element, type: "keydown" | "keyup" | "keypress", key: string, init: KeyboardEventInit = {}): boolean {
  const view = realmOf(el);
  return el.dispatchEvent(make<KeyboardEventInit>(view.KeyboardEvent, type, { key, code: codeOf(key), bubbles: true, cancelable: true, composed: true, ...init }, view));
}

/** `Control+K` → the key and its modifiers. Playwright's spelling, so a `key` action reads the same both ways. */
export function parseKey(spec: string): { key: string; init: KeyboardEventInit } {
  const parts = spec.split("+");
  const key = parts.pop() ?? spec;
  const init: KeyboardEventInit = {};
  for (const m of parts) {
    const mod = m.toLowerCase();
    if (mod === "shift") init.shiftKey = true;
    else if (mod === "control" || mod === "ctrl") init.ctrlKey = true;
    else if (mod === "alt") init.altKey = true;
    else if (mod === "meta" || mod === "controlormeta") init.metaKey = true;
  }
  return { key: key === "Space" ? " " : key, init };
}

function codeOf(key: string): string {
  if (key.length === 1) {
    if (/[a-z]/i.test(key)) return `Key${key.toUpperCase()}`;
    if (/\d/.test(key)) return `Digit${key}`;
    if (key === " ") return "Space";
  }
  return key;
}

export function fireInput(el: Element, data: string | null, inputType = "insertText"): boolean {
  const view = realmOf(el);
  const Ctor = typeof view.InputEvent === "function" ? view.InputEvent : view.Event;
  return el.dispatchEvent(new Ctor("input", { bubbles: true, cancelable: false, composed: true, data, inputType }));
}

export function fireBeforeInput(el: Element, data: string | null, inputType = "insertText"): boolean {
  const view = realmOf(el);
  if (typeof view.InputEvent !== "function") return true;
  return el.dispatchEvent(new view.InputEvent("beforeinput", { bubbles: true, cancelable: true, composed: true, data, inputType }));
}

export function fireChange(el: Element): boolean {
  const view = realmOf(el);
  return el.dispatchEvent(new view.Event("change", { bubbles: true, cancelable: false }));
}

export type ValueElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export function isValueElement(el: Element): el is ValueElement {
  return /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
}

export function isEditable(el: Element): boolean {
  return (el as HTMLElement).isContentEditable === true;
}

/**
 * Sets a field's value through its prototype's setter. React replaces the instance's `value`
 * property to track what it last rendered; going round it is what makes React see the change
 * when the `input` event arrives. The captured setters are used for the top realm; an iframe's
 * come from its own prototypes.
 */
export function setNativeValue(el: ValueElement, value: string, natives?: Natives | null): void {
  const view = realmOf(el);
  const top = natives && el.ownerDocument.defaultView === window;
  let setter: ((this: ValueElement, v: string) => void) | null | undefined;
  if (el.tagName === "TEXTAREA") setter = top ? natives.setters.textareaValue : Object.getOwnPropertyDescriptor(view.HTMLTextAreaElement.prototype, "value")?.set;
  else if (el.tagName === "SELECT") setter = top ? natives.setters.selectValue : Object.getOwnPropertyDescriptor(view.HTMLSelectElement.prototype, "value")?.set;
  else setter = top ? natives.setters.inputValue : Object.getOwnPropertyDescriptor(view.HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
}

export function setNativeChecked(el: HTMLInputElement, checked: boolean, natives?: Natives | null): void {
  const view = realmOf(el);
  const setter = natives && el.ownerDocument.defaultView === window ? natives.setters.checked : Object.getOwnPropertyDescriptor(view.HTMLInputElement.prototype, "checked")?.set;
  if (setter) setter.call(el, checked);
  else el.checked = checked;
}

/**
 * A click as a person makes one: the pointer arrives, presses, the element takes focus, the
 * pointer lifts, and the element is clicked. `el.click()` runs the native activation (a link
 * follows, a checkbox toggles, a form submits) and fires the click event frameworks listen for.
 */
export function clickSequence(el: Element, from: Element | null = null, button: "left" | "right" | "middle" = "left"): void {
  const related = { relatedTarget: from ?? el.ownerDocument.body };
  const b = button === "right" ? 2 : button === "middle" ? 1 : 0;
  firePointer(el, "pointerover", related);
  firePointer(el, "pointerenter", related);
  fireMouse(el, "mouseover", related);
  fireMouse(el, "mouseenter", related);
  firePointer(el, "pointerdown", { button: b, buttons: b === 0 ? 1 : b === 1 ? 4 : 2 });
  if (fireMouse(el, "mousedown", { button: b, buttons: b === 0 ? 1 : b === 1 ? 4 : 2 })) focusQuietly(el);
  firePointer(el, "pointerup", { button: b });
  fireMouse(el, "mouseup", { button: b });
  if (button === "right") fireMouse(el, "contextmenu", { button: 2 });
  else if (button === "middle") fireMouse(el, "auxclick", { button: 1 });
  else (el as HTMLElement).click();
}

/** Moves the pointer onto an element: what `onMouseEnter` and hover cards listen for. */
export function hoverOn(el: Element, from: Element | null = null): void {
  const related = { relatedTarget: from ?? el.ownerDocument.body };
  firePointer(el, "pointerover", related);
  firePointer(el, "pointerenter", related);
  fireMouse(el, "mouseover", related);
  fireMouse(el, "mouseenter", related);
  firePointer(el, "pointermove");
  fireMouse(el, "mousemove");
}

/** Moves the pointer off it again. */
export function hoverOff(el: Element, to: Element | null = null): void {
  const related = { relatedTarget: to ?? el.ownerDocument.body };
  firePointer(el, "pointerout", related);
  firePointer(el, "pointerleave", related);
  fireMouse(el, "mouseout", related);
  fireMouse(el, "mouseleave", related);
}

export function focusQuietly(el: Element): void {
  (el as HTMLElement).focus?.({ preventScroll: true });
}

export function blur(el: Element): void {
  (el as HTMLElement).blur?.();
}

/**
 * Types into a contenteditable the way the editing host would: a cancelable `beforeinput`, then
 * the insertion (through `execCommand`, which editors like ProseMirror and Lexical accept, else
 * a text node), then `input`. Returns false if the editor cancelled the insertion.
 */
export function insertEditableText(el: Element, text: string): boolean {
  const view = realmOf(el);
  const doc = el.ownerDocument;
  if (doc.activeElement !== el) focusQuietly(el);
  if (!fireBeforeInput(el, text, "insertText")) return false;
  let inserted = false;
  try {
    inserted = doc.execCommand("insertText", false, text);
  } catch {
    inserted = false;
  }
  if (!inserted) {
    const sel = view.getSelection();
    const range = sel && sel.rangeCount > 0 && el.contains(sel.anchorNode) ? sel.getRangeAt(0) : null;
    if (range) {
      range.deleteContents();
      const node = doc.createTextNode(text);
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(range);
    } else {
      el.append(doc.createTextNode(text));
    }
    fireInput(el, text, "insertText");
  }
  return true;
}

/** Selects all of an editable host's content, or a field's text. */
export function selectAll(el: Element): void {
  if (isValueElement(el) && el.tagName !== "SELECT") {
    (el as HTMLInputElement | HTMLTextAreaElement).select();
    return;
  }
  const view = realmOf(el);
  const range = el.ownerDocument.createRange();
  range.selectNodeContents(el);
  const sel = view.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

/** Puts the caret at the end. */
export function caretToEnd(el: Element): void {
  if (isValueElement(el) && el.tagName !== "SELECT") {
    const f = el as HTMLInputElement | HTMLTextAreaElement;
    const n = f.value.length;
    try {
      f.setSelectionRange(n, n);
    } catch {
      // Some input types have no selection.
    }
    return;
  }
  const view = realmOf(el);
  const range = el.ownerDocument.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = view.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

/** Clears an editable host synthetically: `beforeinput` (deleteContentBackward), then the content. */
export function clearEditable(el: Element): boolean {
  if (!fireBeforeInput(el, null, "deleteContentBackward")) return false;
  let done = false;
  try {
    selectAll(el);
    done = el.ownerDocument.execCommand("delete", false);
  } catch {
    done = false;
  }
  if (!done) {
    el.textContent = "";
    fireInput(el, null, "deleteContentBackward");
  }
  return true;
}

export interface FileData {
  name: string;
  type: string;
  bytes: Uint8Array;
}

/** Puts files on a file input through a `DataTransfer`, then `input` and `change`. */
export function setFiles(input: HTMLInputElement, files: FileData[]): void {
  const view = realmOf(input);
  const dt = new view.DataTransfer();
  for (const f of files) dt.items.add(new view.File([f.bytes as BlobPart], f.name, { type: f.type }));
  input.files = dt.files;
  fireInput(input, null, "insertFromPaste");
  fireChange(input);
}

/** HTML5 drag and drop, synthetically: one `DataTransfer` travels from `dragstart` to `drop`. */
export function dragSequence(from: Element, to: Element, point?: { clientX: number; clientY: number }): void {
  const view = realmOf(from);
  const dt = new view.DataTransfer();
  const at = point ?? centre(to);
  const drag = (el: Element, type: string, init: DragEventInit = {}): boolean => {
    const Ctor = typeof view.DragEvent === "function" ? view.DragEvent : view.MouseEvent;
    return el.dispatchEvent(
      make<DragEventInit>(Ctor as new (type: string, init?: DragEventInit) => Event, type, { bubbles: true, cancelable: type !== "dragend" && type !== "dragleave", composed: true, dataTransfer: dt, ...centre(el), ...init }, view),
    );
  };
  firePointer(from, "pointerdown");
  fireMouse(from, "mousedown");
  drag(from, "dragstart");
  drag(to, "dragenter", at);
  drag(to, "dragover", at);
  drag(to, "drop", at);
  drag(from, "dragend");
  firePointer(to, "pointerup", at);
  fireMouse(to, "mouseup", at);
}
