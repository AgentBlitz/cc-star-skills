// md.mjs: the Markdown subset user guides are written in (PLAN §2.5), parsed to a small tree.
// Both skills carry this file byte for byte: write-guides' check-guides holds a guide to the
// subset as it is written, and wiki-guides' converters render the same tree.
//
// The subset:
//   headings (# is the page title; anchors are GitHub's slugs, -1 for duplicates)
//   paragraphs; **bold**, *italic*, `code`; links [text](href), <https://…> and bare https://…
//   bullet and numbered lists, nested, with paragraphs inside items; --- (a rule)
//   images alone on their line; GFM tables; fenced code
//   blockquotes and GitHub alerts (> [!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION])
// Anything else is an error with its line, or, with { escapeUnsupported: true }, a `raw` block
// shown as escaped text. Nothing is silently dropped.
//
// parse(md, { file, escapeUnsupported }) → { title, titleLine, blocks, errors, escaped }
//   blocks:  heading { level, inlines, anchor, line } · para { inlines, line } · image { alt,
//            src, line } · list { ordered, start, loose, items: [{ blocks, line }], line } ·
//            hr · table { align, head, rows, line } (cells are inline lists) · code { lang,
//            text, line } · quote { blocks, line } · alert { kind, blocks, line } · raw { text,
//            line, why }
//   inlines: text { text } · strong { children } · em { children } · code { text } ·
//            link { href, children, line }
//   errors / escaped: [{ file, line, message }]

export const ALERTS = { NOTE: 'Note', TIP: 'Tip', IMPORTANT: 'Important', WARNING: 'Warning', CAUTION: 'Caution' };

const PUNCT = /[!-/:-@[-`{-~]/;
const isSpace = (c) => c === undefined || /\s/.test(c);
const isPunct = (c) => c !== undefined && (PUNCT.test(c) || /\p{P}|\p{S}/u.test(c));

const FENCE = /^( {0,3})(`{3,}|~{3,})(.*)$/;
const ATX = /^ {0,3}(#{1,6})(?=[ \t]|$)(.*)$/;
const HR = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const SETEXT = /^ {0,3}(?:=+|-+)[ \t]*$/;
const QUOTE = /^ {0,3}>/;
const ITEM = /^( {0,3})([-*+]|\d{1,9}[.)])([ \t]+|$)(.*)$/;
const HTML_BLOCK = /^ {0,3}<(?:!--|![A-Za-z]|\?|\/?[A-Za-z][\w-]*(?=[\s/>]|$))/;
const DEFINITION = /^ {0,3}\[[^\]]+\]:/;
const DELIM_ROW = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;
const ALERT = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*$/i;

const indentOf = (s) => s.match(/^ */)[0].length;
const blank = (s) => /^[ \t]*$/.test(s);

/** GitHub's slug for a heading's text (the rendered text, not the markdown). */
export function slug(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

/** The rendered text of an inline list. */
export function plainText(inlines) {
  return inlines.map((n) => (n.text !== undefined ? n.text : plainText(n.children || []))).join('').replace(/\n/g, ' ');
}

/** Every heading's anchor in a markdown text, in order, with -1, -2 for duplicates. */
export function anchors(md) {
  return new Set(headings(parse(md, { escapeUnsupported: true }).blocks).map((h) => h.anchor));
}

/** The headings of a block list, H1 included, in document order. */
export function headings(blocks) {
  const out = [];
  for (const b of blocks) if (b.type === 'heading') out.push(b);
  return out;
}

/** Parse a guide. Errors carry `file` and a 1-based `line`. */
export function parse(md, { file = '', escapeUnsupported = false } = {}) {
  const ctx = { file, escape: escapeUnsupported, errors: [], escaped: [], title: null, titleLine: 0 };
  const lines = md.replace(/\r\n?/g, '\n').split('\n').map((text, i) => ({ text: text.replace(/\t/g, '    '), n: i + 1 }));
  if (lines.length && lines[lines.length - 1].text === '') lines.pop();
  const blocks = parseBlocks(lines, ctx, 0);
  // anchors: GitHub counts every heading, the title too
  const count = new Map();
  for (const h of headings(blocks)) {
    const s = slug(plainText(h.inlines));
    const k = count.get(s) || 0;
    count.set(s, k + 1);
    h.anchor = k ? `${s}-${k}` : s;
  }
  const strip = (list) => list.map(({ file: f, line, message }) => ({ file: f, line, message }));
  return { title: ctx.title, titleLine: ctx.titleLine, blocks, errors: strip(ctx.errors), escaped: strip(ctx.escaped) };
}

/** An unsupported construct: an error, or (escapeUnsupported) a raw block of escaped text. */
function unsupported(ctx, out, lines, why) {
  const line = lines[0].n;
  if (ctx.escape) {
    ctx.escaped.push({ file: ctx.file, line, message: why });
    out.push({ type: 'raw', text: lines.map((l) => l.text).join('\n'), line, why });
  } else ctx.errors.push({ file: ctx.file, line, message: `${why}: not in the guides' Markdown subset` });
}

/** Does this line open a block that interrupts a paragraph? */
function interrupts(text) {
  if (ATX.test(text) || FENCE.test(text) || QUOTE.test(text) || HR.test(text) || HTML_BLOCK.test(text)) return true;
  const m = text.match(ITEM);
  if (!m || blank(m[4])) return false;
  return !/^\d/.test(m[2]) || /^1[.)]$/.test(m[2]);
}

