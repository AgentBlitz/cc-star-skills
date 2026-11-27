#!/usr/bin/env node
// inventory.mjs — builds and reads the code inventory (platform-audit PLAN §2.6).
// Node ≥ 20, built-ins only. Downloaded files are only ever read as text (D8): nothing here runs them.
// Run from the target repo's root as  node $S/inventory.mjs <command> …   (--help for the list).

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import './inventory-core.js';

const core = globalThis.AuditInventory;

const USAGE = `inventory.mjs — the platform-audit code inventory (reads JavaScript as text, never runs it)

  build <bundle-dir> --out <inventory.json> [--origin <url>]
                                     read every .js, .mjs and .json file in the folder (but manifest.json)
  summary <inv>                      counts by kind
  routes <inv>                       every route, with how it was found
  labels <inv> list                  label namespaces with their counts, then the files with unkeyed text
  labels <inv> show <ns,ns*> [--ids] the labels of those namespaces (a trailing * matches a prefix)
  labels <inv> grep <regex>          labels whose id or text matches (case-insensitive)
  context <bundle-dir> <term> [--chars 300] [--max 5]
                                     the code around each occurrence of a literal term
  ops <inv> [--md <file>]            server operations and endpoints; --md writes them as markdown
  columns <inv>                      table column sets, in order
  limits <inv>                       numeric limits
  enums <inv>                        enumerations
  access <inv>                       role and permission constants, rules and denied messages
  join <parts-dir> --sums '<list>' --out <inventory.json>
                                     the in-page fallback: joins the slices paged back from the browser
                                     (in file-name order), checks each part's length and sum against the
                                     list the page printed ([[part, length, sum], …]), and writes the
                                     inventory only when every part matches and the whole is one

Exit 0 on success, 1 when the joined parts are wrong or don't make an inventory, 2 on a usage error.`;

function fail(msg) {
  process.stderr.write(`inventory.mjs: ${msg}\n(run with --help for usage)\n`);
  process.exit(2);
}

function parseArgs(argv) {
  const pos = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--ids') flags.ids = true;
    else if (a.startsWith('--')) {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) fail(`${a} needs a value`);
      flags[a.slice(2)] = v;
      i++;
    } else pos.push(a);
  }
  return { pos, flags };
}

function readInv(file) {
  if (!file) fail('give the inventory file');
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { fail(`cannot read ${file}`); }
  try { return JSON.parse(text); } catch { fail(`${file} is not JSON`); }
}

/** Every .js, .mjs and .json file under dir (but manifest.json), as [{ name, abs }]. */
function bundleFiles(dir) {
  if (!dir) fail('give the bundle folder');
  let st;
  try { st = fs.statSync(dir); } catch { fail(`no such folder: ${dir}`); }
  if (!st.isDirectory()) fail(`not a folder: ${dir}`);
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, e.name);
      if (e.isDirectory()) walk(abs);
      else if (e.isFile() && /\.(?:m?js|json)$/i.test(e.name)) {
        const name = path.relative(dir, abs).split(path.sep).join('/');
        if (name === 'manifest.json') continue;
        out.push({ name, abs });
      }
    }
  };
  walk(dir);
  return out.sort((a, b) => (a.name < b.name ? -1 : 1));
}

/** The checksum the in-page fallback prints for each slice (code-inventory.md): a*31 + code unit, mod 2^32. */
function partSum(text) {
  let a = 0;
  for (let i = 0; i < text.length; i++) a = (a * 31 + text.charCodeAt(i)) >>> 0;
  return a;
}

function countLabels(inv) {
  return Object.values(inv.labels).reduce((n, ns) => n + Object.keys(ns).length, 0);
}

