// Lint for the skill's own text (platform-audit S6): SKILL.md, its six reference files, and the
// snippets they tell Claude to paste. Nothing here opens a browser: the in-page snippets run in a
// vm context with a stand-in page, over the fixture's public files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(HERE, '..', 'skills', 'platform-audit');
const REF = path.join(SKILL_DIR, 'reference');
const SCRIPTS = path.join(SKILL_DIR, 'scripts');
const PUBLIC = path.resolve(HERE, '..', 'fixtures', 'partner-portal', 'public');
const REFERENCES = ['interview', 'ground-rules', 'code-inventory', 'walking', 'writing', 'checking'];
const IDS = ['checklist', 'hidden', 'interact', 'code', 'pace', 'folder', 'role'];

const read = (...p) => fs.readFileSync(path.join(SKILL_DIR, ...p), 'utf8');
const skill = read('SKILL.md');
const refs = Object.fromEntries(REFERENCES.map((n) => [n, read('reference', `${n}.md`)]));
const node = (script, ...args) => spawnSync('node', [path.join(SCRIPTS, script), ...args], { encoding: 'utf8' });

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, 'SKILL.md opens with frontmatter');
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    assert.ok(kv, `a frontmatter line is not "key: value" on one line: ${line.slice(0, 60)}`);
    out[kv[1]] = kv[2].replace(/^"(.*)"$/, '$1');
  }
  return { fields: out, body: text.slice(m[0].length) };
}

/** The text under a heading, up to the next heading of the same or a higher level. */
function section(text, heading) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^#+ /.test(l) && l.replace(/^#+ /, '').trim() === heading);
  assert.ok(start >= 0, `no heading "${heading}"`);
  const level = lines[start].match(/^#+/)[0].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#+) /);
    if (m && m[1].length <= level) { end = i; break; }
  }
  return lines.slice(start + 1, end).join('\n');
}

const headings = (text) => text.split('\n').filter((l) => /^#+ /.test(l)).map((l) => l.replace(/^#+ /, '').trim());
const squash = (s) => s.replace(/\*\*/g, '').replace(/\s+/g, ' ').toLowerCase();

test('frontmatter: the name, the hint and the tools, and Claude may invoke it', () => {
  const { fields } = frontmatter(skill);
  assert.equal(fields.name, 'platform-audit');
  assert.ok(fields['argument-hint'], 'argument-hint');
  assert.match(fields['argument-hint'], /<url>/);
  assert.match(fields['argument-hint'], /resume/);
  assert.match(fields['argument-hint'], /check/);
  assert.ok(fields['allowed-tools'], 'allowed-tools');
  for (const t of ['Read', 'Write', 'AskUserQuestion', 'ToolSearch', 'Bash(node *)', 'mcp__claude-in-chrome__*']) {
    assert.ok(fields['allowed-tools'].includes(t), `allowed-tools lists ${t}`);
  }
  assert.ok(!/\bBash\s*[,\]]/.test(fields['allowed-tools']), 'Bash is allowed by pattern, not whole');
  assert.ok(!('disable-model-invocation' in fields), 'the stub\'s disable-model-invocation is gone');
});

test('the description triggers on audits of a platform and names what it turns away', () => {
  const { fields } = frontmatter(skill);
  const d = fields.description;
  assert.ok(d.length <= 1536, `the skill listing cuts a description at 1,536 characters (this is ${d.length})`);
  for (const phrase of ['audit this platform', 'map every screen', 'what can this back office do', 'check it has the fields we need']) {
    assert.ok(d.includes(phrase), `a phrase people use: ${phrase}`);
  }
  assert.match(d, /URL/);
  assert.match(d, /Chrome/);
  const not = d.slice(d.indexOf('Not for'));
  assert.ok(d.includes('Not for'), 'it says what it is not for');
  for (const away of ['SEO', 'performance', 'accessibility', 'security', 'code review', 'scraping', 'user guides', 'product film']) {
    assert.ok(not.includes(away), `it turns away: ${away}`);
  }
});

test('SKILL.md is at most 200 lines', () => {
  const n = skill.trimEnd().split('\n').length;
  assert.ok(n <= 200, `${n} lines`);
});

