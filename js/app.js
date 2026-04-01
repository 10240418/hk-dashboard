/* ============================================================
   app.js — Main init, page routing, auto-refresh
   香港城市儀表板 v2
   ============================================================ */

'use strict';

/* ── Bootstrap ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async function() {
  console.log('[HK Dashboard v2] Initialising…');

  // 1. Show home page
  showPage('home');

  // 2. Initial data load (parallel)
  await loadAllData();

  // 3. Start auto-refresh loop
  startAutoRefresh();

  console.log('[HK Dashboard v2] Ready.');
});

/* ── Load all data ─────────────────────────────────────────────── */
async function loadAllData() {
  await Promise.allSettled([
    safeRun('Weather',      () => Weather.refresh()),
    safeRun('Transport',    () => Transport.refresh()),
    safeRun('Health',       () => Health.refresh()),
    safeRun('Environment',  () => Environment.refresh()),
  ]);
}

/* ── Auto-refresh ────────────────────────────────────────────── */
function startAutoRefresh() {
  // Refresh everything every 60 seconds
  setInterval(async () => {
    const page = window._currentPage || 'home';
    await Promise.allSettled([
      safeRun('Weather',     () => Weather.refresh()),
      safeRun('Health',      () => Health.refresh()),
      safeRun('Environment', () => Environment.refresh()),
      // Transport refreshes faster (every 10 seconds via its own timer)
    ]);
  }, 60000);

  // Transport-specific refresh every 10 seconds
  setInterval(async () => {
    await safeRun('Transport', () => Transport.refresh());
  }, 10000);
}

/* ── Safe run wrapper ────────────────────────────────────────── */
async function safeRun(label, fn) {
  try {
    await fn();
  } catch (e) {
    console.error(`[${label}] refresh error:`, e);
  }
}

/* ── Page change hook ────────────────────────────────────────── */
const _origShowPage = window.showPage;
window.showPage = function(name) {
  _origShowPage(name);
  // Trigger immediate refresh for the newly visible page
  switch (name) {
    case 'weather':
      safeRun('Weather', () => Weather.refresh());
      break;
    case 'transport':
      safeRun('Transport', () => Transport.refresh());
      break;
    case 'health':
      safeRun('Health', () => Health.refresh());
      break;
    case 'environment':
      safeRun('Environment', () => Environment.refresh());
      break;
    // CCTV: don't auto-load, let user choose cameras
  }
};

/* ── Refresh indicator in footer ─────────────────────────────── */
(function initRefreshIndicator() {
  const footer = document.querySelector('.footer-inner');
  if (!footer) return;
  const div = document.createElement('div');
  div.id = 'footer-refresh';
  div.style.cssText = 'font-size:10px;color:var(--text-faint)';
  div.textContent = `載入中…`;
  footer.appendChild(div);

  function updateIndicator() {
    const now = new Date().toLocaleTimeString('zh-HK', { hour12: false });
    const el = document.getElementById('footer-refresh');
    if (el) el.textContent = `最後更新 Last updated: ${now}`;
  }

  // Update once on load + every minute
  setTimeout(updateIndicator, 2000);
  setInterval(updateIndicator, 60000);
})();
