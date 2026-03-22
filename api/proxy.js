export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: 'Missing url param' });

  try {
    const parsed = new URL(targetUrl);

    // Forward relevant headers
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

    // Forward body for non-GET requests
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const upstream = await fetch(targetUrl, fetchOptions);

    // Forward response headers, excluding CORS (we set our own)
    for (const [k, v] of upstream.headers.entries()) {
      if (k.startsWith('access-control-')) continue;
      if (['transfer-encoding', 'content-encoding'].includes(k)) continue;
      res.setHeader(k, v);
    }

    const body = await upstream.arrayBuffer();
    res.status(upstream.status).send(Buffer.from(body));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
