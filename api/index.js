const KEY = (process.env.OANDA_API_KEY || '').trim();
const ACC = (process.env.OANDA_ACCOUNT_ID || '').trim();
const ENV = (process.env.OANDA_ENV || 'practice').toLowerCase() === 'trade' ? 'trade' : 'practice';
const ROOT = `https://api-fx${ENV}.oanda.com`;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method === 'OPTIONS') return res.status(204).end();

  const urlPath = new URL(req.url, 'http://x').pathname;
  let path = urlPath.replace(/^\/api/, '');
  if (path === '') path = '/';

  try {
    if (path === '/oanda/v3/health') {
      return res.status(200).json({ proxy: 1, backend: 'vercel', version: 3, hasKey: !!KEY, hasAccount: !!ACC, oandaEnv: ENV });
    }

    if (!KEY || !ACC) return res.status(500).json({ error: 'OANDA credentials missing' });

    let forwardPath = path.replace('/oanda', '');
    forwardPath = forwardPath.replace(/\/accounts\/(_)(\/|$)/g, '/accounts/' + ACC + '$2');
    forwardPath = forwardPath.replace(/\/accounts\/(\/|$)/g, '/accounts/' + ACC + '$1');

    const qs = new URLSearchParams();
    for (const k of Object.keys(req.query)) {
      if (k === 'path' || k === 't' || k === 'cache' || k === '_') continue;
      qs.set(k, String(req.query[k]));
    }
    const target = ROOT + forwardPath + (qs.toString() ? '?' + qs.toString() : '');
    
    const r = await fetch(target, { headers: { Authorization: 'Bearer ' + KEY, 'Accept-Datetime-Format': 'RFC3339' } });
    const body = await r.text();
    return res.status(r.status).send(body);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
