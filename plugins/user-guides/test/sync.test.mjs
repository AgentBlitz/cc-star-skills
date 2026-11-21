// The shared files: both skills carry byte-identical copies (PLAN §2.3). kit-core.mjs joined in
// S2; md.mjs in S7; set-edit.mjs in S9 (R32).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills');
export const SHARED = ['scripts/guide-set.mjs', 'reference/guide-set.md', 'scripts/kit-core.mjs', 'scripts/md.mjs', 'scripts/set-edit.mjs'];
export const OPTIONAL_SHARED = [];

test('wiki-guides templates/guides-kit.mjs embeds kit-core.mjs byte for byte', async () => {
  const { KIT_TEMPLATE, KIT_CORE, embedded } = await import('./embed-kit.mjs');
  const inside = embedded(fs.readFileSync(KIT_TEMPLATE, 'utf8'));
  assert.ok(inside !== null, 'guides-kit.mjs has no kit-core markers');
  assert.ok(inside === fs.readFileSync(KIT_CORE, 'utf8'), 'the kit-core.mjs embedded in guides-kit.mjs is out of date: run node test/embed-kit.mjs');
});

for (const rel of [...SHARED, ...OPTIONAL_SHARED]) {
  test(`${rel} is identical in write-guides and wiki-guides`, (t) => {
    const a = path.join(SKILLS, 'write-guides', rel);
    const b = path.join(SKILLS, 'wiki-guides', rel);
    if (OPTIONAL_SHARED.includes(rel) && !fs.existsSync(a) && !fs.existsSync(b)) return t.skip('not built yet');
    assert.ok(fs.existsSync(a), `missing ${a}`);
    assert.ok(fs.existsSync(b), `missing ${b}`);
    assert.ok(fs.readFileSync(a).equals(fs.readFileSync(b)), `${rel} differs: copy write-guides' version over wiki-guides' (or the other way) so they match`);
  });
}
