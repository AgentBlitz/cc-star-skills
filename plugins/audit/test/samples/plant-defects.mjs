#!/usr/bin/env node
// plant-defects.mjs — writes one copy of the clean sample audit per planted defect (platform-audit S5).
// Each copy breaks exactly one check-audit check. Rerun it whenever the clean sample changes:
//
//   node test/samples/plant-defects.mjs
//
// The copies sit next to the clean report, so its relative link to the appendix still resolves.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SAMPLE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'partner-portal-audit');
export const CLEAN = 'PARTNER-PORTAL-PLATFORM-AUDIT.md';

/** check name → a function that plants one defect in the clean text. Each must change the text. */
export const DEFECTS = {
  // a route the inventory found, never in backticks
  routes: (t) => t.replaceAll('`/admin/audit-log`', '/admin/audit-log'),
  // one of the fixture account's private terms
  private: (t) => t.replace('| Account menu | ', '| Account menu | Signed in as Dana Example. '),
  // a leftover marker
  markers: (t) => t.replace('**Purpose.** One order in full.', '**Purpose.** One order in full. TODO: check the timeline.'),
  // a row with a cell missing
  tables: (t) => t.replace('| 6 | `/payouts` | Payouts | 📄 |', '| 6 | `/payouts` | 📄 |'),
  // a § reference to a section that doesn't exist
  xref: (t) => t.replace('Finance report | 🔒 | Managers and admins, §6.1 |', 'Finance report | 🔒 | Managers and admins, §16.1 |'),
  // a screen block without its State observed row
  screens: (t) => t.replace('| State observed | Empty: "No payouts yet". |\n', ''),
  // the capability key, gone
  keys: (t) => t.replace(/Key: ✅ available to this role[^\n]*\n[^\n]*\n\n/, ''),
  // a relative link to a file that isn't there
  links: (t) => t.replace('[appendix-ui-labels.md](appendix-ui-labels.md)', '[appendix-ui-labels.md](appendix-ui-label.md)'),
  // the executive summary without "Limits of this audit"
  summary: (t) => t.replace(/\*\*Limits of this audit\*\*\n(- [^\n]*\n)+\n/, ''),
};

export const defectFile = (check) => `defect-${check}.md`;

function main() {
  const clean = fs.readFileSync(path.join(SAMPLE_DIR, CLEAN), 'utf8');
  for (const [check, plant] of Object.entries(DEFECTS)) {
    const text = plant(clean);
    if (text === clean) throw new Error(`the ${check} defect changed nothing: fix plant-defects.mjs`);
    fs.writeFileSync(path.join(SAMPLE_DIR, defectFile(check)), text);
    console.log(`wrote ${defectFile(check)}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
