# po.wor: publish-from-phone and file attach

## Context

po.wor is now deployed at https://pipo27-bit.github.io/po.wor/ across four
pages (Log, Pouvoir, Album, Cinematic), all sharing one engine (`script.js`)
driven by `data-feed`/`data-storage` attributes on `<body>`.

Today, developer mode is local-only: add/edit/delete write to `localStorage`
in the browser, and getting a change onto the live site requires clicking
"export json," manually replacing the file, and running `git push` from a
computer. That workflow can't be done from a phone.

The owner wants to post from their phone with no computer involved — attach
a photo or audio clip straight from their phone's library, write the entry,
and have it actually go live. They also want editing and publishing kept
visibly separate, so that after publishing they can look at the site "as
other" (as any visitor would) and see exactly what changed — like stepping
back from a piece in a gallery before showing it.

## Goals

- Let developer mode attach an image/audio/video file directly from the
  device's file picker (phone photo library, camera, audio) — no manual
  placement into `assets/` and no typing a path by hand.
- Let developer mode publish an entry straight to the live site (commit to
  GitHub via its REST API) — no export, no manual file replace, no git
  push from a computer.
- Make the developer-mode toggle the edit/publish boundary: **on** shows
  your private drafts, **off** shows exactly what's published — nothing
  local ever leaks into the "off" view.
- Keep this entirely client-side (a GitHub personal access token stored in
  the browser) — no custom backend, no build step, no new dependencies.

## Non-goals

- No multi-user auth, no accounts, no server of any kind — this remains a
  single-owner tool authenticated by one personal token.
- No image/audio compression, resizing, or transcoding — files upload as-is.
- No offline queueing of publishes — if you're offline or the token is
  invalid, publish fails clearly and your draft stays safely local; you
  try again later.
- No change to the JSON schema (`date`, `tag`, `text`, `detail`, `link`,
  `image`, `video`, `audio`) or to Pouvoir's dark theme, nav, or the
  existing calendar-popover date picker.

## GitHub connection

A single access token, stored under one shared `localStorage` key
(`po.wor:githubToken`) — not namespaced per page, since it's one token for
the whole repo regardless of which page you're editing. Repo owner
(`pipo27-bit`), repo name (`po.wor`), and branch (`main`) are hardcoded
constants in `script.js`, since they're fixed for this project — the token
is the only credential the user has to supply.

**UI:** at the top of the developer-mode panel, above the entry form:
- No token saved → a password-style input plus a "connect" button.
- Token saved → collapses to a small "GitHub connected ✓" line with a
  "disconnect" button that clears the stored token.

"Connect" just saves the token to `localStorage` — it doesn't make a test
API call to validate it. An invalid or expired token surfaces naturally
the first time it's actually used (attach or publish), through the same
error handling described in those sections below.

The owner should generate a **fine-grained personal access token scoped
only to the `po.wor` repository**, with only "Contents: read and write"
permission, and a real expiration (90 days is a reasonable default) — this
isn't enforced by the code, but matters because the token sits in
`localStorage` on whatever device it's pasted into: anyone with access to
that unlocked browser could publish to the site for as long as the token
is valid. Scoping to one repo and one permission, with an expiry, limits
that exposure. This is documented in the README, not just in this spec.

## File attach

The "image url" and "audio url" text fields become the same pattern
already used for the date field: a readonly text box (showing the
uploaded path, or a placeholder) paired with a hidden native file input
that opens on click. Selecting a file uploads it immediately — not
deferred to Publish — because holding raw file bytes in a local draft
would risk `localStorage`'s size limits; only the small resulting path
string is ever kept in a draft.

- Image field: `accept="image/*"` (phone camera roll / camera).
- Audio field: `accept="audio/*,video/*"` — Cinematic already reuses this
  same field slot to carry `entry.video` instead of `entry.audio` (see
  the existing `STORAGE_NS === 'cinematic'` mapping in `script.js`), so
  the picker needs to accept both.

**Upload mechanism:** GitHub's Contents API (`PUT
/repos/pipo27-bit/po.wor/contents/{path}`), which handles files up to
100MB — comfortably covers phone photos and short audio/video clips — in
a single call: base64-encode the file, PUT it with a commit message. No
need for the lower-level blob/tree/commit dance. Filenames are
timestamp-prefixed (`assets/{Date.now()}-{original filename}`) to avoid
collisions, flat in `assets/` (no per-page subfolders — keeps this
simple, matches the existing README's description of that folder).

While uploading, the field shows "uploading…" and is briefly disabled;
on success it shows the resulting path; on failure it shows a clear
inline message (no token connected, network error, etc.) and reverts —
nothing is silently lost, you can just try again.

## Publish

The current "save" button — which today only flushes localStorage to
itself and flashes a confirmation — becomes **Publish**, a real action:

1. Compute the current merged entries (same `computeEntries()` used by
   "export json" today).
2. `GET` the page's current JSON file from GitHub to read its `sha`
   (required by the Contents API to update an existing file safely).
3. `PUT` the new JSON content (same formatting as export: 2-space
   indent, trailing newline) with that `sha`, committing to `main`.
4. On success: update `baseEntries` in memory to the just-published data,
   and clear this page's local overrides/deletions — they're now part of
   the published base, so keeping stale copies around only risks drift
   if the file is ever edited directly on GitHub later. The button
   flashes "published ✓," mirroring the existing save-confirmation
   pattern.
5. On failure: leave everything local exactly as it was (nothing
   published, nothing lost) and show a clear error via `alert()`,
   consistent with how existing validation errors are already surfaced.

GitHub Pages takes roughly a minute or two to actually rebuild after a
commit, so the live URL won't reflect the change instantly — the
in-memory update in step 4 is what makes the "developer mode off" view
show your just-published result right away, without waiting on GitHub's
build or falsely implying a fresh network fetch confirmed it live.

"Export json" is unchanged and stays as a manual, offline-friendly backup
option alongside Publish.

## Edit/publish separation

`computeEntries()` currently merges local drafts into the feed
regardless of developer-mode state — so today, turning developer mode
off does *not* show the true published page, since your own unpublished
local edits still show through. That's fixed as part of this work:

- **Developer mode on:** `computeEntries()` behaves as it does today —
  base entries merged with local overrides and deletions. This is your
  private draft view.
- **Developer mode off:** `computeEntries()` returns `baseEntries`
  only — exactly what's published, exactly what any visitor sees.
  Local drafts never appear here.

Since toggling the mode can now change which entries are visible (not
just whether edit controls show), `setEditMode()` needs to trigger a
re-render on every toggle — today it doesn't, because the entries shown
never used to depend on the mode.

## Testing

No automated test suite (unchanged project constraint) — manual
verification per page:

- Connect a token, confirm the panel collapses to "connected ✓."
- Attach an image from the file picker: confirm it uploads, the field
  fills with the resulting path, and the file is visible in the repo
  on GitHub afterward.
- Add an entry referencing the attached image, click Publish: confirm
  the API calls succeed, the button flashes "published ✓," and the
  page's JSON file is updated on GitHub with correct `sha`-based
  versioning (no conflict error).
- Toggle developer mode off immediately after publishing: confirm the
  just-published entry shows, and no other local-only drafts appear.
- Toggle developer mode back on: confirm local drafts (if any remain
  unpublished) reappear alongside the published entries.
- Disconnect the token, attempt to attach a file or publish: confirm a
  clear error, and confirm the local draft is untouched.
- Repeat the attach + publish flow on Pouvoir (dark theme) to confirm no
  visual regressions in the new UI elements against that palette.
