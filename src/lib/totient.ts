export function gcd(a: number, b: number): number {
  while (b !== 0) [a, b] = [b, a % b]
  return a
}

export function totatives(n: number): number[] {
  const out: number[] = []
  for (let k = 1; k <= n; k++) if (gcd(k, n) === 1) out.push(k)
  return out
}

/** The inverse of a totative k modulo n: the j with k*j = 1 (mod n). */
export function inverse(k: number, n: number): number {
  for (let j = 1; j < n; j++) if ((k * j) % n === 1) return j
  return k
}
