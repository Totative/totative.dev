# totative.dev

Astro 7 static site for <https://totative.dev>. Bun for install, scripts, and the Docker build stage; Caddy serves `dist/` in production.

## Commands

```sh
bun install
bun run dev
bun run check
bun run build
bun run preview
bun run scan
```

`scan` expects a preview (or the container) already running; it does not start one. `check` runs `astro-check` through `bunx` with its own TypeScript 6, because it needs the JavaScript compiler API that TypeScript 7 does not ship; the project itself is on 7.

## CSP

No inline script, inline style, or `style` attributes, ever. Astro is configured with `inlineStylesheets: "never"` and Vite `assetsInlineLimit: 0` so scripts and sheets stay files that `'self'` can load. The production Caddyfile sends a strict CSP; `scripts/scan_runtime.py` is the runtime check.

## Layout

Lattice is the site. `src/pages/index.astro` is home, write-ups are `/writeups/` and `/writeups/<slug>/`, layout is `src/layouts/Base.astro`. Copy lives in `src/data/site.ts` and `src/content/writeups/`.
