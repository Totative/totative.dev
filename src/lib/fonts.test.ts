import { readFileSync } from 'node:fs'

const base = readFileSync(new URL('../layouts/Base.astro', import.meta.url), 'utf8')

// Two short <em> runs do not justify a ~38 KB italic font file on every page.
if (base.includes('wght-italic')) {
  throw new Error('Base.astro must not import the italic variable font')
}
