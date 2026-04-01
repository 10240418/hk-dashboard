/* ============================================================
   core.js — Theme, Clock, Lunar Date, Navigation
   香港城市儀表板 v2
   ============================================================ */

'use strict';

/* ── Theme (in-memory, no browser storage) ──────────── */
window._hkdbTheme = 'dark';

(function initTheme() {
  document.documentElement.setAttribute('data-theme', window._hkdbTheme);
  const btn = document.querySelector('[data-theme-toggle]');
  if (!btn) return;
  btn.addEventListener('click', function() {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    window._hkdbTheme = next;
  });
})();

/* ── Clock ──────────────────────────────────────────────── */
function updateClock() {
  const now = new Date();
  const hms = document.getElementById('clockHMS');
  const date = document.getElementById('clockDate');
  if (hms) {
    hms.textContent = now.toLocaleTimeString('zh-HK', { hour12: false });
  }
  if (date) {
    const d = now.toLocaleDateString('zh-HK', {
      weekday: 'short', year: 'numeric', month: 'long', day: 'numeric'
    });
    date.textContent = d;
  }
}
updateClock();
setInterval(updateClock, 1000);

/* ── Lunar Date ─────────────────────────────────────────── */
async function loadLunarDate() {
  const chip = document.getElementById('lunarChip');
  if (!chip) return;
  try {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const url = `https://data.weather.gov.hk/weatherAPI/opendata/lunardate.php?date=${y}${m}${d}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('lunar fetch failed');
    const data = await res.json();
    // API returns: { LunarYear, LunarDate, LunarMonth }  (or similar fields)
    const ly = data.LunarYear || data.lunarYear || '';
    const lm = data.LunarMonth || data.lunarMonth || '';
    const ld = data.LunarDate || data.lunarDate || '';
    if (ld) {
      chip.textContent = `農曆${ly} ${lm}${ld}`;
    } else {
      // Try alternate field structure
      const keys = Object.keys(data);
      const raw = keys.length > 0 ? Object.values(data).join(' ') : '';
      chip.textContent = raw ? `農曆 ${raw}` : '農曆';
    }
  } catch (e) {
    const chip2 = document.getElementById('lunarChip');
    if (chip2) chip2.textContent = '農曆';
  }
}
loadLunarDate();

/* ── Navigation ─────────────────────────────────────────── */
function showPage(name) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  // Deactivate all tabs
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  // Show target page
  const page = document.getElementById(`page-${name}`);
  if (page) page.classList.add('active');
  // Activate tab
  const tab = document.querySelector(`.nav-tab[data-page="${name}"]`);
  if (tab) tab.classList.add('active');
  // Track current page globally for refresh logic
  window._currentPage = name;
}

// Expose globally
window.showPage = showPage;

/* ── Skeleton helpers ────────────────────────────────────── */
window.skelHtml = (rows = 3) =>
  Array.from({ length: rows }, (_, i) =>
    `<div class="skel skel-p" style="margin-top:${i ? '6px' : '0'}"></div>`
  ).join('');

/* ── AQHI colour helper ──────────────────────────────────── */
window.aqhiClass = function(val) {
  const n = parseInt(val, 10);
  if (isNaN(n)) return 'tag-muted';
  if (n <= 3)  return 'tag-green';
  if (n <= 6)  return 'tag-yellow';
  if (n <= 7)  return 'tag-red';
  return 'tag-red'; // 8–10+
};

window.aqhiLabel = function(val) {
  const n = parseInt(val, 10);
  if (isNaN(n)) return '';
  if (n <= 3)  return '低';
  if (n <= 6)  return '中';
  if (n <= 7)  return '高';
  if (n <= 10) return '甚高';
  return '嚴重';
};

/* ── AED wait time colour ────────────────────────────────── */
window.aedClass = function(mins) {
  const n = parseInt(mins, 10);
  if (isNaN(n) || mins === '' || mins === null) return 'tag-muted';
  if (n <= 30) return 'tag-green';
  if (n <= 60) return 'tag-yellow';
  return 'tag-red';
};
