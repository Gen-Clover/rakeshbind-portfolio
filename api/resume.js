/*
 * GET /api/resume          -> downloads the current resume PDF
 *                             (falls back to the committed copy in /resume when nothing was uploaded)
 * GET /api/resume?meta=1   -> { exists, filename, size, updated, source }
 * PUT /api/resume          -> admin only; JSON { filename, data (base64 PDF) } replaces the resume
 */
import { isAdmin } from '../lib/auth.js';
import { fail, readJson, send } from '../lib/http.js';
import { readResume, resumeMeta, saveResume, RESUME_MAX_BYTES, RESUME_PUBLIC_PATH, ValidationError } from '../lib/db.js';

const NO_STORE = { 'Cache-Control': 'no-store' };

export default async function handler(req, res) {
  try {
    const wantsMeta = 'meta' in (req.query || {}) || /[?&]meta/.test(req.url || '');

    if (req.method === 'GET' && wantsMeta) {
      const meta = await resumeMeta();
      if (meta) return send(res, 200, { exists: true, ...meta, maxBytes: RESUME_MAX_BYTES }, NO_STORE);
      return send(res, 200, { exists: true, filename: 'Rakesh-Bind-Resume.pdf', source: 'repo', url: RESUME_PUBLIC_PATH, maxBytes: RESUME_MAX_BYTES }, NO_STORE);
    }

    if (req.method === 'GET') {
      const file = await readResume();
      if (!file) {                                     // nothing uploaded yet: serve the committed copy
        res.statusCode = 302;
        res.setHeader('Location', RESUME_PUBLIC_PATH);
        res.setHeader('Cache-Control', 'no-store');
        return res.end();
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', String(file.data.length));
      res.setHeader('Content-Disposition', 'attachment; filename="' + file.filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '') + '"; filename*=UTF-8\'\'' + encodeURIComponent(file.filename));
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=600');
      res.setHeader('X-Robots-Tag', 'noindex');
      return res.end(file.data);
    }

    if (req.method === 'PUT') {
      if (!isAdmin(req)) return send(res, 401, { error: 'Please sign in again.' }, NO_STORE);
      const body = await readJson(req);
      if (!body || typeof body.data !== 'string') throw new ValidationError('Send JSON with { filename, data } where data is the base64-encoded PDF.');
      const data = Buffer.from(body.data, 'base64');
      const meta = await saveResume({ filename: body.filename, data });
      return send(res, 200, { ok: true, ...meta }, NO_STORE);
    }

    return send(res, 405, { error: 'Method not allowed' }, { Allow: 'GET, PUT', ...NO_STORE });
  } catch (e) {
    return fail(res, e);
  }
}
