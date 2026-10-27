import { type Mounted, mount } from 'pele/lazy'
import { useEffect, useRef } from 'react'
import { flowchartMeasurer, loadDiagram } from '../utils/diagramRenderer'
import { applyCodexDiagramTheme, diagramOptions } from '../utils/diagramTheme'

interface Props {
  chart: string
}

export default function MermaidDiagram({ chart }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false
    let diagram: Mounted | undefined
    container.textContent = '로딩 중...'

    async function draw() {
      try {
        const type = await loadDiagram(chart)
        if (cancelled) return
        diagram = mount(container!, chart.trim(), {
          ...diagramOptions,
          measurer: type === 'flowchart' ? flowchartMeasurer(container!) : undefined,
          onRender: () => applyCodexDiagramTheme(container!),
        })
      } catch (error) {
        if (cancelled) return
        const message = document.createElement('div')
        message.className = 'pele-error'
        message.textContent = error instanceof Error ? error.message : 'Diagram render failed'
        container!.replaceChildren(message)
      }
    }

    void draw()
    return () => {
      cancelled = true
      diagram?.destroy()
    }
  }, [chart])

  return <div ref={containerRef} className="mermaid-diagram" />
}
