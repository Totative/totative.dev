import {
  addCopyButtons,
  addHeadingAnchors,
  copyText,
  onReadingProgress,
  reducedMotion,
  spyHeadings,
  wireCopy,
  wireCopyAttributes,
} from './enhance.ts'

type Listener = () => void | Promise<void>

interface Doc {
  body: MiniEl
  documentElement: MiniEl
  activeElement: MiniEl | null
  createElement: (tag: string) => MiniEl
  querySelector: (selector: string) => MiniEl | null
  querySelectorAll: (selector: string) => MiniEl[]
  getElementById: (id: string) => MiniEl | null
  execCommand: (command: string) => boolean
}

let copiedVia = ''
let execOk = true
let windowListeners: { scroll: Listener[]; resize: Listener[] } = { scroll: [], resize: [] }

class MiniEl {
  tag: string
  id = ''
  className = ''
  textContent = ''
  type = ''
  href = ''
  hash = ''
  value = ''
  modal = false
  scrollHeight = 0
  parentElement: MiniEl | null = null
  children: MiniEl[] = []
  attrs: Record<string, string> = {}
  dataset: Record<string, string> = {}
  style: Record<string, string> = {}
  listeners: Record<string, Listener[]> = { click: [] }
  rect = { top: 0, height: 0 }
  classList = { contains: (c: string) => this.className.split(/\s+/).includes(c) }

  constructor(tag: string) {
    this.tag = tag
  }

  focus(_o?: { preventScroll?: boolean }) {
    doc.activeElement = this
  }

  setAttribute(name: string, value: string) {
    this.attrs[name] = value
    if (name.startsWith('data-')) {
      this.dataset[name.slice(5)] = value
    }
  }

  getAttribute(name: string) {
    return this.attrs[name] ?? null
  }

  removeAttribute(name: string) {
    delete this.attrs[name]
    if (name.startsWith('data-')) {
      delete this.dataset[name.slice(5)]
    }
  }

  append(...nodes: MiniEl[]) {
    for (const node of nodes) {
      node.remove()
      node.parentElement = this
      this.children.push(node)
    }
  }

  remove() {
    const parent = this.parentElement
    if (!parent) {
      return
    }
    parent.children.splice(parent.children.indexOf(this), 1)
    this.parentElement = null
  }

  replaceWith(node: MiniEl) {
    const parent = this.parentElement
    if (!parent) {
      return
    }
    parent.children[parent.children.indexOf(this)] = node
    node.parentElement = parent
    this.parentElement = null
  }

  querySelector(selector: string) {
    return this.querySelectorAll(selector)[0] ?? null
  }

  querySelectorAll(selector: string) {
    const parts = selector.split(',').map((s) => s.trim())
    return walk(this).filter((el) => parts.some((part) => matches(el, part)))
  }

  addEventListener(type: string, fn: Listener) {
    const list = this.listeners[type]
    if (list) {
      list.push(fn)
      return
    }
    this.listeners[type] = [fn]
  }

  async click() {
    for (const fn of this.listeners.click) {
      await fn()
    }
  }

  select() {
    copiedVia = `exec:${this.value}:host=${this.parentElement?.tag}`
  }

  getBoundingClientRect() {
    return this.rect
  }
}

function walk(node: MiniEl, acc: MiniEl[] = []): MiniEl[] {
  for (const child of node.children) {
    acc.push(child)
    walk(child, acc)
  }
  return acc
}

function matches(el: MiniEl, selector: string): boolean {
  if (selector === 'dialog:modal') {
    return el.tag === 'dialog' && el.modal
  }
  const attr = /^([a-z][\w-]*)\[([a-z-]+)\]$/i.exec(selector)
  if (attr) {
    const [, tag, name] = attr
    if (el.tag !== tag) {
      return false
    }
    if (name === 'id') {
      return el.id !== ''
    }
    return name.startsWith('data-') ? name.slice(5) in el.dataset : name in el.attrs
  }
  const cls = /^([a-z][\w-]*)\.([a-z][\w-]*)$/i.exec(selector)
  if (cls) {
    return el.tag === cls[1] && el.className.split(/\s+/).includes(cls[2])
  }
  return el.tag === selector
}

