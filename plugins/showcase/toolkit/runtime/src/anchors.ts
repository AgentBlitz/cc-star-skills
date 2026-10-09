/**
 * Anchors (PLAN §2.1): how a tour finds an element. In order of preference, role and name, a
 * form control's label, a test id, visible text, and CSS. Visible matches come first, open shadow
 * roots are searched, same-origin frames too, and `@name` refers to the tour's `anchors`.
 *
 * The accessible-name computation here is a subset of the spec: `aria-labelledby`, `aria-label`,
 * native labels, `alt`, `value` for input buttons, `legend`, `caption`, `figcaption`, then the
 * content for roles that name themselves, then `title` and `placeholder`.
 */
import type { Anchor, AnchorRef, TextOrMatch } from "./schema.ts";

export interface AnchorContext {
  document: Document;
  /** The tour's named anchors. */
  anchors: Record<string, Anchor>;
}

export class AnchorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnchorError";
  }
}

/** `@name` → the tour's anchor. Throws for an unknown name (T006 catches it statically). */
export function deref(ref: AnchorRef, named: Record<string, Anchor> = {}): Anchor {
  if (typeof ref !== "string") return ref;
  if (!ref.startsWith("@")) throw new AnchorError(`'${ref}' is not an anchor: use '@name' or an object`);
  const a = named[ref.slice(1)];
  if (!a) throw new AnchorError(`'${ref}' isn't in the tour's anchors`);
  return a;
}

export const squash = (s: string | null | undefined): string => (s ?? "").replace(/\s+/g, " ").trim();

function matcher(want: TextOrMatch, exact: boolean): (s: string) => boolean {
  if (typeof want !== "string") {
    const re = new RegExp(want.pattern, want.flags ?? "");
    return (s) => re.test(s);
  }
  const w = squash(want);
  if (exact) return (s) => s === w;
  const lower = w.toLowerCase();
  return (s) => s.toLowerCase().includes(lower);
}

// ——— Roles ———

const INPUT_ROLES: Record<string, string> = {
  button: "button",
  submit: "button",
  reset: "button",
  image: "button",
  checkbox: "checkbox",
  radio: "radio",
  range: "slider",
  number: "spinbutton",
  search: "searchbox",
  email: "textbox",
  tel: "textbox",
  text: "textbox",
  url: "textbox",
  password: "textbox",
};

/** The element's ARIA role: explicit, else the implicit one of its tag. Null for none. */
export function roleOf(el: Element): string | null {
  const explicit = squash(el.getAttribute("role")).split(" ")[0];
  if (explicit) return explicit;
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case "a":
    case "area":
      return el.hasAttribute("href") ? "link" : null;
    case "button":
      return "button";
    case "input": {
      const input = el as HTMLInputElement;
      const type = (input.getAttribute("type") ?? "text").toLowerCase();
      if (type === "hidden") return null;
      if (input.hasAttribute("list") && (type === "text" || type === "search" || type === "email" || type === "tel" || type === "url"))
        return "combobox";
      return INPUT_ROLES[type] ?? "textbox";
    }
    case "textarea":
      return "textbox";
    case "select": {
      const s = el as HTMLSelectElement;
      return s.multiple || s.size > 1 ? "listbox" : "combobox";
    }
    case "option":
      return "option";
    case "optgroup":
      return "group";
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      return "heading";
    case "img":
      return el.getAttribute("alt") === "" ? "presentation" : "img";
    case "nav":
      return "navigation";
    case "main":
      return "main";
    case "header":
      return el.closest("article, aside, main, nav, section") ? null : "banner";
    case "footer":
      return el.closest("article, aside, main, nav, section") ? null : "contentinfo";
    case "aside":
      return "complementary";
    case "article":
      return "article";
    case "section":
      return el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby") ? "region" : null;
    case "form":
      return el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby") ? "form" : null;
    case "dialog":
      return "dialog";
    case "ul":
    case "ol":
    case "menu":
      return "list";
    case "li":
      return "listitem";
    case "table":
      return "table";
    case "thead":
    case "tbody":
    case "tfoot":
      return "rowgroup";
    case "tr":
      return "row";
    case "th":
      return "columnheader";
    case "td":
      return "cell";
    case "progress":
      return "progressbar";
    case "meter":
      return "meter";
    case "fieldset":
      return "group";
    case "details":
      return "group";
    case "summary":
      return "button";
    case "hr":
      return "separator";
    case "output":
      return "status";
    case "dl":
      return "list";
    case "figure":
      return "figure";
    default:
      return null;
  }
}

/** Roles whose name may come from their content. */
const NAMED_FROM_CONTENT = new Set([
  "button", "cell", "checkbox", "columnheader", "gridcell", "heading", "link", "menuitem", "menuitemcheckbox",
  "menuitemradio", "option", "radio", "row", "rowheader", "switch", "tab", "tooltip", "treeitem", "listitem",
]);

