// A label fix and a needs-text (D5, R7): the frozen set's guides, written at 1.0, photographed
// for the first time against 1.1 (v2). The `my-requests` shot is widened to the whole Requests
// screen, so its picture shows the toolbar button now named **New request** while the guide
// says **Request leave**: a wrong label, which wiki-guides fixes. The `settings` picture lacks
// the checkbox the guide's table still names: a removed feature, so the shot is `needs-text`
// and the text is left for write-guides.
import path from 'node:path';

export async function setup({ cwd, plugin }) {
  const w = await import(path.join(plugin, 'evals', 'scripted', 'lib', 'wiki.mjs'));
  const gs = await import(path.join(plugin, 'skills', 'write-guides', 'scripts', 'guide-set.mjs'));
  const { releaseV2 } = await import(path.join(plugin, 'test', 'stage.mjs'));
  const sc = await w.stageGuides({ cwd, plugin });
  const setFile = path.join(cwd, w.SET_FILE);
  const set = gs.loadGuideSet(setFile);
  const shot = set.shots.find((s) => s.id === 'my-requests');
  shot.target = { what: 'the Requests screen, whole', locator: null };
  shot.alt = 'My requests: the button that opens a new request, above the table of your requests';
  gs.saveGuideSet(setFile, set);
  sc.commit(cwd, 'Guides for Leave Planner 1.0');
  releaseV2(cwd);
  const app = await w.serve(cwd);
  await w.setBaseUrl(cwd, plugin, app.url);
  sc.commit(cwd, 'Point the guides at the local app');
  return { env: { EVAL_LEAVE_APP: '1' }, vars: {}, cleanup: () => app.stop() };
}
