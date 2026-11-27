# Partner Portal — Platform Audit

> **How to read this document.** Each item carries a tag for where its evidence comes from.
> - **[UI]**: seen on screen, signed in as a partner.
> - **[Code]**: found in the app's code only, because the screen was empty or belongs to another role.
> - **[UI + Code]**: both.
>
> Labels from shared components the product may not use are marked *(shared library)*.

---

## 1. Executive summary

**What it is.** The Partner Portal is the web app a reseller partner uses to follow the orders and customers
they bring in, and to ask for their commission to be paid out. Sign-in is a single demo button on this test
build, data comes from one GraphQL endpoint, and the interface is in English or German.

**What a partner can use** (all seen on screen) **[UI]**
- **6 screens:** Orders, Customers, Payouts, Sales weekly, Sales daily and Profile.
- **2 detail pages:** Order details and Customer details.
- **Account tools:** language, a personal referral link with **Copy**, and **Log out**.

**Strengths**
- **Working order list.** Five filters, a column chooser, sorting from the column header and a CSV export (§5.2).
- **Customer tools.** Vouchers to selected customers, and a three-step customer import with a template (§5.4).
- **Balances in view.** The available and pending balance sit in the header of every screen (§4).

**Limitations and gaps to raise with the provider**
- **No payout history to review.** The Payouts list was empty for this account, so its statuses could not be
  seen (§5.6).
- **Finance report held back.** The finance report exists, but only managers and admins can open it (§6.1).
- **Voucher reach.** A voucher goes to at most **50** customers at a time (§8).

**Limits of this audit**
- No form or dialog was submitted: no payout requested, voucher sent, import run or profile saved.
- The four hidden screens (§6) were read from code only; none was opened by URL.
- Payouts held no data, so the request dialog's checks were read from code.

**Suggested next steps**
- Ask the provider for a payout history on a test account, to check the statuses in §9.
- Ask whether partners can be given the finance report, or an export of it.

---

## 2. Platform architecture and access model

### 2.1 Technology (as seen from the browser)

| Area | Finding |
|---|---|
| Front end | A single-page app in three script chunks: the main app, an admin chunk loaded on demand, and a German locale **[Code]** |
| Labels | formatjs message ids, with a compiled German locale **[Code]** |
| Data | One GraphQL endpoint for queries and actions, plus a live subscription for order updates **[Code]** |
| Files | CSV export and template downloads as plain links, and an upload endpoint for imports **[Code]** |
| Session | Times out after **30 minutes** **[Code]** |

### 2.2 Business scope seen in the data model [Code]

- Orders: number, date, customer, status, items, amount, line items and a timeline.
- Customers: name, email, tier and order history.
- Payouts: amount, method and status, with a note on the request.
- Users and an audit log, for admins only.

### 2.3 Roles and permissions

| Role | Can open | Source |
|---|---|---|
| Partner | Orders, Customers, Payouts, Sales reports, Profile | **[UI + Code]** |
| Manager | All of the above, plus the finance report | **[Code]** |
| Admin | Everything, including Users, Audit log and Admin settings | **[Code]** |

A fourth role, Support, appears in the admin role list but in no access rule (§9).

### 2.4 How data is scoped for a partner

- Orders, Customers and the sales reports show only this partner's own business. **[UI]**
- The balances in the header are this partner's. **[UI]**

---

## 3. Navigation map

### 3.1 Menu as a partner sees it [UI]

```
Partner Portal                       [Available balance] [Pending balance]  [Help ↗]  [Account ▾]
├── Sales
│   ├── Orders                       (/orders)    ──► Order details    (/orders/:orderId)
│   └── Customers                    (/customers) ──► Customer details (/customers/:customerId)
├── Finance
│   └── Payouts                      (/payouts)
├── Reports
│   ├── Sales weekly                 (/reports/sales-weekly)
│   └── Sales daily                  (/reports/sales-daily)
└── Settings
    └── Profile                      (/settings/profile)
```

### 3.2 Menu items for other roles [Code]

```
Reports
└── Finance                          (managers and admins)
Admin                                (admins)
├── Users
├── Audit log
└── Settings
```

### 3.3 Every route in the app (13)

