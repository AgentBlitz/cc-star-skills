#!/usr/bin/env bash
# Runs this plugin's eval suite: `bash evals/run.sh [claude plugin eval options]`.
#
# Why not plain `claude plugin eval plugins/showcase` (claude 2.1.285):
#   - each run gets a sealed HOME with no marketplaces, so `"dependencies": ["planning"]`
#     can't be satisfied and the plugin isn't loaded at all ("dependency-unsatisfied");
#   - the plugin's bin/ isn't put on the Bash tool's PATH in eval runs.
# So this stages a copy without node_modules or the dependency line, puts its bin/ first on
# PATH (the operator's PATH reaches the runs), and evaluates the copy. Results come back to
# evals/results/. The report stays local (--no-publish); Bash is granted for the CLI cases.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
stage="$(mktemp -d "${TMPDIR:-/tmp}/showcase-eval.XXXXXX")"
trap 'rm -rf "$stage"' EXIT

rsync -a --exclude node_modules --exclude 'toolkit/test/.out' --exclude 'evals/results' "$here/" "$stage/plugin/"
node -e '
  const fs = require("node:fs");
  const f = process.argv[1];
  const m = JSON.parse(fs.readFileSync(f, "utf8"));
  delete m.dependencies;
  fs.writeFileSync(f, JSON.stringify(m, null, 2) + "\n");
' "$stage/plugin/.claude-plugin/plugin.json"

status=0
PATH="$stage/plugin/bin:$PATH" claude plugin eval "$stage/plugin" \
  --no-publish --trust-plugin --allow-tools Bash "$@" || status=$?

if [ -d "$stage/plugin/evals/results" ]; then
  mkdir -p "$here/evals/results"
  cp -R "$stage/plugin/evals/results/." "$here/evals/results/"
fi
exit "$status"
