// A lean set (style.md › Keep the set lean; Checkpoint 1): each screen and region is pictured at
// most once across the set, and no guide carries more than five pictures.
import fs from 'node:fs';
import path from 'node:path';
import { loadSet } from '../../lib/set-grader.mjs';

const MAX_PER_GUIDE = 5;

export default async function ({ cwd }) {
  const plugin = process.env.USER_GUIDES_PLUGIN_DIR;
  let set;
  try {
    set = await loadSet(cwd, plugin);
  } catch (err) {
    return { passed: false, explanation: `guides.json: ${err.message.slice(0, 300)}` };
  }
  const problems = [];
  const counts = [];
  for (const g of set.guides) {
    const file = path.join(cwd, g.file);
    if (!fs.existsSync(file)) continue; // set.mjs reports missing guides
    const n = fs.readFileSync(file, 'utf8').split('\n').filter((l) => /^\s*!\[/.test(l)).length;
    counts.push(`${g.id} ${n}`);
    if (n > MAX_PER_GUIDE) problems.push(`${g.id} has ${n} pictures (at most ${MAX_PER_GUIDE})`);
  }
  // The same screen (the path the shot's state starts on) and region (its locator) twice.
  const seen = new Map();
  for (const s of set.shots) {
    const screen = /^On (\S+?):/.exec(s.state ?? '')?.[1] ?? `?${s.id}`;
    const key = `${screen} ${s.target?.locator ?? 'whole screen'}`;
    if (seen.has(key)) problems.push(`${seen.get(key)} and ${s.id} picture the same ${key}`);
    else seen.set(key, s.id);
  }
  return {
    passed: !problems.length,
    explanation: problems.length ? problems.join('; ').slice(0, 600) : `pictures per guide: ${counts.join(', ')}; ${set.shots.length} shots, no screen twice`,
  };
}
