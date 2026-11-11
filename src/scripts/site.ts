import { onReadingProgress, wireCopyAttributes } from '../lib/enhance.ts'

const bar = document.querySelector<HTMLElement>('.progress')
const article = document.querySelector('[data-progress]')
if (bar && article) {
  onReadingProgress(article, (fraction) => {
    bar.style.transform = `scaleX(${fraction})`
    bar.dataset['read'] = fraction.toFixed(2)
  })
}

wireCopyAttributes()
