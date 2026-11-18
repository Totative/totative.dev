// @ts-expect-error Runtime types come from `bun test`, not the app tsconfig.
import { expect, test } from 'bun:test'
import { codeToHtml } from 'shiki'
import { createCssVariablesTheme } from 'shiki/core'
import { tokenClasses } from './token-classes.ts'

// Astro's markdown highlighter, not the bundled theme named `css-variables`.
const theme = createCssVariablesTheme({ variablePrefix: '--astro-code-' })

const highlight = (code: string, lang: string): Promise<string> =>
  codeToHtml(code, { lang, theme, transformers: [tokenClasses] })

test('highlighted tokens keep colour as tok-* classes instead of inline style', async () => {
  const html = await highlight('const x = "hi"', 'javascript')
  expect(html).not.toContain('style=')
  expect(html).toContain('class="tok-keyword"')
  expect(html).toContain('class="tok-constant"')
  expect(html).toContain('class="tok-string-expression"')
})

test('a shell flag that Shiki files as a string is marked tok-flag', async () => {
  const html = await highlight('echo -n hi', 'bash')
  expect(html).toContain('class="tok-flag"> -n</span>')
  expect(html).toContain('class="tok-string"> hi</span>')
})

test('a span whose colour is not a token variable gets no tok class', async () => {
  const html = await highlight('echo \\\n -v', 'bash')
  expect(html).toContain('<span> \\</span>')
  expect(html).toContain('class="tok-flag"> -v</span>')
})
