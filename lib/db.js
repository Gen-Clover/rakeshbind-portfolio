/*
 * Storage for the recommendations.
 *
 * Production (Vercel): Neon Postgres. DATABASE_URL (or POSTGRES_URL) is injected when you
 * add a Neon database from the project's Storage tab. Tables are created on first use.
 *
 * Local development without a database: when DATABASE_URL is missing and we are not on
 * Vercel, the API reads and writes public/recommendations.json instead, so
 * `vercel dev` works end to end with nothing to set up.
 */
import { neon } from '@neondatabase/serverless';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const REL = { d: 'Direct report', p: 'Team peer', x: 'Cross-team', s: 'Senior colleague' };
const LIMITS = { items: 200, name: 120, title: 400, text: 6000, url: 500 };

let sql = null;
let schemaReady = null;

function connectionString() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
}
function useFile() {
  return !connectionString() && !process.env.VERCEL;
}
function db() {
  if (!sql) {
    const url = connectionString();
    if (!url) throw new Error('DATABASE_URL is not set. Add a Neon Postgres database to the Vercel project (Storage tab) and redeploy.');
    sql = neon(url);
  }
  return sql;
}

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db()`create table if not exists recommendations (
        id text primary key,
        position integer not null,
        name text not null,
        initials text not null default '',
        color text not null default '#8FA0FF',
        title text not null default '',
        rel_type text not null default 'd',
        relationship text not null default '',
        date_label text not null default '',
        profile text not null default '',
        hidden boolean not null default false,
        body text not null default '',
        updated_at timestamptz not null default now()
      )`;
      await db()`create table if not exists site_settings (
        key text primary key,
        value jsonb not null
      )`;
    })().catch((e) => { schemaReady = null; throw e; });
  }
  return schemaReady;
}

/* ---------- validation / normalisation shared by both back-ends ---------- */
function str(v, max) { return String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, max); }
function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

export function normaliseDoc(doc) {
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.items)) throw new ValidationError('Body must be an object with an items array.');
  if (doc.items.length > LIMITS.items) throw new ValidationError(`At most ${LIMITS.items} recommendations are supported.`);
  const seen = new Set();
  const items = doc.items.map((r, i) => {
    if (!r || typeof r !== 'object') throw new ValidationError(`Item ${i + 1} is not an object.`);
    const name = str(r.name, LIMITS.name);
    const text = str(r.text, LIMITS.text);
    if (!name) throw new ValidationError(`Item ${i + 1} needs a name.`);
    if (!text) throw new ValidationError(`"${name}" needs the recommendation text.`);
    const color = /^#[0-9a-f]{6}$/i.test(String(r.color || '')) ? String(r.color).toUpperCase() : '#8FA0FF';
    const relType = REL[r.relType] ? r.relType : 'd';
    let id = slug(r.id) || slug(name) || `rec-${i + 1}`;
    while (seen.has(id)) id = id.replace(/(-\d+)?$/, (m) => `-${(parseInt(m.slice(1), 10) || 1) + 1}`);
    seen.add(id);
    const profile = str(r.profile, LIMITS.url);
    if (profile && !/^https?:\/\//i.test(profile)) throw new ValidationError(`"${name}": the profile link must start with http:// or https://.`);
    return {
      id, name, text, color, relType,
      initials: str(r.initials, 3).toUpperCase(),
      title: str(r.title, LIMITS.title),
      relationship: str(r.relationship, 80) || REL[relType],
      date: str(r.date, 40),
      profile,
      hidden: !!r.hidden
    };
  });
  const featured = Math.min(50, Math.max(1, parseInt(doc.featured, 10) || 6));
  return { featured, items };
}

export class ValidationError extends Error {
  constructor(message) { super(message); this.status = 400; }
}

function rowToItem(row) {
  return {
    id: row.id, name: row.name, initials: row.initials, color: row.color, title: row.title,
    relType: row.rel_type, relationship: row.relationship, date: row.date_label, profile: row.profile,
    hidden: row.hidden, text: row.body
  };
}

