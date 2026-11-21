// Adopt (R21, reusing S8's adopted-pages scenario): the Leave Planner guides with their pictures,
// as someone wrote them by hand, with no guides.json (the README index keeps its intro and list,
// not the status block), and the mock seeded `adopted`: the same three guides already on the
// wiki as hand-made pages under the top page, and a settings.png uploaded by hand.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export async function setup({ cwd, plugin }) {
  const w = await import(path.join(plugin, 'evals', 'scripted', 'lib', 'wiki.mjs'));
  const gs = await import(path.join(plugin, 'skills', 'write-guides', 'scripts', 'guide-set.mjs'));
  const sc = await w.stageGuides({ cwd, plugin, taken: true });
  const dir = path.join(cwd, 'docs', 'user-guides');
  fs.rmSync(path.join(dir, 'guides.json'));
  fs.rmSync(path.join(cwd, '.user-guides'), { recursive: true, force: true });
  const readme = path.join(dir, 'README.md');
  const text = fs.readFileSync(readme, 'utf8');
  fs.writeFileSync(readme, text.slice(0, text.indexOf(gs.INDEX_BEGIN)).trimEnd() + '\n');
  sc.commit(cwd, 'Add the help pages');
  const files = ['getting-started.md', 'employee.md', 'manager.md'];
  const hashes = Object.fromEntries(
    fs.readdirSync(dir, { recursive: true }).filter((f) => /\.(md|png)$/.test(f) && f !== 'README.md').map((f) => [f, crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, f))).digest('hex')]),
  );
  const m = await w.mock(plugin, { seed: 'adopted' });
  const before = await w.capture(m);
  const vars = { under: w.pageAddress(m), files: files.map((f) => `docs/user-guides/${f}`).join(','), hashes, before };
  return {
    vars,
    cleanup: async () => {
      vars.final = await w.capture(m);
      await m.close();
    },
  };
}
