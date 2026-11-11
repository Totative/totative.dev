import { type CollectionEntry, getCollection } from 'astro:content'

export interface Writeup {
  entry: CollectionEntry<'writeups'>
  slug: string
  /** YYYY-MM-DD, as the file name carries it. */
  date: string
  minutes: number
}

// Posts keep their Jekyll file names (`YYYY-MM-DD-slug.md`), so the existing
// `_posts/` folder moves over unchanged and the date stays out of frontmatter.
const NAME = /(\d{4}-\d{2}-\d{2})-([^/]+)\.md$/

export async function getWriteups(): Promise<Writeup[]> {
  const entries = await getCollection('writeups')
  return entries
    .map((entry) => {
      const match = NAME.exec(entry.filePath ?? '')
      const [, date, slug] = match ?? []
      if (!(date && slug)) throw new Error(`write-up "${entry.id}" is not named YYYY-MM-DD-slug.md`)
      const words = (entry.body ?? '').split(/\s+/).filter(Boolean).length
      return { entry, slug, date, minutes: Math.max(1, Math.round(words / 220)) }
    })
    .sort((a, b) => b.date.localeCompare(a.date))
}

export async function writeupPaths() {
  return (await getWriteups()).map((writeup) => ({
    params: { slug: writeup.slug },
    props: { writeup },
  }))
}
