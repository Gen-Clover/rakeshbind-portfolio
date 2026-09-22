/*
 * GET /api/career   -> public, { updated, items[] }
 *                            (404 until the admin has published once; the site then keeps the copy inside index.html)
 * PUT /api/career   -> admin only; body { items[] } replaces the list
 */
import { isAdmin } from '../lib/auth.js';
import { fail, readJson, send } from '../lib/http.js';
import { readCareer, replaceCareer } from '../lib/db.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const doc = await readCareer();
      const fresh = 'fresh' in (req.query || {}) || /[?&]fresh/.test(req.url || '');
      const cache = fresh ? 'no-store' : 'public, max-age=0, s-maxage=30, stale-while-revalidate=300';
      if (!doc) return send(res, 404, { error: 'Not published yet' }, { 'Cache-Control': cache });
      return send(res, 200, doc, { 'Cache-Control': cache });
    }
    if (req.method === 'PUT') {
      if (!isAdmin(req)) return send(res, 401, { error: 'Please sign in again.' }, { 'Cache-Control': 'no-store' });
      const doc = await replaceCareer(await readJson(req));
      return send(res, 200, doc, { 'Cache-Control': 'no-store' });
    }
    return send(res, 405, { error: 'Method not allowed' }, { Allow: 'GET, PUT', 'Cache-Control': 'no-store' });
  } catch (e) {
    return fail(res, e);
  }
}
