#!/usr/bin/env bash
# A plain project repo with no work folder: nothing is settled yet.
set -euo pipefail
plugin="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
node "$plugin/evals/lib/scaffold.mjs" repo