/** A candidate selector per role, so role matching doesn't walk every element. */
const ROLE_SELECTORS: Record<string, string> = {
  button: 'button, summary, input[type="button"], input[type="submit"], input[type="reset"], input[type="image"], [role="button"]',
  link: "a[href], area[href], [role=\"link\"]",
  textbox: 'input, textarea, [role="textbox"]',
  searchbox: 'input[type="search"], [role="searchbox"]',
  checkbox: 'input[type="checkbox"], [role="checkbox"]',
  radio: 'input[type="radio"], [role="radio"]',
  combobox: 'select, input[list], [role="combobox"]',
  listbox: 'select, [role="listbox"]',
  option: 'option, [role="option"]',
  heading: 'h1, h2, h3, h4, h5, h6, [role="heading"]',
  img: 'img, [role="img"]',
  navigation: 'nav, [role="navigation"]',
  main: 'main, [role="main"]',
  banner: 'header, [role="banner"]',
  contentinfo: 'footer, [role="contentinfo"]',
  region: 'section, [role="region"]',
  form: 'form, [role="form"]',
  dialog: 'dialog, [role="dialog"]',
  list: 'ul, ol, menu, dl, [role="list"]',
  listitem: 'li, [role="listitem"]',
  table: 'table, [role="table"]',
  row: 'tr, [role="row"]',
  cell: 'td, [role="cell"]',
  columnheader: 'th, [role="columnheader"]',
  progressbar: 'progress, [role="progressbar"]',
  group: 'fieldset, details, optgroup, [role="group"]',
  status: 'output, [role="status"]',
  figure: 'figure, [role="figure"]',
  separator: 'hr, [role="separator"]',
  slider: 'input[type="range"], [role="slider"]',
  spinbutton: 'input[type="number"], [role="spinbutton"]',
};

// ——— Accessible names ———

/** Whether an element's box separates words, as a browser's name computation treats it. */
function separates(e: Element): boolean {
  const view = e.ownerDocument.defaultView;
  const display = view ? view.getComputedStyle(e).display : "";
  // Detached or unstyled: fall back to the tag (inline elements join, the rest separate).
  if (!display) return !/^(A|ABBR|B|BDI|BDO|CITE|CODE|DFN|EM|I|KBD|LABEL|MARK|Q|S|SAMP|SMALL|SPAN|STRONG|SUB|SUP|TIME|U|VAR)$/.test(e.tagName);
  return !display.startsWith("inline") && display !== "contents";
}

function textWithAlts(el: Element): string {
  // Adjacent text joins as it is: React renders `result{n === 1 ? "" : "s"}` as two text nodes,
  // and the name is "results", not "result s". Block boxes, labels and alts are set apart.
  let out = "";
  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      out += node.nodeValue ?? "";
      return;
    }
    if (node.nodeType !== 1) return;
    const e = node as Element;
    if (e.getAttribute("aria-hidden") === "true") return;
    const label = e.getAttribute("aria-label");
    if (label !== null && e !== el) {
      out += ` ${label} `;
      return;
    }
    if (e.tagName === "IMG") {
      out += ` ${e.getAttribute("alt") ?? ""} `;
      return;
    }
    const gap = e !== el && separates(e) ? " " : "";
    out += gap;
    // Content inside an open shadow root belongs to the name too.
    const root = e.shadowRoot;
    for (const child of root ? [...root.childNodes] : [...e.childNodes]) walk(child);
    out += gap;
  };
  walk(el);
  return squash(out);
}

function labelsOf(el: Element): string[] {
  const out: string[] = [];
  const own = (el as HTMLInputElement).labels;
  if (own && own.length) for (const l of own) out.push(textWithAlts(l));
  const labelledby = el.getAttribute("aria-labelledby");
  if (labelledby) {
    const root = el.getRootNode() as Document | ShadowRoot;
    for (const id of labelledby.split(/\s+/).filter(Boolean)) {
      const ref = root.getElementById?.(id) ?? el.ownerDocument.getElementById(id);
      if (ref) out.push(ref === el ? (el.getAttribute("aria-label") ?? textWithAlts(el)) : textWithAlts(ref));
    }
  }
  return out.filter(Boolean);
}

