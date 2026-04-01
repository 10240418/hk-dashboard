/* ============================================================
   bus.js — 巴士到站時間 Bus ETA
   Hong Kong City Dashboard — Complete UX Rewrite
   支援：KMB 九巴 / CTB 城巴 / GMB 專線小巴
   ============================================================ */

'use strict';

/* ══ PRESET STOPS ═══════════════════════════════════════════ */
const PRESET_STOPS = [
  { operator:'KMB', id:'B3B0EF2BC688751D', label:'屯門市中心總站', route:'60X', serviceType:1, hint:'往旺角/高鐵' },
  { operator:'KMB', id:'77FB32597CCD30F5', label:'兆康苑總站',     route:'67X', serviceType:1, hint:'往旺角' },
  { operator:'KMB', id:'45C39BB56C6B333C', label:'大興總站',       route:'66M', serviceType:1, hint:'往元朗' },
  { operator:'KMB', id:'507A1E5DF62D2B4A', label:'天瑞總站',       route:'69X', serviceType:1, hint:'往沙田' },
  { operator:'CTB', id:'001939',           label:'龍門居',         route:'962X', hint:'往銅鑼灣' },
];

/* ══ CACHE ══════════════════════════════════════════════════ */
const _stopCache = {};

/* ══ FORMAT ETA ═════════════════════════════════════════════ */
function fmtEta(iso, rmk) {
  if (!iso) {
    return rmk
      ? `<span style="font-size:11px;color:var(--text-faint)">${rmk}</span>`
      : `<span style="font-size:12px;color:var(--text-faint)">—</span>`;
  }
  try {
    const d    = new Date(iso);
    const diff = Math.round((d - new Date()) / 60000);
    const t    = d.toLocaleTimeString('zh-HK', { hour:'2-digit', minute:'2-digit', hour12:false });
    if (diff <= 0)  return `<div class="eta-chip eta-now">即將抵達</div>`;
    if (diff <= 3)  return `<div class="eta-chip eta-soon"><span class="eta-min">${diff}</span><span class="eta-unit">分</span><span class="eta-time">${t}</span></div>`;
    return `<div class="eta-chip eta-ok"><span class="eta-min">${diff}</span><span class="eta-unit">分</span><span class="eta-time">${t}</span></div>`;
  } catch { return `<span style="color:var(--text-faint)">—</span>`; }
}

/* ══ INJECT ETA CHIP STYLES ════════════════════════════════ */
(function injectStyles() {
  if (document.getElementById('bus-eta-styles')) return;
  const s = document.createElement('style');
  s.id = 'bus-eta-styles';
  s.textContent = `
    .eta-chip { display:inline-flex; align-items:baseline; gap:2px; border-radius:8px; padding:4px 10px; font-weight:700; }
    .eta-now  { background:rgba(239,68,68,.15); color:#f87171; font-size:12px; }
    .eta-soon { background:rgba(234,179,8,.15); color:#fbbf24; }
    .eta-ok   { background:rgba(34,197,94,.12); color:#4ade80; }
    .eta-min  { font-size:18px; line-height:1; font-family:var(--font-mono); }
    .eta-unit { font-size:10px; color:inherit; opacity:.8; margin-left:1px; }
    .eta-time { font-size:11px; color:inherit; opacity:.7; margin-left:6px; font-family:var(--font-mono); }
    .stop-btn { display:flex; align-items:center; gap:10px; width:100%;
      background:var(--surface-2); border:1px solid var(--border); border-radius:10px;
      padding:12px 14px; cursor:pointer; text-align:left; color:var(--text);
      transition:background .12s, border-color .12s; }
    .stop-btn:hover, .stop-btn:active { background:var(--primary-lt); border-color:var(--primary); }
    .stop-num { font-size:11px; color:var(--text-faint); min-width:22px; flex-shrink:0; }
    .stop-name { font-size:14px; font-weight:600; flex:1; }
    .stop-arrow { color:var(--primary); flex-shrink:0; opacity:.6; }
    @keyframes buspin { to { transform:rotate(360deg) } }
    .bus-spin { width:18px;height:18px;border:2px solid var(--border);
      border-top-color:var(--primary);border-radius:50%;animation:buspin .7s linear infinite; }
  `;
  document.head.appendChild(s);
})();

