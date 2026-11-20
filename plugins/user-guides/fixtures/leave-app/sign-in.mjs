#!/usr/bin/env node
// Prints a session cookie value for one of the fixture's synthetic accounts, for the
// `cookie-command` sign-in kind:   EVAL_LEAVE_APP=1 node sign-in.mjs <username | role>
// The cookie is `leave_session`. It refuses to run without EVAL_LEAVE_APP=1: this helper is
// for tests and evals only.
import * as lib from './lib.mjs';

if (process.env[lib.SIGN_IN_FLAG] !== '1') {
  console.error(`sign-in: refusing to run: set ${lib.SIGN_IN_FLAG}=1 (this helper is for tests and evals only)`);
  process.exit(2);
}
const arg = process.argv[2];
const username = lib.ACCOUNTS[arg] || arg;
if (!Object.values(lib.ACCOUNTS).includes(username)) {
  console.error(`sign-in: unknown account "${arg ?? ''}": use one of ${Object.entries(lib.ACCOUNTS).map(([r, u]) => `${u} (${r})`).join(', ')}`);
  process.exit(2);
}
process.stdout.write(lib.sessionFor(username) + '\n');
