// Refresh after v2 (R14, R15): the frozen guide set (fixtures/leave-app-guides) in a staged v1
// copy, its pictures "taken" with v1 fingerprints (written here with kit-core.mjs, through
// walk-lib's shotFingerprint, as wiki-guides would record them), and committed as release 1.0.
// Then the copy is released as v2 (1.1) and served on the same port, for a headless
// `/user-guides:write-guides refresh`.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function serve(cwd, port = 0) {
  const child = spawn('node', ['server.mjs', '--port', String(port)], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((resolve, reject) => {
    let out = '';
    child.stdout.on('data', (d) => {
      out += d;
      const m = out.match(/listening on (http:\/\/127\.0\.0\.1:(\d+))/);
      if (m) resolve({ url: m[1], port: Number(m[2]), stop: () => new Promise((r) => (child.exitCode !== null ? r() : (child.once('exit', r), child.kill()))) });
    });
    child.on('exit', (code) => reject(new Error(`server exited ${code}: ${out}`)));
  });
}

export async function setup({ cwd, plugin }) {
  const S = path.join(plugin, 'skills', 'write-guides', 'scripts');
  const sc = await import(path.join(plugin, 'evals', 'lib', 'scaffold.mjs'));
  const { releaseV2 } = await import(path.join(plugin, 'test', 'stage.mjs'));
  const gs = await import(path.join(S, 'guide-set.mjs'));
  const wl = await import(path.join(S, 'walk-lib.mjs'));
  sc.stageInto(cwd, 'v1');
  fs.cpSync(path.join(plugin, 'fixtures', 'leave-app-guides'), cwd, { recursive: true, filter: (p) => path.basename(p) !== 'README.md' || !p.endsWith(path.join('leave-app-guides', 'README.md')) });

  const v1 = await serve(cwd);
  const setFile = path.join(cwd, sc.SET_FILE);
  let set = gs.loadGuideSet(setFile);
  set.app.baseUrl = v1.url;
  set.interview.answers.appBaseUrl = v1.url;
  gs.saveGuideSet(setFile, set);

  // The v1 walk, as the first run left it: the crawl and the kept walk scripts.
  const env = { ...process.env, EVAL_LEAVE_APP: '1', USER_GUIDES_SCRIPTS: S };
  delete env.CLAUDECODE;
  execFileSync('node', [path.join(S, 'walk-lib.mjs'), 'crawl', '--set', sc.SET_FILE, '--fetch'], { cwd, env, stdio: 'ignore' });
  const walkDir = path.join(cwd, '.user-guides', 'walk');
  for (const f of fs.readdirSync(walkDir).filter((n) => n.endsWith('.mjs')))
    execFileSync('node', [path.join(walkDir, f)], { cwd, env, stdio: 'ignore' });

  // Take every picture: a PNG in place of the card, the v1 fingerprint, release 1.0.
  set = gs.loadGuideSet(setFile);
  const outline = wl.loadOutline(walkDir);
  const takenAt = '2026-11-01T10:00:00.000Z';
  for (const shot of set.shots) {
    const { fingerprint } = wl.shotFingerprint(walkDir, outline, shot);
    if (!fingerprint) throw new Error(`no v1 fingerprint for shot ${shot.id}`);
    const png = shot.path.replace(/\.svg$/, '.png');
    fs.writeFileSync(path.join(cwd, png), sc.PNG_1X1);
    fs.rmSync(path.join(cwd, shot.path));
    for (const g of set.guides.filter((g2) => shot.guides.includes(g2.id))) {
      const f = path.join(cwd, g.file);
      fs.writeFileSync(f, fs.readFileSync(f, 'utf8').split(path.basename(shot.path)).join(path.basename(png)));
    }
    gs.moveShot(set, shot.id, 'taken', { by: 'wiki-guides', path: png, takenAt, release: '1.0', fingerprint });
  }
  set.publish = { release: '1.0' };
  gs.saveGuideSet(setFile, set);
  const readme = path.join(path.dirname(setFile), 'README.md');
  fs.writeFileSync(readme, gs.updateIndex(fs.readFileSync(readme, 'utf8'), set, path.posix.join(path.posix.dirname(sc.SET_FILE), 'README.md')));
  sc.commit(cwd, 'Guides for Leave Planner 1.0, pictures taken');
  const before = JSON.parse(fs.readFileSync(setFile, 'utf8'));

  // Release 1.1 (v2), served where 1.0 was.
  await v1.stop();
  releaseV2(cwd);
  const v2 = await serve(cwd, v1.port);
  return { env: { EVAL_LEAVE_APP: '1' }, vars: { url: v2.url, before }, cleanup: v2.stop };
}
