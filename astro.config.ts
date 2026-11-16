import { readdirSync } from 'node:fs'
import sitemap from '@astrojs/sitemap'
import { defineConfig } from 'astro/config'
import { sitemapLastmod } from './src/lib/sitemap-lastmod.ts'
import { tokenClasses } from './src/lib/token-classes.ts'

const WRITEUP_FILE = /^(\d{4}-\d{2}-\d{2})-(.+)\.md$/

const writeupDates = new Map(
  readdirSync(new URL('./src/content/writeups', import.meta.url)).flatMap((name) => {
    const match = WRITEUP_FILE.exec(name)
    return match ? ([[match[2], match[1]]] as const) : []
  }),
)

const builtAt = new Date()

export default defineConfig({
  site: 'https://totative.dev',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      serialize(item) {
        return { ...item, lastmod: sitemapLastmod(item.url, writeupDates, builtAt) }
      },
    }),
  ],
  server: { host: '0.0.0.0', port: 4321 },
  build: {
    inlineStylesheets: 'never',
  },
  devToolbar: { enabled: false },
  vite: {
    // Keep small scripts and sheets as files so CSP can allow them via 'self'.
    build: { assetsInlineLimit: 0 },
    server: { allowedHosts: true },
    preview: { allowedHosts: true },
  },
  markdown: {
    shikiConfig: { theme: 'css-variables', transformers: [tokenClasses] },
  },
})
