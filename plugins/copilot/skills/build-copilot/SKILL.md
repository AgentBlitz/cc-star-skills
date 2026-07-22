---
name: build-copilot
description: Interactive wizard that builds an embedded, context-aware, tool-calling AI copilot into an existing web app — a chat drawer backed by an OpenAI-compatible LLM proxy, READ/HELP/PROPOSE tools, help-corpus search, and SSE streaming. Triggers on "add a copilot to my app", "build an embedded AI assistant", "in-app chat assistant", "AI copilot drawer", "tool-calling chat assistant", "add an AI helper to this app". Discovers the target stack, confirms a few decisions, then scaffolds the implementation checklist adapting a portable design guide.
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash, Agent, AskUserQuestion]
user-invocable: true
---

# Build Copilot — Embed an AI Assistant Into a Web App

When the user invokes `/build-copilot`, drive the implementation of an in-app AI
copilot into **their** application, adapting the bundled portable design guide to
the target codebase. This is a build wizard: discover the app, confirm a handful
of decisions, then scaffold the pieces in order — reusing the app's existing
service layer, auth, and settings UI rather than inventing new ones.

The full design specification ships with this skill at
`${CLAUDE_PLUGIN_ROOT}/skills/build-copilot/reference/design-guide.md`. It is the
source of truth for every load-bearing detail below; this file is only the
orchestration. **Section numbers below (§2, §6.3, …) refer to that guide.**

## 0. Load the guide and confirm the target

1. **Read the whole guide first** (`reference/design-guide.md`). The guide itself
   mandates a full read before writing code; its §12 is the adaptation checklist
   that this wizard follows.
2. Confirm the current working directory is the **target application repo** (the
   app the copilot will live in), not this marketplace. If it's ambiguous or the
   directory doesn't look like a web app, ask the user which repo to build into
   and stop until it's clear.
3. State up front what you're about to do: adapt the guide's 9-step checklist to
   their app, one step at a time, pausing for the decisions in §2 below.

## 1. Discover the target app

Understand the codebase before proposing any code. For anything beyond a small,
well-known repo, launch an **Explore agent** (or use Grep/Glob directly) to find
and report:

