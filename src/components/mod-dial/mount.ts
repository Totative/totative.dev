import { reducedMotion } from '../../lib/enhance'
import { drawDial, fitCanvas, readPalette } from './draw'
import { DIAL_MAX, DIAL_MIN, describe, reached } from './maths'

export interface DialPreset {
  n: number
  m: number
  /** A short name for the pair, shown above the dial. */
  label?: string
  /** One sentence about the pair, shown under the status line. */
  note?: string
}

export interface Dial {
  /** Moves the dial to a pair on the host page's behalf and takes it back from the visitor. */
  show(preset: DialPreset): void
}

/** What `moddial:change` carries each time the dial settles on a new pair. */
export interface DialChange {
  n: number
  m: number
  reached: number
}

const PLAY_STEP_MS = 900
const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

function parsePresets(raw: string | undefined): DialPreset[] {
  if (!raw) return []
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed)) return []
  return parsed.filter(
    (item): item is DialPreset => typeof item === 'object' && item !== null && typeof item.n === 'number' && typeof item.m === 'number',
  )
}

export function mountDial(root: HTMLElement): Dial | undefined {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-dial-canvas]')
  const ctx = canvas?.getContext('2d')
  const nInput = root.querySelector<HTMLInputElement>('[data-dial-input="n"]')
  const mInput = root.querySelector<HTMLInputElement>('[data-dial-input="m"]')
  const status = root.querySelector<HTMLElement>('[data-dial-status]')
  const note = root.querySelector<HTMLElement>('[data-dial-note]')
  const label = root.querySelector<HTMLElement>('[data-dial-label]')
  const play = root.querySelector<HTMLButtonElement>('[data-dial-play]')
  if (!canvas || !ctx || !nInput || !mInput || !status) return undefined

  const presets = parsePresets(root.dataset['presets'])
  const presetButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-dial-preset]')]
  const cycleMs = Number(root.dataset['cycle'] ?? 0) * 1000
  const palette = readPalette(root)

  let n = nInput.valueAsNumber
  let m = mInput.valueAsNumber
  // What is drawn. It runs ahead of or behind n and m while the dial is moving between two pairs.
  const view = { n, m }
  let size = 0
  let frame = 0
  let playTimer = 0
  let cycleTimer = 0
  let cycleAt = 0
  let manual = false
  let inView = false
  let probe: number | undefined

  const render = () => drawDial(ctx, size, view.n, view.m, palette, { labels: true, knob: true, probe })

  const fill = (input: HTMLInputElement) => {
    const span = Number(input.max) - Number(input.min)
    input.style.setProperty('--fill', `${span > 0 ? ((input.valueAsNumber - Number(input.min)) / span) * 100 : 100}%`)
  }

  const show = (nextN: number, nextM: number, ms: number) => {
    n = Math.min(DIAL_MAX, Math.max(DIAL_MIN, Math.round(nextN)))
    m = Math.min(n - 1, Math.max(1, Math.round(nextM)))
    nInput.value = String(n)
    mInput.max = String(n - 1)
    mInput.value = String(m)
    fill(nInput)
    fill(mInput)
    root.dataset['n'] = String(n)
    root.dataset['m'] = String(m)
    const hit = reached(n, m)
    for (const el of root.querySelectorAll('[data-dial-n]')) el.textContent = String(n)
    for (const el of root.querySelectorAll('[data-dial-m]')) el.textContent = String(m)
    for (const el of root.querySelectorAll('[data-dial-reached]')) el.textContent = String(hit)
    status.textContent = describe(n, m)
    root.classList.toggle('is-colliding', hit < n)
    root.dispatchEvent(new CustomEvent<DialChange>('moddial:change', { detail: { n, m, reached: hit }, bubbles: true }))

    cancelAnimationFrame(frame)
    if (ms === 0 || reducedMotion()) {
      view.n = n
      view.m = m
      render()
      return
    }
    const from = { ...view }
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      const eased = easeInOut(t)
      view.n = from.n + (n - from.n) * eased
      view.m = from.m + (m - from.m) * eased
      render()
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
  }

  const markPreset = (index: number) => {
    presetButtons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)))
  }

  const showPreset = (preset: DialPreset, index = -1) => {
    if (label && preset.label !== undefined) label.textContent = preset.label
    if (note) note.textContent = preset.note ?? ''
    markPreset(index)
    show(preset.n, preset.m, 1100)
  }

  const stopPlay = () => {
    clearInterval(playTimer)
    playTimer = 0
    if (!play) return
    play.setAttribute('aria-pressed', 'false')
    play.textContent = 'Play'
  }

  const stopCycle = () => {
    clearInterval(cycleTimer)
    cycleTimer = 0
  }

  const startCycle = () => {
    if (cycleTimer || manual || !inView || cycleMs <= 0 || presets.length < 2 || reducedMotion()) return
    cycleTimer = window.setInterval(() => {
      cycleAt = (cycleAt + 1) % presets.length
      const preset = presets[cycleAt]
      if (preset) showPreset(preset, cycleAt)
    }, cycleMs)
  }

  /** The visitor has touched the dial: it stops moving on its own and their changes are announced. */
  const claim = () => {
    stopCycle()
    if (manual) return
    manual = true
    status.setAttribute('aria-live', 'polite')
  }

  /** A change made with the sliders, steppers, play or a drag leaves whichever preset was showing. */
  const takeOver = () => {
    claim()
    if (note) note.textContent = ''
    markPreset(-1)
  }

  nInput.addEventListener('input', () => {
    takeOver()
    stopPlay()
    show(nInput.valueAsNumber, m, 350)
  })
  mInput.addEventListener('input', () => {
    takeOver()
    stopPlay()
    show(n, mInput.valueAsNumber, 350)
  })
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-dial-step]')) {
    const [which, by] = (button.dataset['dialStep'] ?? '').split(':')
    button.addEventListener('click', () => {
      takeOver()
      stopPlay()
      if (which === 'n') show(n + Number(by), m, 350)
      else show(n, m + Number(by), 350)
    })
  }

  presetButtons.forEach((button, index) => {
    button.addEventListener('click', () => {
      const preset = presets[index]
      if (!preset) return
      claim()
      stopPlay()
      cycleAt = index
      showPreset(preset, index)
    })
  })

  play?.addEventListener('click', () => {
    if (playTimer) {
      stopPlay()
      return
    }
    takeOver()
    play.setAttribute('aria-pressed', 'true')
    play.textContent = 'Pause'
    const step = () => {
      // Past the last multiplier the dial starts again at 1 without sweeping back through every pattern.
      if (m >= n - 1) show(n, 1, 0)
      else show(n, m + 1, 500)
    }
    step()
    playTimer = window.setInterval(step, PLAY_STEP_MS)
  })

  /** The residue nearest the pointer, reading the dial clockwise from 0 at the top. */
  const residueAt = (event: PointerEvent): number => {
    const box = canvas.getBoundingClientRect()
    const x = event.clientX - box.left - box.width / 2
    const y = event.clientY - box.top - box.height / 2
    const turn = (Math.atan2(y, x) + Math.PI / 2) / (2 * Math.PI)
    return Math.round((((turn % 1) + 1) % 1) * n) % n
  }
  const setProbe = (next: number | undefined) => {
    if (next === probe) return
    probe = next
    if (next === undefined) delete root.dataset['probe']
    else root.dataset['probe'] = `${next}:${(m * next) % n}`
    render()
  }
  const drag = (event: PointerEvent) => {
    takeOver()
    stopPlay()
    show(n, residueAt(event), 120)
  }
  let dragging = false
  canvas.addEventListener('pointerdown', (event) => {
    dragging = true
    setProbe(undefined)
    canvas.setPointerCapture(event.pointerId)
    drag(event)
  })
  canvas.addEventListener('pointermove', (event) => {
    if (dragging) drag(event)
    // Hovering follows one residue to where it lands. A finger has no hover, so touch only drags.
    else if (event.pointerType === 'mouse') setProbe(residueAt(event))
  })
  const release = () => {
    dragging = false
  }
  canvas.addEventListener('pointerup', release)
  canvas.addEventListener('pointercancel', release)
  canvas.addEventListener('pointerleave', () => setProbe(undefined))

  new ResizeObserver(() => {
    size = fitCanvas(canvas, ctx)
    render()
  }).observe(canvas)
  new IntersectionObserver(([entry]) => {
    inView = entry?.isIntersecting ?? false
    if (inView) startCycle()
    else stopCycle()
  }).observe(root)

  size = fitCanvas(canvas, ctx)
  show(n, m, 0)
  // The rim labels are set in the mono face, which may arrive after the first draw.
  void document.fonts.ready.then(render)
  root.dataset['live'] = ''

  const dial: Dial = {
    show(preset) {
      stopPlay()
      stopCycle()
      manual = false
      status.setAttribute('aria-live', 'off')
      showPreset(preset, presets.findIndex((item) => item.n === preset.n && item.m === preset.m))
    },
  }
  root.addEventListener('moddial:show', (event) => {
    if (event instanceof CustomEvent && typeof event.detail?.n === 'number' && typeof event.detail?.m === 'number') dial.show(event.detail)
  })
  return dial
}
