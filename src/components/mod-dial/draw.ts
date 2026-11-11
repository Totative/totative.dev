import { gcd } from '../../lib/totient'
import { chordAlpha, chordLength, LABEL_MAX, lands, RIM, unit } from './maths'

type Rgb = readonly [number, number, number]

/** The colours the canvas draws with, read once from the component's custom properties. */
export interface Palette {
  /** A short chord. */
  from: Rgb
  /** A chord that is a diameter. */
  to: Rgb
  ink: Rgb
  muted: Rgb
  ground: Rgb
  mono: string
}

export interface DrawOptions {
  /** Residue numbers round the rim, when n is small enough for them to fit. */
  labels: boolean
  /** The line from 1 to m, with the handle that sets m. */
  knob: boolean
  /** A residue to single out: its chord is drawn in the ink colour and both ends are numbered. */
  probe: number | undefined
}

const rgba = ([r, g, b]: Rgb, alpha = 1): string => `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`

/**
 * An sRGB CSS colour as red, green and blue, resolved through a probe element's computed style. Reading canvas pixels
 * back would do the same, but anti-fingerprinting tools flag that call.
 */
function toRgb(root: HTMLElement, colour: string, fallback: Rgb): Rgb {
  const probe = document.createElement('span')
  probe.style.color = colour
  root.append(probe)
  const resolved = getComputedStyle(probe).color
  probe.remove()
  const match = /^rgba?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)/.exec(resolved)
  if (!match) return fallback
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

export function readPalette(root: HTMLElement): Palette {
  const style = getComputedStyle(root)
  const colour = (name: string, fallback: Rgb) => toRgb(root, style.getPropertyValue(name).trim() || rgba(fallback), fallback)
  return {
    from: colour('--dial-from', [255, 61, 129]),
    to: colour('--dial-to', [255, 154, 61]),
    ink: colour('--dial-ink', [245, 241, 238]),
    muted: colour('--dial-muted', [168, 160, 156]),
    ground: colour('--dial-ground', [0, 0, 0]),
    mono: style.getPropertyValue('--dial-mono').trim() || 'ui-monospace, monospace',
  }
}

const whole = (value: number): boolean => Math.abs(value - Math.round(value)) < 1e-6

/** Draws the chords k → m·k mod n in a square of `size` CSS pixels. n and m are fractional while the dial is moving. */
export function drawDial(ctx: CanvasRenderingContext2D, size: number, n: number, m: number, palette: Palette, { labels, knob, probe }: DrawOptions): void {
  const { from, to: toColour, ink, muted, ground, mono } = palette
  const centre = size / 2
  const R = size * RIM
  const point = (k: number, r = R): [number, number] => {
    const [x, y] = unit(k, n)
    return [centre + x * r, centre + y * r]
  }
  ctx.clearRect(0, 0, size, size)

  ctx.lineWidth = 1
  ctx.strokeStyle = rgba(ink, 0.1)
  ctx.beginPath()
  ctx.arc(centre, centre, R, 0, 2 * Math.PI)
  ctx.stroke()

  const count = Math.ceil(n - 1e-6)
  const alpha = chordAlpha(n)
  // Additive blending makes the places where many chords cross the brightest part of the picture.
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineWidth = size > 240 ? 1.25 : 0.8
  for (let k = 1; k < count; k++) {
    const to = lands(k, m, n)
    if (Math.abs(to - k) < 1e-6) continue
    const [x1, y1] = point(k)
    const [x2, y2] = point(to)
    const t = chordLength(k, to, n)
    ctx.strokeStyle = rgba([from[0] + (toColour[0] - from[0]) * t, from[1] + (toColour[1] - from[1]) * t, from[2] + (toColour[2] - from[2]) * t], alpha)
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
  ctx.globalCompositeOperation = 'source-over'

  const settled = whole(n) && whole(m)
  const shared = settled ? gcd(Math.round(m), Math.round(n)) : 1
  const dot = Math.min(size * 0.011, Math.max(1.2, (Math.PI * R) / n / 2.4))
  for (let k = 0; k < count; k++) {
    const [x, y] = point(k)
    const hit = k % shared === 0
    ctx.beginPath()
    ctx.arc(x, y, hit && shared > 1 ? dot * 1.6 : dot, 0, 2 * Math.PI)
    if (hit) {
      ctx.fillStyle = rgba(ink, settled ? 1 : 0.55)
      ctx.fill()
    } else {
      ctx.strokeStyle = rgba(muted, 0.45)
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (labels && settled && n <= LABEL_MAX) {
    ctx.font = `500 ${Math.max(9, size * 0.024)}px ${mono}`
    for (let k = 0; k < count; k++) {
      const [x, y] = point(k, R + size * 0.055)
      ctx.fillStyle = k % shared === 0 ? rgba(ink, 0.8) : rgba(muted, 0.65)
      ctx.fillText(String(k), x, y)
    }
  }

  if (probe !== undefined && settled) {
    const to = lands(probe, m, n)
    const [x1, y1] = point(probe)
    const [x2, y2] = point(to)
    ctx.strokeStyle = rgba(ink)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    ctx.font = `700 ${Math.max(11, size * 0.03)}px ${mono}`
    for (const k of [probe, to]) {
      const [x, y] = point(k)
      ctx.beginPath()
      ctx.arc(x, y, Math.max(4, size * 0.011), 0, 2 * Math.PI)
      ctx.fillStyle = rgba(ink)
      ctx.fill()
      // A plate in the ground colour under the number keeps it readable over the rim labels of a small dial.
      const [tx, ty] = point(k, R + size * 0.055)
      ctx.beginPath()
      ctx.arc(tx, ty, Math.max(9, size * 0.026), 0, 2 * Math.PI)
      ctx.fillStyle = rgba(ground)
      ctx.fill()
      ctx.fillStyle = rgba(ink)
      ctx.fillText(String(Math.round(k)), tx, ty)
    }
  }

  if (knob) {
    const [x1, y1] = point(1)
    const [x2, y2] = point(m)
    ctx.strokeStyle = rgba(ink, probe === undefined ? 1 : 0.4)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x2, y2, Math.max(6, size * 0.016), 0, 2 * Math.PI)
    ctx.fillStyle = rgba(ground)
    ctx.fill()
    ctx.stroke()
  }
}

/** Sizes the canvas's backing store to its box and the screen's pixel ratio, and returns the box's side in CSS pixels. */
export function fitCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): number {
  const size = canvas.clientWidth
  const ratio = window.devicePixelRatio || 1
  const pixels = Math.round(size * ratio)
  if (canvas.width !== pixels) {
    canvas.width = pixels
    canvas.height = pixels
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  return size
}
