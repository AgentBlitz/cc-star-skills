// R14: exactly the images the change table names are replaced (here `settings.png`). A release
// alone changes no page (R34): exactly the pages whose text the refresh changed (the scaffold
// works them out, `expectChanged`) reach their next version with a 1.1 message; the rest stay.
import { loadSet } from '../../lib/set-grader.mjs';
import { TOP_ID, ok } from '../../lib/wiki.mjs';

export default async function ({ cwd, vars }) {
  const { before, final, setBefore, expectChanged } = vars;
  const problems = [];
  const att = (cap) => Object.fromEntries(cap.attachments.filter((a) => a.page === TOP_ID).map((a) => [a.title, a]));
  const a0 = att(before);
  const a1 = att(final);
  const replaced = Object.keys(a1).filter((n) => a1[n].sha256 !== a0[n]?.sha256).sort();
  if (replaced.join() !== 'settings.png') problems.push(`images replaced: [${replaced}] (expected [settings.png])`);
  if (Object.keys(a1).length !== Object.keys(a0).length) problems.push(`attachments: ${Object.keys(a0).length} before, ${Object.keys(a1).length} now`);
  const ids = [TOP_ID, ...Object.values(setBefore.publish.confluence.pages).map((p) => p.pageId)];
  for (const id of ids) {
    const p0 = before.pages.find((p) => p.id === id);
    const p1 = final.pages.find((p) => p.id === id);
    if (!p1 || p1.status !== 'current') problems.push(`page ${id} is gone`);
    else {
      const want = expectChanged.includes(id) ? p0.version + 1 : p0.version;
      if (p1.version !== want) problems.push(`page ${id}: version ${p0.version} → ${p1.version} (expected ${want})`);
      if (expectChanged.includes(id) && !/^user-guides 1\.1 sha256:/.test(p1.message || '')) problems.push(`page ${id} has no 1.1 version message`);
      if (/This page is made from/.test(p1.body || '')) problems.push(`page ${id} carries a banner`);
    }
  }
  const created = final.pages.filter((p) => !before.pages.some((q) => q.id === p.id) && p.status === 'current');
  if (created.length) problems.push(`new pages: ${created.map((p) => p.title).join(', ')}`);
  let set;
  try {
    set = await loadSet(cwd, process.env.USER_GUIDES_PLUGIN_DIR);
  } catch (err) {
    return ok([`guides.json: ${err.message.slice(0, 200)}`]);
  }
  const s = set.shots.find((x) => x.id === 'settings');
  if (s.status !== 'taken' || s.release !== '1.1') problems.push(`settings: ${s.status} at ${s.release}`);
  for (const x of set.shots.filter((y) => y.id !== 'settings')) {
    const b = setBefore.shots.find((y) => y.id === x.id);
    if (x.status !== 'taken' || x.release !== b.release || x.fingerprint !== b.fingerprint) problems.push(`${x.id} changed (${x.status}, ${x.release})`);
  }
  for (const [id, p] of Object.entries(set.publish.confluence.pages)) {
    const live = final.pages.find((q) => q.id === p.pageId);
    if (live && p.version !== live.version) problems.push(`publish.confluence.pages.${id}: version ${p.version}, the wiki has ${live.version}`);
  }
  if (set.publish.release !== '1.1') problems.push(`publish.release is ${set.publish.release}`);
  return ok(problems, 'settings.png alone replaced; exactly the changed pages at their next version with a 1.1 message; recorded');
}