function parseBlocks(lines, ctx, depth) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const { text, n } = lines[i];
    if (blank(text)) {
      i++;
      continue;
    }

    // fenced code
    const fm = text.match(FENCE);
    if (fm && !(fm[2][0] === '`' && fm[3].includes('`'))) {
      const [, ind, fence, info] = fm;
      const close = new RegExp(`^ {0,3}${fence[0] === '`' ? '`' : '~'}{${fence.length},}[ \\t]*$`);
      const body = [];
      let j = i + 1;
      while (j < lines.length && !close.test(lines[j].text)) {
        body.push(lines[j].text.replace(new RegExp(`^ {0,${ind.length}}`), ''));
        j++;
      }
      if (j >= lines.length) {
        ctx.errors.push({ file: ctx.file, line: n, message: 'a code fence that is never closed' });
        i = j;
        continue;
      }
      out.push({ type: 'code', lang: info.trim().split(/\s+/)[0] || '', text: body.join('\n'), line: n });
      i = j + 1;
      continue;
    }

    // indented code
    if (indentOf(text) >= 4) {
      let j = i;
      while (j < lines.length && (indentOf(lines[j].text) >= 4 || blank(lines[j].text))) j++;
      unsupported(ctx, out, lines.slice(i, j), 'an indented code block (use a fenced one)');
      i = j;
      continue;
    }

    // headings
    const hm = text.match(ATX);
    if (hm) {
      const level = hm[1].length;
      const raw = hm[2].replace(/[ \t]+#+[ \t]*$/, '').replace(/^[ \t]*#+[ \t]*$/, '').trim();
      i++;
      if (depth > 0) {
        unsupported(ctx, out, [{ text, n }], 'a heading inside a list or a quote');
        continue;
      }
      if (level === 1) {
        if (ctx.title !== null) {
          unsupported(ctx, out, [{ text, n }], 'a second level-1 heading (a guide has one title)');
          continue;
        }
        ctx.title = raw;
        ctx.titleLine = n;
      }
      out.push({ type: 'heading', level, inlines: parseInline(raw, ctx, n), line: n });
      continue;
    }

    // a rule
    if (HR.test(text)) {
      out.push({ type: 'hr', line: n });
      i++;
      continue;
    }

    // raw HTML, link definitions, footnotes
    if (HTML_BLOCK.test(text) && !/^ {0,3}<[a-z][a-z0-9+.-]*:/i.test(text)) {
      let j = i;
      while (j < lines.length && !blank(lines[j].text)) j++;
      unsupported(ctx, out, lines.slice(i, j), 'raw HTML');
      i = j;
      continue;
    }
    if (DEFINITION.test(text)) {
      unsupported(ctx, out, [lines[i]], /^ {0,3}\[\^/.test(text) ? 'a footnote' : 'a link reference definition');
      i++;
      continue;
    }

    // tables
    if (text.includes('|') && i + 1 < lines.length && lines[i + 1].text.includes('|') && DELIM_ROW.test(lines[i + 1].text)) {
      const head = splitRow(text);
      const delims = splitRow(lines[i + 1].text);
      if (head.length === delims.length) {
        const align = delims.map((d) => (d.startsWith(':') && d.endsWith(':') ? 'center' : d.endsWith(':') ? 'right' : d.startsWith(':') ? 'left' : null));
        const rows = [];
        let j = i + 2;
        while (j < lines.length && !blank(lines[j].text) && lines[j].text.includes('|') && !interrupts(lines[j].text)) {
          const cells = splitRow(lines[j].text);
          const row = head.map((_, k) => parseInline(cells[k] ?? '', ctx, lines[j].n));
          if (cells.length > head.length) ctx.errors.push({ file: ctx.file, line: lines[j].n, message: `a table row with ${cells.length} cells under ${head.length} headings` });
          rows.push(row);
          j++;
        }
        out.push({ type: 'table', align, head: head.map((c) => parseInline(c, ctx, n)), rows, line: n });
        i = j;
        continue;
      }
    }

    // blockquotes and alerts
    if (QUOTE.test(text)) {
      const inner = [];
      let j = i;
      while (j < lines.length) {
        const t = lines[j].text;
        if (QUOTE.test(t)) inner.push({ text: t.replace(/^ {0,3}> ?/, ''), n: lines[j].n });
        else if (!blank(t) && inner.length && !blank(inner[inner.length - 1].text) && !interrupts(t)) inner.push({ text: t, n: lines[j].n });
        else break;
        j++;
      }
      const first = inner.findIndex((l) => !blank(l.text));
      const am = first >= 0 ? inner[first].text.trim().match(ALERT) : null;
      if (am) out.push({ type: 'alert', kind: am[1].toUpperCase(), blocks: parseBlocks(inner.slice(first + 1), ctx, depth + 1), line: n });
      else out.push({ type: 'quote', blocks: parseBlocks(inner, ctx, depth + 1), line: n });
      i = j;
      continue;
    }

    // lists
    const im = text.match(ITEM);
    if (im) {
      const [list, j] = parseList(lines, i, ctx, depth);
      out.push(list);
      i = j;
      continue;
    }

    // a paragraph (or an image alone on its line)
    const para = [lines[i]];
    let j = i + 1;
    while (j < lines.length && !blank(lines[j].text) && !interrupts(lines[j].text) && !SETEXT.test(lines[j].text)) para.push(lines[j++]);
    if (j < lines.length && SETEXT.test(lines[j].text) && !blank(lines[j].text)) {
      unsupported(ctx, out, [...para, lines[j]], 'a heading underlined with = or - (use #)');
      i = j + 1;
      continue;
    }
    i = j;
    for (const [k, l] of para.entries()) {
      if (k < para.length - 1 && (/ {2,}$/.test(l.text) || /(?<!\\)(?:\\\\)*\\$/.test(l.text))) ctx.errors.push({ file: ctx.file, line: l.n, message: 'a hard line break (two spaces or \\ at the end of a line): not in the guides\' Markdown subset' });
    }
    const joined = para.map((l) => l.text.trim()).join('\n');
    const img = para.length === 1 && joined.match(/^!\[((?:\\.|[^\]\\])*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)$/);
    if (img) {
      out.push({ type: 'image', alt: img[1].replace(/\\(.)/g, '$1').trim(), src: img[2], line: n });
      continue;
    }
    out.push({ type: 'para', inlines: parseInline(joined, ctx, n), line: n });
  }
  return out;
}

