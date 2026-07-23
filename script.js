// po.wor — single-page feed with click-to-expand entries and a local edit mode.
// Edit mode lives entirely in the browser (localStorage). It never touches
// log.json on disk — when you're happy with your edits, hit "export log.json"
// in the edit panel and replace the file in your repo with the download.

document.getElementById('year').textContent = new Date().getFullYear();

if (location.protocol === 'file:') {
  const warning = document.createElement('div');
  warning.className = 'file-warning';
  warning.textContent = 'Opened as a local file — fetching data and saving edits won’t work reliably. Run "python3 -m http.server" in this folder and open http://localhost:8000 instead.';
  document.body.prepend(warning);
}

const STORAGE_NS = document.body.dataset.storage || 'log';
const FEED_URL = document.body.dataset.feed || 'log.json';
const LS_OVERRIDES = `po.wor:${STORAGE_NS}:overrides`;
const LS_DELETED = `po.wor:${STORAGE_NS}:deleted`;
const LS_EDIT_MODE = `po.wor:${STORAGE_NS}:editMode`;

let baseEntries = [];
let editingDate = null;

// ---------- storage helpers ----------

function loadOverrides() {
  try { return JSON.parse(localStorage.getItem(LS_OVERRIDES)) || {}; }
  catch { return {}; }
}
function saveOverrides(obj) {
  localStorage.setItem(LS_OVERRIDES, JSON.stringify(obj));
}
function loadDeleted() {
  try { return JSON.parse(localStorage.getItem(LS_DELETED)) || []; }
  catch { return []; }
}
function saveDeleted(arr) {
  localStorage.setItem(LS_DELETED, JSON.stringify(arr));
}

function parseDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

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

// ---------- merge base + local edits ----------

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

// ---------- render ----------

function renderFeed() {
  const el = document.getElementById('feed');
  const entries = computeEntries();

  if (entries.length === 0) {
    el.innerHTML = '<p class="feed-loading">no entries yet. use the developer icon in the corner to add one.</p>';
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
  row.appendChild(renderControls(entry));
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
      a.textContent = 'visit \u2192';
      detail.appendChild(a);
    }
    body.appendChild(detail);
  }

  article.appendChild(date);
  article.appendChild(body);

  if (hasDetail) {
    article.addEventListener('click', (e) => {
      if (document.body.classList.contains('edit-mode')) return;
      if (e.target.closest('.entry-controls') || e.target.closest('.entry-link')) return;
      article.classList.toggle('expanded');
    });
  }

  return article;
}

function renderControls(entry) {
  const wrap = document.createElement('div');
  wrap.className = 'entry-controls';

  const editBtn = iconButton('edit', 'Edit entry');
  editBtn.addEventListener('click', (e) => { e.stopPropagation(); startEdit(entry); });

  const delBtn = iconButton('delete', 'Delete entry');
  delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteEntry(entry.date); });

  wrap.appendChild(editBtn);
  wrap.appendChild(delBtn);
  return wrap;
}

function iconButton(kind, label) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'icon-btn';
  btn.setAttribute('aria-label', label);
  btn.title = label;
  const paths = {
    edit: '<path d="M13.5 4.5 16 7l-8 8-3 1 1-3 7.5-7.5Z"/>',
    delete: '<path d="M4 6h11M8 6V4.5A1 1 0 0 1 9 3.5h1A1 1 0 0 1 11 4.5V6M5.5 6 6 15.5A1 1 0 0 0 7 16.5h5A1 1 0 0 0 13 15.5L13.5 6"/>'
  };
  btn.innerHTML = `<svg viewBox="0 0 19 19" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${paths[kind]}</svg>`;
  return btn;
}

// ---------- edit mode ----------

function setEditMode(on) {
  document.body.classList.toggle('edit-mode', on);
  document.getElementById('edit-toggle').setAttribute('aria-pressed', String(on));
  localStorage.setItem(LS_EDIT_MODE, on ? '1' : '0');
  if (!on) cancelEdit();
}

function startEdit(entry) {
  editingDate = entry.date;
  document.getElementById('f-date').value = entry.date;
  document.getElementById('f-tag').value = entry.tag || '';
  document.getElementById('f-text').value = entry.text || '';
  document.getElementById('f-link').value = entry.link || '';
  document.getElementById('f-image').value = entry.image || '';
  document.getElementById('f-audio').value = entry.audio || entry.video || '';
  document.getElementById('f-detail').value = entry.detail || '';
  document.getElementById('f-add').textContent = 'save';
  document.getElementById('add-entry-panel').scrollIntoView({ block: 'nearest' });
}