function summaryLines(inv) {
  const unkeyed = Object.values(inv.unkeyed).reduce((n, l) => n + l.length, 0);
  const kinds = {};
  for (const o of inv.operations) kinds[o.kind] = (kinds[o.kind] || 0) + 1;
  const fw = Object.keys(inv.frameworks);
  return [
    `files ${inv.files.length} (${inv.files.reduce((n, f) => n + f.bytes, 0)} bytes)`,
    `frameworks ${fw.length ? fw.join(', ') : '(none seen)'}`,
    `routes ${inv.routes.length}`,
    `labels ${countLabels(inv)} in ${Object.keys(inv.labels).length} namespaces; unkeyed ${unkeyed}; ids without text ${inv.idsWithoutText.length}`,
    `columns ${inv.columns.length} sets`,
    `operations ${inv.operations.length}${inv.operations.length ? ' (' + Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(', ') + ')' : ''}; endpoints ${inv.endpoints.length}`,
    `hosts api ${inv.hosts.api.length}, auth ${inv.hosts.auth.length}, ws ${inv.hosts.ws.length}`,
    `access constants ${inv.access.constants.length}, rules ${inv.access.rules.length}, denied messages ${inv.access.deniedMessages.length}`,
    `enums ${inv.enums.length}; limits ${inv.limits.length}; config ${inv.config.length}`,
    `source maps ${inv.sourceMaps.length} (noted, not fetched); chunks ${inv.chunks.length}`,
    ...(inv.errors ? [`errors ${inv.errors.length}: ${inv.errors.map((e) => e.file).join(', ')}`] : []),
  ];
}

function opsMarkdown(inv) {
  const out = ['# Server operations', '', `From the app's public code (${inv.files.length} files). [Code] throughout.`, ''];
  for (const kind of ['query', 'mutation', 'subscription', 'fragment']) {
    const list = inv.operations.filter((o) => o.kind === kind);
    if (!list.length) continue;
    out.push(`## ${kind[0].toUpperCase() + kind.slice(1)} (${list.length})`, '');
    for (const o of list) {
      out.push(`### ${o.name}`, '');
      if (o.on) out.push(`- On: \`${o.on}\``);
      out.push(`- Variables: ${o.variables.length ? o.variables.map((v) => '`' + v + '`').join(', ') : '—'}`);
      out.push(`- Fields: ${o.fields.length ? o.fields.map((f) => '`' + f + '`').join(', ') : '—'}`);
      out.push(`- Found as: ${o.source}, in \`${o.file}\``, '');
    }
  }
  if (inv.endpoints.length) {
    out.push(`## Endpoints (${inv.endpoints.length})`, '', '| Method | Path | File |', '|---|---|---|');
    for (const e of inv.endpoints) out.push(`| ${e.method || '?'} | \`${e.path}\` | \`${e.file}\` |`);
    out.push('');
  }
  const hosts = ['api', 'auth', 'ws'].filter((k) => inv.hosts[k].length);
  if (hosts.length) {
    out.push('## Hosts', '');
    for (const k of hosts) out.push(`- ${k}: ${inv.hosts[k].map((h) => '`' + h + '`').join(', ')}`);
    out.push('');
  }
  return out.join('\n');
}