/** A list starting at lines[i]; returns [list, next index]. */
function parseList(lines, i, ctx, depth) {
  const first = lines[i].text.match(ITEM);
  const ordered = /^\d/.test(first[2]);
  const kind = ordered ? first[2].slice(-1) : first[2];
  const list = { type: 'list', ordered, start: ordered ? Number(first[2].slice(0, -1)) : 1, loose: false, items: [], line: lines[i].n };
  let j = i;
  while (j < lines.length) {
    const m = lines[j].text.match(ITEM);
    if (!m || (ordered ? !/^\d/.test(m[2]) || m[2].slice(-1) !== kind : m[2] !== kind) || HR.test(lines[j].text)) break;
    const markerEnd = m[1].length + m[2].length;
    const pad = blank(m[4]) ? 1 : m[3].length > 4 ? 1 : m[3].length;
    const col = markerEnd + pad;
    const body = [{ text: blank(m[4]) ? '' : ' '.repeat(Math.max(0, m[3].length - pad)) + m[4], n: lines[j].n }];
    let k = j + 1;
    while (k < lines.length) {
      const t = lines[k].text;
      if (blank(t)) {
        body.push({ text: '', n: lines[k].n });
        k++;
        continue;
      }
      if (indentOf(t) >= col) {
        body.push({ text: t.slice(col), n: lines[k].n });
        k++;
        continue;
      }
      const prev = body[body.length - 1];
      if (!blank(prev.text) && !interrupts(t) && !ITEM.test(t)) {
        body.push({ text: t.trim(), n: lines[k].n }); // lazy continuation of a paragraph
        k++;
        continue;
      }
      break;
    }
    // trailing blank lines belong between items, not inside this one
    let end = body.length;
    while (end > 1 && blank(body[end - 1].text)) end--;
    const inside = body.slice(0, end);
    const gapAfter = body.length > end;
    const item = { blocks: [], line: lines[j].n };
    const task = inside[0].text.match(/^\[[ xX]\]\s/);
    if (task) {
      unsupported(ctx, item.blocks, [inside[0]], 'a task-list checkbox');
      inside[0] = { ...inside[0], text: inside[0].text.slice(task[0].length) };
    }
    item.blocks.push(...parseBlocks(inside, ctx, depth + 1));
    // loose: a blank line between two blocks of the item, or between items
    for (let x = 1; x < inside.length - 1; x++) {
      if (blank(inside[x].text) && !blank(inside[x - 1].text) && !inBlockGap(item.blocks, inside[x].n)) list.loose = true;
    }
    list.items.push(item);
    j = k;
    if (gapAfter && j < lines.length) {
      const next = lines[j].text.match(ITEM);
      if (next && (ordered ? /^\d/.test(next[2]) && next[2].slice(-1) === kind : next[2] === kind)) list.loose = true;
    }
  }
  return [list, j];
}

