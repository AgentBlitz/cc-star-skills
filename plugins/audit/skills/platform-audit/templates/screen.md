### <N.N> <Menu group> › <Screen>

<!-- SECTION screen: one block per screen. Keep the header table's four rows; check-audit needs Route and State observed, and at least one evidence tag. Leave out a part the screen doesn't have. -->

| | |
|---|---|
| Route | `<route>`. <where it lands from, and what the URL holds> |
| Menu | <Menu group> › <Screen> |
| Who sees it | <roles> |
| State observed | <with data · empty · blocked, and what that meant for this account> |

**Purpose.** <what the screen is for, in one or two sentences>. **[UI]**

**Layout.** <tabs, panels and the order things sit in>. **[UI]**

**Header actions** **[UI]**

| Button | State seen | What it does |
|---|---|---|
| **<Button>** | <enabled · disabled, and why> | <what it opens or does; opened, not submitted> |

**Filters** **[UI]**

| Filter | Type | Options seen |
|---|---|---|
| **<Filter>** | <select · multi-select · search · date range · value range> | <options, defaults> |

**Toolbar.** <export, column chooser, density, refresh, and their limits>. **[UI + Code]**

**Table columns** **[UI]**

| Column | Can hide? | Notes |
|---|---|---|
| <Column> | <Yes · No> | <sortable, format, what it sums> |

**Pagination:** <page sizes, default, how the total is shown>. **[UI]**

**Forms and dialogs** (opened, not submitted) **[UI]**

- **<Dialog>:** <fields, with type and rule> · <buttons>

**Code-only notes**
- <what the code holds for this screen that the screen didn't show>. **[Code]**
