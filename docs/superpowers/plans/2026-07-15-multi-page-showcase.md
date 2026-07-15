# po.wor Multi-Page Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn po.wor from a single-page daily log into a four-page site (Log, Pouvoir, Album, Cinematic) sharing one feed/developer-mode engine, with Pouvoir carrying a distinct dark titanium-silver theme.

**Architecture:** `script.js` becomes a data-attribute-driven engine (`data-feed`, `data-storage` on `<body>`) reused unmodified by all four HTML pages. Each page supplies its own JSON data file and a `localStorage` namespace. Pouvoir's dark theme is a CSS custom-property override scoped to `body.theme-pouvoir`, so the shared engine and calendar popover re-theme automatically with no JS changes.

**Tech Stack:** Plain HTML/CSS/JS, no framework, no build step, no dependencies. Static files served as-is (GitHub Pages later).

## Global Constraints

- No build step, no framework, no new dependencies — plain HTML/CSS/JS only.
- No new JSON schema fields — reuse exactly: `date`, `tag`, `text`, `detail`, `link`, `image`, `video`, `audio`.
- New JSON data files start as empty arrays (`[]`) — no invented placeholder content.
- Only Pouvoir gets a distinct visual theme; Log, Album, Cinematic keep the current light titanium-silver look unchanged.
- "Edit mode" is renamed to "developer mode" in all user-facing text and its icon changes from a pencil to scissors — internal CSS class names (`edit-mode`, `edit-toggle`) stay as-is since they're not user-visible.
- Git commits are local only in this plan — nothing is pushed to any remote without separate explicit approval.

---

### Task 0: Initialize git repository

**Files:**
- Create: `/Users/pipopworasaknukul/Desktop/po.wor/.gitignore`

**Interfaces:**
- Produces: a git repo at `/Users/pipopworasaknukul/Desktop/po.wor` with one baseline commit, so every later task can commit incrementally.

- [ ] **Step 1: Create a `.gitignore`**

```
.DS_Store
```

- [ ] **Step 2: Initialize the repo and commit the current baseline**

```bash
cd /Users/pipopworasaknukul/Desktop/po.wor
git init
git add -A
git commit -m "chore: baseline commit before multi-page showcase build"
```

Expected: `git log --oneline` shows one commit; `git status` reports a clean working tree.

- [ ] **Step 3: Verify**

Run: `git -C /Users/pipopworasaknukul/Desktop/po.wor status`
Expected: `nothing to commit, working tree clean`

---

### Task 1: Generalize the shared engine and rebuild the Log page

**Files:**
- Modify: `/Users/pipopworasaknukul/Desktop/po.wor/script.js`
- Modify: `/Users/pipopworasaknukul/Desktop/po.wor/style.css`
- Modify: `/Users/pipopworasaknukul/Desktop/po.wor/index.html`

**Interfaces:**
- Produces: `script.js` reads `document.body.dataset.feed` (JSON filename) and `document.body.dataset.storage` (localStorage namespace) instead of hardcoded constants — every later page (Pouvoir/Album/Cinematic) depends on this and must set both `data-feed` and `data-storage` on `<body>`.
- Produces: CSS class `.nav` and `.theme-pouvoir` custom-property block on `style.css`, used by all four pages' top bar and by Pouvoir's `<body>` respectively.
- Produces: `#f-save` button id, wired to a save-confirmation flash — later pages' markup must include this exact button.

- [ ] **Step 1: Generalize the storage/feed constants in `script.js`**

Replace:
```js
const FEED_URL = 'log.json';
const LS_OVERRIDES = 'po.wor:overrides';
const LS_DELETED = 'po.wor:deleted';
const LS_EDIT_MODE = 'po.wor:editMode';
```

With:
```js
const STORAGE_NS = document.body.dataset.storage || 'log';
const FEED_URL = document.body.dataset.feed || 'log.json';
const LS_OVERRIDES = `po.wor:${STORAGE_NS}:overrides`;
const LS_DELETED = `po.wor:${STORAGE_NS}:deleted`;
const LS_EDIT_MODE = `po.wor:${STORAGE_NS}:editMode`;
```

