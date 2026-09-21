/*
 * Minimal local server that mimics Vercel: static files from ./public plus /api/* routes
 * from ./api. Run with `npm run dev:local` and open http://localhost:3000.
 *
 * Without DATABASE_URL the API stores the cards in public/recommendations.json (see lib/db.js).
 * Put ADMIN_PASSWORD (and optionally DATABASE_URL) in .env.local to mirror production.
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const site = path.join(root, 'public');                                   // static files, same layout Vercel serves
const port = Number(process.env.PORT) || 3000;
const types = { '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain' };

try {
  const env = await readFile(path.join(root, '.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* no .env.local */ }

if (!process.env.ADMIN_PASSWORD) {
  process.env.ADMIN_PASSWORD = 'admin';
  console.log('ADMIN_PASSWORD not set: using "admin" for this local session (put a real one in .env.local).');
}
console.log(process.env.DATABASE_URL ? 'Using Postgres from DATABASE_URL.' : 'No DATABASE_URL: the API will read/write recommendations.json.');

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    const name = url.pathname.slice(5).replace(/[^a-z0-9_-]/gi, '');
    let mod;
    try { mod = await import(pathToFileURL(path.join(root, 'api', name + '.js')).href); }
    catch (e) {
      const missing = e.code === 'ERR_MODULE_NOT_FOUND' && String(e.message).includes(name + '.js');
      if (!missing) console.error('API route ' + name + ' failed to load:', e);
      res.statusCode = missing ? 404 : 500; res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: missing ? 'No such API route' : 'API route failed to load: ' + e.message + ' (restart the dev server after editing files in lib/ or api/)' }));
    }
    req.query = Object.fromEntries(url.searchParams);
    return mod.default(req, res);
  }
  let file = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  if (/^\/[a-z0-9-]+$/i.test(file)) file += '.html';                       // clean URLs like /admin -> admin.html (as vercel.json cleanUrls)
  const abs = path.join(site, file);
  if (!abs.startsWith(site)) { res.statusCode = 404; return res.end('Not found'); }
  try {
    const data = await readFile(abs);
    res.setHeader('Content-Type', types[path.extname(abs)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.end(data);
  } catch { res.statusCode = 404; res.end('Not found'); }
}).listen(port, () => console.log('Portfolio running at http://localhost:' + port + '  (admin: http://localhost:' + port + '/admin)'));