function main(argv) {
  if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(USAGE + '\n');
    process.exit(argv.length ? 0 : 2);
  }
  const [cmd, ...rest] = argv;
  const { pos, flags } = parseArgs(rest);
  const print = (lines) => process.stdout.write((Array.isArray(lines) ? lines.join('\n') : lines) + '\n');

  switch (cmd) {
    case 'build': {
      const dir = pos[0];
      if (!flags.out) fail('build needs --out <inventory.json>');
      const files = bundleFiles(dir).map(({ name, abs }) => {
        const buf = fs.readFileSync(abs);
        return { name, text: buf.toString('utf8'), sha256: crypto.createHash('sha256').update(buf).digest('hex') };
      });
      if (!files.length) fail(`no .js, .mjs or .json files in ${dir}`);
      const inv = core.build(files, { origin: flags.origin || null });
      fs.mkdirSync(path.dirname(path.resolve(flags.out)), { recursive: true });
      fs.writeFileSync(flags.out, JSON.stringify(inv, null, 1) + '\n');
      print([`inventory written to ${flags.out}`, ...summaryLines(inv).map((l) => '  ' + l)]);
      return;
    }
    case 'summary':
      print(summaryLines(readInv(pos[0])));
      return;
    case 'routes': {
      const inv = readInv(pos[0]);
      print([`routes (${inv.routes.length})`, ...inv.routes.map((r) => `${r.path}  [${r.kinds.join(', ')}]${r.keys.length ? '  keys: ' + r.keys.join(', ') : ''}  — ${r.files.join(', ')}`)]);
      return;
    }
    case 'labels': {
      const inv = readInv(pos[0]);
      const mode = pos[1];
      if (mode === 'list') {
        const lines = Object.keys(inv.labels).map((ns) => `${ns} (${Object.keys(inv.labels[ns]).length})`);
        print([`namespaces (${lines.length})`, ...lines]);
        const files = Object.keys(inv.unkeyed);
        if (files.length) print([`unkeyed text, by file (${files.length})`, ...files.map((f) => `${f} (${inv.unkeyed[f].length})`)]);
        if (inv.idsWithoutText.length) print(`ids without text: ${inv.idsWithoutText.length}`);
        return;
      }
      if (mode === 'show') {
        if (!pos[2]) fail('labels show needs <ns,ns*>');
        for (const want of pos[2].split(',')) {
          const names = want.endsWith('*') ? Object.keys(inv.labels).filter((k) => k.startsWith(want.slice(0, -1))) : [want];
          for (const ns of names) {
            const v = inv.labels[ns] || (inv.unkeyed[ns] && Object.fromEntries(inv.unkeyed[ns].map((t, i) => [String(i + 1), t])));
            if (!v) { print(`## ${ns}: (none)`); continue; }
            const entries = Object.entries(v);
            print([`## ${ns} (${entries.length})`, ...entries.map(([id, t]) => (flags.ids ? `${id} = ${t}` : t))]);
          }
        }
        return;
      }
      if (mode === 'grep') {
        if (!pos[2]) fail('labels grep needs <regex>');
        let re;
        try { re = new RegExp(pos[2], 'i'); } catch { fail(`not a valid regex: ${pos[2]}`); }
        const lines = [];
        for (const [ns, v] of Object.entries(inv.labels)) for (const [id, t] of Object.entries(v)) if (re.test(id) || re.test(t)) lines.push(`${id} = ${t}`);
        for (const [file, list] of Object.entries(inv.unkeyed)) for (const t of list) if (re.test(t)) lines.push(`(${file}) ${t}`);
        print(lines.length ? lines : '(no match)');
        return;
      }
      fail('labels needs list, show or grep');
      return;
    }
    case 'context': {
      const [dir, term] = pos;
      if (!term) fail('context needs <bundle-dir> <term>');
      const chars = Number(flags.chars || 300);
      const max = Number(flags.max || 5);
      if (!(chars > 0) || !(max > 0)) fail('--chars and --max take positive numbers');
      let shown = 0;
      let total = 0;
      for (const { name, abs } of bundleFiles(dir)) {
        const text = fs.readFileSync(abs, 'utf8');
        let at = text.indexOf(term);
        while (at >= 0) {
          total++;
          if (shown < max) {
            const half = Math.floor(chars / 2);
            const snip = text.slice(Math.max(0, at - half), at + term.length + half).replace(/\s+/g, ' ');
            print(`── ${name}:${at}\n${core.redactText(snip)}`);
            shown++;
          }
          at = text.indexOf(term, at + term.length);
        }
      }
      print(total ? `${total} occurrence${total === 1 ? '' : 's'}${total > shown ? `, ${shown} shown` : ''}` : `no occurrence of the term`);
      return;
    }
    case 'ops': {
      const inv = readInv(pos[0]);
      if (flags.md) {
        fs.writeFileSync(flags.md, opsMarkdown(inv) + '\n');
        print(`${inv.operations.length} operations and ${inv.endpoints.length} endpoints written to ${flags.md}`);
        return;
      }
      const lines = inv.operations.map((o) => `${o.kind} ${o.name}${o.on ? ' on ' + o.on : ''}${o.variables.length ? '(' + o.variables.join(', ') + ')' : ''}${o.fields.length ? ' { ' + o.fields.join(' ') + ' }' : ''}  [${o.source}]`);
      lines.push(...inv.endpoints.map((e) => `${e.method || '?'} ${e.path}  [endpoint]`));
      print(lines.length ? lines : '(no operations)');
      return;
    }
    case 'columns': {
      const inv = readInv(pos[0]);
      print(inv.columns.length ? inv.columns.map((c, i) => `set ${i + 1} (${c.file}): ${c.set.map((s) => `${s.field}=${s.header === null ? '?' : s.header}`).join(' | ')}`) : '(no column sets)');
      return;
    }
    case 'limits': {
      const inv = readInv(pos[0]);
      print(inv.limits.length ? inv.limits.map((l) => `${l.name} = ${l.value}${l.raw !== String(l.value) ? ` (${l.raw})` : ''}  — ${l.file}`) : '(no limits)');
      return;
    }
    case 'enums': {
      const inv = readInv(pos[0]);
      print(inv.enums.length ? inv.enums.map((e) => `${e.name}: ${e.members.join(', ')}`) : '(no enums)');
      return;
    }
    case 'access': {
      const inv = readInv(pos[0]);
      const a = inv.access;
      print([
        `constants (${a.constants.length}): ${a.constants.join(', ') || '—'}`,
        `rules (${a.rules.length})`,
        ...a.rules.map((r) => `  ${r.name}: ${r.roles.join(', ')}  — ${r.context}`),
        `denied messages (${a.deniedMessages.length})`,
        ...a.deniedMessages.map((m) => `  ${m}`),
      ]);
      return;
    }
    case 'join': {
      const dir = pos[0];
      if (!dir) fail('join needs the folder of parts');
      if (!flags.sums) fail('join needs --sums <the list the page printed>');
      if (!flags.out) fail('join needs --out <inventory.json>');
      let want;
      try { want = JSON.parse(flags.sums); } catch { fail('--sums is not JSON'); }
      if (!Array.isArray(want) || !want.length || !want.every((w) => Array.isArray(w) && w.length === 3 && w.every(Number.isInteger))) {
        fail('--sums must be the page\'s list: [[part, length, sum], …]');
      }
      let names;
      try { names = fs.readdirSync(dir).filter((n) => !n.startsWith('.')).sort(); } catch { fail(`cannot read ${dir}`); }
      if (!names.length) fail(`no parts in ${dir}`);
      // The page sends compact JSON, which has no raw line breaks: any here came from saving the slice.
      const parts = names.map((n) => fs.readFileSync(path.join(dir, n), 'utf8').replace(/[\r\n]/g, ''));
      const lines = [];
      let wrong = 0;
      for (let i = 0; i < Math.max(names.length, want.length); i++) {
        if (i >= names.length) { lines.push(`  part ${want[i][0]}: missing (${want[i][1]} chars)`); wrong++; continue; }
        const got = `  ${names[i]}  ${parts[i].length} chars  sum ${partSum(parts[i])}`;
        if (i >= want.length) { lines.push(`${got}  — the page has no such part`); wrong++; continue; }
        const same = parts[i].length === want[i][1] && partSum(parts[i]) === want[i][2];
        if (!same) wrong++;
        lines.push(same ? got : `${got}  — WRONG: the page's part ${want[i][0]} has ${want[i][1]} chars, sum ${want[i][2]}`);
      }
      const text = parts.join('');
      let why = wrong ? `${wrong} part(s) differ from the page's` : '';
      let inv = null;
      if (!wrong) {
        try { inv = JSON.parse(text); } catch (e) { why = `not JSON (${e.message})`; }
        if (inv && !(Array.isArray(inv.routes) && inv.labels && Array.isArray(inv.operations) && Array.isArray(inv.files))) {
          inv = null;
          why = 'JSON, but not an inventory';
        }
      }
      if (!inv) {
        print([`${names.length} parts, ${text.length} characters: ${why}`, ...lines, 'Nothing written. Page the wrong parts back again, save them exactly, and join again.']);
        process.exit(1);
      }
      fs.mkdirSync(path.dirname(path.resolve(flags.out)), { recursive: true });
      fs.writeFileSync(flags.out, JSON.stringify(inv, null, 1) + '\n');
      print([`inventory written to ${flags.out} (${names.length} parts, ${text.length} characters, every part as the page sent it)`, ...lines, ...summaryLines(inv).map((l) => '  ' + l)]);
      return;
    }
    default:
      fail(`unknown command: ${cmd}`);
  }
}

main(process.argv.slice(2));
