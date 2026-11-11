import type { ShikiTransformer } from 'shiki'

// Shiki writes each token's colour as an inline style. Moving it to a class
// lets every design colour the same markup from its own stylesheet.
export const tokenClasses: ShikiTransformer = {
  name: 'token-classes',
  pre(node) {
    delete node.properties['style']
  },
  span(node) {
    const style = String(node.properties['style'] ?? '')
    delete node.properties['style']
    const token = /--astro-code-token-([a-z-]+)/.exec(style)?.[1]
    if (!token) return
    // The theme files a command's flags with its other arguments; telling them
    // apart is most of what colour can do for a shell block.
    const [first] = node.children
    const flag = token === 'string' && first?.type === 'text' && /^\s*-/.test(first.value)
    this.addClassToHast(node, flag ? 'tok-flag' : `tok-${token}`)
  },
}
