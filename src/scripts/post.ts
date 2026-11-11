import { addCopyButtons, addHeadingAnchors, spyHeadings } from '../lib/enhance.ts'

const HEADING_OFFSET = 40

const prose = document.querySelector<HTMLElement>('.prose')
if (prose) {
  addCopyButtons(prose)
  addHeadingAnchors(prose)
}
spyHeadings(document.querySelectorAll<HTMLAnchorElement>('.contents a'), undefined, HEADING_OFFSET)
