// Every script's CLI runs when it is called through a symlinked path (S3: on macOS a temp or
// cache path under /var is /private/var, and a main-module guard comparing argv[1] with
// import.meta.url as they stand skipped main() and exited 0 having done nothing).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PLUGIN_DIR } from './helpers.mjs';

const SCRIPTS = ['check-guides', 'guide-set', 'set-edit', 'walk-lib', 'placeholder', 'to-confluence', 'to-html', 'bundle'];

test('each script CLI answers through a symlinked path', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ug-link-'));
  const link = path.join(dir, 'plugin');
  fs.symlinkSync(PLUGIN_DIR, link);
  try {
    for (const skill of ['write-guides', 'wiki-guides']) {
      for (const name of SCRIPTS) {
        const f = path.join(link, 'skills', skill, 'scripts', `${name}.mjs`);
        if (!fs.existsSync(f)) continue;
        const r = spawnSync('node', [f, '--no-such-option'], { cwd: dir, encoding: 'utf8' });
        assert.ok((r.stdout + r.stderr).trim().length > 0, `${skill}/${name}.mjs printed nothing through a symlink`);
      }
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
