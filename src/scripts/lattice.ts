import { inSight } from '../lib/e-lattice.ts'
import { reducedMotion } from '../lib/enhance.ts'

const TAU = Math.PI * 2
const BUCKETS = 8
/** Sight lines are drawn to visible points this many units away or nearer. */
const LINE_REACH = 6
/** Seconds without input before the viewpoint starts to wander, and between its steps. */
const IDLE_SECONDS = 5
const STEP_SECONDS = 2.6
const MS_PER_SECOND = 1000
const IDLE_MS = IDLE_SECONDS * MS_PER_SECOND
const STEP_MS = STEP_SECONDS * MS_PER_SECOND
const DIM_BASE = 0.2
const DIM_GAIN = 0.8
const FALLOFF = 120
const SHARE_DIGITS = 3
const PHONE_WIDTH = 640
const CELL_NARROW = 24
const CELL_WIDE = 30
const MAX_DPR = 2
const DEFAULT_DPR = 1
const EASE_MS = 220
const EASE_EPS = 0.004
const MARKER_EPS = 0.2
const LINES_ALPHA = 0.09
const STROKE_WIDTH = 1
const DOT_RADIUS = 1
const LIT_RADIUS_EXTRA = 1.1
const MARKER_LINE_WIDTH = 1.5
const MARKER_RADIUS = 7
const DRIFT_X_AMP = 4
const DRIFT_Y_AMP = 3
const DRIFT_X_OMEGA = 0.21
const DRIFT_Y_OMEGA = 0.13
const FRAME_DT_CAP = 64
const EDGE_MARGIN = 1
const VIEWPOINT_CELL = 1
const CELL_INITIAL = 28
const plain = (v: number): string => (v < 0 ? `−${-v}` : `${v}`)

interface Point {
  x: number
  y: number
}

interface Lattice {
  hero: HTMLElement
  canvas: HTMLCanvasElement
  eye: HTMLElement
  ctx: CanvasRenderingContext2D
  out: {
    view: HTMLElement | null
    sight: HTMLElement | null
    points: HTMLElement | null
    share: HTMLElement | null
  }
  colour: { accent: string; lit: string; dim: string }
  still: boolean
  width: number
  height: number
  cell: number
  origin: Point
  range: { i0: number; i1: number; j0: number; j1: number }
  cols: number
  rows: number
  level: Float32Array
  target: Float32Array
  bucket: Uint8Array
  view: Point
  marker: Point
  dirty: boolean
  onScreen: boolean
  lastInput: number
  driftStep: number
  driftAt: number
  last: number
}

export function mountLattice(hero: HTMLElement): void {
  const canvas = hero.querySelector('canvas')
  const eye = hero.querySelector<HTMLElement>('.hero-eye')
  const ctx = canvas?.getContext('2d')
  if (canvas && eye && ctx) {
    run(hero, canvas, eye, ctx)
  }
}

function create(
  hero: HTMLElement,
  canvas: HTMLCanvasElement,
  eye: HTMLElement,
  ctx: CanvasRenderingContext2D,
): Lattice {
  const say = (name: string) => hero.querySelector<HTMLElement>(`[data-say="${name}"]`)
  const style = getComputedStyle(hero)
  return {
    hero,
    canvas,
    eye,
    ctx,
    out: { view: say('view'), sight: say('sight'), points: say('points'), share: say('share') },
    colour: {
      accent: style.getPropertyValue('--accent').trim(),
      lit: style.getPropertyValue('--lattice-lit').trim(),
      dim: style.getPropertyValue('--lattice-dim').trim(),
    },
    still: reducedMotion(),
    width: 0,
    height: 0,
    cell: CELL_INITIAL,
    origin: { x: 0, y: 0 },
    range: { i0: 0, i1: 0, j0: 0, j1: 0 },
    cols: 0,
    rows: 0,
    level: new Float32Array(0),
    target: new Float32Array(0),
    bucket: new Uint8Array(0),
    view: { x: 0, y: 0 },
    marker: { x: 0, y: 0 },
    dirty: true,
    onScreen: true,
    lastInput: Number.NEGATIVE_INFINITY,
    driftStep: 0,
    driftAt: 0,
    last: 0,
  }
}

function sx(s: Lattice, i: number): number {
  return s.origin.x + i * s.cell
}

function sy(s: Lattice, j: number): number {
  return s.origin.y - j * s.cell
}

function index(s: Lattice, i: number, j: number): number {
  return (j - s.range.j0) * s.cols + (i - s.range.i0)
}

