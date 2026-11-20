#!/usr/bin/env bash
# Runs this plugin's evals: `bash evals/run.sh [format|scripted|all] [options]` (default: all).
#
#   format    the eval-format cases (evals/<case>/case.yaml) through `claude plugin eval`, with its
#             own no-plugin baseline arm. Options go to `claude plugin eval` (--case, --runs, …).
#   scripted  the cases that need the live fixture (evals/scripted/<case>/case.json) as scripted
#             `claude -p --plugin-dir` runs with the same grader kinds (PLAN R26: an eval-format
#             run can neither listen on nor reach 127.0.0.1). Options go to evals/scripted.mjs.
#   all       format, then scripted, each with its defaults.
#
# Like showcase's run.sh, this stages a copy of the plugin WITHOUT node_modules (an installed
# plugin has none, so D10's Playwright lookup is really exercised) and evaluates the copy. It puts
# the git wrapper evals/bin/git first on PATH (the operator's PATH reaches the runs): inside an
# eval run /usr/bin/git fails, while the wrapper's Command Line Tools git works. Reports stay local (--no-publish). Results come back to
# evals/results/ (git-ignored). Runs are billed: keep `runs` modest, use --max-cost-usd.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mode="${1:-all}"
case "$mode" in format|scripted|all) [ $# -gt 0 ] && shift ;; *) mode=all ;; esac

stage="$(mktemp -d "${TMPDIR:-/tmp}/user-guides-eval.XXXXXX")"
trap 'rm -rf "$stage"' EXIT
rsync -a --exclude node_modules --exclude 'test/.out' --exclude 'evals/results' "$here/" "$stage/plugin/"
plugin="$stage/plugin"
mkdir -p "$here/evals/results"
# An eval run may not read its plugin's evals/ folder, so the git wrapper goes beside it, in a
# .eval-bin/ that exists only in the stage.
mkdir -p "$plugin/.eval-bin" && cp "$plugin/evals/bin/git" "$plugin/.eval-bin/git"
export PATH="$plugin/.eval-bin:$PATH"
unset CLAUDECODE || true

status=0
if [ "$mode" = format ] || [ "$mode" = all ]; then
  claude plugin eval "$plugin" --no-publish --scaffold --trust-plugin \
    --allow-tools Bash Write Edit "$@" < /dev/null || status=$?
  if [ -d "$plugin/evals/results" ]; then cp -R "$plugin/evals/results/." "$here/evals/results/"; fi
  [ "$mode" = all ] && set --
fi
if [ "$mode" = scripted ] || [ "$mode" = all ]; then
  USER_GUIDES_PLUGIN_DIR="$plugin" node "$plugin/evals/scripted.mjs" \
    --results "$here/evals/results" "$@" < /dev/null || status=$?
fi
exit "$status"
