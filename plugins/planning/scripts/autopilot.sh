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
#                [--effort low|medium|high|xhigh|max] [--escalate off|effort|model]
#                [--branch <name>] [--threshold PCT] [--usage-check]
#                [--permission-mode MODE] [--backoff DURATION] [--dry-run]
#
# Branch:
#   By default, commits land on the branch already checked out — autopilot never
#   switches branches. Pass --branch <name> to check out (or create, from the
#   current HEAD) that branch once before the loop, so an unattended run doesn't
#   pile commits directly onto whatever you happened to be on (e.g. main).
#
# Runtime profiles (per session):
#   Each run's model/effort is resolved per session, in this order: an explicit
#   --model / --effort flag wins; else the `model:` / `effort:` YAML frontmatter
#   at the top of that session's prompts/session-N.md (written by /roadmap or
#   /calibrate-roadmap); else claude's own default (flag omitted). Roadmaps
#   without frontmatter run exactly as before.
#
# No-progress runs — classify, then act:
#   A run that leaves the tracker unchanged is classified from its result JSON
#   before anything is retried, because most such runs are not the model's fault
#   (signatures verified against claude 2.1.269):
#     needs-human  the final message asks you for something — a decision, an
#                  approval, or it reports a tool call refused by a hook or
#                  permission rule. (AskUserQuestion is not offered headless, so
#                  questions arrive as text; deny rules and PreToolUse hooks
#                  still apply under bypassPermissions.) Also: a hook stopped the
#                  run outright (terminal_reason=hook_stopped). A costlier model
#                  would hit the same wall, so stop with exit 4 and print what
#                  was asked plus a `claude -p --resume <id>` command that
#                  continues the session with its context intact.
#     env          an error subtype, non-zero exit, ≤2 turns, or an environment
#                  error in the final message → identical retry; twice in a row
#                  → exit 3 ("fix the environment, not the model").
#     yielded      the run ended at a tool call with no final message
#                  (stop_reason=tool_use), or ended its turn early (≤15 turns) or
#                  saying it will continue "once X finishes" — the model handed
#                  off to background work, which a headless process never wakes
#                  from → identical retry with a reminder; a second yield in a
#                  row counts as a stall.
#     stalled      a long, successful-looking run that moved nothing → escalate.
#   Ladder (--escalate model, the default): the session's own runtime → the same
#   model at effort max → the next model up (haiku→sonnet→opus→fable) at max →
#   exit 3 with a diagnosis. --escalate effort stops after the effort rung;
#   --escalate off never changes the flags (one identical retry, then exit 3).
#   Escalation retries consume --max iterations; usage-limit waits do not.
#   Every run carries a headless note in its system prompt (never yield to wait,
#   mark ⛔ "Needs decision: …" instead of asking, record `Runtime:` provenance).
#
# Subscription-limit handling:
#   * Reactive (always on): if a run fails with a usage-limit error, sleep until
#     the reset epoch embedded in the message (or --backoff if unparseable),
#     then retry the same session without consuming an iteration.
#   * Proactive (--usage-check, opt-in): before each run, query the undocumented
#     OAuth usage endpoint with your own Claude Code token (macOS Keychain, then
#     ~/.claude/.credentials.json). If < --threshold % of the 5-hour window
#     remains, sleep until it resets. Degrades to a warning if unavailable.
#
# Transient-error handling:
#   Each claude run is launched with CLAUDE_CODE_RETRY_WATCHDOG=1, Claude Code's
#   unattended-session mode: transient API failures (network blips, 5xx,
#   overloaded) are retried with backoff inside the run — up to 300 attempts —
#   instead of dying at the default ~15-retry cap. Retries resend failed
#   requests only; completed work is never re-run. Usage-limit errors are not
#   retried by the watchdog — the reactive sleep-until-reset above owns those.
#
# Output:
#   Progress goes to stdout and <plan-dir>/autopilot/autopilot.log; each run's
#   result JSON lands in <plan-dir>/autopilot/run-<launch>-<n>.json.
#
# Exit codes:
#   0 roadmap complete or --max reached · 2 a ⛔ row (failed gate, or a row
#   marked "Needs decision:") · 3 brake (environment failure twice, or the
#   escalation ladder exhausted) · 4 needs a human (the session asked for a
#   decision/approval, or a hook stopped it — see the log) · 130 Ctrl-C.

set -u -o pipefail

