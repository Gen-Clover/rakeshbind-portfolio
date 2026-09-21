/*
 * GET /api/recommendations   -> public, { updated, featured, items[] }
 * PUT /api/recommendations   -> admin only; body { featured, items[] } replaces everything
 */
import { isAdmin } from '../lib/auth.js';
import { fail, readJson, send } from '../lib/http.js';
import { readAll, replaceAll } from '../lib/db.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const doc = await readAll();
      const fresh = 'fresh' in (req.query || {}) || /[?&]fresh/.test(req.url || '');
      return send(res, 200, doc, {
        'Cache-Control': fresh ? 'no-store' : 'public, max-age=0, s-maxage=30, stale-while-revalidate=300'
      });
    }
    if (req.method === 'PUT') {
      if (!isAdmin(req)) return send(res, 401, { error: 'Please sign in again.' }, { 'Cache-Control': 'no-store' });
      const body = await readJson(req);
      await replaceAll(body);
      const doc = await readAll();
      return send(res, 200, doc, { 'Cache-Control': 'no-store' });
    }
    return send(res, 405, { error: 'Method not allowed' }, { Allow: 'GET, PUT', 'Cache-Control': 'no-store' });
  } catch (e) {
    return fail(res, e);
  }
}
