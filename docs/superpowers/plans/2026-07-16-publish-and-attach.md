# Publish and Attach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Exception:** Task 5 in this plan is controller-run, not subagent-dispatched — see its header note.

**Goal:** Let developer mode attach photos/audio/video straight from a phone's file picker and publish entries directly to the live GitHub Pages site, while keeping the developer-mode toggle as a hard boundary between "my private drafts" and "exactly what's published."

**Architecture:** All new capability is client-side calls to GitHub's REST API (`api.github.com`) using a personal access token stored in `localStorage`. No backend, no build step, no new dependencies. `computeEntries()` — the function that already merges local drafts with fetched base data — becomes conditional on whether developer mode is on, which is the entire mechanism behind the edit/publish separation.

**Tech Stack:** Plain HTML/CSS/JS (unchanged), GitHub REST API v3 (Contents endpoint) via `fetch()`.

## Global Constraints

- No build step, no framework, no new dependencies — plain HTML/CSS/JS only.
- No change to the JSON schema (`date`, `tag`, `text`, `detail`, `link`, `image`, `video`, `audio`).
- No change to Pouvoir's dark theme, nav, or the existing calendar-popover date picker.
- The GitHub token lives only in `localStorage`, keyed `po.wor:githubToken`, shared globally (not namespaced per page) — one token for the whole repo.
- Repo identity (`pipo27-bit`, `po.wor`, branch `main`) is hardcoded in `script.js` — the token is the only credential the user supplies.
- "Connect" only saves the token locally — no validation API call at connect time; invalid/expired tokens surface naturally on first real use (attach or publish).
- Tasks 1–4 must NOT make real authenticated writes against the live repo during their own testing — that risk is deliberately isolated to Task 5, which the controller runs directly rather than dispatching to a subagent.

---

### Task 1: GitHub API core helpers and token storage

**Files:**
- Modify: `/Users/pipopworasaknukul/Desktop/po.wor/script.js`

**Interfaces:**
- Produces: `getToken()`, `setToken(token)`, `clearToken()`, `utf8ToBase64(str)`, `fileToBase64(file)` (returns `Promise<string>`, the base64 payload without the `data:` prefix), `githubApi(path, options)` (returns `Promise<parsed JSON>`, throws `Error` with the HTTP status and response body on any non-2xx response). Constants `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`. Later tasks call all of these by these exact names.

- [ ] **Step 1: Add the GitHub API section to `script.js`**

Insert this new section immediately after the `// ---------- custom date picker ----------` section's closing (after the `document.addEventListener('keydown', ...)` block) and before `// ---------- wire up ----------`:

```js
// ---------- GitHub API (publish + attach) ----------
// Both features write directly to the live GitHub repo using a personal
// access token stored in this browser only (never sent anywhere but
// api.github.com). Scope the token to just this repo with only
// "Contents: read and write" permission, and give it a real expiration —
// anyone with access to this browser could publish while it's valid.

const GITHUB_OWNER = 'pipo27-bit';
const GITHUB_REPO = 'po.wor';
const GITHUB_BRANCH = 'main';
const LS_TOKEN = 'po.wor:githubToken';

function getToken() {
  return localStorage.getItem(LS_TOKEN) || '';
}
function setToken(token) {
  localStorage.setItem(LS_TOKEN, token);
}
function clearToken() {
  localStorage.removeItem(LS_TOKEN);
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function githubApi(path, options = {}) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}
```

`utf8ToBase64` matters because `log.json` already contains non-Latin1 text (e.g. `呪われた金庫`, `ヒマ`) — plain `btoa()` throws on that, so this needs to encode via `TextEncoder` first.

- [ ] **Step 2: Manual verification (safe — no real repo writes)**

Start a local server and open the Browser pane:
```bash
cd /Users/pipopworasaknukul/Desktop/po.wor
python3 -m http.server 4788
```
Navigate to `http://localhost:4788`, then in the browser console (via `javascript_tool`), run each of these and confirm the result:

```js
utf8ToBase64('hello')
```
Expected: a valid base64 string, no error.

```js
new TextDecoder().decode(Uint8Array.from(atob(utf8ToBase64('呪われた')), c => c.charCodeAt(0)))
```
Expected: `'呪われた'` — confirms the Unicode round-trip works.

```js
getToken()
```
Expected: `''` (nothing set yet).

```js
setToken('temp-test'); getToken();
```
Expected: `'temp-test'`.

```js
clearToken(); getToken();
```
Expected: `''`.

