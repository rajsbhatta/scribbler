/* ═══════════════════════════════════════════════════════════
   THE SCRIBBLER'S ALMANAC — app.js
   IndexedDB storage, three-view app logic, PWA install
═══════════════════════════════════════════════════════════ */

'use strict';

/* ── State ─────────────────────────────────────────────── */
let db = null;
let currentStoryIndex = 0;
let quotes = [];
let pieces = [];
let activePieceId = null;
let activeTag = null;
let saveTimer = null;
let deferredInstallPrompt = null;
let clipText = '';
let clipAuthor = '';
let clipSource = '';

/* ── IndexedDB setup ───────────────────────────────────── */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('almanac', 1);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('quotes')) {
        d.createObjectStore('quotes', { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains('pieces')) {
        d.createObjectStore('pieces', { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains('prefs')) {
        d.createObjectStore('prefs', { keyPath: 'key' });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

function dbGetAll(store) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbPut(store, obj) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(obj);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function dbDelete(store, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getPref(key) {
  return new Promise(resolve => {
    const tx = db.transaction('prefs', 'readonly');
    const req = tx.objectStore('prefs').get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = () => resolve(null);
  });
}

async function setPref(key, value) {
  return dbPut('prefs', { key, value });
}

/* ── Boot ──────────────────────────────────────────────── */
async function boot() {
  db = await openDB();

  // Load data
  quotes = await dbGetAll('quotes');
  pieces = await dbGetAll('pieces');

  // Restore last story index
  const saved = await getPref('storyIndex');
  if (saved !== null) currentStoryIndex = saved;

  // Determine today's story by date if first visit today
  const lastDate = await getPref('lastDate');
  const today = todayStr();
  if (lastDate !== today) {
    // Advance to next story each new day
    const daysSinceEpoch = Math.floor(Date.now() / 86400000);
    currentStoryIndex = daysSinceEpoch % STORIES.length;
    await setPref('lastDate', today);
    await setPref('storyIndex', currentStoryIndex);
  }

  renderDispensary();
  renderQuotes();
  renderPiecesList();
  updateDispDate();

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

/* ── Utilities ─────────────────────────────────────────── */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

/* ── View switching ────────────────────────────────────── */
function showView(name) {
  // Views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');

  // Sidebar nav
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const si = document.getElementById('nav-' + name);
  if (si) si.classList.add('active');

  // Mobile nav
  document.querySelectorAll('.mob-btn').forEach(b => b.classList.remove('active'));
  const mi = document.getElementById('mob-' + name);
  if (mi) mi.classList.add('active');

  // Re-render as needed
  if (name === 'anthology') renderQuotes();
  if (name === 'atelier') renderPiecesList();
}

/* ══════════════════════════════════════════════════════════
   THE DISPENSARY
══════════════════════════════════════════════════════════ */

function updateDispDate() {
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('disp-date').textContent =
    new Date().toLocaleDateString('en-GB', opts);
}

function renderDispensary() {
  const story = STORIES[currentStoryIndex];
  const area = document.getElementById('reading-area');

  const paras = story.paragraphs.map((p, i) =>
    `<p class="${i === 0 ? 'drop' : ''}">${p}</p>`
  ).join('');

  area.innerHTML = `
    <div class="story-genre-row">
      <span class="story-genre">${story.genre}</span>
      <span class="genre-line"></span>
      <span class="story-genre" style="letter-spacing:0.12em;color:var(--sepia-light)">${story.year}</span>
    </div>
    <h1 class="story-title">${story.title}</h1>
    <div class="story-author">— ${story.author}</div>
    <div class="story-body" id="story-body">${paras}</div>
    <div class="story-divider">· · ·</div>
    <div class="prompt-box">
      <div class="prompt-label">Writing Prompt</div>
      <div class="prompt-text">${story.prompt}</div>
      <button class="prompt-use-btn" onclick="usePrompt()">Use this prompt →</button>
    </div>
  `;

  // Attach selection listener for clipping
  const body = document.getElementById('story-body');
  body.addEventListener('mouseup', onTextSelect);
  body.addEventListener('touchend', onTextSelect);
}

function stepStory(dir) {
  currentStoryIndex = (currentStoryIndex + dir + STORIES.length) % STORIES.length;
  setPref('storyIndex', currentStoryIndex);
  renderDispensary();
  document.getElementById('view-dispensary').scrollTop = 0;
}

function usePrompt() {
  const story = STORIES[currentStoryIndex];
  newPiece(story.prompt, story.title);
  showView('atelier');
  toast('Prompt loaded in the Atelier ✒');
}

/* ── Clip tooltip ──────────────────────────────────────── */
function onTextSelect(e) {
  setTimeout(() => {
    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : '';
    if (text.length < 10) {
      hideClipTip();
      return;
    }
    clipText = text;
    clipAuthor = STORIES[currentStoryIndex].author;
    clipSource = STORIES[currentStoryIndex].title;

    const tip = document.getElementById('clip-tip');
    const range = sel.getRangeAt(0).getBoundingClientRect();
    tip.style.left = (range.left + range.width / 2) + 'px';
    tip.style.top = (range.top + window.scrollY - 44) + 'px';
    tip.style.display = 'block';
  }, 10);
}

function hideClipTip() {
  document.getElementById('clip-tip').style.display = 'none';
}

async function clipSelection() {
  if (!clipText) return;
  hideClipTip();
  window.getSelection()?.removeAllRanges();

  const quote = {
    id: uid(),
    text: clipText,
    author: clipAuthor,
    source: clipSource,
    tags: [STORIES[currentStoryIndex].genre],
    createdAt: Date.now()
  };

  quotes.unshift(quote);
  await dbPut('quotes', quote);
  renderQuotes();
  toast('Clipped to your Anthology ❧');
  clipText = '';
}

// Hide clip tip on click elsewhere
document.addEventListener('mousedown', e => {
  if (e.target.id !== 'clip-tip') hideClipTip();
});

/* ══════════════════════════════════════════════════════════
   THE ANTHOLOGY
══════════════════════════════════════════════════════════ */

function renderQuotes() {
  const query = (document.getElementById('search-input')?.value || '').toLowerCase();
  const list = document.getElementById('quotes-list');
  const countEl = document.getElementById('quote-count');

  // Build tag set
  const allTags = [...new Set(quotes.flatMap(q => q.tags || []))].sort();
  renderTagRow(allTags);

  // Filter
  let filtered = quotes.filter(q => {
    const matchTag = !activeTag || (q.tags || []).includes(activeTag);
    const matchQuery = !query ||
      q.text.toLowerCase().includes(query) ||
      (q.author || '').toLowerCase().includes(query) ||
      (q.source || '').toLowerCase().includes(query);
    return matchTag && matchQuery;
  });

  countEl.textContent = quotes.length === 1 ? '1 fragment' : `${quotes.length} fragments`;

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">❧</div>
        <p>${quotes.length === 0
          ? 'Your anthology is empty. Highlight text while reading to clip passages, or add fragments manually.'
          : 'No fragments match your search.'
        }</p>
      </div>`;
    return;
  }

  list.innerHTML = filtered.map(q => {
    const tags = (q.tags || []).map(t => `<span class="q-tag">${t}</span>`).join('');
    return `
      <div class="quote-card">
        <div class="quote-text">${escHtml(q.text)}</div>
        <div class="quote-footer">
          <span class="quote-source">${escHtml(q.author || '')}${q.source ? ' · ' + escHtml(q.source) : ''}</span>
          <div class="quote-right">
            <div class="quote-tags">${tags}</div>
            <button class="q-del" onclick="deleteQuote('${q.id}')" title="Delete">✕</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

function renderTagRow(tags) {
  const row = document.getElementById('tag-row');
  if (!row) return;
  if (tags.length === 0) { row.innerHTML = ''; return; }

  row.innerHTML = tags.map(t =>
    `<button class="tag-chip ${activeTag === t ? 'on' : ''}" onclick="toggleTag('${t}')">${t}</button>`
  ).join('');
}

function toggleTag(tag) {
  activeTag = activeTag === tag ? null : tag;
  renderQuotes();
}

function openAddQuote() {
  document.getElementById('m-text').value = '';
  document.getElementById('m-author').value = '';
  document.getElementById('m-source').value = '';
  document.getElementById('m-tags').value = '';
  openModal('modal-add');
  setTimeout(() => document.getElementById('m-text').focus(), 100);
}

async function saveQuote() {
  const text = document.getElementById('m-text').value.trim();
  if (!text) { toast('Please enter some text'); return; }

  const tags = document.getElementById('m-tags').value
    .split(',').map(t => t.trim()).filter(Boolean);

  const quote = {
    id: uid(),
    text,
    author: document.getElementById('m-author').value.trim(),
    source: document.getElementById('m-source').value.trim(),
    tags,
    createdAt: Date.now()
  };

  quotes.unshift(quote);
  await dbPut('quotes', quote);
  renderQuotes();
  closeModal('modal-add');
  toast('Fragment preserved ❧');
}

async function deleteQuote(id) {
  quotes = quotes.filter(q => q.id !== id);
  await dbDelete('quotes', id);
  renderQuotes();
  toast('Fragment removed');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ══════════════════════════════════════════════════════════
   THE ATELIER
══════════════════════════════════════════════════════════ */

function renderPiecesList() {
  const list = document.getElementById('pieces-list');
  if (!list) return;

  if (pieces.length === 0) {
    list.innerHTML = `
      <div style="padding:24px 18px;font-family:var(--body);font-size:13px;
        font-style:italic;color:var(--sepia-light);line-height:1.6;">
        No pieces yet.<br>Press + to begin writing.
      </div>`;
    return;
  }

  // Sort newest first
  const sorted = [...pieces].sort((a, b) => b.updatedAt - a.updatedAt);

  list.innerHTML = sorted.map(p => {
    const statusClass = { Draft: 's-draft', Complete: 's-complete', Fragment: 's-fragment' }[p.status] || 's-draft';
    const words = p.content ? p.content.trim().split(/\s+/).filter(Boolean).length : 0;
    return `
      <div class="piece-row ${activePieceId === p.id ? 'active' : ''}" onclick="openPiece('${p.id}')">
        <div class="piece-row-title">${escHtml(p.title || 'Untitled')}</div>
        <div class="piece-row-meta">
          <span>${words} words</span>
          <span class="status-pill ${statusClass}">${p.status || 'Draft'}</span>
        </div>
      </div>`;
  }).join('');
}

function newPiece(content = '', sourceTitle = '') {
  const piece = {
    id: uid(),
    title: sourceTitle ? `Inspired by: ${sourceTitle}` : 'Untitled',
    content,
    status: 'Draft',
    genre: '',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  pieces.unshift(piece);
  dbPut('pieces', piece);
  openPiece(piece.id);
  renderPiecesList();
}

function openPiece(id) {
  activePieceId = id;
  const piece = pieces.find(p => p.id === id);
  if (!piece) return;

  document.getElementById('ed-title').value = piece.title || '';
  document.getElementById('ed-status').value = piece.status || 'Draft';
  document.getElementById('ed-genre').value = piece.genre || '';
  document.getElementById('ed-text').value = piece.content || '';
  document.getElementById('ed-text').style.display = 'block';
  document.getElementById('ed-placeholder').style.display = 'none';

  updateEditorFooter(piece);
  renderPiecesList();
  document.getElementById('ed-text').focus();
}

function updateEditorFooter(piece) {
  const content = document.getElementById('ed-text').value;
  const words = content.trim() ? content.trim().split(/\s+/).filter(Boolean).length : 0;
  document.getElementById('ed-words').textContent = `${words} words`;
  document.getElementById('ed-date').textContent = piece
    ? new Date(piece.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
}

function autoSave() {
  if (!activePieceId) return;

  // Debounce 800ms
  clearTimeout(saveTimer);
  document.getElementById('ed-saved').textContent = 'saving…';

  saveTimer = setTimeout(async () => {
    const piece = pieces.find(p => p.id === activePieceId);
    if (!piece) return;

    piece.title   = document.getElementById('ed-title').value.trim() || 'Untitled';
    piece.content = document.getElementById('ed-text').value;
    piece.status  = document.getElementById('ed-status').value;
    piece.genre   = document.getElementById('ed-genre').value.trim();
    piece.updatedAt = Date.now();

    await dbPut('pieces', piece);
    document.getElementById('ed-saved').textContent = 'Saved ✓';
    updateEditorFooter(piece);
    renderPiecesList();

    setTimeout(() => {
      if (document.getElementById('ed-saved').textContent === 'Saved ✓') {
        document.getElementById('ed-saved').textContent = '—';
      }
    }, 2000);
  }, 800);
}

async function deletePiece() {
  if (!activePieceId) return;
  const piece = pieces.find(p => p.id === activePieceId);
  const name = piece ? (piece.title || 'Untitled') : 'this piece';
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

  pieces = pieces.filter(p => p.id !== activePieceId);
  await dbDelete('pieces', activePieceId);
  activePieceId = null;

  document.getElementById('ed-text').style.display = 'none';
  document.getElementById('ed-placeholder').style.display = 'flex';
  document.getElementById('ed-title').value = '';
  document.getElementById('ed-status').value = 'Draft';
  document.getElementById('ed-genre').value = '';
  document.getElementById('ed-words').textContent = '0 words';
  document.getElementById('ed-saved').textContent = '—';
  document.getElementById('ed-date').textContent = '—';

  renderPiecesList();
  toast('Piece deleted');
}

/* ══════════════════════════════════════════════════════════
   EXPORT / IMPORT
══════════════════════════════════════════════════════════ */

function exportData() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    quotes,
    pieces
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `almanac-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Backup exported ↑');
}

function triggerImport() {
  document.getElementById('import-file').click();
}

async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.quotes || !data.pieces) throw new Error('Invalid backup file');

    if (!confirm(`Import ${data.quotes.length} fragments and ${data.pieces.length} pieces? Existing data will be merged.`)) return;

    // Merge quotes
    for (const q of data.quotes) {
      if (!quotes.find(x => x.id === q.id)) {
        quotes.push(q);
        await dbPut('quotes', q);
      }
    }

    // Merge pieces
    for (const p of data.pieces) {
      if (!pieces.find(x => x.id === p.id)) {
        pieces.push(p);
        await dbPut('pieces', p);
      }
    }

    renderQuotes();
    renderPiecesList();
    toast(`Imported ${data.quotes.length} fragments & ${data.pieces.length} pieces ↓`);
  } catch (e) {
    toast('Import failed — invalid file');
  }
  event.target.value = '';
}

/* ══════════════════════════════════════════════════════════
   PWA INSTALL
══════════════════════════════════════════════════════════ */

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  // Show banner after 3 seconds
  setTimeout(() => {
    document.getElementById('install-banner').style.display = 'block';
  }, 3000);
});

function installPWA() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  deferredInstallPrompt.userChoice.then(() => {
    deferredInstallPrompt = null;
    document.getElementById('install-banner').style.display = 'none';
  });
}

window.addEventListener('appinstalled', () => {
  document.getElementById('install-banner').style.display = 'none';
  toast('Almanac installed ✦');
});

/* ══════════════════════════════════════════════════════════
   KEYBOARD SHORTCUTS
══════════════════════════════════════════════════════════ */

document.addEventListener('keydown', e => {
  // Escape closes modals
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-bg.open').forEach(m => m.classList.remove('open'));
    hideClipTip();
  }
  // Ctrl/Cmd+Shift+1/2/3 to switch views
  if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
    if (e.key === '1') { e.preventDefault(); showView('dispensary'); }
    if (e.key === '2') { e.preventDefault(); showView('anthology'); }
    if (e.key === '3') { e.preventDefault(); showView('atelier'); }
  }
});

/* ══════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', boot);
