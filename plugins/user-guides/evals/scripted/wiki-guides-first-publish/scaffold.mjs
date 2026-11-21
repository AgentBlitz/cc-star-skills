// First publish (PLAN §5 S9): the frozen guide set with every picture still a placeholder, over a
// staged v1 fixture that is served, and an empty mock Confluence (Data Center). The run takes the
// shots, reads each one back, swaps them in, converts, publishes the test page and removes it,
// then publishes the real pages through the Node host (the mock is on this machine).
import path from 'node:path';

export async function setup({ cwd, plugin }) {
  const w = await import(path.join(plugin, 'evals', 'scripted', 'lib', 'wiki.mjs'));
  const sc = await w.stageGuides({ cwd, plugin });
  const app = await w.serve(cwd);
  await w.setBaseUrl(cwd, plugin, app.url);
  sc.commit(cwd, 'Guides for Leave Planner 1.0, pictures to take');
  const m = await w.mock(plugin);
  const vars = { under: w.pageAddress(m) };
  return {
    env: { EVAL_LEAVE_APP: '1' },
    vars,
    cleanup: async () => {
      vars.final = await w.capture(m);
      await m.close();
      await app.stop();
    },
  };
}
