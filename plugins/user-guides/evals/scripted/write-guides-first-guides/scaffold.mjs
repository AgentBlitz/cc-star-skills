// First guides: the staged fixture (v1) running on a free port of 127.0.0.1, and every interview
// answer in guides.json with Round 3 recorded as "approve as proposed" (R9). The run itself
// never starts the app: a headless run must not (R9), so the scaffold does, and stops it after.
import path from 'node:path';

export async function setup({ cwd, plugin }) {
  const sc = await import(path.join(plugin, 'evals', 'lib', 'scaffold.mjs'));
  const { startFixture } = await import(path.join(plugin, 'test', 'helpers.mjs'));
  sc.stageInto(cwd, 'v1');
  const app = await startFixture(cwd);
  sc.writeAnswers(cwd, 'walk', app.url);
  sc.commit(cwd, 'Add the guide answers');
  return { env: { EVAL_LEAVE_APP: '1' }, vars: { url: app.url }, cleanup: app.stop };
}
