import type { APIRoute } from 'astro'
import { escapeXml } from '../../lib/escape-xml.ts'
import { getWriteups } from '../../lib/writeups.ts'

const WRITEUPS = 'https://totative.dev/writeups/'

function atomDate(day: string): string {
  return `${day}T00:00:00Z`
}

export const GET: APIRoute = async () => {
  const writeups = await getWriteups()
  const newest = writeups[0]?.date
  const updated = atomDate(newest ?? '1970-01-01')
  const entries = writeups
    .map((writeup) => {
      const url = `${WRITEUPS}${writeup.slug}/`
      const safeUrl = escapeXml(url)
      return `  <entry>
    <id>${safeUrl}</id>
    <title>${escapeXml(writeup.entry.data.title)}</title>
    <link href="${safeUrl}" />
    <updated>${atomDate(writeup.date)}</updated>
    <published>${atomDate(writeup.date)}</published>
    <summary>${escapeXml(writeup.entry.data.description)}</summary>
  </entry>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${WRITEUPS}</id>
  <title>Totative write-ups</title>
  <link href="${WRITEUPS}" />
  <updated>${updated}</updated>
${entries}
</feed>
`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' },
  })
}
