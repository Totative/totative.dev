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