- **Backend**: framework + router style, how routes/streaming responses are
  declared, request-scoped DB session lifecycle (see §4's FastAPI caveat).
- **Frontend**: framework + router, app-shell/provider mounting point, existing
  drawer/modal patterns, how auth tokens reach `fetch`.
- **Data + auth**: the ORM/DB, the **existing service layer and permission
  checks** to reuse (the copilot must never see more than the user could in the
  UI — §6.1), and where personal data lives (to strip it from tool results).
- **Settings**: the existing admin settings UI pattern to extend for the "AI
  Assistant" section (§3).
- **Docs / help**: any existing help or docs corpus that could double as the
  copilot's knowledge base (§8.1), and whether the app has **renameable
  terminology** (§8.4).

Summarise findings back to the user before deciding tools.

## 2. Confirm the per-app decisions

These are the choices the guide says differ per application (§12). Use
**AskUserQuestion**; propose sensible defaults from step 1's findings:

- **READ tools** — which first-class entities get a search/resolve + get-by-id
  tool, plus the main list/registry query. Aim for ~6–12 read tools total (§6.1).
- **PROPOSE tools** — the 2–5 highest-value draft-write actions, and what a
  "draft" is in this app (a status, a sidecar record, a review queue). These are
  draft-only, audit-logged, notify the record owner, and rate-limited (§6.1).
- **Help corpus** — reuse existing docs, or author `help_content/*.md` from
  scratch; pick the always-injected "basics" doc (§8.3).
- **Terminology layer** — include it only if the app has admin-renameable
  concepts; otherwise skip it entirely (§8.4).

Note: the **LLM endpoint is a runtime setting, not a build-time choice** (§3) —
base URL / model / key are configured in the admin panel you'll build, so it works
against LM Studio, vLLM, or a cloud OpenAI-compatible endpoint without code
changes. Don't ask the user to pick a provider now.

## 3. Scaffold, following the checklist in order

Build the pieces below in sequence, adapting each to the app's conventions. After
each piece, briefly report what landed and where. Pull the exact contracts from
the cited guide sections — do not reconstruct them from memory, especially the
ones flagged load-bearing.

1. **LLM streaming client + SSE parser (§2).** OpenAI chat-completions with
   `stream: true`; a plain HTTP client, no provider SDK. The load-bearing details:
   accumulate fragmented `tool_calls` by index and only parse args on
   `finish_reason: "tool_calls"`; treat an in-stream `{"error": …}` on HTTP 200 as
   a real failure; a streaming-safe `<think>` stripper plus a final whole-string
   strip; heartbeats on model silence. Exactly one system message (§2.3).
2. **Settings model + admin panel + degradation contract (§3).** "AI Assistant"
   settings (enabled off by default, base URL, model, write-only API key, timeout,
   max tokens, disable-thinking); a **Test connection** button (one-token probe);
   env vars as bootstrap defaults; hot-reload on save. `GET /copilot/config`
   returns `{enabled, model}`; when disabled, endpoints 503 and the frontend
   renders **nothing** (§3.3).
3. **Copilot API + SSE event protocol (§4).** `config`, `conversations` CRUD, and
   the streaming `POST /copilot/chat`. Persist the user turn *before* the model
   call; emit the `conversation`/`token`/`tool_call`/`tool_result`/`done`/`error`
   event union; set the no-buffering streaming headers; open a fresh DB session
   inside the stream generator if the framework closes the request-scoped one.
4. **System prompt assembly (§5).** One system string built fresh per request:
   identity, domain summary, optional vocabulary block, injected basics doc, tool
   guidance by tier, rules, and the per-turn page-context line. Keep it under
   ~2.5k tokens.
5. **Tools + dispatch + tool loop (§6).** The READ/HELP/PROPOSE tools chosen in
   §2 as OpenAI function schemas over a `name → async impl` dispatch table; each
   impl reuses the app's service layer + auth, try/excepts to `{"error": …}`,
   strips personal data, and truncates results to ~8000 chars. The bounded tool
   loop (cap 6 rounds) with per-result activity summaries (§6.3).
6. **Context awareness (§7).** A client-side route→descriptor map returning
   `{label, context}`; entity registration on detail pages keyed by pathname; the
   context pill; per-turn focus hints clamped to 500 chars. Ids in the descriptor,
   resolved via read tools — never serialize page data into the context string.
7. **Help corpus + BM25 search (§8).** Markdown docs with front-matter powering
   both the Help page and the `search_help` tool; in-memory BM25 (`k1=1.5`,
   `b=0.75`, titles weighted), built once and cached. No embeddings at this scale.
8. **Frontend chat experience + discoverability (§9–10).** The global
   `CopilotProvider` + drawer (message list, composer, context pill, history); a
   raw-`fetch` streaming client (not `EventSource`) with `AbortSignal`; markdown
   rendering; suggestion chips (`suggestionsFor`, always including "What can you
   do?") and Ask buttons that prefill but don't auto-send. Everything renders
   nothing when disabled.
9. **Persistence & resilience + proxy config (§11).** `conversations`/`messages`
   tables; persist user turn before streaming and assistant/tool turns on `done`;
   shield-persist partial answers on client disconnect; record failed turns as
   error rows; heartbeats; and the reverse-proxy no-buffering + long-read-timeout
   rules for the copilot path.

Adopt the guide's maintenance rule (§8.1): **any change to user-visible behaviour
updates the help corpus in the same change set** — add it to the app's
contribution guide.

## 4. Verify end to end

- **Test connection** from the settings panel succeeds against a configured
  endpoint (§3.1).
- **Degradation**: with the copilot disabled, `GET /copilot/config` reports
  `enabled: false` and the drawer, chips, and Ask buttons render nothing (§3.3).
- **One real turn**: enable it, ask a question that forces a tool round (e.g.
  "summarise this record"), and confirm the SSE events stream — `tool_call` →
  `tool_result` → `done` — and the turn persists in history.
- Run the app's existing test/lint/typecheck commands on the changed files.

## Rules

- **Adapt, don't greenfield.** Reuse the app's service layer, auth checks, and
  settings UI. The copilot must never expose data the requesting user couldn't
  already see, and PROPOSE tools draft only — never direct writes (§6.1).
- **Pull contracts from the guide, not memory.** The SSE parser (§2.2), tool loop
  (§6.3), and persistence failure-modes (§11) each encode fixes for real bugs —
  re-read the section before implementing it.
- Skip the terminology layer entirely unless the app has renameable vocabulary.
- Keep the SSE event protocol (§4.1) stable and versionless — it's the
  backend↔frontend contract.
- If `$ARGUMENTS` names a specific piece (e.g. "just the backend tool loop"),
  scope the wizard to that step but still read the guide first.
