// @ts-expect-error Runtime types come from `bun test`, not the app tsconfig.
import { expect, test } from 'bun:test'
import { inSight, SIGHT_LIMIT } from './e-lattice.ts'

test('a lattice point is in sight only when nothing else sits on the ray', () => {
  expect(inSight(3, 4)).toBe(true)
  expect(inSight(-3, 4)).toBe(true)
  expect(inSight(1, 0)).toBe(true)
  expect(inSight(2, 4)).toBe(false)
  expect(inSight(0, 2)).toBe(false)
  expect(inSight(0, 0)).toBe(false)
})

test('the visible-share limit is 6 over pi squared', () => {
  expect(SIGHT_LIMIT).toBe(6 / Math.PI ** 2)
})
