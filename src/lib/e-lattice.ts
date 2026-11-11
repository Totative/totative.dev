import { gcd } from './totient'

/** The share of lattice points in line of sight tends to this as the view grows. */
export const SIGHT_LIMIT = 6 / Math.PI ** 2

/** Whether the point at offset (dx, dy) can be seen from the viewpoint: no other lattice point lies between them. */
export const inSight = (dx: number, dy: number): boolean => gcd(Math.abs(dx), Math.abs(dy)) === 1