function makeDoc(): Doc {
  const body = new MiniEl('body')
  return {
    body,
    documentElement: new MiniEl('html'),
    activeElement: null,
    createElement: (tag) => new MiniEl(tag),
    querySelector: (selector) => body.querySelector(selector),
    querySelectorAll: (selector) => body.querySelectorAll(selector),
    getElementById: (id) => walk(body).find((el) => el.id === id) ?? null,
    execCommand: (command) => command === 'copy' && execOk,
  }
}

let doc = makeDoc()

function install() {
  doc = makeDoc()
  windowListeners = { scroll: [], resize: [] }
  copiedVia = ''
  execOk = true
  Object.assign(globalThis, {
    document: doc,
    HTMLElement: MiniEl,
    addEventListener: (type: string, fn: Listener) => {
      if (type === 'scroll' || type === 'resize') {
        windowListeners[type].push(fn)
      }
    },
  })
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { clipboard: undefined as { writeText: (t: string) => Promise<void> } | undefined },
  })
}

function eq(got: unknown, want: unknown, msg: string) {
  if (got !== want) {
    throw new Error(`${msg}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
  }
}

function fireScroll() {
  for (const fn of windowListeners.scroll) {
    fn()
  }
}

install()

for (const want of [true, false]) {
  Object.assign(globalThis, { matchMedia: () => ({ matches: want }) })
  eq(reducedMotion(), want, `reducedMotion matches=${want}`)
}

const copyCases: Array<{
  name: string
  clipboard?: 'ok' | 'throw'
  exec: boolean
  modal?: boolean
  want: boolean
  via?: string
}> = [
  { name: 'clipboard', clipboard: 'ok', exec: false, want: true, via: 'clip:hi' },
  { name: 'clipboard-throw', clipboard: 'throw', exec: true, want: true, via: 'exec:hi:host=body' },
  { name: 'exec', exec: true, want: true, via: 'exec:hi:host=body' },
  { name: 'fail', exec: false, want: false, via: 'exec:hi:host=body' },
  { name: 'modal', exec: true, modal: true, want: true, via: 'exec:hi:host=dialog' },
]

for (const row of copyCases) {
  install()
  execOk = row.exec
  const prev = doc.createElement('button')
  doc.body.append(prev)
  doc.activeElement = prev
  if (row.modal) {
    const dialog = doc.createElement('dialog')
    dialog.modal = true
    doc.body.append(dialog)
  }
  const nav = globalThis.navigator as { clipboard?: { writeText: (t: string) => Promise<void> } }
  if (row.clipboard === 'ok') {
    nav.clipboard = {
      writeText: async (text: string) => {
        copiedVia = `clip:${text}`
      },
    }
  } else if (row.clipboard === 'throw') {
    nav.clipboard = {
      writeText: async () => {
        throw new Error('denied')
      },
    }
  }
  const got = await copyText('hi')
  eq(got, row.want, `copyText ${row.name} return`)
  if (row.via) {
    eq(copiedVia, row.via, `copyText ${row.name} via`)
  }
  eq(doc.activeElement, prev, `copyText ${row.name} restores focus`)
}

{
  install()
  const root = doc.createElement('div')
  const pre = doc.createElement('pre')
  pre.dataset.language = 'js'
  pre.textContent = 'code()'
  root.append(pre)
  doc.body.append(root)
  addCopyButtons(root as never, { label: 'Copy all', done: 'Done', hold: 20 })
  addCopyButtons(root as never, { label: 'Copy all', done: 'Done', hold: 20 })
  const frames = walk(root).filter((el) => el.className === 'code')
  eq(frames.length, 1, 'addCopyButtons wraps once')
  eq(frames[0]?.dataset.lang, 'js', 'addCopyButtons data-lang')
  eq(frames[0]?.children[0]?.tag, 'pre', 'addCopyButtons keeps pre')
  const button = frames[0]?.children[1]
  eq(button?.className, 'copy', 'addCopyButtons copy class')
  eq(button?.type, 'button', 'addCopyButtons button type')
  eq(button?.textContent, 'Copy all', 'addCopyButtons label')
  await button?.click()
  eq(copiedVia, 'exec:code():host=body', 'addCopyButtons copies pre text')
  eq(button?.textContent, 'Done', 'addCopyButtons done label')
  eq('copied' in (button?.dataset ?? {}), true, 'addCopyButtons data-copied')
  await new Promise((resolve) => setTimeout(resolve, 25))
  eq(button?.textContent, 'Copy all', 'addCopyButtons restores label')
  eq('copied' in (button?.dataset ?? {}), false, 'addCopyButtons clears data-copied')
}

{
  install()
  execOk = false
  const button = doc.createElement('button')
  button.textContent = 'Copy'
  wireCopy(button as never, () => 'x')
  await button.click()
  eq(button.textContent, 'Copy', 'wireCopy stays put on failure')
}

{
  install()
  const root = doc.createElement('div')
  const button = doc.createElement('button')
  button.textContent = 'Grab'
  button.dataset.copy = 'token'
  root.append(button)
  wireCopyAttributes(root as never)
  await button.click()
  eq(copiedVia, 'exec:token:host=body', 'wireCopyAttributes copies data-copy')
  eq(button.textContent, 'Copied', 'wireCopyAttributes uses default done')
}

const headingCases: Array<{
  name: string
  html: Array<{ tag: string; id?: string; text: string; hasAnchor?: boolean }>
  symbol?: string
  selector?: string
  want: Array<{ id: string; href: string; text: string; label?: string } | null>
}> = [
  {
    name: 'h2 with id',
    html: [{ tag: 'h2', id: 'a', text: 'Title' }],
    want: [{ id: 'a', href: '#a', text: '#', label: 'Link to "Title"' }],
  },
  {
    name: 'no id',
    html: [{ tag: 'h2', text: 'Nope' }],
    want: [null],
  },
  {
    name: 'existing anchor',
    html: [{ tag: 'h2', id: 'b', text: 'Has', hasAnchor: true }],
    want: [{ id: 'b', href: '#old', text: 'old' }],
  },
  {
    name: 'custom',
    html: [{ tag: 'h4', id: 'c', text: 'Four' }],
    symbol: '¶',
    selector: 'h4[id]',
    want: [{ id: 'c', href: '#c', text: '¶', label: 'Link to "Four"' }],
  },
]

for (const row of headingCases) {
  install()
  const root = doc.createElement('div')
  const headings: MiniEl[] = []
  for (const spec of row.html) {
    const heading = doc.createElement(spec.tag)
    if (spec.id) {
      heading.id = spec.id
    }
    heading.textContent = spec.text
    if (spec.hasAnchor) {
      const existing = doc.createElement('a')
      existing.className = 'anchor'
      existing.href = '#old'
      existing.hash = '#old'
      existing.textContent = 'old'
      heading.append(existing)
    }
    root.append(heading)
    headings.push(heading)
  }
  addHeadingAnchors(root as never, row.symbol, row.selector)
  addHeadingAnchors(root as never, row.symbol, row.selector)
  for (const [i, heading] of headings.entries()) {
    const want = row.want[i]
    const anchors = heading.querySelectorAll('a.anchor')
    if (!want) {
      eq(anchors.length, 0, `${row.name} no anchor`)
      continue
    }
    eq(anchors.length, 1, `${row.name} one anchor`)
    eq(anchors[0]?.href, want.href, `${row.name} href`)
    eq(anchors[0]?.textContent, want.text, `${row.name} symbol`)
    if (want.label) {
      eq(anchors[0]?.getAttribute('aria-label'), want.label, `${row.name} label`)
    }
  }
}

{
  install()
  const links = ['a', 'b', 'c'].map((id) => {
    const link = doc.createElement('a')
    link.href = `#${id}`
    link.hash = `#${id}`
    return link
  })
  const missing = doc.createElement('a')
  missing.href = '#nope'
  missing.hash = '#nope'

  spyHeadings([missing] as never)
  eq(windowListeners.scroll.length, 0, 'spyHeadings skips missing ids')

  const tops = (values: number[]) => {
    for (const [i, id] of ['a', 'b', 'c'].entries()) {
      const heading = doc.getElementById(id) ?? doc.createElement('h2')
      heading.id = id
      heading.rect.top = values[i] ?? 0
      if (!heading.parentElement) {
        doc.body.append(heading)
      }
    }
  }

  const current = () => links.map((l) => l.getAttribute('aria-current')).join(',')
  let seen = ''
  tops([0, 200, 400])
  Object.defineProperty(globalThis, 'innerHeight', { configurable: true, value: 800 })
  Object.defineProperty(globalThis, 'scrollY', { configurable: true, value: 0 })
  doc.documentElement.scrollHeight = 4000
  spyHeadings(links as never, (id) => {
    seen = id
  })
  eq(current(), 'location,,', 'spyHeadings first section')
  eq(seen, 'a', 'spyHeadings onChange a')

  tops([-10, -5, 400])
  fireScroll()
  eq(current(), ',location,', 'spyHeadings second section')
  eq(seen, 'b', 'spyHeadings onChange b')

  Object.defineProperty(globalThis, 'scrollY', { configurable: true, value: 3200 })
  fireScroll()
  eq(current(), ',,location', 'spyHeadings bottom pins last')
  eq(seen, 'c', 'spyHeadings onChange c')

  seen = 'stale'
  fireScroll()
  eq(seen, 'stale', 'spyHeadings ignores unchanged')

  install()
  Object.defineProperty(globalThis, 'innerHeight', { configurable: true, value: 800 })
  Object.defineProperty(globalThis, 'scrollY', { configurable: true, value: 0 })
  const space = doc.createElement('h2')
  space.id = 'foo bar'
  space.rect.top = 0
  doc.body.append(space)
  const spaceLink = doc.createElement('a')
  spaceLink.hash = `#${encodeURIComponent('foo bar')}`
  spyHeadings([spaceLink] as never)
  eq(spaceLink.getAttribute('aria-current'), 'location', 'spyHeadings decodes hash')
}

{
  install()
  const target = doc.createElement('article')
  doc.body.append(target)
  const rows: Array<{ height: number; inner: number; top: number; want: number }> = [
    { height: 100, inner: 100, top: 0, want: 1 },
    { height: 200, inner: 100, top: 0, want: 0 },
    { height: 200, inner: 100, top: -50, want: 0.5 },
    { height: 200, inner: 100, top: 50, want: 0 },
    { height: 200, inner: 100, top: -150, want: 1 },
  ]
  for (const row of rows) {
    target.rect = { top: row.top, height: row.height }
    Object.defineProperty(globalThis, 'innerHeight', { configurable: true, value: row.inner })
    let got = Number.NaN
    onReadingProgress(target as never, (fraction) => {
      got = fraction
    })
    eq(got, row.want, `onReadingProgress h=${row.height} top=${row.top}`)
  }
  target.rect = { top: -25, height: 200 }
  Object.defineProperty(globalThis, 'innerHeight', { configurable: true, value: 100 })
  fireScroll()
  let got = Number.NaN
  onReadingProgress(target as never, (fraction) => {
    got = fraction
  })
  eq(got, 0.25, 'onReadingProgress scroll listener')
}
