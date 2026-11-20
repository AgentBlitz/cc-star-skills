#!/usr/bin/env bash
# The staged fixture (v1) with every answer in guides.json, facts "from the code only", and
# Round 3 recorded as "approve as proposed" (R9). The base URL answers nothing.
set -euo pipefail
plugin="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
s="$plugin/evals/lib/scaffold.mjs"
node "$s" stage && node "$s" answers code && node "$s" commit "Add the guide answers"
