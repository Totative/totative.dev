import sitemap from '@astrojs/sitemap'
import { defineConfig } from 'astro/config'
import { tokenClasses } from './src/lib/token-classes.ts'

export default defineConfig({
  site: 'https://totative.dev',
  trailingSlash: 'always',
  integrations: [sitemap()],
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