- [ ] **Step 2: Generalize the export filename**

In `exportLog()`, replace:
```js
  a.download = 'log.json';
```
With:
```js
  a.download = FEED_URL;
```

- [ ] **Step 3: Generalize the clear-edits confirmation message**

In `clearLocalEdits()`, replace:
```js
  if (!confirm('Clear all local edits? This does not affect log.json on disk.')) return;
```
With:
```js
  if (!confirm(`Clear all local edits? This does not affect ${FEED_URL} on disk.`)) return;
```

- [ ] **Step 4: Update the empty-feed message wording (edit → developer)**

In `renderFeed()`, replace:
```js
    el.innerHTML = '<p class="feed-loading">no entries yet. use the edit icon in the corner to add one.</p>';
```
With:
```js
    el.innerHTML = '<p class="feed-loading">no entries yet. use the developer icon in the corner to add one.</p>';
```

- [ ] **Step 5: Add the Save button handler**

In the `// ---------- wire up ----------` section, after the `f-cancel` listener, add:
```js
document.getElementById('f-save').addEventListener('click', () => {
  saveOverrides(loadOverrides());
  saveDeleted(loadDeleted());
  const btn = document.getElementById('f-save');
  const original = btn.textContent;
  btn.textContent = 'saved ✓';
  btn.disabled = true;
  setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 1200);
});
```

So the full wire-up block reads:
```js
document.getElementById('edit-toggle').addEventListener('click', () => {
  setEditMode(!document.body.classList.contains('edit-mode'));
});
document.getElementById('f-add').addEventListener('click', saveEntryFromForm);
document.getElementById('f-cancel').addEventListener('click', cancelEdit);
document.getElementById('f-save').addEventListener('click', () => {
  saveOverrides(loadOverrides());
  saveDeleted(loadDeleted());
  const btn = document.getElementById('f-save');
  const original = btn.textContent;
  btn.textContent = 'saved ✓';
  btn.disabled = true;
  setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 1200);
});
document.getElementById('f-export').addEventListener('click', exportLog);
document.getElementById('f-reset').addEventListener('click', clearLocalEdits);
```

- [ ] **Step 6: Update `style.css` — nav bar layout**

Replace:
```css
.bar {
  max-width: var(--maxw);
  margin: 0 auto;
  padding: 40px 20px 24px;
}

.brand {
  font-family: var(--display);
  font-weight: 700;
  font-size: 17px;
  letter-spacing: 0.01em;
}
```
With:
```css
.bar {
  max-width: var(--maxw);
  margin: 0 auto;
  padding: 40px 20px 24px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.brand {
  font-family: var(--display);
  font-weight: 700;
  font-size: 17px;
  letter-spacing: 0.01em;
}

.nav {
  display: flex;
  gap: 16px;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--dim);
}

.nav a:hover { color: var(--accent); }

.nav a[aria-current="page"] { color: var(--text); }
```

- [ ] **Step 7: Add the Pouvoir dark-theme token block**

Immediately after the closing `}` of the `:root { ... }` block (before the `* { box-sizing: border-box; }` rule), add:
```css
/* ---------- Pouvoir: dark titanium-silver theme ---------- */
body.theme-pouvoir {
  --bg: #1C1D1F;
  --surface: #2A2B2E;
  --text: #E8E9EA;
  --dim: #9A9CA1;
  --rule: #3A3B3E;
  --accent: #C7CBD1;
  color-scheme: dark;
}
```

- [ ] **Step 8: Remove orphaned mobile CSS for the already-deleted dot/spine**

In the `@media (max-width: 520px)` block, replace:
```css
  .entry::before,
  .entry-date::before {
    display: none;
  }

  .entry-date { padding-top: 0; }
```
With:
```css
  .entry-date { padding-top: 0; }
```

- [ ] **Step 9: Add a disabled-button style for the save-confirmation flash**

After the existing rule:
```css
.add-entry-actions button:hover { border-color: var(--accent); color: var(--accent); }
#f-add { border-color: var(--accent); color: var(--accent); }
```
Add:
```css
.add-entry-actions button:disabled { opacity: 0.6; cursor: default; }
```

- [ ] **Step 10: Rewrite `index.html`**

