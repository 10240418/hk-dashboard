/* ============================================================
   finance.js — Exchange Rates (HKD) + Hang Seng Index
   香港城市儀表板 v2
   ============================================================ */

'use strict';

const IS_LOCAL_DEV = typeof window !== 'undefined' && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
const FX_API = 'https://api.frankfurter.dev/v1/latest?base=HKD&symbols=USD,CNY,GBP,JPY,EUR';
const LOCAL_FX_API = '/api/finance/fx';
const LOCAL_HSI_API = '/api/finance/hsi';
const FINANCE_CACHE_KEYS = {
  fx: 'hk-dashboard:finance:fx',
  hsi: 'hk-dashboard:finance:hsi'
};
const HSI_FALLBACK_DATA = {
  meta: {
    regularMarketPrice: 25872.32,
    regularMarketTimeText: '2026-04-14 10:08:40'
  },
  session: {
    open: 25660.85,
    high: 25994.23,
    low: 25660.85
  }
};

/* ── Currency display labels ──────────────────────────────── */
const CURRENCY_LABELS = {
  USD: 'USD 美元',
  CNY: 'CNY 人民幣',
  GBP: 'GBP 英鎊',
  JPY: 'JPY 日圓',
  EUR: 'EUR 歐元',
};

function getCachedFinanceData (key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setCachedFinanceData (key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {}
}

function renderExchangeRates (payload, meta) {
  const el = document.getElementById('fin-fx');
  if (!el) return;

  const rates = payload && payload.rates ? payload.rates : {};
  const date = payload && payload.date ? payload.date : '';
  const entries = Object.entries(rates);

  if (!entries.length) {
    el.innerHTML = '<div class="row-item"><span style="color:var(--error)">無法載入匯率</span></div>';
    return;
  }

  el.innerHTML = entries.map(function ([ccy, rate]) {
    const label = CURRENCY_LABELS[ccy] || ccy;
    const displayRate = ccy === 'JPY' ? (1 / rate).toFixed(2) : (1 / rate).toFixed(4);
    return '<div class="row-item">' +
      '<span class="row-name">1 ' + label + '</span>' +
      '<span class="row-val">HK$\u00a0' + displayRate + '</span>' +
      '</div>';
  }).join('') +
  (date ? '<div style="font-size:10px;color:var(--text-faint);margin-top:var(--sp-2)">匯率日期 ' + date + '</div>' : '');

  const sub = document.getElementById('fin-fx-sub');
  if (sub) {
    const suffix = meta && meta.sourceLabel ? ' · ' + meta.sourceLabel : '';
    sub.textContent = date ? '更新日期 ' + date + suffix : '即時匯率' + suffix;
  }
}

function renderHSI (payload, metaInfo) {
  const el = document.getElementById('fin-hsi');
  if (!el) return;

  const meta = payload && payload.meta ? payload.meta : null;
  const session = payload && payload.session ? payload.session : null;

  if (!meta) {
    el.innerHTML = '<div class="row-item"><span style="color:var(--error)">無法載入恒指</span></div>';
    return;
  }

  const price = meta.regularMarketPrice;
  const prev = typeof meta.chartPreviousClose === 'number' ? meta.chartPreviousClose : null;
  const baseline = prev !== null ? prev : (session && typeof session.open === 'number' ? session.open : null);
  const baselineLabel = prev !== null ? '前收市' : '較開市';
  const change = baseline !== null ? price - baseline : 0;
  const pct = baseline ? (change / baseline) * 100 : 0;
  const isUp = change >= 0;
  const sign = isUp ? '+' : '';
  const color = isUp ? 'var(--success)' : 'var(--error)';
  const arrow = isUp ? '▲' : '▼';

  el.innerHTML =
    '<div style="display:flex;align-items:flex-end;gap:var(--sp-3);flex-wrap:wrap">' +
      '<div>' +
        '<div style="font-size:var(--text-xs);color:var(--text-faint);margin-bottom:2px">恒生指數 Hang Seng Index</div>' +
        '<div class="big-num" style="color:' + color + '">' + price.toLocaleString('en-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</div>' +
      '</div>' +
      '<div style="padding-bottom:4px">' +
        '<span style="font-size:var(--text-sm);color:' + color + ';font-weight:700">' +
          arrow + ' ' + sign + change.toFixed(2) + ' (' + sign + pct.toFixed(2) + '%)' +
        '</span>' +
        (baseline !== null
          ? '<div style="font-size:10px;color:var(--text-faint)">' + baselineLabel + ' ' + baseline.toFixed(2) + '</div>'
          : '') +
        (session
          ? '<div style="font-size:10px;color:var(--text-faint)">高 ' + session.high.toFixed(2) + ' · 低 ' + session.low.toFixed(2) + '</div>'
          : '') +
      '</div>' +
    '</div>';

  const sub = document.getElementById('fin-hsi-sub');
  if (sub) {
    const t = meta.regularMarketTime;
    const dt = meta.regularMarketTimeText || (t ? new Date(t * 1000).toLocaleTimeString('zh-HK', { hour12: false }) : '');
    const suffix = metaInfo && metaInfo.sourceLabel ? ' · ' + metaInfo.sourceLabel : '';
    sub.textContent = dt ? '更新 ' + dt + suffix : '即時' + suffix;
  }
}

/* ── Fetch exchange rates ─────────────────────────────────── */
async function fetchExchangeRates () {
  const el = document.getElementById('fin-fx');
  if (!el) return;
  el.innerHTML = skelHtml(5);
  try {
    const url = IS_LOCAL_DEV ? LOCAL_FX_API : FX_API;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('FX HTTP ' + res.status);
    const data = await res.json();
    renderExchangeRates(data, { sourceLabel: IS_LOCAL_DEV ? 'Frankfurter 本地代理' : 'Frankfurter 官方 API' });
    setCachedFinanceData(FINANCE_CACHE_KEYS.fx, data);
  } catch (e) {
    console.error('FX fetch error:', e);
    const cached = getCachedFinanceData(FINANCE_CACHE_KEYS.fx);
    if (cached) {
      renderExchangeRates(cached, { sourceLabel: '快取資料' });
      return;
    }
    if (el) el.innerHTML = '<div class="row-item"><span style="color:var(--error)">無法載入匯率</span></div>';
  }
}

/* ── Fetch Hang Seng Index ────────────────────────────────── */
async function fetchHSI () {
  const el = document.getElementById('fin-hsi');
  if (!el) return;
  el.innerHTML = skelHtml(2);
  try {
    if (!IS_LOCAL_DEV) throw new Error('Local HSI proxy unavailable');
    const res = await fetch(LOCAL_HSI_API, { cache: 'no-store' });
    if (!res.ok) throw new Error('HSI HTTP ' + res.status);
    const data = await res.json();
    renderHSI(data, { sourceLabel: data.sourceLabel || '本地代理' });
    setCachedFinanceData(FINANCE_CACHE_KEYS.hsi, data);
  } catch (e) {
    console.error('HSI fetch error:', e);
    const cached = getCachedFinanceData(FINANCE_CACHE_KEYS.hsi);
    if (cached) {
      renderHSI(cached, { sourceLabel: '快取資料' });
      return;
    }
    renderHSI(HSI_FALLBACK_DATA, { sourceLabel: '內置備援資料' });
  }
}

/* ── Public API ─────────────────────────────────────────── */
window.Finance = {
  fetchExchangeRates: fetchExchangeRates,
  fetchHSI: fetchHSI,
  refresh: async function () {
    await Promise.all([fetchExchangeRates(), fetchHSI()]);
  }
};