function cancelEdit() {
  editingDate = null;
  ['f-date', 'f-tag', 'f-text', 'f-link', 'f-image', 'f-audio', 'f-detail'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('f-add').textContent = 'add';
  closeDatePicker();
}

function deleteEntry(date) {
  const overrides = loadOverrides();
  delete overrides[date];
  saveOverrides(overrides);
  const deleted = loadDeleted();
  if (!deleted.includes(date)) deleted.push(date);
  saveDeleted(deleted);
  renderFeed();
}

function saveEntryFromForm() {
  const date = document.getElementById('f-date').value.trim();
  const text = document.getElementById('f-text').value.trim();
  if (!date || !text) { alert('pick a date and enter a one-line text'); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { alert('pick the date from the calendar'); return; }

  const entry = { date, text };
  const tag = document.getElementById('f-tag').value.trim();
  const link = document.getElementById('f-link').value.trim();
  const image = document.getElementById('f-image').value.trim();
  const audio = document.getElementById('f-audio').value.trim();
  const detail = document.getElementById('f-detail').value.trim();
  if (tag) entry.tag = tag;
  if (link) entry.link = link;
  if (image) entry.image = image;
  if (audio) entry[STORAGE_NS === 'cinematic' ? 'video' : 'audio'] = audio;
  if (detail) entry.detail = detail;

  // if the date changed while editing, drop the old key first
  if (editingDate && editingDate !== date) {
    const overrides = loadOverrides();
    delete overrides[editingDate];
    saveOverrides(overrides);
    const deleted = loadDeleted();
    if (!deleted.includes(editingDate)) deleted.push(editingDate);
    saveDeleted(deleted);
  }

  const overrides = loadOverrides();
  overrides[date] = entry;
  saveOverrides(overrides);

  const deleted = loadDeleted().filter(d => d !== date);
  saveDeleted(deleted);

  cancelEdit();
  renderFeed();
}

// ---------- custom date picker ----------
// A native <input type="date"> can't be restyled, so the field is a
// plain readonly text input and this renders a small themed calendar
// dropdown instead, writing the same YYYY-MM-DD format back into it.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const dateField = document.getElementById('f-date');
const datePopover = document.getElementById('date-popover');
const dateLabel = document.getElementById('date-label');
const dateGrid = document.getElementById('date-grid');
let viewYear, viewMonth;

function isoDate(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function openDatePicker() {
  const current = /^\d{4}-\d{2}-\d{2}$/.test(dateField.value) ? parseDate(dateField.value) : new Date();
  viewYear = current.getFullYear();
  viewMonth = current.getMonth();
  renderCalendar();
  datePopover.hidden = false;
}

function closeDatePicker() {
  datePopover.hidden = true;
}

function renderCalendar() {
  dateLabel.textContent = `${MONTHS[viewMonth]} ${viewYear}`;
  dateGrid.innerHTML = '';

  const startOffset = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const today = isoDate(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  for (let i = 0; i < startOffset; i++) dateGrid.appendChild(document.createElement('span'));

  for (let day = 1; day <= daysInMonth; day++) {
    const iso = isoDate(viewYear, viewMonth, day);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'date-popover__day';
    btn.textContent = String(day);
    if (iso === today) btn.classList.add('is-today');
    if (iso === dateField.value) btn.classList.add('is-selected');
    btn.addEventListener('click', () => {
      dateField.value = iso;
      closeDatePicker();
    });
    dateGrid.appendChild(btn);
  }
}

dateField.addEventListener('click', () => {
  if (datePopover.hidden) openDatePicker(); else closeDatePicker();
});
document.getElementById('date-prev').addEventListener('click', () => {
  viewMonth--;
  if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  renderCalendar();
});
document.getElementById('date-next').addEventListener('click', () => {
  viewMonth++;
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  renderCalendar();
});
document.addEventListener('click', (e) => {
  if (!datePopover.hidden && !e.target.closest('.date-field')) closeDatePicker();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !datePopover.hidden) closeDatePicker();
});

// ---------- wire up ----------

document.getElementById('edit-toggle').addEventListener('click', () => {
  setEditMode(!document.body.classList.contains('edit-mode'));
});
document.getElementById('f-add').addEventListener('click', saveEntryFromForm);
document.getElementById('f-cancel').addEventListener('click', cancelEdit);

if (localStorage.getItem(LS_EDIT_MODE) === '1') setEditMode(true);

async function loadFeed() {
  const el = document.getElementById('feed');
  try {
    const res = await fetch(FEED_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    baseEntries = await res.json();
    renderFeed();
  } catch (err) {
    el.innerHTML = `<p class="feed-loading">couldn't load the log (${escapeHtml(err.message)}).</p>`;
  }
}

loadFeed();
