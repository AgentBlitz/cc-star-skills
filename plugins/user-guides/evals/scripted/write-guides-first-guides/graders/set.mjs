// First guides: three guides (a role guide each for employee and manager, getting started), all
// checked against the walk; every picture a placeholder card linked from its guides.
import path from 'node:path';
import { loadSet, guidesAndPictures } from '../../lib/set-grader.mjs';

export default async function ({ cwd }) {
  const plugin = process.env.USER_GUIDES_PLUGIN_DIR;
  let set;
  try {
    set = await loadSet(cwd, plugin);
  } catch (err) {
    return { passed: false, explanation: `guides.json: ${err.message.slice(0, 300)}` };
  }
  const problems = [];
  const types = set.guides.map((g) => g.type);
  if (types.filter((t) => t === 'role-guide').length < 2) problems.push(`role guides: ${types.join(', ')}`);
  if (!types.includes('getting-started')) problems.push('no getting-started guide');
  for (const role of ['employee', 'manager'])
    if (!set.guides.some((g) => g.type === 'role-guide' && g.audience.includes(role))) problems.push(`no role guide for ${role}`);
  const unchecked = set.guides.filter((g) => g.status !== 'checked').map((g) => `${g.id}=${g.status}`);
  if (unchecked.length) problems.push(`not checked: ${unchecked.join(', ')}`);
  if (set.shots.length < set.guides.length) problems.push(`only ${set.shots.length} shots for ${set.guides.length} guides`);
  const notPlaceholder = set.shots.filter((s) => s.status !== 'placeholder' || !s.path.endsWith('.svg')).map((s) => s.id);
  if (notPlaceholder.length) problems.push(`not placeholders: ${notPlaceholder.join(', ')}`);
  const badAlt = set.shots.filter((s) => !/^[^:]+: \S/.test(s.alt)).map((s) => s.id);
  if (badAlt.length) problems.push(`alt not "Screen: what to notice": ${badAlt.join(', ')}`);
  problems.push(...guidesAndPictures(cwd, set));
  return {
    passed: !problems.length,
    explanation: problems.length ? problems.join('; ').slice(0, 600) : `${set.guides.length} guides checked, ${set.shots.length} placeholders`,
  };
}
