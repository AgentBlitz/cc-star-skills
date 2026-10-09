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
export declare function realmOf(el: Element): Realm;
export declare function fireMouse(el: Element, type: string, init?: MouseEventInit): boolean;
export declare function firePointer(el: Element, type: string, init?: PointerEventInit): boolean;
export declare function fireKey(el: Element, type: "keydown" | "keyup" | "keypress", key: string, init?: KeyboardEventInit): boolean;
/** `Control+K` → the key and its modifiers. Playwright's spelling, so a `key` action reads the same both ways. */
export declare function parseKey(spec: string): {
    key: string;
    init: KeyboardEventInit;
};
export declare function fireInput(el: Element, data: string | null, inputType?: string): boolean;
export declare function fireBeforeInput(el: Element, data: string | null, inputType?: string): boolean;
export declare function fireChange(el: Element): boolean;
export type ValueElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
export declare function isValueElement(el: Element): el is ValueElement;
export declare function isEditable(el: Element): boolean;
/**
 * Sets a field's value through its prototype's setter. React replaces the instance's `value`
 * property to track what it last rendered; going round it is what makes React see the change
 * when the `input` event arrives. The captured setters are used for the top realm; an iframe's
 * come from its own prototypes.
 */
export declare function setNativeValue(el: ValueElement, value: string, natives?: Natives | null): void;
export declare function setNativeChecked(el: HTMLInputElement, checked: boolean, natives?: Natives | null): void;
/**
 * A click as a person makes one: the pointer arrives, presses, the element takes focus, the
 * pointer lifts, and the element is clicked. `el.click()` runs the native activation (a link
 * follows, a checkbox toggles, a form submits) and fires the click event frameworks listen for.
 */
export declare function clickSequence(el: Element, from?: Element | null, button?: "left" | "right" | "middle"): void;
/** Moves the pointer onto an element: what `onMouseEnter` and hover cards listen for. */
export declare function hoverOn(el: Element, from?: Element | null): void;
/** Moves the pointer off it again. */
export declare function hoverOff(el: Element, to?: Element | null): void;
export declare function focusQuietly(el: Element): void;
export declare function blur(el: Element): void;
/**
 * Types into a contenteditable the way the editing host would: a cancelable `beforeinput`, then
 * the insertion (through `execCommand`, which editors like ProseMirror and Lexical accept, else
 * a text node), then `input`. Returns false if the editor cancelled the insertion.
 */
export declare function insertEditableText(el: Element, text: string): boolean;
/** Selects all of an editable host's content, or a field's text. */
export declare function selectAll(el: Element): void;
/** Puts the caret at the end. */
export declare function caretToEnd(el: Element): void;
/** Clears an editable host synthetically: `beforeinput` (deleteContentBackward), then the content. */
export declare function clearEditable(el: Element): boolean;
export interface FileData {
    name: string;
    type: string;
    bytes: Uint8Array;
}
/** Puts files on a file input through a `DataTransfer`, then `input` and `change`. */
export declare function setFiles(input: HTMLInputElement, files: FileData[]): void;
/** HTML5 drag and drop, synthetically: one `DataTransfer` travels from `dragstart` to `drop`. */
export declare function dragSequence(from: Element, to: Element, point?: {
    clientX: number;
    clientY: number;
}): void;
export {};
