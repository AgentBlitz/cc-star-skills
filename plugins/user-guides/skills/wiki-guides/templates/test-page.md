# User guides: test page

This page holds every construct the guides may use, so one look shows that each one converts. It has **bold**, *italic*, _italic too_, `code`, ***bold and italic***, **bold with `code` inside**, and an escaped \*star\*. Links: [a heading on this page](#tables), [the second of two headings with one name](#a-repeated-heading-1), [an external page](https://example.com/help), [another guide](../more/another-guide.md#first-steps), [the guides' index](README.md) and [a file in the repository](../../CHANGELOG.md), which shows as its text only. An address on its own links too: https://example.com/start.

Characters that need escaping: 5 < 6 & 7 > 4, "quotes", 'apostrophes', and an em dash — and é.

## Lists

- A bullet.
- A bullet with a nested list:
  - nested one;
  - nested two, with **bold**.
- A last bullet.

1. A numbered step.

   A second paragraph inside the step.

2. A step with a picture:

   ![Test page: the sample picture inside a step](test-page.png)

3. A step with a nested bullet list:

   - one;
   - two.

4. A step with code:

   ```
   inside a step
   ```

## Pictures

![Test page: the sample picture on its own line](test-page.png)

---

## Tables

| Left | Centre | Right |
|:---|:---:|---:|
| **Save** | `code` | [external](https://example.com/) |
| a \| pipe | `a|b` in code | 3 |
| *italic* | é & < > | |

## Code

```js
const ok = 1 < 2 && "]]>" !== '<b>';
```

```
Plain text, no language.
```

## Quotes and alerts

> A quote with **bold**
> over two lines.
>
> And a second paragraph.

> [!NOTE]
> A note.

> [!TIP]
> A tip, with [a link](#lists).

> [!IMPORTANT]
> Something important.

> [!WARNING]
> A warning.

> [!CAUTION]
> A caution, with a list:
>
> - one;
> - two.

## A repeated heading

The first of two headings with one name.

## A repeated heading

The second. Links back to [the first](#a-repeated-heading) and [the second](#a-repeated-heading-1).

### A third level, with `code` and **bold**

#### A fourth level

##### A fifth level

###### A sixth level

The end of the test page.
