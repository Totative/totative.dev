// @ts-expect-error Runtime types come from `bun test`, not the app tsconfig.
import { expect, test } from 'bun:test'
import { buildWriteupsAtomFeed } from './atom-feed.ts'

test('Atom feed has a feed-level author', () => {
  const xml = buildWriteupsAtomFeed([])
  expect(xml).toContain('<author><name>Totative</name></author>')
})
