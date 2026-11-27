/* inventory-core.js — platform-audit's bundle reader (PLAN §2.6).
 *
 * A classic script: no import or export, no eval, no Function, nothing Node-specific. It reads a web
 * app's JavaScript and JSON as TEXT, never runs it, and sets
 *
 *     globalThis.AuditInventory = { build(files, opts) }      files: [{ name, text, sha256? }]
 *
 * build() returns the inventory (inventory.json's shape, PLAN §2.6). inventory.mjs loads this file in
 * Node; when a download is refused, the skill pastes it into the page and runs it on the copy the
 * browser already has (PLAN D6).
 *
 * How it reads: a small tolerant scanner finds every string, template literal, regex literal and
 * comment, and makes a "clean" copy of the text with the comments and regex bodies blanked (same
 * length, so positions agree). Everything else is pattern matching over the clean text, plus a
 * tolerant object-literal reader that rebuilds JS literals without running them.
 */
(function () {
  'use strict';

  const VERSION = 1;

  // ───────────────────────────── scanning ─────────────────────────────

  const REGEX_AFTER = new Set('(,=:[!&|?{};+-*%<>~^'.split(''));
  const REGEX_AFTER_WORDS = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
    'throw', 'case', 'do', 'else', 'yield', 'await']);

  function isWordCode(c) {
    return (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 36 || c >= 128;
  }

  /** Index just past the quoted string that starts at i (stops at a newline if unterminated). */
  function skipQuoted(t, i) {
    const q = t[i];
    const n = t.length;
    let j = i + 1;
    while (j < n) {
      const c = t[j];
      if (c === '\\') j += 2;
      else if (c === q) return j + 1;
      else if (c === '\n') return j;
      else j++;
    }
    return n;
  }

  /** Scans template text from j: { closed, i } — i is past the closing backtick, or past `${`. */
  function scanTemplate(t, j) {
    const n = t.length;
    while (j < n) {
      const c = t[j];
      if (c === '\\') j += 2;
      else if (c === '`') return { closed: true, i: j + 1 };
      else if (c === '$' && t[j + 1] === '{') return { closed: false, i: j + 2 };
      else j++;
    }
    return { closed: true, i: n };
  }

  /** Index just past the template literal starting at i, expressions included. For clean text. */
  function skipTemplate(t, i) {
    let j = i + 1;
    for (;;) {
      const r = scanTemplate(t, j);
      if (r.closed) return r.i;
      j = skipCode(t, r.i);
      if (j >= t.length) return t.length;
    }
  }

  /** From inside a `${`, the index just past its closing brace. For clean text. */
  function skipCode(t, j) {
    const n = t.length;
    let depth = 0;
    while (j < n) {
      const c = t[j];
      if (c === '"' || c === "'") { j = skipQuoted(t, j); continue; }
      if (c === '`') { j = skipTemplate(t, j); continue; }
      if (c === '{') depth++;
      else if (c === '}') { if (depth === 0) return j + 1; depth--; }
      j++;
    }
    return n;
  }

  /** A regex literal starting at i: the index of its closing slash, or -1 if it isn't one. */
  function regexClose(t, i) {
    const n = t.length;
    let j = i + 1;
    let inClass = false;
    if (t[j] === '/' || t[j] === '*') return -1;
    while (j < n) {
      const c = t[j];
      if (c === '\\') { j += 2; continue; }
      if (c === '\n' || c === '\r') return -1;
      if (c === '[') inClass = true;
      else if (c === ']') inClass = false;
      else if (c === '/' && !inClass) return j;
      j++;
    }
    return -1;
  }

  /**
   * Scans JavaScript text. Returns { clean, quoted, templates }: clean is the text with comments and
   * regex bodies blanked (newlines kept); quoted and templates list the string literals as {s, e}
   * (e exclusive), sorted by s.
   */
  function scan(text) {
    const n = text.length;
    const blanks = [];
    const quoted = [];
    const templates = [];
    const frames = [];
    let depth = 0;
    let prev = '';
    let prevWord = '';
    let i = 0;
    if (text.startsWith('#!')) { const k = text.indexOf('\n'); i = k < 0 ? n : k; blanks.push([0, i]); }
    while (i < n) {
      const ch = text[i];
      const code = text.charCodeAt(i);
      if (ch === '"' || ch === "'") {
        const j = skipQuoted(text, i);
        quoted.push({ s: i, e: j });
        i = j; prev = 'v'; continue;
      }
      if (ch === '`') {
        const r = scanTemplate(text, i + 1);
        if (r.closed) { templates.push({ s: i, e: r.i }); prev = 'v'; }
        else { depth++; frames.push({ s: i, depth }); prev = '{'; }
        i = r.i; continue;
      }
      if (ch === '/') {
        const nx = text[i + 1];
        if (nx === '/') { let j = text.indexOf('\n', i); if (j < 0) j = n; blanks.push([i, j]); i = j; continue; }
        if (nx === '*') { let j = text.indexOf('*/', i + 2); j = j < 0 ? n : j + 2; blanks.push([i, j]); i = j; continue; }
        const allowed = prev === '' || REGEX_AFTER.has(prev) || prev === '}' || (prev === 'w' && REGEX_AFTER_WORDS.has(prevWord));
        if (allowed) {
          const close = regexClose(text, i);
          if (close > 0) {
            blanks.push([i + 1, close]);
            let j = close + 1;
            while (j < n && /[a-z]/.test(text[j])) j++;
            i = j; prev = 'v'; continue;
          }
        }
        prev = '/'; i++; continue;
      }
      if (ch === '{') { depth++; prev = '{'; i++; continue; }
      if (ch === '}') {
        const top = frames[frames.length - 1];
        if (top && top.depth === depth) {
          const r = scanTemplate(text, i + 1);
          if (r.closed) { depth--; frames.pop(); templates.push({ s: top.s, e: r.i }); prev = 'v'; }
          else prev = '{';
          i = r.i; continue;
        }
        depth--; prev = '}'; i++; continue;
      }
      if (isWordCode(code)) {
        let j = i + 1;
        while (j < n && isWordCode(text.charCodeAt(j))) j++;
        prevWord = text.slice(i, j); prev = 'w'; i = j; continue;
      }
      if (ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r') { i++; continue; }
      prev = ch; i++;
    }
    while (frames.length) templates.push({ s: frames.pop().s, e: n });
    templates.sort((a, b) => a.s - b.s);
    return { clean: blank(text, blanks), quoted, templates };
  }

  function blank(text, ranges) {
    if (!ranges.length) return text;
    const out = [];
    let at = 0;
    for (const [s, e] of ranges) {
      if (s < at) continue;
      out.push(text.slice(at, s), text.slice(s, e).replace(/[^\n]/g, ' '));
      at = e;
    }
    out.push(text.slice(at));
    return out.join('');
  }

  /** Decodes the body of a JS string literal (without its quotes). */
  function decodeJs(raw) {
    if (raw.indexOf('\\') < 0) return raw;
    let out = '';
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i];
      if (c !== '\\') { out += c; continue; }
      const d = raw[++i];
      switch (d) {
        case 'n': out += '\n'; break;
        case 'r': out += '\r'; break;
        case 't': out += '\t'; break;
        case 'b': out += '\b'; break;
        case 'f': out += '\f'; break;
        case 'v': out += '\v'; break;
        case '0': out += '\0'; break;
        case '\n': break;
        case '\r': if (raw[i + 1] === '\n') i++; break;
        case 'x': { const h = raw.slice(i + 1, i + 3); if (/^[0-9a-fA-F]{2}$/.test(h)) { out += String.fromCharCode(parseInt(h, 16)); i += 2; } else out += 'x'; break; }
        case 'u': {
          if (raw[i + 1] === '{') {
            const k = raw.indexOf('}', i);
            const h = raw.slice(i + 2, k);
            if (k > 0 && /^[0-9a-fA-F]{1,6}$/.test(h)) { out += String.fromCodePoint(parseInt(h, 16)); i = k; } else out += 'u';
          } else {
            const h = raw.slice(i + 1, i + 5);
            if (/^[0-9a-fA-F]{4}$/.test(h)) { out += String.fromCharCode(parseInt(h, 16)); i += 4; } else out += 'u';
          }
          break;
        }
        default: if (d !== undefined) out += d;
      }
    }
    return out;
  }

  // ─────────────────────────── the bracket tree ───────────────────────────

  /** Every bracket of the clean text, outside strings: start, end, parent and kind. */
  function buildTree(clean) {
    const S = [];
    const E = [];
    const P = [];
    const K = [];
    const stack = [];
    const n = clean.length;
    for (let i = 0; i < n; i++) {
      const c = clean[i];
      if (c === '"' || c === "'") { i = skipQuoted(clean, i) - 1; continue; }
      if (c === '`') { i = skipTemplate(clean, i) - 1; continue; }
      if (c === '{' || c === '[' || c === '(') {
        S.push(i); E.push(n); P.push(stack.length ? stack[stack.length - 1] : -1); K.push(c);
        stack.push(S.length - 1);
      } else if (c === '}' || c === ']' || c === ')') {
        if (stack.length) E[stack.pop()] = i;
      }
    }
    return { S, E, P, K };
  }

  /** The innermost bracket that contains position p, or -1. */
  function enclosing(tree, p) {
    const S = tree.S;
    let lo = 0;
    let hi = S.length - 1;
    let b = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (S[mid] < p) { b = mid; lo = mid + 1; } else hi = mid - 1;
    }
    while (b >= 0 && tree.E[b] < p) b = tree.P[b];
    return b;
  }

  /** Index of the bracket matching the one at i, or -1. Works on clean text. */
  function matchBracket(t, i, maxLen) {
    const n = Math.min(t.length, maxLen ? i + maxLen : t.length);
    let depth = 0;
    for (let j = i; j < n; j++) {
      const c = t[j];
      if (c === '"' || c === "'") { j = skipQuoted(t, j) - 1; continue; }
      if (c === '`') { j = skipTemplate(t, j) - 1; continue; }
      if (c === '{' || c === '[' || c === '(') depth++;
      else if (c === '}' || c === ']' || c === ')') { depth--; if (depth === 0) return j; }
    }
    return -1;
  }

  // ─────────────────────── the tolerant literal reader ───────────────────────

  function skipWs(t, i) {
    while (i < t.length) {
      const c = t[i];
      if (c === ' ' || c === '\n' || c === '\t' || c === '\r') i++;
      else break;
    }
    return i;
  }

  /** Skips one expression: to the next , ; or unmatched closer at depth 0. */
  function skipExpr(t, i) {
    const n = t.length;
    let depth = 0;
    let j = i;
    while (j < n) {
      const c = t[j];
      if (c === '"' || c === "'") { j = skipQuoted(t, j); continue; }
      if (c === '`') { j = skipTemplate(t, j); continue; }
      if (c === '{' || c === '[' || c === '(') depth++;
      else if (c === '}' || c === ']' || c === ')') { if (depth === 0) return j; depth--; }
      else if ((c === ',' || c === ';') && depth === 0) return j;
      j++;
    }
    return n;
  }

  const NUM_RE = /-?(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d+)?)/y;
  const PATH_RE = /[A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*/y;

  function parseNum(s) {
    s = s.replace(/_/g, '');
    const neg = s[0] === '-';
    if (neg) s = s.slice(1);
    let v;
    if (/^0[xX]/.test(s)) v = parseInt(s.slice(2), 16);
    else if (/^0[bB]/.test(s)) v = parseInt(s.slice(2), 2);
    else if (/^0[oO]/.test(s)) v = parseInt(s.slice(2), 8);
    else v = Number(s);
    return neg ? -v : v;
  }

  /**
   * Reads the JS literal at i without running anything: { value, end }. Objects, arrays, strings,
   * numbers, true/false/null (and the minified !0 / !1) are rebuilt; an identifier becomes
   * { $ref: 'a.b' }, a template with expressions { $template: raw }, anything else { $expr: raw }.
   */
  function readLiteral(t, i, depth) {
    depth = depth || 0;
    i = skipWs(t, i);
    const c = t[i];
    if (depth > 60) { const e = skipExpr(t, i); return { value: { $expr: '…' }, end: e }; }
    if (c === '{') return readObject(t, i, depth);
    if (c === '[') return readArray(t, i, depth);
    if (c === '"' || c === "'") { const j = skipQuoted(t, i); return after(t, i, j, decodeJs(t.slice(i + 1, j - 1))); }
    if (c === '`') {
      const j = skipTemplate(t, i);
      const raw = t.slice(i + 1, j - 1);
      return after(t, i, j, raw.indexOf('${') >= 0 ? { $template: raw } : decodeJs(raw));
    }
    if (c === '!' && (t[i + 1] === '0' || t[i + 1] === '1') && !isWordCode(t.charCodeAt(i + 2))) return after(t, i, i + 2, t[i + 1] === '0');
    NUM_RE.lastIndex = i;
    const nm = NUM_RE.exec(t);
    if (nm && nm[0] !== '-' && !isWordCode(t.charCodeAt(i + nm[0].length))) return after(t, i, i + nm[0].length, parseNum(nm[0]));
    PATH_RE.lastIndex = i;
    const pm = PATH_RE.exec(t);
    if (pm) {
      const w = pm[0].replace(/\s+/g, '');
      const j = i + pm[0].length;
      if (w === 'true') return after(t, i, j, true);
      if (w === 'false') return after(t, i, j, false);
      if (w === 'null' || w === 'undefined') return after(t, i, j, null);
      if (w !== 'void' && w !== 'new' && w !== 'function' && w !== 'async' && w !== 'typeof') return after(t, i, j, { $ref: w });
    }
    const e = skipExpr(t, i);
    return { value: { $expr: t.slice(i, e).trim() }, end: e };
  }

  /** A value followed by more expression (an operator, a call) is an expression. */
  function after(t, start, j, value) {
    const k = skipWs(t, j);
    const nc = t[k];
    if (k >= t.length || nc === ',' || nc === '}' || nc === ']' || nc === ')' || nc === ';' || nc === ':') return { value, end: j };
    const e = skipExpr(t, start);
    return { value: { $expr: t.slice(start, e).trim() }, end: e };
  }

  function readObject(t, i, depth) {
    const obj = {};
    const n = t.length;
    let j = i + 1;
    while (j < n) {
      j = skipWs(t, j);
      const c = t[j];
      if (c === '}') return { value: obj, end: j + 1 };
      if (c === ',') { j++; continue; }
      if (c === ')' || c === ']' || c === ';') return { value: obj, end: j };
      if (t.startsWith('...', j)) { j = skipExpr(t, j + 3); continue; }
      let key = null;
      let k = j;
      if (c === '"' || c === "'") { k = skipQuoted(t, j); key = decodeJs(t.slice(j + 1, k - 1)); }
      else if (c === '[') { const m = matchBracket(t, j); if (m < 0) return { value: obj, end: n }; k = m + 1; key = '[computed]'; }
      else if (isWordCode(t.charCodeAt(j))) {
        while (k < n && isWordCode(t.charCodeAt(k))) k++;
        key = t.slice(j, k);
        const k2 = skipWs(t, k);
        if ((key === 'get' || key === 'set' || key === 'async' || key === 'static') && isWordCode(t.charCodeAt(k2))) {
          j = skipMember(t, k2); continue;
        }
      } else { const e = skipExpr(t, j); j = e > j ? e : j + 1; continue; }
      k = skipWs(t, k);
      const d = t[k];
      if (d === ':') {
        const r = readLiteral(t, k + 1, depth + 1);
        if (key !== '__proto__') obj[key] = r.value;
        j = r.end;
      } else if (d === '(') {
        j = skipMember(t, j);
        if (key !== '__proto__') obj[key] = { $expr: 'method' };
      } else if (d === ',' || d === '}') {
        if (key !== '__proto__') obj[key] = { $ref: key };
        j = k;
      } else { const e = skipExpr(t, k); j = e > k ? e : k + 1; }
    }
    return { value: obj, end: n };
  }

  /** Skips `name(args){body}` (a method or accessor). */
  function skipMember(t, j) {
    while (j < t.length && t[j] !== '(' && t[j] !== ',' && t[j] !== '}') j++;
    if (t[j] !== '(') return j;
    const m = matchBracket(t, j);
    if (m < 0) return t.length;
    let k = skipWs(t, m + 1);
    if (t[k] === '{') { const b = matchBracket(t, k); return b < 0 ? t.length : b + 1; }
    return k;
  }

  function readArray(t, i, depth) {
    const arr = [];
    const n = t.length;
    let j = i + 1;
    while (j < n) {
      j = skipWs(t, j);
      const c = t[j];
      if (c === ']') return { value: arr, end: j + 1 };
      if (c === ',') { j++; continue; }
      if (c === ')' || c === '}' || c === ';') return { value: arr, end: j };
      if (t.startsWith('...', j)) { j = skipExpr(t, j + 3); continue; }
      const r = readLiteral(t, j, depth + 1);
      arr.push(r.value);
      j = r.end > j ? r.end : j + 1;
    }
    return { value: arr, end: n };
  }

  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && !('$ref' in v) && !('$expr' in v) && !('$template' in v);
  const refName = (v) => (v && typeof v === 'object' && typeof v.$ref === 'string' ? v.$ref : null);
  const lastSeg = (s) => s.slice(s.lastIndexOf('.') + 1);

  // ─────────────────────────────── text tests ───────────────────────────────

  const ASSET_EXT = /\.(?:m?js|cjs|ts|css|scss|less|map|png|jpe?g|gif|svg|ico|webp|avif|bmp|woff2?|ttf|otf|eot|json|xml|txt|html?|pdf|csv|xlsx?|zip|gz|mp[34]|webm|ogg|wav|wasm)$/i;
  const NOT_ROUTE_PREFIX = /^\/(?:api|graphql|gql|rest|v\d+|ws|wss|socket(?:\.io)?|sockjs|_next|__|static|assets?|fonts?|images?|img|media|icons?|favicon|public|cdn|dist|build|node_modules|@)(?:[/.?#]|$)/i;
  const MIME_RE = /^(?:application|text|image|audio|video|font|multipart|model|message)\/[\w.+-]+$/i;

  function isDateFormat(s) {
    if (!/^[DdMmYyHhSsAaZzEeoQqWwXxGgKkuT\/\-.:,\s'[\]]+$/.test(s)) return false;
    const groups = s.match(/YYYY|YY|DD|dd|MM|yyyy|yy|HH|hh|mm|ss|Do|MMM|EEE/g);
    return !!groups && groups.length >= 2 && /[\/\-.: ]/.test(s);
  }

  /** Normalises a path: strips query, hash, regex groups and the trailing slash. */
  function normPath(p) {
    p = p.split(/[?#]/)[0];
    p = p.replace(/(:[A-Za-z_$][\w$]*)\((?:[^()]|\([^()]*\))*\)/g, '$1');
    p = p.replace(/\/{2,}/g, '/');
    if (p.length > 1 && p.endsWith('/*')) p = p.slice(0, -2);
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    return p;
  }

  /** Does p read as an app route? Absolute unless `relative`. */
  function routeLike(p, relative) {
    if (typeof p !== 'string') return false;
    if (p.length > 150) return false;
    if (relative) {
      if (p === '') return true;
      if (p === '*' || p === '**' || p.indexOf('*') >= 0) return false;
      return /^[\w\-.:~]+(?:\/[\w\-.:~]+)*\/?$/.test(p) && !ASSET_EXT.test(p) && !MIME_RE.test(p) && !isDateFormat(p);
    }
    if (p[0] !== '/' || p.startsWith('//')) return false;
    if (p.indexOf('*') >= 0) return false;
    if (/[\s\\<>"'`|^{}]/.test(p)) return false;
    if (NOT_ROUTE_PREFIX.test(p)) return false;
    if (ASSET_EXT.test(p)) return false;
    if (MIME_RE.test(p.slice(1))) return false;
    if (isDateFormat(p)) return false;
    if (p !== '/' && !/[A-Za-z]/.test(p)) return false;
    return /^\/[\w\-.:~@%+()[\]/]*$/.test(p);
  }

  /** Does s read as text a person would see? Used for text that has no message id. */
  function readsAsHuman(s) {
    if (typeof s !== 'string') return false;
    s = s.trim();
    if (s.length < 2 || s.length > 400) return false;
    if (!/\p{L}/u.test(s)) return false;
    if (/^(?:[a-z][\w+.-]*:\/\/|data:|blob:|mailto:|javascript:|\/|\.\.?\/|#|\.[A-Za-z])/i.test(s)) return false;
    if (/[{};]/.test(s) && /:/.test(s)) return false;
    if (/^[\w.+-]+\/[\w.+-]+$/.test(s)) return false;
    if (isDateFormat(s)) return false;
    if (/^[\p{Lo}\p{M}\s\p{P}\d]+$/u.test(s)) return true;
    const words = s.split(/\s+/);
    if (words.length === 1) {
      return /^\p{Lu}[\p{Ll}\p{M}]*(?:[-'’][\p{L}\p{M}]+)*[.!?:…]?$/u.test(s) && /\p{Ll}/u.test(s)
        || /^\p{Lu}{2,4}$/u.test(s);
    }
    if (words.every((w) => /^[a-z0-9]+(?:[-_:][a-z0-9]+)+$/.test(w) || /^[a-z]+$/.test(w)) && words.some((w) => /[-_:]/.test(w))) return false;
    if (/^[\p{Lu}\d]/u.test(s)) return true;
    return /[.!?…:]$/.test(s);
  }

  /** A run of more than 24 characters that looks random (a key, token or hash). */
  function isRandomLooking(tok) {
    if (tok.length <= 24) return false;
    if (!/\d/.test(tok) || !/[A-Za-z]/.test(tok)) return false;
    const letters = tok.split(/[^A-Za-z]+/).filter((w) => w.length >= 5 && /^(?:[A-Z]?[a-z]+|[A-Z]+)$/.test(w)).join('').length;
    if (letters / tok.length > 0.55) return false;
    const freq = {};
    for (const ch of tok) freq[ch] = (freq[ch] || 0) + 1;
    let h = 0;
    for (const k in freq) { const p = freq[k] / tok.length; h -= p * Math.log2(p); }
    return h >= 3.2;
  }

  /** Replaces every random-looking run of more than 24 characters with [redacted]. */
  function redactText(s) {
    if (typeof s !== 'string' || s.length <= 24) return s;
    return s.replace(/[A-Za-z0-9+_\-=]{25,}/g, (tok) => (isRandomLooking(tok) ? '[redacted]' : tok));
  }

  const LANGS = new Set(('en de fr es it pt nl sv da no nb nn fi pl cs sk sl hu ro bg el tr ru uk he ar fa hi bn ta te ' +
    'th vi id ms zh ja ko lt lv et hr sr ca eu gl is ga cy mt sq mk bs ka hy az kk uz af sw tl').split(' '));
  const langOf = (k) => { const m = /^([a-z]{2})(?:[-_][A-Za-z]{2,4})?$/.exec(k); return m && LANGS.has(m[1]) ? m[1] : null; };

  /** The namespace of a message id: its prefix, split at `.`, `_` or `/`. */
  function nsOf(id) {
    const m = /^(.+?)[._/]/.exec(id);
    return m ? m[1] : id;
  }

  // ────────────────────────────── per-file context ──────────────────────────────

  function fileCtx(name, text) {
    const sc = scan(text);
    const F = { name, text, clean: sc.clean, quoted: sc.quoted, templates: sc.templates, _tree: null, _gql: null };
    const tMaxE = [];
    let mx = -1;
    for (const t of sc.templates) { mx = Math.max(mx, t.e); tMaxE.push(mx); }
    F.tMaxE = tMaxE;
    F.tree = () => F._tree || (F._tree = buildTree(F.clean));
    return F;
  }

  /** Is position p inside a string or template literal (not at its opening quote)? */
  function inStr(F, p) {
    const q = F.quoted;
    let lo = 0;
    let hi = q.length - 1;
    let b = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (q[mid].s < p) { b = mid; lo = mid + 1; } else hi = mid - 1; }
    if (b >= 0 && p < q[b].e) return true;
    const t = F.templates;
    lo = 0; hi = t.length - 1; b = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (t[mid].s < p) { b = mid; lo = mid + 1; } else hi = mid - 1; }
    return b >= 0 && F.tMaxE[b] > p;
  }

  /** The string literal at p: { text, template, raw, end } or null. Templates keep `${…}` in raw. */
  function strAt(t, p) {
    const c = t[p];
    if (c === '"' || c === "'") { const e = skipQuoted(t, p); return { text: decodeJs(t.slice(p + 1, e - 1)), template: false, raw: t.slice(p + 1, e - 1), end: e }; }
    if (c === '`') {
      const e = skipTemplate(t, p);
      const raw = t.slice(p + 1, e - 1);
      const tpl = raw.indexOf('${') >= 0;
      return { text: tpl ? null : decodeJs(raw), template: tpl, raw, end: e };
    }
    return null;
  }

  /** A template's text with each `${expr}` as `:name` (for paths). A leading `${base}` is dropped. */
  function tplToPath(raw) {
    let out = '';
    let i = 0;
    let first = true;
    while (i < raw.length) {
      const k = raw.indexOf('${', i);
      if (k < 0) { out += raw.slice(i); break; }
      out += raw.slice(i, k);
      const e = skipCode(raw, k + 2);
      const expr = raw.slice(k + 2, e - 1);
      if (first && k === 0 && raw[e] === '/') { /* a base URL */ }
      else {
        const ids = expr.match(/[A-Za-z_$][\w$]*/g);
        out += ':' + (ids ? ids[ids.length - 1] : 'param');
      }
      first = false;
      i = e;
    }
    return decodeJs(out);
  }

  function* matches(re, text) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      yield m;
      if (m[0] === '') re.lastIndex++;
    }
  }

  function collapse(s, max) {
    s = s.replace(/\s+/g, ' ').trim();
    return s.length > max ? s.slice(0, max) + '…' : s;
  }

  // ─────────────────────────────── extractors ───────────────────────────────

  const FRAMEWORKS = {
    react: /\breact(?:-dom)?\.production|\breact\.(?:element|fragment|transitional\.element)\b|__SECRET_INTERNALS|\.jsxs?\b|\bjsxs?\(|\bReact\.createElement\b|\buseState\b/g,
    vue: /__VUE|\bcreateApp\b|(?<![\wɵ$])defineComponent\b|_createElementVNode|_createVNode|__v_isRef|\bVue\.component\b/g,
    angular: /ɵɵ|ɵcmp|ɵfac|@angular\/|\bngOnInit\b|\bNgModule\b/g,
    svelte: /\bsvelte\b|\bSvelteComponent\b/g,
    next: /__NEXT_DATA__|__BUILD_MANIFEST|_next\/static|\bnext\/router\b/g,
    nuxt: /__NUXT__|\$nuxt\b|\/_nuxt\//g,
    mui: /\bMui[A-Z]\w+|@mui\//g,
    'ant-design': /\bant-(?:btn|table|modal|form|select|layout|menu)\b|\bantd\b/g,
    chakra: /\bchakra-[a-z]/g,
    bootstrap: /\bbootstrap\b|\bbtn-primary\b/g,
    'data-grid': /MuiDataGrid|\bag-grid\b|\bagGrid\b|\bag-theme-|\buseReactTable\b|\breact-table\b|\bgetCoreRowModel\b/g,
    apollo: /\bApolloClient\b|__APOLLO_|\bApolloProvider\b|\bInMemoryCache\b/g,
    urql: /\burql\b|\bcacheExchange\b|\bfetchExchange\b/g,
    relay: /\bRelayModernEnvironment\b|\brelay-runtime\b|\bRelayEnvironmentProvider\b/g,
    formatjs: /\bdefaultMessage\b|\bformatMessage\b|\bIntlProvider\b|\bFormattedMessage\b/g,
    i18next: /\bi18next\b|\buseTranslation\b|\binitReactI18next\b/g,
    'vue-i18n': /\bvue-i18n\b|\bcreateI18n\b|\.\$t\(\s*["'`]/g,
    'react-router': /\breact-router\b|\bcreateBrowserRouter\b|\buseNavigate\b|\bRouterProvider\b|\bBrowserRouter\b/g,
    'vue-router': /\bvue-router\b|\bcreateRouter\b|\bcreateWebHistory\b|\bcreateWebHashHistory\b/g,
    'angular-router': /\bRouterModule\b|\bloadChildren\b|\brouterLink\b/g,
    keycloak: /\b[kK]eycloak\b|\brealm_access\b|\bresource_access\b/g,
    oidc: /\boidc\b|\bOidc[A-Z]\w*|\bopenid\b/g,
    msal: /\bmsal\b|\bPublicClientApplication\b/gi,
    auth0: /\bauth0\b|\bAuth0Provider\b/gi,
  };

  function findFrameworks(F, acc) {
    for (const name in FRAMEWORKS) {
      let n = 0;
      for (const _ of matches(FRAMEWORKS[name], F.text)) { if (++n >= 9999) break; }
      if (n) acc.frameworks[name] = (acc.frameworks[name] || 0) + n;
    }
  }

  /** Every `key: "string"` property outside strings: { key, pos, vpos, s }. */
  function findProps(F) {
    const re = /(?<![\w$.])(?:"((?:[^"\\\n]|\\.){1,80})"|'((?:[^'\\\n]|\\.){1,80})'|([A-Za-z_$][\w$]*))\s*:\s*(?=["'`])/g;
    const out = [];
    for (const m of matches(re, F.clean)) {
      if (inStr(F, m.index)) continue;
      const vpos = m.index + m[0].length;
      const s = strAt(F.clean, vpos);
      if (!s) continue;
      const key = m[3] !== undefined ? m[3] : decodeJs(m[1] !== undefined ? m[1] : m[2]);
      out.push({ key, pos: m.index, vpos, s });
      re.lastIndex = s.end;
    }
    return out;
  }

  function addRoute(acc, F, path, kind, key) {
    path = normPath(path);
    if (!routeLike(path)) return;
    let r = acc.routes.get(path);
    if (!r) { r = { path, kinds: new Set(), keys: new Set(), files: new Set() }; acc.routes.set(path, r); }
    r.kinds.add(kind);
    if (key) r.keys.add(key);
    r.files.add(F.name);
  }

  const ROUTE_OBJ_KEYS = /(?:^|[{,\s])["']?(?:component|element|children|loadChildren|loadComponent|redirectTo|Component|lazy|name|meta|components|pathMatch|canActivate|redirect|index)["']?\s*:/;

  function findRoutes(F, acc, props) {
    const tree = F.tree();
    const { S, E, P, K } = tree;
    const clean = F.clean;
    // route-constant objects: three or more key:"/path" pairs in one object
    const groups = new Map();
    for (const pr of props) {
      if (pr.s.template || !routeLike(normPath(pr.s.text))) continue;
      const o = enclosing(tree, pr.pos);
      if (o < 0 || K[o] !== '{') continue;
      if (!groups.has(o)) groups.set(o, []);
      groups.get(o).push(pr);
    }
    for (const list of groups.values()) {
      if (list.length < 3) continue;
      const keys = new Set(list.map((p) => p.key));
      if (keys.size < 3) continue;
      for (const pr of list) {
        addRoute(acc, F, pr.s.text, 'route-map', pr.key);
        acc.routeMapKeys.set(pr.key, normPath(pr.s.text));
      }
    }
    // path: properties, with relative children joined onto their parents
    const pathObjs = new Map();
    for (const pr of props) {
      if (pr.key !== 'path' || pr.s.template) continue;
      const o = enclosing(tree, pr.pos);
      if (o < 0 || K[o] !== '{' || pathObjs.has(o)) continue;
      pathObjs.set(o, pr.s.text);
    }
    const ownerOf = (o) => {
      const a = P[o];
      if (a < 0 || K[a] !== '[') return -1;
      if (!/children\s*:\s*$/.test(clean.slice(Math.max(0, S[a] - 40), S[a]))) return -1;
      const owner = P[a];
      return owner >= 0 && K[owner] === '{' ? owner : -1;
    };
    const memo = new Map();
    const fullPath = (o, guard) => {
      if (memo.has(o)) return memo.get(o);
      const raw = pathObjs.get(o).replace(/(:[A-Za-z_$][\w$]*)\((?:[^()]|\([^()]*\))*\)/g, '$1');
      let full = null;
      if (raw.startsWith('/')) full = raw;
      else {
        const owner = ownerOf(o);
        const base = owner >= 0 && pathObjs.has(owner) && guard < 30 ? fullPath(owner, guard + 1) : '';
        const relOk = owner >= 0 || ROUTE_OBJ_KEYS.test(clean.slice(S[o], Math.min(E[o], S[o] + 3000)));
        if (relOk && routeLike(raw, true) && base !== null) {
          const b = base === '/' ? '' : base;
          full = raw === '' ? (b || '/') : b + '/' + raw.replace(/\/$/, '');
        }
      }
      memo.set(o, full);
      return full;
    };
    for (const o of pathObjs.keys()) {
      const full = fullPath(o, 0);
      if (full === null) continue;
      const ov = readLiteral(clean, S[o]).value;
      const nm = isObj(ov) && typeof ov.name === 'string' && ov.name.length <= 60 ? ov.name : null;
      addRoute(acc, F, full, 'path-prop', nm);
    }
    // path: R.key, resolved against route maps once every file is read
    for (const m of matches(/(?<![\w$.])["']?path["']?\s*:\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+)/g, clean)) {
      if (!inStr(F, m.index)) acc.routeRefs.push({ key: lastSeg(m[1]), file: F.name });
    }
    // navigation targets
    const navProps = new Set(['to', 'href', 'redirect', 'redirectTo', 'routerLink']);
    for (const pr of props) {
      if (!navProps.has(pr.key)) continue;
      const p = pr.s.template ? tplToPath(pr.s.raw) : pr.s.text;
      if (p && p[0] === '/') addRoute(acc, F, p, 'nav-target');
    }
    const callRe = /(?<![\w$])(?:navigate|navigateByUrl|navigateTo|push|redirect|(?:history|router|location|navigation)\.replace)\s*\(\s*(?=["'`])|["']routerLink["']\s*,\s*(?=["'`])/g;
    for (const m of matches(callRe, clean)) {
      if (inStr(F, m.index)) continue;
      const s = strAt(clean, m.index + m[0].length);
      if (!s) continue;
      const p = s.template ? tplToPath(s.raw) : s.text;
      if (p && p[0] === '/') addRoute(acc, F, p, 'nav-target');
    }
    // the Next build manifest
    const bm = /__BUILD_MANIFEST\s*=\s*/.exec(clean);
    if (bm) {
      let at = bm.index + bm[0].length;
      if (!clean.startsWith('{', at)) {
        const ret = /return\s*\{/g;
        ret.lastIndex = at;
        const rm = ret.exec(clean);
        at = rm ? rm.index + rm[0].length - 1 : -1;
      }
      if (at >= 0) {
        const v = readLiteral(clean, at).value;
        if (isObj(v)) {
          const pages = Object.keys(v).filter((k) => k[0] === '/');
          if (Array.isArray(v.sortedPages)) for (const p of v.sortedPages) if (typeof p === 'string') pages.push(p);
          for (const p of pages) {
            if (/^\/_/.test(p)) continue;
            const route = p.replace(/\[\[?\.\.\.([\w-]+)\]?\]/g, ':$1*').replace(/\[([\w-]+)\]/g, ':$1');
            if (route.indexOf('*') >= 0) addRoute(acc, F, route.replace(/\/:[\w-]+\*$/, '') || '/', 'manifest');
            else addRoute(acc, F, route, 'manifest');
          }
        }
      }
    }
  }

  // ─── labels ───

  /** A compiled formatjs message ([{type:0,value:"…"}, …]) as text, or null. */
  function compiledText(arr) {
    if (!Array.isArray(arr) || !arr.length) return null;
    let out = '';
    for (const el of arr) {
      if (!isObj(el) || typeof el.type !== 'number') return null;
      if (el.type === 0) out += typeof el.value === 'string' ? el.value : '';
      else if (el.type === 7) out += '#';
      else if (el.type === 8) out += compiledText(el.children) || '';
      else if ((el.type === 5 || el.type === 6) && isObj(el.options) && typeof el.value === 'string') {
        const kind = el.type === 5 ? 'select' : el.pluralType === 'ordinal' ? 'selectordinal' : 'plural';
        const opts = Object.keys(el.options).map((k) => k + ' {' + ((isObj(el.options[k]) && compiledText(el.options[k].value)) || '') + '}');
        out += '{' + el.value + ', ' + kind + ', ' + opts.join(' ') + '}';
      }
      else out += '{' + (typeof el.value === 'string' ? el.value : '…') + '}';
    }
    return out;
  }

  function addLabel(acc, F, ns, id, text, prio) {
    if (typeof text !== 'string' || !text.trim()) return;
    acc.labelCands.push({ ns, id, text: text.replace(/\{\{\s*([\w.$-]+)\s*\}\}/g, '{$1}'), prio, file: F.name, order: acc.labelCands.length });
  }

  function addUnkeyed(acc, F, text) {
    if (!readsAsHuman(text)) return;
    if (!acc.unkeyed.has(F.name)) acc.unkeyed.set(F.name, new Set());
    acc.unkeyed.get(F.name).add(text.trim());
  }

  function fileLangPrio(name) {
    const m = /(?:^|[\/._-])([a-z]{2})(?:[-_][A-Z]{2})?(?=[._-])/.exec(name.replace(/^.*\//, '/'));
    const lang = m && LANGS.has(m[1]) ? m[1] : null;
    return lang && lang !== 'en' ? 3 : 2;
  }

  /** Flattens a resource tree into dotted ids. Leaves may be strings or compiled messages. */
  function flatten(obj, prefix, out) {
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      const id = prefix ? prefix + '.' + k : k;
      if (typeof v === 'string') out.push([id, v]);
      else if (Array.isArray(v)) { const t = compiledText(v); if (t !== null) out.push([id, t]); }
      else if (isObj(v)) flatten(v, id, out);
    }
    return out;
  }

  /** Adds a resource object (i18next, vue-i18n, JSON) as labels. Returns true if it was one. */
  function addResource(acc, F, obj, basePrio, requireHuman) {
    if (!isObj(obj)) return false;
    const keys = Object.keys(obj);
    let trees = [[null, obj]];
    if (keys.length && keys.every((k) => langOf(k) && isObj(obj[k]))) trees = keys.map((k) => [langOf(k), obj[k]]);
    let any = false;
    for (const [lang, tree0] of trees) {
      let tree = tree0;
      if (isObj(tree.translation) && Object.keys(tree).length === 1) tree = tree.translation;
      const pairs = flatten(tree, '', []);
      if (pairs.length < 3) continue;
      if (requireHuman) {
        const human = pairs.filter(([, v]) => readsAsHuman(v) || /\s/.test(v.trim())).length;
        if (human * 2 < pairs.length) continue;
        if (pairs.every(([id]) => !/[._]/.test(id)) && pairs.length < 5) continue;
      }
      const prio = lang && lang !== 'en' ? 3 : basePrio;
      for (const [id, text] of pairs) addLabel(acc, F, nsOf(id), id, text, prio);
      any = true;
    }
    return any;
  }

  function findLabels(F, acc, props) {
    const clean = F.clean;
    const tree = F.tree();
    const consumed = [];
    // formatjs descriptors: { id, defaultMessage[, description] } in any order
    const seen = new Set();
    for (const m of matches(/(?<![\w$.])["']?defaultMessage["']?\s*:/g, clean)) {
      if (inStr(F, m.index)) continue;
      const o = enclosing(tree, m.index);
      if (o < 0 || tree.K[o] !== '{' || seen.has(o)) continue;
      seen.add(o);
      const v = readLiteral(clean, tree.S[o]).value;
      if (!isObj(v) || typeof v.id !== 'string') continue;
      const text = typeof v.defaultMessage === 'string' ? v.defaultMessage : compiledText(v.defaultMessage);
      if (text !== null) addLabel(acc, F, nsOf(v.id), v.id, text, 0);
    }
    // ids referenced without built-in text
    for (const pr of props) {
      if (pr.key === 'id' && !pr.s.template && /^[A-Za-z][\w-]*(?:[._][A-Za-z0-9][\w-]*)+$/.test(pr.s.text) && !ASSET_EXT.test(pr.s.text)) acc.idRefs.push(pr.s.text);
    }
    for (const m of matches(/(?:(?<![\w$.])(?:t|i18n\.t|i18next\.t|translate|formatMessage)|(?<!\w)\$t|\$i18n\.t)\s*\(\s*(?=["'`])/g, clean)) {
      if (inStr(F, m.index)) continue;
      const s = strAt(clean, m.index + m[0].length);
      if (s && !s.template && /^[A-Za-z][\w-]*(?:[.:_][A-Za-z0-9][\w-]*)+$/.test(s.text)) acc.idRefs.push(s.text.replace(':', '.'));
    }
    // compiled formatjs locales: key:[{type:0,value:"…"}], or x=[…] then key:x
    const vars = new Map();
    const COMPILED = String.raw`\[\s*\{\s*["']?type["']?\s*:`;
    const prio = fileLangPrio(F.name);
    for (const m of matches(new RegExp(String.raw`(?<![\w$.])([A-Za-z_$][\w$]*)\s*=\s*(?=` + COMPILED + ')', 'g'), clean)) {
      if (inStr(F, m.index)) continue;
      const t = compiledText(readLiteral(clean, m.index + m[0].length).value);
      if (t !== null) vars.set(m[1], t);
    }
    const KEY = String.raw`(?<![\w$.])(?:"((?:[^"\\\n]|\\.)+)"|'((?:[^'\\\n]|\\.)+)'|([A-Za-z_$][\w$]*))\s*:\s*`;
    for (const m of matches(new RegExp(KEY + '(?=' + COMPILED + ')', 'g'), clean)) {
      if (inStr(F, m.index)) continue;
      const id = m[3] !== undefined ? m[3] : decodeJs(m[1] !== undefined ? m[1] : m[2]);
      if (id === 'defaultMessage' || id === 'children' || id === 'value' || id === 'options') continue;
      const t = compiledText(readLiteral(clean, m.index + m[0].length).value);
      if (t !== null) addLabel(acc, F, nsOf(id), id, t, prio);
    }
    if (vars.size) {
      for (const m of matches(new RegExp(KEY + String.raw`([A-Za-z_$][\w$]*)(?=\s*[,}])`, 'g'), clean)) {
        if (inStr(F, m.index) || !vars.has(m[4])) continue;
        const id = m[3] !== undefined ? m[3] : decodeJs(m[1] !== undefined ? m[1] : m[2]);
        addLabel(acc, F, nsOf(id), id, vars.get(m[4]), prio);
      }
    }
    // i18next / vue-i18n resource objects
    for (const m of matches(/(?<![\w$.])["']?(?:messages|resources)["']?\s*:\s*(?=\{)/g, clean)) {
      if (inStr(F, m.index)) continue;
      const r = readLiteral(clean, m.index + m[0].length);
      if (addResource(acc, F, r.value, 1, false)) consumed.push([m.index, r.end]);
    }
    // JSON.parse('…') blobs: resources, gql ASTs
    for (const m of matches(/(?<![\w$.])JSON\.parse\s*\(\s*(?=["'`])/g, clean)) {
      if (inStr(F, m.index)) continue;
      const s = strAt(clean, m.index + m[0].length);
      if (!s || s.template) continue;
      let v;
      try { v = JSON.parse(s.text); } catch (e) { continue; }
      handleJsonValue(F, acc, v);
    }
    // Angular $localize`:meaning|description@@id:text`
    for (const m of matches(/\$localize\s*(?=`)/g, clean)) {
      if (inStr(F, m.index)) continue;
      const at = m.index + m[0].length;
      const raw = clean.slice(at + 1, skipTemplate(clean, at) - 1);
      let meta = '';
      let body = raw;
      if (raw[0] === ':') {
        const k = raw.indexOf(':', 1);
        if (k > 0) { meta = raw.slice(1, k); body = raw.slice(k + 1); }
      }
      let text = '';
      let i = 0;
      while (i < body.length) {
        const k = body.indexOf('${', i);
        if (k < 0) { text += body.slice(i); break; }
        text += body.slice(i, k);
        const e = skipCode(body, k + 2);
        const ph = /^:([\w]+):/.exec(body.slice(e));
        text += '{' + (ph ? ph[1] : 'value') + '}';
        i = e + (ph ? ph[0].length : 0);
      }
      text = decodeJs(text);
      const idm = /@@([\w.\-]+)/.exec(meta);
      if (idm) addLabel(acc, F, nsOf(idm[1]), idm[1], text, 1);
      else addUnkeyed(acc, F, text);
    }
    // UI props and inline text that reads as human
    const UI = new Set(['label', 'title', 'placeholder', 'headerName', 'header', 'tooltip', 'helperText', 'children']);
    const isConsumed = (p) => consumed.some(([s, e]) => p > s && p < e);
    for (const pr of props) if (UI.has(pr.key) && !pr.s.template && !isConsumed(pr.pos)) addUnkeyed(acc, F, pr.s.text);
    const callRe = /(?<![\w$])(?:createElement|_createTextVNode|createTextVNode|_createElementVNode|createElementVNode|ɵɵtext|ɵɵelementStart|_createElementBlock|createElementBlock)\s*\(/g;
    for (const m of matches(callRe, clean)) {
      if (inStr(F, m.index)) continue;
      const open = m.index + m[0].length - 1;
      const close = matchBracket(clean, open, 4000);
      if (close < 0) continue;
      let j = open + 1;
      while (j < close) {
        j = skipWs(clean, j);
        const s = strAt(clean, j);
        if (s && !s.template) addUnkeyed(acc, F, s.text);
        const e = skipExpr(clean, j);
        j = e + 1;
      }
    }
  }

  // ─── columns ───

  const COLUMN_KINDS = [
    ['field', 'headerName'], ['dataIndex', 'title'], ['accessorKey', 'header'], ['accessor', 'Header'], ['key', 'label'], ['prop', 'label'],
  ];

  function findColumns(F, acc, props) {
    const tree = F.tree();
    const objs = new Set();
    const keys = new Set(COLUMN_KINDS.map((k) => k[0]));
    for (const pr of props) {
      if (!keys.has(pr.key)) continue;
      const o = enclosing(tree, pr.pos);
      if (o >= 0 && tree.K[o] === '{') objs.add(o);
    }
    const byArray = new Map();
    for (const o of [...objs].sort((a, b) => a - b)) {
      const a = tree.P[o];
      if (a < 0 || tree.K[a] !== '[') continue;
      const v = readLiteral(F.clean, tree.S[o]).value;
      if (!isObj(v)) continue;
      const kind = COLUMN_KINDS.find(([f, h]) => typeof v[f] === 'string' && h in v);
      if (!kind) continue;
      const header = typeof v[kind[1]] === 'string' ? v[kind[1]] : null;
      if (!byArray.has(a)) byArray.set(a, { kind: kind[0], set: [] });
      byArray.get(a).set.push({ field: v[kind[0]], header });
    }
    for (const { kind, set } of byArray.values()) {
      if ((kind === 'key' || kind === 'prop') && set.length < 2) continue;
      acc.columns.push({ file: F.name, set });
    }
  }

  // ─── operations ───

  function gqlFields(body) {
    const inner = body.slice(1, -1);
    let s = '';
    let depth = 0;
    for (let i = 0; i < inner.length; i++) {
      const c = inner[i];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (depth === 0) s += c;
    }
    const toks = s.match(/\.\.\.|[A-Za-z_]\w*|[{}:@]/g) || [];
    const out = [];
    let d = 0;
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t === '{') { d++; continue; }
      if (t === '}') { d--; continue; }
      if (d !== 0) continue;
      if (t === '...') { i++; if (toks[i] === 'on') i++; continue; }
      if (t === '@') { i++; continue; }
      if (t === ':') continue;
      if (toks[i + 1] === ':') { const f = toks[i + 2]; if (f && /^[A-Za-z_]/.test(f)) { if (!out.includes(f)) out.push(f); i += 2; } continue; }
      if (!out.includes(t)) out.push(t);
    }
    return out;
  }

  function gqlVars(sig) {
    if (!sig) return [];
    return [...sig.matchAll(/\$(\w+)\s*:\s*([\w!\[\] ]+?)\s*(?=[,)$=]|\$|$)/g)].map((m) => '$' + m[1] + ': ' + m[2].replace(/\s+/g, ''));
  }

  function findGraphql(F, acc) {
    const text = F._gql || (F._gql = F.clean.replace(/\\[ntr]/g, '  '));
    const opRe = /\b(query|mutation|subscription)\s+([A-Za-z_]\w*)\s*(\((?:[^()]|\([^()]*\))*\))?\s*(?:@\w+(?:\([^)]*\))?\s*)*\{/g;
    const frRe = /\bfragment\s+([A-Za-z_]\w*)\s+on\s+([A-Za-z_]\w*)\s*(?:@\w+(?:\([^)]*\))?\s*)*\{/g;
    const body = (at) => {
      let d = 0;
      const n = Math.min(text.length, at + 50000);
      for (let i = at; i < n; i++) {
        const c = text[i];
        if (c === '{') d++;
        else if (c === '}') { d--; if (d === 0) return text.slice(at, i + 1); }
        else if (c === '`' || c === '"' || c === "'") return null;
      }
      return null;
    };
    for (const m of matches(opRe, text)) {
      const b = body(m.index + m[0].length - 1);
      if (!b) continue;
      acc.ops.push({ kind: m[1], name: m[2], variables: gqlVars(m[3]), fields: gqlFields(b), source: 'document', file: F.name });
    }
    for (const m of matches(frRe, text)) {
      const b = body(m.index + m[0].length - 1);
      if (!b) continue;
      acc.ops.push({ kind: 'fragment', name: m[1], on: m[2], variables: [], fields: gqlFields(b), source: 'document', file: F.name });
    }
    // compiled ASTs: { kind: "OperationDefinition" | "FragmentDefinition", … }
    const tree = F.tree();
    const seen = new Set();
    for (const m of matches(/["']?kind["']?\s*:\s*["'](?:OperationDefinition|FragmentDefinition)["']/g, F.clean)) {
      if (inStr(F, m.index)) continue;
      const o = enclosing(tree, m.index);
      if (o < 0 || seen.has(o)) continue;
      seen.add(o);
      astDef(F, acc, readLiteral(F.clean, tree.S[o]).value);
    }
  }

  const astName = (n) => (isObj(n) && typeof n.value === 'string' ? n.value : null);
  function astType(t) {
    if (!isObj(t)) return '?';
    if (t.kind === 'NonNullType') return astType(t.type) + '!';
    if (t.kind === 'ListType') return '[' + astType(t.type) + ']';
    return astName(t.name) || '?';
  }
  function astFields(sel) {
    if (!isObj(sel) || !Array.isArray(sel.selections)) return [];
    const out = [];
    for (const s of sel.selections) if (isObj(s) && s.kind === 'Field') { const f = astName(s.name); if (f && !out.includes(f)) out.push(f); }
    return out;
  }
  function astDef(F, acc, d) {
    if (!isObj(d)) return;
    const name = astName(d.name);
    if (!name) return;
    if (d.kind === 'FragmentDefinition') {
      const on = isObj(d.typeCondition) ? astName(d.typeCondition.name) : null;
      acc.ops.push({ kind: 'fragment', name, on, variables: [], fields: astFields(d.selectionSet), source: 'ast', file: F.name });
      return;
    }
    if (d.kind !== 'OperationDefinition' || !/^(query|mutation|subscription)$/.test(d.operation)) return;
    const vars = Array.isArray(d.variableDefinitions) ? d.variableDefinitions.filter(isObj).map((v) => '$' + (astName(isObj(v.variable) ? v.variable.name : null) || '?') + ': ' + astType(v.type)) : [];
    acc.ops.push({ kind: d.operation, name, variables: vars, fields: astFields(d.selectionSet), source: 'ast', file: F.name });
  }

  function walkJson(v, fn, depth) {
    if (depth > 40 || v === null || typeof v !== 'object') return;
    fn(v);
    if (Array.isArray(v)) for (const x of v) walkJson(x, fn, depth + 1);
    else for (const k of Object.keys(v)) walkJson(v[k], fn, depth + 1);
  }

  function handleJsonValue(F, acc, v) {
    let ast = false;
    walkJson(v, (node) => {
      if (!Array.isArray(node) && (node.kind === 'OperationDefinition' || node.kind === 'FragmentDefinition')) { astDef(F, acc, node); ast = true; }
    }, 0);
    if (ast) return;
    if (isObj(v)) addResource(acc, F, v, 1, true);
  }

  const REST_METHODS = /\.(get|post|put|patch|delete|head|options)\s*\(\s*(?=["'`])/g;

  function apiPath(F, acc, s) {
    let p = s.template ? tplToPath(s.raw) : s.text;
    if (!p) return null;
    const abs = /^(https?|wss?):\/\/([^/\s"'`?#]+)(.*)$/.exec(p);
    if (abs) {
      const origin = abs[1] + '://' + abs[2];
      (abs[1].startsWith('ws') ? acc.hosts.ws : acc.hosts.api).add(origin);
      p = abs[3] || '/';
    }
    if (p[0] !== '/') return null;
    p = p.split(/[?#]/)[0];
    if (/\.(?:m?js|css|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|map)$/i.test(p)) return null;
    return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
  }

  function findEndpoints(F, acc, props) {
    const clean = F.clean;
    const add = (method, path) => { if (path) acc.endpoints.push({ method, path, file: F.name }); };
    for (const m of matches(REST_METHODS, clean)) {
      if (inStr(F, m.index)) continue;
      const s = strAt(clean, m.index + m[0].length);
      if (s) add(m[1].toUpperCase(), apiPath(F, acc, s));
    }
    for (const m of matches(/(?<![\w$.])fetch\s*\(\s*(?=["'`])/g, clean)) {
      if (inStr(F, m.index)) continue;
      const open = m.index + m[0].length;
      const s = strAt(clean, open);
      if (!s) continue;
      const close = matchBracket(clean, clean.lastIndexOf('(', open), 2000);
      const call = close > 0 ? clean.slice(s.end, close) : '';
      const mm = /["']?method["']?\s*:\s*["'](\w+)["']/.exec(call);
      add(mm ? mm[1].toUpperCase() : null, apiPath(F, acc, s));
    }
    const tree = F.tree();
    for (const pr of props) {
      if (pr.key !== 'url' && pr.key !== 'endpoint') continue;
      const o = enclosing(tree, pr.pos);
      if (o < 0 || tree.K[o] !== '{') continue;
      const objText = clean.slice(tree.S[o], Math.min(tree.E[o], tree.S[o] + 2000));
      const mm = /["']?method["']?\s*:\s*["'](\w+)["']/.exec(objText);
      if (!mm) continue;
      add(mm[1].toUpperCase(), apiPath(F, acc, pr.s));
    }
    for (const m of matches(/(?<![\w$.])new\s+(WebSocket|EventSource)\s*\(\s*(?=["'`])/g, clean)) {
      if (inStr(F, m.index)) continue;
      const s = strAt(clean, m.index + m[0].length);
      if (s) add(m[1] === 'WebSocket' ? 'WS' : 'SSE', apiPath(F, acc, s));
    }
    for (const pr of props) {
      if (pr.key === 'operationName' && !pr.s.template && /^[A-Za-z_]\w*$/.test(pr.s.text)) {
        const name = pr.s.text;
        const kind = /^(?:create|update|delete|remove|add|set|send|submit|request|approve|reject|cancel|import|upload|save|edit|change|reset|transfer)/i.test(name) ? 'mutation' : 'query';
        acc.ops.push({ kind, name, variables: [], fields: [], source: 'persisted', file: F.name });
      }
      if ((pr.key === 'baseURL' || pr.key === 'uri' || pr.key === 'baseUrl') && !pr.s.template) {
        const p = apiPath(F, acc, pr.s);
        if (p && pr.key === 'uri') add('POST', p);
      }
    }
  }

  function findHosts(F, acc, strings) {
    for (const { text, pos } of strings) {
      for (const m of text.matchAll(/\b(https?|wss?):\/\/([A-Za-z0-9.-]+(?::\d+)?)([^\s"'`]*)/g)) {
        const origin = m[1] + '://' + m[2];
        if (m[1].startsWith('ws')) { acc.hosts.ws.add(origin); continue; }
        const km = /(?:["']?([\w$-]+)["']?\s*[:=]|([\w$]+)\s*\()\s*$/.exec(F.clean.slice(Math.max(0, pos - 60), pos));
        const key = km ? km[1] || km[2] : '';
        const all = (m[2] + m[3]).toLowerCase();
        if (/auth|login|sso|oauth|openid|realms|keycloak|identity|token/.test(all) || /auth|issuer|authority|realm|sso|login/i.test(key)) acc.hosts.auth.add(origin);
        else if (/(?:^|[./-])api[./-]|graphql|\/v\d+(?:\/|$)/.test(all) || /base_?ur[li]|^uri$|api|endpoint|graphql|^url$|fetch|post|get|put|patch|delete|WebSocket|EventSource/i.test(key)) acc.hosts.api.add(origin);
      }
    }
  }

  // ─── access ───

  const ROLE_CONST = /^(?:ROLE|ROLES|PERM|PERMS|PERMISSION|PERMISSIONS|SCOPE|GROUP|CAN|RIGHT|PRIV|PRIVILEGE)_[A-Z0-9_]+$/;
  const DENIED = /not (?:have )?(?:the )?(?:permission|access|authori[sz]ed|allowed)|permission denied|access denied|\bforbidden\b|\bunauthori[sz]ed\b|no access|(?:do not|don't|doesn't|does not) have (?:access|permission)/i;

  function findAccess(F, acc, strings) {
    const clean = F.clean;
    const tree = F.tree();
    for (const { text } of strings) {
      if (ROLE_CONST.test(text)) acc.constants.add(text);
      if (text.length <= 300 && DENIED.test(text) && /\s/.test(text)) acc.denied.add(text.trim());
    }
    // objects named like roles or permissions
    for (const m of matches(/(?<![\w$.])([\w$]*(?:[rR]oles?|[pP]ermissions?|[pP]erms|[sS]copes?|[gG]roups?|[rR]ights|[pP]rivileges?))\s*[=:]\s*(?:Object\.freeze\s*\(\s*)?(?=\{)/g, clean)) {
      if (inStr(F, m.index)) continue;
      const v = readLiteral(clean, m.index + m[0].length).value;
      if (!isObj(v)) continue;
      const keys = Object.keys(v);
      if (keys.length < 2 || !keys.every((k) => /^[A-Za-z][\w-]*$/.test(k))) continue;
      const vals = keys.map((k) => v[k]);
      if (vals.every((x) => typeof x === 'string')) vals.forEach((x) => acc.constants.add(x));
      else if (vals.every((x) => typeof x === 'number' || typeof x === 'boolean')) keys.forEach((k) => acc.constants.add(k));
    }
    // rule tables: roles / permissions / groups / policies / scopes / rules arrays
    const ruleRe = /(?<![\w$.])["']?([\w$]*(?:[rR]oles|[pP]ermissions|[gG]roups|[pP]olicies|[sS]copes|[rR]ules))["']?\s*:\s*(?:new\s+[\w$.]+\s*\(\s*)?(?=\[)/g;
    for (const m of matches(ruleRe, clean)) {
      if (inStr(F, m.index)) continue;
      const arr = readLiteral(clean, m.index + m[0].length).value;
      if (!Array.isArray(arr) || !arr.length) continue;
      const roles = [];
      let ok = true;
      for (const x of arr) {
        if (typeof x === 'string') roles.push(x);
        else if (refName(x)) roles.push(lastSeg(refName(x)));
        else { ok = false; break; }
      }
      if (!ok) continue;
      const o = enclosing(tree, m.index);
      let name = null;
      let context = '';
      if (o >= 0 && tree.K[o] === '{') {
        const ov = readLiteral(clean, tree.S[o]).value;
        if (isObj(ov)) {
          for (const k of ['name', 'key', 'id', 'resource', 'path', 'route', 'permission', 'title', 'label']) {
            if (typeof ov[k] === 'string') { name = ov[k]; break; }
            if (refName(ov[k])) { name = lastSeg(refName(ov[k])); break; }
          }
        }
        if (!name) {
          const before = clean.slice(Math.max(0, tree.S[o] - 80), tree.S[o]);
          const km = /(?:["']([\w$.\-/]+)["']|([\w$]+))\s*[:=]\s*(?:Object\.freeze\s*\(\s*)?$/.exec(before);
          if (km) name = km[1] || km[2];
        }
        context = collapse(clean.slice(tree.S[o], Math.min(tree.E[o] + 1, tree.S[o] + 400)), 160);
      } else context = collapse(clean.slice(m.index, m.index + 160), 160);
      acc.rules.push({ name: name || m[1], roles, context: m[1] + ' — ' + context, file: F.name });
      roles.forEach((r) => acc.constants.add(r));
    }
    // checks: hasRole("X"), hasPermission("x"), …
    const callRe = /(?<![\w$])(hasRole|hasAnyRole|hasRoles|hasPermission|hasAnyPermission|hasPermissions|hasRealmRole|hasResourceRole|hasScope|isGranted|checkPermission|can)\s*\(\s*(?=["'])/g;
    for (const m of matches(callRe, clean)) {
      if (inStr(F, m.index)) continue;
      const s = strAt(clean, m.index + m[0].length);
      if (!s || !s.text) continue;
      acc.rules.push({ name: m[1], roles: [s.text], context: collapse(clean.slice(Math.max(0, m.index - 60), s.end + 60), 160), file: F.name });
      acc.constants.add(s.text);
    }
  }

  // ─── enums, limits, config ───

  function assignedName(clean, at) {
    const before = clean.slice(Math.max(0, at - 80), at);
    const m = /(?:["']([\w$.\-]+)["']|([\w$.]+))\s*(?:=|:)\s*(?:Object\.freeze\s*\(\s*)?$/.exec(before);
    return m ? lastSeg(m[1] || m[2]) : null;
  }

  function findEnums(F, acc) {
    const clean = F.clean;
    for (const m of matches(/\{\s*["']?[A-Z][A-Z0-9_]*["']?\s*:/g, clean)) {
      if (inStr(F, m.index)) continue;
      const v = readLiteral(clean, m.index).value;
      if (!isObj(v)) continue;
      const keys = Object.keys(v);
      if (keys.length < 3 || !keys.every((k) => /^[A-Z][A-Z0-9_]*$/.test(k))) continue;
      if (!keys.every((k) => ['string', 'number', 'boolean'].includes(typeof v[k]))) continue;
      acc.enums.push({ name: assignedName(clean, m.index) || '(anonymous)', members: keys, file: F.name });
    }
    for (const m of matches(/\[\s*(?=["'][A-Z][A-Z0-9_]*["']\s*,)/g, clean)) {
      if (inStr(F, m.index)) continue;
      const v = readLiteral(clean, m.index).value;
      if (!Array.isArray(v) || v.length < 3 || !v.every((x) => typeof x === 'string' && /^[A-Z][A-Z0-9_]*$/.test(x))) continue;
      acc.enums.push({ name: assignedName(clean, m.index) || '(anonymous)', members: [...new Set(v)], file: F.name });
    }
    // TypeScript enum output: (function(e){e[e.A=0]="A";e.B="b"})(X||(X={})), and the arrow forms
    for (const m of matches(/\(\s*(?:function\s*\(\s*([\w$]+)\s*\)\s*|\(?\s*([\w$]+)\s*\)?\s*=>\s*)(?=[{(])/g, clean)) {
      if (inStr(F, m.index)) continue;
      const v = m[1] || m[2];
      const open = m.index + m[0].length;
      const close = matchBracket(clean, open, 20000);
      if (close < 0) continue;
      const body = clean.slice(open + 1, close);
      const esc = v.replace(/\$/g, '\\$');
      const members = [];
      for (const mm of body.matchAll(new RegExp(String.raw`(?<![\w$.])` + esc + String.raw`(?:\[\s*` + esc + String.raw`\.([\w$]+)\s*=|\.([\w$]+)\s*=(?![=>]))`, 'g'))) {
        const k = mm[1] || mm[2];
        if (!members.includes(k)) members.push(k);
      }
      if (members.length < 2) continue;
      const tail = clean.slice(close + 1, close + 120);
      const nm = /^\s*\)\s*\(\s*([\w$.]+)\s*\|\|/.exec(tail) || /^\s*\)\s*\)?\s*\(\s*([\w$.]+)\s*\|\|/.exec(tail);
      if (!nm) continue;
      acc.enums.push({ name: lastSeg(nm[1]), members, file: F.name });
    }
  }

  /** Evaluates arithmetic over number literals (+ - * / % and brackets); NaN if it isn't that. */
  function evalArith(src) {
    const toks = src.match(/0[xX][0-9a-fA-F_]+|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d+)?|\*\*|[-+*/%()]|\S/g) || [];
    let i = 0;
    const peek = () => toks[i];
    const expr = () => {
      let v = term();
      while (peek() === '+' || peek() === '-') { const op = toks[i++]; const r = term(); v = op === '+' ? v + r : v - r; }
      return v;
    };
    const term = () => {
      let v = power();
      while (peek() === '*' || peek() === '/' || peek() === '%') {
        const op = toks[i++]; const r = power();
        v = op === '*' ? v * r : op === '/' ? v / r : v % r;
      }
      return v;
    };
    const power = () => { const b = unary(); if (peek() === '**') { i++; return Math.pow(b, power()); } return b; };
    const unary = () => {
      const t = toks[i++];
      if (t === '-') return -unary();
      if (t === '+') return unary();
      if (t === '(') { const v = expr(); if (toks[i++] !== ')') return NaN; return v; }
      if (t !== undefined && /^[\d.]/.test(t)) return parseNum(t);
      return NaN;
    };
    const v = expr();
    return i === toks.length ? v : NaN;
  }

  const LIMIT_NAME = /max|min|limit|size|count|timeout|retention|ttl|expir|length|lines|rows|perpage|threshold|quota|retries|attempts/i;
  const NOT_LIMIT = /font|icon|lineheight|line_height|border|padding|margin|width|height|radius|spacing|zindex|z_index|opacity|delay|duration|offset|gutter|elevation|letter|stroke|breakpoint|columns?span|flex|order|weight|scale|ratio|angle|version/i;
  const NUM_EXPR = String.raw`[-+(]*\s*(?:0[xX][0-9a-fA-F_]+|\d[\d_]*\.?[\d_]*(?:[eE][+-]?\d+)?|\.\d+)(?:\s*(?:\*\*|[-+*/%])\s*[(]*\s*(?:0[xX][0-9a-fA-F_]+|\d[\d_]*\.?[\d_]*(?:[eE][+-]?\d+)?|\.\d+)\s*[)]*)*\s*[)]*`;

  function findLimits(F, acc) {
    const clean = F.clean;
    const consts = new Map();
    for (const m of matches(new RegExp(String.raw`(?<![\w$.])([A-Za-z_$][\w$]*)\s*=(?![=>])\s*(` + NUM_EXPR + String.raw`)(?=\s*[,;)\n])`, 'g'), clean)) {
      const v = evalArith(m[2]);
      if (Number.isFinite(v)) consts.set(m[1], { v, raw: m[2].trim() });
    }
    const re = new RegExp(String.raw`(?<![\w$.])["']?([A-Za-z_$][\w$]*)["']?\s*(?::|=(?![=>]))\s*(?:(` + NUM_EXPR + String.raw`)|([A-Za-z_$][\w$]*))(?=\s*[,;})\]\n]|$)`, 'g');
    const seen = new Set();
    for (const m of matches(re, clean)) {
      const name = m[1];
      if (!LIMIT_NAME.test(name) || NOT_LIMIT.test(name) || /^(?:count|length|size|total|index|min|max)$/i.test(name)) continue;
      if (inStr(F, m.index)) continue;
      let v;
      let raw;
      if (m[2] !== undefined) { v = evalArith(m[2]); raw = m[2].trim(); }
      else { const c = consts.get(m[3]); if (!c) continue; v = c.v; raw = c.raw; }
      if (!Number.isFinite(v)) continue;
      const k = name + '=' + v;
      if (seen.has(k)) continue;
      seen.add(k);
      acc.limits.push({ name, value: v, raw, file: F.name });
    }
  }

  function findConfig(F, acc) {
    const clean = F.clean;
    const add = (key, value) => acc.config.push({ key, value, file: F.name });
    for (const m of matches(/(?<![\w$.])(?:window|globalThis|self)\s*\.\s*(__[A-Z0-9_]+__|_env_|__ENV__|ENV|env|config|APP_CONFIG|appConfig|runtimeConfig)\s*=\s*(?=\{)/g, clean)) {
      if (inStr(F, m.index)) continue;
      const v = readLiteral(clean, m.index + m[0].length).value;
      if (!isObj(v)) continue;
      const walk = (o, prefix, depth) => {
        for (const k of Object.keys(o)) {
          const x = o[k];
          const key = prefix ? prefix + '.' + k : k;
          if (['string', 'number', 'boolean'].includes(typeof x) || x === null) add(key, x);
          else if (isObj(x) && depth < 4) walk(x, key, depth + 1);
        }
      };
      walk(v, '', 0);
    }
    const envRe = /(?<![\w$])["']?((?:VITE|REACT_APP|NEXT_PUBLIC|VUE_APP|NG_APP)_[A-Z0-9_]+)["']?(?:\s*:\s*(?=["'`\d!tfn-]))?/g;
    for (const m of matches(envRe, clean)) {
      if (inStr(F, m.index)) continue;
      let value = null;
      if (m[0].endsWith(':') || /:\s*$/.test(m[0])) {
        const r = readLiteral(clean, m.index + m[0].length).value;
        if (['string', 'number', 'boolean'].includes(typeof r)) value = r;
      }
      add(m[1], value);
    }
  }

  const CHUNK_RE = /^(?:https?:\/\/[^\s/]+\/|\.{0,2}\/)?(?:[\w@~.\-]+\/)*[\w@~\-][\w@~.\-]*\.m?js$/;

  function findChunksAndMaps(F, acc, strings) {
    for (const m of matches(/[#@]\s*sourceMappingURL\s*=\s*(\S+)/g, F.text)) {
      acc.sourceMaps.push({ file: F.name, url: m[1].startsWith('data:') ? 'data:(inline)' : m[1] });
    }
    const add = (ref) => acc.chunks.push({ ref, file: F.name });
    for (const { text } of strings) {
      if (text.length < 200 && CHUNK_RE.test(text)) add(text);
    }
    // webpack runtime: "static/js/" + … + "." + {12:"ab12cd",…}[e] + ".chunk.js"
    const re = /(["'])([\w\-./]*\/)\1\s*\+[^;]{0,200}?\{([^{}]{1,20000})\}\s*\[\s*[\w$]+\s*\]\s*\+\s*(["'])(\.chunk\.js|\.js)\4/g;
    for (const m of matches(re, F.clean)) {
      for (const pm of m[3].matchAll(/(?:^|,)\s*["']?([\w-]+)["']?\s*:\s*["']([\w-]+)["']/g)) add(m[2] + pm[1] + '.' + pm[2] + m[5]);
    }
  }

  /** Every string value in the file, decoded: quoted strings and templates without expressions. */
  function stringsOf(F) {
    const out = [];
    for (const q of F.quoted) out.push({ text: decodeJs(F.text.slice(q.s + 1, q.e - 1)), pos: q.s });
    for (const t of F.templates) {
      const raw = F.text.slice(t.s + 1, t.e - 1);
      if (raw.indexOf('${') < 0) out.push({ text: decodeJs(raw), pos: t.s });
    }
    return out;
  }

  // ─────────────────────────────── build ───────────────────────────────

  function utf8Bytes(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s).length;
    return s.length;
  }

  function extractJs(F, acc) {
    const props = findProps(F);
    const strings = stringsOf(F);
    findFrameworks(F, acc);
    findRoutes(F, acc, props);
    findLabels(F, acc, props);
    findColumns(F, acc, props);
    findGraphql(F, acc);
    findEndpoints(F, acc, props);
    findHosts(F, acc, strings);
    findAccess(F, acc, strings);
    findEnums(F, acc);
    findLimits(F, acc);
    findConfig(F, acc);
    findChunksAndMaps(F, acc, strings);
  }

  function extractJson(name, text, acc) {
    let v;
    try { v = JSON.parse(text); } catch (e) { return; }
    const F = { name };
    handleJsonValue(F, acc, v);
    walkJson(v, (node) => {
      const vals = Array.isArray(node) ? node : Object.values(node);
      for (const x of vals) if (typeof x === 'string' && x.length < 200 && CHUNK_RE.test(x)) acc.chunks.push({ ref: x, file: name });
    }, 0);
  }

  const uniq = (arr, keyFn) => {
    const seen = new Set();
    return arr.filter((x) => { const k = keyFn(x); if (seen.has(k)) return false; seen.add(k); return true; });
  };
  const byStr = (f) => (a, b) => (f(a) < f(b) ? -1 : f(a) > f(b) ? 1 : 0);

  const NO_REDACT = new Set(['files', 'file', 'chunks', 'sourceMaps', 'sha256']);
  function redactDeep(v, key) {
    if (NO_REDACT.has(key)) return v;
    if (typeof v === 'string') return redactText(v);
    if (Array.isArray(v)) return v.map((x) => redactDeep(x, key));
    if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = redactDeep(v[k], k); return o; }
    return v;
  }

  /**
   * Builds the inventory from [{ name, text, sha256? }]. opts: { origin, now }.
   */
  function build(files, opts) {
    opts = opts || {};
    const acc = {
      frameworks: {}, routes: new Map(), routeMapKeys: new Map(), routeRefs: [], labelCands: [], unkeyed: new Map(), idRefs: [],
      columns: [], ops: [], endpoints: [], hosts: { api: new Set(), auth: new Set(), ws: new Set() },
      constants: new Set(), rules: [], denied: new Set(), enums: [], limits: [], config: [], sourceMaps: [], chunks: [],
    };
    const list = files.slice().sort(byStr((f) => f.name));
    const errors = [];
    for (const f of list) {
      try {
        if (/\.json$/i.test(f.name)) extractJson(f.name, f.text, acc);
        else extractJs(fileCtx(f.name, f.text), acc);
      } catch (e) {
        errors.push({ file: f.name, error: String(e && e.message || e) });
      }
    }
    // path: R.key references resolved against the route maps
    for (const ref of acc.routeRefs) {
      const p = acc.routeMapKeys.get(ref.key);
      const r = p && acc.routes.get(p);
      if (r) { r.kinds.add('path-prop'); r.files.add(ref.file); }
    }
    // labels: descriptors, then resources, then compiled locales; the first text for an id wins
    const labels = {};
    const labelSources = {};
    for (const c of acc.labelCands.slice().sort((a, b) => a.prio - b.prio || a.order - b.order)) {
      const ns = labels[c.ns] || (labels[c.ns] = {});
      if (!(c.id in ns)) ns[c.id] = c.text;
      const src = labelSources[c.ns] || (labelSources[c.ns] = []);
      if (!src.includes(c.file)) src.push(c.file);
    }
    const sortedLabels = {};
    for (const ns of Object.keys(labels).sort()) {
      sortedLabels[ns] = {};
      for (const id of Object.keys(labels[ns]).sort()) sortedLabels[ns][id] = labels[ns][id];
    }
    const hasText = (id) => { const ns = labels[nsOf(id)]; return !!ns && id in ns; };
    const idsWithoutText = [...new Set(acc.idRefs)].filter((id) => !hasText(id) && (id.indexOf('.') >= 0 || labels[nsOf(id)])).sort();
    const unkeyed = {};
    for (const name of [...acc.unkeyed.keys()].sort()) unkeyed[name] = [...acc.unkeyed.get(name)];
    const rank = { document: 0, ast: 1, persisted: 2 };
    const ops = uniq(acc.ops.slice().sort((a, b) => rank[a.source] - rank[b.source]), (o) => o.kind + ' ' + o.name)
      .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
    const inv = {
      version: VERSION,
      generated: opts.now || new Date().toISOString(),
      origin: opts.origin || null,
      files: list.map((f) => ({ name: f.name, bytes: utf8Bytes(f.text), sha256: f.sha256 || null })),
      frameworks: Object.fromEntries(Object.keys(acc.frameworks).sort().map((k) => [k, acc.frameworks[k]])),
      routes: [...acc.routes.values()].sort(byStr((r) => r.path)).map((r) => ({ path: r.path, kinds: [...r.kinds].sort(), keys: [...r.keys].sort(), files: [...r.files].sort() })),
      labels: sortedLabels,
      labelSources,
      unkeyed,
      idsWithoutText,
      columns: uniq(acc.columns, (c) => JSON.stringify(c)),
      operations: ops,
      endpoints: uniq(acc.endpoints, (e) => e.method + ' ' + e.path).sort(byStr((e) => e.path + ' ' + e.method)),
      hosts: { api: [...acc.hosts.api].sort(), auth: [...acc.hosts.auth].sort(), ws: [...acc.hosts.ws].sort() },
      access: {
        constants: [...acc.constants].sort(),
        rules: uniq(acc.rules, (r) => r.name + '|' + r.roles.join(',') + '|' + r.file),
        deniedMessages: [...acc.denied].sort(),
      },
      enums: uniq(acc.enums, (e) => e.name + '|' + e.members.join(',')).sort(byStr((e) => e.name)),
      limits: acc.limits.sort(byStr((l) => l.name)),
      config: uniq(acc.config.slice().sort((a, b) => (a.value === null) - (b.value === null)), (c) => c.key).sort(byStr((c) => c.key)),
      sourceMaps: uniq(acc.sourceMaps, (s) => s.file + ' ' + s.url),
      chunks: uniq(acc.chunks, (c) => c.ref),
    };
    if (errors.length) inv.errors = errors;
    return redactDeep(inv, '');
  }

  globalThis.AuditInventory = {
    version: VERSION,
    build,
    // exposed for tests and for the CLI's helpers
    scan, readLiteral, redactText, readsAsHuman, routeLike, nsOf, evalArith,
  };
})();
