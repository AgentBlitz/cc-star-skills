#!/usr/bin/env bash
# autopilot.sh — run a planning-plugin roadmap unattended.
#
# Repeatedly launches `claude -p "/planning:session <plan-dir>"` from the target
# project root, one roadmap session per invocation, until the TRACKER.md has no
# pending rows (⬜/🟡), a row goes ⛔ (failed gate), or --max iterations run.
#
# The tracker's emoji status column is the only machine-readable signal the
# planning skills guarantee — stdout markers and exit codes are not relied on.
#
# Usage:
#   autopilot.sh [--plan .planning/<slug>] [--max N] [--model <model>]
#                [--threshold PCT] [--usage-check] [--permission-mode MODE]
#                [--backoff DURATION] [--dry-run]
#
# Subscription-limit handling:
#   * Reactive (always on): if a run fails with a usage-limit error, sleep until
#     the reset epoch embedded in the message (or --backoff if unparseable),
#     then retry the same session without consuming an iteration.
#   * Proactive (--usage-check, opt-in): before each run, query the undocumented
#     OAuth usage endpoint with your own Claude Code token (macOS Keychain, then
#     ~/.claude/.credentials.json). If < --threshold % of the 5-hour window
#     remains, sleep until it resets. Degrades to a warning if unavailable.

set -u -o pipefail

PLAN_DIR=""
MAX=0                      # 0 = unlimited
MODEL=""
THRESHOLD=20
USAGE_CHECK=0
PERM_MODE="bypassPermissions"
BACKOFF="30m"
DRY_RUN=0

USAGE_ENDPOINT="https://api.anthropic.com/api/oauth/usage"

usage() {
  sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

log()  { printf '[%s] %s\n' "$(date '+%F %T')" "$*"; }
warn() { log "WARN: $*" >&2; }
die()  { log "ERROR: $*" >&2; exit "${2:-1}"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --plan)            PLAN_DIR="${2:?--plan needs a value}"; shift 2 ;;
    --max)             MAX="${2:?--max needs a value}"; shift 2 ;;
    --model)           MODEL="${2:?--model needs a value}"; shift 2 ;;
    --threshold)       THRESHOLD="${2:?--threshold needs a value}"; shift 2 ;;
    --usage-check)     USAGE_CHECK=1; shift ;;
    --permission-mode) PERM_MODE="${2:?--permission-mode needs a value}"; shift 2 ;;
    --backoff)         BACKOFF="${2:?--backoff needs a value}"; shift 2 ;;
    --dry-run)         DRY_RUN=1; shift ;;
    -h|--help)         usage 0 ;;
    *)                 warn "unknown option: $1"; usage 1 ;;
  esac
done

command -v claude  >/dev/null 2>&1 || die "claude CLI not found on PATH"
command -v python3 >/dev/null 2>&1 || die "python3 not found on PATH (needed to parse JSON)"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "not inside a git repository — run from the target project root"

# ---------------------------------------------------------------------------
# Duration parsing: "45s" / "30m" / "2h" / bare number = minutes
# ---------------------------------------------------------------------------
duration_seconds() {
  case "$1" in
    *s) echo $(( ${1%s} )) ;;
    *m) echo $(( ${1%m} * 60 )) ;;
    *h) echo $(( ${1%h} * 3600 )) ;;
    *[!0-9]*) die "bad duration: $1 (use 45s / 30m / 2h)" ;;
    *)  echo $(( $1 * 60 )) ;;
  esac
}
BACKOFF_SECS="$(duration_seconds "$BACKOFF")" || exit 1

# ---------------------------------------------------------------------------
# Tracker parsing — table rows only (^|), so the legend line never miscounts.
# Pending = ⬜ or 🟡 · Done = ✅ · Blocked = ⛔
# ---------------------------------------------------------------------------
TRACKER=""
PENDING=0 DONE=0 BLOCKED=0

read_tracker() {
  PENDING=$(grep -Ec '^\|.*(⬜|🟡)' "$TRACKER" 2>/dev/null || true)
  DONE=$(grep -Ec '^\|.*✅' "$TRACKER" 2>/dev/null || true)
  BLOCKED=$(grep -Ec '^\|.*⛔' "$TRACKER" 2>/dev/null || true)
}

blocked_rows() { grep -E '^\|.*⛔' "$TRACKER" || true; }
next_pending_row() { grep -Em1 '^\|.*(⬜|🟡)' "$TRACKER" || true; }

# ---------------------------------------------------------------------------
# Plan-dir resolution: honour --plan, else auto-detect the single roadmap
# with pending rows (mirrors the /session skill's own detection).
# ---------------------------------------------------------------------------
if [ -n "$PLAN_DIR" ]; then
  TRACKER="$PLAN_DIR/TRACKER.md"
  [ -f "$TRACKER" ] || die "no TRACKER.md in $PLAN_DIR"
