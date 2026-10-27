/**
 * `film.cards` resolved for the runtime (showcase 1.1): `true` and `false` are showcase's own look
 * (null); a brand has its mark read and sanitised and its fonts read into data URIs, so the page
 * fetches nothing. Paths are relative to the repo root and may not leave it.
 */
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { type CardBrand, type CardFont, type MarkNode, sanitiseMark } from "../runtime/src/overlay/brand.ts";
import type { Config } from "./config.ts";

export class CardsError extends Error {
  constructor(message: string) {
    super(`film.cards: ${message}`);
    this.name = "CardsError";
  }
}

interface RawNode {
  tag: string;
  attrs: Record<string, string>;
  children: RawNode[];
}

const NAME = /^[A-Za-z_][\w.:-]*/;

/**
 * A strict, small SVG reader: elements and their quoted attributes only. Comments, the XML
 * declaration, a doctype and text are skipped; CDATA and processing instructions inside the
 * document are refused rather than guessed at. `sanitiseMark` decides what survives.
 */
export function parseSvg(text: string): RawNode {
  let i = 0;
  const stack: RawNode[] = [];
  let root: RawNode | null = null;
  const fail = (why: string): never => {
    throw new CardsError(`the mark isn't SVG this reader accepts (${why}, at character ${i})`);
  };
  while (i < text.length) {
    const lt = text.indexOf("<", i);
    if (lt < 0) break;
    i = lt;
    if (text.startsWith("<!--", i)) {
      const end = text.indexOf("-->", i + 4);
      if (end < 0) fail("an unclosed comment");
      i = end + 3;
    } else if (text.startsWith("<?xml", i) && !root) {
      const end = text.indexOf("?>", i);
      if (end < 0) fail("an unclosed declaration");
      i = end + 2;
    } else if (/^<!DOCTYPE/i.test(text.slice(i, i + 9)) && !root) {
      const end = text.indexOf(">", i);
      if (end < 0 || text.slice(i, end).includes("[")) fail("a doctype with an internal subset");
      i = end + 1;
    } else if (text.startsWith("</", i)) {
      const m = NAME.exec(text.slice(i + 2));
      const open = stack.pop();
      if (!m || !open || m[0] !== open.tag) fail("a mismatched closing tag");
      const end = text.indexOf(">", i);
      i = end + 1;
    } else if (text.startsWith("<!", i) || text.startsWith("<?", i)) {
      fail("CDATA or a processing instruction");
    } else {
      i++;
      const m = NAME.exec(text.slice(i));
      if (!m) fail("a tag without a name");
      const node: RawNode = { tag: (m as RegExpExecArray)[0], attrs: {}, children: [] };
      i += node.tag.length;
      for (;;) {
        while (/\s/.test(text[i] ?? "")) i++;
        if (text.startsWith("/>", i)) {
          i += 2;
          break;
        }
        if (text[i] === ">") {
          i++;
          stack.push(node);
          break;
        }
        const a = NAME.exec(text.slice(i));
        if (!a) fail("an unreadable attribute");
        const name = (a as RegExpExecArray)[0];
        i += name.length;
        while (/\s/.test(text[i] ?? "")) i++;
        if (text[i] !== "=") fail(`attribute ${name} without a value`);
        i++;
        while (/\s/.test(text[i] ?? "")) i++;
        const q = text[i];
        if (q !== '"' && q !== "'") fail(`attribute ${name} without quotes`);
        const end = text.indexOf(q as string, i + 1);
        if (end < 0) fail(`attribute ${name} unclosed`);
        node.attrs[name] = text.slice(i + 1, end);
        i = end + 1;
      }
      const parent = stack.at(node === stack.at(-1) ? -2 : -1);
      if (parent && parent !== node) parent.children.push(node);
      else if (!root) root = node;
      else fail("more than one root element");
    }
  }
  if (stack.length) fail("an unclosed element");
  if (!root) fail("no element");
  return root as RawNode;
}

function inRepo(root: string, file: string): string {
  const path = resolve(root, file);
  const rel = relative(root, path);
  if (isAbsolute(file) || rel.startsWith("..") || isAbsolute(rel)) throw new CardsError(`${file} is outside the repo`);
  if (!existsSync(path)) throw new CardsError(`${file} doesn't exist`);
  return path;
}

/** Reads and sanitises the mark; throws `CardsError` when nothing drawable survives. */
export function loadMark(root: string, file: string): MarkNode {
  const mark = sanitiseMark(parseSvg(readFileSync(inRepo(root, file), "utf8")));
  if (!mark || mark.children.length === 0) throw new CardsError(`${file} has nothing to draw once sanitised (an <svg> of g, path, circle, line or polyline)`);
  return mark;
}

function loadFont(root: string, f: { family: string; file: string }): CardFont {
  const bytes = readFileSync(inRepo(root, f.file));
  if (bytes.toString("latin1", 0, 4) !== "wOF2") throw new CardsError(`${f.file} isn't a woff2 font`);
  return { family: f.family, src: `data:font/woff2;base64,${bytes.toString("base64")}` };
}

/** `film.cards` for `launchHost`: null for showcase's own look, else the brand with everything inlined. */
export function resolveCards(cards: Config["film"]["cards"], root: string): CardBrand | null {
  if (typeof cards === "boolean") return null;
  const fonts: NonNullable<CardBrand["fonts"]> = {};
  for (const role of ["title", "lines", "kicker"] as const) {
    const f = cards.fonts?.[role];
    if (f) fonts[role] = loadFont(root, f);
  }
  return {
    background: cards.background,
    foreground: cards.foreground,
    muted: cards.muted,
    accent: cards.accent,
    ...(cards.mark ? { mark: loadMark(root, cards.mark) } : {}),
    ...(Object.keys(fonts).length ? { fonts } : {}),
  };
}
