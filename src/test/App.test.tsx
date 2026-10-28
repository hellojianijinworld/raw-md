// @vitest-environment jsdom

import { webcrypto } from 'node:crypto'
import { createRequire } from 'node:module'
import { act, StrictMode } from 'react'
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

async function openHelp() {
  await act(() => document.querySelector<HTMLButtonElement>('[aria-label="메뉴"]')!.click())
  await act(() => button('도움말').click())
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
  await act(() => button('공유 링크 복사하기').click())
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
  await act(() => button('공유 링크 복사하기').click())
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

it('opens optional AI help without changing the document and restores focus on Escape', async () => {
  await act(() => root.render(<App />))
  const source = '# 도움말을 열어도 남아 있는 초안\n\n원문 그대로 😀\n'
  await edit(source)
  const hash = window.location.hash
  await openHelp()
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('웹에서 바로 사용하세요')
  await act(() => document.querySelector<HTMLButtonElement>('#help-tab-ai')!.click())
  const dialog = document.querySelector('[role="dialog"]')!
  expect(dialog.textContent).toContain('문서 링크를 AI에게 건네세요')
  expect(dialog.querySelector('a[download]')).toBeNull()
  expect(dialog.textContent).not.toContain('개발자용 API')
  const prompt = dialog.querySelector<HTMLTextAreaElement>('#ai-setup-prompt')!.value
  expect(prompt).toContain('https://raw-md.pages.dev/ai/INSTALL.md')
  await act(() => button('설치 요청 복사').click())
  expect(copied).toBe(prompt)
  expect(copied).not.toContain(source)
  expect(copied).not.toContain(hash)
  expect(dialog.querySelector('[role="status"]')?.textContent).toContain('AI 대화창')
  expect(window.location.hash).toBe(hash)
  expect(host.querySelector('textarea')?.value).toBe(source)
  await act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  expect(document.activeElement).toBe(document.querySelector('[aria-label="메뉴"]'))
})

it('keeps setup instructions selectable when clipboard access fails and lets the user retry', async () => {
  await act(() => root.render(<App />))
  await openHelp()
  await act(() => document.querySelector<HTMLButtonElement>('#help-tab-ai')!.click())
  vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('Permission denied'))
  await act(() => button('설치 요청 복사').click())
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('직접 선택해 복사')
  const field = document.querySelector<HTMLTextAreaElement>('#ai-setup-prompt')!
  expect(field.readOnly).toBe(true)
  await act(() => button('설치 요청 복사').click())
  expect(copied).toBe(field.value)
  expect(document.querySelector('[role="alert"]')).toBeNull()
})

it('serializes setup copying with document-link copying across help closure', async () => {
  await act(() => root.render(<App />))
  await edit('# 보관할 문서')
  await openHelp()
  await act(() => document.querySelector<HTMLButtonElement>('#help-tab-ai')!.click())
  let finish!: () => void
  const write = vi.spyOn(navigator.clipboard, 'writeText').mockImplementationOnce(
    (text) =>
      new Promise<void>((resolve) => {
        finish = () => {
          copied = text
          resolve()
        }
      }),
  )
  await act(() => button('설치 요청 복사').click())
  expect(button('복사 중...').disabled).toBe(true)
  await act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  await act(() => button('링크').click())
  expect(button('공유 링크 복사하기').disabled).toBe(true)
  expect(write).toHaveBeenCalledTimes(1)
  await act(() => finish())
  await act(() => button('공유 링크 복사하기').click())
  await act(() => CompressionWorker.finishAll())
  expect(decodeMarkdown(new URL(copied).hash.slice(1), brotli)).toBe('# 보관할 문서')
})

it('keeps help and sharing separate and closes help from its backdrop', async () => {
  await act(() => root.render(<App />))
  await act(() => button('링크').click())
  expect(document.querySelector('#share-popover')).not.toBeNull()
  await openHelp()
  expect(document.querySelector('#share-popover')).toBeNull()
  expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
  await act(() => document.querySelector('.help-backdrop')!.dispatchEvent(new Event('pointerdown', { bubbles: true })))
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  expect(document.querySelector('[aria-label="메뉴"]')?.getAttribute('aria-expanded')).toBe('false')
})