```js
githubApi('/contents/nonexistent-file-xyz.json').catch(e => e.message)
```
Expected: a string containing `404` — confirms error handling works without needing a valid token (public repos allow unauthenticated reads, so this exercises the real request/error path safely).

- [ ] **Step 3: Commit**

```bash
cd /Users/pipopworasaknukul/Desktop/po.wor
git add script.js
git commit -m "feat: add GitHub API core helpers and token storage"
```

---

### Task 2: Gate local drafts behind developer mode

**Files:**
- Modify: `/Users/pipopworasaknukul/Desktop/po.wor/script.js`

**Interfaces:**
- Consumes: nothing new from Task 1.
- Produces: `computeEntries()` now returns only `baseEntries` (sorted) when `document.body` lacks the `edit-mode` class, and the full draft-merged set when it has it. `setEditMode(on)` now re-renders the feed on every toggle. Task 4's publish flow relies on `computeEntries()` returning the draft set while the publish button is clickable (which is only true while `edit-mode` is present, since the button's containing panel is only visible then).

- [ ] **Step 1: Gate `computeEntries()` on edit-mode**

Replace:
```js
function computeEntries() {
  const overrides = loadOverrides();
  const deleted = loadDeleted();
  const map = new Map();
  baseEntries.forEach(e => map.set(e.date, e));
  Object.entries(overrides).forEach(([date, patch]) => {
    map.set(date, { ...(map.get(date) || {}), ...patch, date });
  });
  deleted.forEach(d => map.delete(d));
  return [...map.values()].sort((a, b) => parseDate(b.date) - parseDate(a.date));
}
```
With:
```js
function computeEntries() {
  if (!document.body.classList.contains('edit-mode')) {
    return [...baseEntries].sort((a, b) => parseDate(b.date) - parseDate(a.date));
  }
  const overrides = loadOverrides();
  const deleted = loadDeleted();
  const map = new Map();
  baseEntries.forEach(e => map.set(e.date, e));
  Object.entries(overrides).forEach(([date, patch]) => {
    map.set(date, { ...(map.get(date) || {}), ...patch, date });
  });
  deleted.forEach(d => map.delete(d));
  return [...map.values()].sort((a, b) => parseDate(b.date) - parseDate(a.date));
}
```

- [ ] **Step 2: Re-render on every developer-mode toggle**

Replace:
```js
function setEditMode(on) {
  document.body.classList.toggle('edit-mode', on);
  document.getElementById('edit-toggle').setAttribute('aria-pressed', String(on));
  localStorage.setItem(LS_EDIT_MODE, on ? '1' : '0');
  if (!on) cancelEdit();
}
```
With:
```js
function setEditMode(on) {
  document.body.classList.toggle('edit-mode', on);
  document.getElementById('edit-toggle').setAttribute('aria-pressed', String(on));
  localStorage.setItem(LS_EDIT_MODE, on ? '1' : '0');
  if (!on) cancelEdit();
  renderFeed();
}
```

- [ ] **Step 3: Manual verification**

With the local server from Task 1 running, open `http://localhost:4788`:
1. Toggle developer mode ON (scissors icon).
2. Add a test entry: date = today (via the calendar popover), text = `TEST DRAFT`, click "add".
3. Confirm `TEST DRAFT` appears in the feed while developer mode is still on.
4. Toggle developer mode OFF. Confirm `TEST DRAFT` disappears — only the real committed entries remain.
5. Toggle developer mode back ON. Confirm `TEST DRAFT` reappears.
6. Click "clear local edits" to remove the test draft; confirm the confirmation dialog and cleanup work as before.
7. Check `read_console_messages` — expect no errors throughout.

- [ ] **Step 4: Commit**

```bash
cd /Users/pipopworasaknukul/Desktop/po.wor
git add script.js
git commit -m "feat: gate local drafts behind developer mode toggle"
```

---

### Task 3: File attach UI and GitHub connect UI

**Files:**
- Modify: `/Users/pipopworasaknukul/Desktop/po.wor/script.js`
- Modify: `/Users/pipopworasaknukul/Desktop/po.wor/index.html`
- Modify: `/Users/pipopworasaknukul/Desktop/po.wor/pouvoir.html`
- Modify: `/Users/pipopworasaknukul/Desktop/po.wor/album.html`
- Modify: `/Users/pipopworasaknukul/Desktop/po.wor/cinematic.html`
- Modify: `/Users/pipopworasaknukul/Desktop/po.wor/style.css`

