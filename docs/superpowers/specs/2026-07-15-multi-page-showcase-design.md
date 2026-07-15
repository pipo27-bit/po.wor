# po.wor: multi-page showcase design

## Context

po.wor currently exists as a single-page daily log/feed (`index.html` +
`log.json`, rendered by `script.js`), with an in-browser "edit mode" that
lets you add/edit/delete entries (saved to `localStorage`) and export an
updated `log.json` to commit.

The brand is expanding: po.wor is "a power to be yourself" — the whole
brand theme is silver, chosen because it reads as power. The site needs
to showcase work across three new areas — merch design (branded
"Pouvoir"), album showcase, and cinematic showcase (photos + short
video) — in the style of pglang: minimal, work-first, no decoration for
its own sake. The site is not yet a git repo and has no GitHub Pages
deployment.

## Goals

- Add three new pages (Pouvoir, Album, Cinematic) alongside the existing
  Log home page, without duplicating the feed/edit engine four times.
- Rename "edit mode" to "developer mode" (scissor icon, not pencil) and
  extend it to work identically on all four pages.
- Add an explicit Save step to developer mode so edits are confirmed
  before export, not just silently trusted to persist.
- Give Pouvoir a distinct dark titanium-silver look (darker, more classic
  metallic than the rest of the site) while everything else keeps the
  current light titanium-silver theme.
- Keep the site static (no build step, no framework, no dependencies) and
  ready to deploy on GitHub Pages, where every push to `main` updates the
  live site automatically.

## Non-goals

- No visual changes to Log, Album, or Cinematic — the existing light
  "titanium silver" Apple-like design system carries over unchanged on
  those three pages. Only Pouvoir gets a distinct treatment.
- No per-page bespoke layouts — Pouvoir, Album, and Cinematic use the same
  card/feed layout as Log, just populated from different JSON files (and,
  for Pouvoir only, different colors).
- No new data fields — the existing schema (`date`, `tag`, `text`,
  `detail`, `link`, `image`, `video`, `audio`) already covers all three
  new content types.
- No backend, database, or CMS — content is still hand-edited JSON,
  optionally drafted through developer mode.

## Architecture

```
po.wor/
  index.html      Log (home) — unchanged behavior
  pouvoir.html      Pouvoir (merch design) — dark titanium-silver theme
  album.html          Album Showcase
  cinematic.html        Cinematic Showcase
  style.css      shared stylesheet (existing palette/type, extended with
                 nav links + a scoped dark-theme variant for Pouvoir)
  script.js      generalized feed engine — one shared module, initialized
                 per page with its own data source and storage key
  log.json / pouvoir.json / albums.json / cinematic.json
  assets/
```

`script.js` is refactored from a hardcoded `log.json` reader into a
reusable `initFeed({ source, storageKey, title })` function. Each HTML
page calls it with its own JSON file and a distinct `localStorage` key
(e.g. `po_wor_pouvoir`), so drafts on one page never collide with another.
This keeps one engine and one bug-fix surface instead of four
near-duplicate scripts.

## Pages & content model

All four pages render the same card-feed layout (date-first rows,
click-to-expand). They differ only in which schema fields are populated:

| Page | date | tag | text | detail | link | image | video | audio |
|---|---|---|---|---|---|---|---|---|
| Log (home) | ✓ | ✓ | ✓ | opt | opt | opt | opt | opt |
| Pouvoir | ✓ | ✓ | item name | description | buy/store link | product shot | — | — |
| Album | ✓ | ✓ | track/album | description | streaming link | cover art | — | player |
| Cinematic | ✓ | ✓ | title | description | — | photo | short clip | — |

No schema changes — this is purely a convention for how existing fields
are used on each page.

## Navigation

Every page shares the same top bar: the `po.wor` brand mark plus text
links — `Log · Pouvoir · Album · Cinematic` — to the four pages. No
submenu, no dropdown, matches the current minimal single-line header.

## Pouvoir visual treatment

Pouvoir carries the brand's "silver shows power" idea furthest: a classic
dark titanium-silver look, distinct from the light titanium theme used
everywhere else. Implemented as a second set of CSS custom properties in
the same shared `style.css`, scoped under a `.theme-pouvoir` class on
`<body>` — not a separate stylesheet, so there's still one CSS file and
no build step.

```
--bg:      #1C1D1F   dark graphite base
--surface: #2A2B2E   lifted panels (images, edit panel) — dark titanium
--text:    #E8E9EA   bright platinum-silver text
--dim:     #9A9CA1   muted silver-grey, meta / dates
--rule:    #3A3B3E   hairline dividers / spine
--accent:  #C7CBD1   bright chrome-silver — links, active state
```

Layout, type, and interaction (card structure, click-to-expand, developer
mode) are identical to the other three pages — only the color tokens
change.

## Developer mode

Renamed from "edit mode": same bottom-right corner icon, now a scissor
instead of a pencil, tooltip/label reads "developer mode." Behavior is
identical to today's edit mode, on every page, scoped to that page's data:

1. Toggle developer mode on — add-entry panel appears, existing entries
   get inline edit/delete controls.
2. **Save** (new): commits the current in-progress add/edit/delete state
   to `localStorage` and shows a brief visible confirmation (e.g. a
   "saved" flash near the button). This is a deliberate checkpoint —
   nothing is silently assumed to have persisted.
3. **Export `<page>.json`**: downloads the full merged file (original
   data + saved edits) — unchanged from the current export behavior,
   just generalized to name the file after whichever page you're on.
4. **Clear local edits**: wipes in-browser drafts for that page only,
   same as today.

Nothing is sent anywhere until you export and commit — this stays a
local-only draft mechanism, same privacy model as before.

## Deployment

The site remains fully static, so GitHub Pages serves the repo directly
with no build step. Once the one-time setup below is done, every `git
push` to `main` updates the live site automatically (typically within a
minute or two):

```
cd ~/Desktop/po.wor
git init
git add .
git commit -m "po.wor"
git branch -M main
git remote add origin https://github.com/<you>/po.wor.git
git push -u origin main
```

Then enable Pages in the repo's Settings → Pages → source: `main` branch.
Day-to-day workflow after that is: edit files (or use developer mode →
Save → Export), commit, push.

## Testing

- Manual verification per page: entries render, click-to-expand works,
  image/video/audio fields display correctly where used.
- Developer mode verification per page: add/edit/delete an entry, Save
  shows confirmation, Export downloads a file with the change present,
  Clear local edits removes drafts without touching the file on disk.
- Nav verification: all four top-bar links resolve to the correct page
  from every page.
