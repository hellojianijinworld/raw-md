import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { sanitizeSchema } from '../utils/sanitize'
import MermaidDiagram from './MermaidDiagram'
import 'github-markdown-css/github-markdown.css'
import 'katex/dist/katex.min.css'
import '../hljs-theme.css'

interface MarkdownViewerProps {
  content: string
}

/**
 * 원본 마크다운에서 ```mermaid 블록을 추출하여
 * React 컴포넌트 배열로 분리한다.
 * 이 방식은 rehype 파이프라인의 className 제거 영향을 받지 않는다.
 */
function splitMermaidBlocks(md: string): Array<{ type: 'md' | 'mermaid'; content: string }> {
  const parts: Array<{ type: 'md' | 'mermaid'; content: string }> = []
  const regex = /```mermaid\n([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(md)) !== null) {
    // mermaid 앞의 일반 마크다운
    if (match.index > lastIndex) {
      parts.push({ type: 'md', content: md.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'mermaid', content: match[1].trim() })
    lastIndex = regex.lastIndex
  }

  // 마지막 일반 마크다운
  if (lastIndex < md.length) {
    parts.push({ type: 'md', content: md.slice(lastIndex) })
  }

  // mermaid 블록이 없으면 전체를 하나로
  if (parts.length === 0) {
    parts.push({ type: 'md', content: md })
  }

  return parts
}

const components: Components = {
  pre({ children, node, ...props }) {
    // AST 기반 백업 감지 (remarkMermaid가 dataLanguage 속성을 달아줌)
    const codeChild = node?.children?.[0] as Record<string, unknown> | undefined
    if (codeChild && (codeChild as { tagName?: string }).tagName === 'code') {
      const props2 = (codeChild as { properties?: Record<string, unknown> }).properties
      const dataLanguage = props2?.dataLanguage as string | undefined
      const meta = props2?.dataMeta as string | undefined
      if (dataLanguage === 'mermaid' || meta?.includes('dataLanguage=mermaid')) {
        return <MermaidDiagram chart={extractText(children)} />
      }
    }
    return <pre {...props}>{children}</pre>
  },
}

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (node && typeof node === 'object' && 'props' in (node as object)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return extractText((node as any).props.children)
  }
  return ''
}

export default function MarkdownViewer({ content }: MarkdownViewerProps) {
  if (!content) {
    return (
      <div className="markdown-body">
        <p style={{ color: 'var(--fgColor-muted)' }}>마크다운을 입력하면 여기에 렌더링됩니다.</p>
      </div>
    )
  }

  // mermaid 블록을 사전 분리하여 독립 렌더링
  const blocks = splitMermaidBlocks(content)

  return (
    <div className="markdown-body">
      {blocks.map((block, i) => {
        if (block.type === 'mermaid') {
          return <MermaidDiagram key={`mermaid-${i}`} chart={block.content} />
        }
        return (
          <ReactMarkdown
            key={`md-${i}`}
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[[rehypeSanitize, sanitizeSchema], rehypeHighlight, rehypeKatex]}
            components={components}
          >
            {block.content}
          </ReactMarkdown>
        )
      })}
    </div>
  )
}
