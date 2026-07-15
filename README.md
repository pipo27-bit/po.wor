# po.wor

Four pages, one engine: date, one line, click to see the work. No framework,
no build step.

- **Log** (`index.html`) — the daily log.
- **Pouvoir** (`pouvoir.html`) — merch design, dark titanium-silver theme.
- **Album** (`album.html`) — music/album showcase.
- **Cinematic** (`cinematic.html`) — photo/video showcase.

Every page shares the same `style.css` and `script.js`. Each `<body>` tag
declares which JSON file to read and which localStorage namespace to use
via `data-feed` and `data-storage` attributes, e.g.:

```html
<body data-feed="pouvoir.json" data-storage="pouvoir">
```

`script.js` reads those attributes at load time — nothing else needs to
change per page. A shared top nav (`.nav`, with `aria-current="page"` on
the active link) lets you move between all four.

## Structure

```
po.wor/
  index.html      Log page
  pouvoir.html    Pouvoir page (dark theme)
  album.html      Album page
  cinematic.html  Cinematic page
  style.css       all styling — shared "log spine" look, developer mode,
                  and the Pouvoir dark-theme overrides
  script.js       shared engine: renders the feed named by data-feed,
                  handles expand/collapse and developer mode
  log.json, pouvoir.json, albums.json, cinematic.json
                  your data — one JSON file per page, matching each
                  page's data-feed attribute
  scripts/
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

In the developer-mode panel, the date field is a small custom calendar
picker: click it, click the day you want, done — no typing dates by hand.

## Developer mode

Bottom-right corner: a small scissors icon, not a nav link. Click it to
turn on developer mode (each page remembers its own on/off state).

In developer mode:
- Every entry gets a small edit / delete icon.
- An "add entry" panel appears above the feed for new entries.
- Editing and deleting only change what's stored **in this browser**
  (`localStorage`, namespaced per page via `data-storage`) — the JSON
  file on disk is never touched automatically.
- Click **save** to confirm your in-browser drafts are written to
  localStorage; the button flashes "saved ✓" briefly.
- When you're happy with your changes, click **export json** in the
  panel. It downloads the merged, up-to-date file (named after that
  page's `data-feed`, e.g. `pouvoir.json`). Replace the matching file
  in this folder with the download and commit it.
- **clear local edits** wipes your in-browser drafts (does not affect the
  file on disk).

This means you can draft and rearrange entries live in the browser —
on your phone, at your desk, wherever — and only "publish" by exporting
and pushing when you're ready. Nothing you type is sent anywhere; it's
all local to your browser until you export.

## Add an entry (from Obsidian, instead of the browser)

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
- No build step, no dependencies.
- Respects `prefers-reduced-motion` and is keyboard-navigable.
