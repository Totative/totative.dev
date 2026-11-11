import { onReadingProgress, wireCopyAttributes } from '../lib/enhance.ts'

const READ_DIGITS = 2

const bar = document.querySelector<HTMLElement>('.progress')
const article = document.querySelector('[data-progress]')
if (bar && article) {
  onReadingProgress(article, (fraction) => {
    bar.style.transform = `scaleX(${fraction})`
    bar.dataset.read = fraction.toFixed(READ_DIGITS)
  })
}

wireCopyAttributes()
