// No go-ahead (D7): an empty mock Data Center wiki and every answer but the go-ahead. A headless run may read the wiki (plan) but must ask before the test page, as plain text, and write nothing.
// The frozen set with its pictures taken (no app needed).
import path from 'node:path';

export async function setup({ cwd, plugin }) {
  const w = await import(path.join(plugin, 'evals', 'scripted', 'lib', 'wiki.mjs'));
  const sc = await w.stageGuides({ cwd, plugin, taken: true });
  sc.commit(cwd, 'Guides for Leave Planner 1.0, pictures taken');
  const m = await w.mock(plugin, {});
  const vars = { under: w.pageAddress(m) };
  return {
    vars,
    cleanup: async () => {
      vars.final = await w.capture(m);
      await m.close();
    },
  };
}
