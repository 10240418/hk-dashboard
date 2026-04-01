/* ============================================================
   weather.js — HKO Real-time Weather, Forecast, Rainfall, Temps
   香港城市儀表板 v2
   ============================================================ */

'use strict';

const WX_BASE = 'https://data.weather.gov.hk/weatherAPI/opendata/weather.php';
const ICON_BASE = 'https://www.hko.gov.hk/images/HKOWxIconOutline/pic';

/* ── Weather icon description map ─────────────────────────── */
const WX_DESC = {
  50:'晴天', 51:'間有陽光', 52:'短暫陽光', 53:'多雲', 54:'多雲幾陣雨',
  60:'陰天', 61:'陰天有驟雨', 62:'雷暴', 63:'陰天驟雨雷暴', 64:'霧',
  65:'微風', 70:'天色良好', 71:'天色良好', 72:'天色良好', 73:'天色良好',
  74:'天色良好', 75:'天色良好', 76:'天色良好', 77:'天色良好',
  80:'大驟雨', 81:'驟雨', 82:'短暫時間有雨', 83:'有雨', 84:'傾盆大雨',
  85:'有驟雨', 86:'有驟雨', 87:'雷暴', 88:'雷暴', 89:'龍捲風',
  90:'熱帶氣旋', 91:'強烈季候風信號', 92:'偶有陽光', 93:'多雲', 94:'天色大致良好'
};

/* ── Fetch current weather (rhrread) ────────────────────────── */
async function fetchCurrentWeather() {
  try {
    const url = `${WX_BASE}?dataType=rhrread&lang=tc`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    renderCurrentWeather(d);
    renderHomeWeather(d);
  } catch (e) {
    console.error('Weather fetch error:', e);
    showWeatherError();
  }
}

function renderCurrentWeather(d) {
  // Temperature — use first station
  const temps = d.temperature?.data || [];
  const main = temps.find(t => t.place === '香港天文台') || temps[0] || {};
  setEl('w-temp', main.value ?? '--');
  setEl('h-temp', main.value ?? '--');

  // Humidity
  const hum = d.humidity?.data?.[0]?.value ?? '--';
  setEl('w-hum', hum + (hum !== '--' ? '%' : ''));
  setEl('h-hum', hum);

  // Icon + description
  const iconCode = d.icon?.[0];
  const iconUrl = iconCode ? `${ICON_BASE}${iconCode}.png` : '';
  const desc = WX_DESC[iconCode] || d.weatherMain?.[0]?.text || '天氣資料';
  setImgSrc('w-icon', iconUrl);
  setEl('w-desc', desc);
  setImgSrc('h-wicon', iconUrl);
  setEl('h-wdesc', desc);

  // UV
  const uvArr = d.uvindex?.data || [];
  const uvVal = uvArr[0]?.value ?? '--';
  const uvDesc = uvArr[0]?.desc || '';
  setEl('w-uv', uvVal + (uvVal !== '--' ? ` (${uvDesc})` : ''));
  setEl('h-uv', uvVal);
  setEl('h-uvd', uvDesc ? `紫外線 ${uvDesc}` : '紫外線指數');

  // Sea temp (comes from forecast, not rhrread — set placeholder)
  // Updated by fetchForecast()

  // Update time
  const upd = d.temperature?.recordTime || '';
  setEl('w-upd', upd ? `更新: ${upd}` : '');
  setEl('h-wtime', upd ? upd.replace('T', ' ').replace('Z', '') : '');

  // Warnings
  const warnArr = d.warningMessage || [];
  const warnText = Array.isArray(warnArr) ? warnArr.join(' ') : warnArr;
  const hWarn = document.getElementById('h-warn');
  const hWarnText = document.getElementById('h-warn-text');
  const wWarnWrap = document.getElementById('w-warn-wrap');
  const wWarn = document.getElementById('w-warn');
  if (warnText && warnText.trim()) {
    if (hWarn) hWarn.classList.remove('hidden');
    if (hWarnText) hWarnText.textContent = warnText;
    if (wWarnWrap) wWarnWrap.style.display = '';
    if (wWarn) wWarn.textContent = warnText;
  } else {
    if (hWarn) hWarn.classList.add('hidden');
    if (wWarnWrap) wWarnWrap.style.display = 'none';
  }

  // Rainfall all districts
  const rain = d.rainfall?.data || [];
  renderRainfall(rain, 'h-rain');
  renderRainfall(rain, 'w-rain');

  // Temperature stations
  renderTemps(temps, 'h-temps');
  renderTemps(temps, 'w-temps');
}

