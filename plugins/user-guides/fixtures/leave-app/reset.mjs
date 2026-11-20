#!/usr/bin/env node
// Resets Leave Planner's data to the seed: every request, setting and role change made since
// is wiped. The running server picks it up on its next request.   node reset.mjs
import * as lib from './lib.mjs';

lib.reset();
console.log(`reset: ${lib.dataDir()}/state.json restored to the seed data`);