/* ---------- file back-end (local dev only) ---------- */
const PUBLIC_DIR = path.join(process.cwd(), 'public');            // static site root (served by Vercel)
const FILE = path.join(PUBLIC_DIR, 'recommendations.json');
async function fileRead() {
  try {
    const doc = JSON.parse(await readFile(FILE, 'utf8'));
    return { updated: doc.updated || null, featured: doc.featured || 6, items: (doc.items || []), source: 'file' };
  } catch (e) {
    if (e.code === 'ENOENT') return { updated: null, featured: 6, items: [], source: 'file' };
    throw e;
  }
}
async function fileWrite(doc) {
  const out = { updated: new Date().toISOString().slice(0, 10), featured: doc.featured, items: doc.items };
  await writeFile(FILE, JSON.stringify(out, null, 2) + '\n', 'utf8');
}

/* ---------- public API used by the route handlers ---------- */
export async function readAll() {
  if (useFile()) return fileRead();
  await ensureSchema();
  const rows = await db()`select * from recommendations order by position asc, name asc`;
  const settings = await db()`select value from site_settings where key = 'recommendations'`;
  const meta = settings[0] ? settings[0].value : {};
  return { updated: meta.updated || null, featured: meta.featured || 6, items: rows.map(rowToItem), source: 'db' };
}

export async function replaceAll(input) {
  const doc = normaliseDoc(input);
  if (useFile()) { await fileWrite(doc); return doc; }
  await ensureSchema();
  const now = new Date().toISOString();
  const meta = JSON.stringify({ featured: doc.featured, updated: now.slice(0, 10) });
  const queries = [
    db()`delete from recommendations`,
    ...doc.items.map((r, i) => db()`insert into recommendations
      (id, position, name, initials, color, title, rel_type, relationship, date_label, profile, hidden, body, updated_at)
      values (${r.id}, ${i}, ${r.name}, ${r.initials}, ${r.color}, ${r.title}, ${r.relType}, ${r.relationship}, ${r.date}, ${r.profile}, ${r.hidden}, ${r.text}, ${now})`),
    db()`insert into site_settings (key, value) values ('recommendations', ${meta}::jsonb)
      on conflict (key) do update set value = excluded.value`
  ];
  await db().transaction(queries);
  return doc;
}

/* ---------- resume (single file) ---------- */
/*
 * Production: stored as bytea in site_files (key = 'resume'). Local dev without a database:
 * written to public/resume/Rakesh-Bind-Resume.pdf with resume.json holding the original
 * filename. The committed copy in public/resume/ is also the static fallback on Vercel when nothing
 * has been uploaded yet.
 */
export const RESUME_PUBLIC_PATH = '/resume/Rakesh-Bind-Resume.pdf';
export const RESUME_MAX_BYTES = 3 * 1024 * 1024;
const RESUME_FILE = path.join(PUBLIC_DIR, 'resume', 'Rakesh-Bind-Resume.pdf');
const RESUME_META = path.join(PUBLIC_DIR, 'resume', 'resume.json');

async function ensureFilesTable() {
  await ensureSchema();
  await db()`create table if not exists site_files (
    key text primary key,
    filename text not null,
    mime text not null,
    size integer not null,
    data bytea not null,
    updated_at timestamptz not null default now()
  )`;
}

async function fileResumeMeta() {
  try { return { ...JSON.parse(await readFile(RESUME_META, 'utf8')), source: 'file' }; }
  catch { return null; }
}

/* Metadata only (no bytes). Returns null when nothing is stored. */
export async function resumeMeta() {
  if (useFile()) return fileResumeMeta();
  await ensureFilesTable();
  const rows = await db()`select filename, mime, size, updated_at from site_files where key = 'resume'`;
  if (!rows[0]) return null;
  return { filename: rows[0].filename, mime: rows[0].mime, size: rows[0].size, updated: new Date(rows[0].updated_at).toISOString(), source: 'db' };
}

/* Full file. Returns { filename, mime, size, updated, data: Buffer } or null. */
export async function readResume() {
  if (useFile()) {
    const meta = await fileResumeMeta();
    try {
      const data = await readFile(RESUME_FILE);
      return { filename: meta?.filename || 'Rakesh-Bind-Resume.pdf', mime: 'application/pdf', size: data.length, updated: meta?.updated || null, data, source: 'file' };
    } catch { return null; }
  }
  await ensureFilesTable();
  const rows = await db()`select filename, mime, size, updated_at, encode(data, 'base64') as b64 from site_files where key = 'resume'`;
  if (!rows[0]) return null;
  return { filename: rows[0].filename, mime: rows[0].mime, size: rows[0].size, updated: new Date(rows[0].updated_at).toISOString(), data: Buffer.from(rows[0].b64, 'base64'), source: 'db' };
}

