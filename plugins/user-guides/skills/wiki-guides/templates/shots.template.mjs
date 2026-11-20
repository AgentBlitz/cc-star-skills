#!/usr/bin/env node
// shots.mjs: the pictures in the user guides ({{SET_FILE}}), taken from the LOCAL app with
// its synthetic accounts. Made by user-guides' wiki-guides from its template; this file is the
// project's own, so edit it: add the set-up a shot's state needs (a click, a dialog opened,
// data shown) inside a step(), and crop with a locator where the guides.json one won't do.
//
//   node scripts/user-guides/shots.mjs --check     the preflight: Playwright, the base URL,
//                                                  every role signed in
//   node scripts/user-guides/shots.mjs             every shot
//   node scripts/user-guides/shots.mjs <name>…     only those (retake by name)
//   node scripts/user-guides/shots.mjs --pending   only placeholder, retake and blocked shots
//
// Each shot is written to .user-guides/out/shots/<id>.png (1280 wide, scale 2), with a
// half-size copy in .user-guides/out/review/ to look at, and its region's fingerprint goes to
// .user-guides/out/shots.json. Look at every image, then run wiki-guides' swap-shots.mjs,
// which puts them in the guides. A shot that fails is reported and the rest carry on.
// No sign-in value is ever printed or stored here (guides-kit.mjs signs each role in).
import { startShots } from './guides-kit.mjs';

const k = await startShots({ root: new URL('../..', import.meta.url), setFile: '{{SET_FILE}}', argv: process.argv.slice(2) });
if (k.checking) process.exit(await k.check());

// ===== shots begin: one block per shot of guides.json (shots-kit.mjs check lists any missing) =====
{{SHOTS}}
// ===== shots end =====

process.exit(await k.done());
