# DSLR Snap website

Marketing site for DSLR Snap – Photo Booth Software for Windows. Next.js 16 (App Router) + Tailwind CSS 4, hosted on Vercel.

## Develop

```bash
cd website
npm install
npm run dev      # http://localhost:3000
npm run lint
npm run build    # production build; every route is prerendered static
```

## Where things are

| Path | What |
|---|---|
| `src/lib/site.ts` | Name, description, contact email, site URL |
| `src/app/globals.css` | Theme tokens, copied from the app's `src/renderer/src/styles.css` |
| `src/app/page.tsx` | The landing page (feature, FAQ and step copy live at the top of the file) |
| `src/components/` | Header, footer, logo, icons, booth screen and print mockups |
| `src/app/opengraph-image.tsx` | Social share image |

Keep the colors in `globals.css` in sync with the app when the app's theme changes.

## Deploy on Vercel

1. Import the GitHub repo in Vercel.
2. Set **Root Directory** to `website`. Framework preset is detected as Next.js.
3. Deploy. Canonical URLs, `sitemap.xml` and `robots.txt` use `VERCEL_PROJECT_PRODUCTION_URL`, which Vercel sets automatically. Add your custom domain in Project → Domains.
