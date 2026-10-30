import type { MountOptions } from 'pele'

export const diagramOptions: MountOptions = {
  fontSize: 14,
  padding: 16,
  links: false,
  images: false,
  zoom: false,
}

export function applyCodexDiagramTheme(container: HTMLElement) {
  const svg = container.querySelector('.pele-flowchart')
  if (!svg) return

  for (const rect of svg.querySelectorAll<SVGRectElement>('.pele-edge-label > rect:not([data-codex-label])')) {
    const x = Number(rect.getAttribute('x'))
    const y = Number(rect.getAttribute('y'))
    const width = Number(rect.getAttribute('width'))
    const height = Number(rect.getAttribute('height'))
    const paddedHeight = Math.max(26, height + 8)
    rect.setAttribute('x', String(x - 8))
    rect.setAttribute('y', String(y - (paddedHeight - height) / 2))
    rect.setAttribute('width', String(width + 16))
    rect.setAttribute('height', String(paddedHeight))
    rect.setAttribute('rx', '13')
    rect.setAttribute('data-codex-label', '')
  }

  for (const shape of svg.querySelectorAll<SVGElement>('.pele-node > [style]:not(.pele-label)')) {
    const fill = shape.style.fill
    if (!fill || /^(none|transparent|#[\da-f]{6}00|#[\da-f]{3}0)$|(?:,\s*0|\/\s*0%?)\)$/i.test(fill)) continue
    shape.style.setProperty('--codex-source-fill', fill)
    shape.setAttribute('data-codex-fill', '')
  }

  for (const marker of svg.querySelectorAll<SVGPathElement>('path.pele-marker')) {
    // Only triangular markers become open arrows; circles and crosses keep their meaning.
    const triangle = marker.getAttribute('d')?.match(/^M([\d.,-]+)L([\d.,-]+)L([\d.,-]+)Z$/)
    if (!triangle) continue
    marker.setAttribute('d', `M${triangle[2]}L${triangle[1]}L${triangle[3]}`)
    marker.setAttribute('stroke', marker.getAttribute('fill') ?? 'var(--pele-line)')
    marker.setAttribute('fill', 'none')
    marker.setAttribute('stroke-linejoin', 'round')
  }
}
