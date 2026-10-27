// @vitest-environment jsdom
import { Blob } from 'node:buffer'
import { createRequire } from 'node:module'
import LZString from 'lz-string'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { copyShareUrlToClipboard, decodeMarkdownFromHash, generateShareUrl } from '../utils/url'
import { decodeMarkdown, encodeMarkdown } from '../utils/urlCodec'
import { CompressionWorker } from './CompressionWorker'

const brotli = createRequire(import.meta.url)('brotli-wasm')
const source = '# 공유 문서\n\n원문과 같은 한글·공백·줄바꿈을 복원합니다.\n'.repeat(100)

beforeEach(() => {
  CompressionWorker.pending = []
  vi.stubGlobal('Worker', CompressionWorker)
  vi.stubGlobal('Blob', Blob)
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('generates a smaller URL and opens that exact shared document', async () => {
  const pending = generateShareUrl(source)
  CompressionWorker.finishAll()
  const url = await pending
  expect(url.length).toBeLessThan(
    `${window.location.origin}/#${LZString.compressToEncodedURIComponent(source)}`.length * 0.8,
  )
  window.history.replaceState(null, '', url)
  const loading = decodeMarkdownFromHash()
  CompressionWorker.finishAll()
  expect(await loading).toBe(source)
})

it('loads modern links asynchronously and exposes damage instead of clearing the document', async () => {
  const hash = encodeMarkdown(source, brotli)
  window.history.replaceState(null, '', `/#${hash}`)
  const valid = decodeMarkdownFromHash()
  CompressionWorker.finishAll()
  expect(await valid).toBe(source)
  window.history.replaceState(null, '', `/#${hash.slice(0, -8)}`)
  const invalid = Promise.resolve(decodeMarkdownFromHash())
  const rejection = expect(invalid).rejects.toThrow()
  CompressionWorker.finishAll()
  await rejection
})

it('starts a clipboard write within the click gesture while compression is still pending', async () => {
  let activation = true
  let copied = ''
  class Item {
    constructor(public data: Record<string, Promise<Blob>>) {}
  }
  vi.stubGlobal('ClipboardItem', Item)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      async write(items: Item[]) {
        if (!activation) throw new Error('NotAllowedError')
        copied = await (await items[0].data['text/plain']).text()
      },
      async writeText() {
        throw new Error('NotAllowedError')
      },
    },
  })
  const pending = copyShareUrlToClipboard(source)
  activation = false
  CompressionWorker.finishAll()
  expect(await pending).toBe(copied)
  expect(decodeMarkdown(new URL(copied).hash.slice(1), brotli)).toBe(source)
})

it('copies with writeText when promise-backed ClipboardItem is unavailable', async () => {
  vi.stubGlobal('ClipboardItem', undefined)
  let copied = ''
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      async writeText(text: string) {
        copied = text
      },
    },
  })
  const pending = copyShareUrlToClipboard(source)
  CompressionWorker.finishAll()
  expect(await pending).toBe(copied)
  expect(decodeMarkdown(new URL(copied).hash.slice(1), brotli)).toBe(source)
})

it('aborts a superseded load and releases its worker', async () => {
  const controller = new AbortController()
  window.history.replaceState(null, '', '/#BYUwNmD2Q')
  const loading = Promise.resolve(decodeMarkdownFromHash(controller.signal))
  const rejection = expect(loading).rejects.toMatchObject({ name: 'AbortError' })
  const worker = CompressionWorker.pending[0]
  controller.abort()
  await rejection
  expect(worker.terminated).toBe(true)
})

it('handles clipboard denial even when the encoder also fails later', async () => {
  class Item {
    constructor(public data: Record<string, Promise<Blob>>) {}
  }
  vi.stubGlobal('ClipboardItem', Item)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      async write() {
        throw new Error('Permission denied')
      },
    },
  })
  const pending = copyShareUrlToClipboard(source)
  CompressionWorker.pending[0].onerror?.()
  expect(await pending).toBeNull()
  await new Promise((resolve) => setTimeout(resolve, 0))
})

it.each(['constructor', 'write'])('stops a pending encoder when clipboard %s rejects', async (stage) => {
  class Item {
    data: Record<string, Promise<Blob>>
    constructor(data: Record<string, Promise<Blob>>) {
      if (stage === 'constructor') throw new Error('ClipboardItem unavailable')
      this.data = data
    }
  }
  vi.stubGlobal('ClipboardItem', Item)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      async write() {
        throw new Error('Permission denied')
      },
    },
  })
  expect(await copyShareUrlToClipboard(source)).toBeNull()
  expect(CompressionWorker.pending[0].terminated).toBe(true)
})
