#!/usr/bin/env node
// Dev only: embed scripts/kit-core.mjs, byte for byte, between the markers of wiki-guides'
// templates/guides-kit.mjs. Run it after any change to kit-core.mjs (the sync test fails until
// you do):   node test/embed-kit.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'wiki-guides');
export const KIT_TEMPLATE = path.join(SKILL, 'templates', 'guides-kit.mjs');
export const KIT_CORE = path.join(SKILL, 'scripts', 'kit-core.mjs');
export const BEGIN = '// ===== kit-core.mjs begin (embedded; do not edit here) =====\n';
export const END = '// ===== kit-core.mjs end =====\n';

/** The kit-core text embedded in a guides-kit text, or null. */
export function embedded(text) {
  const b = text.indexOf(BEGIN);
  const e = text.indexOf(END);
  return b === -1 || e < b ? null : text.slice(b + BEGIN.length, e);
}

export function embed(text, core) {
  const b = text.indexOf(BEGIN);
  const e = text.indexOf(END);
  if (b === -1 || e < b) throw new Error('guides-kit.mjs has no kit-core markers');
  return text.slice(0, b + BEGIN.length) + core + (core.endsWith('\n') ? '' : '\n') + text.slice(e);
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  const before = fs.readFileSync(KIT_TEMPLATE, 'utf8');
  const after = embed(before, fs.readFileSync(KIT_CORE, 'utf8'));
  if (after === before) console.log('guides-kit.mjs: kit-core.mjs already embedded, unchanged');
  else {
    fs.writeFileSync(KIT_TEMPLATE, after);
    console.log('guides-kit.mjs: kit-core.mjs embedded');
  }
}
