#!/usr/bin/env bash
# The repo plus the sample audit of the Partner Portal fixture, with the markers, tables, xref and summary defects planted, and its appendix. No work folder, so routes and private are skipped.
set -euo pipefail
plugin="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
node "$plugin/evals/lib/scaffold.mjs" check-sample
