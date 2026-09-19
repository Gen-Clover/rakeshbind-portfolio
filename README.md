# Rakesh Bind — AI Product Portfolio

A zero-cost, static portfolio website designed for an AI Product Manager / AI Product Owner profile.

## Included

- Premium dark AI/SaaS visual design
- Responsive desktop/tablet/mobile layout
- Hero positioning around AI product leadership
- 5 selected project case studies
- Interactive case-study modal
- Product-thinking section
- Experience timeline
- Skills
- Contact CTA
- Provided ABRAMS architecture image
- No GenClover branding
- No paid libraries required

## Before publishing

1. Replace the LinkedIn placeholder in `index.html`:
   `https://www.linkedin.com/in/`
   with your real LinkedIn profile URL.
2. Review the project wording and remove/change anything you do not want publicly disclosed.
3. Add your professional photo later if you decide to use one.
4. Add remaining projects when you capture/share their details.

## Deploy on Vercel (recommended)

### Easiest method — GitHub + Vercel

1. Create/sign in to GitHub.
2. Create a new repository, e.g. `rakeshbind-portfolio`.
3. Upload everything inside this folder to the repository.
4. Go to Vercel and sign in with GitHub.
5. Choose **Add New → Project**.
6. Import `rakeshbind-portfolio`.
7. Framework preset: **Other** (or leave auto-detected).
8. Build command: leave empty.
9. Output directory: leave empty.
10. Deploy.

Vercel will provide a free `*.vercel.app` URL. Recommended project name: `rakeshbind-portfolio`; if available, use `rakeshbind-portfolio.vercel.app` as the production URL.

### Alternative — Vercel CLI

If Node.js is installed:

```bash
npm i -g vercel
vercel
```

Run it from the portfolio folder and follow the prompts.

## Deploy on GitHub Pages

1. Create a GitHub repository.
2. Upload the files.
3. Open **Settings → Pages**.
4. Select **Deploy from a branch**.
5. Select `main` and `/ (root)`.
6. Save.

GitHub will provide a free `username.github.io/repository-name` URL.

## Important

The site is intentionally static. There is no backend, database, API key, or paid hosting dependency.

The portfolio currently uses Google Fonts through an external stylesheet. If you need a fully offline build, replace the font import in `styles.css` with local/system fonts.

## Suggested next updates

- Add the actual LinkedIn URL.
- Add downloadable resume.
- Add 2–4 additional case studies as project details become available.
- Add 3–5 AI Product Insights articles.
- Add a professional photo if desired.
- Add real, evidence-backed outcomes/metrics only where you have permission and supporting data.
