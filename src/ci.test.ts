import { expect, test } from 'bun:test'

test('CI runs bun test after typecheck', async () => {
  const yml = await Bun.file(new URL('../.github/workflows/ci.yml', import.meta.url)).text()
  const typecheckAt = yml.indexOf('bun run typecheck')
  const testAt = yml.indexOf('\n      - run: bun test\n')
  expect(testAt).toBeGreaterThan(-1)
  expect(testAt).toBeGreaterThan(typecheckAt)
})
