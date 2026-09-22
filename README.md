# Portfolio — Rakesh Bind

A static portfolio site with a small serverless back-end so parts of it (recommendations,
resume) can be managed from an admin page. Everything runs on free tiers: Vercel Hobby for
hosting + functions, Neon Postgres (via Vercel Storage) for data.

## Layout

```
public/                     static front-end — the only folder Vercel serves as files
  index.html                the portfolio (hash routes: #/, #/work, #/about, #/what-people-say, #/what-people-say/<id>, #/contact)
  admin.html                the admin app, served at /admin (login → hub → recommendations / resume / availability / career)
  assets/css/site.css       theme tokens (dark + light palettes) + components, shared by both pages
  assets/css/admin.css      admin-only styles
  assets/js/theme.js        shared: dark by default, applies a saved light choice before first paint, wires the toggle
  assets/js/recs.js         shared: recommendation card model/markup + API helper (window.RB)
  assets/js/site.js         public site: routing, animations, loads cards from the API
  assets/js/admin.js        admin: auth, hub routing, Recommendations and Resume modules
  recommendations.json      seed cards; fallback when the API is empty; local-dev store
  availability.json         seed for the Open-to-work badge; fallback until published; local-dev store
  career.json               seed for the Home timeline roles; fallback until published; local-dev store
  resume/                   committed resume PDF; fallback download; local-dev store
api/                        Vercel serverless functions (one file = one route)
  auth.js                   GET session status · POST {password} · POST {action:"logout"}
  recommendations.js        GET list (public) · PUT replace list (admin)
  resume.js                 GET download (public) · GET ?meta=1 · PUT replace PDF (admin)
  availability.js           GET badge (public) · PUT replace badge (admin)
  career.js                 GET roles (public) · PUT replace roles (admin)
lib/                        server-only code, never served
  db.js                     Neon Postgres storage (tables auto-created) + JSON/file fallback for local dev
  auth.js                   password check + signed HttpOnly session cookie
  http.js                   JSON request/response helpers
dev-server.mjs              local stand-in for Vercel: serves public/ and runs api/
vercel.json                 outputDirectory=public, cleanUrls (/admin), cache/robots headers
```

### How data flows

```
visitor  ──GET /api/recommendations──▶ api ──▶ lib/db.js ──▶ Neon Postgres
         ◀── JSON (edge-cached 30 s) ──┘        (falls back to public/recommendations.json if empty)

admin    ──POST /api/auth {password}──▶ sets HttpOnly cookie (12 h)
         ──PUT  /api/recommendations──▶ cookie checked ──▶ replace all rows in one transaction
         ──PUT  /api/resume {pdf}─────▶ cookie checked ──▶ stored as bytea in site_files
```

Adding an admin module = one tile + one `<section class="view" id="m-…">` in `admin.html`, one
entry in `MODULES` in `admin.js`, and (if it needs data) one route in `api/`.

## Run locally

```powershell
npm install
npm run dev:local        # http://localhost:3000   admin: http://localhost:3000/admin
```

With no `DATABASE_URL` the API reads and writes `public/recommendations.json` and
`public/resume/` directly, and the admin password defaults to `admin`. Put real values in
`.env.local` (see `.env.example`) to mirror production. Restart the server after editing
files in `api/` or `lib/`. `npm run dev` uses Vercel's own dev server if you have the CLI linked.

## Deploy on Vercel (free)

1. Push this folder to a Git repository and import it in Vercel (**Add New → Project**).
   Framework preset *Other*; leave build command empty. Output directory is set by `vercel.json`.
2. **Storage → Create Database → Neon Postgres → Free → Connect** to the project
   (injects `DATABASE_URL`; tables are created on first request).
3. **Settings → Environment Variables → `ADMIN_PASSWORD`** (long and random). Optional
   `ADMIN_SESSION_SECRET` if sessions should survive a password change.
4. **Redeploy**, then open `https://<site>.vercel.app/admin`, sign in:
   - *Recommendations* → **Import from file** → **Publish** (seeds the database with the 11 cards)
   - *Resume* → upload a PDF (≤ 3 MB) or keep the committed copy as-is

## Limits worth knowing

- Resume uploads are capped at 3 MB (Vercel function bodies are limited to 4.5 MB, base64 adds a
  third). The committed 4.1 MB copy still works as the download; export a compressed PDF for uploads.
- Neon's free tier suspends idle databases; the first request after a quiet period can take a
  second or two. Visitors are unaffected thanks to edge caching and the JSON fallback.
- The admin page is public HTML, but every write is verified server-side against the session
  cookie; nothing can be changed without the password.
