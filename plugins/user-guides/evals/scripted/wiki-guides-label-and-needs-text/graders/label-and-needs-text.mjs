// The renamed button is fixed in the employee guide (and the guide is `written` again), the
// dialog keeps its name, `settings` is `needs-text` with a note and keeps its card, the removed
// checkbox is left in the text for write-guides, and the other four shots are taken.
import fs from 'node:fs';
import path from 'node:path';
import { loadSet } from '../../lib/set-grader.mjs';
import { ok } from '../../lib/wiki.mjs';

export default async function ({ cwd }) {
  const problems = [];
  let set;
  try {
    set = await loadSet(cwd, process.env.USER_GUIDES_PLUGIN_DIR);
  } catch (err) {
    return ok([`guides.json: ${err.message.slice(0, 200)}`]);
  }
  const emp = fs.readFileSync(path.join(cwd, 'docs/user-guides/employee.md'), 'utf8');
  if (/Select \*\*Request leave\*\*(?! dialog)\./.test(emp) || /Select \*\*Request leave\*\*\. /.test(emp)) problems.push('employee.md still says Select **Request leave**');
  if (!/\*\*New request\*\*/.test(emp)) problems.push('employee.md does not name **New request**');
  if (!/\*\*Request leave\*\* dialog/.test(emp)) problems.push('the Request leave dialog lost its name');
  if (!/Sync my leave to my calendar/.test(emp)) problems.push('the removed checkbox was cut from the text (that is write-guides\' job)');
  const g = set.guides.find((x) => x.id === 'employee');
  if (g.status !== 'written') problems.push(`employee guide is ${g.status} (expected written after the label fix)`);
  const s = set.shots.find((x) => x.id === 'settings');
  if (s.status !== 'needs-text' || !s.note) problems.push(`settings is ${s.status}${s.note ? '' : ' with no note'}`);
  else if (!/calendar|sync|checkbox|removed|no longer/i.test(s.note)) problems.push(`settings' note does not say what is wrong: ${s.note}`);
  if (!fs.existsSync(path.join(cwd, 'docs/user-guides/images/settings.svg'))) problems.push('settings lost its card');
  const others = set.shots.filter((x) => x.id !== 'settings' && (x.status !== 'taken' || x.release !== '1.1'));
  if (others.length) problems.push(`not taken at 1.1: ${others.map((x) => `${x.id}=${x.status}`).join(', ')}`);
  return ok(problems, 'label fixed, settings needs-text, the rest taken');
}
