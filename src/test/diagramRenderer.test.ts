import { render } from 'pele/lazy'
import { expect, it } from 'vitest'
import { loadDiagram } from '../utils/diagramRenderer'
import { diagramOptions } from '../utils/diagramTheme'

it.each([
  '%%{init:{"flowchart":{"htmlLabels":false}}}%%\n',
  '---\nconfig:\n  flowchart:\n    nodeSpacing: 60\n---\n',
])('keeps stepped routing when source config only changes unrelated options: %s', async (config) => {
  const source = `${config}flowchart TD\n A-->B\n A-->C`
  await loadDiagram(source)
  expect(render(source, diagramOptions).svg).not.toMatch(/d="[^"]*C[\d-]/)
})

it.each([
  '%%{init:{"flowchart":{"curve":"basis"}}}%%\n',
  '---\nconfig:\n  flowchart:\n    curve: basis\n---\n',
])('respects an author-specified curve: %s', async (config) => {
  const source = `${config}flowchart TD\n A-->B\n A-->C`
  await loadDiagram(source)
  expect(render(source, diagramOptions).svg).toMatch(/d="[^"]*C[\d-]/)
})
