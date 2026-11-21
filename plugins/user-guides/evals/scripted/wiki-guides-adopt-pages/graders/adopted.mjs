// The three guides are registered `written`, their five images `taken` with no fingerprint (no
// shot invented, none left out), no guide or image file changed, and the hand-made pages were
// updated in place by id (no new guide page), each now carrying the publisher's message.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { loadSet } from '../../lib/set-grader.mjs';
import { TOP_ID, bannerRelease, ok } from '../../lib/wiki.mjs';

const MARK = /^user-guides \S+ sha256:[0-9a-f]{64}$/;

export default async function ({ cwd, vars }) {
  const problems = [];
  let set;
  try {
    set = await loadSet(cwd, process.env.USER_GUIDES_PLUGIN_DIR);
  } catch (err) {
    return ok([`docs/user-guides/guides.json: ${err.message.slice(0, 200)}`]);
  }
  const files = set.guides.map((g) => g.file).sort().join();
  if (files !== 'docs/user-guides/employee.md,docs/user-guides/getting-started.md,docs/user-guides/manager.md') problems.push(`guides registered: ${files}`);
  if (set.guides.some((g) => g.status !== 'written')) problems.push(`guide statuses: ${set.guides.map((g) => g.status)}`);
  const shots = set.shots.map((s) => s.path).sort().join();
  const want = ['home-first-look', 'inbox', 'my-requests', 'request-dialog', 'settings'].map((n) => `docs/user-guides/images/${n}.png`).join();
  if (shots !== want) problems.push(`shots registered: ${shots}`);
  if (set.shots.some((s) => s.status !== 'taken' || s.fingerprint)) problems.push('a shot is not taken, or has a fingerprint');
  const dir = path.join(cwd, 'docs', 'user-guides');
  for (const [f, h] of Object.entries(vars.hashes)) {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) problems.push(`${f} is gone`);
    else if (crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') !== h) problems.push(`${f} was changed`);
  }
  const { before, final } = vars;
  for (const id of ['1010', '1011', '1012', TOP_ID]) {
    const p0 = before.pages.find((p) => p.id === id);
    const p1 = final.pages.find((p) => p.id === id);
    if (!p1 || p1.status !== 'current') problems.push(`page ${id} is gone`);
    else {
      if (p1.version !== p0.version + 1) problems.push(`page ${id}: version ${p0.version} → ${p1.version}`);
      if (!MARK.test(p1.message || '')) problems.push(`page ${id} has no publisher message`);
      if (!bannerRelease(p1.body, '1.0')) problems.push(`page ${id} has no 1.0 banner`);
    }
  }
  const made = final.pages.filter((p) => !before.pages.some((q) => q.id === p.id) && p.status === 'current');
  if (made.length) problems.push(`new pages left: ${made.map((p) => p.title).join(', ')}`);
  const pages = set.publish?.confluence?.pages || {};
  const recorded = Object.values(pages).map((p) => p.pageId).sort().join();
  if (recorded !== '1010,1011,1012') problems.push(`publish.confluence.pages: ${recorded}`);
  return ok(problems, 'three guides and five images adopted as they are; pages 1010–1012 updated in place');
}
