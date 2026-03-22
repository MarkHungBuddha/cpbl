import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3939;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  // CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Proxy: /proxy?url=<encoded full url>
  if (req.url.startsWith('/proxy?')) {
    const params = new URL(req.url, `http://localhost:${PORT}`).searchParams;
    const targetUrl = params.get('url');
    if (!targetUrl) { res.writeHead(400); res.end('Missing url param'); return; }

    try {
      const parsed = new URL(targetUrl);
      const proxyHeaders = {};
      // Forward relevant headers
      for (const [k, v] of Object.entries(req.headers)) {
        if (['host', 'origin', 'referer', 'connection', 'accept-encoding'].includes(k)) continue;
        proxyHeaders[k] = v;
      }
      proxyHeaders['host'] = parsed.host;

      // Collect request body
      const bodyChunks = [];
      for await (const chunk of req) bodyChunks.push(chunk);
      const body = Buffer.concat(bodyChunks);

      const options = {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method: req.method,
        headers: proxyHeaders,
      };

      const proxyReq = https.request(options, (proxyRes) => {
        // Remove CORS headers from upstream, we set our own
        const fwdHeaders = {};
        for (const [k, v] of Object.entries(proxyRes.headers)) {
          if (k.startsWith('access-control-')) continue;
          fwdHeaders[k] = v;
        }
        res.writeHead(proxyRes.statusCode, fwdHeaders);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (err) => {
        res.writeHead(502);
        res.end(JSON.stringify({ error: err.message }));
      });

      if (body.length > 0) proxyReq.write(body);
      proxyReq.end();
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Static file serving
  let filePath = req.url.split('?')[0];
  if (filePath === '/') filePath = '/index.html';
  const fullPath = path.join(__dirname, filePath);

  try {
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) throw new Error();
    const ext = path.extname(fullPath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(fullPath).pipe(res);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`\n  Rebas API Explorer running at:\n`);
  console.log(`  → http://localhost:${PORT}\n`);
  console.log(`  Proxy endpoint: /proxy?url=<encoded_url>\n`);
});