Status key: ✅ seen on screen · 📄 opened, but empty for this account · 🔗 detail page, no data to open ·
⛔ tried and blocked · 🔒 not shown to this role (from code)

| # | Route | Screen | Status |
|---|---|---|---|
| 1 | `/login` | Sign in | ✅ |
| 2 | `/orders` | Orders | ✅ |
| 3 | `/orders/:orderId` | Order details | ✅ |
| 4 | `/customers` | Customers | ✅ |
| 5 | `/customers/:customerId` | Customer details | ✅ |
| 6 | `/payouts` | Payouts | 📄 |
| 7 | `/reports/sales-weekly` | Sales weekly | ✅ |
| 8 | `/reports/sales-daily` | Sales daily | ✅ |
| 9 | `/settings/profile` | Profile | ✅ |
| 10 | `/reports/finance` | Finance report | 🔒 |
| 11 | `/admin/users` | Users | 🔒 |
| 12 | `/admin/audit-log` | Audit log | 🔒 |
| 13 | `/admin/settings` | Admin settings | 🔒 |

The hidden routes were not tried by URL, as asked.

---

## 4. Global interface (on every screen)

| Element | What's there | Source |
|---|---|---|
| Header | The product name, the **Available balance** and **Pending balance** chips | **[UI]** |
| Help | An external link to the partner help pages on help.example.com | **[UI]** |
| Account menu | **Language** (English · Deutsch), **Referral link** with **Copy**, **Log out** | **[UI]** |
| Main menu | The tree in §3.1 | **[UI]** |
| Errors | "Too many requests" asks the user to wait **30 seconds** | **[Code]** |

---

## 5. Screen-by-screen map

### 5.1 Sign in

| | |
|---|---|
| Route | `/login`. Any route opens here before sign-in. |
| Menu | None |
| Who sees it | Everyone, before sign-in |
| State observed | With data: the sign-in button only. |

**Purpose.** Starts a session. On this test build a single button, **Sign in as demo partner**, signs in
without a password. **[UI]**

### 5.2 Sales › Orders

| | |
|---|---|
| Route | `/orders`. The URL holds no filters. |
| Menu | Sales › Orders |
| Who sees it | Partners, managers and admins |
| State observed | With data: one page of orders. |

**Purpose.** Every order this partner brought in, with its status and amount. **[UI]**

**Layout.** A filter bar above a table, with the toolbar on the right and the pager below. **[UI]**

**Filters** **[UI]**

| Filter | Type | Options seen |
|---|---|---|
| **Status** | Multi-select list | Pending · Paid · Shipped · Refunded · Cancelled; "All" by default |
| **Date range** | Pop-over with presets | Today · Last 7 days · Last 30 days · This month, or From / To |
| **Search** | Free text | Order number or customer |
| **Amount from** / **Amount to** | Numbers | Empty by default |

**Clear filters** resets them all.

**Toolbar.** **Columns** opens the column chooser. **Export CSV** downloads the filtered list, up to
**10,000** rows. **[UI + Code]**

**Table columns** **[UI]**

| Column | Can hide? | Notes |
|---|---|---|
| Order | No | Opens Order details |
| Date | Yes | |
| Customer | Yes | |
| Status | Yes | |
| Items | Yes | |
| Amount | Yes | |

Each column header opens a menu: **Sort ascending**, **Sort descending** and **Hide column**. **[UI]**

**Pagination:** **Rows per page** 10 / 25 / 50, with **Previous page** and **Next page**. **[UI]**

**Code-only notes**
- A live subscription refreshes an order when its status changes. **[Code]**

### 5.3 Sales › Orders › Order details

| | |
|---|---|
| Route | `/orders/:orderId`, opened from an order number. |
| Menu | None (from Orders) |
| Who sees it | Partners, managers and admins |
| State observed | With data: one order. |

**Purpose.** One order in full. TODO: check the timeline. **[UI]**

**Layout.** Three panels: **Summary**, **Line items** and **Timeline**, with **Back to orders** at the top. **[UI]**

**Table columns** (Line items) **[UI]**

| Column | Can hide? | Notes |
|---|---|---|
| Product | No | |
| Quantity | No | |
| Unit price | No | |
| Total | No | |

### 5.4 Sales › Customers

