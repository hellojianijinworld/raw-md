import GithubSlugger from 'github-slugger'
import type { Element, Root, RootContent } from 'hast'
import { SANITIZE_ID_PREFIX } from './sanitize'
import { formatShareFragment } from './shareFragment'

export const HEADING_ID_PREFIX = 'raw-md-heading-'
export const HEADING_INDEX_ATTRIBUTE = 'data-heading-index'
export const HEADING_TARGET_ATTRIBUTE = 'data-heading-target'
export const HEADING_LINK_ATTRIBUTE = 'data-heading-link'
export const DOCUMENT_TARGET_ATTRIBUTE = 'data-document-target'
export const ANCHOR_LAYOUT_SETTLE_MS = 3000
const HEADING_TAG_PATTERN = /^h[1-6]$/

export function isPrimaryLinkClick(event: {
  button: number
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
}): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

export function headingText(node: RootContent): string {
  if (node.type === 'text') return node.value
  if (node.type !== 'element') return ''
  if (node.tagName === 'img') return String(node.properties.alt ?? '')
  return node.children.map(headingText).join('')
}

/** Run after sanitization: only generated numeric IDs are added, never user IDs. */
export function rehypeHeadingNavigation(options: { payload: string; base: string; canShare: boolean }) {
  return (tree: Root) => {
    const slugger = new GithubSlugger()
    const headings: Element[] = []
    const links: Element[] = []
    const targets = new Map<string, number>()
    const existingIds = new Map<string, string>()
    const walk = (nodes: RootContent[]) => {
      for (const node of nodes) {
        if (node.type !== 'element') continue
        if (typeof node.properties.id === 'string') {
          const id = node.properties.id
          existingIds.set(id, id)
          if (id.startsWith(SANITIZE_ID_PREFIX)) existingIds.set(id.slice(SANITIZE_ID_PREFIX.length), id)
        }
        // Preserve generated labels referenced by aria-describedby (e.g. footnotes).
        if (HEADING_TAG_PATTERN.test(node.tagName) && !node.properties.id) {
          const index = headings.length + 1
          const slug = slugger.slug(headingText(node))
          node.properties.id = `${HEADING_ID_PREFIX}${index}`
          node.properties.tabIndex = -1
          node.properties[HEADING_INDEX_ATTRIBUTE] = index
          node.properties['data-heading-slug'] = slug
          headings.push(node)
          targets.set(slug, index)
        }
        if (node.tagName === 'a' && String(node.properties.href ?? '').startsWith('#')) links.push(node)
        walk(node.children)
      }
    }
    walk(tree.children)
    const decorate = (link: Element, target: number | undefined) => {
      link.properties[HEADING_LINK_ATTRIBUTE] = true
      if (target !== undefined) link.properties[HEADING_TARGET_ATTRIBUTE] = target
      link.properties.href = options.canShare
        ? `${options.base}#${formatShareFragment(options.payload, target || undefined)}`
        : '#'
    }
    for (const link of links) {
      const raw = String(link.properties.href).slice(1)
      let target: number | undefined
      try {
        const decoded = decodeURIComponent(raw)
        target = raw ? targets.get(decoded) : 0
        if (target === undefined && existingIds.has(decoded))
          link.properties[DOCUMENT_TARGET_ATTRIBUTE] = existingIds.get(decoded)
      } catch {
        /* Invalid links never replace the payload. */
      }
      decorate(link, target)
    }
    for (const [offset, node] of headings.entries()) {
      const link: Element = {
        type: 'element',
        tagName: 'a',
        properties: { className: ['heading-link'], 'aria-label': `${headingText(node)} 섹션 링크` },
        children: [{ type: 'text', value: '#' }],
      }
      decorate(link, offset + 1)
      node.children.push(link)
    }
  }
}