it('opens a popover with the exact UTF-8 source size without copying automatically, and closes on Escape', async () => {
  await act(() => root.render(<App />))
  const source = '# 한글 😀\n'
  await edit(source)
  await act(() => button('링크').click())
  expect(copied).toBe('')
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    `${new TextEncoder().encode(source).length} B`,
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
  await act(() => document.querySelector<HTMLInputElement>('#share-protection')!.click())
  await input('#document-share-key', password)
  await act(() => button('공유 링크 복사하기').click())
  await act(() => CompressionWorker.finishAll())
  const encryptedHash = new URL(copied).hash
  expect(encryptedHash).toMatch(/^#e1\./)
  expect(await decryptMarkdown(encryptedHash.slice(1), brotli, password)).toBe(source)
  // A refresh opens a new App; a same-document position event preserves its unlock state.
  await act(() => root.unmount())
  root = createRoot(host)
  await act(() => root.render(<App />))
  expect(host.textContent).toContain('비밀번호로 보호된 문서')
  expect(host.querySelector('textarea')).toBeNull()
  expect(CompressionWorker.pending).toHaveLength(0)
  await input('#document-unlock-key', 'wrong')
  await act(() => button('문서 열기').click())
  await act(() => CompressionWorker.finishAll())
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('비밀번호')
  expect(window.location.hash).toBe(encryptedHash)
  await input('#document-unlock-key', password)
  await act(() => button('문서 열기').click())
  await act(() => CompressionWorker.finishAll())
  expect(host.textContent).toContain('비공개 문서')
  await act(() => button('수정').click())
  expect(host.querySelector('textarea')?.value).toBe(source)
  await edit('# 새 비공개 수정 내용')
  expect(window.location.hash).toBe(encryptedHash)
  await act(() => button('링크').click())
  expect(document.querySelector<HTMLInputElement>('#share-protection')!.checked).toBe(true)
  await act(() => button('공유 링크 복사하기').click())
  await act(() => CompressionWorker.finishAll())
  expect(await decryptMarkdown(new URL(copied).hash.slice(1), brotli, password)).toBe('# 새 비공개 수정 내용')
}, 15_000) // The full UI flow includes multiple real Argon2 encrypt/decrypt operations.

it('cancels an unlock when navigating to another document', async () => {
  const hash = await encryptMarkdown('# secret', brotli, 'password')
  window.history.replaceState(null, '', `/#${hash}`)
  await act(() => root.render(<App />))
  await input('#document-unlock-key', 'password')
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
  await act(() => document.querySelector<HTMLInputElement>('#share-protection')!.click())
  expect(window.location.hash).toBe('')
  await act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(host.querySelector('.private-draft-note')?.textContent).toContain('링크를 다시 복사')
  const unsaved = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(unsaved)
  expect(unsaved.defaultPrevented).toBe(true)
  await act(() => button('링크').click())
  await act(() => document.querySelector<HTMLInputElement>('#share-plain')!.click())
  await act(() => button('공유 링크 복사하기').click())
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
  if (!document.querySelector<HTMLInputElement>('#share-protection')!.checked)
    await act(() => document.querySelector<HTMLInputElement>('#share-protection')!.click())
  await act(() => button('강력한 암호 자동 생성').click())
  const field = document.querySelector<HTMLInputElement>('#document-share-key')!
  const generated = field.value
  expect(generated).toMatch(/^[A-Za-z0-9_-]{22}$/)
  expect(field.readOnly).toBe(false)
  expect(document.querySelector<HTMLInputElement>('#share-protection')!.checked).toBe(true)
  await act(() => button('비밀번호 복사').click())
  expect(copied).toBe(generated)
  await act(() => button('공유 링크 복사하기').click())
  expect(button('다시 생성').disabled).toBe(true)
  expect(document.querySelector<HTMLInputElement>('#share-protection')!.disabled).toBe(true)
  await act(() => CompressionWorker.finishAll())
  expect(copied).not.toContain(generated)
  expect(await decryptMarkdown(new URL(copied).hash.slice(1), brotli, generated)).toBe(source)
})

it('copies the exact custom password separately from the document link', async () => {
  await act(() => root.render(<App />))
  await act(() => button('링크').click())
  await act(() => document.querySelector<HTMLInputElement>('#share-protection')!.click())
  const password = '  공백과 한글 🔑 preserve  '
  await input('#document-share-key', password)
  const visibility = document.querySelector<HTMLButtonElement>('[aria-label="비밀번호 표시"]')!
  expect(visibility.parentElement?.querySelector('input')?.id).toBe('document-share-key')
  expect(document.querySelector<HTMLInputElement>('#document-share-key')!.type).toBe('password')
  await act(() => visibility.click())
  expect(document.querySelector<HTMLInputElement>('#document-share-key')!.type).toBe('text')
  await act(() => document.querySelector<HTMLButtonElement>('[aria-label="비밀번호 숨기기"]')!.click())
  expect(document.querySelector<HTMLInputElement>('#document-share-key')!.type).toBe('password')
  await act(() => button('비밀번호 복사').click())
  expect(copied).toBe(password)
  expect(CompressionWorker.pending).toHaveLength(0)
  expect(button('비밀번호 복사됨').disabled).toBe(false)
  await input('#document-share-key', 'changed password')
  expect(button('비밀번호 복사').disabled).toBe(false)
})

it('reports password clipboard denial and lets the user retry', async () => {
  await act(() => root.render(<App />))
  await act(() => button('링크').click())
  if (!document.querySelector<HTMLInputElement>('#share-protection')!.checked)
    await act(() => document.querySelector<HTMLInputElement>('#share-protection')!.click())
  await act(() => button('강력한 암호 자동 생성').click())
  vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('Permission denied'))
  await act(() => button('비밀번호 복사').click())
  expect(document.querySelector('[role="dialog"] [role="alert"]')?.textContent).toContain(
    '비밀번호를 복사하지 못했습니다',
  )
  expect(button('비밀번호 복사').disabled).toBe(false)
  await act(() => button('비밀번호 복사').click())
  expect(copied).toBe(document.querySelector<HTMLInputElement>('#document-share-key')!.value)
})