/* ══ STOP NAME HELPERS ══════════════════════════════════════ */
// Strip bus stop codes like (TM970), (SS461) etc.
function cleanStopName(name) {
  return (name || '').replace(/\s*\([A-Z]{2}\d+\)\s*$/,'').replace(/\s*\([A-Z]{3,}\d*\)\s*$/,'').trim();
}

async function getKMBStopName(stopId) {
  if (_stopCache[stopId]) return _stopCache[stopId];
  try {
    const r = await fetch(`https://data.etabus.gov.hk/v1/transport/kmb/stop/${stopId}`);
    const d = await r.json();
    const raw = d.data?.name_tc || stopId;
    const clean = cleanStopName(raw);
    _stopCache[stopId] = clean;
    return clean;
  } catch { return stopId; }
}

async function getCTBStopName(stopId) {
  const key = 'CTB_' + stopId;
  if (_stopCache[key]) return _stopCache[key];
  try {
    const r = await fetch(`https://rt.data.gov.hk/v2/transport/citybus/stop/${stopId}`);
    const d = await r.json();
    const clean = cleanStopName(d.data?.name_tc || stopId);
    _stopCache[key] = clean;
    return clean;
  } catch { return stopId; }
}

/* ══ GET ROUTE INFO (origin/destination) ═══════════════════ */
async function getKMBRouteInfo(route) {
  try {
    const r = await fetch(`https://data.etabus.gov.hk/v1/transport/kmb/route/${route}/outbound/1`);
    const d = await r.json();
    return { orig: d.data?.orig_tc || '', dest: d.data?.dest_tc || '' };
  } catch { return { orig:'', dest:'' }; }
}

async function getCTBRouteInfo(route) {
  try {
    const r = await fetch(`https://rt.data.gov.hk/v2/transport/citybus/route/CTB/${route}`);
    const d = await r.json();
    return { orig: d.data?.orig_tc || '', dest: d.data?.dest_tc || '' };
  } catch { return { orig:'', dest:'' }; }
}

/* ══ PRESET MODULE ══════════════════════════════════════════ */
const Bus = (function() {

  function renderPresetGrid() {
    const grid = document.getElementById('bus-presets-grid');
    if (!grid) return;
    grid.innerHTML = PRESET_STOPS.map((p, i) => `
      <div class="card" style="padding:var(--sp-3)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <span class="tag ${p.operator==='KMB'?'tag-red':'tag-green'}"
            style="font-size:10px;font-weight:700;flex-shrink:0">${p.operator}</span>
          <div>
            <div style="font-size:13px;font-weight:700">${p.label}</div>
            <div style="font-size:10px;color:var(--text-faint)">${p.route} · ${p.hint}</div>
          </div>
        </div>
        <div id="preset-eta-${i}">
          <div class="skel" style="height:24px;border-radius:6px"></div>
        </div>
      </div>
    `).join('');
  }

  async function loadPreset(p, i) {
    const cont = document.getElementById(`preset-eta-${i}`);
    if (!cont) return;
    try {
      let etas = [];
      if (p.operator === 'KMB') {
        const r = await fetch(`https://data.etabus.gov.hk/v1/transport/kmb/eta/${p.id}/${p.route}/${p.serviceType}`);
        const d = await r.json();
        etas = d.data || [];
      } else {
        const r = await fetch(`https://rt.data.gov.hk/v2/transport/citybus/eta/CTB/${p.id}/${p.route}`);
        const d = await r.json();
        etas = d.data || [];
      }

      // Group by dest
      const byDest = {};
      etas.forEach(e => {
        const dest = e.dest_tc || e.dest_en || p.route;
        if (!byDest[dest]) byDest[dest] = [];
        if (byDest[dest].length < 3 && (e.eta || e.rmk_tc)) byDest[dest].push(e);
      });

      if (!Object.keys(byDest).length) {
        cont.innerHTML = `<div style="color:var(--text-faint);font-size:12px;padding:4px">暫無班次</div>`;
        return;
      }

      cont.innerHTML = Object.entries(byDest).map(([dest, arr]) => `
        <div style="margin-bottom:8px">
          <div style="font-size:11px;color:var(--text-faint);margin-bottom:4px">→ ${dest}</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${arr.map(e => fmtEta(e.eta, e.rmk_tc)).join('')}
          </div>
        </div>
      `).join('');
    } catch {
      cont.innerHTML = `<div style="color:var(--error);font-size:11px">載入失敗</div>`;
    }
  }

  async function refresh() {
    renderPresetGrid();
    await Promise.allSettled(PRESET_STOPS.map((p, i) => loadPreset(p, i)));
  }

  return { refresh };
})();