**Interfaces:**
- Consumes: `getToken()`, `fileToBase64()`, `utf8ToBase64()`, `githubApi()`, constants from Task 1.
- Produces: `uploadFileToGitHub(file)` (returns `Promise<string>`, the resulting `assets/...` path), `wireAttachField(fieldId, fileInputId)`, `renderGithubConnectUI()`. HTML element ids `gh-connect`, `gh-connected`, `f-token`, `f-token-save`, `f-token-clear`, `f-image-file`, `f-audio-file` — Task 5's live verification and any future page relies on these existing verbatim.

- [ ] **Step 1: Add upload and connect-UI functions to `script.js`**

Insert immediately after the `githubApi()` function from Task 1 (still within the `// ---------- GitHub API (publish + attach) ----------` section):

```js
async function uploadFileToGitHub(file) {
  const base64 = await fileToBase64(file);
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '-');
  const path = `assets/${Date.now()}-${safeName}`;
  await githubApi(`/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `attach: ${safeName} via po.wor developer mode`,
      content: base64,
      branch: GITHUB_BRANCH,
    }),
  });
  return path;
}

function wireAttachField(fieldId, fileInputId) {
  const field = document.getElementById(fieldId);
  const fileInput = document.getElementById(fileInputId);
  field.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (!getToken()) {
      alert('connect a GitHub token first');
      fileInput.value = '';
      return;
    }
    const original = field.value;
    field.value = 'uploading…';
    field.disabled = true;
    try {
      field.value = await uploadFileToGitHub(file);
    } catch (e) {
      alert(`upload failed: ${e.message}`);
      field.value = original;
    } finally {
      field.disabled = false;
      fileInput.value = '';
    }
  });
}

function renderGithubConnectUI() {
  const connected = !!getToken();
  document.getElementById('gh-connect').hidden = connected;
  document.getElementById('gh-connected').hidden = !connected;
}
```

- [ ] **Step 2: Wire it up in the `// ---------- wire up ----------` section**

Add these lines right after the existing `document.getElementById('f-reset').addEventListener('click', clearLocalEdits);` line:

```js
wireAttachField('f-image', 'f-image-file');
wireAttachField('f-audio', 'f-audio-file');

document.getElementById('f-token-save').addEventListener('click', () => {
  const val = document.getElementById('f-token').value.trim();
  if (!val) { alert('paste a token first'); return; }
  setToken(val);
  document.getElementById('f-token').value = '';
  renderGithubConnectUI();
});
document.getElementById('f-token-clear').addEventListener('click', () => {
  clearToken();
  renderGithubConnectUI();
});
renderGithubConnectUI();
```

- [ ] **Step 3: Update `style.css`**

Add this block immediately after the existing `.date-popover__day.is-selected { ... }` rule and before `.add-entry-grid textarea`:

```css
.attach-field {
  grid-column: span 1;
}

.attach-field input {
  cursor: pointer;
}

.attach-field input:disabled {
  opacity: 0.6;
  cursor: default;
}

/* ---------- GitHub connect ---------- */

.gh-connect,
.gh-connected {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--rule);
  font-family: var(--mono);
  font-size: 12px;
}

.gh-connect input {
  flex: 1;
  padding: 8px 10px;
  background: var(--bg);
  border: 1px solid var(--rule);
  border-radius: 4px;
  color: var(--text);
  font-family: var(--sans);
  font-size: 14px;
}

.gh-connect button,
.gh-connected button {
  padding: 7px 12px;
  background: transparent;
  border: 1px solid var(--rule);
  border-radius: 4px;
  color: var(--text);
  font-family: var(--mono);
  font-size: 12px;
  cursor: pointer;
}

.gh-connect button:hover,
.gh-connected button:hover { border-color: var(--accent); color: var(--accent); }

.gh-connected span { color: var(--dim); flex: 1; }
```

- [ ] **Step 4: Update the HTML in all four pages**

In each of `index.html`, `pouvoir.html`, `album.html`, `cinematic.html`, make two changes:

**4a.** Immediately after the line `<p class="add-entry-title">developer mode &mdash; entries save to this browser only</p>` and before `<div class="add-entry-grid">`, insert:

```html
    <div class="gh-connect" id="gh-connect">
      <input id="f-token" type="password" placeholder="GitHub token" autocomplete="off">
      <button id="f-token-save" type="button">connect</button>
    </div>
    <div class="gh-connected" id="gh-connected" hidden>
      <span>GitHub connected &#10003;</span>
      <button id="f-token-clear" type="button">disconnect</button>
    </div>
```