| | |
|---|---|
| Route | `/customers` |
| Menu | Sales › Customers |
| Who sees it | Partners, managers and admins |
| State observed | With data: one page of customers. |

**Purpose.** The customers this partner brought in, by tier. **[UI]**

**Header actions** **[UI]**

| Button | State seen | What it does |
|---|---|---|
| **Send voucher** | Disabled until a row is selected | Opens the voucher dialog |
| **Import customers** | Enabled | Opens the three-step import |

**Filters** **[UI]**

| Filter | Type | Options seen |
|---|---|---|
| **Search** | Free text | Name or email |
| **Tier** | Select | All tiers · Bronze · Silver · Gold |

**Table columns** **[UI]**

| Column | Can hide? | Notes |
|---|---|---|
| Name | No | Opens Customer details |
| Email | No | |
| Tier | No | |
| Orders | No | A count |
| Last order | No | A date |

**Forms and dialogs** (opened, not submitted) **[UI]**

- **Send voucher:** Voucher value · Message · **Send** · **Cancel**. At most **50** customers. **[UI + Code]**
- **Import customers:** three steps, Upload file › Map columns › Review. **File** takes CSV or XLSX, up to
  **2 MB**; **Download template** gives the expected columns. Buttons: **Next**, **Back**, **Import**,
  **Cancel**. **[UI]**

### 5.5 Sales › Customers › Customer details

| | |
|---|---|
| Route | `/customers/:customerId`, opened from a name. |
| Menu | None (from Customers) |
| Who sees it | Partners, managers and admins |
| State observed | With data: one customer. |

**Purpose.** One customer, with **Contact** and **Recent orders** panels and **Back to customers**. **[UI]**

**Table columns** (Recent orders) **[UI]**

| Column | Can hide? | Notes |
|---|---|---|
| Order | No | |
| Date | No | |
| Status | No | |
| Amount | No | |

### 5.6 Finance › Payouts

| | |
|---|---|
| Route | `/payouts` |
| Menu | Finance › Payouts |
| Who sees it | Partners, managers and admins |
| State observed | Empty: "No payouts yet". |

**Purpose.** The partner's payout requests, and the way to make one. **[UI]**

**Header actions** **[UI]**

| Button | State seen | What it does |
|---|---|---|
| **Request payout** | Enabled | Opens the request dialog |

**Table columns** (headers only, no rows) **[UI]**

| Column | Can hide? | Notes |
|---|---|---|
| Requested | No | A date |
| Amount | No | |
| Method | No | Bank transfer · Wallet · Cheque (§9) |
| Status | No | |

**Forms and dialogs** (opened, not submitted) **[UI]**

- **Request payout:** Amount, between **50** and **5,000** · Method · Note, up to **200** characters ·
  **Submit** · **Cancel**. **[UI + Code]**

### 5.7 Reports › Sales weekly

| | |
|---|---|
| Route | `/reports/sales-weekly` |
| Menu | Reports › Sales weekly |
| Who sees it | Partners, managers and admins |
| State observed | With data: recent weeks. |

**Layout.** Two tabs, **Weekly** and **Daily**, over one table. **[UI]**

**Table columns** **[UI]**

| Column | Can hide? | Notes |
|---|---|---|
| Week | No | |
| Orders | No | |
| Revenue | No | |
| Average order | No | |

### 5.8 Reports › Sales daily

| | |
|---|---|
| Route | `/reports/sales-daily` |
| Menu | Reports › Sales daily |
| Who sees it | Partners, managers and admins |
| State observed | With data: recent days. |

**Layout.** The same tabs as §5.7, with the **Daily** tab open. **[UI]**

**Table columns** **[UI]**

| Column | Can hide? | Notes |
|---|---|---|
| Day | No | |
| Orders | No | |
| Revenue | No | |
| Average order | No | |

### 5.9 Settings › Profile

| | |
|---|---|
| Route | `/settings/profile` |
| Menu | Settings › Profile |
| Who sees it | Partners, managers and admins |
| State observed | With data: the partner's own details. |

**Forms and dialogs** (opened, not submitted) **[UI]**

- **Profile:** Display name · Email · Phone · Company · a box for "Email me about new orders" · **Save**.

---

## 6. Screens not available to a partner

Everything in this section comes from the app's code **[Code]**.