Replace the entire file with:
```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>po.wor</title>
<meta name="description" content="Daily log of work, builds, and things made. po.wor.">
<link rel="icon" href="data:,">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="style.css">
</head>
<body data-feed="log.json" data-storage="log">

<header class="bar">
  <span class="brand">po.wor</span>
  <nav class="nav">
    <a href="index.html" aria-current="page">Log</a>
    <a href="pouvoir.html">Pouvoir</a>
    <a href="album.html">Album</a>
    <a href="cinematic.html">Cinematic</a>
  </nav>
</header>

<main>
  <div id="add-entry-panel" class="add-entry-panel">
    <p class="add-entry-title">developer mode &mdash; entries save to this browser only</p>
    <div class="add-entry-grid">
      <div class="date-field">
        <input id="f-date" type="text" placeholder="yyyy-mm-dd" inputmode="none" autocomplete="off" readonly>
        <div class="date-popover" id="date-popover" hidden>
          <div class="date-popover__header">
            <button type="button" class="date-popover__nav" id="date-prev" aria-label="Previous month">&lsaquo;</button>
            <span class="date-popover__label" id="date-label"></span>
            <button type="button" class="date-popover__nav" id="date-next" aria-label="Next month">&rsaquo;</button>
          </div>
          <div class="date-popover__weekdays">
            <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
          </div>
          <div class="date-popover__grid" id="date-grid"></div>
        </div>
      </div>
      <input id="f-tag" placeholder="tag (optional)">
      <input id="f-text" placeholder="one line">
      <input id="f-link" placeholder="link (optional)">
      <input id="f-image" placeholder="image url (optional)">
      <input id="f-audio" placeholder="audio url (optional, e.g. assets/demo.mp3)">
      <textarea id="f-detail" placeholder="detail shown when clicked (optional)"></textarea>
    </div>
    <div class="add-entry-actions">
      <button id="f-add" type="button">add</button>
      <button id="f-cancel" type="button">cancel</button>
      <button id="f-save" type="button">save</button>
      <span class="add-entry-spacer"></span>
      <button id="f-export" type="button">export json</button>
      <button id="f-reset" type="button">clear local edits</button>
    </div>
  </div>

  <div id="feed" class="feed" aria-live="polite">
    <p class="feed-loading">loading&hellip;</p>
  </div>
</main>

<footer class="foot">
  <span>&copy; <span id="year"></span> po.wor</span>
  <span class="foot-links">
    <!-- swap these for your real links -->
    <a href="https://instagram.com/" target="_blank" rel="noopener">IG</a>
    <a href="https://github.com/" target="_blank" rel="noopener">GH</a>
  </span>
</footer>

<!-- developer-mode toggle: a plain tool icon, not a nav item, tucked in the corner -->
<button id="edit-toggle" aria-label="Toggle developer mode" title="Developer mode">
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="6" cy="7" r="2.4"/>
    <circle cx="6" cy="17" r="2.4"/>
    <path d="M7.8 8.6 19 19M7.8 15.4 19 5"/>
  </svg>
</button>

<script src="script.js"></script>
</body>
</html>
```

- [ ] **Step 11: Manual verification**

Start a local server and open the Browser pane:
```bash
cd /Users/pipopworasaknukul/Desktop/po.wor
python3 -m http.server 4788
```
Navigate to `http://localhost:4788` and check, using the Browser pane tools:
- Feed renders all six existing log entries, no console errors (`read_console_messages`).
- Top bar shows `Log · Pouvoir · Album · Cinematic`; clicking `Pouvoir`/`Album`/`Cinematic` 404s (expected — not built yet); `Log` link is visually distinct (current page).
- Click the bottom-right icon: it's now scissors, tooltip reads "Developer mode".
- Panel text reads "developer mode — entries save to this browser only".
- Click "edit" on an entry, click the date field: themed calendar popover opens, matches the light theme.
- Click "save": button briefly shows "saved ✓" then reverts.
- Click "export json": downloads a file named `log.json`.
- Resize to mobile width (375px): layout collapses to one column, no horizontal scroll, nav doesn't overflow.

- [ ] **Step 12: Commit**

