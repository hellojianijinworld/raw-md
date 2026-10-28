// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import UpdateNotice from '../components/UpdateNotice'
import { APP_UPDATE_INTERVAL_MS } from '../hooks/useAppUpdate'

let root: Root
let host: HTMLDivElement
const currentCommit = 'a'.repeat(40)
const nextCommit = 'b'.repeat(40)
const manifest = (version = '0.0.1', commit = currentCommit) => new Response(JSON.stringify({ version, commit }))

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubEnv('PROD', true)
  vi.stubEnv('VITE_APP_VERSION', '0.0.1')
  vi.stubEnv('VITE_BUILD_COMMIT', currentCommit)
  window.history.replaceState(null, '', '/?edit=true#Q')
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(() => root.unmount())
  host.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

it('checks deployment metadata without including document content or showing the current build as an update', async () => {
  const fetcher = vi.fn().mockResolvedValue(manifest())
  vi.stubGlobal('fetch', fetcher)
  await act(() => root.render(<UpdateNotice />))
  expect(fetcher).toHaveBeenCalledWith('/version.json', expect.objectContaining({ cache: 'no-store' }))
  expect(host.querySelector('[role="status"]')).toBeNull()
})

it('notifies an already open page after the next deployment and keeps the draft in its original tab', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(manifest())
    .mockImplementation(() => Promise.resolve(manifest('0.1.0', nextCommit)))
  vi.stubGlobal('fetch', fetcher)
  await act(() =>
    root.render(
      <>
        <textarea defaultValue="작성 중인 문서" />
        <UpdateNotice />
      </>,
    ),
  )
  expect(host.querySelector('[role="status"]')).toBeNull()
  await act(() => vi.advanceTimersByTimeAsync(APP_UPDATE_INTERVAL_MS))
  expect(host.querySelector('[role="status"]')?.textContent).toContain('0.1.0')
  const link = host.querySelector('a')!
  expect(link.target).toBe('_blank')
  expect(link.href).toBe(window.location.href)
  await act(() => host.querySelector<HTMLButtonElement>('[aria-label="업데이트 안내 닫기"]')!.click())
  expect(host.querySelector('[role="status"]')).toBeNull()
  expect(host.querySelector('textarea')?.value).toBe('작성 중인 문서')
  expect(window.location.hash).toBe('#Q')
})

it('silently tolerates offline or invalid responses, then retries when the tab regains focus', async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(new Response('{"version":"broken"}'))
    .mockImplementation(() => Promise.resolve(manifest('0.1.0', nextCommit)))
  vi.stubGlobal('fetch', fetcher)
  await act(() => root.render(<UpdateNotice />))
  await act(() => window.dispatchEvent(new Event('focus')))
  expect(host.querySelector('[role="status"]')).toBeNull()
  await act(() => window.dispatchEvent(new Event('focus')))
  expect(host.querySelector('[role="status"]')?.textContent).toContain('0.1.0')
})
