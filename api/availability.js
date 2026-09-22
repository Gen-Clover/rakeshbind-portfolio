/*
 * GET /api/availability   -> public, { show, status, facts[{label,value}], updated }
 *                            (404 until the admin has published once; the site then keeps its built-in copy)
 * PUT /api/availability   -> admin only; body { show, status, facts[] } replaces the document
 */
import { isAdmin } from '../lib/auth.js';
import { fail, readJson, send } from '../lib/http.js';
import { readAvailability, replaceAvailability } from '../lib/db.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const doc = await readAvailability();
      const fresh = 'fresh' in (req.query || {}) || /[?&]fresh/.test(req.url || '');
      const cache = fresh ? 'no-store' : 'public, max-age=0, s-maxage=30, stale-while-revalidate=300';
      if (!doc) return send(res, 404, { error: 'Not published yet' }, { 'Cache-Control': cache });
      return send(res, 200, doc, { 'Cache-Control': cache });
    }
    if (req.method === 'PUT') {
      if (!isAdmin(req)) return send(res, 401, { error: 'Please sign in again.' }, { 'Cache-Control': 'no-store' });
      const doc = await replaceAvailability(await readJson(req));
      return send(res, 200, doc, { 'Cache-Control': 'no-store' });
    }
    return send(res, 405, { error: 'Method not allowed' }, { Allow: 'GET, PUT', 'Cache-Control': 'no-store' });
  } catch (e) {
    return fail(res, e);
  }
}