```bash
cd /Users/pipopworasaknukul/Desktop/po.wor
git add script.js style.css index.html
git commit -m "feat: generalize feed engine for multi-page reuse, add nav and developer-mode save button"
```

---

### Task 2: Build the Pouvoir page

**Files:**
- Create: `/Users/pipopworasaknukul/Desktop/po.wor/pouvoir.html`
- Create: `/Users/pipopworasaknukul/Desktop/po.wor/pouvoir.json`

**Interfaces:**
- Consumes: `script.js` and `style.css` from Task 1 unmodified — `data-feed="pouvoir.json"`, `data-storage="pouvoir"`, `class="theme-pouvoir"` on `<body>`.

- [ ] **Step 1: Create `pouvoir.json`**

```json
[]
```

- [ ] **Step 2: Create `pouvoir.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pouvoir — po.wor</title>
<meta name="description" content="Pouvoir — merch design by po.wor.">
<link rel="icon" href="data:,">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="style.css">
</head>
<body class="theme-pouvoir" data-feed="pouvoir.json" data-storage="pouvoir">

<header class="bar">
  <span class="brand">po.wor</span>
  <nav class="nav">
    <a href="index.html">Log</a>
    <a href="pouvoir.html" aria-current="page">Pouvoir</a>
    <a href="album.html">Album</a>
    <a href="cinematic.html">Cinematic</a>
  </nav>
</header>

<main>
  <div id="add-entry-panel" class="add-entry-panel">
    <p class="add-entry-title">developer mode &mdash; entries save to this browser only</p>
    <div class="add-entry-grid">
      <div class="date-field">
        <input id="f-date" type="text" placeholder="yyyy-mm-dd" inputmode="none" autocomplete="off" readonly>
        <div class="date-popover" id="date-popover" hidden>
          <div class="date-popover__header">
            <button type="button" class="date-popover__nav" id="date-prev" aria-label="Previous month">&lsaquo;</button>
            <span class="date-popover__label" id="date-label"></span>
            <button type="button" class="date-popover__nav" id="date-next" aria-label="Next month">&rsaquo;</button>
          </div>
          <div class="date-popover__weekdays">
            <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
          </div>
          <div class="date-popover__grid" id="date-grid"></div>
        </div>
      </div>
      <input id="f-tag" placeholder="tag (optional)">
      <input id="f-text" placeholder="item name">
      <input id="f-link" placeholder="buy/store link (optional)">
      <input id="f-image" placeholder="product image url (optional)">
      <input id="f-audio" placeholder="audio url (optional, e.g. assets/demo.mp3)">
      <textarea id="f-detail" placeholder="description shown when clicked (optional)"></textarea>
    </div>
    <div class="add-entry-actions">
      <button id="f-add" type="button">add</button>
      <button id="f-cancel" type="button">cancel</button>
      <button id="f-save" type="button">save</button>
      <span class="add-entry-spacer"></span>
      <button id="f-export" type="button">export json</button>
      <button id="f-reset" type="button">clear local edits</button>
    </div>
  </div>

  <div id="feed" class="feed" aria-live="polite">
    <p class="feed-loading">loading&hellip;</p>
  </div>
</main>

<footer class="foot">
  <span>&copy; <span id="year"></span> po.wor</span>
  <span class="foot-links">
    <!-- swap these for your real links -->
    <a href="https://instagram.com/" target="_blank" rel="noopener">IG</a>
    <a href="https://github.com/" target="_blank" rel="noopener">GH</a>
  </span>
</footer>

<!-- developer-mode toggle: a plain tool icon, not a nav item, tucked in the corner -->
<button id="edit-toggle" aria-label="Toggle developer mode" title="Developer mode">
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="6" cy="7" r="2.4"/>
    <circle cx="6" cy="17" r="2.4"/>
    <path d="M7.8 8.6 19 19M7.8 15.4 19 5"/>
  </svg>
</button>

<script src="script.js"></script>
</body>
</html>
```

- [ ] **Step 3: Manual verification**