it('does not report an old password as copied after it changes, or overlap password and URL writes', async () => {
  await act(() => root.render(<App />))
  await act(() => button('링크').click())
  await act(() => document.querySelector<HTMLInputElement>('#share-protection')!.click())
  await input('#document-share-key', 'old password')
  let finish!: () => void
  vi.spyOn(navigator.clipboard, 'writeText').mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  await act(() => button('비밀번호 복사').click())
  expect(button('공유 링크 복사하기').disabled).toBe(true)
  await input('#document-share-key', 'new password')
  expect(button('공유 링크 복사하기').disabled).toBe(true)
  await act(async () => finish())
  expect(button('비밀번호 복사').disabled).toBe(false)
  expect(button('공유 링크 복사하기').disabled).toBe(false)
})

it('keeps clipboard writes serialized after closing and reopening the share popover', async () => {
  await act(() => root.render(<App />))
  await act(() => button('링크').click())
  if (!document.querySelector<HTMLInputElement>('#share-protection')!.checked)
    await act(() => document.querySelector<HTMLInputElement>('#share-protection')!.click())
  await act(() => button('강력한 암호 자동 생성').click())
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
  expect(button('공유 링크 복사하기').disabled).toBe(true)
  expect(button('비밀번호 복사 중...').disabled).toBe(true)
  await act(() => button('공유 링크 복사하기').click())
  expect(write).toHaveBeenCalledTimes(1)
  expect(CompressionWorker.pending).toHaveLength(0)
  await act(async () => finish())
  expect(button('비밀번호 복사').disabled).toBe(false)
  expect(button('공유 링크 복사하기').disabled).toBe(false)
})