/** The element's accessible name (a subset of the computation), or "" for none. */
export function accessibleName(el: Element, role: string | null = roleOf(el)): string {
  const labelledby = el.getAttribute("aria-labelledby");
  if (labelledby) {
    const name = labelsOf(el).join(" ");
    if (name) return squash(name);
  }
  const aria = el.getAttribute("aria-label");
  if (aria && squash(aria)) return squash(aria);
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select" || tag === "meter" || tag === "progress" || tag === "output") {
    const labels = (el as HTMLInputElement).labels;
    if (labels && labels.length) return squash([...labels].map(textWithAlts).join(" "));
  }
  if (tag === "input") {
    const type = ((el as HTMLInputElement).getAttribute("type") ?? "text").toLowerCase();
    if (type === "image") return squash(el.getAttribute("alt") ?? el.getAttribute("value") ?? "");
    if (type === "button" || type === "submit" || type === "reset") return squash((el as HTMLInputElement).value || el.getAttribute("value") || "");
  }
  if (tag === "img" || tag === "area") return squash(el.getAttribute("alt"));
  if (tag === "fieldset") {
    const legend = el.querySelector(":scope > legend");
    if (legend) return textWithAlts(legend);
  }
  if (tag === "table") {
    const caption = el.querySelector(":scope > caption");
    if (caption) return textWithAlts(caption);
  }
  if (tag === "figure") {
    const cap = el.querySelector(":scope > figcaption");
    if (cap) return textWithAlts(cap);
  }
  if (tag === "details") {
    const summary = el.querySelector(":scope > summary");
    if (summary) return textWithAlts(summary);
  }
  if (role && NAMED_FROM_CONTENT.has(role)) {
    const content = textWithAlts(el);
    if (content) return content;
  }
  const title = el.getAttribute("title");
  if (title && squash(title)) return squash(title);
  const placeholder = el.getAttribute("placeholder");
  if (placeholder && squash(placeholder)) return squash(placeholder);
  return "";
}

// ——— Visibility and geometry ———

/** Whether the element is rendered: it has a box, and nothing up the tree hides it. */
export function isVisible(el: Element): boolean {
  if (!el.isConnected) return false;
  const view = el.ownerDocument.defaultView;
  if (!view) return false;
  if (el.tagName === "OPTION") {
    const select = el.closest("select");
    return select ? isVisible(select) : false;
  }
  const rects = el.getClientRects();
  if (rects.length === 0) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  const style = view.getComputedStyle(el);
  if (style.visibility === "hidden" || style.visibility === "collapse") return false;
  return true;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where the element is in the top window's viewport: its own rectangle plus every frame's offset. */
export function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect();
  let x = r.left;
  let y = r.top;
  let view = el.ownerDocument.defaultView;
  while (view && view !== view.parent) {
    let frame: Element | null = null;
    try {
      frame = view.frameElement;
    } catch {
      frame = null;
    }
    if (!frame) break;
    const fr = frame.getBoundingClientRect();
    x += fr.left + (frame as HTMLElement).clientLeft;
    y += fr.top + (frame as HTMLElement).clientTop;
    view = frame.ownerDocument.defaultView;
  }
  return { x, y, w: r.width, h: r.height };
}

