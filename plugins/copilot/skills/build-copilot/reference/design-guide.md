# Embedded Copilot: A Portable Design Guide

This document describes how to build an in-app AI copilot: a context-aware, tool-calling chat assistant embedded in a web application. It is written for an implementer (human or AI) working in a different codebase. It generalises a production implementation (NexusOS, FastAPI + React) but nothing here requires that stack. Wherever you see a concrete name from the reference implementation, treat it as an example, not a requirement.

Read the whole document once before writing code. Section 12 is the adaptation checklist: the list of things that MUST change per application.

---

## 1. What you are building

A copilot that:

1. Lives in a **chat drawer** available on every page of the app.
2. Talks to **any OpenAI-compatible LLM endpoint** (local LM Studio/Ollama, self-hosted vLLM, or a cloud provider), selected by the administrator in a **settings panel**, not hardcoded.
3. **Knows what the user is looking at** (route-derived page context with entity ids) and can resolve "this page", "this record", "here".
4. **Answers "how do I..." questions from a help corpus**, the same markdown files that power the app's Help page, so the assistant and the docs can never drift apart.
5. **Reads live application data** through authorization-scoped tools, and can **draft changes** as reviewable proposals, never direct writes.
6. Advertises what it can do via **suggestion chips** and **Ask buttons** placed on relevant pages.
7. Degrades cleanly: when disabled or unconfigured, every copilot surface disappears and the API refuses politely.

The overall shape:

```
Browser                          Backend                          LLM
+------------------+   SSE   +--------------------+   SSE   +-----------------+
| Chat drawer      |<--------| Copilot API        |<--------| OpenAI-compat   |
|  context pill    |  POST   |  prompt assembly   |  POST   | /chat/completions|
|  suggestion chips|-------->|  tool loop         |-------->| (LM Studio,     |
|  Ask buttons     |         |  persistence       |         |  vLLM, cloud...) |
+------------------+         +---------+----------+         +-----------------+
                                       |
                             app service layer + DB
                             (read tools, draft-write tools,
                              help corpus search, conversations)
```

The backend is a proxy with a brain: it owns the system prompt, the tool loop, authorization, persistence, and budgets. The browser never talks to the LLM directly and never sees the API key.

---

## 2. LLM integration layer

### 2.1 Protocol choice

Speak the **OpenAI chat-completions protocol with streaming** (`POST {base_url}/chat/completions`, `stream: true`, SSE response). This one decision buys provider independence: LM Studio, Ollama, vLLM, llama.cpp server, OpenAI, OpenRouter, and most gateways all expose it. Do not use a provider SDK; a plain HTTP client with streaming support is enough and keeps the endpoint swappable.

Request payload per completion round:

```json
{
  "model": "<configured model name>",
  "messages": [ ...single system message, history, user turn, tool turns... ],
  "tools": [ ...function schemas, see section 6... ],
  "temperature": 0.2,
  "max_tokens": 2048,
  "stream": true
}
```

Add `Authorization: Bearer <key>` only when an API key is configured (local servers usually need none).

### 2.2 Streaming parser requirements

Parse the SSE body line by line. These details are load-bearing; every one of them was learned from a real failure:

- Only process lines starting with `data: `. Stop on the literal `data: [DONE]`.
- Each data line is a JSON chunk; you consume `choices[0]`, reading `delta.content`, `delta.tool_calls`, and `finish_reason`.
- **Tool calls arrive fragmented.** Each `delta.tool_calls[i]` carries an `index` plus partial `id`, `function.name`, and `function.arguments` strings. Accumulate them by index across chunks and only JSON-parse the arguments once the round finishes with `finish_reason: "tool_calls"`.
- **In-stream errors on HTTP 200.** Local servers (LM Studio notably) can return `{"error": {...}}` as an SSE chunk inside a 200 response when the model or chat template fails. Check every chunk for an `error` key and raise a real error. If you skip this, failures manifest as silent empty answers.
- **Reasoning tokens.** Reasoning models emit `<think>...</think>` blocks inline, or the server parses them into `delta.reasoning_content` (which you ignore, but which still burns the token budget). Implement:
  - a streaming-safe think-stripper that suppresses text between think tags even when a tag is split across two deltas, applied to tokens as they stream to the UI;
  - a final whole-string strip applied to the persisted answer;
  - a config flag (call it `disable_thinking`) that adds `"chat_template_kwargs": {"enable_thinking": false}` to the payload for servers that support it.
