import type { APIRoute } from 'astro'
import { buildWriteupsAtomFeed } from '../../lib/atom-feed.ts'
import { getWriteups } from '../../lib/writeups.ts'

export const GET: APIRoute = async () => {
  const xml = buildWriteupsAtomFeed(await getWriteups())
  return new Response(xml, {
    headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' },
  })
}
