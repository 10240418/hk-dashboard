/* ============================================================
   border.js — Land Boundary Control Points Waiting Time
   香港城市儀表板
   ============================================================ */

'use strict';

const Border = (function() {

  const RESIDENT_API = 'https://secure1.info.gov.hk/immd/mobileapps/2bb9ae17/data/CPQueueTimeR.json';
  const VISITOR_API = 'https://secure1.info.gov.hk/immd/mobileapps/2bb9ae17/data/CPQueueTimeV.json';
  const LOCAL_RESIDENT_API = '/api/border/resident';
  const LOCAL_VISITOR_API = '/api/border/visitor';

  const POINTS = [
    { code: 'HYW', tc: '香園圍', en: 'Heung Yuen Wai' },
    { code: 'HZM', tc: '港珠澳大橋', en: 'Hong Kong-Zhuhai-Macao Bridge' },
    { code: 'LMC', tc: '落馬洲', en: 'Lok Ma Chau' },
    { code: 'LSC', tc: '落馬洲支線', en: 'Lok Ma Chau Spur Line' },
    { code: 'LWS', tc: '羅湖', en: 'Lo Wu' },
    { code: 'MKT', tc: '文錦渡', en: 'Man Kam To' },
    { code: 'SBC', tc: '深圳灣', en: 'Shenzhen Bay' },
    { code: 'STK', tc: '沙頭角', en: 'Sha Tau Kok' },
  ];

  const STATUS = {
    resident: {
      0: { text: '正常 <15 分', cls: 'tag-green' },
      1: { text: '繁忙 <30 分', cls: 'tag-yellow' },
      2: { text: '非常繁忙 >=30 分', cls: 'tag-red' },
      4: { text: '系統維護', cls: 'tag-muted' },
      99: { text: '非服務時間', cls: 'tag-muted' },
    },
    visitor: {
      0: { text: '正常 <30 分', cls: 'tag-green' },
      1: { text: '繁忙 <45 分', cls: 'tag-yellow' },
      2: { text: '非常繁忙 >=45 分', cls: 'tag-red' },
      4: { text: '系統維護', cls: 'tag-muted' },
      99: { text: '非服務時間', cls: 'tag-muted' },
    },
  };

  function escHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function statusTag(type, code) {
    const item = STATUS[type][code] || { text: `未知 ${code}`, cls: 'tag-muted' };
    return `<span class="tag ${item.cls}" style="font-size:10px">${escHtml(item.text)}</span>`;
  }

  async function fetchJson(url) {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function fetchWithFallback(localUrl, remoteUrl) {
    try {
      return await fetchJson(localUrl);
    } catch (localError) {
      try {
        return await fetchJson(remoteUrl);
      } catch (remoteError) {
        throw new Error(`${localError.message}; ${remoteError.message}`);
      }
    }
  }

  function renderSummary(resident, visitor) {
    const el = document.getElementById('border-summary');
    if (!el) return;
    const all = POINTS.flatMap(p => [
      resident[p.code]?.arrQueue, resident[p.code]?.depQueue,
      visitor[p.code]?.arrQueue, visitor[p.code]?.depQueue,
    ]).filter(v => v !== undefined);
    const normal = all.filter(v => v === 0).length;
    const busy = all.filter(v => v === 1 || v === 2).length;
    const off = all.filter(v => v === 4 || v === 99).length;
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:var(--sp-4)">
        <div><div class="big-num" style="font-size:var(--text-2xl);color:var(--primary)">${POINTS.length}</div><div style="font-size:var(--text-xs);color:var(--text-faint)">管制站</div></div>
        <div><div class="big-num" style="font-size:var(--text-2xl);color:var(--success)">${normal}</div><div style="font-size:var(--text-xs);color:var(--text-faint)">正常方向</div></div>
        <div><div class="big-num" style="font-size:var(--text-2xl);color:var(--warning)">${busy}</div><div style="font-size:var(--text-xs);color:var(--text-faint)">繁忙方向</div></div>
        <div><div class="big-num" style="font-size:var(--text-2xl);color:var(--text-muted)">${off}</div><div style="font-size:var(--text-xs);color:var(--text-faint)">非服務/維護</div></div>
      </div>
    `;
  }

  function renderList(resident, visitor) {
    const el = document.getElementById('border-list');
    if (!el) return;
    el.innerHTML = POINTS.map(point => {
      const r = resident[point.code] || {};
      const v = visitor[point.code] || {};
      return `
        <div class="row-item" style="display:block;padding:var(--sp-4)">
          <div style="display:flex;justify-content:space-between;gap:var(--sp-3);align-items:flex-start;margin-bottom:var(--sp-3)">
            <div>
              <div style="font-size:var(--text-base);font-weight:700;color:var(--text)">${escHtml(point.tc)}</div>
              <div style="font-size:var(--text-xs);color:var(--text-muted)">${escHtml(point.en)} · ${escHtml(point.code)}</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--sp-3)">
            <div style="background:var(--surface);border:1px solid var(--divider);border-radius:var(--r-md);padding:var(--sp-3)">
              <div style="font-size:var(--text-xs);font-weight:700;color:var(--text-muted);margin-bottom:var(--sp-2)">居民 Resident</div>
              <div style="display:flex;justify-content:space-between;gap:var(--sp-2);margin-bottom:var(--sp-2)"><span class="row-sub">抵港 Arrival</span>${statusTag('resident', r.arrQueue)}</div>
              <div style="display:flex;justify-content:space-between;gap:var(--sp-2)"><span class="row-sub">離港 Departure</span>${statusTag('resident', r.depQueue)}</div>
            </div>
            <div style="background:var(--surface);border:1px solid var(--divider);border-radius:var(--r-md);padding:var(--sp-3)">
              <div style="font-size:var(--text-xs);font-weight:700;color:var(--text-muted);margin-bottom:var(--sp-2)">訪客 Visitor</div>
              <div style="display:flex;justify-content:space-between;gap:var(--sp-2);margin-bottom:var(--sp-2)"><span class="row-sub">抵港 Arrival</span>${statusTag('visitor', v.arrQueue)}</div>
              <div style="display:flex;justify-content:space-between;gap:var(--sp-2)"><span class="row-sub">離港 Departure</span>${statusTag('visitor', v.depQueue)}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  async function refresh() {
    const list = document.getElementById('border-list');
    const updated = document.getElementById('border-updated');
    if (!list) return;
    list.innerHTML = `<div class="skel skel-p"></div><div class="skel skel-p" style="margin-top:8px;width:70%"></div>`;
    try {
      const [resident, visitor] = await Promise.all([
        fetchWithFallback(LOCAL_RESIDENT_API, RESIDENT_API),
        fetchWithFallback(LOCAL_VISITOR_API, VISITOR_API),
      ]);
      renderSummary(resident, visitor);
      renderList(resident, visitor);
      if (updated) updated.textContent = `最後更新：${new Date().toLocaleTimeString('zh-HK', { hour12: false })}`;
    } catch (e) {
      list.innerHTML = `<div class="row-item" style="color:var(--error)">邊境等候時間載入失敗：${escHtml(e.message)}</div>`;
      if (updated) updated.textContent = '載入失敗';
    }
  }

  return { refresh };
})();