- **Timeouts and heartbeats.** Use a generous read timeout (120s) toward the LLM, and send an SSE comment line (`: ping`) to the browser every ~10s of model silence so intermediate proxies do not kill the connection.

### 2.3 Chat template constraints

Send **exactly one system message**. Some local chat templates (qwen on LM Studio, for example) hard-fail when they see two system turns. Everything that would tempt you to add a second system message (page context, per-turn hints) gets appended to the single system string instead. This costs nothing on providers that would tolerate two and saves you on the ones that will not.

### 2.4 Budgets for small models

Local models often run 8k to 16k context windows. Budget in characters (good enough, zero tokenizer dependency):

| Budget | Reference value | Applied to |
|---|---|---|
| `max_tokens` | 2048 | generation cap per completion |
| history budget | 8000 chars | prior turns, trimmed oldest-first; coalesce consecutive same-role turns |
| tool result cap | 8000 chars | each tool result JSON before it goes back into the message list |
| basics block | 1800 chars | help-corpus excerpt injected into the system prompt, cut on a paragraph boundary |
| help search result | 2400 chars | each `search_help` result section |
| page context | 500 chars | the per-turn context descriptor, clamped client-side and server-side |

Make all of these configurable. Keep the system prompt lean (aim under ~2.5k tokens); on a small model, a bloated system prompt directly steals room from tool rounds.

---

## 3. Endpoint configuration as a Setting

This is a deliberate improvement over the reference implementation (which used env vars only): the LLM endpoint is **admin-configurable at runtime** through the app's settings UI.

### 3.1 Settings model

An admin-only settings panel ("AI Assistant" section) with:

| Field | Notes |
|---|---|
| Enabled | master toggle; off by default on fresh installs |
| Base URL | e.g. `http://localhost:1234/v1`, `http://vllm.internal:8000/v1`, `https://api.openai.com/v1` |
| Model | free-text model name as the endpoint expects it |
| API key | optional; write-only in the UI (show "set/not set", never echo the value) |
| Timeout (s) | default 120 |
| Max tokens | default 2048 |
| Disable thinking | maps to `chat_template_kwargs.enable_thinking=false` |

Add a **Test connection** button that performs a one-token non-streamed completion server-side and reports success, the error body, or a timeout. This turns "the copilot is broken" into "your endpoint config is wrong" at setup time.

Optionally offer presets that prefill base URL patterns: Local (LM Studio/Ollama), Self-hosted (vLLM), Cloud (OpenAI-compatible). Presets only prefill fields; storage is the same either way.

### 3.2 Storage and precedence

- Persist in an app-DB settings table (key/value is fine). The API key must at minimum be masked in every API response; encrypt at rest if the app has a secrets facility.
- Environment variables remain as **bootstrap defaults**: on first read, if the DB has no row, fall back to env. This keeps container deployments configurable without touching the UI.
- On save, **hot-reload** the backend's LLM client config (re-read on next request, or invalidate a cached config object). Do not require a restart.
- Audit-log settings changes if the app has an audit facility.

### 3.3 Degradation contract

The enable state gates everything, in two layers:

- **Server:** when disabled or unconfigured, every copilot endpoint except the config probe returns 503 with a human-readable detail. A lightweight `GET /copilot/config` returns `{enabled: bool, model: string|null}` for the frontend to read at session bootstrap.
- **Client:** the frontend reads that config once per session. When `enabled` is false, the drawer, chips, and Ask buttons render nothing (not disabled states, nothing). Optionally add a per-user flag as a second gate (`enabled = server.enabled && user.ai_enabled`) so orgs can roll out gradually.

