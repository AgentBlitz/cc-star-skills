# Session: platform-audit S2 — the bundle extractor

**Date:** 2026-11-27
**Branch:** main
**Roadmap:** `.planning/platform-audit`
**Runtime:** `opus/high (autopilot attempt 1)`

## Summary

Ran Session 2 of the platform-audit roadmap. Wrote `inventory-core.js`, a framework-agnostic reader
that turns downloaded JavaScript and JSON into `inventory.json` without running anything. It has a
tolerant scanner, which blanks comments and regex bodies and tracks strings and templates, plus a
bracket tree and an object-literal reader that rebuilds JS literals as data. Its extractors cover
frameworks, routes, labels, columns, GraphQL, REST and sockets, hosts, access rules, enums, limits,
config, source maps and chunks. Wrote `inventory.mjs`, the CLI that §2.6 specifies (`build`, `summary`,
`routes`, `labels list|show|grep`, `context`, `ops [--md]`, `columns`, `limits`, `enums`, `access`,
`--help`). Added eight hand-written style bundles, each with an `expected.json`, and
`inventory.test.mjs` (17 tests). Every expected item is found, routes and labels are counted exactly,
and `noise` yields nothing. The core also runs in a bare `vm` context, which shows the in-page fallback
can work. A check against real minified code on this machine (playwright-core's 6.5 MB of bundles and
its Vite + React trace viewer) gave no errors and took 0.7 s. The gate passed: `npm test` 24/24, and
genericity clean over the plugin and the added planning lines.

## Changes

- `plugins/audit/skills/platform-audit/scripts/inventory-core.js` — new: the reader, a classic script that
  sets `globalThis.AuditInventory = { build, … }`, with no eval, Function or Node APIs.
- `plugins/audit/skills/platform-audit/scripts/inventory.mjs` — new: the CLI. It reads `.js`/`.mjs`/`.json`
  files recursively, skips `manifest.json`, hashes with sha256 and exits 2 on usage errors.
- `plugins/audit/test/bundles/{vite-react,formatjs-compiled,webpack-i18next,vue,angular,next,gql-ast,noise}/`
  — new: synthetic bundles (2–63 lines each) and `expected.json` files.
- `plugins/audit/test/inventory.test.mjs` — new: per-style matching with exact counts, noise, merge of two
  styles, `.json` resources with `manifest.json` skipped, redaction, every subcommand, `--help` and
  usage errors, the no-Node-API check (a static scan plus a `vm` run), and scanner and literal-reader
  units.
- `.planning/platform-audit/PLAN.md` — §2.6: the shape refinements and the label-priority, `{{x}}` and
  redaction rules; the status line.
- `.planning/platform-audit/TRACKER.md` — row 2 ✅, Notes for S3, session log.

## Decisions & Rationale

- **Shape additions** (recorded in PLAN §2.6): `labelSources`, `on` on fragments, `file` on rules, enums
  and config, `{file,url}` source maps, `{ref,file}` chunks, and an optional `errors` → the prompt asks
  that every item record its file, and S3 needs to resolve a chunk relative to the file that names it.
- **Label precedence:** descriptors first, then English or no-language resources and `$localize`, then
  compiled locales, then other languages → an audit reads in English, and a German-only locale still
  fills in ids nothing else gives.
- **i18next `{{x}}` → `{x}`** → otherwise every label with a placeholder would trip `check-audit`'s `{{`
  marker check (S5) when it reaches the appendix.
- **Redaction lives in the core**, not only in the CLI → the in-page fallback must redact too. The rule is
  a run of more than 24 characters with letters and digits, few dictionary words and entropy ≥ 3.2.
  File names, chunk refs and hashes are exempt.
- **`expected.json` sits beside each bundle**, as the prompt asks, but the tests build from a copy without
  it → `build` reads every `.json`, so it would otherwise read the expectations as a label resource.
- **Relative `path:` values count only in route-like objects** (with `component`, `element`, `children`,
  `loadChildren`, …) or inside a `children` array → bare `path:"x"` values elsewhere would be noise.

## Remaining Work

- Session 3: the partner-portal fixture and `bundle.mjs`. Its admin routes must sit where the reader
  looks (see the tracker's Notes).
- Known limits of the heuristics, for S3 and S6: minified navigation calls (`n("/x")`) and minified
  `createTextVNode` aliases aren't recognised; i18n calls inside UI props aren't text; a fragment's type
  condition is `null` when the AST shares the node through a variable.
- `inventory-core.js` is 69 KB. S6's in-page fallback has to paste it into `javascript_tool`, which is
  heavy; S6 should plan for that (in parts, or a compact copy).

## Resumption Context

Key files to review when picking this up:
- `.planning/platform-audit/PLAN.md` §2.6 (the shape, as refined), §2.7, §5 Session 3
- `plugins/audit/skills/platform-audit/scripts/inventory.mjs --help`
- `plugins/audit/test/bundles/vite-react/` (the closest style to the fixture)

Suggested opening prompt for next session:
> "/planning:session .planning/platform-audit"
