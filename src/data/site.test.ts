// @ts-expect-error Runtime types come from `bun test`, not the app tsconfig.
import { expect, test } from 'bun:test'
import { tools } from './site.ts'

test("each tool's source tarball matches its listed name and version", () => {
  for (const t of tools) {
    expect(t.assets[0]).toBe(`${t.name}-${t.version}.tar.gz`)
  }
})
