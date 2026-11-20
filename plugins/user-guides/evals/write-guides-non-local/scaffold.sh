#!/usr/bin/env bash
# The staged fixture (v1) with every answer given, but app.baseUrl on a host that is not local.
set -euo pipefail
plugin="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
s="$plugin/evals/lib/scaffold.mjs"
node "$s" stage && node "$s" answers nonlocal && node "$s" commit "Add the guide answers"