/* ══ SEARCH MODULE ══════════════════════════════════════════ */
const BusSearch = (function() {

  let _results = [];
  let _activeIdx = 0;

  /* ── Main search ─────────────────────────────────────── */
  async function search() {
    const input = (document.getElementById('bus-search-input')?.value || '').trim().toUpperCase();
    if (!input) return;

    const resultEl = document.getElementById('bus-search-result');
    const etaEl    = document.getElementById('bus-eta-panel');
    if (!resultEl) return;
    if (etaEl) { etaEl.style.display = 'none'; etaEl.innerHTML = ''; }

    // Loading state
    resultEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;padding:20px;color:var(--text-muted)">
        <div class="bus-spin"></div>
        <span>搜尋路線 <strong>${input}</strong> 中…</span>
      </div>
    `;

    // Fetch route info + stops in parallel
    const [kmbInfo, ctbInfo, kmbOut, kmbIn, ctbOut, ctbIn] = await Promise.allSettled([
      getKMBRouteInfo(input),
      getCTBRouteInfo(input),
      fetch(`https://data.etabus.gov.hk/v1/transport/kmb/route-stop/${input}/outbound/1`).then(r=>r.json()),
      fetch(`https://data.etabus.gov.hk/v1/transport/kmb/route-stop/${input}/inbound/1`).then(r=>r.json()),
      fetch(`https://rt.data.gov.hk/v2/transport/citybus/route-stop/CTB/${input}/outbound`).then(r=>r.json()),
      fetch(`https://rt.data.gov.hk/v2/transport/citybus/route-stop/CTB/${input}/inbound`).then(r=>r.json()),
    ]);

    const kmbRoute = kmbInfo.status==='fulfilled' ? kmbInfo.value : {orig:'',dest:''};
    const ctbRoute = ctbInfo.status==='fulfilled' ? ctbInfo.value : {orig:'',dest:''};

    _results = [];
    if (kmbOut.status==='fulfilled' && (kmbOut.value.data||[]).length)
      _results.push({ operator:'KMB', route:input, direction:'outbound',
        orig: kmbRoute.orig, dest: kmbRoute.dest, stops: kmbOut.value.data });
    if (kmbIn.status==='fulfilled' && (kmbIn.value.data||[]).length)
      _results.push({ operator:'KMB', route:input, direction:'inbound',
        orig: kmbRoute.dest, dest: kmbRoute.orig, stops: kmbIn.value.data });
    if (ctbOut.status==='fulfilled' && (ctbOut.value.data||[]).length)
      _results.push({ operator:'CTB', route:input, direction:'outbound',
        orig: ctbRoute.orig, dest: ctbRoute.dest, stops: ctbOut.value.data });
    if (ctbIn.status==='fulfilled' && (ctbIn.value.data||[]).length)
      _results.push({ operator:'CTB', route:input, direction:'inbound',
        orig: ctbRoute.dest, dest: ctbRoute.orig, stops: ctbIn.value.data });

    if (!_results.length) {
      resultEl.innerHTML = `
        <div style="padding:40px 20px;text-align:center;color:var(--text-faint)">
          <div style="font-size:36px;margin-bottom:12px">🚌</div>
          <div style="font-size:14px;font-weight:600;margin-bottom:6px">找不到路線 ${input}</div>
          <div style="font-size:12px">請確認路線號是否正確，例如 60X、67X、962X</div>
        </div>
      `;
      return;
    }

    _activeIdx = 0;
    renderDirectionTabs();
    renderStopList(_activeIdx);
  }

  /* ── Direction tabs with real origin→dest ───────────── */
  function renderDirectionTabs() {
    const resultEl = document.getElementById('bus-search-result');
    if (!resultEl) return;

    const tabsHtml = _results.map((r, i) => {
      const orig = r.orig || (r.direction==='outbound'?'起點':'終點');
      const dest = r.dest || (r.direction==='outbound'?'終點':'起點');
      const active = i === _activeIdx;
      return `
        <button id="dir-tab-${i}" onclick="BusSearch.selectDir(${i})"
          style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:3px;
                 background:${active?'var(--primary)':'var(--surface-2)'};
                 color:${active?'white':'var(--text)'};
                 border:1px solid ${active?'var(--primary)':'var(--border)'};
                 border-radius:10px;padding:10px 12px;cursor:pointer;transition:all .15s">
          <div style="font-size:10px;opacity:${active?'.85':'.6'}">${r.operator} · ${r.stops.length}站</div>
          <div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">
            ${orig || '—'} → ${dest || '—'}
          </div>
        </button>
      `;
    }).join('');

    resultEl.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap" id="dir-tabs">${tabsHtml}</div>
      <div id="bus-stop-list"></div>
    `;
  }

  /* ── Render stop list ────────────────────────────────── */
  async function renderStopList(idx) {
    const r = _results[idx];
    if (!r) return;
    const listEl = document.getElementById('bus-stop-list');
    if (!listEl) return;

    const orig = r.orig || '起點';
    const dest = r.dest || '終點';

    listEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;
                  padding:8px 12px;background:var(--surface-2);border-radius:8px">
        <span class="tag ${r.operator==='KMB'?'tag-red':'tag-green'}" style="font-size:10px">${r.operator} ${r.route}</span>
        <span style="font-size:12px;color:var(--text-muted)">${orig}</span>
        <span style="font-size:12px;color:var(--text-faint)">→</span>
        <span style="font-size:12px;color:var(--text-muted)">${dest}</span>
        <span style="font-size:11px;color:var(--text-faint);margin-left:auto">${r.stops.length} 個站</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;
                  color:var(--text-faint);font-size:11px">
        <div class="bus-spin" style="width:12px;height:12px;border-width:1.5px"></div>
        載入站名中…
      </div>
    `;

    // Load stop names in batches of 6
    const stops  = r.stops;
    const nameMap = {};
    const batches = [];
    for (let i = 0; i < stops.length; i += 6) batches.push(stops.slice(i, i+6));
    for (const batch of batches) {
      await Promise.all(batch.map(async s => {
        nameMap[s.stop] = r.operator === 'KMB'
          ? await getKMBStopName(s.stop)
          : await getCTBStopName(s.stop);
      }));
      // Re-render progressively as names load
      _renderStopButtons(listEl, stops, nameMap, r, orig, dest);
    }
  }

  function _renderStopButtons(listEl, stops, nameMap, r, orig, dest) {
    const loaded  = Object.keys(nameMap).length;
    const total   = stops.length;
    const pct     = Math.round(loaded/total*100);

    const buttonsHtml = stops.map((s, i) => {
      const name = nameMap[s.stop] || null;
      const safeName = name ? name.replace(/"/g, '&quot;') : '';
      const clickAttr = name
        ? 'data-stop="' + s.stop + '" data-op="' + r.operator + '" data-route="' + r.route + '" data-dir="' + r.direction + '" data-name="' + safeName + '"'
        : 'disabled';
      return '<button class="stop-btn" ' + clickAttr + ' style="' + (!name ? 'opacity:.4;cursor:default' : '') + '">'
        + '<span class="stop-num">' + (i+1) + '</span>'
        + '<span class="stop-name">' + (name || '…') + '</span>'
        + (name ? '<svg class="stop-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>' : '')
        + '</button>';
    }).join('');

    listEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;
                  padding:8px 12px;background:var(--surface-2);border-radius:8px">
        <span class="tag ${r.operator==='KMB'?'tag-red':'tag-green'}" style="font-size:10px">${r.operator} ${r.route}</span>
        <span style="font-size:12px;color:var(--text-muted)">${orig} → ${dest}</span>
        <span style="font-size:11px;color:var(--text-faint);margin-left:auto">${r.stops.length} 站</span>
      </div>
      ${loaded < total ? `
        <div style="margin-bottom:8px;height:3px;background:var(--surface-2);border-radius:2px">
          <div style="height:100%;width:${pct}%;background:var(--primary);border-radius:2px;transition:width .3s"></div>
        </div>
      ` : ''}
      <div style="display:flex;flex-direction:column;gap:6px">${buttonsHtml}</div>
    `;
  }

  /* ── Select direction ────────────────────────────────── */
  async function selectDir(idx) {
    _activeIdx = idx;
    // Update tab styles
    _results.forEach((_, i) => {
      const btn = document.getElementById(`dir-tab-${i}`);
      if (!btn) return;
      const active = i === idx;
      btn.style.background  = active ? 'var(--primary)' : 'var(--surface-2)';
      btn.style.color        = active ? 'white' : 'var(--text)';
      btn.style.borderColor  = active ? 'var(--primary)' : 'var(--border)';
    });
    // Hide ETA
    const etaEl = document.getElementById('bus-eta-panel');
    if (etaEl) { etaEl.style.display = 'none'; etaEl.innerHTML = ''; }
    await renderStopList(idx);
  }

  /* ── Load ETA for stop ───────────────────────────────── */
  async function loadETA(stopId, operator, route, serviceType, stopName, direction) {
    const panel = document.getElementById('bus-eta-panel');
    if (!panel) return;

    // Show panel with loading state
    panel.style.display = 'block';
    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;padding:4px 0 12px">
        <div>
          <div style="font-size:15px;font-weight:700">📍 ${stopName}</div>
          <div style="font-size:11px;color:var(--text-faint);margin-top:2px">${operator} ${route}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;color:var(--text-muted);font-size:13px">
        <div class="bus-spin"></div> 查詢到站時間中…
      </div>
    `;

    // Scroll panel into view
    setTimeout(() => panel.scrollIntoView({ behavior:'smooth', block:'start' }), 100);

    await _fetchETA(stopId, operator, route, serviceType, stopName, direction, panel);
  }

  async function _fetchETA(stopId, operator, route, serviceType, stopName, direction, panel) {
    try {
      let etas = [];
      if (operator === 'KMB') {
        const r = await fetch(`https://data.etabus.gov.hk/v1/transport/kmb/eta/${stopId}/${route}/${serviceType}`);
        const d = await r.json();
        etas = (d.data || []).slice(0, 5);
      } else {
        const r = await fetch(`https://rt.data.gov.hk/v2/transport/citybus/eta/CTB/${stopId}/${route}`);
        const d = await r.json();
        etas = (d.data || []).slice(0, 4);
      }

      const now    = new Date().toLocaleTimeString('zh-HK', {hour12:false, hour:'2-digit', minute:'2-digit'});
      const dirLabel = direction === 'outbound' ? '往終點方向' : '往起點方向';

      const headerHtml = `
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;gap:8px">
          <div>
            <div style="font-size:15px;font-weight:700">📍 ${stopName}</div>
            <div style="font-size:11px;color:var(--text-faint);margin-top:2px">
              <span class="tag ${operator==='KMB'?'tag-red':'tag-green'}" style="font-size:10px;vertical-align:middle">${operator}</span>
              ${route} · ${dirLabel} · 更新 ${now}
            </div>
          </div>
          <button onclick="BusSearch._refresh('${stopId}','${operator}','${route}','${serviceType}','${stopName}','${direction}')"
            style="background:var(--primary);color:white;border-radius:8px;
                   padding:6px 12px;font-size:12px;font-weight:600;flex-shrink:0;white-space:nowrap">
            ↻ 更新
          </button>
        </div>
      `;

      if (!etas.length) {
        panel.innerHTML = headerHtml + `
          <div style="padding:16px;text-align:center;color:var(--text-faint);font-size:13px">
            目前暫無班次資料
          </div>
        `;
        return;
      }

      // Separate regular and scheduled buses
      const regular   = etas.filter(e => !e.rmk_tc?.includes('預定'));
      const scheduled = etas.filter(e =>  e.rmk_tc?.includes('預定'));

      const etaRows = etas.map((e, i) => {
        const dest    = e.dest_tc ? `→ ${e.dest_tc}` : '';
        const isPreset = e.rmk_tc?.includes('預定');
        return `
          <div style="display:flex;align-items:center;justify-content:space-between;
                      padding:10px 14px;background:var(--surface-2);border-radius:10px;
                      margin-bottom:6px;gap:10px">
            <div style="font-size:13px;font-weight:600;min-width:50px">第 ${i+1} 班</div>
            <div style="flex:1;font-size:12px;color:var(--text-muted)">${dest}</div>
            <div style="display:flex;align-items:center;gap:6px">
              ${fmtEta(e.eta, e.rmk_tc)}
              ${isPreset ? `<span style="font-size:9px;color:var(--text-faint);background:var(--surface);border-radius:4px;padding:2px 5px">預定</span>` : ''}
            </div>
          </div>
        `;
      }).join('');

      panel.innerHTML = headerHtml + etaRows;

    } catch (e) {
      panel.innerHTML = `<div style="color:var(--error);padding:12px;font-size:13px">載入失敗：${e.message}</div>`;
    }
  }

  function _refresh(stopId, operator, route, serviceType, stopName, direction) {
    const panel = document.getElementById('bus-eta-panel');
    if (!panel) return;
    // Show updating indicator
    const refreshBtn = panel.querySelector('button');
    if (refreshBtn) refreshBtn.textContent = '更新中…';
    _fetchETA(stopId, operator, route, serviceType, stopName, direction, panel);
  }

  return { search, selectDir, loadETA, _refresh };
})();