**4b.** Replace the `f-image` and `f-audio` input lines (the exact placeholder text differs slightly between pages — match whichever variant is present in that file) with the attach-field markup. For example, in `index.html`, replace:

```html
      <input id="f-image" placeholder="image url (optional)">
      <input id="f-audio" placeholder="audio url (optional, e.g. assets/demo.mp3)">
```

With:

```html
      <div class="attach-field">
        <input id="f-image" type="text" placeholder="tap to attach an image" readonly>
        <input type="file" id="f-image-file" accept="image/*" hidden>
      </div>
      <div class="attach-field">
        <input id="f-audio" type="text" placeholder="tap to attach audio or video" readonly>
        <input type="file" id="f-audio-file" accept="audio/*,video/*" hidden>
      </div>
```

Apply the equivalent replacement in `pouvoir.html` (placeholders `"product image url (optional)"` / `"audio url (optional, e.g. assets/demo.mp3)"`), `album.html` (`"cover art url (optional)"` / `"audio url (optional, e.g. assets/demo.mp3)"`), and `cinematic.html` (`"photo url (optional)"` / `"video url (optional, e.g. assets/clip.mp4)"`) — keep each page's existing placeholder wording, just change `tap to attach an image` / `tap to attach audio or video` to match that page's original phrasing style (e.g. cinematic's image field becomes `placeholder="tap to attach a photo"`, its audio-slot field becomes `placeholder="tap to attach a video"`).

- [ ] **Step 5: Manual verification (safe — no real repo writes)**

With the local server running, open `http://localhost:4788` (index.html):
1. Toggle developer mode ON.
2. Confirm the "GitHub token" input and "connect" button are visible, and the "connected" line is hidden.
3. Type `fake-test-token` into the token field, click "connect". Confirm the UI collapses to "GitHub connected ✓" with a "disconnect" button.
4. Click the image field (now showing "tap to attach an image"). Confirm no console errors occur (a native file picker may or may not be interactable in the automated browser — the goal here is just confirming the click wiring doesn't throw).
5. Click "disconnect". Confirm it reverts to showing the token input.
6. Reload the page. Confirm the connect/connected state matches what's actually in `localStorage` (disconnected, since Step 5 cleared it).
7. Repeat steps 1–3 on `pouvoir.html` (dark theme) — confirm the token UI and attach fields are legible and correctly styled against the dark palette, no visual regressions.
8. Check `read_console_messages` on both pages — expect no errors.

Do not attempt a real file upload with a real token in this task — that is Task 5's responsibility, run directly by the controller against a safe test page.

- [ ] **Step 6: Commit**

```bash
cd /Users/pipopworasaknukul/Desktop/po.wor
git add script.js style.css index.html pouvoir.html album.html cinematic.html
git commit -m "feat: add GitHub token connect UI and file-attach fields"
```

---

### Task 4: Real Publish action

**Files:**
- Modify: `/Users/pipopworasaknukul/Desktop/po.wor/script.js`
- Modify: `/Users/pipopworasaknukul/Desktop/po.wor/index.html`
- Modify: `/Users/pipopworasaknukul/Desktop/po.wor/pouvoir.html`
- Modify: `/Users/pipopworasaknukul/Desktop/po.wor/album.html`
- Modify: `/Users/pipopworasaknukul/Desktop/po.wor/cinematic.html`

**Interfaces:**
- Consumes: `computeEntries()` (Task 2), `getToken()`, `utf8ToBase64()`, `githubApi()` (Task 1), `FEED_URL`, `LS_OVERRIDES`, `LS_DELETED`, `baseEntries` (existing module state).
- Produces: `publishEntries()` (returns `Promise<void>`, throws on failure). The `#f-save` button's click handler now performs a real publish instead of a local-only flush.

- [ ] **Step 1: Add `publishEntries()` to `script.js`**

Insert immediately after `uploadFileToGitHub()` (still within the GitHub API section):

```js
async function publishEntries() {
  const entries = computeEntries();
  const content = JSON.stringify(entries, null, 2) + '\n';
  const base64Content = utf8ToBase64(content);

  const current = await githubApi(`/contents/${FEED_URL}?ref=${GITHUB_BRANCH}`);
  const sha = current.sha;

  await githubApi(`/contents/${FEED_URL}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `publish: update ${FEED_URL} from po.wor developer mode`,
      content: base64Content,
      sha,
      branch: GITHUB_BRANCH,
    }),
  });

  baseEntries = entries;
  localStorage.removeItem(LS_OVERRIDES);
  localStorage.removeItem(LS_DELETED);
}
```

`computeEntries()` here returns the full draft-merged set (base + overrides − deletions), not the published-only set — this call only ever happens while the Publish button is reachable, and that button's panel is only visible while `edit-mode` is on (see `body.edit-mode .add-entry-panel { display: block; }` in `style.css`), so `computeEntries()`'s edit-mode gate from Task 2 always resolves to the draft branch here.

- [ ] **Step 2: Replace the `f-save` click handler**

Replace:
```js
document.getElementById('f-save').addEventListener('click', () => {
  // Every add/edit/delete already writes to localStorage immediately —
  // this is a confirmation checkpoint, not a gate on persistence.
  saveOverrides(loadOverrides());
  saveDeleted(loadDeleted());
  const btn = document.getElementById('f-save');
  const original = btn.textContent;
  btn.textContent = 'saved ✓';
  btn.disabled = true;
  setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 1200);
});
```
With:
```js
document.getElementById('f-save').addEventListener('click', async () => {
  if (!getToken()) { alert('connect a GitHub token first'); return; }
  const btn = document.getElementById('f-save');
  const original = btn.textContent;
  btn.textContent = 'publishing…';
  btn.disabled = true;
  try {
    await publishEntries();
    renderFeed();
    btn.textContent = 'published ✓';
    setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 1200);
  } catch (e) {
    btn.textContent = original;
    btn.disabled = false;
    alert(`publish failed: ${e.message}`);
  }
});
```

- [ ] **Step 3: Rename the button label in all four HTML pages**

In each of `index.html`, `pouvoir.html`, `album.html`, `cinematic.html`, replace:
```html
      <button id="f-save" type="button">save</button>