test('every reference, template and script file SKILL.md names exists, and every reference file is named', () => {
  const named = new Set();
  for (const m of skill.matchAll(/`((?:reference|templates|scripts)\/[\w.-]+\.\w+)`/g)) named.add(m[1]);
  for (const m of skill.matchAll(/\$S\/([\w.-]+\.m?js)/g)) named.add(`scripts/${m[1]}`);
  assert.ok(named.size >= 12, `found only ${named.size} named files`);
  for (const f of named) assert.ok(fs.existsSync(path.join(SKILL_DIR, f)), `SKILL.md names ${f}, which doesn't exist`);
  assert.deepEqual(fs.readdirSync(REF).sort(), REFERENCES.map((n) => `${n}.md`).sort(), 'the six reference files');
  for (const n of REFERENCES) assert.ok(named.has(`reference/${n}.md`), `SKILL.md never names reference/${n}.md`);
  for (const f of fs.readdirSync(path.join(SKILL_DIR, 'templates'))) assert.ok(named.has(`templates/${f}`), `SKILL.md never names templates/${f}`);
  for (const f of fs.readdirSync(SCRIPTS)) assert.ok(named.has(`scripts/${f}`), `SKILL.md never names scripts/${f}`);
});

test('SKILL.md has the $S line, the route table, the Never list and steps 0 to 7', () => {
  const { body } = frontmatter(skill);
  assert.match(body, /\$\{CLAUDE_SKILL_DIR\}\/scripts/);
  assert.match(body, /Call that folder `\$S`/);
  const route = section(skill, 'Route by `$ARGUMENTS`');
  for (const arg of ['a URL', '`resume`', '`check [<report>]`', '(none)']) assert.ok(route.includes(`| ${arg}`), `route: ${arg}`);
  const never = section(skill, 'Never');
  assert.match(never, /reference\/ground-rules\.md/);
  assert.equal(never.split('\n').filter((l) => l.startsWith('- ')).length, 10, 'the ten Never items');
  for (const w of ['logs out', 'credential', 'another host', '`interact=downloads`', '`pace`', 'refused download', 'personal data', '`location.search`', 'Guess an answer', 'claude.ai artifact']) {
    assert.ok(squash(never).includes(squash(w)), `Never: ${w}`);
  }
  const steps = section(skill, 'The steps');
  for (let n = 0; n <= 7; n++) assert.match(steps, new RegExp(`^\\*\\*${n}\\. `, 'm'), `step ${n}`);
  for (let n = 1; n <= 7; n++) {
    const from = steps.search(new RegExp(`^\\*\\*${n}\\. `, 'm'));
    const next = n < 7 ? steps.search(new RegExp(`^\\*\\*${n + 1}\\. `, 'm')) : steps.length;
    assert.match(steps.slice(from, next), /`reference\/[\w-]+\.md`/, `step ${n} names its reference file`);
  }
  assert.match(steps, /\*\*Headless\*\*/);
  assert.match(steps, /before any Chrome call, recon or\s+download/);
});

test('interview.md: the seven questions, each with its short values, and the headless form', () => {
  const t = refs.interview;
  assert.match(t, /Wording version \*\*1\*\*/);
  const ids = [...t.matchAll(/^\| `(\w+)` \| /gm)].map((m) => m[1]);
  assert.deepEqual(ids.slice(0, 7), IDS, 'Round 1, then Round 2');
  const skip = section(t, 'Skip rules');
  const values = {
    checklist: 'none|<path>', hidden: 'code|try-two|try-all', interact: 'open-forms|downloads|look',
    code: 'download|browser|skip', pace: '20|10|5', folder: '<path>', role: '<name>',
  };
  for (const id of IDS) assert.ok(skip.includes(`\`${id}=${values[id]}\``), `short values for ${id}`);
  const decides = section(t, 'What each answer decides');
  for (const id of IDS) assert.ok(decides.includes(`| \`${id}\` |`), `where ${id} goes`);
  const headless = section(t, 'Headless runs');
  const blocks = [...headless.matchAll(/```\n([\s\S]*?)```/g)].map((m) => m[1]);
  assert.equal(blocks.length, 2, 'a block for each round');
  assert.ok(blocks[0].startsWith('platform-audit needs your answers (Round 1 of 2)\n'));
  assert.ok(blocks[1].startsWith('platform-audit needs your answers (Round 2 of 2)\n'));
  for (const b of blocks) {
    const cmd = b.trim().split('\n').pop();
    assert.match(cmd, /^\/audit:platform-audit https:\/\/app\.example\.com /);
    for (const id of ['checklist', 'hidden', 'interact', 'code', 'pace']) assert.match(cmd, new RegExp(` ${id}=\\S+`), `the command answers ${id}`);
  }
  for (const [id, list] of Object.entries(values)) {
    if (!list.includes('|') || id === 'checklist') continue;
    for (const v of list.split('|')) assert.ok(blocks.join('\n').includes(`${id}=${v}`) || blocks.join('\n').includes(`${id}: ${v}`) || (id === 'pace' && blocks[1].includes(`pace=${v}`)), `the headless form offers ${id}=${v}`);
  }
});