window.Bus = Bus;
window.BusSearch = BusSearch;

/* ══ GMB MODULE ═════════════════════════════════════════════ */
const Bus_GMB = (function() {

  async function loadRoutes() {
    const region = document.getElementById('gmb-region')?.value || 'NT';
    const cont   = document.getElementById('gmb-routes-list');
    if (!cont) return;
    cont.innerHTML = `<div style="display:flex;align-items:center;gap:8px;color:var(--text-faint);font-size:12px"><div class="bus-spin"></div>載入中…</div>`;
    try {
      const r    = await fetch(`https://data.etagmb.gov.hk/route/${region}`);
      const data = await r.json();
      const routes = data.data?.routes || [];
      if (!routes.length) { cont.innerHTML = `<div style="color:var(--text-faint)">暫無數據</div>`; return; }
      cont.innerHTML = `
        <div style="font-size:11px;color:var(--text-faint);margin-bottom:8px">${routes.length} 條路線 · 點擊路線查看站點及到站時間</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${routes.slice(0,60).map(r => `
            <button onclick="Bus_GMB.selectRoute('${r.route_id}','${region}')"
              style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;
                     padding:5px 12px;font-size:12px;color:var(--text);cursor:pointer"
              title="${r.description_tc||''}">
              ${r.route_code || r.route_id}
            </button>
          `).join('')}
          ${routes.length>60?`<span style="color:var(--text-faint);font-size:11px;align-self:center">+${routes.length-60} 條</span>`:''}
        </div>
      `;
    } catch (e) {
      cont.innerHTML = `<div style="color:var(--error);font-size:12px">${e.message}</div>`;
    }
  }

  async function selectRoute(routeId, region) {
    const cont = document.getElementById('gmb-stop-result');
    if (!cont) return;
    cont.innerHTML = `<div style="display:flex;align-items:center;gap:8px;color:var(--text-faint);font-size:12px"><div class="bus-spin"></div>載入站點…</div>`;
    try {
      const r    = await fetch(`https://data.etagmb.gov.hk/route/${region}/${routeId}`);
      const data = await r.json();
      const dir  = data.data?.directions?.[0] || {};
      const stops = dir.stops || [];
      const code  = data.data?.route_code || routeId;
      cont.innerHTML = `
        <div style="padding:8px 12px;background:var(--surface-2);border-radius:8px;
                    margin-bottom:10px;font-size:13px;font-weight:600">
          🟩 ${code} · ${dir.orig_tc||''} → ${dir.dest_tc||''}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
            <div style="display:flex;flex-direction:column;gap:6px">
          ${stops.slice(0,25).map((s,i) => {
            const sname = (s.name_tc||s.stop_id||'').replace(/"/g,'&quot;');
            return '<button class="stop-btn gmb-stop" data-route="'+routeId+'" data-seq="'+(i+1)+'" data-name="'+sname+'">'
              + '<span class="stop-num">'+(i+1)+'</span>'
              + '<span class="stop-name">'+(s.name_tc||s.stop_id)+'</span>'
              + '<svg class="stop-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>'
              + '</button>';
          }).join('')}
        </div>    </div>
        <div id="gmb-eta-result" style="margin-top:12px"></div>
      `;
    } catch (e) {
      cont.innerHTML = `<div style="color:var(--error);font-size:12px">${e.message}</div>`;
    }
  }

  async function loadETA(routeId, stopSeq, stopName) {
    const cont = document.getElementById('gmb-eta-result');
    if (!cont) return;
    cont.scrollIntoView({ behavior:'smooth', block:'start' });
    cont.innerHTML = `<div style="display:flex;align-items:center;gap:8px;color:var(--text-faint);font-size:12px"><div class="bus-spin"></div>查詢到站時間…</div>`;
    try {
      const r    = await fetch(`https://data.etagmb.gov.hk/eta/route-stop/${routeId}/${stopSeq}`);
      const data = await r.json();
      const etas = data.data?.eta || [];
      const now  = new Date().toLocaleTimeString('zh-HK', {hour12:false,hour:'2-digit',minute:'2-digit'});
      cont.innerHTML = `
        <div style="font-size:14px;font-weight:700;margin-bottom:10px">📍 ${stopName}</div>
        ${etas.length ? etas.slice(0,4).map((e,i) => `
          <div style="display:flex;align-items:center;justify-content:space-between;
                      padding:10px 14px;background:var(--surface-2);border-radius:10px;margin-bottom:6px">
            <span style="font-size:13px;font-weight:600">第 ${i+1} 班</span>
            <div>${fmtEta(e.timestamp, e.remarks_tc)}</div>
          </div>
        `).join('') : '<div style="color:var(--text-faint);font-size:13px;padding:10px 0">暫無班次資料</div>'}
        <div style="font-size:10px;color:var(--text-faint);margin-top:6px">更新 ${now}</div>
      `;
    } catch (e) {
      cont.innerHTML = `<div style="color:var(--error);font-size:12px">${e.message}</div>`;
    }
  }

  return { loadRoutes, selectRoute, loadETA };
})();

window.Bus_GMB = Bus_GMB;

/* ══ STOP BUTTON EVENT DELEGATION ══════════════════════════ */
document.addEventListener('click', function(e) {
  // KMB/CTB stop buttons
  const kmbBtn = e.target.closest('.stop-btn[data-stop]');
  if (kmbBtn) {
    const stopId = kmbBtn.dataset.stop;
    const op     = kmbBtn.dataset.op;
    const route  = kmbBtn.dataset.route;
    const dir    = kmbBtn.dataset.dir;
    const name   = kmbBtn.dataset.name;
    if (stopId && op && route) BusSearch.loadETA(stopId, op, route, '1', name, dir);
    return;
  }
  // GMB stop buttons
  const gmbBtn = e.target.closest('.gmb-stop');
  if (gmbBtn) {
    const route = gmbBtn.dataset.route;
    const seq   = gmbBtn.dataset.seq;
    const name  = gmbBtn.dataset.name;
    if (route && seq) Bus_GMB.loadETA(route, seq, name);
    return;
  }
});