function renderHomeWeather(d) {
  // Already handled inside renderCurrentWeather
}

function renderRainfall(rain, elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!rain.length) {
    el.innerHTML = '<div style="color:var(--text-faint);font-size:var(--text-sm)">暫無降雨數據</div>';
    return;
  }
  el.innerHTML = rain.map(r => {
    const mm = r.max ?? r.value ?? 0;
    const hasRain = mm > 0;
    return `<div class="row-item" style="flex-direction:column;align-items:flex-start;gap:2px">
      <span style="font-size:var(--text-xs);color:var(--text-muted)">${r.place}</span>
      <span style="font-weight:600;color:${hasRain ? 'var(--info)' : 'var(--text-faint)'}">${mm} <span style="font-size:10px;font-weight:400">mm</span></span>
    </div>`;
  }).join('');
}

function renderTemps(temps, elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!temps.length) return;
  el.innerHTML = temps.map(t => {
    const val = t.value ?? '--';
    return `<div class="row-item" style="flex-direction:column;align-items:flex-start;gap:2px">
      <span style="font-size:var(--text-xs);color:var(--text-muted)">${t.place}</span>
      <span style="font-weight:600">${val}<span style="font-size:10px;color:var(--text-faint)"> °C</span></span>
    </div>`;
  }).join('');
}

/* ── Fetch 9-day forecast ───────────────────────────────────── */
async function fetchForecast() {
  try {
    const url = `${WX_BASE}?dataType=fnd&lang=tc`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    renderForecast(d);

    // Sea temp from forecast seaTemp field
    const seaTemp = d.seaTemp?.value ?? d.weatherForecast?.[0]?.FSeaTemp ?? '--';
    setEl('w-sea', seaTemp !== '--' ? `${seaTemp}°C` : '--');
    setEl('h-sea', seaTemp !== '--' ? seaTemp : '--');

    // General situation
    const gen = d.generalSituation || '';
    setEl('w-general', gen);
  } catch (e) {
    console.error('Forecast fetch error:', e);
  }
}

function renderForecast(d) {
  const days = d.weatherForecast || [];

  // API uses camelCase: forecastDate, week, forecastMaxtemp, forecastMintemp, ForecastIcon, PSR
  // Home forecast (scroll row, compact)
  const hForecast = document.getElementById('h-forecast');
  if (hForecast) {
    hForecast.innerHTML = days.slice(0, 9).map(day => {
      const iconCode = day.ForecastIcon;
      const iconUrl = iconCode ? `${ICON_BASE}${iconCode}.png` : '';
      const hi = day.forecastMaxtemp?.value ?? '--';
      const lo = day.forecastMintemp?.value ?? '--';
      const rawDate = day.forecastDate || '';
      const dateStr = rawDate ? `${rawDate.slice(4,6)}/${rawDate.slice(6,8)}` : '';
      const dow = day.week || '';
      return `<div class="forecast-chip">
        <div class="fc-date">${dateStr}</div>
        <div class="fc-dow" style="font-size:9px;color:var(--text-faint)">${dow}</div>
        ${iconUrl ? `<img src="${iconUrl}" class="fc-icon" alt="" onerror="this.style.display='none'">` : '<div class="fc-icon" style="width:32px;height:32px"></div>'}
        <div class="fc-temps"><span class="fc-hi">${hi !== '--' ? hi + '°' : '--'}</span><span class="fc-lo">${lo !== '--' ? lo + '°' : '--'}</span></div>
      </div>`;
    }).join('');
  }

  // Weather page forecast (larger)
  const wForecast = document.getElementById('w-forecast9');
  if (wForecast) {
    wForecast.innerHTML = days.slice(0, 9).map(day => {
      const iconCode = day.ForecastIcon;
      const iconUrl = iconCode ? `${ICON_BASE}${iconCode}.png` : '';
      const hi = day.forecastMaxtemp?.value ?? '--';
      const lo = day.forecastMintemp?.value ?? '--';
      const psr = day.PSR || '';  // Probability of Significant Rain
      const rawDate = day.forecastDate || '';
      const dateStr = rawDate ? `${rawDate.slice(4,6)}/${rawDate.slice(6,8)}` : '';
      const dow = day.week || '';
      const weather = day.forecastWeather || '';
      return `<div class="forecast-chip" style="min-width:90px">
        <div class="fc-date">${dateStr}</div>
        <div class="fc-dow" style="font-size:9px;color:var(--text-faint)">${dow}</div>
        ${iconUrl ? `<img src="${iconUrl}" class="fc-icon" alt="" onerror="this.style.display='none'">` : '<div class="fc-icon" style="width:32px;height:32px"></div>'}
        <div class="fc-temps"><span class="fc-hi">${hi !== '--' ? hi + '°' : '--'}</span><span class="fc-lo">${lo !== '--' ? lo + '°' : '--'}</span></div>
        ${psr ? `<div style="font-size:9px;color:var(--info);margin-top:2px" title="${weather}">☔${psr}</div>` : ''}
      </div>`;
    }).join('');
  }
}