else
  all=() candidates=()
  for t in .planning/*/TRACKER.md; do
    [ -f "$t" ] || continue
    all+=("$t")
    grep -Eq '^\|.*(⬜|🟡)' "$t" && candidates+=("$t")
  done
  [ "${#all[@]}" -gt 0 ] || die "no .planning/*/TRACKER.md found — run /roadmap first"
  case "${#candidates[@]}" in
    0) if [ "${#all[@]}" -eq 1 ]; then
         TRACKER="${all[0]}"; PLAN_DIR="$(dirname "$TRACKER")"   # complete or blocked — main loop reports which
       else
         log "no roadmap has pending sessions (checked: ${all[*]}) — nothing to do"; exit 0
       fi ;;
    1) TRACKER="${candidates[0]}"; PLAN_DIR="$(dirname "$TRACKER")" ;;
    *) die "multiple roadmaps have pending sessions (${candidates[*]}) — pass --plan to pick one" ;;
  esac
fi
log "plan: $PLAN_DIR"

RUN_DIR="$PLAN_DIR/autopilot"
LOG_FILE="$RUN_DIR/autopilot.log"

# ---------------------------------------------------------------------------
# Sleeping until a reset
# ---------------------------------------------------------------------------
sleep_until_epoch() {  # $1 = unix epoch
  local now wait
  now=$(date +%s)
  wait=$(( $1 - now + 120 ))   # +2 min buffer past the reset
  [ "$wait" -gt 0 ] || return 0
  log "sleeping ${wait}s (until $(date -r "$1" '+%F %T' 2>/dev/null || date -d "@$1" '+%F %T')) for the usage window to reset"
  sleep "$wait"
}

# ---------------------------------------------------------------------------
# Proactive usage check (opt-in). Prints "UTIL <pct> <reset-epoch|->" or "ERR <why>".
# Reads your own OAuth token: macOS Keychain, then ~/.claude/.credentials.json.
# ---------------------------------------------------------------------------
usage_status() {
  local creds token
  creds="$(security find-generic-password -w -s 'Claude Code-credentials' 2>/dev/null || true)"
  [ -n "$creds" ] || creds="$(cat "$HOME/.claude/.credentials.json" 2>/dev/null || true)"
  [ -n "$creds" ] || { echo "ERR no credentials found"; return; }
  token="$(printf '%s' "$creds" | python3 -c '
import json,sys
try: print(json.load(sys.stdin)["claudeAiOauth"]["accessToken"])
except Exception: pass')"
  [ -n "$token" ] || { echo "ERR could not extract accessToken"; return; }
  curl -sS --max-time 15 "$USAGE_ENDPOINT" \
       -H "Authorization: Bearer $token" \
       -H "anthropic-beta: oauth-2025-04-20" \
       -H "Content-Type: application/json" 2>/dev/null | python3 -c '
import json, sys, datetime
try:
    d = json.load(sys.stdin)
    fh = d.get("five_hour") or {}
    util = fh.get("utilization")
    if util is None:
        raise ValueError("no five_hour.utilization in response")
    resets = fh.get("resets_at")
    epoch = "-"
    if resets:
        epoch = int(datetime.datetime.fromisoformat(str(resets).replace("Z", "+00:00")).timestamp())
    print(f"UTIL {round(float(util))} {epoch}")
except Exception as e:
    print(f"ERR {e}")'
}

maybe_wait_for_usage() {
  [ "$USAGE_CHECK" -eq 1 ] || return 0
  local status util reset remaining
  status="$(usage_status)"
  case "$status" in
    UTIL*)
      util="$(echo "$status" | awk '{print $2}')"
      reset="$(echo "$status" | awk '{print $3}')"
      remaining=$(( 100 - util ))
      log "5-hour window: ${util}% used, ${remaining}% remaining"
      if [ "$remaining" -lt "$THRESHOLD" ]; then
        if [ "$reset" != "-" ]; then
          log "below ${THRESHOLD}% threshold — waiting for the window to reset"
          sleep_until_epoch "$reset"
        else
          log "below ${THRESHOLD}% threshold, no reset time — backing off $BACKOFF"
          sleep "$BACKOFF_SECS"
        fi
      fi
      ;;
    *)
      warn "usage check unavailable (${status#ERR }) — continuing; reactive limit handling still applies"
      ;;
  esac
}