it('toggles optional protection and generates or edits passwords without exposing private edits', async () => {
  await act(() => root.render(<App />))
  await edit('# 세 가지 공유 방식')
  await act(() => button('링크').click())
  expect(document.querySelector<HTMLInputElement>('#share-plain')!.checked).toBe(true)
  expect(document.querySelector('#document-share-key')).toBeNull()
  await act(() => document.querySelector<HTMLInputElement>('#share-protection')!.click())
  expect(document.querySelector<HTMLInputElement>('#document-share-key')!.readOnly).toBe(false)
  expect(button('공유 링크 복사하기').disabled).toBe(true)
  await input('#document-share-key', 'my manually chosen password')
  if (!document.querySelector<HTMLInputElement>('#share-protection')!.checked)
    await act(() => document.querySelector<HTMLInputElement>('#share-protection')!.click())
  await act(() => button('강력한 암호 자동 생성').click())
  const automatic = document.querySelector<HTMLInputElement>('#document-share-key')!.value
  expect(automatic).toMatch(/^[A-Za-z0-9_-]{22}$/)
  expect(automatic).not.toBe('my manually chosen password')
  await act(() => document.querySelector<HTMLButtonElement>('[aria-label="닫기"]')!.click())
  await act(() => button('링크').click())
  expect(document.querySelector<HTMLInputElement>('#document-share-key')!.value).toBe(automatic)
  await act(() => button('다시 생성').click())
  expect(document.querySelector<HTMLInputElement>('#document-share-key')!.value).not.toBe(automatic)
  await input('#document-share-key', 'edited generated password')
  expect(document.querySelector<HTMLInputElement>('#document-share-key')!.value).toBe('edited generated password')
  expect(button('강력한 암호 자동 생성').disabled).toBe(false)
  await act(() => document.querySelector<HTMLInputElement>('#share-plain')!.click())
  expect(document.querySelector('#document-share-key')).toBeNull()
  await edit('# 비밀이었던 원문을 명시적으로 공개 공유')
  expect(window.location.hash).toBe('')
  await act(() => button('공유 링크 복사하기').click())
  await act(() => CompressionWorker.finishAll())
  expect(new URL(copied).hash).not.toMatch(/^#e1\./)
  expect(decodeMarkdown(new URL(copied).hash.slice(1), brotli)).toBe('# 비밀이었던 원문을 명시적으로 공개 공유')
})

it('selects explicit themes from the hamburger settings and keeps help accessible', async () => {
  await act(() => root.render(<App />))
  await act(() => document.querySelector<HTMLButtonElement>('[aria-label="메뉴"]')!.click())
  expect(document.querySelector('#app-menu')?.textContent).toContain('시스템 설정')
  expect(document.querySelector('.app-menu-version a')?.textContent).toBe('등록된 릴리즈 없음')
  expect(document.querySelector('.app-menu-version a')?.getAttribute('href')).toBe(
    'https://github.com/hellojianijinworld/raw-md/releases',
  )
  for (const mode of ['dark', 'light', 'auto']) {
    await act(() => document.querySelector<HTMLInputElement>(`input[name="theme"][value="${mode}"]`)!.click())
    expect(localStorage.getItem('raw-md-color-mode')).toBe(mode)
    expect(document.documentElement.getAttribute('data-color-mode')).toBe(mode === 'dark' ? 'dark' : 'light')
  }
  await act(() => button('도움말').click())
  expect(document.querySelector('#app-menu')).toBeNull()
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('웹에서 바로 사용하세요')
})

it('navigates headings and history without decoding the document again', async () => {
  const source = '[이동](#목적지)\n\n# 시작\n\n## 목적지'
  const payload = encodeMarkdown(source, brotli)
  window.history.replaceState(null, '', `/#${payload}~h=1`)
  await act(() => root.render(<App />))
  expect(CompressionWorker.pending[0].task.value).toBe(payload)
  await act(() => CompressionWorker.finishAll())
  const target = host.querySelector<HTMLElement>('#raw-md-heading-2')!
  await act(() => host.querySelector<HTMLAnchorElement>('a[data-heading-target="2"]')!.click())
  expect(window.location.hash).toBe(`#${payload}~h=2`)
  expect(CompressionWorker.pending).toHaveLength(0)
  expect(document.activeElement).toBe(target)
  expect(target).toBe(host.querySelector('#raw-md-heading-2'))
  await act(() => {
    window.history.replaceState(null, '', `/#${payload}~h=1`)
    window.dispatchEvent(new PopStateEvent('popstate'))
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
  expect(CompressionWorker.pending).toHaveLength(0)
  expect(document.activeElement).toBe(host.querySelector('#raw-md-heading-1'))
})

it('preserves an unlocked password during section navigation and disables shareable draft anchors', async () => {
  const password = 'test-password'
  const payload = await encryptMarkdown('# 시작\n\n## 목적지', brotli, password)
  window.history.replaceState(null, '', `/#${payload}~h=2`)
  await act(() => root.render(<App />))
  await act(() => {
    const input = host.querySelector<HTMLInputElement>('#document-unlock-key')!
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, password)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(() => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  await act(() => CompressionWorker.finishAll())
  await act(() => host.querySelector<HTMLAnchorElement>('a[data-heading-target="1"]')!.click())
  expect(window.location.hash).toBe(`#${payload}~h=1`)
  expect(host.querySelector('#document-unlock-key')).toBeNull()
  expect(CompressionWorker.pending).toHaveLength(0)
  await act(() => button('수정').click())
  await edit('# 변경\n\n## 다른 목적지')
  expect(window.location.hash).toBe(`#${payload}`)
  expect(host.querySelector('.markdown-body a.heading-link')).toBeNull()
  expect(host.querySelector('.markdown-body button.heading-link')).not.toBeNull()
  expect(window.location.href).not.toContain(password)
})

it('loads positioned documents under React StrictMode', async () => {
  window.history.replaceState(null, '', '/#BYUwNmD2Q~h=1')
  await act(() =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  )
  await act(() => CompressionWorker.finishAll())
  expect(host.textContent).toContain('hello')
  expect(host.querySelector('.document-status')).toBeNull()
})

it('keeps Mermaid mounted and preview scroll stable during unrelated edits after navigation', async () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  const source = '# 제목\n\n```mermaid\nflowchart LR\n A-->B\n```\n\n내용'
  window.history.replaceState(null, '', `/?edit=true#${encodeMarkdown(source, brotli)}`)
  await act(() => root.render(<App />))
  await act(() => CompressionWorker.finishAll())
  await act(async () => {
    await vi.waitFor(() => expect(host.querySelector('.mermaid-diagram svg')).not.toBeNull())
  })
  const diagram = host.querySelector('.mermaid-diagram svg')
  await act(() => host.querySelector<HTMLAnchorElement>('a.heading-link')!.click())
  const top = vi.fn()
  Object.defineProperty(host.querySelector('.preview-pane'), 'scrollTo', { value: top })
  await edit(`${source} 수정`)
  await edit(`${source} 수정 계속`)
  expect(host.querySelector('.mermaid-diagram svg')).toBe(diagram)
  expect(top).not.toHaveBeenCalled()
  expect(window.location.hash).not.toContain('~h=')
})

it('marks document secrets as non-login fields for password managers in both flows', async () => {
  await act(() => root.render(<App />))
  await act(() => button('링크').click())
  await act(() => document.querySelector<HTMLInputElement>('#share-protection')!.click())
  const shared = document.querySelector<HTMLInputElement>('[name="document-share-key"]')!
  expect(shared.type).toBe('password')
  expect(shared.autocomplete).toBe('off')
  for (const attr of ['data-bwignore', 'data-1p-ignore', 'data-lpignore'])
    expect(shared.getAttribute(attr)).toBe('true')
  await act(() => root.unmount())
  root = createRoot(host)
  window.history.replaceState(null, '', '/#e1.AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaG5-qouGbwXzgcgTwpBZwFDipFBslqPDljNw')
  await act(() => root.render(<App />))
  const unlock = document.querySelector<HTMLInputElement>('[name="document-unlock-key"]')!
  expect(unlock.type).toBe('password')
  expect(unlock.autocomplete).toBe('off')
  for (const attr of ['data-bwignore', 'data-1p-ignore', 'data-lpignore'])
    expect(unlock.getAttribute(attr)).toBe('true')
})
