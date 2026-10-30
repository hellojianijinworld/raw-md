// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { webcrypto } from 'node:crypto'
import { createRequire } from 'node:module'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '../App'
import { deleteDocument, listDocuments, putDocument, setDocumentPinned } from '../utils/documentStorage'
import { encryptMarkdown } from '../utils/encryption'
import { encodeMarkdownToHash } from '../utils/url'
import { CompressionWorker } from './CompressionWorker'

let root: Root
let host: HTMLDivElement

it('downloads a protected document after unlocking using its real title', async () => {
  const brotli = createRequire(import.meta.url)('brotli-wasm')
  const payload = await encryptMarkdown('# Private download\n\nprivate body', brotli, 'download-test')
  await putDocument({
    id: 'download-private',
    kind: 'link',
    value: payload,
    title: '비밀번호로 보호된 문서',
    updatedAt: 1,
    pinned: false,
  })
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:download-test')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  let filename = ''
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    filename = this.download
  })
  await act(() => root.render(<App />))
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true, cancelable: true }))
    await new Promise((resolve) => setTimeout(resolve, 40))
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30))
  })
  await act(() => document.querySelector<HTMLButtonElement>('[aria-label="비밀번호로 보호된 문서 다운로드"]')!.click())
  expect(filename).toBe('')
  await act(() => {
    const field = host.querySelector<HTMLInputElement>('#document-unlock-key')!
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, 'download-test')
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(() =>
    [...document.querySelectorAll('button')].find((button) => button.textContent === '문서 열기')!.click(),
  )
  await act(() => CompressionWorker.finishAll())
  expect(filename).toBe('Private download.md')
  const stored = JSON.stringify(await listDocuments())
  expect(stored).not.toContain('private body')
  expect(stored).not.toContain('download-test')
  await act(() => [...document.querySelectorAll('button')].find((button) => button.textContent === '수정')!.click())
  await act(() => {
    const field = host.querySelector('textarea')!
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, '# Unsaved title')
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
  filename = ''
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true, cancelable: true }))
    await new Promise((resolve) => setTimeout(resolve, 40))
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30))
  })
  await act(() => document.querySelector<HTMLButtonElement>('[aria-label="비밀번호로 보호된 문서 다운로드"]')!.click())
  await act(() => CompressionWorker.finishAll())
  expect(filename).toBe('Private download.md')
  expect(host.querySelector('textarea')?.value).toBe('# Unsaved title')
})

it.each([
  'metaKey',
  'ctrlKey',
] as const)('opens document search with %s+K and restores editor focus on Escape', async (modifier) => {
  await act(() => root.render(<App />))
  const editor = host.querySelector('textarea')!
  editor.focus()
  await act(async () => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', [modifier]: true, bubbles: true, cancelable: true }),
    )
    await new Promise((resolve) => setTimeout(resolve, 30))
  })
  const search = document.querySelector<HTMLInputElement>('[aria-label="문서 검색"]')!
  expect(document.activeElement).toBe(search)
  expect(document.querySelector('details')).toBeNull()
  expect(document.body.textContent).not.toContain('백업 내보내기')
  expect(document.body.textContent).not.toContain('자동 정리 방지 요청')
  await act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(document.querySelector('[aria-labelledby="library-title"]')).toBeNull()
  expect(document.activeElement).toBe(editor)
})

it('opens the first matching document with Enter from search', async () => {
  await putDocument({
    id: 'search-result',
    kind: 'draft',
    value: '# Keyboard document',
    title: 'Keyboard document',
    updatedAt: 1,
    pinned: false,
  })
  await act(() => root.render(<App />))
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true, cancelable: true }))
    await new Promise((resolve) => setTimeout(resolve, 40))
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30))
  })
  const search = document.querySelector<HTMLInputElement>('[aria-label="문서 검색"]')!
  await act(() => search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })))
  await act(() => CompressionWorker.finishAll())
  expect(host.querySelector('textarea')?.value).toBe('# Keyboard document')
  expect(document.querySelector('[aria-labelledby="library-title"]')).toBeNull()
})
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('crypto', webcrypto)
  vi.stubGlobal('Worker', CompressionWorker)
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  CompressionWorker.pending = []
  window.history.replaceState(null, '', '/')
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