# ---------------------------------------------------------------------------
# Result-JSON parsing for one claude run.
# Prints: <is_error> <cost> <duration_s> <limit_reset_epoch|-> <summary...>
# ---------------------------------------------------------------------------
parse_run() {  # $1 = run json file
  python3 - "$1" <<'PY'
import json, re, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    raw = open(sys.argv[1], errors="replace").read()
    m = re.search(r"\b(1\d{9})\b", raw) if re.search(r"(?i)(usage limit|limit reached|rate.?limit)", raw) else None
    print("parse_error", "-", "-", m.group(1) if m else "-", raw.strip()[:200].replace("\n", " "))
    sys.exit(0)
is_err = str(bool(d.get("is_error"))).lower()
cost = d.get("total_cost_usd", "-")
dur = round(d["duration_ms"] / 1000) if isinstance(d.get("duration_ms"), (int, float)) else "-"
text = str(d.get("result") or d.get("error") or "")
reset = "-"
if re.search(r"(?i)(usage limit|limit reached|rate.?limit)", text):
    m = re.search(r"\b(1\d{9})\b", text)
    reset = m.group(1) if m else "0"       # 0 = limit hit, no epoch found
print(is_err, cost, dur, reset, text.strip()[:200].replace("\n", " "))
PY
}

# ---------------------------------------------------------------------------
# Summary + traps
# ---------------------------------------------------------------------------
ITER=0
SESSIONS_DONE=0
summary() {
  read_tracker
  log "autopilot summary: $ITER iteration(s), $SESSIONS_DONE session(s) completed — tracker: $DONE done / $PENDING pending / $BLOCKED blocked"
}
trap 'echo; warn "interrupted"; summary; exit 130' INT TERM

# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------
read_tracker
[ "$BLOCKED" -gt 0 ] && { blocked_rows >&2; die "tracker has a ⛔ blocked session — resolve it before running autopilot" 2; }
[ "$PENDING" -eq 0 ] && { log "roadmap already complete ($DONE sessions ✅) — nothing to do"; exit 0; }

CMD=(claude -p "/planning:session $PLAN_DIR" --output-format json --permission-mode "$PERM_MODE")
[ -n "$MODEL" ] && CMD+=(--model "$MODEL")

if [ "$DRY_RUN" -eq 1 ]; then
  log "dry run — tracker: $DONE done / $PENDING pending / $BLOCKED blocked"
  log "next session row: $(next_pending_row)"
  log "would run: ${CMD[*]}"
  [ "$MAX" -gt 0 ] && log "for up to $MAX iteration(s)"
  exit 0
fi

mkdir -p "$RUN_DIR"
STRIKES=0

while :; do
  read_tracker
  if [ "$BLOCKED" -gt 0 ]; then
    summary
    blocked_rows >&2
    die "session blocked (⛔) — a verification gate failed; see TRACKER.md and .planning/sessions/" 2
  fi
  if [ "$PENDING" -eq 0 ]; then
    log "🎉 roadmap complete — all $DONE sessions ✅"
    summary
    exit 0
  fi
  if [ "$MAX" -gt 0 ] && [ "$ITER" -ge "$MAX" ]; then
    log "reached --max $MAX iterations with $PENDING session(s) still pending"
    summary
    exit 0
  fi

  maybe_wait_for_usage

  ITER=$(( ITER + 1 ))
  iter_label="$ITER"; [ "$MAX" -gt 0 ] && iter_label="$ITER/$MAX"
  pending_before=$PENDING done_before=$DONE
  run_json="$RUN_DIR/run-$ITER.json"
  log "[$iter_label] starting: $(next_pending_row)"

  "${CMD[@]}" > "$run_json" 2>>"$LOG_FILE"
  claude_exit=$?

  set -f
  set -- $(parse_run "$run_json")
  set +f
  is_err="${1:-parse_error}" cost="${2:--}" dur="${3:--}" reset="${4:--}"
  shift 4 2>/dev/null || true
  msg="$*"

  if [ "$reset" != "-" ]; then
    ITER=$(( ITER - 1 ))            # limit hits don't consume an iteration
    warn "usage limit reached: $msg"
    if [ "$reset" != "0" ]; then
      sleep_until_epoch "$reset"
    else
      log "no reset time in the error — backing off $BACKOFF"
      sleep "$BACKOFF_SECS"
    fi
    continue
  fi

  read_tracker
  progressed=0
  { [ "$DONE" -gt "$done_before" ] || [ "$PENDING" -lt "$pending_before" ]; } && progressed=1

  outcome="no progress"
  if [ "$BLOCKED" -gt 0 ]; then outcome="⛔ blocked"
  elif [ "$progressed" -eq 1 ]; then outcome="✅"; SESSIONS_DONE=$(( SESSIONS_DONE + 1 ))
  fi
  line="[$iter_label] $(date '+%F %T') exit=$claude_exit is_error=$is_err cost=\$$cost duration=${dur}s outcome=$outcome — pending ${pending_before}→${PENDING}"
  log "$line"
  echo "$line" >> "$LOG_FILE"

  if [ "$BLOCKED" -eq 0 ] && [ "$progressed" -eq 0 ]; then
    STRIKES=$(( STRIKES + 1 ))
    warn "run made no tracker progress (strike $STRIKES/2): $msg"
    if [ "$STRIKES" -ge 2 ]; then
      summary
      die "2 consecutive runs made no progress — stopping to avoid burning your subscription; see $run_json" 3
    fi
  else
    STRIKES=0
  fi
done
