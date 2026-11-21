// Every guide is a page under the top page and the release is recorded (no banner: R34), every picture is
// attached once to the top page, the test page was made and removed, and guides.json records it.
import path from 'node:path';
import { loadSet } from '../../lib/set-grader.mjs';
import { GUIDE_TITLES, TOP_ID, byTitle, ok } from '../../lib/wiki.mjs';

export default async function ({ cwd, vars }) {
  const cap = vars.final;
  const problems = [];
  const top = cap.pages.find((p) => p.id === TOP_ID);
  if (!/^user-guides 1\.0 sha256:/.test(top?.message || '')) problems.push('the top page has no 1.0 version message');
  if (cap.pages.some((p) => p.status === 'current' && /This page is made from/.test(p.body || ''))) problems.push('a page carries a banner');
  for (const [id, title] of Object.entries(GUIDE_TITLES)) {
    const p = byTitle(cap, title);
    if (!p) problems.push(`no page "${title}"`);
    else {
      if (p.parent !== TOP_ID) problems.push(`"${title}" is not under the top page`);
    }
  }
  const atts = cap.attachments.filter((a) => a.page === TOP_ID);
  const names = atts.map((a) => a.title).sort().join();
  if (names !== 'home-first-look.png,inbox.png,my-requests.png,request-dialog.png,settings.png') problems.push(`top page attachments: ${names}`);
  if (atts.some((a) => !/^sha256:/.test(a.comment || ''))) problems.push('an attachment has no sha256 comment');
  const test = cap.pages.find((p) => /: publishing test$/.test(p.title));
  if (!test) problems.push('no test page was published');
  else if (test.status === 'current') problems.push('the test page was not removed');
  let set;
  try {
    set = await loadSet(cwd, process.env.USER_GUIDES_PLUGIN_DIR);
  } catch (err) {
    return ok([`guides.json: ${err.message.slice(0, 200)}`]);
  }
  const notTaken = set.shots.filter((s) => s.status !== 'taken' || !s.fingerprint || !s.path.endsWith('.png')).map((s) => `${s.id}=${s.status}`);
  if (notTaken.length) problems.push(`shots not taken: ${notTaken.join(', ')}`);
  const pages = set.publish?.confluence?.pages || {};
  for (const id of Object.keys(GUIDE_TITLES)) if (!pages[id]?.pageId) problems.push(`publish.confluence.pages has no ${id}`);
  if (String(set.publish?.confluence?.topPageId) !== TOP_ID) problems.push('topPageId is not recorded');
  if (set.publish?.release !== '1.0') problems.push(`publish.release is ${set.publish?.release}`);
  void path;
  return ok(problems, 'three pages under the top page, five pictures, test page removed, recorded');
}