With the server from Task 1 still running (or restarted), navigate to `http://localhost:4788/pouvoir.html`:
- Page loads with the dark titanium-silver theme (dark graphite background, bright silver-white text) — visibly different from the Log page.
- Nav shows `Pouvoir` as the current page; `Log` link navigates back correctly.
- Empty-state message shows ("no entries yet...") since `pouvoir.json` is `[]`.
- Toggle developer mode, click the date field: the calendar popover renders in the dark theme (dark surface, light text, light accent for selected/today) — confirms the popover inherits `--bg`/`--surface`/`--accent` overrides automatically.
- Add a test entry (date + "test item"), click save, click export: downloads `pouvoir.json` containing the entry. Click "clear local edits" afterward to leave the page empty again.
- No console errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/pipopworasaknukul/Desktop/po.wor
git add pouvoir.html pouvoir.json
git commit -m "feat: add Pouvoir page with dark titanium-silver theme"
```

---

### Task 3: Build the Album page

**Files:**
- Create: `/Users/pipopworasaknukul/Desktop/po.wor/album.html`
- Create: `/Users/pipopworasaknukul/Desktop/po.wor/albums.json`

**Interfaces:**
- Consumes: `script.js` and `style.css` from Task 1 unmodified — `data-feed="albums.json"`, `data-storage="album"` on `<body>` (light theme, no `theme-pouvoir` class).

- [ ] **Step 1: Create `albums.json`**

```json
[]
```

- [ ] **Step 2: Create `album.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Album — po.wor</title>
<meta name="description" content="Album showcase by po.wor.">
<link rel="icon" href="data:,">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="style.css">
</head>
<body data-feed="albums.json" data-storage="album">

<header class="bar">
  <span class="brand">po.wor</span>
  <nav class="nav">
    <a href="index.html">Log</a>
    <a href="pouvoir.html">Pouvoir</a>
    <a href="album.html" aria-current="page">Album</a>
    <a href="cinematic.html">Cinematic</a>
  </nav>
</header>

<main>
  <div id="add-entry-panel" class="add-entry-panel">
    <p class="add-entry-title">developer mode &mdash; entries save to this browser only</p>
    <div class="add-entry-grid">
      <div class="date-field">
        <input id="f-date" type="text" placeholder="yyyy-mm-dd" inputmode="none" autocomplete="off" readonly>
        <div class="date-popover" id="date-popover" hidden>
          <div class="date-popover__header">
            <button type="button" class="date-popover__nav" id="date-prev" aria-label="Previous month">&lsaquo;</button>
            <span class="date-popover__label" id="date-label"></span>
            <button type="button" class="date-popover__nav" id="date-next" aria-label="Next month">&rsaquo;</button>
          </div>
          <div class="date-popover__weekdays">
            <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
          </div>
          <div class="date-popover__grid" id="date-grid"></div>
        </div>
      </div>
      <input id="f-tag" placeholder="tag (optional)">
      <input id="f-text" placeholder="track / album title">
      <input id="f-link" placeholder="streaming link (optional)">
      <input id="f-image" placeholder="cover art url (optional)">
      <input id="f-audio" placeholder="audio url (optional, e.g. assets/demo.mp3)">
      <textarea id="f-detail" placeholder="description shown when clicked (optional)"></textarea>
    </div>
    <div class="add-entry-actions">
      <button id="f-add" type="button">add</button>
      <button id="f-cancel" type="button">cancel</button>
      <button id="f-save" type="button">save</button>
      <span class="add-entry-spacer"></span>
      <button id="f-export" type="button">export json</button>
      <button id="f-reset" type="button">clear local edits</button>
    </div>
  </div>

  <div id="feed" class="feed" aria-live="polite">
    <p class="feed-loading">loading&hellip;</p>
  </div>
</main>

<footer class="foot">
  <span>&copy; <span id="year"></span> po.wor</span>
  <span class="foot-links">
    <!-- swap these for your real links -->
    <a href="https://instagram.com/" target="_blank" rel="noopener">IG</a>
    <a href="https://github.com/" target="_blank" rel="noopener">GH</a>
  </span>
</footer>