PLAN_DIR=""
MAX=0                      # 0 = unlimited
MODEL=""
EFFORT=""                  # empty = claude's default effort for the model
ESCALATE="model"           # off | effort | model — how far a stalled session is escalated
BRANCH=""                  # empty = stay on the current branch
THRESHOLD=20
USAGE_CHECK=0
PERM_MODE="bypassPermissions"
BACKOFF="30m"
DRY_RUN=0
YIELD_TURNS=15             # a no-progress "success" with ≤ this many turns = the model yielded early

USAGE_ENDPOINT="https://api.anthropic.com/api/oauth/usage"

usage() {
  sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

log()  { printf '[%s] %s\n' "$(date '+%F %T')" "$*"; }
warn() { log "WARN: $*" >&2; }
die()  { log "ERROR: $1" >&2; exit "${2:-1}"; }   # $1 = message, $2 = exit code

while [ $# -gt 0 ]; do
  case "$1" in
    --plan)            PLAN_DIR="${2:?--plan needs a value}"; shift 2 ;;
    --max)             MAX="${2:?--max needs a value}"; shift 2 ;;
    --model)           MODEL="${2:?--model needs a value}"; shift 2 ;;
    --effort)          EFFORT="${2:?--effort needs a value}"; shift 2 ;;
    --escalate)        ESCALATE="${2:?--escalate needs a value}"; shift 2 ;;
    --branch)          BRANCH="${2:?--branch needs a value}"; shift 2 ;;
    --threshold)       THRESHOLD="${2:?--threshold needs a value}"; shift 2 ;;
    --usage-check)     USAGE_CHECK=1; shift ;;
    --permission-mode) PERM_MODE="${2:?--permission-mode needs a value}"; shift 2 ;;
    --backoff)         BACKOFF="${2:?--backoff needs a value}"; shift 2 ;;
    --dry-run)         DRY_RUN=1; shift ;;
    -h|--help)         usage 0 ;;
    *)                 warn "unknown option: $1"; usage 1 ;;
  esac
done

case "$EFFORT" in
  ""|low|medium|high|xhigh|max) ;;
  *) die "--effort must be one of: low, medium, high, xhigh, max (got: $EFFORT)" ;;
esac
case "$ESCALATE" in
  off|effort|model) ;;
  *) die "--escalate must be one of: off, effort, model (got: $ESCALATE)" ;;
esac

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

blocked_reason() {  # one-line explanation + what to do about a ⛔ row
  if blocked_rows | grep -q 'Needs decision:'; then
    echo "a session needs a decision from you (its ⛔ row is marked 'Needs decision:'). Answer it — /session asks you the question interactively and records the decision in PLAN.md — set the row back to 🟡, then re-run autopilot"
  else
    echo "a verification gate failed; see TRACKER.md and .planning/sessions/. To retry that session at a heavier runtime once it's fixed: set its row back to 🟡, then: autopilot --plan $PLAN_DIR --model opus --effort max --max 1"
  fi
}

# ---------------------------------------------------------------------------
# Runtime resolution — which model/effort a session runs at.
# Precedence: --model/--effort flags > prompts/session-N.md frontmatter > default.
# ---------------------------------------------------------------------------
NUM_FIELD=2   # awk -F'|' field holding the session number (first cell), set from the header row

detect_num_field() {  # find the "#" cell in the first table row of the tracker
  local f
  f=$(LC_ALL=C awk -F'|' '/^\|/ { for (i = 2; i <= NF; i++) { c = $i; gsub(/^[ \t]+|[ \t]+$/, "", c); if (c == "#" || c == "No." || c == "Nr") { print i; exit } } exit }' "$TRACKER")
  NUM_FIELD="${f:-2}"
}

session_num_from_row() {  # $1 = tracker row → its session number (3, 42.5, …) or "" if not a plain number
  local n
  n=$(printf '%s\n' "$1" | LC_ALL=C awk -F'|' -v f="$NUM_FIELD" '{ c = $f; gsub(/[*`_ \t]/, "", c); print c; exit }')
  case "$n" in
    ''|*[!0-9.]*|.*|*.|*.*.*) n="" ;;
  esac
  printf '%s\n' "$n"
}

