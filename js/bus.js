/* ============================================================
   bus.js — 巴士到站時間 Bus ETA (CTB + KMB + GMB)
   香港城市儀表板 v3
   ============================================================ */

'use strict';

const Bus = (function() {

  /* ── Known stops (common New Territories / Tuen Mun area) ───── */
  const PRESET_STOPS = [
    { operator:'KMB', id:'B3B0EF2BC688751D', label:'屯門市中心總站 (KMB)', route:'60X', serviceType:1, hint:'往旺角' },
    { operator:'KMB', id:'77FB32597CCD30F5', label:'兆康苑總站 (KMB)',     route:'67X', serviceType:1, hint:'往旺角' },
    { operator:'KMB', id:'45C39BB56C6B333C', label:'大興總站 (KMB)',       route:'66M', serviceType:1, hint:'往元朗' },
    { operator:'KMB', id:'507A1E5DF62D2B4A', label:'天瑞總站 (KMB)',       route:'69X', serviceType:1, hint:'往沙田' },
    { operator:'CTB', id:'001939',           label:'龍門居 (CTB)',         route:'962X', hint:'往銅鑼灣' },
  ];

  /* ── Format ETA timestamp ──────────────────────────────────── */
  function fmtEta(isoStr) {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      const now = new Date();
      const diff = Math.round((d - now) / 60000); // minutes
      const timeStr = d.toLocaleTimeString('zh-HK', { hour:'2-digit', minute:'2-digit', hour12:false });
      if (diff <= 0) return `<span class="tag tag-red">即將抵達</span>`;
      if (diff <= 2) return `<span class="tag tag-yellow">${diff} 分鐘 · ${timeStr}</span>`;
      return `<span class="tag tag-green">${diff} 分鐘 · ${timeStr}</span>`;
    } catch { return isoStr; }
  }

  /* ── KMB stop-eta (all routes at stop) ─────────────────────── */
  async function fetchKMBStop(stopId) {
    const url = `https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/${stopId}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`KMB stop-eta HTTP ${r.status}`);
    return r.json();
  }

  /* ── KMB route+stop ETA ─────────────────────────────────────── */
  async function fetchKMBEta(stopId, route, serviceType = 1) {
    const url = `https://data.etabus.gov.hk/v1/transport/kmb/eta/${stopId}/${route}/${serviceType}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`KMB ETA HTTP ${r.status}`);
    return r.json();
  }

  /* ── CTB stop+route ETA ─────────────────────────────────────── */
  async function fetchCTBEta(stopId, route) {
    const url = `https://rt.data.gov.hk/v2/transport/citybus/eta/CTB/${stopId}/${route}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`CTB ETA HTTP ${r.status}`);
    return r.json();
  }

  /* ── GMB routes list ────────────────────────────────────────── */
  async function fetchGMBRoutes(region) {
    const url = `https://data.etagmb.gov.hk/route/${region}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`GMB routes HTTP ${r.status}`);
    return r.json();
  }

  /* ── GMB stop ETA ───────────────────────────────────────────── */
  async function fetchGMBEta(routeId, stopSeq) {
    const url = `https://data.etagmb.gov.hk/eta/route-stop/${routeId}/${stopSeq}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`GMB ETA HTTP ${r.status}`);
    return r.json();
  }

  /* ── Render KMB ETA results ─────────────────────────────────── */
  function renderKMBEtaResult(container, data, routeFilter) {
    const items = (data.data || []).filter(e => !routeFilter || e.route === routeFilter);
    if (!items.length) {
      container.innerHTML = `<div class="row-item"><span class="row-val" style="color:var(--text-faint)">暫無班次資料</span></div>`;
      return;
    }
    // Group by route + dest
    const grouped = {};
    items.forEach(e => {
      const key = `${e.route}||${e.dest_tc || e.dest_en || ''}||${e.service_type}`;
      if (!grouped[key]) grouped[key] = { route: e.route, dest: e.dest_tc || e.dest_en || '', etas: [] };
      if (e.eta) grouped[key].etas.push({ eta: e.eta, rmk: e.rmk_tc || '' });
    });
    container.innerHTML = Object.values(grouped).slice(0, 8).map(g => `
      <div class="row-item" style="flex-direction:column;align-items:flex-start;gap:4px;padding:var(--sp-3)">
        <div style="display:flex;gap:var(--sp-2);align-items:center">
          <span class="tag tag-blue" style="font-size:11px;font-weight:700">${g.route}</span>
          <span style="font-size:var(--text-sm);font-weight:600">${g.dest}</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:var(--sp-2);margin-top:2px">
          ${g.etas.slice(0,3).map(e => `
            <span style="font-size:var(--text-xs)">${fmtEta(e.eta)}${e.rmk ? `<span style="color:var(--text-faint);margin-left:4px">${e.rmk}</span>` : ''}</span>
          `).join('')}
          ${g.etas.length === 0 ? `<span class="tag tag-muted">暫無班次</span>` : ''}
        </div>
      </div>
    `).join('');
  }

  /* ── Render CTB ETA results ─────────────────────────────────── */
  function renderCTBEtaResult(container, data) {
    const items = data.data || [];
    if (!items.length) {
      container.innerHTML = `<div class="row-item"><span class="row-val" style="color:var(--text-faint)">暫無班次資料</span></div>`;
      return;
    }
    container.innerHTML = items.slice(0,4).map((e, i) => `
      <div class="row-item">
        <span class="row-name">第 ${i+1} 班</span>
        <span class="row-val">${fmtEta(e.eta)}${e.rmk_tc ? `<span style="color:var(--text-faint);font-size:10px;margin-left:4px">${e.rmk_tc}</span>` : ''}</span>
      </div>
    `).join('');
  }

  /* ── Error state ─────────────────────────────────────────────── */
  function showErr(container, msg) {
    container.innerHTML = `<div class="row-item"><span style="color:var(--error);font-size:var(--text-xs)">${msg}</span></div>`;
  }

  /* ══ Public API ══════════════════════════════════════════════ */

  /* Search KMB stop ─────────────────────────────────────────── */
  async function searchKMB() {
    const stopId = (document.getElementById('bus-kmb-stop') || {}).value?.trim().toUpperCase();
    const route  = (document.getElementById('bus-kmb-route') || {}).value?.trim().toUpperCase();
    const cont   = document.getElementById('bus-kmb-result');
    if (!cont) return;
    if (!stopId) { cont.innerHTML = `<div style="color:var(--warning);font-size:var(--text-xs)">請輸入站 ID</div>`; return; }
    cont.innerHTML = `<div class="skel skel-p"></div>`;
    try {
      const data = await fetchKMBEta(stopId, route || '60X', 1);
      renderKMBEtaResult(cont, data, route || null);
    } catch (e) {
      // Try stop-eta fallback
      try {
        const data2 = await fetchKMBStop(stopId);
        renderKMBEtaResult(cont, data2, route || null);
      } catch (e2) {
        showErr(cont, `載入失敗：${e2.message}`);
      }
    }
  }

  /* Search CTB stop ─────────────────────────────────────────── */
  async function searchCTB() {
    const stopId = (document.getElementById('bus-ctb-stop') || {}).value?.trim();
    const route  = (document.getElementById('bus-ctb-route') || {}).value?.trim().toUpperCase();
    const cont   = document.getElementById('bus-ctb-result');
    if (!cont) return;
    if (!stopId || !route) { cont.innerHTML = `<div style="color:var(--warning);font-size:var(--text-xs)">請輸入站 ID 和路線號</div>`; return; }
    cont.innerHTML = `<div class="skel skel-p"></div>`;
    try {
      const data = await fetchCTBEta(stopId, route);
      renderCTBEtaResult(cont, data);
    } catch (e) {
      showErr(cont, `載入失敗：${e.message}`);
    }
  }

  /* Load preset stop ────────────────────────────────────────── */
  async function loadPreset(operator, stopId, route, labelEl, resultEl) {
    const cont = document.getElementById(resultEl);
    if (!cont) return;
    cont.innerHTML = `<div class="skel skel-p"></div>`;
    try {
      if (operator === 'KMB') {
        const data = await fetchKMBEta(stopId, route, 1);
        renderKMBEtaResult(cont, data, route);
      } else if (operator === 'CTB') {
        const data = await fetchCTBEta(stopId, route);
        renderCTBEtaResult(cont, data);
      }
    } catch (e) {
      showErr(cont, `${e.message}`);
    }
  }

  /* Load GMB routes for region ──────────────────────────────── */
  async function loadGMBRegion() {
    const region = (document.getElementById('gmb-region') || {}).value || 'NT';
    const routeCont = document.getElementById('gmb-routes-list');
    if (!routeCont) return;
    routeCont.innerHTML = `<div class="skel skel-p"></div><div class="skel skel-p" style="margin-top:8px"></div>`;
    try {
      const data = await fetchGMBRoutes(region);
      const routes = data.data?.routes || [];
      if (!routes.length) { routeCont.innerHTML = `<div style="color:var(--text-faint)">暫無數據</div>`; return; }
      routeCont.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:var(--sp-2)">
        ${routes.slice(0, 60).map(r => `
          <button onclick="Bus.selectGMBRoute('${r.route_id}','${region}')"
            style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-md);padding:4px 10px;font-size:11px;color:var(--text);cursor:pointer"
            title="${r.description_tc || ''}">
            ${r.route_code || r.route_id}
          </button>
        `).join('')}
        ${routes.length > 60 ? `<span style="color:var(--text-faint);font-size:11px;padding:4px">…共 ${routes.length} 條</span>` : ''}
      </div>`;
    } catch (e) {
      routeCont.innerHTML = `<div style="color:var(--error);font-size:var(--text-xs)">${e.message}</div>`;
    }
  }

  /* Select GMB route → show stop list ────────────────────────── */
  async function selectGMBRoute(routeId, region) {
    const cont = document.getElementById('gmb-stop-result');
    if (!cont) return;
    cont.innerHTML = `<div class="skel skel-p"></div>`;
    try {
      // Fetch route stop list
      const r = await fetch(`https://data.etagmb.gov.hk/route/${region}/${routeId}`);
      const data = await r.json();
      const directions = data.data?.directions || [];
      if (!directions.length) { cont.innerHTML = `<div style="color:var(--text-faint)">暫無站點數據</div>`; return; }
      const dir = directions[0];
      const stops = dir.stops || [];
      cont.innerHTML = `
        <div style="margin-bottom:var(--sp-3);font-size:var(--text-sm)">
          <strong>${data.data?.route_code || routeId}</strong>
          ${dir.orig_tc || ''} → ${dir.dest_tc || ''}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:var(--sp-2)">
          ${stops.slice(0,30).map((s,i) => `
            <button onclick="Bus.loadGMBStopEta('${routeId}','${i+1}','${s.name_tc || s.stop_id || ''}')"
              style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-md);padding:4px 10px;font-size:11px;color:var(--text);cursor:pointer">
              ${i+1}. ${s.name_tc || s.stop_id}
            </button>
          `).join('')}
        </div>
        <div id="gmb-eta-result" style="margin-top:var(--sp-3)"></div>
      `;
    } catch(e) {
      cont.innerHTML = `<div style="color:var(--error);font-size:var(--text-xs)">${e.message}</div>`;
    }
  }

  /* Load GMB ETA for stop ─────────────────────────────────────── */
  async function loadGMBStopEta(routeId, stopSeq, stopName) {
    const cont = document.getElementById('gmb-eta-result');
    if (!cont) return;
    cont.innerHTML = `<div class="skel skel-p"></div>`;
    try {
      const data = await fetchGMBEta(routeId, stopSeq);
      const etas = data.data?.enabled === false
        ? []
        : (data.data?.eta || []);
      if (!etas.length) {
        cont.innerHTML = `<div style="color:var(--text-faint);font-size:var(--text-xs)">${stopName}：暫無班次資料</div>`;
        return;
      }
      cont.innerHTML = `
        <div style="font-size:var(--text-sm);font-weight:600;margin-bottom:var(--sp-2)">${stopName}</div>
        ${etas.slice(0,4).map((e,i) => `
          <div class="row-item">
            <span class="row-name">第 ${i+1} 班</span>
            <span class="row-val">${fmtEta(e.timestamp)}${e.remarks_tc ? `<span style="color:var(--text-faint);font-size:10px;margin-left:4px">${e.remarks_tc}</span>` : ''}</span>
          </div>
        `).join('')}
      `;
    } catch(e) {
      cont.innerHTML = `<div style="color:var(--error);font-size:var(--text-xs)">${e.message}</div>`;
    }
  }

  /* Initial load of preset stops ────────────────────────────── */
  async function refresh() {
    // Load all preset stops in parallel
    const loads = PRESET_STOPS.map((p, i) =>
      loadPreset(p.operator, p.id, p.route, p.label, `bus-preset-${i}`)
    );
    await Promise.allSettled(loads);
  }

  /* Expose preset info for HTML rendering ───────────────────── */
  function getPresets() { return PRESET_STOPS; }

  return { refresh, searchKMB, searchCTB, loadGMBRegion, selectGMBRoute, loadGMBStopEta, getPresets };
})();
