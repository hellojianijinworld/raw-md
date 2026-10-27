import LZString from 'lz-string'
import { runCompressionTask } from './compression'

// URL 해시에서 마크다운을 읽고 쓰는 유틸

/**
 * URL 해시에서 마크다운을 디코딩한다.
 * 해시가 비어있으면 빈 문자열을 반환한다.
 */
export function decodeMarkdownFromHash(signal?: AbortSignal, password?: string): Promise<string> {
  const raw = window.location.hash.slice(1)
  return raw ? runCompressionTask({ action: 'decode', value: raw, password }, signal) : Promise.resolve('')
}

export function isEncryptedHash(raw = window.location.hash.slice(1)): boolean {
  try {
    return decodeURIComponent(raw).startsWith('e1.')
  } catch {
    return false
  }
}

/**
 * 마크다운 문자열을 LZ-string으로 압축한다.
 */
export function encodeMarkdownToHash(markdown: string): string {
  return LZString.compressToEncodedURIComponent(markdown)
}

/**
 * 현재 URL이 에디터 모드인지 확인한다.
 * 해시가 비어있으면 에디터 모드.
 */
export function isEditMode(): boolean {
  return !window.location.hash.slice(1) || new URLSearchParams(window.location.search).get('edit') === 'true'
}

/**
 * 공유 URL을 생성한다.
 */
export async function generateShareUrl(markdown: string, signal?: AbortSignal, password?: string): Promise<string> {
  const base = window.location.origin + window.location.pathname
  const hash = await runCompressionTask({ action: 'encode', value: markdown, password }, signal)
  return `${base}#${hash}`
}

/**
 * 공유 URL을 클립보드에 복사한다.
 */
export async function copyShareUrlToClipboard(
  markdown: string,
  signal?: AbortSignal,
  password?: string,
): Promise<string | null> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) controller.abort()
  try {
    const pending = generateShareUrl(markdown, controller.signal, password)
    void pending.catch(() => undefined)
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
      // Start the write in the click gesture; Safari loses activation after awaiting compression.
      const data = pending.then((url) => new Blob([url], { type: 'text/plain' }))
      // Permission can be denied before the browser consumes the promised data.
      void data.catch(() => undefined)
      await navigator.clipboard.write([new ClipboardItem({ 'text/plain': data })])
    } else {
      await navigator.clipboard.writeText(await pending)
    }
    return await pending
  } catch {
    return null
  } finally {
    controller.abort()
    signal?.removeEventListener('abort', abort)
  }
}