frontmatter_field() {  # $1 = file, $2 = lowercase key → the value from a leading YAML block, or ""
  [ -f "$1" ] || return 0
  LC_ALL=C awk -v k="$2" '
    NR == 1 { sub(/^\357\273\277/, "") }
    { sub(/\r$/, "") }
    NR == 1 { if ($0 !~ /^---[ \t]*$/) exit; next }
    /^(---|\.\.\.)[ \t]*$/ || NR > 40 { exit }
    { key = $0; sub(/:.*/, "", key); gsub(/^[ \t]+|[ \t]+$/, "", key)
      if (tolower(key) != k) next
      v = $0; sub(/^[^:]*:/, "", v); sub(/[ \t]+#.*$/, "", v)
      gsub(/^[ \t]+|[ \t]+$/, "", v); gsub(/^["'\'']|["'\'']$/, "", v)
      print v; exit }' "$1"
}

RT_MODEL="" RT_EFFORT="" RT_SRC="default" RT_NUM="" RT_FILE=""
RT_WARNED=""

resolve_runtime() {  # $1 = tracker row → sets RT_MODEL RT_EFFORT RT_SRC RT_NUM RT_FILE
  local n file fm_model fm_effort used_fm=0
  RT_MODEL="$MODEL" RT_EFFORT="$EFFORT" RT_SRC="" RT_NUM="" RT_FILE=""
  n="$(session_num_from_row "$1")"
  RT_NUM="$n"
  if [ -n "$n" ]; then
    for file in "$PLAN_DIR/prompts/session-$n.md" "$PLAN_DIR/prompts/session-0$n.md"; do
      if [ -f "$file" ]; then RT_FILE="$file"; break; fi
    done
  fi
  if [ -n "$RT_FILE" ]; then
    fm_model="$(frontmatter_field "$RT_FILE" model | tr '[:upper:]' '[:lower:]')"
    fm_effort="$(frontmatter_field "$RT_FILE" effort | tr '[:upper:]' '[:lower:]')"
    case "$fm_model" in default|-) fm_model="" ;; esac
    case "$fm_effort" in
      ""|low|medium|high|xhigh|max) ;;
      default|-) fm_effort="" ;;
      *) warn "$RT_FILE: ignoring effort '$fm_effort' — not one of low|medium|high|xhigh|max"; fm_effort="" ;;
    esac
    if [ -z "$RT_MODEL" ] && [ -n "$fm_model" ]; then RT_MODEL="$fm_model"; used_fm=1; fi
    if [ -z "$RT_EFFORT" ] && [ -n "$fm_effort" ]; then RT_EFFORT="$fm_effort"; used_fm=1; fi
  elif [ -n "$1" ] && [ "$RT_WARNED" != "$1" ]; then
    RT_WARNED="$1"
    if [ -z "$n" ]; then warn "could not read a session number from the pending row — using flags/defaults: $1"
    else warn "no $PLAN_DIR/prompts/session-$n.md — no runtime profile for this session, using flags/defaults"; fi
  fi
  if [ -n "$MODEL" ] || [ -n "$EFFORT" ]; then RT_SRC="cli"; fi
  if [ "$used_fm" -eq 1 ]; then RT_SRC="${RT_SRC:+$RT_SRC+}frontmatter"; fi
  : "${RT_SRC:=default}"
}

next_model() {  # $1 = model alias → the next rung up, or "" when there is none
  case "$1" in
    haiku)  echo sonnet ;;
    sonnet) echo opus ;;
    opus)   echo fable ;;
    *)      : ;;
  esac
}

escalation_rungs() {  # $1 = model ("" = default), $2 = effort ("" = default) → one "model effort" line per rung ("-" = omit the flag)
  local m="${1:--}" e="${2:--}" nm out last
  out="$m $e"; last="$out"
  if [ "$ESCALATE" != "off" ] && [ "$e" != "max" ]; then
    last="$m max"; out="$out
$last"
  fi
  if [ "$ESCALATE" = "model" ]; then
    nm="$(next_model "$m")"
    if [ -n "$nm" ]; then last="$nm max"; out="$out
$last"; fi
  fi
  # never fewer than two rungs — an identical retry keeps the two-strike brake when nothing can escalate
  if [ "$(printf '%s\n' "$out" | wc -l | tr -d ' ')" -lt 2 ]; then out="$out
$last"; fi
  printf '%s\n' "$out"
}

rung_for_attempt() { printf '%s\n' "$1" | sed -n "${2}p"; }   # $1 = rungs, $2 = rung index

rungs_pretty() { printf '%s\n' "$1" | awk '{ printf "%s%s/%s", (NR > 1 ? " → " : ""), ($1 == "-" ? "default" : $1), ($2 == "-" ? "default" : $2) } END { print "" }'; }

new_session_id() {
  if command -v uuidgen >/dev/null 2>&1; then uuidgen | tr '[:upper:]' '[:lower:]'
  else python3 -c 'import uuid; print(uuid.uuid4())'; fi
}

