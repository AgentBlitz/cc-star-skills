# Converting to HTML files

When the destination is HTML files, or both, the guides become self-contained pages: each holds
its own styles and its images as data URIs, so a page opens on its own, from a disk, a share or
an attachment. `$W` below is this skill's `scripts/` folder. Run everything from the project root.

```bash
node $W/to-html.mjs --release 2.4.0 --set docs/user-guides/guides.json
```

| File | What it is |
|---|---|
| `<out>/index.html` | the top page: the intro (the `topGuide`, else the README index's opening paragraphs), then the list of guides |
| `<out>/<guide id>.html` | one page per guide, with a link back to the index |

- `<out>` is `--out`, else `publish.html.outDir` in `guides.json`, else `.user-guides/out/html/`.
  Record the folder in `publish.html.outDir` when the user chooses where the files live.
- The options and the problems are `to-confluence.mjs`'s (`confluence.md`, sections 1 and 2):
  the same Markdown subset, the same `placeholder` stop and `--allow-placeholders`, the same
  `--escape-unsupported`, which needs the user's go-ahead.
- Each page opens with the same banner: the source file and the release. On a file the warning
  is the same: an edit to the HTML is lost when it is made again.

## What the pages hold

| Markdown | HTML |
|---|---|
| `# Title` | the page's `<title>` and `<h1>`, from the guide's `title` in `guides.json` |
| `##` … `######` | `<h2>` … `<h6>` (the levels as written), each with `id` set to GitHub's slug, `-1` for repeats |
| a link to another guide, in any folder | `<guide id>.html#anchor`, a sibling file |
| a link to the README index | `index.html` |
| a repo file that is not a guide | the text only |
| an image alone on its line | `<img src="data:…;base64,…">` at width `min(cap, px / scale)`, CSS-capped to the page |
| fenced code | `<pre><code class="language-…">` |
| `> [!NOTE]` and the other alerts | `<div class="alert alert-note">` with its title, styled per kind |

The markup is XHTML-clean (every element closed, every attribute quoted), so an XML parser reads
it too; the plugin's tests check each page that way. The pages load nothing from the network:
no fonts, scripts or images from outside.

Hand the folder over as a whole: links between guides are relative to it.
