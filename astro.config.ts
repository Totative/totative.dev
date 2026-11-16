import { readdirSync } from 'node:fs'
import sitemap from '@astrojs/sitemap'
import { defineConfig } from 'astro/config'
import { sitemapLastmod } from './src/lib/sitemap-lastmod.ts'
import { tokenClasses } from './src/lib/token-classes.ts'

const WRITEUP_FILE = /^(\d{4}-\d{2}-\d{2})-(.+)\.md$/

const writeupDates = new Map<string, string>(
  readdirSync(new URL('./src/content/writeups', import.meta.url)).flatMap((name) => {
    const match = WRITEUP_FILE.exec(name)
    const date = match?.[1]
    const slug = match?.[2]
    return date && slug ? [[slug, date]] : []
  }),
)

const builtAt = new Date()

export default defineConfig({
  site: 'https://totative.dev',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      serialize(item) {
        item.lastmod = sitemapLastmod(item.url, writeupDates, builtAt).toISOString()
        return item
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