build_note() {  # $1 = attempt no., $2 = model, $3 = effort, $4 = "escalated from m/e" ("" if not), $5 = previous-yield text ("" if none) → sets NOTE
  local m="$2" e="$3" esc="" prev=""
  [ "$m" = "-" ] && m="default"
  [ "$e" = "-" ] && e="default"
  [ -n "$4" ] && esc=", escalated from $4 after a run made no tracker progress"
  [ -n "$5" ] && prev="; your previous attempt ended after $5"
  printf -v NOTE 'Autopilot (headless) run — attempt %s for this session at model=%s effort=%s%s%s. Rules for this run: (1) this process ends the moment you end your turn — never stop to wait for background work; wait for it synchronously instead. (2) AskUserQuestion and permission prompts are unavailable — if you need a decision the plan does not settle, mark the tracker row ⛔ with "Needs decision: <question — options>", write the session summary, commit, and stop. (3) Add the line "Runtime: %s/%s (autopilot attempt %s)" to the TRACKER session-log entry for this session and to the Runtime field of the session summary.' \
    "$1" "$m" "$e" "$esc" "$prev" "$m" "$e" "$1"
}

show_cmd() {  # $1 = model, $2 = effort → the claude command for display (note abbreviated)
  local s="${CMD[*]}"
  [ "$1" != "-" ] && s="$s --model $1"
  [ "$2" != "-" ] && s="$s --effort $2"
  printf '%s --session-id <uuid> --append-system-prompt "<headless note>"\n' "$s"
}

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
detect_num_field

RUN_DIR="$PLAN_DIR/autopilot"
LOG_FILE="$RUN_DIR/autopilot.log"
LAUNCH="$(date '+%Y%m%d-%H%M%S')"   # run files are per launch, so earlier launches' evidence survives

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
# Result-JSON parsing for one claude run. Prints one key=value per line:
#   is_err cost dur reset subtype turns stop term denials denied_tool models sid asks waits
# then msg=<final message, head>, tail=<final message, end> and detail=<refused command>.
# asks = the final message asks the human for something; waits = it defers to background work.
# ---------------------------------------------------------------------------
parse_run() {  # $1 = run json file
  python3 - "$1" <<'PY'
import json, re, sys

def san(v):
    v = "-" if v is None or v == "" else str(v)
    return re.sub(r"[^A-Za-z0-9._:/,\[\]-]", "_", v) or "-"

def emit(fields, msg, detail, tail=""):
    for k, v in fields.items():
        print(f"{k}={san(v)}")
    print("msg=" + " ".join(str(msg).split())[:300])
    print("tail=" + str(tail)[-300:])
    print("detail=" + " ".join(str(detail).split())[:400])

ASKS = re.compile(r"(?i)(would you like|(could|can) you (please )?(clarify|confirm|provide|tell|let|specify|choose|decide|approve)|should i\b|shall i\b|do you want|please (approve|confirm|advise|choose|decide|provide|let me know|clarify|grant)|let me know (how|which|if|whether|what)|which (option|approach|one) (do|would|should)|i need (you|your)\b|needs? your (input|decision|approval|confirmation|answer)|requires? your (confirmation|approval|input|decision)|requires? (user )?(approval|confirmation)|(waiting|awaiting) (for |on )?your|(cannot|can't|can’t|unable to) proceed without|blocked by a hook|was blocked by|permission (was )?denied|needs? (a|your) decision)")
QMARK = re.compile(r"\?(?:[\s*_`)\"']|$)")   # a sentence-ending "?" (not a URL query) in the closing lines
WAITS = re.compile(r"(?i)(running in the background|in the background|once (it|they|that|this|the [\w -]{1,40}?) (finishes|completes|is done|are done|has finished)|when (it|they|that) (finishes|finish|completes|complete)|waiting (for|on) (it|them|the|that)|i(?:'|’)ll (check|continue|kick off|resume|monitor|report|wait|come back|pick)|i will (check|continue|kick off|resume|monitor|report|wait|come back))")

def limit_epoch(text):
    if re.search(r"(?i)(usage limit|limit reached|rate.?limit)", text):
        m = re.search(r"\b(1\d{9})\b", text)
        return m.group(1) if m else "0"       # 0 = limit hit, no epoch found
    return "-"

blank = dict(is_err="parse_error", cost="-", dur="-", reset="-", subtype="-", turns="-",
             stop="-", term="-", denials="-", denied_tool="-", models="-", sid="-", asks=0, waits=0)
try:
    raw = open(sys.argv[1], errors="replace").read()
except Exception:
    raw = ""
try:
    d = json.loads(raw)
    if not isinstance(d, dict):
        raise ValueError("not an object")
except Exception:
    blank["reset"] = limit_epoch(raw)
    emit(blank, raw.strip()[:300] if raw.strip() else "(empty output — the claude process wrote nothing)", "")
    sys.exit(0)

text = d.get("result") or d.get("error") or ""
if not text and d.get("errors"):
    errs = d["errors"]
    text = " | ".join(str(e) for e in errs) if isinstance(errs, list) else str(errs)
text = str(text)
tail = " ".join(text.split())[-500:]

den = d.get("permission_denials") or []
denied_tool, detail = "-", ""
if den:
    first = den[0] if isinstance(den[0], dict) else {}
    denied_tool = first.get("tool_name") or "?"
    ti = first.get("tool_input") or {}
    if denied_tool == "AskUserQuestion" and isinstance(ti, dict):
        parts = []
        for q in (ti.get("questions") or [])[:3]:
            if not isinstance(q, dict):
                continue
            opts = ", ".join(str(o.get("label")) for o in (q.get("options") or []) if isinstance(o, dict))
            parts.append(f"{q.get('question')} [{opts}]")
        detail = " || ".join(parts) or str(ti)
    elif isinstance(ti, dict):
        detail = str(ti.get("command") or ti.get("file_path") or ti.get("description") or ti)
    else:
        detail = str(ti)

mu = d.get("modelUsage") or d.get("model_usage") or {}
models = ",".join(mu.keys()) if isinstance(mu, dict) and mu else "-"
cost = d.get("total_cost_usd")
cost = round(cost, 2) if isinstance(cost, (int, float)) else "-"
dur = round(d["duration_ms"] / 1000) if isinstance(d.get("duration_ms"), (int, float)) else "-"
turns = d.get("num_turns")
emit(dict(
    is_err=str(bool(d.get("is_error"))).lower(),
    cost=cost,
    dur=dur,
    reset=limit_epoch(text),
    subtype=d.get("subtype") or "-",
    turns=turns if isinstance(turns, int) else "-",
    stop=d.get("stop_reason") or "-",
    term=d.get("terminal_reason") or "-",
    denials=len(den),
    denied_tool=denied_tool,
    models=models,
    sid=d.get("session_id") or "-",
    asks=1 if (ASKS.search(tail) or QMARK.search(tail[-300:])) else 0,
    waits=1 if WAITS.search(tail) else 0,
), text, detail, tail)
PY
}