function retarget(s: Lattice): void {
  let seen = 0
  for (let j = s.range.j0; j <= s.range.j1; j++) {
    for (let i = s.range.i0; i <= s.range.i1; i++) {
      const dx = i - s.view.x
      const dy = j - s.view.y
      const visible = inSight(dx, dy)
      if (visible) {
        seen += 1
      }
      // Light falls off with distance, so the eye reads the viewpoint as the source and the far field stays dim.
      s.target[index(s, i, j)] = visible
        ? DIM_BASE + DIM_GAIN / (1 + (dx * dx + dy * dy) / FALLOFF)
        : 0
    }
  }
  const total = s.cols * s.rows - VIEWPOINT_CELL
  if (s.out.view) {
    s.out.view.textContent = `(${plain(s.view.x)}, ${plain(s.view.y)})`
  }
  if (s.out.sight) {
    s.out.sight.textContent = seen.toLocaleString('en-GB')
  }
  if (s.out.points) {
    s.out.points.textContent = total.toLocaleString('en-GB')
  }
  if (s.out.share) {
    s.out.share.textContent = (seen / total).toFixed(SHARE_DIGITS)
  }
  s.dirty = true
}

function moveView(s: Lattice, i: number, j: number): void {
  const x = Math.min(s.range.i1 - EDGE_MARGIN, Math.max(s.range.i0 + EDGE_MARGIN, i))
  const y = Math.min(s.range.j1 - EDGE_MARGIN, Math.max(s.range.j0 + EDGE_MARGIN, j))
  if (x === s.view.x && y === s.view.y) {
    return
  }
  s.view.x = x
  s.view.y = y
  retarget(s)
}

function resize(s: Lattice): void {
  const box = s.canvas.getBoundingClientRect()
  // On a phone the canvas is its own band and the viewpoint starts at its centre.
  const anchor = s.eye.offsetParent ? s.eye.getBoundingClientRect() : box
  const dpr = Math.min(MAX_DPR, devicePixelRatio || DEFAULT_DPR)
  s.width = box.width
  s.height = box.height
  s.cell = s.width < PHONE_WIDTH ? CELL_NARROW : CELL_WIDE
  s.canvas.width = Math.round(s.width * dpr)
  s.canvas.height = Math.round(s.height * dpr)
  s.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  s.origin.x = Math.round(anchor.left + anchor.width / 2 - box.left)
  s.origin.y = Math.round(anchor.top + anchor.height / 2 - box.top)
  s.range.i0 = Math.ceil(-s.origin.x / s.cell)
  s.range.i1 = Math.floor((s.width - s.origin.x) / s.cell)
  s.range.j0 = Math.ceil((s.origin.y - s.height) / s.cell)
  s.range.j1 = Math.floor(s.origin.y / s.cell)
  s.cols = s.range.i1 - s.range.i0 + 1
  s.rows = s.range.j1 - s.range.j0 + 1
  s.level = new Float32Array(s.cols * s.rows)
  s.target = new Float32Array(s.cols * s.rows)
  s.bucket = new Uint8Array(s.cols * s.rows)
  s.view.x = 0
  s.view.y = 0
  s.marker.x = sx(s, 0)
  s.marker.y = sy(s, 0)
  retarget(s)
  s.level.set(s.target)
}

/** Eases every dot toward its target brightness; returns whether anything is still moving. */
function ease(s: Lattice, dt: number): boolean {
  const k = s.still ? 1 : 1 - Math.exp(-dt / EASE_MS)
  let moving = false
  for (let p = 0; p < s.level.length; p++) {
    const now = s.level[p] ?? 0
    const goal = s.target[p] ?? 0
    const next = Math.abs(goal - now) > EASE_EPS ? now + (goal - now) * k : goal
    if (next !== goal) {
      moving = true
    }
    s.level[p] = next
    s.bucket[p] = Math.ceil(next * BUCKETS)
  }
  const gx = sx(s, s.view.x) - s.marker.x
  const gy = sy(s, s.view.y) - s.marker.y
  if (Math.abs(gx) > MARKER_EPS || Math.abs(gy) > MARKER_EPS) {
    s.marker.x += gx * k
    s.marker.y += gy * k
    moving = true
  } else {
    s.marker.x = sx(s, s.view.x)
    s.marker.y = sy(s, s.view.y)
  }
  return moving
}

function drawLines(s: Lattice): void {
  s.ctx.globalAlpha = LINES_ALPHA
  s.ctx.strokeStyle = s.colour.lit
  s.ctx.lineWidth = STROKE_WIDTH
  s.ctx.beginPath()
  for (let dy = -LINE_REACH; dy <= LINE_REACH; dy++) {
    for (let dx = -LINE_REACH; dx <= LINE_REACH; dx++) {
      if (dx * dx + dy * dy > LINE_REACH * LINE_REACH || !inSight(dx, dy)) {
        continue
      }
      s.ctx.moveTo(s.marker.x, s.marker.y)
      s.ctx.lineTo(s.marker.x + dx * s.cell, s.marker.y - dy * s.cell)
    }
  }
  s.ctx.stroke()
}

