#!/usr/bin/env bash
# A plain project repo with no work folder. The answers come as arguments; Claude in Chrome is never there in an eval run.
set -euo pipefail
plugin="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
node "$plugin/evals/lib/scaffold.mjs" repo
