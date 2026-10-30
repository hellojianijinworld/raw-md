// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { render } from 'pele'
import { afterEach, describe, expect, it } from 'vitest'
import { applyCodexDiagramTheme, diagramOptions } from '../utils/diagramTheme'

function draw(source: string) {
  const container = document.createElement('div')
  container.innerHTML = render(source, {
    ...diagramOptions,
    measurer: { width: (text, size) => Array.from(text).length * size * 0.6 },
  }).svg
  return container
}

afterEach(() => {
  document.body.replaceChildren()
  for (const style of document.head.querySelectorAll('style')) style.remove()
  document.documentElement.removeAttribute('data-color-mode')
})

describe('Codex diagram theme', () => {
  it('centers a padded capsule on the existing edge label', () => {
    const container = draw('flowchart TD\n A[시작] -->|확인| B[완료]')
    const label = container.querySelector<SVGRectElement>('.pele-edge-label rect')!
    const before = ['x', 'y', 'width', 'height'].map((name) => Number(label.getAttribute(name)))

    applyCodexDiagramTheme(container)

    expect(Number(label.getAttribute('x'))).toBeCloseTo(before[0] - 8)
    expect(Number(label.getAttribute('width'))).toBeCloseTo(before[2] + 16)
    expect(Number(label.getAttribute('height'))).toBe(26)
    expect(Number(label.getAttribute('y'))).toBeCloseTo(before[1] - 4)
    expect(label.getAttribute('rx')).toBe('13')
  })

  it('does not grow capsules when the theme is applied again', () => {
    const container = draw('flowchart TD\n A -->|확인| B')
    applyCodexDiagramTheme(container)
    const once = container.innerHTML
    applyCodexDiagramTheme(container)
    expect(container.innerHTML).toBe(once)
  })

  it('preserves author colors for theme-aware fills and keeps decision shapes', () => {
    const container = draw(`flowchart TD
      A[시작] --> B{분기}
      classDef changed fill:#fff0d9,stroke:#d97706,stroke-width:2px,color:#111827;
      class A changed;`)
    applyCodexDiagramTheme(container)
    const shape = container.querySelector<SVGRectElement>('[data-id="A"] rect')!
    expect(shape.style.fill).toBe('rgb(255, 240, 217)')
    expect(shape.style.getPropertyValue('--codex-source-fill')).toBe('rgb(255, 240, 217)')
    expect(shape.style.stroke).toBe('rgb(217, 119, 6)')
    expect(shape.style.strokeWidth).toBe('2px')
    expect(container.querySelector('[data-id="B"] polygon')).not.toBeNull()
  })

  it('leaves transparent node fills transparent', () => {
    const container = draw('flowchart TD\n A[시작]\n style A fill:transparent')
    applyCodexDiagramTheme(container)
    expect(container.querySelector('[data-id="A"] rect')?.getAttribute('data-codex-fill')).toBeNull()
  })

  it('preserves a zero-alpha fill instead of mixing it into an opaque background', () => {
    const container = draw('flowchart TD\n A[시작]\n style A fill:#00000000')
    applyCodexDiagramTheme(container)
    expect(container.querySelector('[data-id="A"] rect')?.getAttribute('data-codex-fill')).toBeNull()
  })

  it('opens triangular arrowheads without changing their tip or color', () => {
    const container = draw('flowchart TD\n A --> B\n linkStyle 0 stroke:#d97706')
    const marker = container.querySelector<SVGPathElement>('.pele-marker')!
    const points = marker.getAttribute('d')!.match(/-?\d+(?:\.\d+)?/g)!
    applyCodexDiagramTheme(container)
    expect(marker.getAttribute('d')).toBe(
      `M${points[2]},${points[3]}L${points[0]},${points[1]}L${points[4]},${points[5]}`,
    )
    expect(marker.getAttribute('fill')).toBe('none')
    expect(marker.getAttribute('stroke')).toBe('#d97706')
  })

  it('leaves non-flowchart geometry unchanged', () => {
    const container = draw('sequenceDiagram\n Alice->>Bob: 안녕하세요')
    const before = container.innerHTML
    applyCodexDiagramTheme(container)
    expect(container.innerHTML).toBe(before)
  })

  it('keeps untrusted diagram text inert and disables diagram navigation', () => {
    const container = draw(`flowchart TD
      A["<img src=x onerror=alert(1)>"] --> B[완료]
      click B "javascript:alert(1)"`)
    applyCodexDiagramTheme(container)
    expect(container.querySelector('img, script, [onerror], a[href]')).toBeNull()
    expect(container.textContent).toContain('완료')
  })

  it('preserves text-only emphasis in dark mode', () => {
    const style = document.createElement('style')
    style.textContent = readFileSync('src/index.css', 'utf8')
    document.head.append(style)
    document.documentElement.setAttribute('data-color-mode', 'dark')
    const container = draw('flowchart TD\n A[실패]\n style A color:#ff0000')
    container.className = 'mermaid-diagram'
    document.body.append(container)
    applyCodexDiagramTheme(container)
    expect(getComputedStyle(container.querySelector('.pele-label')!).fill).toBe('rgb(255, 0, 0)')
  })
})
