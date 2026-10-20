// po.wor — a read-only feed with click-to-expand entries.
//
// How it works:
//   1. Each HTML page names its data file in <body data-feed="log.json">.
//   2. This script fetches that JSON file, sorts the entries newest first,
//      and builds one <article> per entry.
//   3. Clicking an entry that has a detail, link, image, video or audio
//      expands it in place.
//
// Two layouts, chosen by <body data-layout="...">:
//   - (nothing)   the dated log list (index.html)
//   - "grid"      a wall of square covers with a title and subtitle under each,
//                 like Apple Music's Albums view (pouvoir, album, cinematic).
//                 Click a cover to open it large. Same JSON fields as the log:
//                 text = title, tag = subtitle, image = cover.
//
// Nothing here writes data. To change what the site shows, edit the JSON
// file (or run scripts/add_entry.py), then commit and push.
//
// IMPORTANT: every HTML page loads this file as "script.js?v=N" (same for
// style.css). Browsers cache these aggressively, so whenever this file or
// style.css changes, bump ?v=N in all four HTML pages — otherwise visitors
// keep running the old cached code.

document.getElementById('year').textContent = new Date().getFullYear();

if (location.protocol === 'file:') {
  const warning = document.createElement('div');
  warning.className = 'file-warning';
  warning.textContent = 'Opened as a local file — loading the data won’t work reliably. Run "python3 -m http.server" in this folder and open http://localhost:8000 instead.';
  document.body.prepend(warning);
}

// Which JSON file this page shows (set on the <body> tag of each page).
const FEED_URL = document.body.dataset.feed || 'log.json';
// "grid" for the cover wall, anything else for the dated list.
const LAYOUT = document.body.dataset.layout || 'list';

// ---------- helpers ----------

function parseDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// "2026-10-19" -> "MON-19-10-2026"
function formatDisplayDate(iso) {
  const d = parseDate(iso);
  const wd = WEEKDAYS[d.getDay()];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${wd}-${dd}-${mm}-${d.getFullYear()}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Newest date first. Entries that share a date keep the order they have in
// the file (the one higher up shows first). Array.sort is stable, so this
// is guaranteed.
function prepareEntries(rawEntries) {
  return [...rawEntries].sort((a, b) => parseDate(b.date) - parseDate(a.date));
}

// The one media file an entry shows when opened: image, else video, else audio.
function buildMedia(entry) {
  if (entry.image) {
    const img = document.createElement('img');
    img.src = entry.image;
    img.alt = entry.text;
    img.loading = 'lazy';
    img.className = 'entry-media';
    return img;
  }
  if (entry.video) {
    const video = document.createElement('video');
    video.src = entry.video;
    video.controls = true;
    video.preload = 'none';
    video.className = 'entry-media';
    return video;
  }
  if (entry.audio) {
    const audio = document.createElement('audio');
    audio.src = entry.audio;
    audio.controls = true;
    audio.preload = 'none';
    audio.className = 'entry-audio';
    return audio;
  }
  return null;
}

// ---------- render ----------

function renderFeed(entries) {
  const el = document.getElementById('feed');

  if (entries.length === 0) {
    el.innerHTML = '<p class="feed-loading">no entries yet.</p>';
    return;
  }

  el.innerHTML = '';
  entries.forEach(entry => el.appendChild(renderEntry(entry)));
}

function renderEntry(entry) {
  const hasDetail = !!(entry.detail || entry.link || entry.image || entry.video || entry.audio);

  const article = document.createElement('article');
  article.className = 'entry' + (hasDetail ? ' has-detail' : '');
  article.dataset.date = entry.date;

  const date = document.createElement('div');
  date.className = 'entry-date';
  date.textContent = formatDisplayDate(entry.date);

  const body = document.createElement('div');
  body.className = 'entry-body';

  const row = document.createElement('div');
  row.className = 'entry-row';

  const main = document.createElement('div');
  main.className = 'entry-main';

  if (entry.tag) {
    const tag = document.createElement('span');
    tag.className = 'entry-tag';
    tag.textContent = entry.tag;
    main.appendChild(tag);
    main.appendChild(document.createElement('br'));
  }

  const text = document.createElement('p');
  text.className = 'entry-text';
  text.textContent = entry.text;
  main.appendChild(text);

  row.appendChild(main);
  body.appendChild(row);

  if (hasDetail) {
    const detail = document.createElement('div');
    detail.className = 'entry-detail';

    if (entry.detail) {
      const p = document.createElement('p');
      p.className = 'entry-detail-text';
      p.textContent = entry.detail;
      detail.appendChild(p);
    }
    const media = buildMedia(entry);
    if (media) detail.appendChild(media);
    if (entry.link) {
      const a = document.createElement('a');
      a.href = entry.link;
      a.target = '_blank';
      a.rel = 'noopener';
      a.className = 'entry-link';
      a.textContent = 'visit →';
      detail.appendChild(a);
    }
    body.appendChild(detail);
  }

  article.appendChild(date);
  article.appendChild(body);

  if (hasDetail) {
    article.addEventListener('click', (e) => {
      if (e.target.closest('.entry-link')) return; // let the link open normally
      article.classList.toggle('expanded');
    });
  }

  return article;
}

// ---------- cover grid ----------

function renderGrid(entries) {
  const el = document.getElementById('feed');
  el.classList.add('grid');

  if (entries.length === 0) {
    el.innerHTML = '<p class="feed-loading">nothing here yet.</p>';
    return;
  }

  el.innerHTML = '';
  entries.forEach(entry => el.appendChild(renderCard(entry)));
}

// What fills the square: the image, else the first frame of the video,
// else a plain tile with the first letter of the title (or a note for audio).
function coverMedia(entry) {
  if (entry.image) {
    const img = document.createElement('img');
    img.src = entry.image;
    img.alt = '';
    img.loading = 'lazy';
    return img;
  }
  if (entry.video) {
    const video = document.createElement('video');
    video.src = entry.video + '#t=0.1';
    video.muted = true;
    video.preload = 'metadata';
    video.playsInline = true;
    return video;
  }
  const tile = document.createElement('div');
  tile.className = 'card-placeholder';
  tile.textContent = entry.audio ? '\u266A' : (entry.text || '?').trim().charAt(0).toUpperCase();
  return tile;
}

function renderCard(entry) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'card';

  const cover = document.createElement('div');
  cover.className = 'card-cover';
  cover.appendChild(coverMedia(entry));
  card.appendChild(cover);

  const title = document.createElement('p');
  title.className = 'card-title';
  title.textContent = entry.text;
  card.appendChild(title);

  if (entry.tag) {
    const sub = document.createElement('p');
    sub.className = 'card-sub';
    sub.textContent = entry.tag;
    card.appendChild(sub);
  }

  card.addEventListener('click', () => openViewer(entry));
  return card;
}

