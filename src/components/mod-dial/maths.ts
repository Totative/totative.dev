import { gcd, inverse } from '../../lib/totient'

export const DIAL_MIN = 2
export const DIAL_MAX = 150

/** Residue numbers are drawn round the rim only while there is room for them. */
export const LABEL_MAX = 36

/** The dial's radius as a share of its box, the same for the first-paint SVG and the canvas that replaces it. */
export const RIM = 0.4

export const chordAlpha = (n: number): number => Math.min(0.85, Math.max(0.3, 22 / n))

/** A chord's length over the diameter, which picks its place between the two chord colours. */
export const chordLength = (from: number, to: number, n: number): number => Math.abs(Math.sin((Math.PI * (to - from)) / n))

/** Where residue k sits on a dial of n, 0 at the top, as a unit vector. n is fractional while the dial moves between two values. */
export function unit(k: number, n: number): [number, number] {
  const angle = (2 * Math.PI * k) / n - Math.PI / 2
  return [Math.cos(angle), Math.sin(angle)]
}

/** m·k mod n for real m and n, so a chord can sweep between two whole multipliers. */
export const lands = (k: number, m: number, n: number): number => (((m * k) % n) + n) % n

/** How many residues the map k → m·k mod n reaches. */
export const reached = (n: number, m: number): number => n / gcd(m, n)

export function describe(n: number, m: number): string {
  const shared = gcd(m, n)
  if (shared > 1) {
    return `${m} shares the factor ${shared} with ${n}. The ${n} residues land on only ${n / shared}, ${shared} on each, so nothing can undo it.`
  }
  if (m === 1) return `1 is a totative of every n. Multiplying by it moves nothing.`
  const back = inverse(m, n)
  if (back === m) {
    return `${m} is a totative of ${n}. All ${n} residues land on different ones, and ${m} is its own inverse: multiply by it again and each one is back.`
  }
  return `${m} is a totative of ${n}. All ${n} residues land on different ones, and multiplying by ${back} puts each one back.`
}

/** The dial as SVG in a 240 unit box, for the first paint before the canvas takes over. Colours come from the component's stylesheet. */
export function dialSvg(n: number, m: number): string {
  const R = 240 * RIM
  const at = (k: number, r = R): [string, string] => {
    const [x, y] = unit(k, n)
    return [(x * r).toFixed(2), (y * r).toFixed(2)]
  }
  const shared = gcd(m, n)
  const alpha = chordAlpha(n).toFixed(3)
  const parts: string[] = [`<circle class="dial-rim" r="${R}"/>`]
  for (let k = 1; k < n; k++) {
    const to = lands(k, m, n)
    if (to === k) continue
    const [x1, y1] = at(k)
    const [x2, y2] = at(to)
    const mix = (chordLength(k, to, n) * 100).toFixed(0)
    parts.push(`<line style="--mix:${mix}%" stroke-opacity="${alpha}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`)
  }
  const dot = Math.min(240 * 0.011, Math.max(1.2, (Math.PI * R) / n / 2.4))
  for (let k = 0; k < n; k++) {
    const [x, y] = at(k)
    const hit = k % shared === 0
    parts.push(`<circle class="${hit ? 'dial-hit' : 'dial-miss'}" cx="${x}" cy="${y}" r="${(hit && shared > 1 ? dot * 1.6 : dot).toFixed(2)}"/>`)
    if (n <= LABEL_MAX) {
      const [tx, ty] = at(k, R + 13)
      parts.push(`<text class="dial-num" x="${tx}" y="${ty}">${k}</text>`)
    }
  }
  const [x1, y1] = at(1)
  const [x2, y2] = at(m)
  parts.push(`<line class="dial-one" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><circle class="dial-knob" cx="${x2}" cy="${y2}" r="5"/>`)
  return parts.join('')
}
