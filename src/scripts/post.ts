import { addCopyButtons, addHeadingAnchors, spyHeadings } from '../lib/enhance'

const prose = document.querySelector<HTMLElement>('.prose')
if (prose) {
  addCopyButtons(prose)
  addHeadingAnchors(prose)
}
spyHeadings(document.querySelectorAll<HTMLAnchorElement>('.contents a'), undefined, 40)
