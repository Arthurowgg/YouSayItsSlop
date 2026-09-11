// Marvel Pixel Royale — zero-dependency static + save-state server.
// Serves ./public and a tiny JSON API used by the client. The client also
// falls back to localStorage when the API is unreachable (e.g. file://).
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8080);
const ROOT = path.join(__dirname, 'public');
const DATA = path.join(__dirname, 'data');
const SAVE = path.join(DATA, 'save.json');
const CATALOG = path.join(DATA, 'catalog.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end(body);
}

function readSave() {
  try {
    return JSON.parse(fs.readFileSync(SAVE, 'utf8'));
  } catch {
    return null;
  }
}

// Loose server-side sanitization: keeps the save well-shaped so a real game
// backend can swap in later without rework.
function sanitize(input) {
  const d = readSave() || {};
  const out = { ...d };
  const num = (v, fb) => (Number.isFinite(Number(v)) ? Number(v) : fb);
  if ('coins' in input) out.coins = Math.max(0, Math.min(999999999, num(input.coins, d.coins ?? 500)));
  if ('level' in input) out.level = Math.max(1, Math.min(999, num(input.level, d.level ?? 1)));
  if ('xp' in input) out.xp = Math.max(0, num(input.xp, d.xp ?? 0));
  for (const k of ['owned', 'picks', 'gliders', 'emotes']) {
    if (Array.isArray(input[k])) out[k] = input[k].filter((x) => typeof x === 'string').slice(0, 500);
  }
  if (input.equipped && typeof input.equipped === 'object') {
    out.equipped = { ...d.equipped, ...input.equipped };
  }
  if (input.stats && typeof input.stats === 'object') {
    out.stats = { ...d.stats };
    for (const [k, v] of Object.entries(input.stats)) out.stats[k] = Math.max(0, num(v, 0));
  }
  if (input.tasks && typeof input.tasks === 'object') out.tasks = input.tasks;
  if (input.dev && typeof input.dev === 'object') out.dev = { ...d.dev, ...input.dev };
  if ('day' in input) out.day = String(input.day);
  out.updatedAt = Date.now();
  return out;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname;

  if (p === '/api/state' && req.method === 'GET') {
    const s = readSave();
    return send(res, s ? 200 : 404, JSON.stringify(s || { empty: true }), 'application/json');
  }
  if (p === '/api/state' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c).length > 1e6 && req.destroy());
    req.on('end', () => {
      try {
        const next = sanitize(JSON.parse(body || '{}'));
        fs.mkdirSync(DATA, { recursive: true });
        fs.writeFileSync(SAVE, JSON.stringify(next, null, 2));
        send(res, 200, JSON.stringify({ ok: true }), 'application/json');
      } catch (e) {
        send(res, 400, JSON.stringify({ error: String(e) }), 'application/json');
      }
    });
    return;
  }
  if (p === '/api/state' && req.method === 'DELETE') {
    try { fs.unlinkSync(SAVE); } catch {}
    return send(res, 200, JSON.stringify({ ok: true }), 'application/json');
  }
  if (p === '/api/catalog') {
    try {
      return send(res, 200, fs.readFileSync(CATALOG, 'utf8'), 'application/json');
    } catch (e) {
      return send(res, 500, JSON.stringify({ error: String(e) }), 'application/json');
    }
  }
  if (p === '/api/ping') return send(res, 200, JSON.stringify({ ok: true, t: Date.now() }), 'application/json');

  // expose read-only data (catalog) for static fallbacks
  if (p.startsWith('/data/')) {
    const f = path.normalize(path.join(DATA, p.slice(6)));
    if (!f.startsWith(DATA)) return send(res, 403, 'no');
    return fs.readFile(f, (err, buf) =>
      err ? send(res, 404, 'no') : send(res, 200, buf, MIME[path.extname(f)] || 'application/octet-stream')
    );
  }

  // static
  let file = path.normalize(path.join(ROOT, p === '/' ? 'index.html' : p));
  if (!file.startsWith(ROOT)) return send(res, 403, 'no');
  fs.readFile(file, (err, buf) => {
    if (err) {
      // SPA-ish fallback
      return fs.readFile(path.join(ROOT, 'index.html'), (e2, b2) =>
        e2 ? send(res, 404, 'not found') : send(res, 404, b2, MIME['.html'])
      );
    }
    send(res, 200, buf, MIME[path.extname(file)] || 'application/octet-stream');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Marvel Pixel Royale menu server on http://0.0.0.0:${PORT}`);
});
