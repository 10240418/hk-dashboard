/* ============================================================
   road.js — Journey Time Indicators & Special Traffic News
   香港城市儀表板
   ============================================================ */

'use strict';

const Road = (function() {

  const JOURNEY_API = 'https://resource.data.one.gov.hk/td/jss/Journeytimev2.xml';
  const NEWS_API = 'https://www.td.gov.hk/tc/special_news/trafficnews.xml';

  const LOCATIONS = {
    H1: '告士打道東行', H2: '堅拿道天橋北行', H3: '東區走廊西行', H4: '黃泥涌道北行',
    H5: '興發街北行', H6: '淺水灣道北行', H7: '黃竹坑道北行', H8: '黃竹坑道東行',
    H9: '鴨脷洲橋道北行', H11: '東區走廊西行近鯉景灣',
    K01: '渡船街南行', K02: '加士居道東行', K03: '窩打老道南行', K04: '公主道南行',
    K05: '啟福道北行', K06: '漆咸道南行', K07: '西九龍公路西行', K08: '啟祥道西行',
    N01: '洪天路南行', N02: '朗天路南行', N03: '元朗公路東行', N05: '大埔公路東行',
    N06: '青沙公路西行', N07: '福民路北行', N08: '寶順路南行', N09: '環保大道西行',
    N10: '寶康路南行', N11: '寶邑路西行', N12: '寶順路南行', N13: '翠嶺路東行',
    SJ1: '大埔公路南行', SJ2: '大老山隧道公路南行', SJ3: '吐露港公路南行',
    SJ4: '新田公路南行', SJ5: '屯門公路南行',
  };

  const DESTINATIONS = {
    CH: '紅磡海底隧道', EH: '東區海底隧道', WH: '西區海底隧道',
    ABT: '灣仔經香港仔隧道', WNCG: '灣仔經黃泥涌峽道', PFL: '中區經薄扶林道',
    ACTT: '機場經三號幹線', TMCLK: '機場經屯門赤鱲角隧道', ATL: '機場經大欖隧道',
    ATSCA: '機場經八號幹線', SSCPR: '上水經青山公路', SSYLH: '上水經九號幹線',
    LRT: '九龍(中)經獅子山隧道', SMT: '荃灣經城門隧道', TCT: '九龍(東)經大老山隧道',
    TKTL: '汀九經大欖隧道', TKTM: '汀九經屯門公路', TLH: '沙田經吐露港公路',
    TPR: '沙田經大埔公路', KTPR: '九龍經大埔公路', TSCA: '九龍(西)經八號幹線',
    TWCP: '荃灣(西)經青山公路', TWTM: '荃灣(西)經屯門公路', CWBR: '九龍經清水灣道',
    MOS: '九龍經二號幹線', TKOLTT: '九龍經將軍澳藍田隧道', TKOT: '九龍經將軍澳隧道',
  };

  function escHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function nodeText(node, tag) {
    return node.getElementsByTagName(tag)[0]?.textContent?.trim() || '';
  }

  async function fetchXml(url) {
    const res = await fetch(url, { headers: { accept: 'application/xml,text/xml' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('Invalid XML');
    return doc;
  }

  function journeyClass(item) {
    if (item.journeyType !== '1') return 'tag-muted';
    if (item.colourId === '1') return 'tag-red';
    if (item.colourId === '2') return 'tag-yellow';
    if (item.colourId === '3') return 'tag-green';
    return 'tag-muted';
  }

  function parseJourneys(doc) {
    return Array.from(doc.getElementsByTagName('jtis_journey_time')).map(node => ({
      locationId: nodeText(node, 'LOCATION_ID'),
      destinationId: nodeText(node, 'DESTINATION_ID'),
      captureDate: nodeText(node, 'CAPTURE_DATE'),
      journeyType: nodeText(node, 'JOURNEY_TYPE'),
      journeyData: nodeText(node, 'JOURNEY_DATA'),
      colourId: nodeText(node, 'COLOUR_ID'),
      desc: nodeText(node, 'JOURNEY_DESC'),
    }));
  }

  function parseMessages(doc) {
    return Array.from(doc.getElementsByTagName('message')).map(node => ({
      id: nodeText(node, 'ID'),
      number: nodeText(node, 'INCIDENT_NUMBER'),
      heading: nodeText(node, 'INCIDENT_HEADING_CN') || nodeText(node, 'INCIDENT_HEADING_EN'),
      detail: nodeText(node, 'INCIDENT_DETAIL_CN') || nodeText(node, 'INCIDENT_DETAIL_EN'),
      location: nodeText(node, 'LOCATION_CN') || nodeText(node, 'LOCATION_EN'),
      direction: nodeText(node, 'DIRECTION_CN') || nodeText(node, 'DIRECTION_EN'),
      status: nodeText(node, 'INCIDENT_STATUS_CN') || nodeText(node, 'INCIDENT_STATUS_EN'),
      date: nodeText(node, 'ANNOUNCEMENT_DATE'),
      content: nodeText(node, 'CONTENT_CN') || nodeText(node, 'CONTENT_EN'),
    })).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  function renderJourneySummary(items) {
    const el = document.getElementById('road-journey-summary');
    if (!el) return;
    const numeric = items.filter(i => i.journeyType === '1');
    const red = numeric.filter(i => i.colourId === '1').length;
    const yellow = numeric.filter(i => i.colourId === '2').length;
    const green = numeric.filter(i => i.colourId === '3').length;
    const updated = numeric[0]?.captureDate || '';
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:var(--sp-4)">
        <div><div class="big-num" style="font-size:var(--text-2xl);color:var(--primary)">${numeric.length}</div><div style="font-size:var(--text-xs);color:var(--text-faint)">行車時間</div></div>
        <div><div class="big-num" style="font-size:var(--text-2xl);color:var(--success)">${green}</div><div style="font-size:var(--text-xs);color:var(--text-faint)">綠色</div></div>
        <div><div class="big-num" style="font-size:var(--text-2xl);color:var(--warning)">${yellow}</div><div style="font-size:var(--text-xs);color:var(--text-faint)">黃色</div></div>
        <div><div class="big-num" style="font-size:var(--text-2xl);color:var(--error)">${red}</div><div style="font-size:var(--text-xs);color:var(--text-faint)">紅色</div></div>
      </div>
      <div style="margin-top:var(--sp-3);font-size:var(--text-xs);color:var(--text-faint)">資料時間：${escHtml(updated || '未提供')}</div>
    `;
  }

  function renderJourneyList(items) {
    const el = document.getElementById('road-journey-list');
    if (!el) return;
    const numeric = items.filter(i => i.journeyType === '1').slice(0, 48);
    el.innerHTML = numeric.map(item => `
      <div class="row-item">
        <div style="min-width:0">
          <div class="row-name">${escHtml(LOCATIONS[item.locationId] || item.locationId)} → ${escHtml(DESTINATIONS[item.destinationId] || item.destinationId)}</div>
          <div class="row-sub">${escHtml(item.locationId)} · ${escHtml(item.destinationId)}</div>
        </div>
        <span class="tag ${journeyClass(item)}">${escHtml(item.journeyData)} 分</span>
      </div>
    `).join('');
  }

  function renderNews(messages) {
    const summary = document.getElementById('road-news-summary');
    const list = document.getElementById('road-news-list');
    if (summary) {
      const active = messages.filter(m => m.status !== '完結' && String(m.status).toUpperCase() !== 'CLOSED').length;
      summary.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:var(--sp-4)">
          <div><div class="big-num" style="font-size:var(--text-2xl);color:var(--primary)">${messages.length}</div><div style="font-size:var(--text-xs);color:var(--text-faint)">消息</div></div>
          <div><div class="big-num" style="font-size:var(--text-2xl);color:var(--warning)">${active}</div><div style="font-size:var(--text-xs);color:var(--text-faint)">未完結</div></div>
        </div>
      `;
    }
    if (!list) return;
    if (!messages.length) {
      list.innerHTML = `<div class="row-item" style="color:var(--text-faint)">暫無特別交通消息</div>`;
      return;
    }
    list.innerHTML = messages.slice(0, 10).map(message => `
      <div class="row-item" style="display:block;padding:var(--sp-4)">
        <div style="display:flex;justify-content:space-between;gap:var(--sp-3);align-items:flex-start;margin-bottom:var(--sp-2)">
          <div>
            <div style="font-size:var(--text-base);font-weight:700;color:var(--text)">${escHtml(message.heading || message.detail)}</div>
            <div style="font-size:var(--text-xs);color:var(--text-muted)">${escHtml([message.location, message.direction].filter(Boolean).join(' · '))}</div>
          </div>
          <span class="tag ${message.status === '完結' ? 'tag-muted' : 'tag-yellow'}">${escHtml(message.status || '更新')}</span>
        </div>
        <div style="font-size:var(--text-xs);color:var(--text-faint);margin-bottom:var(--sp-2)">${escHtml(message.date)} · ${escHtml(message.number || message.id)}</div>
        <div style="font-size:var(--text-sm);color:var(--text-muted);line-height:1.6">${escHtml(message.content).slice(0, 220)}${message.content.length > 220 ? '…' : ''}</div>
      </div>
    `).join('');
  }

  async function refreshJourney() {
    const list = document.getElementById('road-journey-list');
    if (!list) return;
    list.innerHTML = `<div class="skel skel-p"></div><div class="skel skel-p" style="margin-top:8px;width:70%"></div>`;
    const doc = await fetchXml(JOURNEY_API);
    const items = parseJourneys(doc);
    renderJourneySummary(items);
    renderJourneyList(items);
  }

  async function refreshNews() {
    const list = document.getElementById('road-news-list');
    if (!list) return;
    list.innerHTML = `<div class="skel skel-p"></div><div class="skel skel-p" style="margin-top:8px;width:70%"></div>`;
    const doc = await fetchXml(NEWS_API);
    renderNews(parseMessages(doc));
  }

  async function refresh() {
    const updated = document.getElementById('road-updated');
    try {
      await Promise.all([refreshJourney(), refreshNews()]);
      if (updated) updated.textContent = `最後更新：${new Date().toLocaleTimeString('zh-HK', { hour12: false })}`;
    } catch (e) {
      const list = document.getElementById('road-news-list') || document.getElementById('road-journey-list');
      if (list) list.innerHTML = `<div class="row-item" style="color:var(--error)">道路交通資料載入失敗：${escHtml(e.message)}</div>`;
      if (updated) updated.textContent = '載入失敗';
    }
  }

  return { refresh };
})();