function drawDim(s: Lattice): void {
  s.ctx.globalAlpha = 1
  s.ctx.fillStyle = s.colour.dim
  s.ctx.beginPath()
  for (let j = s.range.j0; j <= s.range.j1; j++) {
    for (let i = s.range.i0; i <= s.range.i1; i++) {
      const x = sx(s, i)
      const y = sy(s, j)
      s.ctx.moveTo(x + DOT_RADIUS, y)
      s.ctx.arc(x, y, DOT_RADIUS, 0, TAU)
    }
  }
  s.ctx.fill()
}

function drawLit(s: Lattice): void {
  s.ctx.fillStyle = s.colour.lit
  for (let b = 1; b <= BUCKETS; b++) {
    s.ctx.globalAlpha = b / BUCKETS
    s.ctx.beginPath()
    for (let j = s.range.j0; j <= s.range.j1; j++) {
      for (let i = s.range.i0; i <= s.range.i1; i++) {
        const p = index(s, i, j)
        if (s.bucket[p] !== b) {
          continue
        }
        const r = DOT_RADIUS + (s.level[p] ?? 0) * LIT_RADIUS_EXTRA
        const x = sx(s, i)
        const y = sy(s, j)
        s.ctx.moveTo(x + r, y)
        s.ctx.arc(x, y, r, 0, TAU)
      }
    }
    s.ctx.fill()
  }
}

function drawMarker(s: Lattice): void {
  s.ctx.globalAlpha = 1
  s.ctx.strokeStyle = s.colour.accent
  s.ctx.lineWidth = MARKER_LINE_WIDTH
  s.ctx.beginPath()
  s.ctx.arc(s.marker.x, s.marker.y, MARKER_RADIUS, 0, TAU)
  s.ctx.stroke()
}

function draw(s: Lattice): void {
  s.ctx.clearRect(0, 0, s.width, s.height)
  drawLines(s)
  drawDim(s)
  drawLit(s)
  drawMarker(s)
}

function drift(s: Lattice, now: number): void {
  if (s.still || now - s.lastInput < IDLE_MS || now - s.driftAt < STEP_MS) {
    return
  }
  s.driftAt = now
  s.driftStep += 1
  // Two slow sines at unrelated rates: the viewpoint wanders near where it began and moves at most one unit a step.
  moveView(
    s,
    Math.round(DRIFT_X_AMP * Math.sin(s.driftStep * DRIFT_X_OMEGA)),
    Math.round(DRIFT_Y_AMP * Math.sin(s.driftStep * DRIFT_Y_OMEGA)),
  )
}

function frame(s: Lattice, now: number): void {
  if (!s.onScreen || document.hidden) {
    return
  }
  const dt = Math.min(FRAME_DT_CAP, now - s.last)
  s.last = now
  drift(s, now)
  const moving = ease(s, dt)
  if (moving || s.dirty) {
    draw(s)
  }
  s.dirty = false
  requestAnimationFrame((next) => frame(s, next))
}

function start(s: Lattice): void {
  s.last = performance.now()
  s.driftAt = s.last
  requestAnimationFrame((now) => frame(s, now))
}

function lookFrom(s: Lattice, event: PointerEvent): void {
  s.lastInput = performance.now()
  const box = s.canvas.getBoundingClientRect()
  moveView(
    s,
    Math.round((event.clientX - box.left - s.origin.x) / s.cell),
    Math.round((s.origin.y - (event.clientY - box.top)) / s.cell),
  )
}

function bind(s: Lattice): void {
  s.hero.addEventListener('pointermove', (event) => lookFrom(s, event))
  s.hero.addEventListener('pointerdown', (event) => {
    // A tap on a link is a tap on the link.
    if (!(event.target instanceof Element && event.target.closest('a'))) {
      lookFrom(s, event)
    }
  })

  const steps: Record<string, readonly [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, 1],
    ArrowDown: [0, -1],
  }
  s.canvas.addEventListener('keydown', (event) => {
    const step = steps[event.key]
    if (!step) {
      return
    }
    event.preventDefault()
    s.lastInput = performance.now()
    moveView(s, s.view.x + step[0], s.view.y + step[1])
  })

  new ResizeObserver(() => {
    resize(s)
    draw(s)
  }).observe(s.canvas)
  new IntersectionObserver(([entry]) => {
    const was = s.onScreen
    s.onScreen = entry?.isIntersecting ?? true
    if (s.onScreen && !was) {
      start(s)
    }
  }).observe(s.canvas)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && s.onScreen) {
      start(s)
    }
  })
}

function run(
  hero: HTMLElement,
  canvas: HTMLCanvasElement,
  eye: HTMLElement,
  ctx: CanvasRenderingContext2D,
): void {
  const s = create(hero, canvas, eye, ctx)
  bind(s)
  resize(s)
  s.hero.dataset.lattice = 'on'
  start(s)
}
