// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import MarkdownViewer from '../components/MarkdownViewer'

function render(content: string) {
  const host = document.createElement('div')
  host.innerHTML = renderToStaticMarkup(<MarkdownViewer content={content} />)
  return host
}

it('fits the document to its widest top-level table and resets the width for the next document', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(HTMLTableElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLTableElement) {
    return { width: Number(this.rows[1]?.cells[0]?.textContent) } as DOMRect
  })
  const host = document.createElement('div')
  const root = createRoot(host)
  try {
    await act(() =>
      root.render(
        <MarkdownViewer
          content={'| Width |\n| --- |\n| 960 |\n\n| Width |\n| --- |\n| 1280 |\n\n> | Width |\n> | --- |\n> | 2000 |'}
        />,
      ),
    )
    expect(host.firstElementChild?.getAttribute('style')).toContain('--document-table-width: 1280px')
    await act(() => root.render(<MarkdownViewer content="# Ordinary document" />))
    expect(host.firstElementChild?.getAttribute('style')).toContain('--document-table-width: 0px')
  } finally {
    await act(() => root.unmount())
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  }
})

it.each([
  '# Document\n\n## Wide\n\n',
  '',
])('keeps the width control with the overflowing table regardless of headings: %s', async (heading) => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('viewer-container') ? 1280 : 800
  })
  vi.spyOn(HTMLTableElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLTableElement) {
    return { width: Number(this.rows[1]?.cells[0]?.textContent) } as DOMRect
  })
  const host = document.createElement('div')
  host.className = 'viewer-container'
  const root = createRoot(host)
  try {
    await act(() =>
      root.render(
        <MarkdownViewer
          content={`${heading}| Width |\n| --- |\n| 1280 |\n\n## Small\n\n| Width |\n| --- |\n| 300 |`}
        />,
      ),
    )
    const button = host.querySelector<HTMLButtonElement>('.markdown-table .document-width-toggle')!
    expect(button).not.toBeNull()
    expect(host.querySelector('h1 .document-width-toggle, h2 .document-width-toggle')).toBeNull()
    expect(host.querySelectorAll('.document-width-toggle')).toHaveLength(1)
    expect(host.firstElementChild?.classList.contains('markdown-body-wide')).toBe(false)
    await act(() => button.click())
    expect(host.firstElementChild?.classList.contains('markdown-body-wide')).toBe(true)
    expect(button.getAttribute('aria-pressed')).toBe('true')
    await act(() => button.click())
    expect(host.firstElementChild?.classList.contains('markdown-body-wide')).toBe(false)
    await act(() => root.render(<MarkdownViewer content={'# Small\n\n| Width |\n| --- |\n| 300 |'} />))
    expect(host.querySelector('.document-width-toggle')).toBeNull()
  } finally {
    await act(() => root.unmount())
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  }
})

it('makes wide GFM tables keyboard-scrollable without losing headers, alignment or surrounding prose', () => {
  const host = render('앞 문단\n\n| 항목 | 설명 |\n| :--- | ---: |\n| 보고서 | 아주 긴 내용 |\n\n뒤 문단')
  const region = host.querySelector<HTMLElement>('section[aria-label="표"]')!
  expect(region).not.toBeNull()
  expect(region.tabIndex).toBe(0)
  expect(region.querySelectorAll('thead th')).toHaveLength(2)
  expect(region.querySelector('tbody td:last-child')?.getAttribute('style')).toContain('text-align:right')
  expect(region.closest('.markdown-table')?.previousElementSibling?.textContent).toBe('앞 문단')
  expect(region.closest('.markdown-table')?.nextElementSibling?.textContent).toBe('뒤 문단')
})

describe('fenced code highlighting', () => {
  it.each([
    'diff',
    'patch',
  ])('renders %s additions, deletions, headers and context without changing text', (language) => {
    const source =
      'diff --git a/app.ts b/app.ts\n--- a/app.ts\n+++ b/app.ts\n@@ -1,2 +1,2 @@\n-const title = "old"\n+const title = "새 제목"\n unchanged\n'
    const host = render(`\`\`\`${language}\n${source}\`\`\``)
    const code = host.querySelector('pre code')!
    expect(code.classList.contains(`language-${language}`)).toBe(true)
    expect(code.querySelector('.hljs-addition')?.textContent).toBe('+const title = "새 제목"')
    expect(code.querySelector('.hljs-deletion')?.textContent).toBe('-const title = "old"')
    expect(code.querySelector('.hljs-meta')?.textContent).toBe('@@ -1,2 +1,2 @@')
    expect(code.querySelector('.hljs-comment')?.textContent).toBe('diff --git a/app.ts b/app.ts')
    expect(code.textContent).toBe(source)
  })

  it.each([
    ['js', 'const answer = "hello"'],
    ['typescript', 'const answer: string = "hello"'],
    ['python', 'def hello():\n    return "hello"'],
    ['json', '{"answer": true}'],
    ['bash', 'echo "$HOME"'],
    ['sql', 'SELECT name FROM users;'],
    ['html', '<div class="hello">Hello</div>'],
    ['css', '.hello { color: red; }'],
    ['yaml', 'name: "hello"'],
  ])('highlights %s and preserves its source', (language, source) => {
    const code = render(`\`\`\`${language}\n${source}\n\`\`\``).querySelector('pre code')!
    expect(code.querySelector('span[class^="hljs-"]')).not.toBeNull()
    expect(code.textContent).toBe(`${source}\n`)
  })

  it.each(['', 'text', 'unknown-language'])('keeps %s fences readable as plain text', (language) => {
    const source = '<script>alert("test")</script>\n+literal text\n'
    const host = render(`\`\`\`${language}\n${source}\`\`\``)
    expect(host.querySelector('pre code')?.textContent).toBe(source)
    expect(host.querySelector('pre code span')).toBeNull()
    expect(host.querySelector('script')).toBeNull()
  })
})

it('assigns document-wide headings and resolves standard Korean links around Mermaid blocks', () => {
  window.history.replaceState(null, '', '/#BYUwNmD2Q')
  const host = render(
    '[이동](#같은-제목-1)\n\n## 같은 제목\n\n```mermaid\nflowchart TD\n A-->B\n```\n\n## 같은 제목\n\n### **강조**와 `코드`',
  )
  const headings = [...host.querySelectorAll('h2,h3')]
  expect(headings.map((h) => h.id)).toEqual(['raw-md-heading-1', 'raw-md-heading-2', 'raw-md-heading-3'])
  expect(headings.map((h) => h.getAttribute('data-heading-slug'))).toEqual(['같은-제목', '같은-제목-1', '강조와-코드'])
  expect(host.querySelector('a[data-heading-target="2"]')).not.toBeNull()
})

it('preserves generated footnote labels and resolves their local targets without replacing the payload', () => {
  window.history.replaceState(null, '', '/#BYUwNmD2Q')
  const host = render('# 문서\n\n주석[^1]\n\n[^1]: 설명')
  const reference = host.querySelector('a[data-footnote-ref]')!
  expect(host.querySelector(`[id="${reference.getAttribute('aria-describedby')}"]`)).not.toBeNull()
  const target = reference.getAttribute('data-document-target')!
  expect(host.querySelector(`[id="${target}"]`)).not.toBeNull()
  expect(reference.getAttribute('href')).toBe(`${window.location.origin}/#BYUwNmD2Q`)
  expect(host.querySelectorAll('[data-heading-index]')).toHaveLength(1)
})
