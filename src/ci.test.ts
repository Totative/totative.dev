// @ts-expect-error Runtime types come from `bun test`, not the app tsconfig.
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

test('CI runs bun test after typecheck', () => {
  const yml = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
  const typecheckAt = yml.indexOf('bun run typecheck')
  const testAt = yml.indexOf('\n      - run: bun test\n')
  expect(testAt).toBeGreaterThan(-1)
  expect(testAt).toBeGreaterThan(typecheckAt)
})
