// @vitest-environment jsdom

import { webcrypto } from 'node:crypto'
import { createRequire } from 'node:module'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '../App'
import { decryptMarkdown, encryptMarkdown } from '../utils/encryption'
import { decodeMarkdown, encodeMarkdown } from '../utils/urlCodec'
import { CompressionWorker } from './CompressionWorker'

const brotli = createRequire(import.meta.url)('brotli-wasm')
let root: Root
let host: HTMLDivElement
let copied = ''

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('crypto', webcrypto)
  vi.stubGlobal('Worker', CompressionWorker)
  vi.stubGlobal('ClipboardItem', undefined)
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      async writeText(text: string) {
        copied = text
      },
    },
  })
  CompressionWorker.pending = []
  copied = ''
  window.history.replaceState(null, '', '/')
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

function button(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll('button')].find((item) => item.textContent === label)
  if (!found) throw new Error(`Button not found: ${label}`)
  return found
}

async function edit(value: string) {
  await act(() => {
    const field = host.querySelector('textarea')!
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, value)
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

it('shows loading while opening a compressed link, then renders its source', async () => {
  const source = '# 비동기 복원\n\n한글 문서의 원문입니다.\n'.repeat(30)
  const hash = encodeMarkdown(source, brotli)
  window.history.replaceState(null, '', `/?edit=true#${hash}`)
  await act(() => root.render(<App />))
  expect(host.querySelector('[role="status"]')?.textContent).toContain('불러오는 중')
  expect(button('링크').disabled).toBe(true)
  await act(() => CompressionWorker.finishAll())
  expect(host.querySelector('h1')?.textContent).toBe('raw-md')
  expect(host.textContent).toContain('비동기 복원')
  expect(host.querySelector('[role="alert"]')).toBeNull()
  await act(() => button('링크').click())
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    `${`${window.location.origin}/#${hash}`.length}자`,
  )
})

it('keeps the latest hash navigation when an earlier load completes later', async () => {
  window.history.replaceState(null, '', '/#BYUwNmD2Q')
  await act(() => root.render(<App />))
  const earlier = CompressionWorker.pending[0]
  await act(() => {
    window.history.replaceState(null, '', `/#${encodeMarkdown('# 최신 문서', brotli)}`)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
  await act(() => CompressionWorker.pending.at(-1)!.complete())
  await act(() => earlier.complete())
  expect(host.textContent).toContain('최신 문서')
  expect(host.textContent).not.toContain('hello')
})

it('shows a damaged-link error without enabling actions that overwrite the fragment', async () => {
  const fragment = 'b1.invalid'
  window.history.replaceState(null, '', `/#${fragment}`)
  await act(() => root.render(<App />))
  await act(() => CompressionWorker.finishAll())
  expect(host.querySelector('[role="alert"]')).not.toBeNull()
  expect(host.querySelector('textarea')).toBeNull()
  expect(button('링크').disabled).toBe(true)
  expect(window.location.hash).toBe(`#${fragment}`)
})

it('copies a compressed snapshot without overwriting edits made while it was being prepared', async () => {
  await act(() => root.render(<App />))
  const source = '# 공유할 문서\n공백과 한글 원문을 그대로 공유합니다.\n'.repeat(60)
  await edit(source)
  await act(() => button('링크').click())
  await act(() => button('링크 복사').click())
  expect(button('만드는 중...').disabled).toBe(true)
  await edit('# 복사 도중 새로 작성한 문서')
  await act(() => CompressionWorker.finishAll())
  expect(decodeMarkdown(new URL(copied).hash.slice(1), brotli)).toBe(source)
  expect(host.querySelector('textarea')?.value).toBe('# 복사 도중 새로 작성한 문서')
  expect(host.textContent).toContain('수정됨')
  expect(window.location.hash).not.toBe(new URL(copied).hash)
})

it('replaces the draft URL with the compressed URL after a successful copy', async () => {
  await act(() => root.render(<App />))
  const source = '# 공유 문서\n원문을 손실 없이 압축합니다.\n'.repeat(60)
  await edit(source)
  await act(() => button('링크').click())
  await act(() => button('링크 복사').click())
  await act(() => CompressionWorker.finishAll())
  expect(button('복사됨').disabled).toBe(false)
  expect(window.location.hash).toBe(new URL(copied).hash)
  expect(window.location.hash).toMatch(/^#[bj]1\./)
  expect(host.textContent).not.toContain('수정됨')
})

async function input(selector: string, value: string) {
  await act(() => {
    const field = document.querySelector<HTMLInputElement>(selector)!
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value)
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

it('opens a popover with the exact UTF-8 source size without copying automatically, and closes on Escape', async () => {
  await act(() => root.render(<App />))
  const source = '# 한글 😀\n'
  await edit(source)
  await act(() => button('링크').click())
  expect(copied).toBe('')
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    `${new TextEncoder().encode(source).length} bytes`,
  )
  expect(button('링크').getAttribute('aria-expanded')).toBe('true')
  await act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  expect(document.activeElement).toBe(button('링크'))
})

it('copies a protected link, requires a password to open it, retries a wrong password, and never exposes edits in the URL', async () => {
  await act(() => root.render(<App />))
  const source = '# 비공개 문서\n압축한 뒤 암호화한 원문입니다.\n'.repeat(20)
  const password = '잊지 않을 긴 비밀번호 🔑'
  await edit(source)
  await act(() => button('링크').click())
  await act(() => document.querySelector<HTMLInputElement>('#share-mode-custom')!.click())
  await input('#share-password', password)
  await act(() => button('링크 복사').click())
  await act(() => CompressionWorker.finishAll())
  const encryptedHash = new URL(copied).hash
  expect(encryptedHash).toMatch(/^#e1\./)
  expect(await decryptMarkdown(encryptedHash.slice(1), brotli, password)).toBe(source)
  await act(() => window.dispatchEvent(new HashChangeEvent('hashchange')))
  expect(host.textContent).toContain('비밀번호로 보호된 문서')
  expect(host.querySelector('textarea')).toBeNull()
  expect(CompressionWorker.pending).toHaveLength(0)
  await input('#unlock-password', 'wrong')
  await act(() => button('문서 열기').click())
  await act(() => CompressionWorker.finishAll())
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('비밀번호')
  expect(window.location.hash).toBe(encryptedHash)
  await input('#unlock-password', password)
  await act(() => button('문서 열기').click())
  await act(() => CompressionWorker.finishAll())
  expect(host.textContent).toContain('비공개 문서')
  await act(() => button('수정').click())
  expect(host.querySelector('textarea')?.value).toBe(source)
  await edit('# 새 비공개 수정 내용')
  expect(window.location.hash).toBe(encryptedHash)
  await act(() => button('링크').click())
  expect(document.querySelector<HTMLInputElement>('#share-mode-custom')!.checked).toBe(true)
  await act(() => button('링크 복사').click())
  await act(() => CompressionWorker.finishAll())
  expect(await decryptMarkdown(new URL(copied).hash.slice(1), brotli, password)).toBe('# 새 비공개 수정 내용')
}, 15_000) // The full UI flow includes multiple real Argon2 encrypt/decrypt operations.

it('cancels an unlock when navigating to another document', async () => {
  const hash = await encryptMarkdown('# secret', brotli, 'password')
  window.history.replaceState(null, '', `/#${hash}`)
  await act(() => root.render(<App />))
  await input('#unlock-password', 'password')
  await act(() => button('문서 열기').click())
  const earlier = CompressionWorker.pending[0]
  await act(() => {
    window.history.replaceState(null, '', '/#BYUwNmD2Q')
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
  expect(earlier.terminated).toBe(true)
  await act(() => CompressionWorker.finishAll())
  expect(host.textContent).toContain('hello')
  expect(host.textContent).not.toContain('secret')
})

it('warns about the private draft even when protection is enabled on an unchanged document in viewer mode', async () => {
  window.history.replaceState(null, '', '/#BYUwNmD2Q')
  await act(() => root.render(<App />))
  await act(() => CompressionWorker.finishAll())
  await act(() => button('링크').click())
  await act(() => document.querySelector<HTMLInputElement>('#share-mode-custom')!.click())
  expect(window.location.hash).toBe('')
  await act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(host.querySelector('.private-draft-note')?.textContent).toContain('링크를 다시 복사')
  const unsaved = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(unsaved)
  expect(unsaved.defaultPrevented).toBe(true)
  await act(() => button('링크').click())
  await act(() => document.querySelector<HTMLInputElement>('#share-mode-plain')!.click())
  await act(() => button('링크 복사').click())
  await act(() => CompressionWorker.finishAll())
  expect(host.querySelector('.private-draft-note')).toBeNull()
  const saved = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(saved)
  expect(saved.defaultPrevented).toBe(false)
})

it('generates a strong password and uses it for sharing without placing it in the URL', async () => {
  await act(() => root.render(<App />))
  const source = '# 원문이 알려져 있어도 보호할 문서\n'.repeat(30)
  await edit(source)
  await act(() => button('링크').click())
  await act(() => document.querySelector<HTMLInputElement>('#share-mode-secure')!.click())
  const field = document.querySelector<HTMLInputElement>('#share-password')!
  const generated = field.value
  expect(generated).toMatch(/^[A-Za-z0-9_-]{22}$/)
  expect(field.readOnly).toBe(true)
  expect(document.querySelector<HTMLInputElement>('#share-mode-secure')!.checked).toBe(true)
  await act(() => button('비밀번호 복사').click())
  expect(copied).toBe(generated)
  await act(() => button('링크 복사').click())
  expect(button('다시 생성').disabled).toBe(true)
  expect(
    [...document.querySelectorAll<HTMLInputElement>('input[name="share-mode"]')].every((item) => item.disabled),
  ).toBe(true)
  await act(() => CompressionWorker.finishAll())
  expect(copied).not.toContain(generated)
  expect(await decryptMarkdown(new URL(copied).hash.slice(1), brotli, generated)).toBe(source)
})

it('copies the exact custom password separately from the document link', async () => {
  await act(() => root.render(<App />))
  await act(() => button('링크').click())
  await act(() => document.querySelector<HTMLInputElement>('#share-mode-custom')!.click())
  const password = '  공백과 한글 🔑 preserve  '
  await input('#share-password', password)
  await act(() => button('비밀번호 복사').click())
  expect(copied).toBe(password)
  expect(CompressionWorker.pending).toHaveLength(0)
  expect(button('비밀번호 복사됨').disabled).toBe(false)
  await input('#share-password', 'changed password')
  expect(button('비밀번호 복사').disabled).toBe(false)
})

it('reports password clipboard denial and lets the user retry', async () => {
  await act(() => root.render(<App />))
  await act(() => button('링크').click())
  await act(() => document.querySelector<HTMLInputElement>('#share-mode-secure')!.click())
  vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('Permission denied'))
  await act(() => button('비밀번호 복사').click())
  expect(document.querySelector('[role="dialog"] [role="alert"]')?.textContent).toContain(
    '비밀번호를 복사하지 못했습니다',
  )
  expect(button('비밀번호 복사').disabled).toBe(false)
  await act(() => button('비밀번호 복사').click())
  expect(copied).toBe(document.querySelector<HTMLInputElement>('#share-password')!.value)
})

it('does not report an old password as copied after it changes, or overlap password and URL writes', async () => {
  await act(() => root.render(<App />))
  await act(() => button('링크').click())
  await act(() => document.querySelector<HTMLInputElement>('#share-mode-custom')!.click())
  await input('#share-password', 'old password')
  let finish!: () => void
  vi.spyOn(navigator.clipboard, 'writeText').mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  await act(() => button('비밀번호 복사').click())
  expect(button('링크 복사').disabled).toBe(true)
  await input('#share-password', 'new password')
  expect(button('링크 복사').disabled).toBe(true)
  await act(async () => finish())
  expect(button('비밀번호 복사').disabled).toBe(false)
  expect(button('링크 복사').disabled).toBe(false)
})

it('keeps clipboard writes serialized after closing and reopening the share popover', async () => {
  await act(() => root.render(<App />))
  await act(() => button('링크').click())
  await act(() => document.querySelector<HTMLInputElement>('#share-mode-secure')!.click())
  let finish!: () => void
  const write = vi.spyOn(navigator.clipboard, 'writeText').mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  await act(() => button('비밀번호 복사').click())
  await act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  await act(() => button('링크').click())
  expect(button('링크 복사').disabled).toBe(true)
  expect(button('비밀번호 복사 중...').disabled).toBe(true)
  await act(() => button('링크 복사').click())
  expect(write).toHaveBeenCalledTimes(1)
  expect(CompressionWorker.pending).toHaveLength(0)
  await act(async () => finish())
  expect(button('비밀번호 복사').disabled).toBe(false)
  expect(button('링크 복사').disabled).toBe(false)
})

it('lets users switch among plain, custom, and automatically secured sharing without exposing private edits', async () => {
  await act(() => root.render(<App />))
  await edit('# 세 가지 공유 방식')
  await act(() => button('링크').click())
  expect(document.querySelector<HTMLInputElement>('#share-mode-plain')!.checked).toBe(true)
  expect(document.querySelector('#share-password')).toBeNull()
  await act(() => document.querySelector<HTMLInputElement>('#share-mode-custom')!.click())
  expect(document.querySelector<HTMLInputElement>('#share-password')!.readOnly).toBe(false)
  expect(button('링크 복사').disabled).toBe(true)
  await input('#share-password', 'my manually chosen password')
  await act(() => document.querySelector<HTMLInputElement>('#share-mode-secure')!.click())
  const automatic = document.querySelector<HTMLInputElement>('#share-password')!.value
  expect(automatic).toMatch(/^[A-Za-z0-9_-]{22}$/)
  expect(automatic).not.toBe('my manually chosen password')
  await act(() => document.querySelector<HTMLButtonElement>('[aria-label="닫기"]')!.click())
  await act(() => button('링크').click())
  expect(document.querySelector<HTMLInputElement>('#share-password')!.value).toBe(automatic)
  await act(() => button('다시 생성').click())
  expect(document.querySelector<HTMLInputElement>('#share-password')!.value).not.toBe(automatic)
  await act(() => document.querySelector<HTMLInputElement>('#share-mode-plain')!.click())
  expect(document.querySelector('#share-password')).toBeNull()
  await edit('# 비밀이었던 원문을 명시적으로 공개 공유')
  expect(window.location.hash).toBe('')
  await act(() => button('링크 복사').click())
  await act(() => CompressionWorker.finishAll())
  expect(new URL(copied).hash).not.toMatch(/^#e1\./)
  expect(decodeMarkdown(new URL(copied).hash.slice(1), brotli)).toBe('# 비밀이었던 원문을 명시적으로 공개 공유')
})