// One shared <dialog> that shows a single item large.
let viewer = null;

function getViewer() {
  if (viewer) return viewer;
  viewer = document.createElement('dialog');
  viewer.className = 'viewer';
  // Only the dark backdrop counts as "outside": the content sits in .viewer-inner.
  viewer.addEventListener('click', (e) => { if (e.target === viewer) viewer.close(); });
  viewer.addEventListener('close', () => {
    viewer.querySelectorAll('video, audio').forEach(m => m.pause());
    viewer.innerHTML = '';
  });
  document.body.appendChild(viewer);
  return viewer;
}

function openViewer(entry) {
  const v = getViewer();
  v.innerHTML = '';

  const inner = document.createElement('div');
  inner.className = 'viewer-inner';

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'viewer-close';
  close.setAttribute('aria-label', 'Close');
  close.textContent = '\u00D7';
  close.addEventListener('click', () => v.close());
  inner.appendChild(close);

  const media = buildMedia(entry);
  if (media) inner.appendChild(media);

  const title = document.createElement('h2');
  title.className = 'viewer-title';
  title.textContent = entry.text;
  inner.appendChild(title);

  const meta = document.createElement('p');
  meta.className = 'viewer-meta';
  meta.textContent = [entry.tag, formatDisplayDate(entry.date)].filter(Boolean).join(' \u00B7 ');
  inner.appendChild(meta);

  if (entry.detail) {
    const p = document.createElement('p');
    p.className = 'entry-detail-text';
    p.textContent = entry.detail;
    inner.appendChild(p);
  }
  if (entry.link) {
    const a = document.createElement('a');
    a.href = entry.link;
    a.target = '_blank';
    a.rel = 'noopener';
    a.className = 'entry-link';
    a.textContent = 'visit \u2192';
    inner.appendChild(a);
  }

  v.appendChild(inner);
  v.showModal();
}

// ---------- load ----------

async function loadFeed() {
  const el = document.getElementById('feed');
  try {
    const res = await fetch(FEED_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const entries = prepareEntries(await res.json());
    if (LAYOUT === 'grid') renderGrid(entries);
    else renderFeed(entries);
  } catch (err) {
    el.innerHTML = `<p class="feed-loading">couldn't load the log (${escapeHtml(err.message)}).</p>`;
  }
}

loadFeed();