```
With:
```html
      <button id="f-save" type="button">publish</button>
```

- [ ] **Step 4: Manual verification (safe — no real repo writes)**

With the local server running, open `http://localhost:4788`:
1. Toggle developer mode ON. In the console, run `localStorage.removeItem('po.wor:githubToken')` then reload, confirm "connect" UI shows (not connected).
2. Add a test entry (date today, text `TEST PUBLISH`), click "add" — confirm it appears in the draft view.
3. Click "publish". Confirm an `alert` immediately says to connect a token first, and confirm via `read_network_requests` that no request to `api.github.com` was made.
4. In the console, run `localStorage.setItem('po.wor:githubToken', 'fake-invalid-token')` and reload.
5. Click "publish" again. Confirm the button briefly shows "publishing…", then reverts to "publish" and an `alert` shows a `GitHub API 401` (or similar) error — GitHub rejects the fake token.
6. Confirm `TEST PUBLISH` is still present in the draft view after the failed publish (nothing was lost).
7. Clean up: click "clear local edits" to remove `TEST PUBLISH`, then run `localStorage.removeItem('po.wor:githubToken')` in the console.
8. Check `read_console_messages` — expect no unhandled errors (the caught `GitHub API 401` error is expected and fine).

Do not attempt a publish with a real valid token in this task. A full successful publish against the live repo is Task 5's responsibility.

- [ ] **Step 5: Commit**

```bash
cd /Users/pipopworasaknukul/Desktop/po.wor
git add script.js index.html pouvoir.html album.html cinematic.html
git commit -m "feat: implement real Publish action, committing entries straight to GitHub"
```

---

### Task 5: Live end-to-end verification, cleanup, and README update

**This task is controller-run, not dispatched to a subagent.** It makes real, authenticated writes to the live `pipo27-bit/po.wor` repository — attaching a test file and publishing a test entry — and must clean up after itself so nothing test-related is left in the live site. That risk profile calls for direct, attentive execution rather than delegation.

**Files:**
- Modify: `/Users/pipopworasaknukul/Desktop/po.wor/README.md`

- [ ] **Step 1: Obtain a live token and confirm the target page is safe to test against**

```bash
gh auth token
```

Use `cinematic.html` / `cinematic.json` for the live test — confirm first that it's currently empty (no real content at risk):

```bash
gh api repos/pipo27-bit/po.wor/contents/cinematic.json --jq '.content' | base64 -d
```

Expected: `[]`.

- [ ] **Step 2: Connect the real token in the browser**

With the local server running, open `http://localhost:4788/cinematic.html`, toggle developer mode ON, and in the console run (substituting the token from Step 1):