test('a reference file over 300 lines has a contents list', () => {
  for (const n of REFERENCES) {
    const lines = refs[n].trimEnd().split('\n').length;
    if (lines > 300) assert.match(refs[n], /^## Contents$/m, `${n}.md is ${lines} lines and has no "## Contents"`);
  }
});

test('every "file › Section" pointer leads to a heading', () => {
  const targets = {
    ...Object.fromEntries(REFERENCES.map((n) => [`${n}.md`, headings(refs[n])])),
    'progress.md': headings(read('templates', 'progress.md')),
  };
  let seen = 0;
  for (const [file, text] of [['SKILL.md', skill], ...REFERENCES.map((n) => [`${n}.md`, refs[n]])]) {
    const flat = text.replace(/\s+/g, ' ');
    for (const m of flat.matchAll(/`(?:reference\/)?([\w-]+\.md)` › (.{1,90})/g)) {
      if (!targets[m[1]]) continue;
      seen++;
      const after = squash(m[2]);
      assert.ok(targets[m[1]].some((h) => after.startsWith(squash(h))), `${file}: "${m[1]} › ${m[2].slice(0, 40)}…" matches no heading of ${m[1]}`);
    }
  }
  assert.ok(seen >= 20, `only ${seen} pointers found`);
});

test('the references cover every inventory command, every check and every guard reason', () => {
  const help = node('inventory.mjs', '--help').stdout;
  const cmds = [...new Set([...help.matchAll(/^ {2}(\w+) /gm)].map((m) => m[1]))];
  assert.ok(cmds.length >= 11, cmds.join(' '));
  for (const c of cmds) assert.match(refs['code-inventory'], new RegExp(`(inventory\\.mjs|…) ${c}\\b`), `code-inventory.md never shows "${c}"`);
  const checks = [...node('check-audit.mjs', '--help').stdout.matchAll(/^ {2}(\w+) {2,}/gm)].map((m) => m[1]);
  assert.equal(checks.length, 9);
  for (const c of checks) assert.ok(refs.checking.includes(`| \`${c}\` |`), `checking.md has no row for ${c}`);
  const probe = fs.readFileSync(path.join(SCRIPTS, 'probe.js'), 'utf8');
  const reasons = ['disabled', 'file input', 'other host', 'new tab', 'log out', 'download', 'danger word', 'submit', 'toggle', 'not found'];
  for (const r of reasons) {
    assert.ok(probe.includes(`'${r}'`), `the probe has no reason '${r}'`);
    assert.ok(refs['ground-rules'].includes(`| \`${r}\` |`), `ground-rules.md has no row for ${r}`);
  }
  for (const m of ['recon()', 'nav()', 'screen(', 'overlays()', 'requests()', 'peek()', 'open(']) assert.ok(refs.walking.includes(`__auditProbe.${m}`), `walking.md never shows ${m}`);
});

test('the loader in walking.md is the one in the probe\'s header, and the cleanup names what the scripts leave', () => {
  const probe = fs.readFileSync(path.join(SCRIPTS, 'probe.js'), 'utf8');
  const loader = [...refs.walking.matchAll(/```js\n([\s\S]*?)```/g)].map((m) => m[1].trim());
  assert.equal(loader.length, 1);
  assert.ok(probe.split('\n').slice(0, 4).some((l) => l.includes(loader[0])), 'the loader is not in the probe\'s header comment');
  const cleanup = [...section(refs.checking, 'Close').matchAll(/```js\n([\s\S]*?)```/g)].map((m) => m[1].trim());
  assert.equal(cleanup.length, 1);
  for (const k of ['__auditProbe', '__auditNet', '__auditInv']) assert.ok(cleanup[0].includes(k), `the cleanup leaves ${k}`);
  const ctx = vm.createContext({ sessionStorage: { removed: [], removeItem(k) { this.removed.push(k); } } });
  ctx.window = ctx;
  Object.assign(ctx, { __auditProbe: 1, __auditNet: 1, __auditInv: 'x' });
  assert.equal(vm.runInContext(cleanup[0], ctx), 'removed');
  assert.deepEqual(ctx.sessionStorage.removed, ['__auditProbe']);
  for (const k of ['__auditProbe', '__auditNet', '__auditInv']) assert.ok(!(k in ctx), `${k} is still there`);
});

// --- the in-page fallback (code-inventory.md), run without a browser ---

const ORIGIN = 'http://127.0.0.1:4173';

function fallbackSnippets() {
  const s = section(refs['code-inventory'], 'The in-page fallback');
  const blocks = [...s.matchAll(/^ *```js\n([\s\S]*?)^ *```/gm)].map((m) => m[1].trim());
  assert.equal(blocks.length, 3, 'build, sums, slice');
  // The text pages 20,000 characters a slice. The fixture's inventory is smaller than that, so the
  // tests page it 5,000 at a time, to have several slices to join.
  assert.match(blocks[1], /const N = 20000,/);
  assert.match(blocks[2], /\(k - 1\) \* 20000, k \* 20000\)/);
  return { build: blocks[0], sums: blocks[1].replace('20000', '5000'), slice: blocks[2].replaceAll('20000', '5000') };
}