read_run() {  # $1 = run json file → sets the R_* globals
  R_IS_ERR=parse_error R_COST=- R_DUR=- R_RESET=- R_SUBTYPE=- R_TURNS=- R_STOP=- R_TERM=- R_DENIALS=- R_DENIED_TOOL=- R_MODELS=- R_ASKS=0 R_WAITS=0 R_MSG="" R_TAIL="" R_DETAIL=""
  local k v
  while IFS='=' read -r k v; do
    case "$k" in
      is_err)      R_IS_ERR="$v" ;;
      cost)        R_COST="$v" ;;
      dur)         R_DUR="$v" ;;
      reset)       R_RESET="$v" ;;
      subtype)     R_SUBTYPE="$v" ;;
      turns)       R_TURNS="$v" ;;
      stop)        R_STOP="$v" ;;
      term)        R_TERM="$v" ;;
      asks)        R_ASKS="$v" ;;
      waits)       R_WAITS="$v" ;;
      tail)        R_TAIL="$v" ;;
      denials)     R_DENIALS="$v" ;;
      denied_tool) R_DENIED_TOOL="$v" ;;
      models)      R_MODELS="$v" ;;
      msg)         R_MSG="$v" ;;
      detail)      R_DETAIL="$v" ;;
    esac
  done < <(parse_run "$1")
}

# ---------------------------------------------------------------------------
# Classifying a no-progress run (see the header). Uses R_* and claude_exit.
# ---------------------------------------------------------------------------
ENV_RE='command not found|No such file|ENOENT|EACCES|[Pp]ermission denied|not a git repository|[Uu]nknown (skill|slash command|command)|not installed|[Aa]uthentication|[Uu]nauthori[sz]ed|[Ii]nvalid [Aa][Pp][Ii] [Kk]ey|ECONNREFUSED|ETIMEDOUT|Cannot connect to the Docker daemon|[Nn]o space left'

