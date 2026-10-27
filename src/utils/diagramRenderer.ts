import { detectType, load, register, type TextMeasurer } from 'pele/lazy'

export async function loadDiagram(source: string) {
  const type = detectType(source)
  await load(type)
  if (type === 'flowchart') {
    const { default: flowchart } = await import('pele/diagrams/flowchart')
    const themed: typeof flowchart = {
      ...flowchart,
      render(model, config, options) {
        const flow = config.flowchart
        // Pele merges top-level config; keep our routing default under source flowchart options.
        return flowchart.render(
          model,
          {
            ...config,
            flowchart: {
              curve: 'step',
              ...(flow && typeof flow === 'object' && !Array.isArray(flow) ? flow : {}),
            },
          },
          options,
        )
      },
    }
    register(themed)
  }
  return type
}

export function flowchartMeasurer(container: HTMLElement): TextMeasurer | undefined {
  const context = document.createElement('canvas').getContext('2d')
  if (!context) return undefined
  const style = getComputedStyle(container)
  const family = style.fontFamily || 'sans-serif'
  const mono = style.getPropertyValue('--font-mono').trim() || 'monospace'
  return {
    width(text, size, flags) {
      // Measure the same semibold face that the flowchart theme displays.
      context.font = `${flags & 2 ? 'italic ' : ''}${flags & 1 ? 700 : 600} ${size}px ${flags & 4 ? mono : family}`
      return context.measureText(text).width
    },
  }
}
