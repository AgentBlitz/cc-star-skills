/**
 * What `rehearse` checks on screen at each beat (PLAN §2.2, §2.8): every number the narration
 * says is on screen (the default `spokenNumbers: "on-screen-only"`), and nothing on the
 * deny-list (`privacy.deny`) is. Pure: the host hands it the beat's visible text.
 */
import { spokenNumbers } from "../runtime/src/narrative.ts";
import type { Config } from "./config.ts";

const UNITS: Record<string, number> = {
  zero: 0, one: 1, a: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALES: Record<string, number> = { thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12, k: 1e3, m: 1e6, bn: 1e9 };

export interface Quantity {
  value: number;
  percent: boolean;
}

/** A number as said or shown: `4%`, `£4.2m`, `1,200`, `four per cent`, `two million`. Null when it isn't one (`3:00`, `W39`). */
export function quantity(token: string): Quantity | null {
  const t = token.toLowerCase().trim();
  if (/\d:\d/.test(t)) return null;
  const percent = /%|percent|per cent/.test(t);
  const digits = /^[£$€]?(\d[\d,]*(?:\.\d+)?)\s?(k|m|bn|million|billion|thousand|trillion)?\b/.exec(t.replace(/\s?(%|percent|per cent|x|×)$/, ""));
  if (digits) {
    const n = Number((digits[1] as string).replace(/,/g, ""));
    if (!Number.isFinite(n)) return null;
    const scale = digits[2] ? (SCALES[digits[2]] ?? 1) : 1;
    return { value: n * scale, percent };
  }
  // Words: "forty per cent", "two million", "a hundred", "half a million".
  const words = t.replace(/per cent|percent/g, "").split(/[\s-]+/).filter(Boolean);
  if (!words.length) return null;
  let total = 0;
  let current = 0;
  let any = false;
  for (const w of words) {
    if (w === "half") {
      current += 0.5;
      any = true;
    } else if (w in UNITS) {
      current += UNITS[w] as number;
      any = true;
    } else if (w in TENS) {
      current += TENS[w] as number;
      any = true;
    } else if (w === "hundred") {
      current = (current || 1) * 100;
      any = true;
    } else if (w in SCALES) {
      total += (current || 1) * (SCALES[w] as number);
      current = 0;
      any = true;
    } else if (w === "and") continue;
    else return null;
  }
  if (!any) return null;
  return { value: total + current, percent };
}

const SCREEN_NUMBERS = /[£$€]?\d[\d,]*(?:\.\d+)?(?:\s?(?:%|percent|per cent|k|m|bn|million|billion|thousand))?/giu;

const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(1e-9, Math.abs(a) * 1e-9);

/** The numbers a beat says that aren't on its screen. */
export function missingNumbers(sentences: readonly string[], screen: string): string[] {
  const shown: Quantity[] = [];
  for (const m of screen.matchAll(SCREEN_NUMBERS)) {
    const q = quantity(m[0]);
    if (q) shown.push(q);
  }
  const lower = screen.toLowerCase();
  const missing: string[] = [];
  for (const s of sentences) {
    for (const said of spokenNumbers(s)) {
      const q = quantity(said);
      const found = q ? shown.some((x) => close(x.value, q.value) && (!q.percent || x.percent)) : lower.includes(said.toLowerCase());
      if (!found) missing.push(said);
    }
  }
  return missing;
}

export interface DenyHit {
  /** The deny-list entry, as configured. */
  rule: string;
  /** What matched on screen. */
  match: string;
}

/** Deny-list entries on screen: strings match case-insensitively, patterns as written. */
export function denyHits(screen: string, deny: Config["privacy"]["deny"]): DenyHit[] {
  const hits: DenyHit[] = [];
  for (const entry of deny) {
    if (typeof entry === "string") {
      const i = screen.toLowerCase().indexOf(entry.toLowerCase());
      if (i >= 0) hits.push({ rule: entry, match: screen.slice(i, i + entry.length) });
      continue;
    }
    let re: RegExp;
    try {
      re = new RegExp(entry.pattern, entry.flags ?? "");
    } catch {
      continue;
    }
    const m = re.exec(screen);
    if (m) hits.push({ rule: `/${entry.pattern}/${entry.flags ?? ""}`, match: m[0].slice(0, 80) });
  }
  return hits;
}
