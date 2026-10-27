// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import MermaidDiagram from '../components/MermaidDiagram'

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  // jsdom has no canvas; Pele's built-in font metrics are used instead.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(() => root.unmount())
  host.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('recovers from a syntax error when the editor supplies a valid diagram', async () => {
  await act(() => root.render(<MermaidDiagram chart={'flowchart TD\n A -->'} />))
  await vi.waitFor(() => expect(host.querySelector('.pele-error')).not.toBeNull())

  await act(() => root.render(<MermaidDiagram chart={'flowchart TD\n A[수정된 문서] -->|확인| B[완료]'} />))
  await vi.waitFor(() => expect(host.querySelector('.pele-flowchart')).not.toBeNull())
  expect(host.querySelector('.pele-error')).toBeNull()
  expect(host.textContent).toContain('수정된 문서')
  expect(host.querySelector('.pele-edge-label rect')?.getAttribute('rx')).toBe('13')
})

it('keeps the latest document when diagram types change during loading', async () => {
  await act(() => root.render(<MermaidDiagram chart={'sequenceDiagram\n A->>B: 이전 문서'} />))
  await act(() => root.render(<MermaidDiagram chart={'flowchart TD\n A[최신 문서] --> B[완료]'} />))
  await vi.waitFor(() => expect(host.querySelector('.pele-flowchart')).not.toBeNull())
  expect(host.textContent).toContain('최신 문서')
  expect(host.textContent).not.toContain('이전 문서')
  expect(host.querySelectorAll('svg')).toHaveLength(1)
})
