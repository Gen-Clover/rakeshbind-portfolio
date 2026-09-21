/*
 * Admin session handling.
 *
 * ADMIN_PASSWORD (env var) is the only credential. A successful login sets an HttpOnly,
 * SameSite=Strict cookie holding an HMAC-signed expiry, so the browser never sees a token
 * and nothing is stored in localStorage. ADMIN_SESSION_SECRET is optional: if unset, the
 * signing key is derived from the password, so changing the password logs everyone out.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const COOKIE = 'rb_admin';
const TTL_SECONDS = 12 * 60 * 60;

function secret() {
  return process.env.ADMIN_SESSION_SECRET || createHash('sha256').update('rb-admin:' + (process.env.ADMIN_PASSWORD || '')).digest('hex');
}
function sign(payload) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}
function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

export function isConfigured() {
  return !!process.env.ADMIN_PASSWORD;
}
export function checkPassword(candidate) {
  return isConfigured() && safeEqual(candidate || '', process.env.ADMIN_PASSWORD);
}

export function issueToken() {
  const body = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + TTL_SECONDS })).toString('base64url');
  return body + '.' + sign(body);
}
export function verifyToken(token) {
  if (!token || typeof token !== 'string') return false;
  const [body, sig] = token.split('.');
  if (!body || !sig || !safeEqual(sig, sign(body))) return false;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')).exp > Date.now() / 1000; }
  catch { return false; }
}

function readCookie(req) {
  const m = (req.headers.cookie || '').match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}
export function isAdmin(req) {
  return verifyToken(readCookie(req));
}
export function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=${TTL_SECONDS}`);
}
export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=0`);
}
