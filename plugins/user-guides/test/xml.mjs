// A dependency-free XML well-formedness check for the converters' output (storage format is
// XHTML with ac: and ri: elements; to-html's pages are XHTML-clean). Returns a list of
// problems, empty when the text is well-formed. Storage format is a fragment, so wrap it:
// wellFormed(`<root xmlns:ac="a" xmlns:ri="r">${xhtml}</root>`).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const NAME = /^[A-Za-z_:][\w.:-]*/;
const ENTITY = /^&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/;

export function wellFormed(xml) {
  const problems = [];
  const stack = [];
  let roots = 0;
  let i = 0;
  const lineAt = (k) => xml.slice(0, k).split('\n').length;
  const bad = (k, msg) => problems.push(`line ${lineAt(k)}: ${msg}`);
  const checkText = (text, at) => {
    for (let k = text.indexOf('&'); k >= 0; k = text.indexOf('&', k + 1)) if (!ENTITY.test(text.slice(k))) bad(at + k, `a bare & or unknown entity: ${text.slice(k, k + 12)}`);
    if (text.includes('<')) bad(at, 'a < in text or an attribute');
  };
  while (i < xml.length) {
    const lt = xml.indexOf('<', i);
    const text = lt < 0 ? xml.slice(i) : xml.slice(i, lt);
    if (text.trim() && !stack.length) bad(i, 'text outside the root element');
    checkText(text.replace(/</g, ''), i);
    if (lt < 0) break;
    i = lt;
    if (xml.startsWith('<!--', i)) {
      const e = xml.indexOf('-->', i + 4);
      if (e < 0) return bad(i, 'an unclosed comment'), problems;
      i = e + 3;
      continue;
    }
    if (xml.startsWith('<![CDATA[', i)) {
      const e = xml.indexOf(']]>', i + 9);
      if (e < 0) return bad(i, 'an unclosed CDATA section'), problems;
      if (!stack.length) bad(i, 'CDATA outside the root element');
      i = e + 3;
      continue;
    }
    if (xml.startsWith('<?', i)) {
      const e = xml.indexOf('?>', i + 2);
      if (e < 0) return bad(i, 'an unclosed processing instruction'), problems;
      i = e + 2;
      continue;
    }
    if (xml.startsWith('<!DOCTYPE', i)) {
      if (roots || stack.length) bad(i, 'a DOCTYPE after the root element started');
      const e = xml.indexOf('>', i);
      i = e + 1;
      continue;
    }
    const close = xml[i + 1] === '/';
    let k = i + (close ? 2 : 1);
    const nm = xml.slice(k).match(NAME);
    if (!nm) return bad(i, `a < that starts no tag: ${xml.slice(i, i + 20)}`), problems;
    const name = nm[0];
    k += name.length;
    if (close) {
      const m = xml.slice(k).match(/^\s*>/);
      if (!m) return bad(i, `a malformed end tag </${name}`), problems;
      const open = stack.pop();
      if (open !== name) return bad(i, `</${name}> closes <${open ?? 'nothing'}>`), problems;
      i = k + m[0].length;
      continue;
    }
    const attrs = new Set();
    for (;;) {
      const ws = xml.slice(k).match(/^\s*/)[0];
      k += ws.length;
      if (xml.startsWith('/>', k)) {
        k += 2;
        if (!stack.length) roots++;
        break;
      }
      if (xml[k] === '>') {
        k++;
        if (!stack.length) roots++;
        stack.push(name);
        break;
      }
      if (!ws) return bad(k, `no space before an attribute in <${name}>`), problems;
      const an = xml.slice(k).match(NAME);
      if (!an) return bad(k, `a malformed attribute in <${name}>`), problems;
      if (attrs.has(an[0])) bad(k, `a duplicate attribute ${an[0]} in <${name}>`);
      attrs.add(an[0]);
      k += an[0].length;
      const v = xml.slice(k).match(/^\s*=\s*("[^"]*"|'[^']*')/);
      if (!v) return bad(k, `attribute ${an[0]} in <${name}> has no quoted value`), problems;
      checkText(v[1].slice(1, -1), k);
      k += v[0].length;
    }
    i = k;
  }
  if (stack.length) bad(xml.length, `unclosed: ${stack.join(' > ')}`);
  if (roots !== 1) bad(0, `${roots} root elements`);
  return problems;
}

/** xmllint's verdict too, when it is installed (macOS has it); null when it isn't. */
export function xmllint(xml, tmpFile) {
  const which = spawnSync('xmllint', ['--version'], { encoding: 'utf8' });
  if (which.error) return null;
  fs.writeFileSync(tmpFile, xml);
  const r = spawnSync('xmllint', ['--noout', '--nonet', tmpFile], { encoding: 'utf8' });
  return r.status === 0 ? [] : [r.stderr.trim()];
}

export const wrapStorage = (xhtml) => `<root xmlns:ac="urn:storage-format:ac" xmlns:ri="urn:storage-format:ri">${xhtml}</root>`;
