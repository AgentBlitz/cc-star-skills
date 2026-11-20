#!/usr/bin/env node
// The scripted runner (PLAN R16, R26; the SP1/SP2 fallback). Cases that walk the live fixture
// cannot run as `claude plugin eval` runs, which can neither listen on nor reach 127.0.0.1, so
// they run here: a staged copy of the fixture, a real `claude -p` run through the claude shim
// (with the plugin) or plain `claude` (the no-plugin baseline), and the same grader kinds as
// case.yaml (regex, tool_used, file_exists; `arm: with-only`), plus `script` graders.
//
//   USER_GUIDES_PLUGIN_DIR=<staged plugin> node evals/scripted.mjs [--case <glob>] [--runs N]
//       [--baseline-runs N] [--model M] [--max-cost-usd X] [--results <dir>] [--keep]
//
// bash evals/run.sh scripted … sets USER_GUIDES_PLUGIN_DIR and --results. A case is
// evals/scripted/<name>/case.json:
//   { name, description, prompt, model, max_turns, timeout_seconds, allowed_tools, env,
//     runs, baseline_runs, scaffold: "scaffold.mjs", graders: [...] }
// scaffold.mjs exports `async setup({ cwd, plugin })` → { env?, vars?, cleanup? }; it runs as the
// operator in the run's workspace. `{{name}}` in the prompt is replaced from `vars`. A `script`
// grader names a module (relative to the case) whose default export
// `({ cwd, trace, lastMessage, toolCalls, vars }) → { passed, explanation }` may be async.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CASES = path.join(HERE, 'scripted');
const SHIM = path.join(HERE, 'shim', 'claude');

function args(argv) {
  const a = { case: '*', model: null, runs: null, baselineRuns: null, maxCost: Infinity, results: path.join(HERE, 'results'), keep: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--case') a.case = argv[++i];
    else if (k === '--runs') a.runs = Number(argv[++i]);
    else if (k === '--baseline-runs') a.baselineRuns = Number(argv[++i]);
    else if (k === '--model') a.model = argv[++i];
    else if (k === '--max-cost-usd') a.maxCost = Number(argv[++i]);
    else if (k === '--results') a.results = path.resolve(argv[++i]);
    else if (k === '--keep') a.keep = true;
    else throw new Error(`unknown option ${k}`);
  }
  return a;
}

const globRe = (g) => new RegExp('^' + g.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');

/** Run claude -p in `cwd`; resolves { lines, lastMessage, costUsd, turns, error, toolCalls }. */
function runClaude({ withPlugin, prompt, c, cwd, env, model, tracePath }) {
  const cli = withPlugin ? SHIM : 'claude';
  // Only the project's settings: the operator's own plugins, hooks and MCP servers stay out.
  const argv = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--max-turns', String(c.max_turns ?? 40), '--setting-sources', 'project,local', '--strict-mcp-config'];
  if (model || c.model) argv.push('--model', model || c.model);
  if (c.allowed_tools?.length) argv.push('--allowedTools', c.allowed_tools.join(','));
  const childEnv = { ...process.env, ...env };
  delete childEnv.CLAUDECODE;
  return new Promise((resolve) => {
    const child = spawn(cli, argv, { cwd, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
    const out = fs.createWriteStream(tracePath);
    let buf = '';
    let stderr = '';
    const lines = [];
    child.stdout.on('data', (d) => {
      out.write(d);
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        if (line.trim()) lines.push(line);
      }
    });
    child.stderr.on('data', (d) => (stderr += d));
    const timer = setTimeout(() => child.kill('SIGTERM'), (c.timeout_seconds ?? 1200) * 1000);
    child.on('close', (code) => {
      clearTimeout(timer);
      out.end();
      if (buf.trim()) lines.push(buf);
      const events = lines.map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      });
      const toolCalls = [];
      let lastText = '';
      let result = null;
      for (const e of events) {
        if (!e) continue;
        if (e.type === 'assistant') {
          for (const b of e.message?.content ?? []) {
            if (b.type === 'tool_use') toolCalls.push({ name: b.name, input: b.input, inputText: JSON.stringify(b.input) });
            if (b.type === 'text' && b.text.trim()) lastText = b.text;
          }
        }
        if (e.type === 'result') result = e;
      }
      resolve({
        trace: lines.join('\n'),
        lastMessage: result?.result || lastText,
        costUsd: result?.total_cost_usd ?? 0,
        turns: result?.num_turns ?? null,
        error: code === 0 && result && !result.is_error ? null : `exit ${code}${result?.subtype ? ` (${result.subtype})` : ''}${stderr ? `: ${stderr.slice(0, 300)}` : ''}`,
        toolCalls,
      });
    });
  });
}

