/**
 * Anchors (PLAN §2.1): how a tour finds an element. In order of preference, role and name, a
 * form control's label, a test id, visible text, and CSS. Visible matches come first, open shadow
 * roots are searched, same-origin frames too, and `@name` refers to the tour's `anchors`.
 *
 * The accessible-name computation here is a subset of the spec: `aria-labelledby`, `aria-label`,
 * native labels, `alt`, `value` for input buttons, `legend`, `caption`, `figcaption`, then the
 * content for roles that name themselves, then `title` and `placeholder`.
 */
import type { Anchor, AnchorRef } from "./schema.ts";
export interface AnchorContext {
    document: Document;
    /** The tour's named anchors. */
    anchors: Record<string, Anchor>;
}
export declare class AnchorError extends Error {
    constructor(message: string);
}
/** `@name` → the tour's anchor. Throws for an unknown name (T006 catches it statically). */
export declare function deref(ref: AnchorRef, named?: Record<string, Anchor>): Anchor;
export declare const squash: (s: string | null | undefined) => string;
/** The element's ARIA role: explicit, else the implicit one of its tag. Null for none. */
export declare function roleOf(el: Element): string | null;
/** The element's accessible name (a subset of the computation), or "" for none. */
export declare function accessibleName(el: Element, role?: string | null): string;
/** Whether the element is rendered: it has a box, and nothing up the tree hides it. */
export declare function isVisible(el: Element): boolean;
export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}
/** Where the element is in the top window's viewport: its own rectangle plus every frame's offset. */
export declare function rectOf(el: Element): Rect;
export declare function centreOf(rect: Rect): {
    x: number;
    y: number;
};
/** The document and its same-origin frames' documents, top first, in document order. */
export declare function documentsOf(top: Document): Document[];
/** Every element under `root` matching `selector`, open shadow roots included, in tree order. */
export declare function queryDeep(root: ParentNode, selector: string): Element[];
/** Every element the anchor matches, visible ones first, each group in document order. */
export declare function resolveAll(ref: AnchorRef, ctx: AnchorContext, options?: {
    sameFrame?: boolean;
}): Element[];
/** The element the anchor names (`nth` picks among the matches), or null while it isn't there. */
export declare function resolve(ref: AnchorRef, ctx: AnchorContext, options?: {
    sameFrame?: boolean;
}): Element | null;
/** A short description for errors and reports. */
export declare function describeAnchor(ref: AnchorRef, named?: Record<string, Anchor>): string;
