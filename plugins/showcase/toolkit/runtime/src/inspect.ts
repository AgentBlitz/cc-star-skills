/**
 * Anchor discovery (PLAN §2.2 `inspect`): the page outlined by role and name, as a tour sees it,
 * with the anchor to use for each element. Suggestions follow the anchors' order of preference
 * (role and name → label → test id → text → CSS), and each is checked by resolving it back: an
 * anchor is only suggested if it finds this element first. `nth-child` is never used.
 */
import { accessibleName, type AnchorContext, documentsOf, isVisible, queryDeep, resolve, roleOf, squash } from "./anchors.ts";
import type { OutlineItem, OutlineOptions } from "./protocol.ts";
import type { Anchor } from "./schema.ts";

export type { OutlineItem, OutlineOptions } from "./protocol.ts";

/** The roles worth naming in a tour: what can be acted on, and what a sentence can point at. */
export const OUTLINE_ROLES = new Set([
  "button",
  "link",
  "textbox",
  "searchbox",
  "checkbox",
  "radio",
  "combobox",
  "listbox",
  "switch",
  "slider",
  "spinbutton",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "tab",
  "option",
  "heading",
  "dialog",
  "alertdialog",
  "region",
  "navigation",
  "main",
  "form",
  "search",
  "banner",
  "contentinfo",
  "complementary",
  "img",
  "figure",
  "table",
  "status",
  "alert",
  "progressbar",
  "listitem",
  "tabpanel",
  "menu",
  "toolbar",
  "grid",
  "row",
  "cell",
]);

/** Landmarks and containers listed only when they have a name. */
const NEED_NAME = new Set(["region", "form", "listitem", "row", "cell", "img", "figure", "table", "menu", "toolbar", "tabpanel", "grid"]);


function cssPath(el: Element): string | null {
  if (el.id && /^[A-Za-z][\w-]*$/.test(el.id)) return `#${el.id}`;
  const tag = el.tagName.toLowerCase();
  const name = el.getAttribute("name");
  if (name && /^[\w-]+$/.test(name)) return `${tag}[name="${name}"]`;
  const cls = [...el.classList].filter((c) => /^[A-Za-z][\w-]*$/.test(c)).slice(0, 2);
  if (cls.length) return `${tag}.${cls.join(".")}`;
  return null;
}

function testIdOf(el: Element): string | null {
  return el.getAttribute("data-testid") ?? el.getAttribute("data-test-id") ?? el.getAttribute("data-test");
}

function labelText(el: Element): string | null {
  const tag = el.tagName;
  if (tag !== "INPUT" && tag !== "SELECT" && tag !== "TEXTAREA") return null;
  const labels = (el as HTMLInputElement).labels;
  const first = labels?.[0];
  return first ? squash(first.textContent) || null : null;
}

/** The first anchor (in order of preference) that resolves to `el`. */
export function suggestAnchor(el: Element, ctx: AnchorContext, frame: string | null): { anchor: Anchor; by: OutlineItem["by"] } | null {
  const role = roleOf(el);
  const name = squash(accessibleName(el, role));
  const withFrame = (a: Anchor): Anchor => (frame ? { ...a, frame } : a);
  const finds = (a: Anchor) => {
    try {
      return resolve(a, ctx) === el;
    } catch {
      return false;
    }
  };
  const tries: { a: Anchor; by: OutlineItem["by"] }[] = [];
  if (role && name) {
    tries.push({ a: withFrame({ role, name }), by: "role" });
    tries.push({ a: withFrame({ role, name, exact: true }), by: "role" });
  }
  const label = labelText(el);
  if (label) tries.push({ a: withFrame({ label }), by: "label" });
  const tid = testIdOf(el);
  if (tid) tries.push({ a: withFrame({ testId: tid }), by: "testId" });
  const text = squash((el as HTMLElement).innerText ?? el.textContent);
  if (text && text.length <= 60) tries.push({ a: withFrame({ text }), by: "text" });
  const css = cssPath(el);
  if (css) tries.push({ a: withFrame({ css }), by: "css" });
  for (const t of tries) if (finds(t.a)) return { anchor: t.a, by: t.by };
  // Role and name, picked among their matches: still no `nth-child`.
  if (role && name) {
    for (let nth = 1; nth < 20; nth++) {
      const a = withFrame({ role, name, exact: true, nth });
      if (finds(a)) return { anchor: a, by: "role" };
    }
  }
  return null;
}

/** The page's outline: every element with an interesting role, in document order, top frame first. */
export function outline(doc: Document, options: OutlineOptions = {}): OutlineItem[] {
  const limit = options.limit ?? 400;
  const ctx: AnchorContext = { document: doc, anchors: {} };
  const items: OutlineItem[] = [];
  const frames = new Map<Document, string | null>();
  frames.set(doc, null);
  for (const d of documentsOf(doc)) {
    if (d === doc) continue;
    const frameEl = d.defaultView?.frameElement;
    const sel = frameEl ? (frameEl.id ? `#${frameEl.id}` : frameEl.getAttribute("title") ? `iframe[title="${frameEl.getAttribute("title")}"]` : "iframe") : "iframe";
    frames.set(d, sel);
  }
  for (const [d, frame] of frames) {
    const stack: Element[] = [];
    for (const el of queryDeep(d, "*")) {
      if (items.length >= limit) return items;
      if (el.closest("showcase-overlay, showcase-controls")) continue;
      const role = roleOf(el);
      if (!role || !OUTLINE_ROLES.has(role)) continue;
      const visible = isVisible(el);
      if (!visible && !options.hidden) continue;
      const name = squash(accessibleName(el, role));
      if (!name && NEED_NAME.has(role)) continue;
      while (stack.length && !stack[stack.length - 1]?.contains(el)) stack.pop();
      const s = suggestAnchor(el, ctx, frame);
      const item: OutlineItem = { role, name, depth: stack.length, visible, frame, anchor: s?.anchor ?? null, by: s?.by ?? null };
      if (role === "heading") {
        const m = /^H([1-6])$/.exec(el.tagName);
        const level = Number(el.getAttribute("aria-level") ?? (m ? m[1] : 2));
        if (Number.isFinite(level)) item.level = level;
      }
      items.push(item);
      stack.push(el);
    }
  }
  return items;
}

/**
 * The text a viewer can see: the rendered text of the page and its same-origin frames, plus the
 * values in visible form fields (`innerText` leaves those out). What `rehearse` checks spoken
 * numbers and the deny-list against. The overlay is on `<html>`, outside `<body>`, so it isn't read.
 */
export function visibleText(doc: Document): string {
  const parts: string[] = [];
  for (const d of documentsOf(doc)) {
    const body = d.body as HTMLElement | null;
    if (body) parts.push(body.innerText ?? body.textContent ?? "");
    for (const el of queryDeep(d, "input, textarea, select")) {
      if (!isVisible(el) || el.closest("showcase-overlay, showcase-controls")) continue;
      const type = (el.getAttribute("type") ?? "").toLowerCase();
      if (type === "password" || type === "hidden") continue;
      if (el.tagName === "SELECT") {
        const s = el as HTMLSelectElement;
        parts.push(s.selectedOptions[0]?.text ?? "");
      } else parts.push((el as HTMLInputElement).value ?? "");
    }
  }
  return parts.filter(Boolean).join("\n");
}
