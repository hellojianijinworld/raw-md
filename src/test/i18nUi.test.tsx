// @vitest-environment jsdom
import { webcrypto } from 'node:crypto'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '../App'
import { LANGUAGE_STORAGE_KEY, setLanguagePreference } from '../i18n/core'
import { CompressionWorker } from './CompressionWorker'

let root: Root
let host: HTMLDivElement
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('crypto', webcrypto)
  vi.stubGlobal('Worker', CompressionWorker)
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  window.history.replaceState(null, '', '/')
  CompressionWorker.pending = []
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

it('uses the browser language and switches UI without changing Markdown or the current link', async () => {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-GB'])
  setLanguagePreference('auto')
  await act(() => root.render(<App />))
  expect(document.documentElement.lang).toBe('en')
  expect(host.querySelector('[aria-label="Link"]')).not.toBeNull()
  await act(() => {
    const editor = host.querySelector('textarea')!
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(
      editor,
      '# 한글 원문\n\nKeep this unchanged.',
    )
    editor.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const hash = window.location.hash
  await act(() => host.querySelector<HTMLButtonElement>('[aria-label="Menu"]')!.click())
  await act(() => [...host.querySelectorAll('button')].find((button) => button.textContent === 'Preferences')!.click())
  await act(() => host.querySelector<HTMLInputElement>('input[name="language"][value="ko"]')!.click())
  expect(document.documentElement.lang).toBe('ko')
  expect(host.querySelector('[aria-label="링크"]')).not.toBeNull()
  expect(host.querySelector('textarea')?.value).toBe('# 한글 원문\n\nKeep this unchanged.')
  expect(window.location.hash).toBe(hash)
  expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('ko')
})

it('localizes existing unlock errors when the selected language changes and passes locale to the worker', async () => {
  window.history.replaceState(null, '', '/#e1.AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaG5-qouGbwXzgcgTwpBZwFDipFBslqPDljNw')
  await act(() => root.render(<App />))
  await act(() => {
    const input = host.querySelector<HTMLInputElement>('#document-unlock-key')!
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'wrong')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(() => [...host.querySelectorAll('button')].find((button) => button.textContent === '문서 열기')!.click())
  expect(CompressionWorker.pending[0].task.locale).toBe('ko')
  await act(() => CompressionWorker.finishAll())
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('비밀번호')
  await act(() => setLanguagePreference('en'))
  expect(host.textContent).toContain('Password-protected document')
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('password is incorrect')
  expect(host.querySelector<HTMLInputElement>('#document-unlock-key')?.value).toBe('wrong')
})

it('shows English help, examples, and the copied setup prompt in the selected language', async () => {
  setLanguagePreference('en')
  await act(() => root.render(<App />))
  await act(() => host.querySelector<HTMLButtonElement>('[aria-label="Menu"]')!.click())
  await act(() => [...host.querySelectorAll('button')].find((button) => button.textContent === 'Help')!.click())
  expect(document.body.textContent).toContain('Use it right in your browser')
  await act(() => document.querySelector<HTMLButtonElement>('#help-tab-ai')!.click())
  expect(document.querySelector<HTMLTextAreaElement>('#ai-setup-prompt')?.value).toContain('install the raw-md skill')
  expect(document.body.textContent).toContain('Continue the discussion')
  expect(document.querySelector('[role="dialog"]')?.textContent).not.toMatch(/[가-힣]/)
})

it('updates browser-default language and syncs explicit preferences from another tab', async () => {
  const languages = vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US'])
  setLanguagePreference('auto')
  await act(() => root.render(<App />))
  languages.mockReturnValue(['ko-KR'])
  await act(() => window.dispatchEvent(new Event('languagechange')))
  expect(document.documentElement.lang).toBe('ko')
  localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en')
  await act(() => window.dispatchEvent(new StorageEvent('storage', { key: LANGUAGE_STORAGE_KEY, newValue: 'en' })))
  expect(document.documentElement.lang).toBe('en')
})
