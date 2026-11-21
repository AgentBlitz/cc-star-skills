// Republish after v2 (R14, R28): the frozen set with its pictures taken and published at 1.0 to
// the mock (by the operator, with the plugin's scripts), then release 1.1 (v2) served where 1.0
// was, and write-guides' refresh applied as it leaves the set: `settings` (the one shot R14's
// table names for this set) marked retake, the renamed button and the removed checkbox fixed in
// the text. The run retakes that one shot and republishes.
import fs from 'node:fs';
import path from 'node:path';

export async function setup({ cwd, plugin }) {
  const w = await import(path.join(plugin, 'evals', 'scripted', 'lib', 'wiki.mjs'));
  const gs = await import(path.join(plugin, 'skills', 'write-guides', 'scripts', 'guide-set.mjs'));
  const { releaseV2 } = await import(path.join(plugin, 'test', 'stage.mjs'));
  const sc = await w.stageGuides({ cwd, plugin, taken: true });
  const v1 = await w.serve(cwd);
  await w.setBaseUrl(cwd, plugin, v1.url);
  const m = await w.mock(plugin);
  await w.operatorPublish({ cwd, plugin, m, release: '1.0' });
  sc.commit(cwd, 'Guides for Leave Planner 1.0, published');
  const before = await w.capture(m);

  // Release 1.1, and the refresh's result.
  await v1.stop();
  releaseV2(cwd);
  const setFile = path.join(cwd, w.SET_FILE);
  const set = gs.loadGuideSet(setFile);
  gs.moveShot(set, 'settings', 'retake', { by: 'write-guides' });
  gs.saveGuideSet(setFile, set);
  for (const g of set.guides) {
    const f = path.join(cwd, g.file);
    const text = fs
      .readFileSync(f, 'utf8')
      .replace(/\*\*Request leave\*\*(?! dialog)/g, '**New request**')
      .split('\n')
      .filter((l) => !/Sync my leave to my calendar/.test(l))
      .join('\n');
    fs.writeFileSync(f, text);
  }
  const readme = path.join(path.dirname(setFile), 'README.md');
  fs.writeFileSync(readme, gs.updateIndex(fs.readFileSync(readme, 'utf8'), set, 'docs/user-guides/README.md'));
  sc.commit(cwd, 'Refresh the guides for 1.1');
  // The pages 1.1 must send: those whose storage format differs from what 1.0 left on the wiki.
  // A release alone changes no page (R34), and pictures are attached by name, so only text counts.
  const { prepare, pageXhtml } = await import(path.join(plugin, 'skills', 'wiki-guides', 'scripts', 'to-confluence.mjs'));
  const prep = prepare({ root: cwd, setFile: w.SET_FILE, release: '1.1', topTitle: w.TOP_TITLE });
  if (prep.problems.length) throw new Error(`the 1.1 set does not convert: ${prep.problems[0].message || prep.problems[0]}`);
  const live = (match) => (before.pages.find(match)?.body || '').trim();
  const expectChanged = [];
  if (pageXhtml(prep, 'top').trim() !== live((p) => p.id === w.TOP_ID)) expectChanged.push(w.TOP_ID);
  for (const pg of prep.pages) {
    const was = before.pages.find((p) => p.title === pg.title && p.status === 'current');
    if (was && pageXhtml(prep, pg).trim() !== (was.body || '').trim()) expectChanged.push(was.id);
  }
  if (!expectChanged.length) throw new Error('the 1.1 refresh changes no page: the case would test nothing');
  const v2 = await w.serve(cwd, v1.port);
  const vars = { before, expectChanged, setBefore: JSON.parse(fs.readFileSync(setFile, 'utf8')) };
  return {
    env: { EVAL_LEAVE_APP: '1' },
    vars,
    cleanup: async () => {
      vars.final = await w.capture(m);
      await m.close();
      await v2.stop();
    },
  };
}
