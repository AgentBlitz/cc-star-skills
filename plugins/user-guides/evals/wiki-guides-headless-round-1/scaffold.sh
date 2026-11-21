#!/usr/bin/env bash
# The staged fixture (v1) with the frozen guide set over it, its pictures still placeholders and
# nothing published: Round 1 is wholly unsettled.
set -euo pipefail
plugin="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
s="$plugin/evals/lib/scaffold.mjs"
node "$s" stage && node "$s" guides && node "$s" commit "Guides for Leave Planner 1.0"
