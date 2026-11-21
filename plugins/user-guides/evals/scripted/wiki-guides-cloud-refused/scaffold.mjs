// Cloud refused (D6, R31): the mock in its cloud mode, which looks like Confluence Cloud while its REST calls still work, so "no write request" proves the skill refused.
// The frozen set with its pictures taken (no app needed).
import path from 'node:path';

export async function setup({ cwd, plugin }) {
  const w = await import(path.join(plugin, 'evals', 'scripted', 'lib', 'wiki.mjs'));
  const sc = await w.stageGuides({ cwd, plugin, taken: true });
  sc.commit(cwd, 'Guides for Leave Planner 1.0, pictures taken');
  const m = await w.mock(plugin, { mode: 'cloud' });
  const vars = { under: w.pageAddress(m) };
  return {
    vars,
    cleanup: async () => {
      vars.final = await w.capture(m);
      await m.close();
    },
  };
}