```js
localStorage.setItem('po.wor:githubToken', '<token from gh auth token>');
```

Reload the page, confirm "GitHub connected ✓" shows.

- [ ] **Step 3: Exercise a real file attach**

Native file pickers aren't scriptable in the automated browser, so exercise the real upload function directly via the console (this still makes a genuine API call through the real code path):

```js
const blob = new Blob(['po.wor test attachment — safe to delete'], { type: 'text/plain' });
const file = new File([blob], 'po-wor-test-attach.txt', { type: 'text/plain' });
uploadFileToGitHub(file).then(path => { window.__testAttachPath = path; console.log('uploaded to', path); });
```

Confirm the console logs a path like `assets/1699999999-po-wor-test-attach.txt`, and confirm it's real:

```bash
gh api repos/pipo27-bit/po.wor/contents/<path from above>
```

Expected: 200 response with matching content.

- [ ] **Step 4: Add a test entry referencing it and publish**

In the console:
```js
document.getElementById('f-date').value = new Date().toISOString().slice(0, 10);
document.getElementById('f-text').value = 'TEST ENTRY — verifying publish, will be removed';
document.getElementById('f-image').value = window.__testAttachPath;
```
Then click "add" in the UI (or run `saveEntryFromForm()` in the console), confirm the entry appears in the draft view, then click "publish" (or run the click handler by dispatching a click on `#f-save`).

Confirm success (`published ✓` flash), then verify directly:
```bash
gh api repos/pipo27-bit/po.wor/contents/cinematic.json --jq '.content' | base64 -d
```
Expected: a JSON array containing the test entry with the attached path.

- [ ] **Step 5: Confirm the edit/publish separation works with real published data**

Toggle developer mode OFF in the browser. Confirm the test entry is visible (since `baseEntries` was updated in memory by the successful publish). This confirms the full loop: attach → publish → "off" view shows exactly what's live.

- [ ] **Step 6: Clean up — remove the test entry and test file**

In the browser, toggle developer mode back ON, delete the test entry via its trash icon, click "publish" again to push the empty state back:

```bash
gh api repos/pipo27-bit/po.wor/contents/cinematic.json --jq '.content' | base64 -d
```
Expected: `[]` again.

Delete the test attachment file:
```bash
SHA=$(gh api repos/pipo27-bit/po.wor/contents/<path from Step 3> --jq '.sha')
gh api -X DELETE repos/pipo27-bit/po.wor/contents/<path from Step 3> -f message="cleanup: remove test attachment" -f sha="$SHA" -f branch=main
```

Confirm it's gone:
```bash
gh api repos/pipo27-bit/po.wor/contents/<path from Step 3>
```
Expected: 404.

Finally, remove the injected test token from the browser:
```js
localStorage.removeItem('po.wor:githubToken');
```

- [ ] **Step 7: Update `README.md`**

Read the current file, then add/update sections documenting:
- **GitHub token setup**: generate a fine-grained personal access token scoped only to the `po.wor` repository, with only "Contents: read and write" permission, and a real expiration (90 days is a reasonable default); paste it into developer mode's "GitHub token" field once — it's stored only in that browser.
- **Attach**: tap the image or audio/video field in developer mode, pick a file from your device, it uploads automatically and fills in the path.
- **Publish**: click "publish" to commit your current entries straight to the live site (GitHub Pages takes roughly a minute or two to actually rebuild). "Export json" remains as a manual, offline-friendly backup that doesn't require a token.
- **Edit vs. publish**: developer mode on shows your private drafts (published + anything not yet published); developer mode off shows exactly what's live, with no local drafts mixed in.

Keep the existing "Run locally" and "Deploy (GitHub Pages)" sections — they're unchanged.

- [ ] **Step 8: Commit the README update**

```bash
cd /Users/pipopworasaknukul/Desktop/po.wor
git add README.md
git commit -m "docs: document GitHub token setup, attach, and publish workflow"
git push
```

- [ ] **Step 9: Final cross-page sweep**

Open each of `index.html`, `pouvoir.html`, `album.html`, `cinematic.html` at `http://localhost:4788`, confirm:
- The GitHub connect UI and attach fields render correctly and match each page's theme (light for Log/Album/Cinematic, dark for Pouvoir).
- No console errors on any page.
- At 375px width, the new UI elements don't overflow or clip.

Stop the local server:
```bash
lsof -ti:4788 | xargs -r kill 2>/dev/null
```
