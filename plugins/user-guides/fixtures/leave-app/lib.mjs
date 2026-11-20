// Leave Planner fixture: data, sessions and settings shared by the server, the sign-in helper
// and the reset. Dependency-free Node >= 20. Every person here is invented.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
export const COOKIE = 'leave_session';
export const SIGN_IN_FLAG = 'EVAL_LEAVE_APP';
export const PASSWORD_ENV = 'EVAL_LEAVE_APP_PASSWORD';
export const DEFAULT_TODAY = '2026-03-02';

/** The variant (v1 | v2) and release, from --variant, LEAVE_APP_VARIANT, then release.json. */
export function releaseInfo(appDir = APP_DIR, flag) {
  let file = {};
  try {
    file = JSON.parse(fs.readFileSync(path.join(appDir, 'release.json'), 'utf8'));
  } catch {
    // no release.json: v1
  }
  const variant = flag || process.env.LEAVE_APP_VARIANT || file.variant || 'v1';
  if (!['v1', 'v2'].includes(variant)) throw new Error(`unknown variant "${variant}" (v1 or v2)`);
  return { variant, release: file.release || (variant === 'v2' ? '1.1' : '1.0') };
}

export function dataDir(appDir = APP_DIR) {
  return process.env.LEAVE_APP_DATA || path.join(appDir, 'data');
}

// ---------------------------------------------------------------------------------------
// Sessions: `<username>.<hmac>` with a per-copy secret kept in data/.secret (git-ignored).

export function secret(dir = dataDir()) {
  const f = path.join(dir, '.secret');
  try {
    return fs.readFileSync(f, 'utf8').trim();
  } catch {
    fs.mkdirSync(dir, { recursive: true });
    const s = crypto.randomBytes(24).toString('hex');
    try {
      fs.writeFileSync(f, s + '\n', { flag: 'wx', mode: 0o600 });
      return s;
    } catch {
      return fs.readFileSync(f, 'utf8').trim(); // another process won the race
    }
  }
}

export function sessionFor(username, dir = dataDir()) {
  const mac = crypto.createHmac('sha256', secret(dir)).update(username).digest('base64url');
  return `${username}.${mac}`;
}

export function userFromSession(value, dir = dataDir()) {
  if (!value || !value.includes('.')) return null;
  const username = value.slice(0, value.lastIndexOf('.'));
  const expected = sessionFor(username, dir);
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? username : null;
}

// ---------------------------------------------------------------------------------------
// Seed data. Usernames are what the sign-in helper and the form take.

export const ACCOUNTS = { employee: 'rowan', manager: 'tamsin', admin: 'idris' };

export function seed() {
  return {
    policy: { allowance: 25, carryOver: 5 },
    people: [
      { username: 'rowan', name: 'Rowan Pell', role: 'employee', team: 'Platform', manager: 'tamsin', used: 7 },
      { username: 'tamsin', name: 'Tamsin Hale', role: 'manager', team: 'Platform', manager: 'idris', used: 3 },
      { username: 'idris', name: 'Idris Kettle', role: 'admin', team: 'Operations', manager: '', used: 10 },
      { username: 'mae', name: 'Mae Lindqvist', role: 'employee', team: 'Platform', manager: 'tamsin', used: 12 },
      { username: 'oscar', name: 'Oscar Thorne', role: 'employee', team: 'Platform', manager: 'tamsin', used: 4 },
      { username: 'bea', name: 'Bea Quill', role: 'employee', team: 'Design', manager: 'idris', used: 9 },
      { username: 'nell', name: 'Nell Ashdown', role: 'employee', team: 'Design', manager: 'idris', used: 1 },
      { username: 'caspian', name: 'Caspian Rook', role: 'employee', team: 'Operations', manager: 'idris', used: 15 },
      { username: 'wren', name: 'Wren Holloway', role: 'employee', team: 'Operations', manager: 'idris', used: 6 },
      { username: 'juno', name: 'Juno Marchetti', role: 'employee', team: 'Design', manager: 'idris', used: 0 },
    ],
    requests: [
      { id: 'r1', who: 'rowan', type: 'Annual leave', from: '2026-03-16', to: '2026-03-20', days: 5, status: 'pending', note: 'Family visit' },
      { id: 'r2', who: 'rowan', type: 'Sick leave', from: '2026-02-09', to: '2026-02-10', days: 2, status: 'approved', note: '' },
      { id: 'r3', who: 'mae', type: 'Annual leave', from: '2026-04-06', to: '2026-04-10', days: 5, status: 'pending', note: 'Spring break' },
      { id: 'r4', who: 'oscar', type: 'Unpaid leave', from: '2026-03-23', to: '2026-03-23', days: 1, status: 'declined', note: 'Move house' },
      { id: 'r5', who: 'caspian', type: 'Annual leave', from: '2026-03-02', to: '2026-03-04', days: 3, status: 'approved', note: '' },
    ],
    settings: {},
    nextId: 6,
  };
}

const stateFile = (dir) => path.join(dir, 'state.json');

/** The current state, read on every request so that a reset applies at once. */
export function load(dir = dataDir()) {
  try {
    return JSON.parse(fs.readFileSync(stateFile(dir), 'utf8'));
  } catch {
    return seed();
  }
}

export function save(state, dir = dataDir()) {
  fs.mkdirSync(dir, { recursive: true });
  const tmp = stateFile(dir) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n');
  fs.renameSync(tmp, stateFile(dir));
}

export function reset(dir = dataDir()) {
  save(seed(), dir);
}

export function today() {
  return process.env.LEAVE_APP_TODAY || DEFAULT_TODAY;
}

export function settingsFor(state, username) {
  return {
    emailChanges: true,
    weeklySummary: false,
    calendarSync: false,
    workDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    ...(state.settings[username] || {}),
  };
}