it('saves protected drafts as ciphertext without storing the password or plaintext', async () => {
  await act(() => root.render(<App />))
  await act(() => {
    const field = host.querySelector('textarea')!
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, '# 비밀 원문')
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(() => host.querySelector<HTMLButtonElement>('[aria-label="링크"]')!.click())
  await act(() => document.querySelector<HTMLInputElement>('#share-protection')!.click())
  await act(() => {
    const field = document.querySelector<HTMLInputElement>('#document-share-key')!
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, 'test-secret')
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const save = [...document.querySelectorAll('button')].find(
    (button) => button.textContent === '암호화해 문서함에 저장',
  )!
  await act(() => save.click())
  await act(() => CompressionWorker.finishAll())
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50))
  })
  const docs = await listDocuments()
  expect(docs).toHaveLength(1)
  expect(docs[0].value).toMatch(/^e1\./)
  expect(JSON.stringify(docs)).not.toContain('비밀 원문')
  expect(JSON.stringify(docs)).not.toContain('test-secret')
})

it('saves the last edit before navigating and typing in another document', async () => {
  await act(() => root.render(<App />))
  const edit = (value: string) => {
    const field = host.querySelector('textarea')!
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, value)
    field.dispatchEvent(new Event('input', { bubbles: true }))
  }
  await act(() => edit('# First draft'))
  await act(() => {
    window.history.pushState(null, '', `/?edit=true#${encodeMarkdownToHash('# Second document')}`)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
  await act(() => CompressionWorker.finishAll())
  await act(() => edit('# Second draft'))
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 600))
  })
  const docs = await listDocuments()
  expect(docs.some((doc) => doc.value === '# First draft')).toBe(true)
  expect(docs.some((doc) => doc.value === '# Second draft')).toBe(true)
})

it('does not overwrite a locked library document when navigating back to a different link', async () => {
  await putDocument({
    id: 'locked-a',
    kind: 'link',
    value: 'e1.example',
    title: '비밀번호로 보호된 문서',
    updatedAt: 1,
    pinned: true,
  })
  await act(() => root.render(<App />))
  await act(() => host.querySelector<HTMLButtonElement>('[aria-label="메뉴"]')!.click())
  await act(async () => {
    document.querySelector<HTMLButtonElement>('[aria-label="문서"]')!.click()
    await new Promise((resolve) => setTimeout(resolve, 30))
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30))
  })
  await act(() =>
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('비밀번호로 보호된 문서'))!
      .click(),
  )
  await act(() => {
    window.history.pushState(null, '', `/#${encodeMarkdownToHash('# Other document')}`)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
  await act(() => CompressionWorker.finishAll())
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100))
  })
  const docs = await listDocuments()
  expect(docs.find((doc) => doc.id === 'locked-a')?.value).toBe('e1.example')
  expect(docs.some((doc) => doc.title === 'Other document')).toBe(true)
})
afterEach(async () => {
  await act(() => root.unmount())
  host.remove()
  for (const doc of await listDocuments()) await deleteDocument(doc.id)
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('autosaves a draft and keeps an explicitly pinned plain copy when protection is selected', async () => {
  await act(() => root.render(<App />))
  await act(() => {
    const field = host.querySelector('textarea')!
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(
      field,
      '# 안전한 문서\n\n테스트 내용',
    )
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500))
  })
  const [draft] = await listDocuments()
  expect(draft.value).toContain('테스트 내용')
  await setDocumentPinned(draft.id, true)
  await act(() => host.querySelector<HTMLButtonElement>('[aria-label="링크"]')!.click())
  await act(() => document.querySelector<HTMLInputElement>('#share-protection')!.click())
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500))
  })
  const [stillPinned] = await listDocuments()
  expect(stillPinned.pinned).toBe(true)
  expect(stillPinned.value).toContain('테스트 내용')
  expect(document.body.textContent).toContain('이전에 문서함에 저장한 일반 문서는 암호화되지 않습니다')
})
