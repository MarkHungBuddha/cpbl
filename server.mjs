import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3939;
const CACHE_DIR = path.join(__dirname, '.cache');

// ==========================================
// File-based proxy cache
// ==========================================
// Game detail (finished) = immutable → 30 days
// Game list / season data = mutable  → 5 minutes
const TTL_LONG = 30 * 24 * 60 * 60 * 1000; // 30 days
const TTL_SHORT = 5 * 60 * 1000;            // 5 minutes

function getCacheTTL(apiPath) {
  // /api/seasons/{id}/games/{gameId} — single game detail, immutable once finished
  if (/\/api\/seasons\/[^/]+\/games\/[^/?]+$/.test(apiPath)) return TTL_LONG;
  // Everything else (game list, season standings, etc.) — short TTL
  return TTL_SHORT;
}

function getCacheKey(url) {
  // Deterministic filename from URL
  const { pathname, search } = new URL(url);
  const safe = (pathname + search).replace(/[^a-zA-Z0-9_-]/g, '_');
  return safe.slice(0, 200) + '.json';
}

function readCache(key, ttl) {
  const filePath = path.join(CACHE_DIR, key);
  try {
    const stat = fs.statSync(filePath);
    if (Date.now() - stat.mtimeMs > ttl) return null; // expired
    return fs.readFileSync(filePath);
  } catch {
    return null;
  }
}

function writeCache(key, statusCode, headers, body) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const payload = JSON.stringify({ statusCode, headers, body: body.toString('base64') });
    fs.writeFileSync(path.join(CACHE_DIR, key), payload);
  } catch {
    // cache write failure is non-fatal
  }
}

function serveCached(res, cached) {
  const { statusCode, headers, body } = JSON.parse(cached.toString());
  const buf = Buffer.from(body, 'base64');
  res.writeHead(statusCode, headers);
  res.end(buf);
}

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

      // Check cache for GET requests
      const isGet = req.method === 'GET';
      const cacheKey = isGet ? getCacheKey(targetUrl) : null;
      const ttl = isGet ? getCacheTTL(parsed.pathname) : 0;

      if (isGet && cacheKey) {
        const cached = readCache(cacheKey, ttl);
        if (cached) {
          serveCached(res, cached);
          return;
        }
      }

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

        // Collect response body for caching
        if (isGet && cacheKey && proxyRes.statusCode >= 200 && proxyRes.statusCode < 300) {
          const chunks = [];
          proxyRes.on('data', c => chunks.push(c));
          proxyRes.on('end', () => {
            const respBody = Buffer.concat(chunks);
            writeCache(cacheKey, proxyRes.statusCode, fwdHeaders, respBody);
            res.writeHead(proxyRes.statusCode, fwdHeaders);
            res.end(respBody);
          });
        } else {
          res.writeHead(proxyRes.statusCode, fwdHeaders);
          proxyRes.pipe(res);
        }
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
