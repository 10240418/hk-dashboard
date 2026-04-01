/* ============================================================
   app.js — Main init, page routing, auto-refresh
   香港城市儀表板 v3 (全方位版)
   ============================================================ */

'use strict';

/* ── Bootstrap ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async function() {
  console.log('[HK Dashboard v4] Initialising…');

  // 1. Show home page
  showPage('home');

  // 2. Initial data load (parallel)
  await loadAllData();

  // 3. Start auto-refresh loop
  startAutoRefresh();

  // 4. Render bus preset slots
  initBusPresets();

  console.log('[HK Dashboard v4] Ready.');
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

/* ── Bus preset init ──────────────────────────────────────────── */
function initBusPresets() {
  const grid = document.getElementById('bus-presets-grid');
  if (!grid || typeof Bus === 'undefined') return;

  const presets = Bus.getPresets();
  grid.innerHTML = presets.map((p, i) => `
    <div class="card" style="padding:var(--sp-3)">
      <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-2)">
        <span class="tag ${p.operator === 'KMB' ? 'tag-red' : 'tag-green'}"
          style="font-size:10px;font-weight:700">${p.operator}</span>
        <span style="font-size:var(--text-sm);font-weight:600">${p.label}</span>
      </div>
      <div style="font-size:var(--text-xs);color:var(--text-faint);margin-bottom:var(--sp-2)">路線 ${p.route} ${p.hint}</div>
      <div id="bus-preset-${i}" class="row-list">
        <div class="skel skel-p"></div>
      </div>
    </div>
  `).join('');

  // Load data
  safeRun('Bus', () => Bus.refresh());
}

/* ── Auto-refresh ────────────────────────────────────────────── */
function startAutoRefresh() {
  // Refresh weather/health/environment every 60 seconds
  setInterval(async () => {
    await Promise.allSettled([
      safeRun('Weather',     () => Weather.refresh()),
      safeRun('Health',      () => Health.refresh()),
      safeRun('Environment', () => Environment.refresh()),
    ]);
  }, 60000);

  // Transport-specific refresh every 10 seconds
  setInterval(async () => {
    await safeRun('Transport', () => Transport.refresh());
  }, 10000);

  // Bus presets every 45 seconds
  setInterval(async () => {
    await safeRun('Bus', () => Bus.refresh());
  }, 45000);

  // Parking every 5 minutes
  setInterval(async () => {
    if (window._currentPage === 'parking') {
      await safeRun('Parking', () => Parking.refresh());
    }
  }, 300000);
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
      loadWeatherForecastText();
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
    case 'bus':
      // Only reload if presets are empty
      break;
    case 'tides':
      safeRun('Tides', () => Tides.refresh());
      break;
    case 'parking':
      // Only load on first visit
      if (!window._parkingLoaded) {
        window._parkingLoaded = true;
        safeRun('Parking', () => Parking.refresh());
      }
      break;
    case 'ferry':
      // Load on first visit
      if (!window._ferryLoaded) {
        window._ferryLoaded = true;
        safeRun('Ferry', () => Ferry.refresh());
      }
      break;
    case 'holidays':
      // Load on first visit
      if (!window._holidaysLoaded) {
        window._holidaysLoaded = true;
        safeRun('Holidays', () => Holidays.refresh());
      }
      break;
    case 'climate':
      // Load on first visit
      if (!window._climateLoaded) {
        window._climateLoaded = true;
        safeRun('Climate', () => Climate.refresh());
      }
      break;
    // CCTV: don't auto-load, let user choose cameras
  }
};

/* ── Load weather forecast text for weather page ─────────────── */
async function loadWeatherForecastText() {
  const cont = document.getElementById('w-flw-content');
  if (!cont) return;
  cont.innerHTML = `<div class="skel skel-p"></div><div class="skel skel-p" style="margin-top:8px"></div>`;
  try {
    const r = await fetch('https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=flw&lang=tc');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const { generalSituation, forecastDesc, outlook } = data;
    cont.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:var(--sp-4)">
        ${generalSituation ? `
          <div>
            <div style="font-size:var(--text-xs);color:var(--text-faint);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:var(--sp-2)">天氣概況 General Situation</div>
            <div style="font-size:var(--text-sm);line-height:1.7;color:var(--text-muted)">${generalSituation}</div>
          </div>
        ` : ''}
        ${forecastDesc ? `
          <div>
            <div style="font-size:var(--text-xs);color:var(--text-faint);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:var(--sp-2)">天氣預測 Forecast</div>
            <div style="font-size:var(--text-sm);line-height:1.7;color:var(--text-muted)">${forecastDesc}</div>
          </div>
        ` : ''}
        ${outlook ? `
          <div>
            <div style="font-size:var(--text-xs);color:var(--text-faint);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:var(--sp-2)">展望 Outlook</div>
            <div style="font-size:var(--text-sm);line-height:1.7;color:var(--text-muted)">${outlook}</div>
          </div>
        ` : ''}
      </div>
    `;
  } catch(e) {
    cont.innerHTML = `<div style="color:var(--error);font-size:var(--text-xs)">載入失敗：${e.message}</div>`;
  }
}

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

  setTimeout(updateIndicator, 2000);
  setInterval(updateIndicator, 60000);
})();
