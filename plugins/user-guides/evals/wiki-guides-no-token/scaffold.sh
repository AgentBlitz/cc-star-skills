#!/usr/bin/env bash
# The staged fixture (v1) with the frozen guide set over it, every picture taken (release 1.0).
set -euo pipefail
plugin="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
s="$plugin/evals/lib/scaffold.mjs"
node "$s" stage && node "$s" guides --taken && node "$s" commit "Guides for Leave Planner 1.0, pictures taken"
