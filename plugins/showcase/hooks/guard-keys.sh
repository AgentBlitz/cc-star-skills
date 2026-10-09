#!/usr/bin/env bash
# PreToolUse guard (PLAN §2.3, C1): deny a tool call whose input names the showcase
# user key file or a showcase/.auth/ sign-in. Plain bash + grep: it runs on every
# matching tool call in every session, so it must stay fast and dependency-free.
input="$(cat)"

deny() {
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' \
    "showcase: $1 holds secrets and must not be read, searched or edited by a tool. Use \`showcase keys status\` (or \`showcase keys set\` in your own terminal)."
  exit 0
}

# The key file, by literal path or by the variables that name it.
if printf '%s' "$input" | grep -Eq \
  -e '\.config/showcase/(\.env|\*)' \
  -e '\$\{?XDG_CONFIG_HOME\}?/showcase/(\.env|\*)' \
  -e '\$\{?SHOWCASE_CONFIG_DIR(:-[^}]*)?\}?/(\.env|\*)'; then
  deny "the user key file"
fi
for d in "${XDG_CONFIG_HOME:+$XDG_CONFIG_HOME/showcase}" "${SHOWCASE_CONFIG_DIR:-}"; do
  if [ -n "$d" ] && printf '%s' "$input" | grep -Fq -e "$d/.env" -e "$d/*"; then
    deny "the user key file"
  fi
done

# Searching or globbing the key directory itself reads the file too.
if printf '%s' "$input" | grep -Eq '"tool_name" *: *"(Grep|Glob)"' &&
   printf '%s' "$input" | grep -Eq '\.config/showcase/?"'; then
  deny "the showcase config directory"
fi

# Recorded sign-ins (Playwright storageState) are secrets too.
if printf '%s' "$input" | grep -Eq 'showcase/\.auth([/"'"'"'[:space:]*]|$)'; then
  deny "showcase/.auth/"
fi

exit 0