export function centreOf(rect: Rect): { x: number; y: number } {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

// ——— Finding ———

/** The document and its same-origin frames' documents, top first, in document order. */
export function documentsOf(top: Document): Document[] {
  const docs: Document[] = [top];
  const walk = (doc: Document) => {
    for (const frame of doc.querySelectorAll("iframe, frame")) {
      try {
        const inner = (frame as HTMLIFrameElement).contentDocument;
        if (inner && !docs.includes(inner)) {
          docs.push(inner);
          walk(inner);
        }
      } catch {
        // Another origin.
      }
    }
  };
  walk(top);
  return docs;
}

/** Every element under `root` matching `selector`, open shadow roots included, in tree order. */
export function queryDeep(root: ParentNode, selector: string): Element[] {
  const out: Element[] = [];
  const visit = (node: ParentNode) => {
    let found: Element[];
    try {
      found = [...node.querySelectorAll(selector)];
    } catch {
      throw new AnchorError(`invalid CSS selector: ${selector}`);
    }
    const hosts = [...node.querySelectorAll("*")].filter((e) => e.shadowRoot);
    if (hosts.length === 0) {
      out.push(...found);
      return;
    }
    // Keep tree order: an element's shadow content follows the element.
    const shadowed = new Set<Element>(hosts);
    const all = [...node.querySelectorAll("*")];
    const matched = new Set(found);
    for (const e of all) {
      if (matched.has(e)) out.push(e);
      if (shadowed.has(e) && e.shadowRoot) visit(e.shadowRoot);
    }
  };
  if ((root as Element).shadowRoot && root !== (root as Element).ownerDocument) {
    // A host as scope: its light tree, then its shadow tree.
    visit(root);
    visit((root as Element).shadowRoot as ShadowRoot);
    return out;
  }
  visit(root);
  return out;
}

function frameDocument(selector: string, top: Document): Document | null {
  const frame = queryDeep(top, selector)[0];
  if (!frame || (frame.tagName !== "IFRAME" && frame.tagName !== "FRAME")) return null;
  try {
    return (frame as HTMLIFrameElement).contentDocument;
  } catch {
    return null;
  }
}

function candidatesIn(scope: ParentNode, a: Anchor): Element[] {
  if (a.css) return queryDeep(scope, a.css);
  if (a.testId !== undefined) return queryDeep(scope, `[data-testid="${CSS.escape(a.testId)}"], [data-test-id="${CSS.escape(a.testId)}"], [data-test="${CSS.escape(a.testId)}"]`);
  if (a.role) return queryDeep(scope, ROLE_SELECTORS[a.role] ?? `[role="${CSS.escape(a.role)}"]`);
  if (a.label !== undefined) return queryDeep(scope, "input, textarea, select, meter, progress, output, [aria-labelledby], [aria-label]");
  return queryDeep(scope, "*");
}

function matches(el: Element, a: Anchor): boolean {
  const exact = a.exact === true;
  let role: string | null | undefined;
  if (a.role) {
    role = roleOf(el);
    if (role !== a.role) return false;
  }
  if (a.name !== undefined) {
    if (role === undefined) role = roleOf(el);
    if (!matcher(a.name, exact)(accessibleName(el, role))) return false;
  }
  if (a.label !== undefined) {
    const labels = labelsOf(el);
    const m = matcher(a.label, exact);
    if (!labels.some(m) && !m(accessibleName(el))) return false;
  }
  if (a.text !== undefined && !matcher(a.text, exact)(textWithAlts(el))) return false;
  return true;
}

function resolveIn(doc: Document, a: Anchor, ctx: AnchorContext): Element[] {
  let scope: ParentNode = doc;
  if (a.within !== undefined) {
    const parent = resolve(a.within, { ...ctx, document: doc }, { sameFrame: true });
    if (!parent) return [];
    scope = parent;
  }
  const found = candidatesIn(scope, a).filter((el) => matches(el, a));
  if (a.text !== undefined && a.css === undefined && a.role === undefined && a.label === undefined && a.testId === undefined) {
    // A text-only anchor names the innermost element with that text, not every ancestor.
    return found.filter((el) => !found.some((other) => other !== el && el.contains(other)));
  }
  return found;
}

/** Every element the anchor matches, visible ones first, each group in document order. */
export function resolveAll(ref: AnchorRef, ctx: AnchorContext, options: { sameFrame?: boolean } = {}): Element[] {
  const a = deref(ref, ctx.anchors);
  const top = ctx.document;
  let docs: Document[];
  if (a.frame) {
    const d = frameDocument(a.frame, top);
    docs = d ? [d] : [];
  } else {
    docs = options.sameFrame ? [top] : documentsOf(top);
  }
  const all: Element[] = [];
  for (const doc of docs) {
    const found = resolveIn(doc, a, ctx);
    if (found.length) {
      all.push(...found);
      // The top document wins over its frames; a frame is searched only when the top has none.
      if (!a.frame) break;
    }
  }
  const visible = all.filter(isVisible);
  const hidden = all.filter((el) => !visible.includes(el));
  return [...visible, ...hidden];
}

/** The element the anchor names (`nth` picks among the matches), or null while it isn't there. */
export function resolve(ref: AnchorRef, ctx: AnchorContext, options: { sameFrame?: boolean } = {}): Element | null {
  const all = resolveAll(ref, ctx, options);
  const a = deref(ref, ctx.anchors);
  const n = a.nth ?? 0;
  return all[n < 0 ? all.length + n : n] ?? null;
}

function showText(t: TextOrMatch): string {
  return typeof t === "string" ? `"${t}"` : `/${t.pattern}/${t.flags ?? ""}`;
}

/** A short description for errors and reports. */
export function describeAnchor(ref: AnchorRef, named: Record<string, Anchor> = {}): string {
  if (typeof ref === "string") {
    const a = named[ref.slice(1)];
    return a ? `${ref} (${describeAnchor(a, named)})` : ref;
  }
  const a = ref;
  const parts: string[] = [];
  if (a.role) parts.push(a.name !== undefined ? `${a.role} ${showText(a.name)}` : `role ${a.role}`);
  else if (a.name !== undefined) parts.push(`name ${showText(a.name)}`);
  if (a.label !== undefined) parts.push(`label ${showText(a.label)}`);
  if (a.testId !== undefined) parts.push(`test id "${a.testId}"`);
  if (a.text !== undefined) parts.push(`text ${showText(a.text)}`);
  if (a.css) parts.push(a.css);
  if (a.nth !== undefined) parts.push(`#${a.nth}`);
  if (a.within !== undefined) parts.push(`in ${describeAnchor(a.within, named)}`);
  if (a.frame) parts.push(`(frame ${a.frame})`);
  return parts.join(" ") || "an anchor";
}