function walkFiles(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, base, out);
    else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out;
}

function globToRe(g) {
  let s = '^';
  for (let i = 0; i < g.length; i++) {
    const ch = g[i];
    if (ch === '*' && g[i + 1] === '*') {
      s += '.*';
      i++;
    } else if (ch === '*') s += '[^/]*';
    else if (ch === '?') s += '[^/]';
    else s += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(s + '$');
}

async function grade(g, ctx, caseDir) {
  if (g.type === 'regex') {
    let text;
    if (typeof g.target === 'object' && g.target?.source === 'file') {
      const f = path.join(ctx.cwd, g.target.path);
      if (!fs.existsSync(f)) return { passed: false, explanation: `${g.target.path} does not exist` };
      text = fs.readFileSync(f, 'utf8');
    } else text = (g.target ?? 'last_message') === 'trace' ? ctx.trace : ctx.lastMessage;
    const re = new RegExp(g.pattern, (g.flags ?? '').replace('g', '') + 'g');
    const n = (text.match(re) || []).length;
    const match = g.match ?? 'contains';
    if (match === 'contains') return { passed: n > 0, explanation: n ? 'pattern found' : 'pattern not found' };
    if (match === 'not_contains') return { passed: n === 0, explanation: n ? `pattern found ${n}x` : 'pattern absent' };
    const want = Number(match.split(':')[1]);
    return { passed: n === want, explanation: `pattern found ${n}x (expected ${want})` };
  }
  if (g.type === 'tool_used') {
    const re = g.input_match ? new RegExp(g.input_match) : null;
    const n = ctx.toolCalls.filter((t) => t.name === g.tool && (!re || re.test(t.inputText))).length;
    const min = g.min ?? 1;
    const max = g.max ?? Infinity;
    return { passed: n >= min && n <= max, explanation: `${g.tool} called ${n}x (expected ${min}..${max === Infinity ? '∞' : max})` };
  }
  if (g.type === 'file_exists') {
    const re = globToRe(g.path);
    const found = walkFiles(ctx.cwd).some((f) => re.test(f));
    const want = g.exists ?? true;
    return { passed: found === want, explanation: `${g.path} ${found ? 'exists' : 'missing'} (expected ${want ? 'present' : 'absent'})` };
  }
  if (g.type === 'script') {
    const mod = await import(pathToFileURL(path.join(caseDir, g.module)).href);
    try {
      return await mod.default(ctx);
    } catch (err) {
      return { passed: false, explanation: `grader threw: ${err.message}` };
    }
  }
  return { passed: false, explanation: `unknown grader type ${g.type}` };
}

async function main() {
  const a = args(process.argv.slice(2));
  if (!process.env.USER_GUIDES_PLUGIN_DIR) throw new Error('USER_GUIDES_PLUGIN_DIR is not set (run through bash evals/run.sh scripted)');
  const want = globRe(a.case);
  const cases = fs
    .readdirSync(CASES)
    .filter((n) => fs.existsSync(path.join(CASES, n, 'case.json')) && want.test(n))
    .sort();
  if (!cases.length) {
    console.error(`no scripted cases match "${a.case}"`);
    return 1;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(a.results, `scripted-${stamp}`);
  fs.mkdirSync(outDir, { recursive: true });
  const report = { startedAt: new Date().toISOString(), plugin: process.env.USER_GUIDES_PLUGIN_DIR, costUsd: 0, partial: false, cases: [] };
  let failed = false;
  for (const name of cases) {
    const caseDir = path.join(CASES, name);
    const c = JSON.parse(fs.readFileSync(path.join(caseDir, 'case.json'), 'utf8'));
    const arms = [
      ['with', a.runs ?? c.runs ?? 2],
      ['without', a.baselineRuns ?? c.baseline_runs ?? 1],
    ];
    const caseReport = { name, description: c.description, arms: {} };
    for (const [arm, n] of arms) {
      caseReport.arms[arm] = [];
      for (let i = 0; i < n; i++) {
        if (report.costUsd >= a.maxCost) {
          report.partial = true;
          console.log(`cost ceiling ${a.maxCost} reached; stopping`);
          break;
        }
        const work = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), `ug-scripted-${name}-`));
        const cwd = path.join(work, 'cwd');
        fs.mkdirSync(cwd);
        const scaffold = await import(pathToFileURL(path.join(caseDir, c.scaffold ?? 'scaffold.mjs')).href);
        const s = (await scaffold.setup({ cwd, plugin: process.env.USER_GUIDES_PLUGIN_DIR })) ?? {};
        const vars = s.vars ?? {};
        const prompt = c.prompt.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
        const tracePath = path.join(outDir, `${name}.${arm}.${i}.jsonl`);
        const t0 = Date.now();
        console.log(`${name} [${arm} #${i}] running…`);
        let r;
        try {
          r = await runClaude({ withPlugin: arm === 'with', prompt, c, cwd, env: { ...(c.env ?? {}), ...(s.env ?? {}) }, model: a.model, tracePath });
        } finally {
          await s.cleanup?.();
        }
        const ctx = { cwd, trace: r.trace, lastMessage: r.lastMessage, toolCalls: r.toolCalls, vars, arm };
        const graders = [];
        for (const g of c.graders) {
          if (g.arm === 'with-only' && arm !== 'with') continue;
          const res = await grade(g, ctx, caseDir);
          graders.push({ name: g.name, type: g.type, weight: g.weight ?? 1, indicator: g.arm === 'with-only', ...res });
        }
        // As in `claude plugin eval`, with-only graders indicate that the plugin fired and are
        // not part of the score; a with-plugin run still needs them to pass.
        const scored = graders.filter((g) => !g.indicator);
        const total = scored.reduce((s2, g) => s2 + g.weight, 0);
        const score = total ? scored.reduce((s2, g) => s2 + (g.passed ? g.weight : 0), 0) / total : 0;
        const passed = !r.error && graders.every((g) => g.passed);
        report.costUsd += r.costUsd;
        const run = { score, passed, costUsd: r.costUsd, turns: r.turns, durationSeconds: Math.round((Date.now() - t0) / 1000), error: r.error, tracePath, workdir: a.keep ? cwd : null, graders, lastMessage: r.lastMessage.slice(-2000) };
        caseReport.arms[arm].push(run);
        console.log(`${name} [${arm} #${i}] score ${score.toFixed(2)} ${passed ? 'PASS' : 'FAIL'} $${r.costUsd.toFixed(2)} ${run.durationSeconds}s${r.error ? ` error: ${r.error}` : ''}`);
        for (const g of graders.filter((g2) => !g2.passed)) console.log(`    ✗ ${g.name}: ${g.explanation}`);
        if (arm === 'with' && !passed) failed = true;
        if (!a.keep) fs.rmSync(work, { recursive: true, force: true });
      }
    }
    const mean = (xs) => (xs.length ? xs.reduce((s2, x) => s2 + x, 0) / xs.length : null);
    caseReport.withScore = mean(caseReport.arms.with.map((r) => r.score));
    caseReport.withoutScore = mean(caseReport.arms.without.map((r) => r.score));
    caseReport.withPassed = caseReport.arms.with.filter((r) => r.passed).length;
    caseReport.delta = caseReport.withScore !== null && caseReport.withoutScore !== null ? caseReport.withScore - caseReport.withoutScore : null;
    report.cases.push(caseReport);
  }
  fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`cost $${report.costUsd.toFixed(2)}; results: ${path.join(outDir, 'result.json')}`);
  for (const cr of report.cases)
    console.log(`${cr.name}: with ${cr.withPassed}/${cr.arms.with.length} pass, score ${cr.withScore?.toFixed(2)}; without ${cr.withoutScore?.toFixed(2) ?? '—'}; Δ ${cr.delta?.toFixed(2) ?? '—'}`);
  return failed || report.partial ? 1 : 0;
}

main().then(
  (code) => (process.exitCode = code),
  (err) => {
    console.error(`scripted: ${err.message}`);
    process.exitCode = 2;
  },
);