classify_run() {  # prints: needs-human | env | yielded | stalled
  # hard failures of the process itself first
  if [ "$R_IS_ERR" != "false" ] || [ "$claude_exit" -ne 0 ]; then echo env; return 0; fi
  case "$R_SUBTYPE" in success|error_max_turns) ;; *) echo env; return 0 ;; esac
  # a hook stopped the run, or the final message asks the human for something
  if [ "$R_TERM" = "hook_stopped" ] || [ "$R_ASKS" = "1" ]; then echo needs-human; return 0; fi
  # cut off at a tool call with no final message: handed off to background work
  if [ "$R_STOP" = "tool_use" ]; then echo yielded; return 0; fi
  if [ "$R_TURNS" = "-" ] || [ "$R_TURNS" -le 2 ]; then echo env; return 0; fi
  if printf '%s' "$R_MSG $R_TAIL" | grep -Eq "$ENV_RE"; then echo env; return 0; fi
  if [ "$R_STOP" = "end_turn" ] && { [ "$R_TURNS" -le "$YIELD_TURNS" ] || [ "$R_WAITS" = "1" ]; }; then echo yielded; return 0; fi
  echo stalled
}

needs_human_report() {
  echo "----------------------------------------------------------------------"
  echo "This session stopped because it needs something only a human can give:"
  if [ "$R_TERM" = "hook_stopped" ]; then
    echo "  a hook stopped the run outright (terminal_reason=hook_stopped) — only you can change that hook."
  else
    echo "  its final message asks you for something:"
    echo "    …${R_TAIL:-$R_MSG}"
  fi
  if [ "$R_DENIALS" != "-" ] && [ "$R_DENIALS" -gt 0 ]; then
    echo "  a $R_DENIED_TOOL call was refused by a hook or permission rule during the run: ${R_DETAIL:-(see the run file)}"
    echo "  (deny rules and PreToolUse hooks still apply under --permission-mode $PERM_MODE — fix the rule or hook if the call was legitimate)"
  fi
  echo "  full result: $run_json"
  echo "To answer and continue that session with its context intact:"
  echo "  claude -p --resume $sid --permission-mode $PERM_MODE \"<your answer>\""
  echo "Or record the decision in PLAN.md / the session prompt, then re-run autopilot."
  echo "----------------------------------------------------------------------"
}

diagnosis() {
  local dirty
  dirty="$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
  echo "----------------------------------------------------------------------"
  echo "Session ${RT_NUM:-?} made no tracker progress in $STRIKES attempt(s):$ATTEMPTS"
  case "$ROW_FIRST" in
    *⬜*) if next_pending_row | grep -q '🟡'; then
            echo "  The row went ⬜→🟡: the session started but never finished — it may be too big for one context window."
            echo "  Split it (PLAN.md §5 + prompts/), or raise its profile in ${RT_FILE:-prompts/session-${RT_NUM:-N}.md}."
          fi ;;
    *🟡*) echo "  The row was already 🟡 before autopilot started and never finished — check .planning/sessions/ for the partial attempt; consider splitting the session." ;;
  esac
  if [ "$ESCALATE" = "model" ] && [ -z "$(next_model "${RT_MODEL:--}")" ]; then
    echo "  No model rung was available above '${RT_MODEL:-default}' (ladder: haiku → sonnet → opus → fable; an unset default cannot be escalated — give the session a profile or pass --model)."
  fi
  [ "$dirty" -gt 0 ] && echo "  $dirty uncommitted file(s) in the working tree — the last attempt left partial work; the next /session run picks it up."
  [ -n "$R_MSG" ] && echo "  Last message: $R_MSG"
  echo "  Last session id: $sid — continue it by hand: claude -p --resume $sid --permission-mode $PERM_MODE \"continue the session\""
  echo "  Recent log lines:"
  tail -n 5 "$LOG_FILE" 2>/dev/null | sed 's/^/    /'
  echo "----------------------------------------------------------------------"
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
# Branch selection (opt-in). Check out --branch, creating it from the current
# HEAD if it doesn't exist yet. Runs once, before the loop; every session then
# commits onto this branch. Without --branch, we stay on the current branch.
# ---------------------------------------------------------------------------
ensure_branch() {
  local b="$1" cur out
  cur="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
  [ "$cur" = "$b" ] && { log "already on branch $b"; return 0; }
  if git show-ref --verify --quiet "refs/heads/$b"; then
    out="$(git checkout "$b" 2>&1)" \
      || die "could not switch to existing branch '$b' — commit or stash conflicting changes first:
$out"
    log "switched to existing branch $b (was $cur)"
  else
    out="$(git checkout -b "$b" 2>&1)" || die "could not create branch '$b':
$out"
    log "created and switched to branch $b (from $cur)"
  fi
}

# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------
read_tracker
[ "$BLOCKED" -gt 0 ] && { blocked_rows >&2; die "tracker has a ⛔ row: $(blocked_reason)" 2; }
[ "$PENDING" -eq 0 ] && { log "roadmap already complete ($DONE sessions ✅) — nothing to do"; exit 0; }

# Unattended runs must survive transient API weather (see header note).
export CLAUDE_CODE_RETRY_WATCHDOG=1

CMD=(claude -p "/planning:session $PLAN_DIR" --output-format json --permission-mode "$PERM_MODE")

if [ "$DRY_RUN" -eq 1 ]; then
  log "dry run — tracker: $DONE done / $PENDING pending / $BLOCKED blocked"
  row="$(next_pending_row)"
  log "next session row: $row"
  resolve_runtime "$row"
  src_note="$RT_SRC"
  case "$RT_SRC" in
    *frontmatter*) src_note="$RT_SRC — $RT_FILE" ;;
    *) [ -n "$RT_FILE" ] && src_note="$RT_SRC — no runtime profile in $RT_FILE (run /calibrate-roadmap to add one)" ;;
  esac
  log "resolved runtime for session ${RT_NUM:-?}: model=${RT_MODEL:-default} effort=${RT_EFFORT:-default} (source: $src_note)"
  rungs="$(escalation_rungs "$RT_MODEL" "$RT_EFFORT")"
  log "escalation on a stall (--escalate $ESCALATE): $(rungs_pretty "$rungs")"
  [ -n "$BRANCH" ] && log "would check out branch: $BRANCH (currently on $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?'))"
  read -r m e <<< "$(rung_for_attempt "$rungs" 1)"
  log "would run: $(show_cmd "$m" "$e")"
  [ "$MAX" -gt 0 ] && log "for up to $MAX iteration(s)"
  exit 0
fi

[ -n "$BRANCH" ] && ensure_branch "$BRANCH"

mkdir -p "$RUN_DIR"
STRIKES=0        # consecutive no-progress runs at the current session
RUNG=1           # ladder rung the next attempt uses
ATTEMPTS=""      # diagnosis lines for the current session
PREV_CLASS=""    # class of the previous no-progress run (detects env twice / yield twice)
PREV_YIELD=""    # what the previous yielded attempt said, for the next run's note
ROW_FIRST=""     # the pending row as first seen for this session (⬜→🟡 detection)
sid="" run_json="" claude_exit=0

