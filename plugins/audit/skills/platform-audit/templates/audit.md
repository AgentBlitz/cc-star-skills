# <Product> — Platform Audit

<!-- SECTION title: the product's name as its own screens write it. The skill removes every SECTION comment when it writes the report. -->

> **How to read this document.** Each item carries a tag for where its evidence comes from.
> - **[UI]**: seen on screen, signed in as <role>.
> - **[Code]**: found in the app's code only, because the screen was empty or belongs to another role.
> - **[UI + Code]**: both.
>
> Labels from shared components the product may not use are marked *(shared library)*.

---

## 1. Executive summary

<!-- SECTION summary: all six parts below, in this order, each led by its bold label. check-audit's summary check looks for them. -->

**What it is.** <one paragraph: what the product is, who uses it, how sign-in works, where its data comes from, its languages and currencies>

**What <role> can use** (<evidence tag>)
- **<n> screens:** <list>
- **<n> detail pages:** <list>
- **Account tools:** <list>

**Strengths**
- **<strength>.** <one or two sentences, with the § where it is shown>

**Limitations and gaps to raise with the provider**
- **<gap>.** <what is missing or limited, and why it matters to <role>>

**Limits of this audit**
- <what was not opened, submitted or seen, and why: empty tables, hidden screens, rate limits>

**Suggested next steps**
- <a short, concrete action>

---

## 2. Requirements check (optional)

<!-- SECTION requirements: only when the user gave a checklist. Without one, leave this section out and number the later sections on from 2, fixing every § reference. -->

Key: ✅ met · ⚠️ partial · ❌ missing · ❓ can't tell

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | <requirement, in the user's words> | <✅ / ⚠️ / ❌ / ❓> | <§ reference and one line> |

---

## 3. Platform architecture and access model

### 3.1 Technology (as seen from the browser)

<!-- SECTION technology: only what the browser shows: frameworks, sign-in, API style, hosts named generically. -->

| Area | Finding |
|---|---|
| <area> | <finding> <evidence tag> |

### 3.2 Business scope seen in the data model [Code]

<!-- SECTION scope: the entities and enums the operations and types reveal, as a short list. -->

- <entity>: <what it holds>

### 3.3 Roles and permissions

<!-- SECTION roles: the role names in the code, and which areas each can open. -->

| Role | Can open | Source |
|---|---|---|
| <role> | <areas> | <evidence tag> |

### 3.4 How data is scoped for <role>

<!-- SECTION data-scope: what the server filters to this account, and how that shows on screen. -->

- <rule>

---

## 4. Navigation map

### 4.1 Menu as <role> sees it [UI]

<!-- SECTION menu: a tree, each item with its route in parentheses. -->

```
<Product>
├── <menu group>
│   └── <menu item>                  (<route>)
└── <account menu>
```

### 4.2 Menu items for other roles [Code]

```
<menu group>                         (<roles>)
└── <menu item>
```

### 4.3 Every route in the app (<n>)

<!-- SECTION routes: every route the inventory found, each in backticks, with one status from the key. -->

Status key: ✅ seen on screen · 📄 opened, but empty for this account · 🔗 detail page, no data to open ·
⛔ tried and blocked · 🔒 not shown to this role (from code)

| # | Route | Screen | Status |
|---|---|---|---|
| 1 | `<route>` | <screen> | <status> |

---

## 5. Global interface (on every screen)

<!-- SECTION global: the header, menu, account menu, balances or chips, help links, language switch. -->

| Element | What's there | Source |
|---|---|---|
| <element> | <what it shows or does> | <evidence tag> |

---

## 6. Screen-by-screen map

<!-- SECTION screens: one ### block per screen, from templates/screen.md, in menu order, detail pages after their lists. -->

### 6.1 <Menu group> › <Screen>

<screen block>

---

## 7. Screens not available to <role>

<!-- SECTION hidden: from code only. Say which routes were tried by URL and what they showed. -->

Everything in this section comes from the app's code **[Code]**.

### 7.1 <Menu group> › <Screen> (`<route>`) <⛔ or 🔒>

- **Who:** <roles>
- **Purpose:** <what it is for>
- **What it holds:** <columns, fields, actions found in code>

---

## 8. Capability matrix

<!-- SECTION capabilities: one table per domain. Point to the § that shows each one. -->

Key: ✅ available to this role · 🔒 exists, but only for other roles · 👁 view only · ⚠️ partial or limited ·
❌ not found

### 8.1 <Domain>

| Capability | Status | Where / notes |
|---|---|---|
| <capability> | <✅ / 🔒 / 👁 / ⚠️ / ❌> | <screen, §> |

---

## 9. Limits, rules and constraints found

<!-- SECTION limits: numbers and rules, from screens and code. Numbers that matter in bold. -->

| Limit | Value | Where |
|---|---|---|
| <limit> | **<value>** | <screen or code, evidence tag> |

---

## 10. Reference lists

<!-- SECTION reference: enums, statuses and types, each with where it is used. -->

**<List name> (<n>)** <evidence tag>. <where it is used>.
<member> · <member> · <member>

---

## Appendix A — Server operations available to the web app

<!-- SECTION operations: from inventory.mjs ops. Group by area; say which screen uses each. -->

<one paragraph: how the app talks to the server, and that a role check still applies to each operation>

### A.1 Data queries (<n>)

| Area | Queries | Screen |
|---|---|---|
| <area> | `<operation>` | <screen> |

### A.2 Actions (<n>)

| Area | Actions | Screen |
|---|---|---|
| <area> | `<operation>` | <screen> |

### A.3 Live subscriptions (<n>)

`<operation>`: <what it drives>.

---

## Appendix B — UI label inventory

<!-- SECTION labels: written by appendix.mjs; this section only links to it. -->

The UI labels found in the app (<n> labels in <n> component groups), grouped by screen, are in
[appendix-ui-labels.md](appendix-ui-labels.md).
