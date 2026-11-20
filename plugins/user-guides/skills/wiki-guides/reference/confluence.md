# Converting to Confluence storage format

The guides are converted to Confluence **storage format** (XHTML with `ac:` and `ri:` elements)
before anything is published. `$W` below is this skill's `scripts/` folder. Run everything from
the project root. Converting writes only into `.user-guides/out/`; it never touches the wiki.

| File | What it is |
|---|---|
| `.user-guides/out/confluence/top.xhtml` | the top page: the page the user named to publish under |
| `.user-guides/out/confluence/<guide id>.xhtml` | one page per guide |
| `.user-guides/out/confluence/pages.json` | the page tree, each page's images, and every image to attach, with its size and `sha256:` |
| `.user-guides/out/confluence/batches.json` | the images in upload batches under 9 MB (`bundle.mjs`) |

## 1. Convert

```bash
node $W/to-confluence.mjs --release 2.4.0 --set docs/user-guides/guides.json
```

- `--release` is the release named in every page's banner; without it, `publish.release` is used,
  and with neither the conversion stops.
- `--top-title` is the top page's **title as it is on the wiki**. Guide pages link to it and
  their images are attached to it by title, so pass the real one. Without it, the README
  index's title is used.
- `--guides id,id` converts only those guides (links to the others become their text).
- Exit 0: it converted. Exit 1: it lists each problem as `file:line: rule: message` and writes
  nothing.

### What stops a conversion

| Rule | Means | What to do |
|---|---|---|
| `subset` | a construct outside the Markdown subset (below) | fix the guide (`write-guides`' `check-guides` reports the same line). Only with the user's go-ahead, `--escape-unsupported` shows it as escaped text instead |
| `placeholder` | a placeholder card (an `.svg` shot) is still in place | take the shot and swap it in (`screenshots.md`). Only if the user chooses to publish the cards as they are, pass `--allow-placeholders` |
| `image` | an image file is missing, comes from outside the repo, or shares its file name with another | fix the path; rename one of two same-named images (every image is attached to the top page) |
| `release` | no release | pass `--release` |

Notes (not problems) are printed too: a guide that is only `written`, not `checked` (name these
in the report), a code language Confluence does not know (shown as plain text), an image whose
size could not be read.

## 2. The Markdown subset

`md.mjs` reads exactly this, and the same file in `write-guides` holds every guide to it:

| Markdown | Storage format |
|---|---|
| `# Title` | not in the body: the page title is the guide's `title` in `guides.json` |
| `##` … `######` | `<h1>` … `<h5>` (one level up), each opening with an `anchor` macro named by GitHub's slug, `-1`, `-2` for repeats, so `#links` keep working |
| paragraphs, `**bold**`, `*italic*`, `` `code` `` | `<p>`, `<strong>`, `<em>`, `<code>` |
| `[text](#heading)` | `<ac:link ac:anchor>` |
| `[text](other-guide.md#heading)`, in any folder | `<ac:link>` to that guide's page by title, with the anchor |
| `[text](README.md)` (the index) | a link to the top page |
| `[text](https://…)`, `<https://…>`, a bare `https://…` | `<a href>` |
| `[text](some/file.ts)`, a repo file that is not a guide | the text only |
| lists, nested, with paragraphs inside items; `---` | `<ul>`/`<ol>`, `<li>`; `<hr />` |
| an image alone on its line | `<ac:image ac:width>` + `<ri:attachment>` on the top page |
| GFM tables, with alignment | `<table><tbody>`, `<th>`/`<td>` with `text-align` |
| fenced code | the `code` macro, its language mapped to one Confluence knows |
| `>` quote | `<blockquote>` |
| `> [!NOTE]`, `[!TIP]` / `[!IMPORTANT]`, `[!WARNING]` / `[!CAUTION]` | the `info` / `note` / `warning` macro, titled Note, Tip, Important, Warning or Caution |

Anything else is a `subset` problem with its line: raw HTML and comments, reference-style links
and footnotes, indented code, `===`/`---` underlined headings, images inside text, strikethrough,
task-list boxes, headings inside lists or quotes, a second `#` title, hard line breaks.

`templates/test-page.md` (and its `test-page.png`) holds every construct above. It is the page
published first to a real wiki, and the plugin's tests convert it against a golden.

## 3. What each page holds

- **The banner** (an `info` macro) opens every page: it names the source file and the release,
  and says that an edit made on the wiki is overwritten by the next publish.
- **Guide pages** follow it with the guide's text, title left out. A guide's `parent` in
  `guides.json` is its parent page; an empty `parent` puts it straight under the top page.
- **The top page** (the page the user named) holds, after the banner:
  1. the intro: the guide named in `publish.confluence.topGuide` up to its first heading, or
     else the README index's opening paragraphs (the rest of the README is not published, and
     the status block never is);
  2. the list of guides, nested by parent, each a link to its page followed by its description
     from the README's own list when it has one;
  3. an **On this page** panel (a `toc`), when the top page has headings of its own;
  4. the rest of the `topGuide`, when there is one.
- **Images** are attached once, to the top page, and shown at width `min(cap, px / scale)`:
  `publish.confluence.imageCap` (default 640) and `deviceScale` (default 2, as the shots are
  taken). A placeholder card, if the user chose to publish it, is shown at its own width.

## 4. Upload batches

```bash
node $W/bundle.mjs            # reads .user-guides/out/confluence/pages.json
```

It splits the images listed in `pages.json` into batches under 9 MB (raw size, in order), and
writes `batches.json`. It stops when a file is over the limit, missing, or changed since the
conversion (convert again). The publisher (`chrome-publishing.md`) uploads one batch at a time,
and skips an image whose `sha256:` the wiki already holds.