<!-- developer-mode toggle: a plain tool icon, not a nav item, tucked in the corner -->
<button id="edit-toggle" aria-label="Toggle developer mode" title="Developer mode">
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="6" cy="7" r="2.4"/>
    <circle cx="6" cy="17" r="2.4"/>
    <path d="M7.8 8.6 19 19M7.8 15.4 19 5"/>
  </svg>
</button>

<script src="script.js"></script>
</body>
</html>
```

- [ ] **Step 3: Manual verification**

Navigate to `http://localhost:4788/album.html`:
- Page loads with the light titanium theme (same as Log — no dark override).
- Nav shows `Album` as current page; other links navigate correctly.
- Empty-state message shows.
- Toggle developer mode, add a test entry with an `audio` field pointing at a placeholder path, save it, confirm the feed row expands to show an inline audio player. Click "clear local edits" afterward.
- No console errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/pipopworasaknukul/Desktop/po.wor
git add album.html albums.json
git commit -m "feat: add Album showcase page"
```

---

### Task 4: Build the Cinematic page

**Files:**
- Create: `/Users/pipopworasaknukul/Desktop/po.wor/cinematic.html`
- Create: `/Users/pipopworasaknukul/Desktop/po.wor/cinematic.json`

**Interfaces:**
- Consumes: `script.js` and `style.css` from Task 1 unmodified — `data-feed="cinematic.json"`, `data-storage="cinematic"` on `<body>` (light theme).

- [ ] **Step 1: Create `cinematic.json`**

```json
[]
```

- [ ] **Step 2: Create `cinematic.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cinematic — po.wor</title>
<meta name="description" content="Cinematic showcase — photos and short video by po.wor.">
<link rel="icon" href="data:,">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="style.css">
</head>
<body data-feed="cinematic.json" data-storage="cinematic">

<header class="bar">
  <span class="brand">po.wor</span>
  <nav class="nav">
    <a href="index.html">Log</a>
    <a href="pouvoir.html">Pouvoir</a>
    <a href="album.html">Album</a>
    <a href="cinematic.html" aria-current="page">Cinematic</a>
  </nav>
</header>

<main>
  <div id="add-entry-panel" class="add-entry-panel">
    <p class="add-entry-title">developer mode &mdash; entries save to this browser only</p>
    <div class="add-entry-grid">
      <div class="date-field">
        <input id="f-date" type="text" placeholder="yyyy-mm-dd" inputmode="none" autocomplete="off" readonly>
        <div class="date-popover" id="date-popover" hidden>
          <div class="date-popover__header">
            <button type="button" class="date-popover__nav" id="date-prev" aria-label="Previous month">&lsaquo;</button>
            <span class="date-popover__label" id="date-label"></span>
            <button type="button" class="date-popover__nav" id="date-next" aria-label="Next month">&rsaquo;</button>
          </div>
          <div class="date-popover__weekdays">
            <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
          </div>
          <div class="date-popover__grid" id="date-grid"></div>
        </div>
      </div>
      <input id="f-tag" placeholder="tag (optional)">
      <input id="f-text" placeholder="title">
      <input id="f-link" placeholder="link (optional)">
      <input id="f-image" placeholder="photo url (optional)">
      <input id="f-audio" placeholder="video url (optional, e.g. assets/clip.mp4)">
      <textarea id="f-detail" placeholder="description shown when clicked (optional)"></textarea>
    </div>
    <div class="add-entry-actions">
      <button id="f-add" type="button">add</button>
      <button id="f-cancel" type="button">cancel</button>
      <button id="f-save" type="button">save</button>
      <span class="add-entry-spacer"></span>
      <button id="f-export" type="button">export json</button>
      <button id="f-reset" type="button">clear local edits</button>
    </div>
  </div>

  <div id="feed" class="feed" aria-live="polite">
    <p class="feed-loading">loading&hellip;</p>
  </div>
</main>

<footer class="foot">
  <span>&copy; <span id="year"></span> po.wor</span>
  <span class="foot-links">
    <!-- swap these for your real links -->
    <a href="https://instagram.com/" target="_blank" rel="noopener">IG</a>
    <a href="https://github.com/" target="_blank" rel="noopener">GH</a>
  </span>
</footer>

