const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const root = __dirname;
const port = Number(process.env.PORT || 8001);
const host = process.env.HOST || '0.0.0.0';
const storageDir = process.env.DKG_STORAGE_DIR ? path.resolve(process.env.DKG_STORAGE_DIR) : root;
const sharedDbPath = path.join(storageDir, 'shared-db.json');
const eventClients = new Set();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.apk': 'application/vnd.android.package-archive',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

function loadDotEnv() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (key && !process.env[key]) process.env[key] = value;
  }
}

function ensureStorageDir() {
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
}

function send(res, statusCode, body, contentType = 'text/plain; charset=utf-8') {
  const headers = {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  res.writeHead(statusCode, headers);
  res.end(body);
}

function sendJson(res, statusCode, body) {
  send(res, statusCode, JSON.stringify(body), 'application/json; charset=utf-8');
}

function broadcastSharedUpdate(updatedAt) {
  const payload = `event: shared-db-updated\ndata: ${JSON.stringify({ updatedAt })}\n\n`;
  for (const res of eventClients) {
    try {
      res.write(payload);
    } catch (_) {
      eventClients.delete(res);
    }
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) {
        reject(new Error('Request body is too large.'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function handleSharedDb(req, res) {
  if (req.method === 'GET') {
    if (!fs.existsSync(sharedDbPath)) {
      sendJson(res, 404, { success: false, error: 'Shared database is not initialized yet.' });
      return;
    }
    send(res, 200, fs.readFileSync(sharedDbPath, 'utf8'), 'application/json; charset=utf-8');
    return;
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const payload = body ? JSON.parse(body) : null;
    if (!payload || !payload.data) {
      sendJson(res, 400, { success: false, error: 'Missing shared database payload.' });
      return;
    }

    const updatedAt = payload.updatedAt || Date.now();
    const saved = { success: true, updatedAt, data: payload.data };
    fs.writeFileSync(sharedDbPath, JSON.stringify(saved, null, 2), 'utf8');
    broadcastSharedUpdate(updatedAt);
    sendJson(res, 200, { success: true, updatedAt });
    return;
  }

  sendJson(res, 405, { success: false, error: 'Method not allowed.' });
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let cleanPath = decodeURIComponent(url.pathname);
  if (cleanPath === '/') cleanPath = '/index.html';
  cleanPath = cleanPath.replace(/^\/+/, '');

  const filePath = path.resolve(root, cleanPath);
  if (!filePath.startsWith(root)) {
    send(res, 403, 'Forbidden');
    return;
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    send(res, 404, '404 - File Not Found');
    return;
  }

  const stat = fs.statSync(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const type = mimeTypes[extension] || 'application/octet-stream';
  const headers = {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Access-Control-Allow-Origin': '*'
  };
  if (extension === '.apk') {
    headers['Content-Disposition'] = 'attachment; filename="DKG-Online.apk"';
  }
  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(filePath).pipe(res);
}

function handleEvents(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  res.write(`event: connected\ndata: ${JSON.stringify({ success: true, time: Date.now() })}\n\n`);
  const keepAlive = setInterval(() => {
    try {
      res.write(`event: ping\ndata: ${Date.now()}\n\n`);
    } catch (_) {
      clearInterval(keepAlive);
      eventClients.delete(res);
    }
  }, 25000);
  eventClients.add(res);
  req.on('close', () => {
    clearInterval(keepAlive);
    eventClients.delete(res);
  });
}

function getLanUrls() {
  const urls = [`http://localhost:${port}/`];
  const nets = os.networkInterfaces();
  for (const interfaces of Object.values(nets)) {
    for (const item of interfaces || []) {
      if (item.family === 'IPv4' && !item.internal) {
        urls.push(`http://${item.address}:${port}/`);
      }
    }
  }
  return urls;
}

loadDotEnv();
ensureStorageDir();

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      send(res, 204, '');
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/api/health') {
      sendJson(res, 200, { success: true, time: new Date().toISOString() });
      return;
    }
    if (url.pathname === '/api/events') {
      handleEvents(req, res);
      return;
    }
    if (url.pathname === '/api/shared-db') {
      await handleSharedDb(req, res);
      return;
    }
    serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { success: false, error: error.message || 'Server error.' });
  }
});

server.listen(port, host, () => {
  console.log('==================================================');
  console.log('        DKG ONLINE SHARED BACKEND SERVER          ');
  console.log('==================================================');
  console.log('Open this app from any phone on the same network:');
  for (const url of getLanUrls()) console.log(`  ${url}`);
});
