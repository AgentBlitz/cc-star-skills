/**
 * Anchor discovery (PLAN §2.2 `inspect`): the page outlined by role and name, as a tour sees it,
 * with the anchor to use for each element. Suggestions follow the anchors' order of preference
 * (role and name → label → test id → text → CSS), and each is checked by resolving it back: an
 * anchor is only suggested if it finds this element first. `nth-child` is never used.
 */
import { type AnchorContext } from "./anchors.ts";
import type { OutlineItem, OutlineOptions } from "./protocol.ts";
import type { Anchor } from "./schema.ts";
export type { OutlineItem, OutlineOptions } from "./protocol.ts";
/** The roles worth naming in a tour: what can be acted on, and what a sentence can point at. */
export declare const OUTLINE_ROLES: Set<string>;
/** The first anchor (in order of preference) that resolves to `el`. */
export declare function suggestAnchor(el: Element, ctx: AnchorContext, frame: string | null): {
    anchor: Anchor;
    by: OutlineItem["by"];
} | null;
/** The page's outline: every element with an interesting role, in document order, top frame first. */
export declare function outline(doc: Document, options?: OutlineOptions): OutlineItem[];
/**
 * The text a viewer can see: the rendered text of the page and its same-origin frames, plus the
 * values in visible form fields (`innerText` leaves those out). What `rehearse` checks spoken
 * numbers and the deny-list against. The overlay is on `<html>`, outside `<body>`, so it isn't read.
 */
export declare function visibleText(doc: Document): string;
