# 

## Features

- URL + language form (EN, KO, HI, ES, FR, DE, JA, ZH)
- Route discovery via `sitemap.xml` with BFS link crawl fallback
- Respects `robots.txt` and rate-limits requests
- Cheerio HTML extraction → keys like `home.title`, `about.p.0`
- LibreTranslate adapter with glossary protection and demo fallback
- Progress stream, JSON preview, ZIP download (`locales/en.json`, `locales/ko.json`, …)

## Prerequisites

- Node.js 20+
- Optional: [Docker](https://www.docker.com/) for a local LibreTranslate server

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Copy `.env.example` to `.env.local` if you want to point at a local translator:

```bash
copy .env.example .env.local
```

## Translation (how to get a real translated ZIP)

Order used by the app:

1. **LibreTranslate** at `LIBRETRANSLATE_URL` (if reachable)
2. **MyMemory** free API (automatic fallback — no key)
3. **Demo mode** only if both fail (`[lang]` prefixes)

### Local LibreTranslate with Docker (optional)

```bash
docker run -d --name libretranslate -p 5000:5000 libretranslate/libretranslate
```

First start can take several minutes while language models load. Then in `.env.local`:

```
LIBRETRANSLATE_URL=http://localhost:5000
```

Restart `npm run dev` after changing env.

Without Docker, MyMemory still produces real translations for the ZIP (rate-limited for heavy crawls — keep max pages low, e.g. 5–10).

Force demo mode with:

```
TRANSLATE_DEMO_MODE=1
```

## Usage

1. Enter a public website URL (start with a small site for the demo).
2. Pick source and target languages.
3. Optionally add glossary lines: `BrandName=BrandName`.
4. Click **Start generation** and watch progress.
5. Preview JSON per language, then **Download ZIP**.

The ZIP contains:

```
locales/
  en.json
  ko.json
```

Keys are shared across files so you can drop them into i18next (or similar).

## Safety & limits (trailer)

- Honors `robots.txt` `Disallow` / `Allow` for `User-agent: *`
- Default delay ~600ms between page fetches (or `Crawl-delay` from robots)
- Max **25** pages per run (default 15)
- Download only — nothing is auto-deployed
- JS-heavy SPAs / login walls are not fully supported (no headless browser in this trailer)

## Project scripts

| Command       | Description              |
| ------------- | ------------------------ |
| `npm run dev` | Local development server |
| `npm run build` | Production build       |
| `npm run start` | Run production server  |
| `npm run lint`  | ESLint                 |

## Deploy on Netlify (SSR API routes)

`/api/health` and `/api/generate` are Next.js **Route Handlers** (serverless functions). They are supported by `@netlify/plugin-nextjs` — do **not** use `next export` / static-only publish.

### Windows CLI (important)

On Windows, Netlify’s plugin often fails with:

- `EPERM symlink … cheerio` → fixed by not externalizing cheerio
- `Failed publishing static content` → Windows cannot `rename` the `.next` folder while Cursor/VS Code has files open under it

**Do this:**

1. Close any editor tabs under `.next/` (e.g. `.next/server/app/index.html`).
2. Run:

```bash
npx netlify build
npm run netlify:publish-fix
npx netlify deploy --prod
```

`netlify build` may still print “Failed publishing static content” — that is OK if **Functions bundling completed**. Then `netlify:publish-fix` finishes the swap with copy instead of rename, and `netlify deploy --prod` uploads the site.

### Prefer: Git deploy (no Windows CLI bug)

Connect the GitHub/GitLab repo in the Netlify UI and let Netlify build in the cloud. That avoids local symlink/rename issues entirely.

**Limits on Netlify:** function timeouts are short on free plans. Crawls are capped (`NETLIFY_MAX_PAGES`, default 5). Prefer a small public site for demos. Long crawls work best with `npm run dev` locally.

## Health check

`GET /api/health` reports whether the configured LibreTranslate URL is reachable.

## Future (out of trailer scope)

- Paid translators (OpenAI, Azure, Google)
- Puppeteer/Playwright for SPA crawl
- Deep Strapi / WordPress API connectors
- Hosted deploy on Vercel + separate worker

## License

MIT — trailer demo for local experimentation.