/** Is line n inside a nested list or code block of these blocks (so its blank line doesn't loosen this list)? */
function inBlockGap(blocks, n) {
  for (let b = 0; b < blocks.length; b++) {
    const start = blocks[b].line;
    const next = b + 1 < blocks.length ? blocks[b + 1].line : Infinity;
    if (n > start && n < next && ['list', 'code', 'quote', 'alert'].includes(blocks[b].type)) return true;
  }
  return false;
}

/** The cells of a table row; `\|` is a pipe inside a cell, and so is one inside a code span. */
function splitRow(text) {
  let s = text.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells = [];
  let cur = '';
  let tick = 0;
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    if (c === '\\' && s[k + 1] === '|') {
      cur += tick ? '\\|' : '|';
      k++;
      continue;
    }
    if (c === '`') {
      let run = 1;
      while (s[k + run] === '`') run++;
      if (!tick) tick = run;
      else if (tick === run) tick = 0;
      cur += '`'.repeat(run);
      k += run - 1;
      continue;
    }
    if (c === '|' && !tick) {
      cells.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  cells.push(cur.trim());
  return cells;
}

// ── inline ──────────────────────────────────────────────────────────────────────────────

/** Parse inline markdown; `line0` is the line `text` starts on (it may hold \n). */
export function parseInline(text, ctx, line0 = 1) {
  const lineAt = (pos) => line0 + (text.slice(0, pos).match(/\n/g) || []).length;
  const err = (pos, why) => {
    if (ctx.escape) ctx.escaped.push({ file: ctx.file, line: lineAt(pos), message: why });
    else ctx.errors.push({ file: ctx.file, line: lineAt(pos), message: `${why}: not in the guides' Markdown subset` });
  };
  return inline(text, 0, text.length, { ctx, err, lineAt, text });
}

function inline(src, from, to, st) {
  const out = [];
  let buf = '';
  const flush = () => {
    if (buf) out.push({ type: 'text', text: buf });
    buf = '';
  };
  let i = from;
  while (i < to) {
    const c = src[i];

    // escapes
    if (c === '\\' && i + 1 < to && PUNCT.test(src[i + 1])) {
      buf += src[i + 1];
      i += 2;
      continue;
    }

    // code spans
    if (c === '`') {
      let run = 1;
      while (src[i + run] === '`') run++;
      const close = findTicks(src, i + run, to, run);
      if (close < 0) {
        buf += '`'.repeat(run);
        i += run;
        continue;
      }
      flush();
      let code = src.slice(i + run, close).replace(/\n/g, ' ');
      if (code.length > 1 && code.startsWith(' ') && code.endsWith(' ') && code.trim()) code = code.slice(1, -1);
      out.push({ type: 'code', text: code });
      i = close + run;
      continue;
    }

    // images: only alone on their line, which the block parser takes first
    if (c === '!' && src[i + 1] === '[') {
      const l = link(src, i + 1, to);
      if (l) {
        st.err(i, 'an image inside a line of text (put each image alone on its line)');
        buf += src.slice(i, l.end);
        i = l.end;
        continue;
      }
    }

    // links
    if (c === '[') {
      if (src[i + 1] === '^') {
        const e = src.indexOf(']', i);
        if (e > 0 && e < to) {
          st.err(i, 'a footnote');
          buf += src.slice(i, e + 1);
          i = e + 1;
          continue;
        }
      }
      const l = link(src, i, to);
      if (l) {
        flush();
        out.push({ type: 'link', href: l.href, children: inline(src, i + 1, l.labelEnd, st), line: st.lineAt(i) });
        i = l.end;
        continue;
      }
      const e = matchBracket(src, i, to);
      if (e > 0 && src[e + 1] === '[') {
        st.err(i, 'a reference-style link');
        const e2 = src.indexOf(']', e + 1);
        buf += src.slice(i, e2 > 0 ? e2 + 1 : e + 1);
        i = e2 > 0 ? e2 + 1 : e + 1;
        continue;
      }
    }

    // autolinks and raw HTML
    if (c === '<') {
      const rest = src.slice(i, to);
      const auto = rest.match(/^<([a-z][a-z0-9+.-]{1,31}:[^\s<>]*)>/i);
      if (auto) {
        flush();
        out.push({ type: 'link', href: auto[1], children: [{ type: 'text', text: auto[1] }], line: st.lineAt(i) });
        i += auto[0].length;
        continue;
      }
      const mail = rest.match(/^<([^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)>/);
      if (mail) {
        flush();
        out.push({ type: 'link', href: `mailto:${mail[1]}`, children: [{ type: 'text', text: mail[1] }], line: st.lineAt(i) });
        i += mail[0].length;
        continue;
      }
      const tag = rest.match(/^<(?:!--[\s\S]*?-->|\/?[A-Za-z][\w-]*(?:\s[^<>]*)?\/?>)/);
      if (tag) {
        st.err(i, tag[0].startsWith('<!--') ? 'an HTML comment' : 'raw HTML');
        buf += tag[0];
        i += tag[0].length;
        continue;
      }
    }

    // bare web addresses (GitHub links them)
    // A scheme with nothing after it ("the https:// address") stays text.
    const bare = (c === 'h' || c === 'H') && (i === 0 || /[\s(*_~]/.test(src[i - 1])) ? src.slice(i, to).match(/^https?:\/\/[^\s<]+/i) : null;
    if (bare) {
      let m = trimUrl(bare[0]);
      flush();
      out.push({ type: 'link', href: m, children: [{ type: 'text', text: m }], line: st.lineAt(i) });
      i += m.length;
      continue;
    }

    // strikethrough
    if (c === '~' && src[i + 1] === '~') {
      const close = src.indexOf('~~', i + 2);
      if (close > 0 && close < to) {
        st.err(i, 'strikethrough');
        buf += src.slice(i, close + 2);
        i = close + 2;
        continue;
      }
    }

    // emphasis
    if (c === '*' || c === '_') {
      let run = 1;
      while (src[i + run] === c) run++;
      const before = src[i - 1];
      const after = src[i + run];
      const opens = !isSpace(after) && (!isPunct(after) || isSpace(before) || isPunct(before)) && (c === '*' || !/[\p{L}\p{N}]/u.test(before ?? ''));
      if (opens) {
        const tries = run >= 3 ? [3, 2, 1] : run === 2 ? [2, 1] : [1];
        let done = false;
        for (const len of tries) {
          const close = findCloser(src, i + len, to, c, len);
          if (close < 0) continue;
          flush();
          const kids = inline(src, i + len, close, st);
          if (len === 3) out.push({ type: 'strong', children: [{ type: 'em', children: kids }] });
          else out.push({ type: len === 2 ? 'strong' : 'em', children: kids });
          i = close + len;
          done = true;
          break;
        }
        if (done) continue;
      }
      buf += c.repeat(run);
      i += run;
      continue;
    }

    buf += c;
    i++;
  }
  flush();
  return out;
}

function trimUrl(u) {
  for (;;) {
    const last = u[u.length - 1];
    if (/[.,:;!?'"*_~]/.test(last)) u = u.slice(0, -1);
    else if (last === ')' && (u.match(/\(/g) || []).length < (u.match(/\)/g) || []).length) u = u.slice(0, -1);
    else return u;
  }
}

function findTicks(src, from, to, run) {
  let k = from;
  while (k < to) {
    if (src[k] === '`') {
      let r = 1;
      while (src[k + r] === '`') r++;
      if (r === run) return k;
      k += r;
    } else k++;
  }
  return -1;
}

/** The `]` matching the `[` at i, skipping escapes and code spans; -1 if none. */
function matchBracket(src, i, to) {
  let depth = 0;
  for (let k = i; k < to; k++) {
    const c = src[k];
    if (c === '\\') {
      k++;
      continue;
    }
    if (c === '`') {
      let r = 1;
      while (src[k + r] === '`') r++;
      const e = findTicks(src, k + r, to, r);
      if (e > 0) {
        k = e + r - 1;
        continue;
      }
      k += r - 1;
      continue;
    }
    if (c === '[') depth++;
    else if (c === ']' && --depth === 0) return k;
  }
  return -1;
}

/** An inline link [label](href "title") at i; null if there is none. */
function link(src, i, to) {
  const e = matchBracket(src, i, to);
  if (e < 0 || src[e + 1] !== '(') return null;
  let k = e + 2;
  while (src[k] === ' ') k++;
  let href = '';
  if (src[k] === '<') {
    const close = src.indexOf('>', k);
    if (close < 0 || close > to) return null;
    href = src.slice(k + 1, close);
    k = close + 1;
  } else {
    let depth = 0;
    while (k < to && !/\s/.test(src[k])) {
      if (src[k] === '\\' && PUNCT.test(src[k + 1] ?? '')) {
        href += src[k + 1];
        k += 2;
        continue;
      }
      if (src[k] === '(') depth++;
      if (src[k] === ')') {
        if (depth === 0) break;
        depth--;
      }
      href += src[k++];
    }
  }
  while (/\s/.test(src[k] ?? '')) k++;
  if (src[k] === '"' || src[k] === "'") {
    const q = src[k];
    const close = src.indexOf(q, k + 1);
    if (close < 0) return null;
    k = close + 1;
    while (/\s/.test(src[k] ?? '')) k++;
  }
  if (src[k] !== ')') return null;
  return { href, labelEnd: e, end: k + 1 };
}

/** The closing run of exactly `len` × c for an emphasis opened before `from`; -1 if none. */
function findCloser(src, from, to, c, len) {
  let k = from;
  while (k < to) {
    const ch = src[k];
    if (ch === '\\') {
      k += 2;
      continue;
    }
    if (ch === '`') {
      let r = 1;
      while (src[k + r] === '`') r++;
      const e = findTicks(src, k + r, to, r);
      k = e > 0 ? e + r : k + r;
      continue;
    }
    if (ch === '[') {
      const l = link(src, k, to);
      if (l) {
        k = l.end;
        continue;
      }
    }
    if (ch === c) {
      let r = 1;
      while (src[k + r] === c) r++;
      const before = src[k - 1];
      const after = src[k + r];
      const closes = k > from && !isSpace(before) && (!isPunct(before) || isSpace(after) || isPunct(after)) && (c === '*' || !/[\p{L}\p{N}]/u.test(after ?? ''));
      if (closes && (r === len || (len === 1 && r === 3) || (len === 2 && r === 3))) return r === len ? k : len === 1 ? k + 2 : k + 1;
      k += r;
      continue;
    }
    k++;
  }
  return -1;
}
