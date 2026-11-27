#!/usr/bin/env node
// Eval scaffolding (platform-audit PLAN D11). Run as the operator, in the run's workspace (an
// eval-format `scaffold_script`), never in this repo. Node ≥ 20, built-ins only, and no git: the
// skill never runs git, so the workspace needs none (user-guides found git fails inside eval runs).
//
//   node scaffold.mjs repo                        a small repo the audit would be written into
//   node scaffold.mjs check-sample [<check> …]    the repo, plus the sample audit of the Partner
//                                                 Portal fixture in docs/partner-portal-audit/ with
//                                                 one defect planted per check named (default:
//                                                 markers tables xref summary)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN = path.resolve(HERE, '..', '..');
const { DEFECTS, SAMPLE_DIR, CLEAN } = await import(path.join(PLUGIN, 'test', 'samples', 'plant-defects.mjs'));

export const REPORT_DIR = 'docs/partner-portal-audit';
export const DEFAULT_CHECKS = ['markers', 'tables', 'xref', 'summary'];

/** A plain project folder: a README and a .gitignore, nothing the skill would read as an audit. */
export function repo(root) {
  fs.writeFileSync(path.join(root, 'README.md'),
    '# Partner integration\n\nNotes and research for connecting to a partner\'s back office.\n');
  fs.writeFileSync(path.join(root, '.gitignore'), 'node_modules/\n');
  return root;
}

/** The repo, plus the clean sample with each named check's defect planted, and its appendix. */
export function checkSample(root, checks = DEFAULT_CHECKS) {
  repo(root);
  const dir = path.join(root, REPORT_DIR);
  fs.mkdirSync(dir, { recursive: true });
  let text = fs.readFileSync(path.join(SAMPLE_DIR, CLEAN), 'utf8');
  for (const check of checks) {
    if (!DEFECTS[check]) throw new Error(`no planted defect for "${check}"`);
    const next = DEFECTS[check](text);
    if (next === text) throw new Error(`the ${check} defect changed nothing`);
    text = next;
  }
  fs.writeFileSync(path.join(dir, CLEAN), text);
  fs.copyFileSync(path.join(SAMPLE_DIR, 'appendix-ui-labels.md'), path.join(dir, 'appendix-ui-labels.md'));
  return path.join(REPORT_DIR, CLEAN);
}

export function main(argv) {
  const [cmd, ...rest] = argv;
  const root = process.cwd();
  if (cmd === 'repo') repo(root);
  else if (cmd === 'check-sample') checkSample(root, rest.length ? rest : DEFAULT_CHECKS);
  else {
    console.error('usage: scaffold.mjs repo | check-sample [<check> …]');
    return 2;
  }
  return 0;
}

if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
