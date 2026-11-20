// A script grader shared by the scripted cases: loads guides.json through the contract's own
// validator and checks the set against what a finished run must leave.
import fs from 'node:fs';
import path from 'node:path';

export async function loadSet(cwd, plugin, rel = 'docs/user-guides/guides.json') {
  const gs = await import(path.join(plugin, 'skills', 'write-guides', 'scripts', 'guide-set.mjs'));
  return gs.loadGuideSet(path.join(cwd, rel));
}

/** Every guide file exists, has no template leftovers, and links each of its shots' images. */
export function guidesAndPictures(cwd, set) {
  const problems = [];
  for (const g of set.guides) {
    const f = path.join(cwd, g.file);
    if (!fs.existsSync(f)) {
      problems.push(`${g.file} is missing`);
      continue;
    }
    const text = fs.readFileSync(f, 'utf8');
    if (/\{\{\w+\}\}|<!--\s*template/i.test(text)) problems.push(`${g.file} has template leftovers`);
    for (const s of set.shots.filter((s2) => s2.guides.includes(g.id))) {
      const rel = path.relative(path.dirname(g.file), s.path).split(path.sep).join('/');
      if (!text.includes(rel)) problems.push(`${g.file} does not link ${rel}`);
    }
  }
  for (const s of set.shots) if (!fs.existsSync(path.join(cwd, s.path))) problems.push(`${s.path} is missing`);
  return problems;
}
