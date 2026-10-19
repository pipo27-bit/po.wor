# po.wor

Four pages, one engine: date, one line, click to see the work. No framework,
no build step.

- **Log** (`index.html`) — the daily log.
- **Pouvoir** (`pouvoir.html`) — merch design, dark titanium-silver theme.
- **Album** (`album.html`) — music/album showcase.
- **Cinematic** (`cinematic.html`) — photo/video showcase.

Every page shares the same `style.css` and `script.js`. Each `<body>` tag
declares which JSON file to read via a `data-feed` attribute, e.g.:

```html
<body data-feed="pouvoir.json">
```

`script.js` reads that attribute at load time — nothing else needs to
change per page. A shared top nav (`.nav`, with `aria-current="page"` on
the active link) lets you move between all four.

The site is **read-only**: it only displays what is in the JSON files.
You change content by editing those files, then committing and pushing.

## Structure

```
po.wor/
  index.html      Log page
  pouvoir.html    Pouvoir page (dark theme)
  album.html      Album page
  cinematic.html  Cinematic page
  style.css       all styling — shared "log spine" look and the Pouvoir
                  dark-theme overrides
  script.js       shared engine: fetches the feed named by data-feed,
                  sorts it newest first, renders it, handles expand/collapse
  log.json, pouvoir.json, albums.json, cinematic.json
                  your data — one JSON file per page, matching each
                  page's data-feed attribute
  scripts/
    add_entry.py  add one entry to log.json from the terminal
    build_log.py  optional: generate log.json from an Obsidian folder
  assets/         put images/video referenced from the JSON files here
```

## How entries work

Each entry is a date and one line. If it has a `detail`, `link`, `image`,
`video`, or `audio`, it's clickable — click the row and it expands in
place to show the work. Entries with none of those fields are just a
line, not clickable.

```json
{
  "date": "2026-07-16",
  "tag": "music",
  "text": "New demo: untitled sketch.",
  "detail": "Longer description shown when you click the entry.",
  "audio": "assets/demo.mp3"
}
```

Required: `date` (`YYYY-MM-DD`, ISO format) and `text`. Everything else
is optional. Newest date renders first automatically. On the page, dates
display as `WED-16-07-2026` — the weekday is calculated automatically
from the ISO date, you never type it.

Drop your music demo files (`.mp3`, `.wav`, etc.) into `assets/` and
reference them with the `audio` field — the entry expands into an
inline player.

## Add an entry

From the project folder:

```
python3 scripts/add_entry.py
```

It asks for the date (Enter = today), a one-line summary, and optional tag,
detail, link and image. It saves the entry into `log.json` (newest first)
and prints your current streak. The site shows one entry per date, so if
that date already has an entry the script asks before replacing it.

You can also edit `log.json` (or the other JSON files) by hand.

## Publish

Edit locally, preview, then push — GitHub Pages republishes by itself.

1. Pull the latest: `git pull` (or **Sync Changes** in VS Code).
2. Preview: `python3 -m http.server 8000`, open `http://localhost:8000`.
3. Make your change (an entry, some CSS, a new feature) and check it works.
4. Commit and push (Source Control panel: **Commit**, then **Sync Changes**).
5. Wait a minute or two, then hard refresh the live site (Cmd+Shift+R).

## Add entries from Obsidian (alternative)

If you'd rather your daily Obsidian log be the source of truth directly:
keep one markdown file per day in a folder (e.g. `Log/2026-07-16.md`) with
frontmatter:

```
---
date: 2026-07-16
tag: build
---
Fixed the parallax bug.
```

Then run:

```
python3 scripts/build_log.py /path/to/vault/Log
```

This regenerates `log.json` directly, merging with what's already there.

## Run locally

```
python3 -m http.server 8000
```

then open `http://localhost:8000`.

## Deploy (GitHub Pages)

```
git init
git add .
git commit -m "po.wor"
git branch -M main
git remote add origin https://github.com/<you>/po.wor.git
git push -u origin main
```

Enable GitHub Pages from the `main` branch in repo settings. For a custom
domain, add a `CNAME` file at the project root with the domain name.

## Design notes

- Colors, fonts, and spacing are CSS custom properties at the top of
  `style.css` — change the palette in one place.
- No build step, no dependencies, nothing stored in the browser.
- Respects `prefers-reduced-motion` and is keyboard-navigable.
