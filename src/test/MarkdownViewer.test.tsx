// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import MarkdownViewer from '../components/MarkdownViewer'

function render(content: string) {
  const host = document.createElement('div')
  host.innerHTML = renderToStaticMarkup(<MarkdownViewer content={content} />)
  return host
}

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
