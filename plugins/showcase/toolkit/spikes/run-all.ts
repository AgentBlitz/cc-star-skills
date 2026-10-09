/**
 * Runs the fixture check and the four spikes in turn (`npm run spikes`). Each writes its
 * numbers to `spikes/results/<name>.json`; screenshots and frames go to `test/.out/spikes/`.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const steps: [string, string[]][] = [
  ["check-fixture.ts", []],
  ["spike1-capture.ts", []],
  ["spike1-capture.ts", ["--reps", "1", "--qualities", "90", "--settle", "0"]],
  ["spike2-clicks.ts", []],
  ["spike3-toplayer.ts", []],
  ["spike4-pageload.ts", []],
];
let failed = 0;
for (const [file, args] of steps) {
  console.log(`\n== ${file} ${args.join(" ")}`);
  const r = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", join(import.meta.dirname, file), ...args], { stdio: "inherit" });
  if (r.status !== 0) failed++;
}
process.exit(failed ? 1 : 0);
