/*
 * GET  /api/auth              -> { admin: boolean, configured: boolean }
 * POST /api/auth  {password}  -> sets the session cookie
 * POST /api/auth  {action:"logout"}
 */
import { checkPassword, clearSessionCookie, isAdmin, isConfigured, issueToken, setSessionCookie } from '../lib/auth.js';
import { fail, readJson, send } from '../lib/http.js';

export default async function handler(req, res) {
  try {
    const noStore = { 'Cache-Control': 'no-store' };
    if (req.method === 'GET') return send(res, 200, { admin: isAdmin(req), configured: isConfigured() }, noStore);
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' }, { Allow: 'GET, POST', ...noStore });

    const body = await readJson(req);
    if (body.action === 'logout') {
      clearSessionCookie(res);
      return send(res, 200, { admin: false }, noStore);
    }
    if (!isConfigured()) return send(res, 500, { error: 'ADMIN_PASSWORD is not set on the server. Add it in Vercel > Settings > Environment Variables and redeploy.' }, noStore);
    if (!checkPassword(body.password)) {
      await new Promise((r) => setTimeout(r, 700));                     // slow down guessing
      return send(res, 401, { error: 'Wrong password.' }, noStore);
    }
    setSessionCookie(res, issueToken());
    return send(res, 200, { admin: true }, noStore);
  } catch (e) {
    return fail(res, e);
  }
}
