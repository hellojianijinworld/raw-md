// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { downloadMarkdown } from '../utils/downloadMarkdown'

afterEach(() => vi.restoreAllMocks())

it('downloads Markdown using its title without a filename prompt', () => {
  const blobUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  let filename = ''
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    filename = this.download
  })
  downloadMarkdown('# 원문', '회의: 정리/메모?')
  expect(filename).toBe('회의_ 정리_메모_.md')
  expect(blobUrl.mock.calls[0][0]).toBeInstanceOf(Blob)
})
