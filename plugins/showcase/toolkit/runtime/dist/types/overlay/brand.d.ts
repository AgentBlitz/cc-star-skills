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
    fonts?: {
        title?: CardFont;
        lines?: CardFont;
        kicker?: CardFont;
    };
}
export declare const MARK_TAGS: readonly string[];
/** Geometry and presentation attributes. No `href`, `style`, `class`, `id` or event handler. */
export declare const MARK_ATTRS: readonly string[];
/**
 * The tree with every disallowed element (and its subtree) and attribute dropped, or null when the
 * root isn't an `<svg>`. A paint other than `none` becomes `currentColor`, so the mark takes the
 * brand's accent.
 */
export declare function sanitiseMark(node: unknown): MarkNode | null;
/** The overlay's own names for the brand's faces, so an app's `@font-face` of the same family can't interfere. */
export declare const BRAND_FAMILY: {
    readonly title: "Showcase Card Title";
    readonly lines: "Showcase Card Lines";
    readonly kicker: "Showcase Card Kicker";
};
/** `@font-face` rules for the brand's faces, declared on the document (a shadow root ignores them). */
export declare function brandFontCss(brand: CardBrand): string;
/**
 * The brand over the default card styles: its colours and faces for the title and closing cards.
 * `base` is the overlay's own font stack, kept as the fallback. Null when a colour isn't `#rrggbb`.
 */
export declare function brandCss(brand: CardBrand, base: string): string | null;
