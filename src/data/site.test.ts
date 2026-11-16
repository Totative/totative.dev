// @ts-expect-error Runtime types come from `bun test`, not the app tsconfig.
import { expect, test } from 'bun:test'
import { tools } from './site.ts'

// Newest release tags on github.com/Totative; update when a tool ships.
const newest = { 'go-avscan': 'v0.4.0', 'go-keyring': 'v0.3.0', 'go-codepair': 'v0.3.0' }

test('listed tool versions are the newest release tags', () => {
  expect(Object.fromEntries(tools.map((t) => [t.name, t.version]))).toEqual(newest)
})
