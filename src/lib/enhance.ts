// Copy, heading anchors, and reading progress used by the site scripts.

export const reducedMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The Clipboard API only exists on HTTPS and localhost, and the mocks are
 * opened over plain HTTP on the LAN, so this falls back to a selection copy.
 */
export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Permission refused or the document lost focus: try the selection copy.
    }
  }
  // The textarea goes inside an open modal dialog when there is one (anything
  // outside it is inert and cannot be selected), and focus goes back to where it was.
  const focused = document.activeElement
  const host = document.querySelector('dialog:modal') ?? document.body
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  host.append(area)
  area.select()
  const ok = document.execCommand('copy')
  area.remove()
  if (focused instanceof HTMLElement) focused.focus({ preventScroll: true })
  return ok
}

export interface CopyOptions {
  label?: string
  done?: string
  /** How long the button says it worked, in ms. */
  hold?: number
}

/** Makes `button` copy `text()` and say so for a moment. */
export function wireCopy(button: HTMLButtonElement, text: () => string, { label = 'Copy', done = 'Copied', hold = 1500 }: CopyOptions = {}): void {
  let timer = 0
  button.addEventListener('click', async () => {
    if (!(await copyText(text()))) return
    button.textContent = done
    button.dataset['copied'] = ''
    clearTimeout(timer)
    timer = window.setTimeout(() => {
      button.textContent = label
      delete button.dataset['copied']
    }, hold)
  })
}

/**
 * Wraps every `pre` under `root` in `div.code` and adds a `button.copy` to it.
 * A `data-lang` attribute on the wrapper carries the block's language.
 */
export function addCopyButtons(root: ParentNode = document, options: CopyOptions = {}): void {
  for (const pre of root.querySelectorAll('pre')) {
    if (pre.parentElement?.classList.contains('code')) continue
    const frame = document.createElement('div')
    frame.className = 'code'
    const lang = pre.dataset['language']
    if (lang) frame.dataset['lang'] = lang
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'copy'
    button.textContent = options.label ?? 'Copy'
    wireCopy(button, () => pre.textContent ?? '', options)
    pre.replaceWith(frame)
    frame.append(pre, button)
  }
}

/** Wires every `[data-copy]` button under `root` to copy that attribute's value. */
export function wireCopyAttributes(root: ParentNode = document, options: CopyOptions = {}): void {
  for (const button of root.querySelectorAll<HTMLButtonElement>('button[data-copy]')) {
    wireCopy(button, () => button.dataset['copy'] ?? '', { label: button.textContent ?? 'Copy', ...options })
  }
}

/** Adds a link to itself after each heading that has an id. */
export function addHeadingAnchors(root: ParentNode = document, symbol = '#', selector = 'h2[id], h3[id]'): void {
  for (const heading of root.querySelectorAll<HTMLElement>(selector)) {
    if (heading.querySelector('a.anchor')) continue
    const link = document.createElement('a')
    link.className = 'anchor'
    link.href = `#${heading.id}`
    link.textContent = symbol
    link.setAttribute('aria-label', `Link to "${heading.textContent ?? ''}"`)
    heading.append(link)
  }
}

/**
 * Marks the table-of-contents link for the section being read with
 * `aria-current="location"`. `offset` is the height, in px, that a sticky
 * header hides at the top of the viewport.
 */
export function spyHeadings(links: Iterable<HTMLAnchorElement>, onChange?: (id: string, link: HTMLAnchorElement) => void, offset = 96): void {
  const byId = new Map<string, HTMLAnchorElement>()
  for (const link of links) byId.set(decodeURIComponent(link.hash.slice(1)), link)
  const headings = [...byId.keys()].map((id) => document.getElementById(id)).filter((el) => el !== null)
  if (headings.length === 0) return
  let current = ''
  const update = () => {
    let active = ''
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top - offset > 1) break
      active = heading.id
    }
    // At the very bottom the last section may never reach the top of the viewport.
    const last = headings.at(-1)
    if (last && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) active = last.id
    if (active === current) return
    current = active
    for (const [id, link] of byId) {
      if (id === active) link.setAttribute('aria-current', 'location')
      else link.removeAttribute('aria-current')
    }
    const link = byId.get(active)
    if (link) onChange?.(active, link)
  }
  addEventListener('scroll', update, { passive: true })
  addEventListener('resize', update)
  update()
}

/** Calls `update` with how far `target` has been read, from 0 to 1. */
export function onReadingProgress(target: Element, update: (fraction: number) => void): void {
  const measure = () => {
    const box = target.getBoundingClientRect()
    const span = box.height - window.innerHeight
    update(span <= 0 ? 1 : Math.min(1, Math.max(0, -box.top / span)))
  }
  addEventListener('scroll', measure, { passive: true })
  addEventListener('resize', measure)
  measure()
}
