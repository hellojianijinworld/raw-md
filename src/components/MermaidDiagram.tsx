import { type Mounted, mount } from 'pele/lazy'
import { useEffect, useRef } from 'react'
import { translate as t } from '../i18n/core'
import { useI18n } from '../i18n/useI18n'
import { flowchartMeasurer, loadDiagram } from '../utils/diagramRenderer'
import { applyCodexDiagramTheme, diagramOptions } from '../utils/diagramTheme'

interface Props {
  chart: string
}

export default function MermaidDiagram({ chart }: Props) {
  const { locale } = useI18n()

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.lang = locale

    let cancelled = false
    let diagram: Mounted | undefined
    container.textContent = t('common.loading')

    const showError = (error: unknown) => {
      if (cancelled) return
      const message = container.querySelector<HTMLElement>('.pele-error') ?? document.createElement('div')
      message.className = 'pele-error'
      message.textContent = `${t('diagram.error')}${error instanceof Error ? `\n${error.message}` : ''}`
      if (!message.parentNode) container.replaceChildren(message)
    }

    async function draw() {
      try {
        const type = await loadDiagram(chart)
        if (cancelled) return
        diagram = mount(container!, chart.trim(), {
          ...diagramOptions,
          measurer: type === 'flowchart' ? flowchartMeasurer(container!) : undefined,
          onRender: () => applyCodexDiagramTheme(container!),
          onError: showError,
        })
      } catch (error) {
        showError(error)
      }
    }

    void draw()
    return () => {
      cancelled = true
      diagram?.destroy()
    }
  }, [chart, locale])

  return <div ref={containerRef} className="mermaid-diagram" />
}