<!-- developer-mode toggle: a plain tool icon, not a nav item, tucked in the corner -->
<button id="edit-toggle" aria-label="Toggle developer mode" title="Developer mode">
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="6" cy="7" r="2.4"/>
    <circle cx="6" cy="17" r="2.4"/>
    <path d="M7.8 8.6 19 19M7.8 15.4 19 5"/>
  </svg>
</button>

<script src="script.js"></script>
</body>
</html>
```

Note: the `f-audio` field's `id` is reused here to carry a video URL into the entry's `audio`-shaped form slot — but `saveEntryFromForm()` in `script.js` writes whatever is in `#f-audio` to `entry.audio`, not `entry.video`. This page needs entries to use `entry.video` (per the spec's field table) so the feed renders a `<video>` player instead of an `<audio>` player. Fix this in Step 3 below rather than changing the shared form (which must stay identical across all four pages per Task 1's Interfaces contract).

- [ ] **Step 3: Add a Cinematic-only field mapping in `script.js`**

This is the one place Cinematic's data shape differs from the other three pages (video instead of audio), so it needs three small, additive, backward-compatible changes in `script.js` — none of them change behavior for Log/Pouvoir/Album.

In `startEdit()`, replace:
```js
  document.getElementById('f-audio').value = entry.audio || '';
```
With:
```js
  document.getElementById('f-audio').value = entry.audio || entry.video || '';
```

In `saveEntryFromForm()`, replace:
```js
  const audio = document.getElementById('f-audio').value.trim();
  ...
  if (audio) entry.audio = audio;
```
With:
```js
  const audio = document.getElementById('f-audio').value.trim();
  ...
  if (audio) entry[STORAGE_NS === 'cinematic' ? 'video' : 'audio'] = audio;
```

(Leave every other line in `saveEntryFromForm()` unchanged — only the `if (audio) entry.audio = audio;` line changes.)

- [ ] **Step 4: Manual verification**

Navigate to `http://localhost:4788/cinematic.html`:
- Page loads with the light titanium theme, nav shows `Cinematic` as current.
- Toggle developer mode, add a test entry with the "video url" field filled in (e.g. `assets/test.mp4`), save it: the feed row expands to show a `<video>` element (not `<audio>`), confirming the field mapping works.
- Go back to `album.html`, confirm an entry with the audio field still produces an `<audio>` player (no regression from Step 3's change).
- Clear local edits on both pages afterward.
- No console errors on either page.

- [ ] **Step 5: Commit**

```bash
cd /Users/pipopworasaknukul/Desktop/po.wor
git add cinematic.html cinematic.json script.js
git commit -m "feat: add Cinematic showcase page with video field support"
```

---

### Task 5: Cross-page QA and README update

**Files:**
- Modify: `/Users/pipopworasaknukul/Desktop/po.wor/README.md`

**Interfaces:**
- None — this task only verifies existing behavior and brings docs in line with it.

- [ ] **Step 1: Cross-page nav sweep**

With the server still running, use the Browser pane to visit each of `index.html`, `pouvoir.html`, `album.html`, `cinematic.html` and from each one click all four nav links, confirming:
- Each link lands on the correct page.
- The current page's nav link is visually distinct (`aria-current="page"` styling) on all four pages.
- No console errors on any page.
- Resize to mobile width (375px) on each page: no horizontal overflow, developer-mode panel and calendar popover remain usable.

- [ ] **Step 2: Update `README.md`**

Read the current file, then replace the outdated single-page description and structure sections to reflect: four pages (Log, Pouvoir, Album, Cinematic) sharing one engine via `data-feed`/`data-storage` attributes, developer mode (renamed from edit mode, scissor icon, includes a Save step before Export), and Pouvoir's dark titanium-silver theme. Keep the "Add an entry" (Obsidian), "Run locally", and "Deploy (GitHub Pages)" sections — they still apply unchanged since the site is still fully static.

- [ ] **Step 3: Commit**

```bash
cd /Users/pipopworasaknukul/Desktop/po.wor
git add README.md
git commit -m "docs: update README for multi-page structure and developer mode"
```

- [ ] **Step 4: Stop the local test server**

```bash
lsof -ti:4788 | xargs -r kill 2>/dev/null
```
