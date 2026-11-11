import type { ShikiTransformer } from 'shiki'

const TOKEN_NAME = /--astro-code-token-([a-z-]+)/
const FLAG_PREFIX = /^\s*-/

// Shiki writes each token's colour as an inline style. Moving it to a class
// lets every design colour the same markup from its own stylesheet.
export const tokenClasses: ShikiTransformer = {
  name: 'token-classes',
  pre(node) {
    node.properties.style = undefined
  },
  span(node) {
    const style = String(node.properties.style ?? '')
    node.properties.style = undefined
    const token = TOKEN_NAME.exec(style)?.[1]
    if (!token) {
      return
    }
    // The theme files a command's flags with its other arguments; telling them
    // apart is most of what colour can do for a shell block.
    const [first] = node.children
    const flag = token === 'string' && first?.type === 'text' && FLAG_PREFIX.test(first.value)
    this.addClassToHast(node, flag ? 'tok-flag' : `tok-${token}`)
  },
}
