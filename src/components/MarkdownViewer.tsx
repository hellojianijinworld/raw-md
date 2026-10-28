import type { Element } from 'hast'
import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { localizeMessage, translate as t } from '../i18n/core'
import { useI18n } from '../i18n/useI18n'
import {
  ANCHOR_LAYOUT_SETTLE_MS,
  DOCUMENT_TARGET_ATTRIBUTE,
  HEADING_INDEX_ATTRIBUTE,
  HEADING_LINK_ATTRIBUTE,
  HEADING_TARGET_ATTRIBUTE,
  headingText,
  isPrimaryLinkClick,
  rehypeHeadingNavigation,
} from '../utils/headingNavigation'
import { sanitizeSchema } from '../utils/sanitize'
import { formatShareFragment, parseShareFragment } from '../utils/shareFragment'
import MermaidDiagram from './MermaidDiagram'
import 'github-markdown-css/github-markdown.css'
import 'katex/dist/katex.min.css'
import '../hljs-theme.css'

interface MarkdownViewerProps {
  content: string
  sectionLinksEnabled?: boolean
}

// Keep diagram components mounted when navigation callbacks change.
const renderCodeBlock: Components['pre'] = ({ children, node, ...props }) => {
  const code = node?.children[0]
  if (code?.type === 'element' && (code.properties.className as string[] | undefined)?.includes('language-mermaid'))
    return <MermaidDiagram chart={headingText(code)} />
  return <pre {...props}>{children}</pre>
}

export default function MarkdownViewer({ content, sectionLinksEnabled = true }: MarkdownViewerProps) {
  useI18n()

  const container = useRef<HTMLDivElement>(null)
  const [navigation, setNavigation] = useState(0)
  const lastNavigation = useRef(0)
  const [notice, setNotice] = useState('')
  let fragment: ReturnType<typeof parseShareFragment> = { payload: '' }
  try {
    fragment = parseShareFragment(typeof window === 'undefined' ? '' : window.location.hash)
  } catch {
    /* App handles malformed URLs. */
  }
  const canShare = sectionLinksEnabled && !!fragment.payload
  const base = typeof window === 'undefined' ? '' : window.location.origin + window.location.pathname

  useEffect(() => {
    const navigate = () => setNavigation((value) => value + 1)
    window.addEventListener('hashchange', navigate)
    window.addEventListener('popstate', navigate)
    return () => {
      window.removeEventListener('hashchange', navigate)
      window.removeEventListener('popstate', navigate)
    }
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: New document content can replace the target element.
  useEffect(() => {
    setNotice('')
    const explicitlyNavigated = navigation !== lastNavigation.current
    lastNavigation.current = navigation
    if (!sectionLinksEnabled || (!fragment.heading && !explicitlyNavigated)) return
    const root = container.current
    if (!root) return
    const target = fragment.heading
      ? root.querySelector<HTMLElement>(`[${HEADING_INDEX_ATTRIBUTE}="${fragment.heading}"]`)
      : undefined
    if (fragment.heading && !target) {
      setNotice(t('viewer.missingSection'))
      return
    }
    const scroll = () => {
      if (target) target.scrollIntoView?.({ block: 'start' })
      else root.parentElement?.scrollTo?.({ top: 0 })
    }
    target?.focus({ preventScroll: true })
    scroll()
    // Late diagrams/images can change the target offset. Stop correcting on user input.
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(scroll)
    observer?.observe(root)
    const stop = () => observer?.disconnect()
    const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const
    for (const event of events) root.addEventListener(event, stop, { passive: true })
    const timer = setTimeout(stop, ANCHOR_LAYOUT_SETTLE_MS)
    return () => {
      clearTimeout(timer)
      stop()
      for (const event of events) root.removeEventListener(event, stop)
    }
  }, [content, fragment.heading, navigation, sectionLinksEnabled])

  const navigate = useCallback(
    (event: MouseEvent<HTMLElement>, target: number | undefined) => {
      if (target === undefined) {
        event.preventDefault()
        setNotice(t('viewer.missingHeading'))
        return
      }
      if (canShare && !isPrimaryLinkClick(event)) return
      event.preventDefault()
      if (canShare) {
        const url = new URL(window.location.href)
        url.hash = formatShareFragment(fragment.payload, target || undefined)
        if (url.href !== window.location.href) window.history.pushState(null, '', url)
        setNavigation((value) => value + 1)
      } else {
        const heading = container.current?.querySelector<HTMLElement>(`[${HEADING_INDEX_ATTRIBUTE}="${target}"]`)
        heading?.focus({ preventScroll: true })
        heading?.scrollIntoView?.({ block: 'start' })
        if (target === 0) container.current?.parentElement?.scrollTo?.({ top: 0 })
      }
    },
    [canShare, fragment.payload],
  )

  const components = useMemo<Components>(
    () => ({
      pre: renderCodeBlock,
      a({ children, node, ...props }) {
        const properties = (node as Element | undefined)?.properties
        if (!properties?.[HEADING_LINK_ATTRIBUTE]) return <a {...props}>{children}</a>
        const raw = properties[HEADING_TARGET_ATTRIBUTE]
        const target = typeof raw === 'number' ? raw : undefined
        const localId = properties[DOCUMENT_TARGET_ATTRIBUTE]
        const onClick = (event: MouseEvent<HTMLElement>) => {
          if (typeof localId !== 'string') return navigate(event, target)
          if (canShare && !isPrimaryLinkClick(event)) return
          event.preventDefault()
          const localTarget = container.current?.ownerDocument.getElementById(localId)
          if (localTarget && container.current?.contains(localTarget)) {
            if (localTarget.tabIndex < 0) localTarget.tabIndex = -1
            localTarget.focus({ preventScroll: true })
            localTarget.scrollIntoView?.({ block: 'start' })
          }
        }
        if (!canShare)
          return (
            <button
              type="button"
              className={`document-anchor ${props.className ?? ''}`}
              aria-label={props['aria-label']}
              onClick={onClick}
            >
              {children}
            </button>
          )
        return (
          <a {...props} href={props.href} onClick={onClick}>
            {children}
          </a>
        )
      },
    }),
    [canShare, navigate],
  )

  return (
    <div className="markdown-body" ref={container}>
      {notice && (
        <p className="anchor-notice" role="status">
          {localizeMessage(notice)}
        </p>
      )}
      {!content ? (
        <p style={{ color: 'var(--fgColor-muted)' }}>{t('editor.preview')}</p>
      ) : (
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[
            [rehypeSanitize, sanitizeSchema],
            [rehypeHeadingNavigation, { payload: fragment.payload, base, canShare }],
            [rehypeHighlight, { ignoreMissing: true }],
            rehypeKatex,
          ]}
          components={components}
        >
          {content}
        </ReactMarkdown>
      )}
    </div>
  )
}
