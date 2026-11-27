# Partner Portal — UI label inventory (Appendix B)

This is the companion to [PARTNER-PORTAL-PLATFORM-AUDIT.md](PARTNER-PORTAL-PLATFORM-AUDIT.md). It lists the **154 UI labels**, in **15 component groups**, found in the Partner Portal web app (build `index-3f9c2a71.js`, read on 2026-11-27), grouped by the screen that uses them. The app fills in placeholders such as `{count}` at run time.

The shared-library group comes with shared components. It shows what the components support, **not** what this product uses.

## Contents

- Navigation, layout and app-wide messages — 4 groups, 33 labels
- Sales › Orders and Order details — 2 groups, 41 labels
- Sales › Customers, vouchers and import — 4 groups, 41 labels
- Finance › Payouts — 1 group, 10 labels
- Reports › Sales weekly, Sales daily and Finance — 1 group, 5 labels
- Settings › Profile — 1 group, 8 labels
- Hidden → Admin (Users, Audit log, Settings) — 1 group, 13 labels
- Shared library (labels bundled with the app; a screen may not use them) — 1 group, 3 labels

## Navigation, layout and app-wide messages

| Component group | Labels |
|---|---|
| `account` | Referral link copied · Copy · English · Deutsch · Language · Log out · Partner ID · Referral link |
| `errors` | You do not have permission to view this page. · Access denied · Something went wrong. Try again. · Too many requests. Try again in 30 seconds. |
| `nav` | Admin · Settings · Audit log · Customers · Finance · Orders · Payouts · Profile · Reports · Sales · Sales daily · Sales weekly · Users |
| `shell` | Account · Available balance · Pending balance · Partner Portal · Help · Main menu |

## Sales › Orders and Order details

| Component group | Labels |
|---|---|
| `orderDetails` | Back to orders · Line items · Order not found · Summary · Timeline · Order {number} |
| `orders` | Column menu · Columns · Amount · Customer · Date · Items · Order · Status · {count, plural, one {# order} other {# orders}} · No orders match these filters · Export CSV · All · Amount from · Amount to · Apply · Clear filters · Date range · From · Search · Order number or customer · {count} selected · To · Hide column · Next page · Last 30 days · Last 7 days · This month · Today · Previous page · {from}–{to} of {total} · Rows per page · Sort ascending · Sort descending · Orders |

## Sales › Customers, vouchers and import

| Component group | Labels |
|---|---|
| `customerDetails` | Back to customers · Contact · Customer not found · Recent orders |
| `customers` | All tiers · Email · Last order · Name · Orders · Tier · Import customers · Search · Select all · {count} selected · Select row · Send voucher · Customers |
| `import` | CSV or XLSX, up to 2 MB · Back · Columns found: {columns} · Import started · Drop a file here, or choose one · File · Next · Ready to import {name}. · {name}: {rows} rows · Import · Step {n} of 3: {name} · Map columns · Review · Upload file · Download template · Import customers · The file is larger than 2 MB. · Choose a CSV or XLSX file. |
| `voucher` | Message · Send · Voucher sent to {count} customers · Choose at most {max} customers. · Voucher value |

## Finance › Payouts

| Component group | Labels |
|---|---|
| `payouts` | Amount · Enter an amount between {min} and {max}. · No payouts yet · Payouts you request appear here. · Method · Note · Request payout · Payout requested · Submit · Payouts |

## Reports › Sales weekly, Sales daily and Finance

| Component group | Labels |
|---|---|
| `reports` | Finance report · Sales daily · Sales weekly · Daily · Weekly |

## Settings › Profile

| Component group | Labels |
|---|---|
| `profile` | Company · Display name · Email · Email me about new orders · Phone · Save · Profile saved · Profile |

## Hidden → Admin (Users, Audit log, Settings)

| Component group | Labels |
|---|---|
| `admin` | Filter by actor · Audit log · Maximum payout · Minimum payout · Payouts enabled · Keep the audit log for (days) · Save settings · Settings saved · Admin settings · Change role · Role · Role updated · Users |

## Shared library (labels bundled with the app; a screen may not use them)

| Component group | Labels |
|---|---|
| `common` | Cancel · Close · Loading… |