### 6.1 Reports › Finance (`/reports/finance`) 🔒

- **Who:** managers and admins.
- **Purpose:** the finance view of sales and payouts.

### 6.2 Admin › Users (`/admin/users`) 🔒

- **Who:** admins.
- **What it holds:** the user list, and a **Change role** action.

### 6.3 Admin › Audit log (`/admin/audit-log`) 🔒

- **Who:** admins.
- **What it holds:** a log kept for **365 days**.

### 6.4 Admin › Settings (`/admin/settings`) 🔒

- **Who:** admins.
- **What it holds:** the portal's admin settings, saved with an update action.

---

## 7. Capability matrix

Key: ✅ available to this role · 🔒 exists, but only for other roles · 👁 view only · ⚠️ partial or limited ·
❌ not found

### 7.1 Sales

| Capability | Status | Where / notes |
|---|---|---|
| List and filter orders | ✅ | Orders, §5.2 |
| Export orders | ✅ | Export CSV, §5.2 |
| Send vouchers to customers | ⚠️ | At most 50 at a time, §5.4 |
| Import customers | ✅ | §5.4 |

### 7.2 Money

| Capability | Status | Where / notes |
|---|---|---|
| Request a payout | ✅ | §5.6 |
| See payout history | 👁 | Empty for this account, §5.6 |
| Finance report | 🔒 | Managers and admins, §6.1 |

### 7.3 Administration

| Capability | Status | Where / notes |
|---|---|---|
| Manage users and roles | 🔒 | Admins, §6.2 |
| Read the audit log | 🔒 | Admins, §6.3 |
| Two-factor sign-in | ❌ | No screen or operation for it |

---

## 8. Limits, rules and constraints found

| Limit | Value | Where |
|---|---|---|
| CSV export | **10,000** rows | Orders **[Code]** |
| Payout amount | **50** to **5,000** | Request payout **[UI + Code]** |
| Payout note | **200** characters | Request payout **[Code]** |
| Voucher recipients | **50** customers | Send voucher **[Code]** |
| Import file | CSV or XLSX, **2 MB** | Import customers **[UI + Code]** |
| Session | **30 minutes** | App-wide **[Code]** |
| Admin page size | **100** rows | Admin screens **[Code]** |

---

## 9. Reference lists

**Order statuses (5)** **[UI + Code]**. The Orders Status filter.
Pending · Paid · Shipped · Refunded · Cancelled

**Customer tiers (3)** **[UI + Code]**. The Customers Tier filter.
Bronze · Silver · Gold

**Payout methods (3)** **[Code]**. The Request payout dialog.
Bank transfer · Wallet · Cheque

**Roles (4)** **[Code]**. Partner · Manager · Admin · Support

---

## Appendix A — Server operations available to the web app

The app sends its queries and actions to one GraphQL endpoint, and downloads files from plain links. Each
operation still checks the caller's role on the server (§2.3).

### A.1 Data queries (12)

| Area | Queries | Screen |
|---|---|---|
| Shell | `Shell` | Every screen |
| Orders | `Orders`, `OrderDetails` | §5.2, §5.3 |
| Customers | `Customers`, `CustomerDetails` | §5.4, §5.5 |
| Payouts | `Payouts` | §5.6 |
| Reports | `SalesReport`, `FinanceReport` | §5.7, §6.1 |
| Profile | `Profile` | §5.9 |
| Admin | `AdminUsers`, `AuditLog`, `AdminSettings` | §6.2 to §6.4 |

### A.2 Actions (6)

| Area | Actions | Screen |
|---|---|---|
| Payouts | `RequestPayout` | §5.6 |
| Customers | `SendVoucher`, `ImportCustomers` | §5.4 |
| Profile | `UpdateProfile` | §5.9 |
| Admin | `UpdateUserRole`, `UpdateAdminSettings` | §6.2, §6.4 |

### A.3 Live subscriptions (1)

`OrderUpdates`: refreshes an order's status on Orders.

Plain links: `GET /api/export/orders.csv`, `GET /api/export/customers-template.csv`; uploads go to
`POST /api/upload`.

---

## Appendix B — UI label inventory

The UI labels found in the app (154 labels in 15 component groups), grouped by screen, are in
[appendix-ui-labels.md](appendix-ui-labels.md).