/** A stand-in page: the fixture's scripts as the browser would have them, and the core pasted in. */
function page({ extra = {} } = {}) {
  const fetched = [];
  const files = { '/config.js': 'config.js', '/assets/index-3f9c2a71.js': 'assets/index-3f9c2a71.js', '/assets/admin-8d41b6e0.js': 'assets/admin-8d41b6e0.js', '/assets/de-c27f5a94.js': 'assets/de-c27f5a94.js' };
  const ctx = vm.createContext({
    URL,
    location: { href: `${ORIGIN}/orders?status=PAID`, origin: ORIGIN },
    document: {
      querySelectorAll: (sel) => (sel === 'script[src]'
        ? [{ src: `${ORIGIN}/config.js` }, { src: `${ORIGIN}/assets/index-3f9c2a71.js?v=7` }, { src: 'https://cdn.example.net/widget.js' }]
        : []),
    },
    performance: {
      getEntriesByType: () => [
        { name: `${ORIGIN}/assets/index-3f9c2a71.js?v=7` }, { name: `${ORIGIN}/assets/admin-8d41b6e0.js` },
        { name: `${ORIGIN}/assets/de-c27f5a94.js` }, { name: `${ORIGIN}/assets/gone-00000000.js` },
        { name: `${ORIGIN}/api/graphql` }, { name: `${ORIGIN}/app.css` },
      ],
    },
    fetch: async (u, opts) => {
      fetched.push([u, opts && opts.cache]);
      const p = new URL(u).pathname;
      const text = extra[p] ?? (files[p] && fs.readFileSync(path.join(PUBLIC, files[p]), 'utf8'));
      return text === undefined ? { ok: false } : { ok: true, text: async () => text };
    },
  });
  ctx.window = ctx;
  vm.runInContext(fs.readFileSync(path.join(SCRIPTS, 'inventory-core.js'), 'utf8'), ctx, { filename: 'inventory-core.js' });
  return { ctx, fetched };
}

async function pageBack(ctx, snippets, dir) {
  const counts = JSON.parse(await vm.runInContext(`(async () => { return ${snippets.build}\n})()`, ctx));
  const sums = JSON.parse(vm.runInContext(snippets.sums, ctx));
  fs.mkdirSync(dir, { recursive: true });
  sums.forEach(([k], i) => {
    const slice = vm.runInContext(snippets.slice.replace(/\(1\)\s*$/, `(${k})`), ctx);
    assert.equal(typeof slice, 'string');
    // A slice saved with a line break at its end, as an editor would leave it, still joins.
    fs.writeFileSync(path.join(dir, `${String(k).padStart(3, '0')}.txt`), slice + (i % 2 ? '\n' : ''));
  });
  return { counts, sums };
}