while :; do
  read_tracker
  if [ "$BLOCKED" -gt 0 ]; then
    summary
    blocked_rows >&2
    die "session blocked (⛔): $(blocked_reason)" 2
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
  run_json="$RUN_DIR/run-$LAUNCH-$ITER.json"
  row="$(next_pending_row)"
  [ "$STRIKES" -eq 0 ] && ROW_FIRST="$row"

  # --- resolve this attempt's runtime -------------------------------------
  resolve_runtime "$row"
  rungs="$(escalation_rungs "$RT_MODEL" "$RT_EFFORT")"
  K="$(printf '%s\n' "$rungs" | wc -l | tr -d ' ')"
  [ "$RUNG" -gt "$K" ] && RUNG="$K"
  read -r run_model run_effort <<< "$(rung_for_attempt "$rungs" "$RUNG")"
  esc_from=""
  if [ "$RUNG" -gt 1 ]; then
    read -r m0 e0 <<< "$(rung_for_attempt "$rungs" 1)"
    esc_from="${m0/#-/default}/${e0/#-/default}"
  fi
  attempt=$(( STRIKES + 1 ))
  sid="$(new_session_id)"
  build_note "$attempt" "$run_model" "$run_effort" "$esc_from" "$PREV_YIELD"
  RUN=("${CMD[@]}")
  [ "$run_model" != "-" ]  && RUN+=(--model "$run_model")
  [ "$run_effort" != "-" ] && RUN+=(--effort "$run_effort")
  RUN+=(--session-id "$sid" --append-system-prompt "$NOTE")

  log "[$iter_label] starting: $row"
  log "[$iter_label] runtime: model=$run_model effort=$run_effort (attempt $attempt, rung $RUNG/$K, source: $RT_SRC) session-id=$sid"

  "${RUN[@]}" > "$run_json" 2>>"$LOG_FILE" < /dev/null
  claude_exit=$?
  read_run "$run_json"

  if [ "$R_RESET" != "-" ]; then
    ITER=$(( ITER - 1 ))            # limit hits don't consume an iteration
    warn "usage limit reached: $R_MSG"
    if [ "$R_RESET" != "0" ]; then
      sleep_until_epoch "$R_RESET"
    else
      log "no reset time in the error — backing off $BACKOFF"
      sleep "$BACKOFF_SECS"
    fi
    continue
  fi

  [ "$R_IS_ERR" != "false" ] && warn "claude run reported an error (is_error=$R_IS_ERR): $R_MSG"

  read_tracker
  progressed=0
  { [ "$DONE" -gt "$done_before" ] || [ "$PENDING" -lt "$pending_before" ]; } && progressed=1

  outcome="no progress"
  if [ "$BLOCKED" -gt 0 ]; then outcome="⛔ blocked"
  elif [ "$progressed" -eq 1 ]; then outcome="✅"; SESSIONS_DONE=$(( SESSIONS_DONE + 1 ))
  fi
  line="[$iter_label] $(date '+%F %T') exit=$claude_exit is_error=$R_IS_ERR cost=\$$R_COST duration=${R_DUR}s outcome=$outcome — pending ${pending_before}→${PENDING} model=$run_model effort=$run_effort attempt=$attempt rung=$RUNG/$K subtype=$R_SUBTYPE stop=$R_STOP term=$R_TERM turns=$R_TURNS denials=$R_DENIALS models=$R_MODELS sid=$sid"
  log "$line"
  echo "$line" >> "$LOG_FILE"

  if [ "$BLOCKED" -gt 0 ] || [ "$progressed" -eq 1 ]; then
    if [ "$R_DENIALS" != "-" ] && [ "$R_DENIALS" -gt 0 ]; then
      warn "a $R_DENIED_TOOL call was refused during this run (see $run_json → permission_denials) — the session worked around it"
    fi
    STRIKES=0 RUNG=1 ATTEMPTS="" PREV_CLASS="" PREV_YIELD="" ROW_FIRST=""
    continue
  fi

  # --- no progress: classify before acting ---------------------------------
  cls="$(classify_run)"
  STRIKES=$(( STRIKES + 1 ))
  ATTEMPTS="$ATTEMPTS
  attempt $attempt: model=$run_model effort=$run_effort — $cls (subtype=$R_SUBTYPE stop=$R_STOP term=$R_TERM turns=$R_TURNS cost=\$$R_COST) → $run_json"
  PREV_YIELD=""
  if [ "$cls" != "needs-human" ] && [ "$R_DENIALS" != "-" ] && [ "$R_DENIALS" -gt 0 ]; then
    warn "a $R_DENIED_TOOL call was refused by a hook or permission rule during this run: $R_DETAIL"
  fi
  case "$cls" in
    needs-human)
      summary
      needs_human_report >&2
      die "session needs a human — see above" 4 ;;
    env)
      warn "environment failure, not a model failure (strike $STRIKES): $R_MSG"
      if [ "$PREV_CLASS" = "env" ]; then
        summary; diagnosis >&2
        die "same environment failure twice — fix the environment, not the model; see $run_json" 3
      fi ;;
    yielded)
      if [ "$R_STOP" = "tool_use" ]; then
        warn "the run ended at a tool call with no final message after $R_TURNS turn(s) (strike $STRIKES) — it handed off to background work or was cut off"
        PREV_YIELD="$R_TURNS turn(s) at a tool call with no final message — you most likely handed off to background work"
      else
        warn "the run ended its turn without finishing after $R_TURNS turn(s) (strike $STRIKES): ${R_TAIL:-$R_MSG}"
        PREV_YIELD="$R_TURNS turn(s) with: \"${R_TAIL:-$R_MSG}\""
      fi
      [ "$PREV_CLASS" = "yielded" ] && cls="stalled"   # a second yield in a row is a stall
      ;;
  esac
  if [ "$cls" = "stalled" ]; then
    if [ "$RUNG" -lt "$K" ]; then
      RUNG=$(( RUNG + 1 ))
      read -r nm ne <<< "$(rung_for_attempt "$rungs" "$RUNG")"
      warn "no tracker progress (strike $STRIKES) — next attempt escalates to model=$nm effort=$ne"
    else
      summary; diagnosis >&2
      die "escalation ladder exhausted after $STRIKES attempt(s) with no tracker progress — stopping to avoid burning your subscription" 3
    fi
  fi
  PREV_CLASS="$cls"
  if [ "$STRIKES" -gt "$K" ]; then
    summary; diagnosis >&2
    die "$STRIKES consecutive runs made no progress — stopping to avoid burning your subscription" 3
  fi
done
