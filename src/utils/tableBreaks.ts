import type { Root } from 'mdast'

const TABLE_BREAK = /^<br\s*\/?\s*>$/i

type MarkdownNode = {
  type: string
  value?: string
  children?: MarkdownNode[]
}

export function remarkTableBreaks() {
  return (tree: Root) => {
    const walk = (node: MarkdownNode, inCell = false) => {
      const insideCell = inCell || node.type === 'tableCell'
      if (insideCell && node.type === 'html' && node.value && TABLE_BREAK.test(node.value)) {
        node.type = 'break'
        delete node.value
      }
      node.children?.forEach((child) => {
        walk(child, insideCell)
      })
    }
    walk(tree as MarkdownNode)
  }
}