test('the in-page fallback: build in the page, page back in slices, join, and get the CLI\'s inventory', async () => {
  const snippets = fallbackSnippets();
  const { ctx, fetched } = page();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-fallback-'));
  const parts = path.join(tmp, 'inv-parts');
  const { counts, sums } = await pageBack(ctx, snippets, parts);

  assert.equal(counts.files, 4);
  assert.deepEqual(counts.failed, ['/assets/gone-00000000.js']);
  assert.ok(sums.length >= 2, `the fixture's inventory should take more than one slice (${counts.chars} characters)`);
  assert.equal(sums.reduce((n, s) => n + s[1], 0), counts.chars);
  // Only this origin's scripts, each once, by the address the page loaded it from, from the cache.
  assert.deepEqual(fetched.map((f) => f[0]).sort(), [
    `${ORIGIN}/assets/admin-8d41b6e0.js`, `${ORIGIN}/assets/de-c27f5a94.js`, `${ORIGIN}/assets/gone-00000000.js`,
    `${ORIGIN}/assets/index-3f9c2a71.js?v=7`, `${ORIGIN}/config.js`,
  ]);
  assert.ok(fetched.every((f) => f[1] === 'force-cache'));
  const whole = ctx.__auditInv;
  assert.ok(/^[\x20-\x7e]*$/.test(whole), 'the paged text is plain ASCII');
  assert.ok(!/[?&][\w.[\]-]+=[\w%]/.test(whole), 'no query string is paged back');
  assert.ok(!counts.chars.toString().includes('?') && !JSON.stringify(counts).includes(ORIGIN + '/orders?'), 'the counts hold no address');

  const out = path.join(tmp, 'inventory.json');
  const list = JSON.stringify(sums);
  const r = node('inventory.mjs', 'join', parts, '--sums', list, '--out', out);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  for (const [k, len, sum] of sums) {
    assert.ok(r.stdout.includes(`${String(k).padStart(3, '0')}.txt  ${len} chars  sum ${sum}`), `part ${k}: length and sum as the page gave them`);
  }
  const joined = JSON.parse(fs.readFileSync(out, 'utf8'));
  const cli = path.join(tmp, 'cli.json');
  assert.equal(node('inventory.mjs', 'build', PUBLIC, '--out', cli, '--origin', ORIGIN).status, 0);
  const want = JSON.parse(fs.readFileSync(cli, 'utf8'));
  assert.equal(counts.routes, want.routes.length);
  assert.deepEqual(joined.routes, want.routes);
  assert.deepEqual(joined.operations.map((o) => o.name), want.operations.map((o) => o.name));
  assert.deepEqual(Object.keys(joined.labels), Object.keys(want.labels));
  for (const ns of Object.keys(want.labels)) assert.deepEqual(Object.keys(joined.labels[ns]), Object.keys(want.labels[ns]), ns);
  assert.equal(joined.labels.orders['orders.title'], want.labels.orders['orders.title']);
  assert.deepEqual(joined.enums, want.enums);
  assert.deepEqual(joined.limits, want.limits);
  assert.ok(Object.values(joined.labels).some((ns) => Object.values(ns).some((v) => /[äöüß]/.test(v))) === Object.values(want.labels).some((ns) => Object.values(ns).some((v) => /[äöüß]/.test(v))), 'non-ASCII text survives the trip');
  assert.equal(node('inventory.mjs', 'summary', out).status, 0);

  // A slice copied wrongly is caught by its length and sum, even where the whole still reads as JSON,
  // and nothing is written.
  const badOut = path.join(tmp, 'bad.json');
  const spoil = (name, change) => {
    const dir = path.join(tmp, name);
    fs.cpSync(parts, dir, { recursive: true });
    change(dir);
    const b = node('inventory.mjs', 'join', dir, '--sums', list, '--out', badOut);
    assert.equal(b.status, 1, `${name}: ${b.stdout}`);
    assert.ok(!fs.existsSync(badOut), `${name}: nothing is written`);
    return b.stdout;
  };
  const p1 = (dir) => path.join(dir, '001.txt');
  assert.match(spoil('short', (d) => fs.writeFileSync(p1(d), fs.readFileSync(p1(d), 'utf8').slice(0, -40))), /001\.txt .* WRONG: the page's part 1 has 5000 chars/);
  assert.match(spoil('one-letter', (d) => fs.writeFileSync(p1(d), fs.readFileSync(p1(d), 'utf8').replace(/[a-z]/, 'Z'))), /1 part\(s\) differ[\s\S]*001\.txt  5000 chars .* WRONG/);
  assert.match(spoil('missing', (d) => fs.rmSync(path.join(d, `${String(sums.length).padStart(3, '0')}.txt`))), new RegExp(`part ${sums.length}: missing`));
  assert.match(spoil('extra', (d) => fs.writeFileSync(path.join(d, '999.txt'), 'x')), /999\.txt .* the page has no such part/);

  const notInv = path.join(tmp, 'not-inv');
  fs.mkdirSync(notInv);
  fs.writeFileSync(path.join(notInv, '001.txt'), '{"routes":"no"}');
  const ni = node('inventory.mjs', 'join', notInv, '--sums', '[[1,15,0]]', '--out', badOut);
  assert.equal(ni.status, 1);
  assert.match(ni.stdout, /WRONG/);
  const sumOf = (s) => { let a = 0; for (let i = 0; i < s.length; i++) a = (a * 31 + s.charCodeAt(i)) >>> 0; return a; };
  const ni2 = node('inventory.mjs', 'join', notInv, '--sums', `[[1,15,${sumOf('{"routes":"no"}')}]]`, '--out', badOut);
  assert.equal(ni2.status, 1);
  assert.match(ni2.stdout, /JSON, but not an inventory/);
  assert.ok(!fs.existsSync(badOut));
  assert.equal(node('inventory.mjs', 'join', parts, '--sums', list).status, 2, 'no --out');
  assert.equal(node('inventory.mjs', 'join', parts, '--out', badOut).status, 2, 'no --sums');
  assert.equal(node('inventory.mjs', 'join', parts, '--sums', 'nonsense', '--out', badOut).status, 2);
  assert.equal(node('inventory.mjs', 'join', parts, '--sums', '[[1,2]]', '--out', badOut).status, 2);
  assert.equal(node('inventory.mjs', 'join', path.join(tmp, 'nowhere'), '--sums', list, '--out', badOut).status, 2);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('the in-page fallback masks query strings, and strict mode blanks ? & = %', async () => {
  const snippets = fallbackSnippets();
  const extra = { '/assets/extra-1a2b3c4d.js': 'const m={a:{id:"help.link",defaultMessage:"Open /help/start?topic=payouts&lang=en now"},b:{id:"help.ask",defaultMessage:"Are you sure? 100% & more = better"}};' };
  const withExtra = () => {
    const p = page({ extra });
    const entries = p.ctx.performance.getEntriesByType();
    p.ctx.performance.getEntriesByType = () => [...entries, { name: `${ORIGIN}/assets/extra-1a2b3c4d.js` }];
    return p;
  };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-fallback-'));

  const a = withExtra();
  await pageBack(a.ctx, snippets, path.join(tmp, 'a'));
  const inv = JSON.parse(a.ctx.__auditInv);
  assert.equal(inv.labels.help['help.link'], 'Open /help/start?… now');
  assert.equal(inv.labels.help['help.ask'], 'Are you sure? 100% & more = better', 'ordinary punctuation is left alone');

  const b = withExtra();
  assert.match(snippets.build, /const strict = false;/);
  const strict = { ...snippets, build: snippets.build.replace('const strict = false;', 'const strict = true;') };
  await pageBack(b.ctx, strict, path.join(tmp, 'b'));
  assert.ok(!/[?&=%]/.test(b.ctx.__auditInv), 'strict mode leaves none of the four anywhere in the paged text');
  assert.equal(JSON.parse(b.ctx.__auditInv).labels.help['help.ask'], 'Are you sure· 100· · more · better');
  const r = node('inventory.mjs', 'join', path.join(tmp, 'b'), '--sums', JSON.stringify(JSON.parse(vm.runInContext(strict.sums, b.ctx))), '--out', path.join(tmp, 'b.json'));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  fs.rmSync(tmp, { recursive: true, force: true });
});
