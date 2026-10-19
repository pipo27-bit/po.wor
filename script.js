// po.wor — a read-only feed with click-to-expand entries.
//
// How it works:
//   1. Each HTML page names its data file in <body data-feed="log.json">.
//   2. This script fetches that JSON file, sorts the entries newest first,
//      and builds one <article> per entry.
//   3. Clicking an entry that has a detail, link, image, video or audio
//      expands it in place.
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
    if (entry.image) {
      const img = document.createElement('img');
      img.src = entry.image;
      img.alt = entry.text;
      img.loading = 'lazy';
      img.className = 'entry-media';
      detail.appendChild(img);
    } else if (entry.video) {
      const video = document.createElement('video');
      video.src = entry.video;
      video.controls = true;
      video.preload = 'none';
      video.className = 'entry-media';
      detail.appendChild(video);
    } else if (entry.audio) {
      const audio = document.createElement('audio');
      audio.src = entry.audio;
      audio.controls = true;
      audio.preload = 'none';
      audio.className = 'entry-audio';
      detail.appendChild(audio);
    }
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

// ---------- load ----------

async function loadFeed() {
  const el = document.getElementById('feed');
  try {
    const res = await fetch(FEED_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    renderFeed(prepareEntries(await res.json()));
  } catch (err) {
    el.innerHTML = `<p class="feed-loading">couldn't load the log (${escapeHtml(err.message)}).</p>`;
  }
}

loadFeed();
