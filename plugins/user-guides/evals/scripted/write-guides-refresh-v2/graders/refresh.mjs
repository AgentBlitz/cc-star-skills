// Refresh after v2: the pictures retaken are exactly those R14's change table names, applied to
// this set's own shots (an oracle from the table, not from the skill's fingerprints), and the
// text follows the new screens: the button is **New request**, the removed checkbox is gone,
// and the dialog, which v2 leaves alone, keeps its name.
import fs from 'node:fs';
import path from 'node:path';
import { loadSet } from '../../lib/set-grader.mjs';

const pathOf = (state) => (String(state).match(/^On (\/[^\s:]*)/) || [])[1] || null;

/** R14: a shot retakes when its region contains the Requests toolbar or the Notifications panel. */
export function mustRetake(shot) {
  const p = pathOf(shot.state);
  const loc = shot.target?.locator || null;
  if (p === '/requests') return loc === null || /requests-toolbar/.test(loc);
  if (p === '/settings') return loc === null || /settings-notifications|Notifications/.test(loc);
  return false;
}

export default async function ({ cwd, vars }) {
  const plugin = process.env.USER_GUIDES_PLUGIN_DIR;
  let set;
  try {
    set = await loadSet(cwd, plugin);
  } catch (err) {
    return { passed: false, explanation: `guides.json: ${err.message.slice(0, 300)}` };
  }
  const problems = [];
  const before = new Map(vars.before.shots.map((s) => [s.id, s]));
  const want = vars.before.shots.filter(mustRetake).map((s) => s.id).sort();
  const got = set.shots.filter((s) => s.status === 'retake').map((s) => s.id).sort();
  if (want.join() !== got.join()) problems.push(`retake: expected [${want}] got [${got}]`);
  for (const s of set.shots.filter((x) => x.status === 'taken'))
    if (s.fingerprint !== before.get(s.id)?.fingerprint) problems.push(`${s.id}: fingerprint changed while still taken`);
  if (set.shots.length !== vars.before.shots.length) problems.push(`shots: ${vars.before.shots.length} before, ${set.shots.length} now`);

  const texts = set.guides.map((g) => [g.file, fs.readFileSync(path.join(cwd, g.file), 'utf8')]);
  const all = texts.map(([, t]) => t).join('\n');
  for (const [f, t] of texts) {
    if (/(Select|Press|Click|Choose|Use)\s+\*\*Request leave\*\*(?!\s+dialog)/.test(t)) problems.push(`${f} still tells the reader to select **Request leave**`);
    if (/Sync my leave to my calendar/i.test(t)) problems.push(`${f} still names the removed checkbox`);
  }
  const wereButton = vars.before.guides.length; // every guide in the frozen set has a "Select **Request leave**" step
  const nowNew = (all.match(/\*\*New request\*\*/g) || []).length;
  if (nowNew < Math.min(3, wereButton)) problems.push(`**New request** appears ${nowNew}x (expected ≥ 3)`);
  if (!/\*\*Request leave\*\* dialog|dialog[^.\n]*\*\*Request leave\*\*/.test(all)) problems.push('the Request leave dialog lost its name');
  const notChecked = set.guides.filter((g) => g.status !== 'checked').map((g) => `${g.id}=${g.status}`);
  if (notChecked.length) problems.push(`not checked after the refresh: ${notChecked.join(', ')}`);
  return { passed: !problems.length, explanation: problems.length ? problems.join('; ').slice(0, 700) : `retake [${got}]; text updated` };
}
