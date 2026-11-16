// @ts-expect-error Runtime types come from `bun test`, not the app tsconfig.
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { sitemapLastmod } from './lib/sitemap-lastmod.ts'

const head = readFileSync(new URL('./components/Head.astro', import.meta.url), 'utf8')
const base = readFileSync(new URL('./layouts/Base.astro', import.meta.url), 'utf8')
const notFound = readFileSync(new URL('./pages/404.astro', import.meta.url), 'utf8')
const manifest = readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8')
const appleTouch = new URL('../public/apple-touch-icon.png', import.meta.url)
const caddy = readFileSync(new URL('../Caddyfile', import.meta.url), 'utf8')

test('indexable pages emit an absolute canonical URL', () => {
  expect(head).toContain('rel="canonical"')
  expect(head).toContain('href={pageUrl}')
  expect(base).toContain('pageUrl={pageUrl}')
  expect(base).toContain("new URL(path, 'https://totative.dev/').href")
})

test('Caddy 301s index.html duplicates onto the directory URL', () => {
  expect(caddy).toContain('@indexhtml path_regexp indexhtml ^(.*/)index\\.html$')
  expect(caddy).toContain('redir @indexhtml {re.indexhtml.1} 301')
})

test('sitemap lastmod uses the write-up date, otherwise the build time', () => {
  const now = new Date('2026-11-16T12:00:00.000Z')
  const dates = new Map([['checking-a-totative-release', '2026-11-10']])
  expect(
    sitemapLastmod('https://totative.dev/writeups/checking-a-totative-release/', dates, now),
  ).toEqual(new Date('2026-11-10T00:00:00.000Z'))
  expect(sitemapLastmod('https://totative.dev/', dates, now)).toEqual(now)
  expect(sitemapLastmod('https://totative.dev/writeups/', dates, now)).toEqual(now)
})

test('apple-touch-icon is a 180 PNG linked from head and the manifest', () => {
  expect(head).toContain('rel="apple-touch-icon"')
  expect(head).toContain('href="/apple-touch-icon.png"')
  expect(manifest).toContain('/apple-touch-icon.png')
  const png = readFileSync(appleTouch)
  expect(png.readUInt32BE(16)).toBe(180)
  expect(png.readUInt32BE(20)).toBe(180)
})

test('large twitter cards include twitter:image and alt', () => {
  expect(base).toContain('name="twitter:card"')
  expect(base).toContain('content="summary_large_image"')
  expect(base).toContain('name="twitter:image"')
  expect(base).toContain('content="https://totative.dev/og.png"')
  expect(base).toContain('name="twitter:image:alt"')
})

test('404 is noindex and omits og:url and canonical', () => {
  expect(notFound).toContain('noindex')
  expect(head).toContain('name="robots"')
  expect(head).toContain('noindex, follow')
  expect(head).toContain('pageUrl && !noindex')
  expect(base).toContain('{!noindex && <meta property="og:url"')
})
