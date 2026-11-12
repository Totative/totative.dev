import * as fc from 'fast-check'

import { escapeXml } from './escape-xml.ts'

const cases: Array<readonly [string, string]> = [
  ['&<>"\'', '&amp;&lt;&gt;&quot;&apos;'],
  ['plain', 'plain'],
  ['a & b', 'a &amp; b'],
]

for (const [input, want] of cases) {
  const got = escapeXml(input)
  if (got !== want) {
    throw new Error(
      `escapeXml(${JSON.stringify(input)}): got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`,
    )
  }
}

const escapeXmlRef = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')

// Inverse of escapeXml: named entities first so a literal "&lt;" round-trips
// through "&amp;lt;" instead of collapsing to "<".
const unescapeXml = (value: string): string =>
  value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&')

const UNESCAPED_AMP = /&(?!(?:amp|lt|gt|quot|apos);)/

await fc.assert(
  fc.property(fc.string(), (value) => {
    const out = escapeXml(value)
    return out.length >= value.length && !/[<>"']/.test(out) && !UNESCAPED_AMP.test(out)
  }),
)

await fc.assert(fc.property(fc.string(), (value) => escapeXml(value) === escapeXmlRef(value)))

await fc.assert(fc.property(fc.string(), (value) => unescapeXml(escapeXml(value)) === value))
