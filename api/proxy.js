export default async function handler(req, res) {
  // CORS 設置
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: 'Missing url param' });

  try {
    const parsed = new URL(targetUrl);

    // 準備轉發的 Header
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (['host', 'origin', 'referer', 'connection', 'accept-encoding', 'x-vercel-id', 'x-real-ip', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto'].includes(k)) continue;
      headers[k] = v;
    }
    headers['host'] = parsed.host;

    const fetchOptions = {
      method: req.method,
      headers,
    };

    // 轉發非 GET 請求的 Body
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const upstream = await fetch(targetUrl, fetchOptions);

    // 轉發原始 Response Header，但過濾掉可能會衝突的部分
    for (const [k, v] of upstream.headers.entries()) {
      if (k.startsWith('access-control-')) continue;
      if (['transfer-encoding', 'content-encoding', 'cache-control'].includes(k)) continue;
      res.setHeader(k, v);
    }

    // ==========================================
    // Vercel Serverless Cache 策略
    // ==========================================
    if (req.method === 'GET' && upstream.status === 200) {
      const apiPath = parsed.pathname;
      // 已結束的單場比賽詳細資料 (/api/seasons/{id}/games/{gameId}) — 視為永久不變
      const isImmutableGame = /\/api\/seasons\/[^/]+\/games\/[^/?]+$/.test(apiPath);

      if (isImmutableGame) {
        // 快取 30 天 (2592000秒)，且在背景靜默更新 (SWR)
        res.setHeader('Cache-Control', 'public, s-maxage=2592000, stale-while-revalidate=86400');
      } else {
        // 其他資料（賽程、排行、球員清單） — 快取 5 分鐘 (300秒)
        res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
      }
    } else {
      // 錯誤或非 GET 請求不快取
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    }

    const body = await upstream.arrayBuffer();
    res.status(upstream.status).send(Buffer.from(body));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
