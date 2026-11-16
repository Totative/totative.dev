// @ts-expect-error Runtime types come from `bun test`, not the app tsconfig.
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const head = readFileSync(new URL('./components/Head.astro', import.meta.url), 'utf8')
const base = readFileSync(new URL('./layouts/Base.astro', import.meta.url), 'utf8')
const notFound = readFileSync(new URL('./pages/404.astro', import.meta.url), 'utf8')

test('indexable pages emit an absolute canonical URL', () => {
  expect(head).toContain('rel="canonical"')
  expect(head).toContain('href={pageUrl}')
  expect(base).toContain('pageUrl={pageUrl}')
  expect(base).toContain("new URL(path, 'https://totative.dev/').href")
})

test('404 is noindex and omits og:url and canonical', () => {
  expect(notFound).toContain('noindex')
  expect(head).toContain('name="robots"')
  expect(head).toContain('noindex, follow')
  expect(head).toContain('pageUrl && !noindex')
  expect(base).toContain('{!noindex && <meta property="og:url"')
})
