#!/usr/bin/env node
// appendix.mjs — writes the report's label appendix, appendix-ui-labels.md, from inventory.json
// (platform-audit PLAN §2.4, §2.6). Node ≥ 20, built-ins only. The output is deterministic: the same
// inventory, map and options always give the same bytes.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const USAGE = `Usage:
  node appendix.mjs <inventory.json> --map <label-map.json> --title "<Product>" --out <file>
                    [--build <name>] [--date <YYYY-MM-DD>] [--report <file name>]

Writes the UI label appendix: a contents list with counts, then one table per screen
(Component group | Labels), then the shared-library group, then the label ids without built-in text.

  --map <file>     label-map.json: { "<component group>": "<screen heading>" }. A key ending in *
                   matches a prefix (an exact key wins, then the longest prefix). The heading "shared"
                   sends a group to the shared-library section. Headings come out in the map's order;
                   a group the map doesn't name goes under "Other".
  --title <name>   the product's name, for the appendix's title
  --out <file>     where to write it
  --build <name>   the main script's file name, quoted in the opening paragraph
  --date <date>    the day the bundle was read, quoted in the opening paragraph
  --report <file>  the report's file name, linked from the opening paragraph

Exit 0 on success, 2 on a usage error.`;

export const SHARED_TITLE = 'Shared library (labels bundled with the app; a screen may not use them)';
export const OTHER_TITLE = 'Other';

const cmp = (a, b) => {
  const x = a.toLowerCase(), y = b.toLowerCase();
  return x < y ? -1 : x > y ? 1 : a < b ? -1 : a > b ? 1 : 0;
};
const esc = (s) => String(s).replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|');

/** Which heading a component group goes under: exact key, then the longest prefix key, then Other. */
export function headingFor(group, map) {
  if (Object.hasOwn(map, group)) return map[group];
  let best = null;
  for (const k of Object.keys(map)) {
    if (!k.endsWith('*')) continue;
    const pre = k.slice(0, -1);
    if (group.startsWith(pre) && (best === null || pre.length > best.length)) best = pre;
  }
  return best === null ? OTHER_TITLE : map[best + '*'];
}

/** Build the appendix's markdown. Pure: the same arguments always give the same string. */
export function buildAppendix(inv, map, { title, build = null, date = null, report = null }) {
  const labels = inv.labels ?? {};
  const isShared = (h) => String(h).trim().toLowerCase() === 'shared';

  // Sections: the map's headings in order of first appearance, then Other, then the shared library.
  const order = [];
  for (const h of Object.values(map)) if (!isShared(h) && !order.includes(h)) order.push(h);
  order.push(OTHER_TITLE, SHARED_TITLE);
  const sections = new Map(order.map((h) => [h, []]));
  for (const group of Object.keys(labels).sort(cmp)) {
    const h = headingFor(group, map);
    sections.get(isShared(h) ? SHARED_TITLE : h).push(group);
  }

  const count = (groups) => groups.reduce((n, g) => n + Object.keys(labels[g]).length, 0);
  const groupCount = Object.keys(labels).length;
  const labelCount = count(Object.keys(labels));

  let md = `# ${title} — UI label inventory (Appendix B)\n\n`;
  const companion = report ? `This is the companion to [${report}](${report}). ` : '';
  const read = [build && `build \`${build}\``, date && `read on ${date}`].filter(Boolean).join(', ');
  md += `${companion}It lists the **${labelCount} UI labels**, in **${groupCount} component groups**, `;
  md += `found in the ${title} web app${read ? ` (${read})` : ''}, grouped by the screen that uses them. `;
  md += 'The app fills in placeholders such as `{count}` at run time.\n\n';
  if (sections.get(SHARED_TITLE).length) {
    md += 'The shared-library group comes with shared components. It shows what the components support, ';
    md += '**not** what this product uses.\n\n';
  }

  md += '## Contents\n\n';
  for (const [h, groups] of sections) {
    if (groups.length) md += `- ${h} — ${groups.length} group${groups.length === 1 ? '' : 's'}, ${count(groups)} labels\n`;
  }
  const ids = [...new Set(inv.idsWithoutText ?? [])].sort(cmp);
  if (ids.length) md += `- Label ids without built-in text — ${ids.length}\n`;
  md += '\n';

  for (const [h, groups] of sections) {
    if (!groups.length) continue;
    md += `## ${h}\n\n| Component group | Labels |\n|---|---|\n`;
    for (const g of groups) {
      const byId = labels[g];
      const texts = [...new Set(Object.keys(byId).sort(cmp).map((id) => esc(byId[id])))].filter(Boolean);
      md += `| \`${esc(g)}\` | ${texts.join(' · ')} |\n`;
    }
    md += '\n';
  }
  if (ids.length) {
    md += `## Label ids without built-in text (${ids.length})\n\n`;
    md += 'The app looks these ids up at run time, from a language pack the bundle doesn\'t include.\n\n';
    md += ids.map((i) => `\`${esc(i)}\``).join(' · ') + '\n';
  }
  return { md, sections, labelCount, groupCount, ids: ids.length };
}

function parseArgs(argv) {
  const o = { inv: null, map: null, title: null, out: null, build: null, date: null, report: null };
  const takes = { '--map': 'map', '--title': 'title', '--out': 'out', '--build': 'build', '--date': 'date', '--report': 'report' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') return { help: true };
    if (takes[a]) {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      o[takes[a]] = argv[++i];
    } else if (a.startsWith('--')) throw new Error(`unknown option ${a}`);
    else if (!o.inv) o.inv = a;
    else throw new Error(`unexpected argument ${a}`);
  }
  for (const k of ['inv', 'map', 'title', 'out']) if (!o[k]) throw new Error(k === 'inv' ? 'name the inventory.json' : `--${k} is required`);
  if (o.date && !/^\d{4}-\d{2}-\d{2}$/.test(o.date)) throw new Error('--date takes YYYY-MM-DD');
  return o;
}

function main(argv) {
  let o;
  try {
    o = parseArgs(argv);
  } catch (e) {
    console.error(`appendix.mjs: ${e.message}\n\n${USAGE}`);
    return 2;
  }
  if (o.help) {
    console.log(USAGE);
    return 0;
  }
  let inv, map;
  try {
    inv = JSON.parse(fs.readFileSync(o.inv, 'utf8'));
    map = JSON.parse(fs.readFileSync(o.map, 'utf8'));
  } catch (e) {
    console.error(`appendix.mjs: ${e.message}`);
    return 2;
  }
  if (!map || typeof map !== 'object' || Array.isArray(map) || Object.values(map).some((v) => typeof v !== 'string')) {
    console.error('appendix.mjs: the map must be an object of "<component group>": "<screen heading>"');
    return 2;
  }
  const r = buildAppendix(inv, map, o);
  fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true });
  fs.writeFileSync(o.out, r.md);
  console.log(`appendix written to ${o.out}: ${r.labelCount} labels in ${r.groupCount} groups`);
  for (const [h, groups] of r.sections) if (groups.length) console.log(`  ${String(groups.length).padStart(4)}  ${h}`);
  if (r.ids) console.log(`  ${String(r.ids).padStart(4)}  ids without built-in text`);
  const other = r.sections.get(OTHER_TITLE).length;
  if (other) console.log(`note: ${other} group(s) are not in the map and went under "${OTHER_TITLE}"`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
