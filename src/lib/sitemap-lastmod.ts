const WRITEUP_URL = /^https:\/\/totative\.dev\/writeups\/([^/]+)\/$/

export function sitemapLastmod(url: string, writeupDates: Map<string, string>, now: Date): Date {
  const slug = WRITEUP_URL.exec(url)?.[1]
  const date = slug ? writeupDates.get(slug) : undefined
  return date ? new Date(`${date}T00:00:00.000Z`) : now
}
