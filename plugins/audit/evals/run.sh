#!/usr/bin/env bash
# Runs this plugin's evals: `bash evals/run.sh [options]`. Options go to `claude plugin eval`
# (--case, --runs, --max-cost-usd, …).
#
# THE RUNS ARE BILLED. The platform-audit roadmap runs none of them (PLAN D17): it writes the
# cases, the trigger set and this script, and leaves the runs to the operator.
#
# The cases are headless only (PLAN D11, R4): an eval run can neither listen on nor reach
# 127.0.0.1, and has no Claude in Chrome, so the walk itself is proved by the rehearsal and the
# trial, not here. The trigger set is evals/triggers/platform-audit.json.
#
# Like user-guides' run.sh, this stages a copy of the plugin WITHOUT node_modules (an installed
# plugin has none) and evaluates the copy, with the eval-format cases' own no-plugin baseline arm.
# Reports stay local (--no-publish). Results come back to evals/results/ (git-ignored). Keep `runs`
# modest, and use --max-cost-usd.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

stage="$(mktemp -d "${TMPDIR:-/tmp}/audit-eval.XXXXXX")"
trap 'rm -rf "$stage"' EXIT
rsync -a --exclude node_modules --exclude 'test/.out' --exclude 'evals/results' "$here/" "$stage/plugin/"
plugin="$stage/plugin"
mkdir -p "$here/evals/results"
unset CLAUDECODE || true

status=0
claude plugin eval "$plugin" --no-publish --scaffold --trust-plugin \
  --allow-tools Bash Write Edit "$@" < /dev/null || status=$?
if [ -d "$plugin/evals/results" ]; then cp -R "$plugin/evals/results/." "$here/evals/results/"; fi
exit "$status"
