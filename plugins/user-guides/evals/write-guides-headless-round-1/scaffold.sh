#!/usr/bin/env bash
# The staged fixture (v1), with no guides.json: nothing is settled yet.
set -euo pipefail
plugin="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
node "$plugin/evals/lib/scaffold.mjs" stage
