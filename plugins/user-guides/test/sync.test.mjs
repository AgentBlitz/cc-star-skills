// The shared files: both skills carry byte-identical copies (PLAN §2.3). kit-core.mjs joined in
// S2; md.mjs joins in S7 (move it to SHARED then).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills');
export const SHARED = ['scripts/guide-set.mjs', 'reference/guide-set.md', 'scripts/kit-core.mjs'];
export const OPTIONAL_SHARED = ['scripts/md.mjs'];

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
