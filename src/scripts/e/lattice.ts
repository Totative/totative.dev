import { reducedMotion } from '../../lib/enhance'
import { inSight } from '../../lib/e-lattice'

const TAU = Math.PI * 2
const BUCKETS = 8
/** Sight lines are drawn to visible points this many units away or nearer. */
const LINE_REACH = 6
/** Seconds without input before the viewpoint starts to wander, and between its steps. */
const IDLE = 5
const STEP = 2.6
const plain = (v: number): string => (v < 0 ? `−${-v}` : `${v}`)

interface Point {
  x: number
  y: number
}

export function mountLattice(hero: HTMLElement): void {
  const canvas = hero.querySelector('canvas')
  const eye = hero.querySelector<HTMLElement>('.hero-eye')
  const ctx = canvas?.getContext('2d')
  if (canvas && eye && ctx) run(hero, canvas, eye, ctx)
}

function run(hero: HTMLElement, canvas: HTMLCanvasElement, eye: HTMLElement, ctx: CanvasRenderingContext2D): void {
  const say = (name: string) => hero.querySelector<HTMLElement>(`[data-say="${name}"]`)
  const out = { view: say('view'), sight: say('sight'), points: say('points'), share: say('share') }
  const style = getComputedStyle(hero)
  const colour = { accent: style.getPropertyValue('--accent').trim(), lit: style.getPropertyValue('--lattice-lit').trim(), dim: style.getPropertyValue('--lattice-dim').trim() }
  const still = reducedMotion()

  let width = 0
  let height = 0
  let cell = 28
  /** Screen position of the lattice point the caption calls (0, 0). */
  const origin: Point = { x: 0, y: 0 }
  const range = { i0: 0, i1: 0, j0: 0, j1: 0 }
  let cols = 0
  let rows = 0
  let level = new Float32Array(0)
  let target = new Float32Array(0)
  let bucket = new Uint8Array(0)

  const view: Point = { x: 0, y: 0 }
  const marker: Point = { x: 0, y: 0 }
  let dirty = true
  let onScreen = true
  let lastInput = -Infinity
  let driftStep = 0
  let driftAt = 0
  let last = 0

  const sx = (i: number) => origin.x + i * cell
  const sy = (j: number) => origin.y - j * cell
  const index = (i: number, j: number) => (j - range.j0) * cols + (i - range.i0)

  function retarget(): void {
    let seen = 0
    for (let j = range.j0; j <= range.j1; j++) {
      for (let i = range.i0; i <= range.i1; i++) {
        const dx = i - view.x
        const dy = j - view.y
        const visible = inSight(dx, dy)
        if (visible) seen++
        // Light falls off with distance, so the eye reads the viewpoint as the source and the far field stays dim.
        target[index(i, j)] = visible ? 0.2 + 0.8 / (1 + (dx * dx + dy * dy) / 120) : 0
      }
    }
    const total = cols * rows - 1
    if (out.view) out.view.textContent = `(${plain(view.x)}, ${plain(view.y)})`
    if (out.sight) out.sight.textContent = seen.toLocaleString('en-GB')
    if (out.points) out.points.textContent = total.toLocaleString('en-GB')
    if (out.share) out.share.textContent = (seen / total).toFixed(3)
    dirty = true
  }

  function moveView(i: number, j: number): void {
    const x = Math.min(range.i1 - 1, Math.max(range.i0 + 1, i))
    const y = Math.min(range.j1 - 1, Math.max(range.j0 + 1, j))
    if (x === view.x && y === view.y) return
    view.x = x
    view.y = y
    retarget()
  }

  function resize(): void {
    const box = canvas.getBoundingClientRect()
    // On a phone the canvas is its own band and the viewpoint starts at its centre.
    const anchor = eye.offsetParent ? eye.getBoundingClientRect() : box
    const dpr = Math.min(2, devicePixelRatio || 1)
    width = box.width
    height = box.height
    cell = width < 640 ? 24 : 30
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    origin.x = Math.round(anchor.left + anchor.width / 2 - box.left)
    origin.y = Math.round(anchor.top + anchor.height / 2 - box.top)
    range.i0 = Math.ceil(-origin.x / cell)
    range.i1 = Math.floor((width - origin.x) / cell)
    range.j0 = Math.ceil((origin.y - height) / cell)
    range.j1 = Math.floor(origin.y / cell)
    cols = range.i1 - range.i0 + 1
    rows = range.j1 - range.j0 + 1
    level = new Float32Array(cols * rows)
    target = new Float32Array(cols * rows)
    bucket = new Uint8Array(cols * rows)
    view.x = 0
    view.y = 0
    marker.x = sx(0)
    marker.y = sy(0)
    retarget()
    level.set(target)
  }

  /** Eases every dot toward its target brightness; returns whether anything is still moving. */
  function ease(dt: number): boolean {
    const k = still ? 1 : 1 - Math.exp(-dt / 220)
    let moving = false
    for (let p = 0; p < level.length; p++) {
      const now = level[p] ?? 0
      const goal = target[p] ?? 0
      const next = Math.abs(goal - now) > 0.004 ? now + (goal - now) * k : goal
      if (next !== goal) moving = true
      level[p] = next
      bucket[p] = Math.ceil(next * BUCKETS)
    }
    const gx = sx(view.x) - marker.x
    const gy = sy(view.y) - marker.y
    if (Math.abs(gx) > 0.2 || Math.abs(gy) > 0.2) {
      marker.x += gx * k
      marker.y += gy * k
      moving = true
    } else {
      marker.x = sx(view.x)
      marker.y = sy(view.y)
    }
    return moving
  }

  function draw(): void {
    ctx.clearRect(0, 0, width, height)

    ctx.globalAlpha = 0.09
    ctx.strokeStyle = colour.lit
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let dy = -LINE_REACH; dy <= LINE_REACH; dy++) {
      for (let dx = -LINE_REACH; dx <= LINE_REACH; dx++) {
        if (dx * dx + dy * dy > LINE_REACH * LINE_REACH || !inSight(dx, dy)) continue
        ctx.moveTo(marker.x, marker.y)
        ctx.lineTo(marker.x + dx * cell, marker.y - dy * cell)
      }
    }
    ctx.stroke()

    ctx.globalAlpha = 1
    ctx.fillStyle = colour.dim
    ctx.beginPath()
    for (let j = range.j0; j <= range.j1; j++) {
      for (let i = range.i0; i <= range.i1; i++) {
        const x = sx(i)
        const y = sy(j)
        ctx.moveTo(x + 1, y)
        ctx.arc(x, y, 1, 0, TAU)
      }
    }
    ctx.fill()

    ctx.fillStyle = colour.lit
    for (let b = 1; b <= BUCKETS; b++) {
      ctx.globalAlpha = b / BUCKETS
      ctx.beginPath()
      for (let j = range.j0; j <= range.j1; j++) {
        for (let i = range.i0; i <= range.i1; i++) {
          const p = index(i, j)
          if (bucket[p] !== b) continue
          const r = 1 + (level[p] ?? 0) * 1.1
          const x = sx(i)
          const y = sy(j)
          ctx.moveTo(x + r, y)
          ctx.arc(x, y, r, 0, TAU)
        }
      }
      ctx.fill()
    }

    ctx.globalAlpha = 1
    ctx.strokeStyle = colour.accent
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(marker.x, marker.y, 7, 0, TAU)
    ctx.stroke()
  }

  function drift(now: number): void {
    if (still || now - lastInput < IDLE * 1000 || now - driftAt < STEP * 1000) return
    driftAt = now
    driftStep++
    // Two slow sines at unrelated rates: the viewpoint wanders near where it began and moves at most one unit a step.
    moveView(Math.round(4 * Math.sin(driftStep * 0.21)), Math.round(3 * Math.sin(driftStep * 0.13)))
  }

  function frame(now: number): void {
    if (!onScreen || document.hidden) return
    const dt = Math.min(64, now - last)
    last = now
    drift(now)
    const moving = ease(dt)
    if (moving || dirty) draw()
    dirty = false
    requestAnimationFrame(frame)
  }

  const start = () => {
    last = performance.now()
    driftAt = last
    requestAnimationFrame(frame)
  }

  const lookFrom = (event: PointerEvent) => {
    lastInput = performance.now()
    const box = canvas.getBoundingClientRect()
    moveView(Math.round((event.clientX - box.left - origin.x) / cell), Math.round((origin.y - (event.clientY - box.top)) / cell))
  }
  hero.addEventListener('pointermove', lookFrom)
  hero.addEventListener('pointerdown', (event) => {
    // A tap on a link is a tap on the link.
    if (!(event.target instanceof Element && event.target.closest('a'))) lookFrom(event)
  })

  const steps: Record<string, readonly [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }
  canvas.addEventListener('keydown', (event) => {
    const step = steps[event.key]
    if (!step) return
    event.preventDefault()
    lastInput = performance.now()
    moveView(view.x + step[0], view.y + step[1])
  })

  new ResizeObserver(() => {
    resize()
    draw()
  }).observe(canvas)
  new IntersectionObserver(([entry]) => {
    const was = onScreen
    onScreen = entry?.isIntersecting ?? true
    if (onScreen && !was) start()
  }).observe(canvas)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && onScreen) start()
  })

  resize()
  hero.dataset['lattice'] = 'on'
  start()
}
