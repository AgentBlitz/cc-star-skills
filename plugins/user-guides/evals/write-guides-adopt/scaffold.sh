#!/usr/bin/env bash
# The staged fixture (v1) with two guides written by hand in docs/help/ (each with one image in
# docs/help/img/) and no guides.json.
set -euo pipefail
plugin="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
s="$plugin/evals/lib/scaffold.mjs"
node "$s" stage && node "$s" hand-written && node "$s" commit "Add the help pages"
