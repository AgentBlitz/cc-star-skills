/**
 * Pronunciation fixes (PLAN §2.4): written → spoken, applied before a sentence is voiced; captions
 * keep the written text. Word keys ("W39", "NGR") match only at a letter boundary, so "pp" doesn't
 * touch "approve" but does touch "4pp"; symbol keys match wherever they occur. Longest key first,
 * so "VIPs" isn't left with a "VIP" match that strands the "s". The pass is single: a replacement
 * is never itself rewritten.
 */
export type Lexicon = Record<string, string>;

export function applyLexicon(text: string, lexicon: Lexicon): string {
  const keys = Object.keys(lexicon)
    .filter((k) => k.length > 0)
    .sort((a, b) => b.length - a.length || a.localeCompare(b));
  if (keys.length === 0) return text;
  const alternatives = keys.map((key) => {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return /^[\p{L}\p{N}]+$/u.test(key) ? `(?<![\\p{L}])${escaped}(?![\\p{L}])` : escaped;
  });
  return text.replace(new RegExp(alternatives.join("|"), "gu"), (m) => lexicon[m] ?? m);
}
