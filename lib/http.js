/* Small helpers shared by the API routes. */

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;          // Vercel already parsed it
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return {}; }
}

export function send(res, status, body, headers) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (headers) for (const k of Object.keys(headers)) res.setHeader(k, headers[k]);
  res.end(JSON.stringify(body));
}

export function fail(res, err) {
  const status = err && err.status ? err.status : 500;
  const message = status < 500 ? err.message : 'Server error: ' + (err && err.message ? err.message : String(err));
  send(res, status, { error: message }, { 'Cache-Control': 'no-store' });
}
