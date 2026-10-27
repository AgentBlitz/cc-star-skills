/**
 * Branded cards (showcase 1.1): `film.cards` as colours, a mark and fonts instead of showcase's own
 * look. The host resolves the config into a {@link CardBrand}, with the fonts as data URIs and the
 * mark as a tree of allowed SVG elements, so nothing is fetched. The overlay checks the tree again
 * before it builds it with `createElementNS`, never markup. No DOM here: the host imports it too.
 */

/** A sanitised SVG element: only {@link MARK_TAGS}, only {@link MARK_ATTRS}. */
export interface MarkNode {
  tag: string;
  attrs: Record<string, string>;
  children: MarkNode[];
}

export interface CardFont {
  /** The family the config names (for the record); the overlay declares it under its own name. */
  family: string;
  /** `data:font/woff2;base64,…` */
  src: string;
}

export interface CardBrand {
  background: string;
  foreground: string;
  muted: string;
  accent: string;
  mark?: MarkNode;
  fonts?: { title?: CardFont; lines?: CardFont; kicker?: CardFont };
}

export const MARK_TAGS: readonly string[] = ["svg", "g", "path", "circle", "line", "polyline"];

/** Geometry and presentation attributes. No `href`, `style`, `class`, `id` or event handler. */
export const MARK_ATTRS: readonly string[] = [
  "viewBox", "width", "height", "preserveAspectRatio",
  "d", "cx", "cy", "r", "x1", "y1", "x2", "y2", "points", "transform",
  "fill", "fill-opacity", "fill-rule", "clip-rule", "opacity",
  "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-dasharray", "stroke-dashoffset", "stroke-opacity",
  "vector-effect",
];

/** A value that could reach anything outside the mark (`url(…)`, a scheme) or escape its attribute. */
const UNSAFE_VALUE = /url\s*\(|[a-z][a-z0-9+.-]*:|[<>"'`&;{}\\]/i;
const MAX_NODES = 200;

/**
 * The tree with every disallowed element (and its subtree) and attribute dropped, or null when the
 * root isn't an `<svg>`. A paint other than `none` becomes `currentColor`, so the mark takes the
 * brand's accent.
 */
export function sanitiseMark(node: unknown): MarkNode | null {
  let count = 0;
  const walk = (n: unknown): MarkNode | null => {
    if (!n || typeof n !== "object") return null;
    const { tag, attrs, children } = n as { tag?: unknown; attrs?: unknown; children?: unknown };
    if (typeof tag !== "string" || !MARK_TAGS.includes(tag) || ++count > MAX_NODES) return null;
    const clean: Record<string, string> = {};
    if (attrs && typeof attrs === "object") {
      for (const [k, v] of Object.entries(attrs as Record<string, unknown>)) {
        if (!MARK_ATTRS.includes(k) || typeof v !== "string" || UNSAFE_VALUE.test(v)) continue;
        clean[k] = (k === "fill" || k === "stroke") && v.trim() !== "none" ? "currentColor" : v;
      }
    }
    const kids = Array.isArray(children) ? children.map(walk).filter((c): c is MarkNode => c !== null) : [];
    return { tag, attrs: clean, children: kids };
  };
  const root = walk(node);
  return root && root.tag === "svg" ? root : null;
}

const COLOUR = /^#[0-9A-Fa-f]{6}$/;
const FONT_SRC = /^data:font\/woff2;base64,[A-Za-z0-9+/]+=*$/;

/** The overlay's own names for the brand's faces, so an app's `@font-face` of the same family can't interfere. */
export const BRAND_FAMILY = { title: "Showcase Card Title", lines: "Showcase Card Lines", kicker: "Showcase Card Kicker" } as const;

type Role = keyof typeof BRAND_FAMILY;
const ROLES: readonly Role[] = ["title", "lines", "kicker"];

function fontOf(brand: CardBrand, role: Role): CardFont | null {
  const f = brand.fonts?.[role];
  return f && FONT_SRC.test(f.src) ? f : null;
}

/** `@font-face` rules for the brand's faces, declared on the document (a shadow root ignores them). */
export function brandFontCss(brand: CardBrand): string {
  return ROLES.map((role) => {
    const f = fontOf(brand, role);
    return f ? `@font-face { font-family: "${BRAND_FAMILY[role]}"; src: url("${f.src}") format("woff2"); font-weight: 100 900; font-display: block; }\n` : "";
  }).join("");
}

/**
 * The brand over the default card styles: its colours and faces for the title and closing cards.
 * `base` is the overlay's own font stack, kept as the fallback. Null when a colour isn't `#rrggbb`.
 */
export function brandCss(brand: CardBrand, base: string): string | null {
  if (![brand.background, brand.foreground, brand.muted, brand.accent].every((c) => COLOUR.test(c))) return null;
  const face = (role: Role) => (fontOf(brand, role) ? `"${BRAND_FAMILY[role]}", ${base}` : base);
  return `
.card, .end { background: ${brand.background}; color: ${brand.foreground}; }
.card h1, .end h1 { font-family: ${face("title")}; color: ${brand.foreground}; }
.card li, .end p { font-family: ${face("lines")}; color: ${brand.muted}; }
.card .kicker, .end .kicker { font-family: ${face("kicker")}; font-weight: 500; color: ${brand.muted}; }
.mark { color: ${brand.accent}; }
`;
}