function showWeatherError() {
  setEl('h-wdesc', '無法載入天氣資料');
  setEl('w-desc', '無法載入天氣資料');
}

/* ── DOM helpers ────────────────────────────────────────────── */
function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function setImgSrc(id, src) {
  const el = document.getElementById(id);
  if (el) {
    el.src = src;
    el.style.display = src ? '' : 'none';
  }
}

/* ── Public API ─────────────────────────────────────────────── */
window.Weather = {
  fetchCurrent: fetchCurrentWeather,
  fetchForecast: fetchForecast,
  fetchWarnsum: fetchWarnsum,
  refresh: async function() {
    await Promise.all([fetchCurrentWeather(), fetchForecast(), fetchWarnsum()]);
  }
};

/* ── Fetch weather warning summary (warnsum) ─────────────────── */
async function fetchWarnsum() {
  try {
    const url = `${WX_BASE}?dataType=warnsum&lang=tc`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // warnsum returns {} when no active warnings — check explicitly
    if (!data || Object.keys(data).length === 0) {
      renderWarnsum(null);
      return;
    }
    renderWarnsum(data);
    // Fetch detailed warningInfo if there are active warnings
    await fetchWarningInfo();
  } catch(e) {
    console.error('Warnsum fetch error:', e);
  }
}

/* ── Fetch warning info detail (warningInfo) ─────────────────── */
async function fetchWarningInfo() {
  try {
    const url = `${WX_BASE}?dataType=warningInfo&lang=tc`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    const details = data.details || [];
    renderWarningInfo(details);
  } catch(e) {
    console.error('WarningInfo fetch error:', e);
  }
}

/* ── Render warnsum ──────────────────────────────────────────── */
function renderWarnsum(data) {
  const el = document.getElementById('w-warnsum');
  if (!el) return;
  if (!data || Object.keys(data).length === 0) {
    el.innerHTML = `<div class="row-item"><span style="color:var(--success)">✅ 目前沒有生效的天氣警告 No active warnings</span></div>`;
    return;
  }
  const warnings = Object.values(data);
  el.innerHTML = warnings.map(w => {
    const name = w.name || w.type || '警告';
    const code = w.code || '';
    const issueTime = w.issueTime || '';
    const actionCode = w.actionCode || '';
    const tagClass = actionCode === 'ISSUE' ? 'tag-red' : actionCode === 'UPDATE' ? 'tag-yellow' : 'tag-muted';
    return `
      <div class="row-item" style="flex-direction:column;align-items:flex-start;gap:4px">
        <div style="display:flex;align-items:center;gap:var(--sp-2)">
          <span class="tag ${tagClass}">${code || actionCode}</span>
          <span style="font-weight:600;font-size:var(--text-sm)">${name}</span>
        </div>
        ${issueTime ? `<div style="font-size:var(--text-xs);color:var(--text-faint)">發布時間 ${issueTime}</div>` : ''}
      </div>
    `;
  }).join('');
}

/* ── Render warningInfo details ─────────────────────────────── */
function renderWarningInfo(details) {
  const el = document.getElementById('w-warning-details');
  if (!el || !details.length) return;
  el.innerHTML = details.map(d => {
    const contents = d.contents || [];
    return `
      <div class="card" style="border-color:var(--warning);margin-top:var(--sp-3)">
        <div style="font-weight:700;color:var(--warning);margin-bottom:var(--sp-2)">${d.warningStatementCode || d.subtype || '警告'}</div>
        ${contents.map(c => {
          const lines = c.value || [];
          return lines.map(line => `<div style="font-size:var(--text-sm);color:var(--text-muted);line-height:1.6;margin-bottom:4px">${line}</div>`).join('');
        }).join('')}
      </div>
    `;
  }).join('');
}
