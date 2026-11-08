// ... (kode forecast dan macro di atasnya biarkan sama) ...

// ⬇️ GUNAKAN FORMAT INI ⬇️
module.exports = async (req, res) => {
  // 1. Header CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method === 'OPTIONS') return res.status(204).end();

  // 2. Ambil path dari URL
  const urlPath = new URL(req.url, 'http://x').pathname;
  let path = urlPath.replace(/^\/api/, '');
  if (path === '') path = '/';

  try {
    // ... (sisa logika routing seperti health check, OANDA, forecast, macro) ...
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
