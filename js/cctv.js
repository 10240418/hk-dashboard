/* ============================================================
   cctv.js — Traffic CCTV Snapshots (運輸署)
   香港城市儀表板 v2
   ============================================================ */

'use strict';

const CCTV_BASE = 'https://tdcctv.data.one.gov.hk/';

/* ── Track loaded cameras to avoid duplicates ───────────────── */
let loadedKeys = new Set();

/* ── Load a CCTV image card ─────────────────────────────────── */
window.loadCCTV = function(key, name) {
  key = key.trim().toUpperCase();
  if (!key) return;

  const grid = document.getElementById('cctv-grid');
  if (!grid) return;

  // Avoid duplicate
  if (loadedKeys.has(key)) {
    // Refresh existing image instead
    const existingImg = document.getElementById(`cctv-img-${key}`);
    if (existingImg) {
      existingImg.src = `${CCTV_BASE}${key}.JPG?t=${Date.now()}`;
    }
    return;
  }
  loadedKeys.add(key);

  const label = name || key;
  const imgUrl = `${CCTV_BASE}${key}.JPG`;
  const ts = new Date().toLocaleTimeString('zh-HK', { hour12: false });

  const card = document.createElement('div');
  card.id = `cctv-card-${key}`;
  card.style.cssText = 'background:var(--surface-2);border-radius:var(--r-lg);overflow:hidden;border:1px solid var(--border);position:relative';
  card.innerHTML = `
    <div style="background:var(--surface-3,var(--surface));padding:var(--sp-2) var(--sp-3);display:flex;justify-content:space-between;align-items:center">
      <div>
        <span style="font-size:var(--text-sm);font-weight:600">${escHtml(label)}</span>
        <span style="font-size:10px;color:var(--text-faint);margin-left:6px">${escHtml(key)}</span>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <span id="cctv-ts-${key}" style="font-size:10px;color:var(--text-faint)">${ts}</span>
        <button onclick="refreshCCTV('${key}')" title="重新整理" style="background:var(--primary);color:white;border-radius:var(--r-sm);padding:2px 8px;font-size:10px">↻</button>
        <button onclick="removeCCTV('${key}')" title="移除" style="background:var(--error-bg,rgba(200,50,50,.15));color:var(--error);border-radius:var(--r-sm);padding:2px 8px;font-size:10px">✕</button>
      </div>
    </div>
    <div id="cctv-wrap-${key}" style="position:relative;min-height:180px;background:#111">
      <div id="cctv-skel-${key}" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--text-faint);font-size:var(--text-xs)">載入中...</div>
      <img
        id="cctv-img-${key}"
        src="${imgUrl}?t=${Date.now()}"
        alt="${escHtml(label)}"
        style="width:100%;display:block;max-height:280px;object-fit:cover"
        onload="cctvImgLoaded('${key}')"
        onerror="cctvImgError('${key}')"
      >
    </div>
  `;
  grid.prepend(card);
};

/* ── Refresh a specific camera ───────────────────────────────── */
window.refreshCCTV = function(key) {
  const img = document.getElementById(`cctv-img-${key}`);
  const skel = document.getElementById(`cctv-skel-${key}`);
  const ts = document.getElementById(`cctv-ts-${key}`);
  if (!img) return;
  if (skel) { skel.textContent = '載入中...'; skel.style.display = 'flex'; }
  img.src = `${CCTV_BASE}${key}.JPG?t=${Date.now()}`;
  if (ts) ts.textContent = new Date().toLocaleTimeString('zh-HK', { hour12: false });
};

/* ── Remove a camera card ────────────────────────────────────── */
window.removeCCTV = function(key) {
  const card = document.getElementById(`cctv-card-${key}`);
  if (card) card.remove();
  loadedKeys.delete(key);
};

/* ── Image load/error callbacks ──────────────────────────────── */
window.cctvImgLoaded = function(key) {
  const skel = document.getElementById(`cctv-skel-${key}`);
  if (skel) skel.style.display = 'none';
};

window.cctvImgError = function(key) {
  const skel = document.getElementById(`cctv-skel-${key}`);
  if (skel) { skel.textContent = '影像不可用（攝影機代碼可能有誤）'; skel.style.display = 'flex'; }
  const img = document.getElementById(`cctv-img-${key}`);
  if (img) img.style.display = 'none';
};

/* ── Load from input field ───────────────────────────────────── */
window.loadCCTVInput = function() {
  const inp = document.getElementById('cctv-input');
  if (!inp) return;
  const val = inp.value.trim();
  if (!val) return;
  loadCCTV(val, val);
  inp.value = '';
};

/* ── Support Enter key in CCTV input ─────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('cctv-input');
  if (inp) {
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') loadCCTVInput();
    });
  }
});

/* ── Auto-refresh all loaded cameras every 60s ───────────────── */
setInterval(() => {
  if (window._currentPage === 'cctv') {
    loadedKeys.forEach(key => refreshCCTV(key));
  }
}, 60000);

/* ── Helper: escape HTML ─────────────────────────────────────── */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Public API ──────────────────────────────────────────────── */
window.CCTV = {
  loadCCTV: window.loadCCTV,
  refreshAll: function() {
    loadedKeys.forEach(key => refreshCCTV(key));
  }
};
