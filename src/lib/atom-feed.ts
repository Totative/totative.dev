import { siteName } from '../data/site.ts'
import { escapeXml } from './escape-xml.ts'

const WRITEUPS = 'https://totative.dev/writeups/'

function atomDate(day: string): string {
  return `${day}T00:00:00Z`
}

export function buildWriteupsAtomFeed(
  writeups: readonly {
    slug: string
    date: string
    entry: { data: { title: string; description: string } }
  }[],
): string {
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

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${WRITEUPS}</id>
  <title>Totative write-ups</title>
  <link href="${WRITEUPS}" />
  <author><name>${escapeXml(siteName)}</name></author>
  <updated>${updated}</updated>
${entries}
</feed>
`
}
