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

// ... (fungsi forecast() dan macro() biarkan sama seperti sebelumnya) ...

// ⬇️ PERHATIKAN BAGIAN INI ⬇️
// Menggunakan 'export default' untuk Vercel
export default async function handler(req, res) {
  for (const k of Object.keys(CORS)) res.setHeader(k, CORS[k]);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const urlPath = new URL(req.url, 'http://x').pathname;
  let path = urlPath.replace(/^\/api/, '');
  if (path === '') path = '/';

  try {
    // ... (sisa logika routing di dalamnya tetap sama) ...

    // Health Check
    if (path === '/oanda/v3/health') return res.status(200).json({ proxy: 1, backend: 'vercel', version: 3, hasKey: !!KEY, hasAccount: !!ACC, oandaEnv: ENV });
    
    // ... (logika untuk /forecast, /macro, /oanda, /oanda/v3/*) ...
    
    return res.status(404).json({ error: 'not found', path });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
