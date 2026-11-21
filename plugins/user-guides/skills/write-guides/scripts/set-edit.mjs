#!/usr/bin/env node
// set-edit.mjs: a skill's changes to guides.json, made through guide-set.mjs so that every
// move belongs to its owner and nothing invalid is saved. All operations apply, or none do.
// Both skills carry identical copies; each acts as the skill whose scripts/ folder it is in.
//
//   node set-edit.mjs <guides.json> [--index <README.md>] <<'EOF'
//   [ { "op": "addGuide", "guide": { "id": "employee", "type": "role-guide", … } }, … ]
//   EOF
//
// Operations (as write-guides or wiki-guides, by the copy's folder):
//   init            { product?, app? }: create the file when it is missing (else a no-op)
//   set             { path: "interview.answers.r1-readers", value }: set a value by dotted path
//   addGuide        { guide, adopt? }       moveGuide { id, to }      edited { id }
//   addShot         { shot, adopt? }        moveShot  { id, to, path?, note? }
//   updateShot      { id, fields: { alt?, as?, target?, state?, guides? } }  (the shot's spec)
//   retakeIfChanged { id, fingerprint }
//   push            { list: "notChecked" | "leftOut" | "checks.patterns", item }  (no duplicates)
//   drop            { list: "notChecked" | "leftOut", where: { guide?, claim?, screen?, role? } }
// --index regenerates the README index's status block after saving.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as gs from './guide-set.mjs';

// The skill this copy belongs to: <skill>/scripts/set-edit.mjs.
const BY = path.basename(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
if (!gs.ACTORS.includes(BY)) throw new Error(`set-edit.mjs must sit in a skill's scripts/ folder (write-guides or wiki-guides), not under "${BY}"`);

function setPath(obj, dotted, value) {
  const keys = dotted.split('.');
  let o = obj;
  for (const k of keys.slice(0, -1)) {
    if (o[k] === undefined) o[k] = {};
    o = o[k];
  }
  o[keys[keys.length - 1]] = value;
}

function getPath(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** Apply operations to a set in memory; throws on the first one that is not allowed. */
export function applyOps(set, ops) {
  ops.forEach((op, i) => {
    const at = `operation ${i + 1} (${op.op})`;
    try {
      switch (op.op) {
        case 'init':
          break;
        case 'set':
          setPath(set, op.path, op.value);
          break;
        case 'addGuide':
          gs.addGuide(set, op.guide, { by: BY, adopt: !!op.adopt });
          break;
        case 'moveGuide':
          gs.moveGuide(set, op.id, op.to, { by: BY });
          break;
        case 'edited':
          gs.markGuideEdited(set, op.id, { by: BY });
          break;
        case 'addShot':
          gs.addShot(set, op.shot, { by: BY, adopt: !!op.adopt });
          break;
        case 'updateShot': {
          // the spec's fields only; status, takenAt, release and fingerprint move with moveShot
          const shot = set.shots.find((x) => x.id === op.id);
          if (!shot) throw new Error(`no shot with id "${op.id}"`);
          const bad = Object.keys(op.fields || {}).filter((k) => !['alt', 'as', 'target', 'state', 'guides'].includes(k));
          if (bad.length) throw new Error(`updateShot changes only alt, as, target, state and guides, not ${bad.join(', ')}`);
          Object.assign(shot, op.fields);
          break;
        }
        case 'moveShot':
          gs.moveShot(set, op.id, op.to, { by: BY, path: op.path, note: op.note });
          break;
        case 'retakeIfChanged':
          gs.markRetakeIfChanged(set, op.id, op.fingerprint ?? null);
          break;
        case 'push': {
          const list = getPath(set, op.list);
          if (!Array.isArray(list)) throw new Error(`${op.list} is not a list`);
          const same = (x) => JSON.stringify(x) === JSON.stringify(op.item);
          if (!list.some(same)) list.push(op.item);
          break;
        }
        case 'drop': {
          const list = getPath(set, op.list);
          if (!Array.isArray(list)) throw new Error(`${op.list} is not a list`);
          const keep = list.filter((e) => !Object.entries(op.where || {}).every(([k, v]) => e[k] === v));
          list.splice(0, list.length, ...keep);
          break;
        }
        default:
          throw new Error(`unknown operation "${op.op}"`);
      }
    } catch (err) {
      throw new Error(`${at}: ${err.message}`);
    }
  });
  return set;
}

function main(argv) {
  const [file, ...rest] = argv;
  let index = null;
  for (let i = 0; i < rest.length; i++) if (rest[i] === '--index') index = rest[++i];
  if (!file || file === '--help' || file === '-h') {
    console.error('usage: set-edit.mjs <guides.json> [--index <README.md>] < operations.json');
    console.error('operations: init, set, addGuide, moveGuide, edited, addShot, moveShot, updateShot, retakeIfChanged, push, drop (see the head of this file)');
    return file ? 0 : 2;
  }
  let ops;
  try {
    ops = JSON.parse(fs.readFileSync(0, 'utf8'));
    if (!Array.isArray(ops)) ops = [ops];
  } catch (err) {
    console.error(`set-edit: the operations on stdin are not a JSON list: ${err.message}`);
    return 2;
  }
  try {
    let set;
    if (fs.existsSync(file)) set = gs.loadGuideSet(file);
    else {
      const init = ops.find((o) => o.op === 'init');
      if (!init) throw new Error(`${file} does not exist: start with an "init" operation`);
      set = gs.createGuideSet({ name: init.product?.name ?? '', language: init.product?.language ?? 'en-GB', baseUrl: init.app?.baseUrl ?? 'http://localhost:3000' });
      if (init.app) set.app = { ...set.app, ...init.app };
    }
    applyOps(set, ops);
    gs.saveGuideSet(file, set);
    const { warnings } = gs.validateGuideSet(set);
    for (const w of warnings) console.log(`warning: ${w}`);
    if (index) {
      const text = fs.existsSync(index) ? fs.readFileSync(index, 'utf8') : '';
      const rel = path.relative(process.cwd(), path.resolve(index)).split(path.sep).join('/');
      fs.writeFileSync(index, gs.updateIndex(text, set, rel));
    }
    const s = gs.summary(set);
    console.log(`${file}: saved (${ops.length} operations); guides ${JSON.stringify(s.guides)}, shots ${JSON.stringify(s.shots)}, notChecked ${s.notChecked}`);
    return 0;
  } catch (err) {
    console.error(`set-edit: nothing saved: ${err.message}`);
    return 1;
  }
}

// Compare real paths: called through a symlink (macOS's /var → /private/var), argv[1] differs.
if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