---

## 4. Backend copilot API

Endpoints (adjust naming to the app's conventions):

- `GET /copilot/config` : the enable/model probe (section 3.3).
- `GET /copilot/conversations` : the current user's threads (id, title, updated time).
- `POST /copilot/conversations` : create a thread.
- `GET /copilot/conversations/{id}` : full turn history; enforce ownership.
- `POST /copilot/chat` : the streaming turn. Body: `{conversation_id?, message, page_context?}`. Response: `text/event-stream`.

The chat handler, in order:

1. Refuse (503) when disabled.
2. Resolve or create the conversation (title = first ~60 chars of the first message). Load prior turns as history.
3. **Persist the user turn immediately**, before any model call. Emit a `conversation` event so the client learns the thread id.
4. Run the tool loop (section 6.3), forwarding events to the client as SSE.
5. On `done`, persist the assistant turn and any tool turns, commit.
6. On error, persist a visible error turn (see section 11).
7. Terminate the stream with `data: [DONE]`.

Streaming response headers matter: `Cache-Control: no-cache`, `Connection: keep-alive`, and whatever your reverse proxy needs to not buffer (for nginx: `X-Accel-Buffering: no` on the response, and `proxy_buffering off` plus a long `proxy_read_timeout` in the proxy config).

Framework note: if your framework closes request-scoped DB sessions before a streaming body runs (FastAPI does), open a fresh session inside the stream generator.

### 4.1 The SSE event protocol (backend to browser)

Every event is one `data: {json}\n\n` frame. The union:

| type | payload | meaning |
|---|---|---|
| `conversation` | `{id, title}` | thread resolved/created; sent first |
| `token` | `{text}` | visible answer text delta (already think-stripped) |
| `tool_call` | `{name, label}` | model invoked a tool; show an activity row |
| `tool_result` | `{name, ok, summary, proposal?}` | tool finished; resolve the activity row; `proposal` present when a draft-write succeeded |
| `done` | `{content, turns}` | authoritative final answer text (replaces accumulated tokens) plus persisted turn metadata |
| `error` | `{detail}` | terminal failure for this turn |

Plus `: ping` comment lines as heartbeats, which clients must ignore. This protocol is the contract between backend and frontend; keep it stable and versionless.

---

## 5. System prompt assembly

One system message, assembled fresh per request from sections:

1. **Identity and role.** Who the assistant is, what app it lives in, its tone.
2. **Domain model summary.** A compact explanation of the app's core entities and how they relate. Keep it short; details belong in the help corpus.
3. **Vocabulary block** (only if the app has renameable terminology, see section 8.4): "Active terminology (use these exact terms): ..." so answers use the customer's words.
4. **App basics block**: a designated help-corpus doc injected verbatim (capped, cut on a paragraph boundary). This gives baseline app knowledge without a tool round.
5. **Tool guidance.** List the tools by tier (READ / HELP / PROPOSE) with one line each, plus routing rules: resolve names to ids with search before fetching; answer "how do I" questions via help search, never from memory; drafts only, never direct writes.
6. **Rules.** Never invent data; cite record names when reporting; do not expose personal data; when unsure, say so and point to the relevant page.
7. **Page context** (per turn, appended to this same string): `The user is currently viewing: {page_context}. If they say "this page", "this record", or "here", resolve it with the read tools using the ids given above.`

Message array per turn: `[system] + trimmed_history + [user]`, then grows with assistant tool-call turns and tool results inside the loop.

---

## 6. Tools (function calling)

### 6.1 The three tiers

This is where each application differs most. Design the tool set from the app's entity model, in three tiers:

- **READ tools** (the bulk): authorization-scoped lookups over the app's core entities. Always include a search/resolve tool (name to id) and a get-by-id tool for each first-class entity, plus whatever aggregate/registry query the app's main list views support. Reuse the app's existing service layer and permission checks; the copilot must never see more than the requesting user could see in the UI. Strip personal data (emails, phone numbers) from tool results.
- **HELP tool** (exactly one): `search_help(query)` over the help corpus (section 8). The system prompt instructs the model to answer all app-usage questions through this tool and cite section titles.
- **PROPOSE tools** (few, guarded): draft-only writes. Each one creates a **reviewable draft/proposal record**, never a confirmed or live change: no status transitions, no edits to live text, no deletes. Every propose call is audit-logged with a "via copilot" marker, notifies the humans who own the target record, and is rate-limited per user (a sliding window is fine; put the counter in shared storage if you run multiple workers).

Aim for roughly 6 to 12 read tools, 1 help tool, and no more than a handful of propose tools. Fewer, well-described tools beat many overlapping ones, especially on small models.

### 6.2 Schemas and dispatch

Tools are plain OpenAI function schemas:

```json
{"type": "function", "function": {
  "name": "get_record",
  "description": "Fetch one <entity> by id, including ... Use search_records first to resolve a name to an id.",
  "parameters": {"type": "object", "properties": {"id": {"type": "integer"}}, "required": ["id"]}
}}
```

Keep a dispatch table `name -> async implementation`. Every implementation:

- receives the DB session, the requesting user's authorization scope, and (write tools only) the user identity for authorship and audit;
- is wrapped in try/except so a failure returns `{"error": "<message>"}` instead of crashing the loop (the model reads the error and recovers or apologises);
- returns a JSON-serialisable dict; successful propose tools include a `proposed` key with the draft payload so the frontend can render a proposal card;
- has its serialized result truncated (8000 chars) before entering the message list.

### 6.3 The tool loop

Bounded rounds (6 is a good cap) per user turn:

```
for round in range(MAX_TOOL_ROUNDS):
    stream one completion
      - yield token events for visible content deltas (think-stripped)
      - accumulate tool_call fragments by index
    if finish_reason == "tool_calls":
        append the assistant tool-call turn to the message list
        for each call:
            emit tool_call event
            result = run_tool(name, args, db, scope, user)
            emit tool_result event  (ok = "error" not in result,
                                     summary = short human line,
                                     proposal = result payload if drafted)
            append {"role": "tool", "tool_call_id": id, "content": json(result)[:8000]}
        continue
    else:
        final = strip_think(accumulated_content)
        emit done; break
```

If the cap is hit, emit `done` with whatever content exists plus a note that the assistant stopped early. Generate a short human-readable summary per tool result ("Found 3 matching records", "Drafted a proposal on X") for the activity row in the UI.

---

## 7. Context awareness

The copilot should know what the user is looking at, with near-zero per-page wiring:

- **Route to descriptor mapping (client side).** One module with a regex dispatch over the current pathname (+ query string) returning `{label, context}`:
  - `label`: a short human chip, e.g. `Record: Acme Corp` or `Reports`.
  - `context`: a one-line model-facing descriptor, e.g. `the detail page of <entity> "Acme Corp" (id=117); tabs: overview, activity`.
- **Entity registration.** Detail pages register their primary entity (`{kind, id, name}`) through a tiny hook/context so the descriptor contains the human name, not just an id from the URL. Key the registration by pathname so a stale entity from the previous route is ignored.
- **The context pill.** The drawer shows the current `label` as a pill near the composer. Clicking toggles it (struck-through when off). When on, the `context` string is sent as `page_context` with each message.
- **Per-turn focus hints.** Ask buttons (section 10) may attach a one-turn hint; the client joins `[page_context, "focus: " + hint]` with `"; "` and clamps to 500 chars. The server validates the same max length.
- **Resolution via tools, not data plumbing.** The descriptor carries ids; the model calls its own read tools to fetch the actual data. Never serialize page data into the context string. This keeps the mechanism one string, one clamp, zero per-page providers.

---

## 8. Help corpus / knowledge base

### 8.1 One corpus, two consumers

Author the app's user documentation as **markdown files in the repo** (e.g. `help_content/*.md`), each with front-matter (`slug`, `title`, `order`). The same files power:

1. the app's **Help page** (rendered list of docs), and
2. the copilot's **`search_help` tool**.

Because there is one source, the assistant can never teach a different UI than the docs describe. Adopt the maintenance rule: **any change to user-visible behaviour updates the corpus in the same change set.**

Organise by area, one file per topic, sections under `##` headings (the search chunks by section). Reference layout: basics, getting started, one file per major entity/page area, admin, the copilot itself, glossary.

### 8.2 Search: BM25, no embeddings

At documentation scale (dozens of section chunks), a hand-rolled BM25 over in-memory chunks outperforms the cost of an embedding stack: no vector DB, no model calls, no drift. Implementation sketch:

- Chunk each doc by `##` section; index tokens per chunk (lowercase, light suffix stripping: trailing `ing/es/ed/s`).
- Classic BM25 (`k1 = 1.5`, `b = 0.75`), with section and doc **titles weighted** several times higher than body text.
- Build the index once per process and cache it; invalidate when the corpus or the terminology map changes.
- `search_help(query)` returns the top few sections as `{doc, section, content}` (each capped ~2400 chars) plus a standing note to the model: cite section titles, and do not answer app-usage questions from memory.

Only reach for embeddings if the corpus grows past a few hundred chunks or users search in a different language than the docs.

### 8.3 The basics block

Mark one doc (front-matter flag such as `inject: basics`) as the always-injected primer, and render it into the system prompt capped at ~1800 chars. This covers "what is this app" without spending a tool round.

### 8.4 Optional: renameable terminology

If the app lets admins rename core concepts (as the reference app does), thread it through everywhere: author corpus text with placeholders (`{{record}}`, `{{Record_plural}}`), render through the active vocabulary for both the Help page and search results, index **both** the rendered and the raw placeholder text (so search matches either wording), and inject the active vocabulary block into the system prompt. If the app has fixed vocabulary, skip all of this.

---

## 9. Frontend chat experience

### 9.1 Structure

- A global **provider** (`CopilotProvider` / `useCopilot`) mounted in the app shell holding: open/closed state, the `/copilot/config` gate, the registered page entity, and a pending-prompt slot used by Ask buttons. Give it no-op defaults so nothing breaks when the copilot is disabled.
- A **drawer** component rendered globally (not per page): message list, composer, context pill, chips, history view. Persist width preference in localStorage.

### 9.2 Streaming client

Use raw `fetch` with a readable stream, not `EventSource` (this is a POST with an Authorization header):

- read chunks with `res.body.getReader()` + `TextDecoder`, buffer and split on `\n\n`;
- per frame: ignore anything not starting with `data: `; return on `[DONE]`; `JSON.parse` the rest; swallow malformed frames (heartbeats);
- non-OK responses throw with the server's error detail before any streaming starts;
- pass an `AbortSignal` so a Stop button and route/thread changes can cancel the in-flight turn.

### 9.3 Rendering the event stream

Hold the streaming assistant message as a mutable "last message" that events patch:

- `token`: append text. Until the first token, show a "thinking" placeholder inside the bubble.
- `tool_call`: push an activity row (spinner + tool label) into the bubble.
- `tool_result`: resolve that row (success/failure dot + summary). If the event carries a `proposal`, render a **proposal card**: a distinct block naming what was drafted, for whom, with a link to where the human reviews it.
- `done`: replace the accumulated text with the authoritative final content. If it is empty, show a visible "No answer was produced" note rather than an empty bubble.
- `error`: render an error banner in place of the answer.
- Abort: if the user pressed Stop, show a quiet "stopped" note; do not present it as an error.

Render assistant text as **markdown** (GFM). Keep user bubbles plain.

### 9.4 History

A conversation list (title + relative time) behind a history toggle; opening a thread loads persisted turns, including persisted error turns rendered as error boxes and tool turns rendered as resolved activity rows. Sending a message from the history list flips back to chat view. Switching threads aborts any in-flight stream.

---

## 10. Discoverability surfaces

An embedded copilot fails silently if users never learn what it can do. Two mechanisms:

- **Suggestion chips.** A route-aware function `suggestionsFor(pathname, entity)` returns prompt starters `{label, prompt}` per page type ("Summarise this record", "What changed here recently?"), falling back to generic ones, always including **"What can you do?"**. Show the full set on an empty thread; after each assistant answer, show 2 compact chips. Clicking a chip sends its full prompt immediately. Resolve any renameable terminology at render time, not module load.
- **Ask buttons.** A small, quiet icon button placed next to key page sections. Clicking opens the drawer and **prefills** the composer with a section-specific prompt plus an optional one-turn context hint; it does not auto-send, so the user stays in control. Accept the prompt as a function so names resolve at click time. The component renders nothing when the copilot is disabled.

---

## 11. Persistence and resilience

Store conversations and turns in the app DB (`conversations`, `messages` with `role`, `content`, optional `tool_name`/`tool_payload`). The failure-mode rules, each of which prevents a real bug class:

1. **Persist the user turn before streaming.** If everything after fails, the thread still shows what the user asked.
2. **Persist assistant + tool turns only on `done`**, in one commit.
3. **Client disconnects mid-stream** (tab closed, navigation, Stop): catch the cancellation in the stream generator and, inside a shield that survives the cancellation (e.g. `asyncio.shield`), persist whatever partial answer text had streamed. Otherwise the thread keeps an unanswered user turn, and replaying it later produces adjacent same-role turns that break some chat templates (coalesce consecutive same-role turns when rebuilding history, regardless).
4. **Model or tool-loop failure:** persist an assistant row flagged as an error (reference trick: reuse the message table with `tool_name = "error"`, no migration) so history honestly shows the turn failed.
5. **Heartbeats** every ~10s of silence keep proxies from dropping long tool rounds.
6. Reverse proxy: disable response buffering and raise the read timeout for the copilot path.

---

## 12. Adaptation checklist (what changes per application)

Work through these in order; everything else in this guide ports as-is.

1. **Entity model to READ tools.** List the app's first-class entities. For each: a search/resolve tool and a get tool; plus the app's main registry/list query as a filtered query tool. Enforce the app's existing authorization on every one.
2. **PROPOSE tools.** Pick the 2 to 5 highest-value drafting actions (create a draft X, suggest edits to Y). Define what a "draft" is in this app: a status, a sidecar record, a pending-review queue. Wire audit + notification + rate limit.
3. **Help corpus.** Write the markdown docs for this app (or convert existing docs), one file per area, front-matter, `##` sections, a designated basics doc. Add the "docs update with UI changes" rule to the contribution guide.
4. **System prompt.** Rewrite identity, domain summary, and rules for this app. Keep it under ~2.5k tokens.
5. **Page context routes.** Write the route-to-descriptor map for this app's router; add entity registration to detail pages.
6. **Suggestion chips + Ask buttons.** Author per-route chip sets and place Ask buttons on the highest-traffic sections.
7. **Settings panel.** Build the AI settings section (section 3) following this app's existing settings UI pattern.
8. **Terminology layer.** Only if the app has renameable vocabulary; otherwise delete every mention of it.
9. **Proxy config.** Apply the no-buffering/timeout rules to this app's ingress for the copilot path.

### Known quirks worth keeping in mind

- LM Studio default port is 1234 and can collide with other local tooling; make the port part of the base URL setting, never assumed.
- LM Studio reports failures as in-stream `{"error": ...}` chunks on HTTP 200 (section 2.2). vLLM with a reasoning parser moves think content to `delta.reasoning_content`.
- Some chat templates reject a second system message (section 2.3).
- Local models need an adequate context window server-side (e.g. load with 16k+ when the system prompt plus tool rounds approach 8k); this is an ops setting on the model server, not in your code.