export async function saveResume({ filename, data }) {
  if (!Buffer.isBuffer(data) || data.length === 0) throw new ValidationError('No file received.');
  if (data.length > RESUME_MAX_BYTES) throw new ValidationError(`The PDF is ${(data.length / 1048576).toFixed(1)} MB; the limit is ${RESUME_MAX_BYTES / 1048576} MB. Export a compressed PDF and try again.`);
  if (data.subarray(0, 5).toString('latin1') !== '%PDF-') throw new ValidationError('Only PDF files are accepted.');
  const clean = String(filename || 'resume.pdf').replace(/[\/:*?"<>|\r\n]+/g, ' ').trim().slice(0, 120) || 'resume.pdf';
  const name = /\.pdf$/i.test(clean) ? clean : clean + '.pdf';
  const updated = new Date().toISOString();
  if (useFile()) {
    await writeFile(RESUME_FILE, data);
    await writeFile(RESUME_META, JSON.stringify({ filename: name, mime: 'application/pdf', size: data.length, updated }, null, 2) + '\n', 'utf8');
    return { filename: name, mime: 'application/pdf', size: data.length, updated, source: 'file' };
  }
  await ensureFilesTable();
  const b64 = data.toString('base64');
  await db()`insert into site_files (key, filename, mime, size, data, updated_at)
    values ('resume', ${name}, 'application/pdf', ${data.length}, decode(${b64}, 'base64'), ${updated})
    on conflict (key) do update set filename = excluded.filename, mime = excluded.mime, size = excluded.size, data = excluded.data, updated_at = excluded.updated_at`;
  return { filename: name, mime: 'application/pdf', size: data.length, updated, source: 'db' };
}

/* ---------- availability badge (one JSON document) ---------- */
/*
 * Production: site_settings row with key = 'availability'. Local dev without a database:
 * public/availability.json, which is also the committed seed and the static fallback on Vercel
 * until the admin publishes for the first time.
 */
const AVAIL_FILE = path.join(PUBLIC_DIR, 'availability.json');
const AVAIL_LIMITS = { facts: 4, label: 30, value: 90 };
/* Status keys the badge understands (labels and colours live in public/assets/js/recs.js) */
const AVAIL_STATUS = ['open', 'notice', 'freelance', 'passive', 'joined', 'busy'];

export function normaliseAvailability(doc) {
  if (!doc || typeof doc !== 'object') throw new ValidationError('Body must be an object.');
  const status = str(doc.status, 40).toLowerCase();
  if (!AVAIL_STATUS.includes(status)) throw new ValidationError('Status must be one of: ' + AVAIL_STATUS.join(', ') + '.');
  const facts = (Array.isArray(doc.facts) ? doc.facts : [])
    .map((f) => ({ label: str(f && f.label, AVAIL_LIMITS.label), value: str(f && f.value, AVAIL_LIMITS.value) }))
    .filter((f) => f.label || f.value);
  if (facts.length > AVAIL_LIMITS.facts) throw new ValidationError(`At most ${AVAIL_LIMITS.facts} facts are supported.`);
  facts.forEach((f, i) => { if (!f.label || !f.value) throw new ValidationError(`Fact ${i + 1} needs both a label and a value.`); });
  return { show: doc.show !== false, status, facts };
}

export async function readAvailability() {
  if (useFile()) {
    try { return { ...JSON.parse(await readFile(AVAIL_FILE, 'utf8')), source: 'file' }; }
    catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  }
  await ensureSchema();
  const rows = await db()`select value from site_settings where key = 'availability'`;
  return rows[0] ? { ...rows[0].value, source: 'db' } : null;
}

export async function replaceAvailability(input) {
  const doc = { ...normaliseAvailability(input), updated: new Date().toISOString().slice(0, 10) };
  if (useFile()) { await writeFile(AVAIL_FILE, JSON.stringify(doc, null, 2) + '\n', 'utf8'); return doc; }
  await ensureSchema();
  await db()`insert into site_settings (key, value) values ('availability', ${JSON.stringify(doc)}::jsonb)
    on conflict (key) do update set value = excluded.value`;
  return doc;
}
