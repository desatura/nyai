// DTS Proxy — OANDA (semua pair) + Forecast + Macro
// Deploy ke Vercel via GitHub. Cukup satu file.

const KEY = (process.env.OANDA_API_KEY || '').trim();
const ACC = (process.env.OANDA_ACCOUNT_ID || '').trim();
const ENV = (process.env.OANDA_ENV || 'practice').toLowerCase() === 'trade' ? 'trade' : 'practice';
const ROOT = `https://api-fx${ENV}.oanda.com`;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Content-Type': 'application/json',
};

async function forecast() {
  const items = [], status = {}, quotes = {};
  for (const file of ['ff_calendar_thisweek.json', 'ff_calendar_nextweek.json']) {
    try {
      const r = await fetch(`https://nfs.faireconomy.media/${file}`, { headers: { 'User-Agent': 'DTS-Forecast/3' } });
      if (!r.ok) { status[file] = 'HTTP ' + r.status; continue; }
      const j = await r.json();
      for (const x of j) items.push({ title: x.title, country: x.country, impact: x.impact, t: new Date(x.date).getTime(), url: x.url || '', src: 'ForexFactory', forecast: x.forecast, previous: x.previous });
      status[file] = 'ok';
    } catch (e) { status[file] = e.message; }
  }
  const syms = { dxy: 'DX-Y.NYB', us10y: '^TNX', wti: 'CL=F', vix: '^VIX', spx: '^GSPC', brent: 'BZ=F' };
  await Promise.all(Object.entries(syms).map(async ([k, s]) => {
    try {
      const u = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?interval=1h&range=5d`;
      const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!r.ok) { status[k] = 'HTTP ' + r.status; return; }
      const j = await r.json(), res2 = j && j.chart && j.chart.result && j.chart.result[0], m = (res2 && res2.meta) || {};
      const closes = (((res2 && res2.indicators && res2.indicators.quote && res2.indicators.quote[0] && res2.indicators.quote[0].close) || [])).filter(Number.isFinite);
      const p = m.regularMarketPrice != null ? m.regularMarketPrice : closes[closes.length - 1];
      const prev = m.chartPreviousClose != null ? m.chartPreviousClose : (m.previousClose != null ? m.previousClose : (closes.length > 1 ? closes[closes.length - 2] : p));
      const d5 = closes.length > 5 ? closes[closes.length - 5] : prev;
      if (Number.isFinite(p)) { quotes[k] = { p, prev, d5 }; status[k] = 'ok'; } else status[k] = 'no price';
    } catch (e) { status[k] = e.message; }
  }));
  return { items, quotes, status, updated: new Date().toISOString() };
}

async function macro() {
  const data = {}, status = {}, errors = {};
  const syms = { dxy: { s: 'DX-Y.NYB', dec: 4 }, us10y: { s: '^TNX', dec: 2 }, wti: { s: 'CL=F', dec: 2 }, brent: { s: 'BZ=F', dec: 2 }, vix: { s: '^VIX', dec: 2 }, spx: { s: '^GSPC', dec: 2 } };
  await Promise.all(Object.entries(syms).map(async ([k, c]) => {
    try {
      const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(c.s)}?interval=1d&range=5d`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!r.ok) { status[k] = 'HTTP ' + r.status; return; }
      const j = await r.json(), m = (j && j.chart && j.chart.result && j.chart.result[0] && j.chart.result[0].meta) || {};
      const p = m.regularMarketPrice, prev = m.chartPreviousClose != null ? m.chartPreviousClose : m.previousClose;
      if (!Number.isFinite(p)) { status[k] = 'NOFEED'; return; }
      const chg = Number.isFinite(prev) ? ((p - prev) / prev * 100) : 0;
      data[k] = { value: p.toFixed(c.dec), note: (chg >= 0 ? '+' : '') + chg.toFixed(2) + '% hari ini', asOf: new Date().toISOString().slice(0, 16) };
      status[k] = 'LIVE';
    } catch (e) { status[k] = 'NOFEED'; errors[k] = e.message; }
  }));
  return { data, status, errors, updated: new Date().toISOString() };
}

module.exports = async (req, res) => {
  for (const k of Object.keys(CORS)) res.setHeader(k, CORS[k]);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const urlPath = new URL(req.url, 'http://x').pathname;
  let path = urlPath.replace(/^\/api/, '');
  if (path === '') path = '/';

  try {
    if (path === '/forecast') return res.status(200).json(await forecast());
    if (path === '/macro') return res.status(200).json(await macro());

    if (path === '/oanda' || path === '/oanda/') {
      const ins = String(req.query.instrument || '').toUpperCase();
      if (!KEY || !ACC) return res.status(500).json({ error: 'OANDA credentials missing' });
      if (!ins) return res.status(400).json({ error: '?instrument= required. Daftar semua pair: GET /api/oanda/v3/accounts/_/instruments' });
      const r = await fetch(`${ROOT}/v3/accounts/${ACC}/pricing?instruments=${encodeURIComponent(ins)}`, { headers: { Authorization: 'Bearer ' + KEY, 'Accept-Datetime-Format': 'RFC3339' } });
      if (!r.ok) return res.status(r.status).send(await r.text());
      const j = await r.json(), p = j && j.prices && j.prices[0];
      if (!p) return res.status(404).json({ error: 'instrument ' + ins + ' tidak ada' });
      const bid = Number(p.bids[0].price), ask = Number(p.asks[0].price);
      return res.status(200).json({ bid, ask, mid: (bid + ask) / 2, instrument: p.instrument, time: p.time, tradeable: p.tradeable !== false });
    }

    if (path.startsWith('/oanda/v3/')) {
      if (!KEY || !ACC) return res.status(500).json({ error: 'OANDA credentials missing' });
      const sub = path.replace('/oanda', '');
      if (sub === '/v3/health') return res.status(200).json({ proxy: 1, backend: 'vercel', version: 3, hasKey: true, hasAccount: true, oandaEnv: ENV });

      let forwardPath = sub;
      forwardPath = forwardPath.replace(/\/accounts\/(_)(\/|$)/g, '/accounts/' + ACC + '$2');
      forwardPath = forwardPath.replace(/\/accounts\/(\/|$)/g, '/accounts/' + ACC + '$1');

      const qs = new URLSearchParams();
      for (const k of Object.keys(req.query)) {
        if (k === 't' || k === 'cache' || k === '_') continue;
        qs.set(k, String(req.query[k]));
      }
      const target = ROOT + forwardPath + (qs.toString() ? '?' + qs.toString() : '');
      const r = await fetch(target, { headers: { Authorization: 'Bearer ' + KEY, 'Accept-Datetime-Format': 'RFC3339' } });
      const body = await r.text();
      res.setHeader('Cache-Control', /\/candles/.test(forwardPath) ? 'public, max-age=3' : 'no-store');
      return res.status(r.status).send(body);
    }

    return res.status(404).json({ error: 'not found', path });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
